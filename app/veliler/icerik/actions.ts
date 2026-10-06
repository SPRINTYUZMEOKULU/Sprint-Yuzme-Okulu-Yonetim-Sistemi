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

function back(key: "saved" | "error", message: string): never {
  redirect(`/veliler/icerik?${key}=${encodeURIComponent(message)}`);
}

export async function createAnnouncement(formData: FormData) {
  const profile = await requireProfile(["owner", "admin", "branch_manager"]);
  if (!profile.organization_id) back("error", "Kurum bilgisi bulunamadı.");

  const title = value(formData, "title", 180);
  const body = value(formData, "body", 5000);
  const publishNow = formData.get("is_published") === "on";
  if (!title || !body) back("error", "Duyuru başlığı ve metni zorunludur.");

  const { error } = await adminClient().from("announcements").insert({
    organization_id: profile.organization_id,
    title,
    body,
    audience: "all",
    is_published: publishNow,
    published_at: publishNow ? new Date().toISOString() : null,
    created_by: profile.id,
    updated_at: new Date().toISOString(),
  });
  if (error) back("error", `Duyuru kaydedilemedi: ${error.message}`);

  revalidatePath("/veliler/icerik");
  revalidatePath("/veli-paneli");
  revalidatePath("/veli-duyurular");
  back("saved", publishNow ? "Duyuru kaydedildi ve veli portalında yayınlandı." : "Duyuru taslak olarak kaydedildi.");
}

export async function toggleAnnouncement(formData: FormData) {
  const profile = await requireProfile(["owner", "admin", "branch_manager"]);
  const id = value(formData, "id", 100);
  if (!profile.organization_id || !id) back("error", "Duyuru bulunamadı.");

  const admin = adminClient();
  const { data: current, error: readError } = await admin
    .from("announcements")
    .select("id,is_published")
    .eq("organization_id", profile.organization_id)
    .eq("id", id)
    .maybeSingle();
  if (readError || !current) back("error", readError?.message || "Duyuru bulunamadı.");

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
  if (error) back("error", error.message);

  revalidatePath("/veliler/icerik");
  revalidatePath("/veli-paneli");
  revalidatePath("/veli-duyurular");
  back("saved", next ? "Duyuru veli portalında yayınlandı." : "Duyuru veli portalından kaldırıldı.");
}

export async function createGuardianDocument(formData: FormData) {
  const profile = await requireProfile(["owner", "admin"]);
  if (!profile.organization_id) back("error", "Kurum bilgisi bulunamadı.");

  const title = value(formData, "title", 180);
  const summary = value(formData, "summary", 500);
  const body = value(formData, "body", 8000);
  const documentType = value(formData, "document_type", 60) || "information";
  const requiresConsent = formData.get("requires_consent") === "on";
  const isActive = formData.get("is_active") === "on";
  if (!title || !body) back("error", "Belge başlığı ve içeriği zorunludur.");

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
  if (error) back("error", `Belge kaydedilemedi: ${error.message}`);

  revalidatePath("/veliler/icerik");
  revalidatePath("/veli-belgeler");
  back("saved", isActive ? "Belge veli portalında yayınlandı." : "Belge taslak/pasif olarak kaydedildi.");
}

export async function toggleGuardianDocument(formData: FormData) {
  const profile = await requireProfile(["owner", "admin"]);
  const id = value(formData, "id", 100);
  if (!profile.organization_id || !id) back("error", "Belge bulunamadı.");

  const admin = adminClient();
  const { data: current, error: readError } = await admin
    .from("guardian_documents")
    .select("id,is_active")
    .eq("organization_id", profile.organization_id)
    .eq("id", id)
    .maybeSingle();
  if (readError || !current) back("error", readError?.message || "Belge bulunamadı.");

  const { error } = await admin
    .from("guardian_documents")
    .update({ is_active: !current.is_active, updated_at: new Date().toISOString() })
    .eq("organization_id", profile.organization_id)
    .eq("id", id);
  if (error) back("error", error.message);

  revalidatePath("/veliler/icerik");
  revalidatePath("/veli-belgeler");
  back("saved", current.is_active ? "Belge veli portalından kaldırıldı." : "Belge veli portalında yayınlandı.");
}
