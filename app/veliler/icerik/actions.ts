"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { requireProfile } from "@/lib/auth/profile";

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase yönetici bağlantısı yapılandırılmamış.");
  return createAdminClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function value(formData: FormData, key: string, max = 5000) {
  return String(formData.get(key) || "").trim().slice(0, max);
}

function back(formData: FormData, key: "saved" | "error", message: string): never {
  const destination = formData.get("settings_return") === "belgeler" ? "/ayarlar?bolum=belgeler&" : "/veliler/icerik?";
  revalidatePath("/ayarlar");
  redirect(`${destination}${key}=${encodeURIComponent(message)}`);
}

export async function createAnnouncement(formData: FormData) {
  const profile = await requireProfile(["owner", "admin", "branch_manager"]);
  if (!profile.organization_id) back(formData, "error", "Kurum bilgisi bulunamadı.");

  const title = value(formData, "title", 180);
  const body = value(formData, "body", 5000);
  const publishNow = formData.get("is_published") === "on";
  const branchId = value(formData, "branch_id", 100);
  const groupId = value(formData, "group_id", 100);
  if (!title || !body) back(formData, "error", "Duyuru başlığı ve metni zorunludur.");

  const admin = adminClient();
  let resolvedBranchId = branchId || null;
  if (groupId) {
    const { data: group } = await admin.from("training_groups").select("id,branch_id").eq("organization_id", profile.organization_id).eq("id", groupId).maybeSingle();
    if (!group) back(formData, "error", "Seçilen grup bulunamadı.");
    resolvedBranchId = group.branch_id || resolvedBranchId;
  } else if (branchId) {
    const { data: branch } = await admin.from("branches").select("id").eq("organization_id", profile.organization_id).eq("id", branchId).maybeSingle();
    if (!branch) back(formData, "error", "Seçilen şube bulunamadı.");
  }

  const { error } = await admin.from("announcements").insert({
    organization_id: profile.organization_id,
    title,
    body,
    audience: groupId ? "group" : resolvedBranchId ? "branch" : "all",
    branch_id: resolvedBranchId,
    group_id: groupId || null,
    is_published: publishNow,
    published_at: publishNow ? new Date().toISOString() : null,
    created_by: profile.id,
    updated_at: new Date().toISOString(),
  });
  if (error) back(formData, "error", `Duyuru kaydedilemedi: ${error.message}`);

  revalidatePath("/veliler/icerik");
  revalidatePath("/veli-paneli");
  revalidatePath("/veli-duyurular");
  back(formData, "saved", publishNow ? "Duyuru kaydedildi ve veli portalında yayınlandı." : "Duyuru taslak olarak kaydedildi.");
}

export async function toggleAnnouncement(formData: FormData) {
  const profile = await requireProfile(["owner", "admin", "branch_manager"]);
  const id = value(formData, "id", 100);
  if (!profile.organization_id || !id) back(formData, "error", "Duyuru bulunamadı.");

  const admin = adminClient();
  const { data: current, error: readError } = await admin
    .from("announcements")
    .select("id,is_published")
    .eq("organization_id", profile.organization_id)
    .eq("id", id)
    .maybeSingle();
  if (readError || !current) back(formData, "error", readError?.message || "Duyuru bulunamadı.");

  const next = !current.is_published;
  const { error } = await admin
    .from("announcements")
    .update({
      is_published: next,
      published_at: next ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("organization_id", profile.organization_id)
    .eq("id", id);
  if (error) back(formData, "error", error.message);

  revalidatePath("/veliler/icerik");
  revalidatePath("/veli-paneli");
  revalidatePath("/veli-duyurular");
  back(formData, "saved", next ? "Duyuru veli portalında yayınlandı." : "Duyuru veli portalından kaldırıldı.");
}

export async function createGuardianDocument(formData: FormData) {
  const profile = await requireProfile(["owner", "admin"]);
  if (!profile.organization_id) back(formData, "error", "Kurum bilgisi bulunamadı.");

  const title = value(formData, "title", 180);
  const summary = value(formData, "summary", 500);
  const body = value(formData, "body", 8000);
  const documentType = value(formData, "document_type", 60) || "information";
  const requiresConsent = formData.get("requires_consent") === "on";
  const isActive = formData.get("is_active") === "on";
  if (!title || !body) back(formData, "error", "Belge başlığı ve içeriği zorunludur.");

  const { error } = await adminClient().from("guardian_documents").insert({
    organization_id: profile.organization_id,
    title,
    summary: summary || null,
    body,
    document_type: documentType,
    requires_consent: requiresConsent,
    is_active: isActive,
    created_by: profile.id,
  });
  if (error) back(formData, "error", `Belge kaydedilemedi: ${error.message}`);

  revalidatePath("/veliler/icerik");
  revalidatePath("/veli-belgeler");
  back(formData, "saved", isActive ? "Belge veli portalında yayınlandı." : "Belge taslak/pasif olarak kaydedildi.");
}

export async function toggleGuardianDocument(formData: FormData) {
  const profile = await requireProfile(["owner", "admin"]);
  const id = value(formData, "id", 100);
  if (!profile.organization_id || !id) back(formData, "error", "Belge bulunamadı.");

  const admin = adminClient();
  const { data: current, error: readError } = await admin
    .from("guardian_documents")
    .select("id,is_active")
    .eq("organization_id", profile.organization_id)
    .eq("id", id)
    .maybeSingle();
  if (readError || !current) back(formData, "error", readError?.message || "Belge bulunamadı.");

  const { error } = await admin
    .from("guardian_documents")
    .update({ is_active: !current.is_active, updated_at: new Date().toISOString() })
    .eq("organization_id", profile.organization_id)
    .eq("id", id);
  if (error) back(formData, "error", error.message);

  revalidatePath("/veliler/icerik");
  revalidatePath("/veli-belgeler");
  back(formData, "saved", current.is_active ? "Belge veli portalından kaldırıldı." : "Belge veli portalında yayınlandı.");
}
