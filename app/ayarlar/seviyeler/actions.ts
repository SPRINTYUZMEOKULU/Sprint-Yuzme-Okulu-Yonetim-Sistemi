"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";

export async function saveSwimmingLevel(form: FormData) {
  try {
    const profile = await requireProfile(["owner", "admin"]);
    if (!profile.organization_id) throw new Error("Kurum bulunamadı.");
    const db = await createClient();
    const org = profile.organization_id;
    const id = String(form.get("id") || "");
    const name = String(form.get("name") || "").trim();
    const description = String(form.get("description") || "").trim();
    const order = Number(form.get("sort_order"));
    if (!name || name.length > 100 || description.length > 1500 || !Number.isInteger(order) || order < 0 || order > 999) {
      throw new Error("Seviye adı, açıklaması ve sıralamasını kontrol edin.");
    }
    const { data: duplicates, error: duplicateError } = await db.from("swimming_levels").select("id,name").eq("organization_id", org);
    if (duplicateError) throw duplicateError;
    if ((duplicates || []).some((l) => l.id !== id && l.name.trim().toLocaleLowerCase("tr-TR") === name.toLocaleLowerCase("tr-TR"))) {
      throw new Error("Bu isimde bir seviye zaten var. Mevcut kaydı düzenleyin.");
    }
    if (id) {
      const { data: current, error } = await db.from("swimming_levels").select("id,name").eq("organization_id", org).eq("id", id).single();
      if (error || !current) throw new Error("Seviye bulunamadı.");
      if (current.name !== name) {
        const counts = await Promise.all([
          db.from("students").select("id", { count: "exact", head: true }).eq("organization_id", org).eq("swimming_level", current.name),
          db.from("training_groups").select("id", { count: "exact", head: true }).eq("organization_id", org).eq("level_id", id),
          db.from("student_group_memberships").select("id", { count: "exact", head: true }).eq("organization_id", org).eq("level_id", id),
        ]);
        if (counts.some((r) => r.error)) throw new Error("Seviye bağlantıları doğrulanamadı.");
        if (counts.some((r) => (r.count || 0) > 0)) throw new Error("Kullanılan seviyenin adı korunur. Açıklama, sıra ve aktifliği değiştirebilir; farklı ad için yeni seviye ekleyebilirsiniz.");
      }
    }
    const values = { name, description: description || null, sort_order: order, is_active: form.get("is_active") === "on", updated_at: new Date().toISOString() };
    const result = id
      ? await db.from("swimming_levels").update(values).eq("id", id).eq("organization_id", org).select("id").single()
      : await db.from("swimming_levels").insert({ ...values, organization_id: org }).select("id").single();
    if (result.error) throw result.error;
    for (const path of ["/ayarlar/seviyeler", "/gruplar", "/operasyon-plani", "/on-kayit", "/api/public-registration-options"]) revalidatePath(path);
    return { ok: true, message: "Seviye kaydedildi. Güncel seçenekler yeni seçimlerde kullanılacak." };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Seviye kaydedilemedi." };
  }
}
