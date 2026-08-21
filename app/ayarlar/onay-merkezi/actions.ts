"use server";

import { revalidatePath } from "next/cache";

import { requireProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";

const ALLOWED_FIELDS = new Set([
  "is_active",
  "requires_approval",
  "dashboard_notification",
  "push_notification",
]);

export async function updateApprovalRuleField(formData: FormData) {
  const profile = await requireProfile(["owner", "admin"]);
  const organizationId = profile.organization_id;

  if (!organizationId) {
    throw new Error("Organizasyon bilgisi bulunamadı.");
  }

  const ruleId = String(formData.get("ruleId") || "");
  const field = String(formData.get("field") || "");
  const rawValue = String(formData.get("value") || "");

  if (!ruleId) {
    throw new Error("Onay kuralı bulunamadı.");
  }

  if (!ALLOWED_FIELDS.has(field)) {
    throw new Error("Geçersiz onay ayarı.");
  }

  const value = rawValue === "true";

  const supabase = await createClient();

  const { data: currentRule, error: readError } = await supabase
    .from("approval_rules")
    .select("id,title,rule_key,module")
    .eq("id", ruleId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (readError || !currentRule) {
    throw new Error(
      readError?.message || "Onay kuralı bulunamadı."
    );
  }

  const { error } = await supabase
    .from("approval_rules")
    .update({
      [field]: value,
      updated_at: new Date().toISOString(),
    })
    .eq("id", ruleId)
    .eq("organization_id", organizationId);

  if (error) {
    throw new Error(`Ayar güncellenemedi: ${error.message}`);
  }

  /*
   * Ayar değişikliği de yöneticinin ana bildirim geçmişine yazılır.
   * Push burada gönderilmiyor; push dispatcher bağlandığında
   * push_requested=true kayıtları gönderilecek.
   */
  await supabase.from("system_notifications").insert({
    organization_id: organizationId,
    recipient_user_id: null,
    category: "system",
    event_key: "approval_rule_changed",
    title: "Onay ayarı güncellendi",
    message: `${currentRule.title} için ${field} ayarı ${
      value ? "açıldı" : "kapatıldı"
    }.`,
    severity: "info",
    entity_type: "approval_rule",
    entity_id: currentRule.id,
    is_read: false,
    push_requested: false,
    metadata: {
      rule_key: currentRule.rule_key,
      module: currentRule.module,
      field,
      value,
    },
    created_by: profile.id,
  });

  revalidatePath("/ayarlar/onay-merkezi");
  revalidatePath("/ayarlar");
  revalidatePath("/");
  revalidatePath("/onay-merkezi");
}

export async function setModuleApprovalDefaults(formData: FormData) {
  const profile = await requireProfile(["owner", "admin"]);
  const organizationId = profile.organization_id;

  if (!organizationId) {
    throw new Error("Organizasyon bilgisi bulunamadı.");
  }

  const module = String(formData.get("module") || "");
  const mode = String(formData.get("mode") || "");

  if (!module) {
    throw new Error("Modül bilgisi bulunamadı.");
  }

  if (!["secure", "notify"].includes(mode)) {
    throw new Error("Geçersiz toplu ayar.");
  }

  const supabase = await createClient();

  const update =
    mode === "secure"
      ? {
          is_active: true,
          requires_approval: true,
          dashboard_notification: true,
          updated_at: new Date().toISOString(),
        }
      : {
          is_active: true,
          requires_approval: false,
          dashboard_notification: true,
          updated_at: new Date().toISOString(),
        };

  const { error } = await supabase
    .from("approval_rules")
    .update(update)
    .eq("organization_id", organizationId)
    .eq("module", module);

  if (error) {
    throw new Error(`Toplu ayar uygulanamadı: ${error.message}`);
  }

  await supabase.from("system_notifications").insert({
    organization_id: organizationId,
    recipient_user_id: null,
    category: "system",
    event_key: "approval_module_defaults_changed",
    title: "Onay grubu güncellendi",
    message:
      mode === "secure"
        ? `${module} grubu için yönetici onayı ve ana panel bildirimi açıldı.`
        : `${module} grubu sadece ana panel bildirimi moduna alındı.`,
    severity: "info",
    entity_type: "approval_module",
    entity_id: module,
    is_read: false,
    push_requested: false,
    metadata: {
      module,
      mode,
    },
    created_by: profile.id,
  });

  revalidatePath("/ayarlar/onay-merkezi");
  revalidatePath("/ayarlar");
  revalidatePath("/");
  revalidatePath("/onay-merkezi");
}
