"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { requireProfile } from "@/lib/auth/profile";

const managementRoles = ["owner", "admin", "branch_manager", "registration_staff"] as const;

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase yönetici bağlantısı yapılandırılmamış.");
  return createAdminClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function text(formData: FormData, key: string, max = 3000) {
  return String(formData.get(key) || "").trim().slice(0, max);
}

function back(profileId: string, key: "saved" | "error", message: string): never {
  redirect(`/veliler/${profileId}?${key}=${encodeURIComponent(message)}`);
}

async function resolveCanonicalGuardianId(authProfileId: string, organizationId: string) {
  const admin = adminClient();
  const { data: row, error } = await admin
    .from("guardians")
    .select("id,auth_user_id")
    .eq("organization_id", organizationId)
    .eq("auth_user_id", authProfileId)
    .maybeSingle();

  if (error) return { ok: false as const, message: error.message, guardianId: "" };
  if (!row?.id) return { ok: false as const, message: "Bu portal hesabına ait ana veli kaydı bulunamadı.", guardianId: "" };
  return { ok: true as const, message: "", guardianId: row.id };
}

async function verifyLinkedStudent(authProfileId: string, studentId: string, organizationId: string) {
  const admin = adminClient();
  const resolved = await resolveCanonicalGuardianId(authProfileId, organizationId);
  if (!resolved.ok) return { ok: false as const, message: resolved.message };

  const { data: student } = await admin
    .from("students")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("id", studentId)
    .maybeSingle();
  if (!student) return { ok: false as const, message: "Öğrenci bulunamadı." };

  const { data: link } = await admin
    .from("guardian_students")
    .select("student_id")
    .eq("guardian_id", resolved.guardianId)
    .eq("student_id", studentId)
    .maybeSingle();
  if (!link) return { ok: false as const, message: "Bu öğrenci bu veli hesabına bağlı değil." };

  return { ok: true as const };
}

export async function linkGuardianStudentCanonical(formData: FormData) {
  const profile = await requireProfile([...managementRoles]);
  const authProfileId = text(formData, "guardian_profile_id", 100);
  const studentId = text(formData, "student_id", 100);
  if (!profile.organization_id || !authProfileId || !studentId) back(authProfileId, "error", "Veli veya öğrenci seçilmedi.");

  const admin = adminClient();
  const resolved = await resolveCanonicalGuardianId(authProfileId, profile.organization_id);
  if (!resolved.ok) back(authProfileId, "error", resolved.message);

  const { data: student, error: studentError } = await admin
    .from("students")
    .select("id")
    .eq("organization_id", profile.organization_id)
    .eq("id", studentId)
    .maybeSingle();
  if (studentError || !student) back(authProfileId, "error", studentError?.message || "Öğrenci bulunamadı.");

  const { error } = await admin.from("guardian_students").upsert({
    guardian_id: resolved.guardianId,
    student_id: studentId,
    relationship: text(formData, "relationship", 50) || "Veli",
    is_primary: formData.get("is_primary") === "on",
    is_payment_contact: formData.get("is_payment_contact") === "on",
    receives_messages: formData.get("receives_messages") === "on",
    portal_access: formData.get("portal_access") === "on",
    is_emergency_contact: formData.get("is_emergency_contact") === "on",
  }, { onConflict: "guardian_id,student_id" });

  if (error) back(authProfileId, "error", `Öğrenci bağlanamadı: ${error.message}`);
  revalidatePath("/veliler");
  revalidatePath(`/veliler/${authProfileId}`);
  back(authProfileId, "saved", "Öğrenci bağlantısı kaydedildi.");
}

export async function unlinkGuardianStudentCanonical(formData: FormData) {
  const profile = await requireProfile(["owner", "admin"]);
  const authProfileId = text(formData, "guardian_profile_id", 100);
  const studentId = text(formData, "student_id", 100);
  if (!profile.organization_id || !authProfileId || !studentId) back(authProfileId, "error", "Veli veya öğrenci bulunamadı.");

  const admin = adminClient();
  const resolved = await resolveCanonicalGuardianId(authProfileId, profile.organization_id);
  if (!resolved.ok) back(authProfileId, "error", resolved.message);

  const { error } = await admin.from("guardian_students").delete()
    .eq("guardian_id", resolved.guardianId)
    .eq("student_id", studentId);
  if (error) back(authProfileId, "error", error.message);

  revalidatePath("/veliler");
  revalidatePath(`/veliler/${authProfileId}`);
  back(authProfileId, "saved", "Öğrenci bağlantısı kaldırıldı.");
}

export async function addGuardianProgressNote(formData: FormData) {
  const profile = await requireProfile([...managementRoles]);
  const authProfileId = text(formData, "guardian_profile_id", 100);
  const studentId = text(formData, "student_id", 100);
  const note = text(formData, "note", 4000);
  const target = text(formData, "target", 1000);
  if (!profile.organization_id || !authProfileId || !studentId || !note) back(authProfileId, "error", "Öğrenci ve gelişim notu zorunludur.");

  const verified = await verifyLinkedStudent(authProfileId, studentId, profile.organization_id);
  if (!verified.ok) back(authProfileId, "error", verified.message);

  const { error } = await adminClient().from("progress_notes").insert({
    student_id: studentId,
    coach_id: profile.id,
    note,
    target: target || null,
    visible_to_guardian: formData.get("visible_to_guardian") === "on",
  });
  if (error) back(authProfileId, "error", `Gelişim notu kaydedilemedi: ${error.message}`);

  revalidatePath(`/veliler/${authProfileId}`);
  revalidatePath("/veli-gelisim");
  back(authProfileId, "saved", formData.get("visible_to_guardian") === "on" ? "Gelişim notu kaydedildi ve veli portalında yayınlandı." : "Gelişim notu kaydedildi; yalnızca yönetim tarafından görülebilir.");
}

export async function sendGuardianPortalMessage(formData: FormData) {
  const profile = await requireProfile([...managementRoles]);
  const authProfileId = text(formData, "guardian_profile_id", 100);
  const studentId = text(formData, "student_id", 100);
  const title = text(formData, "title", 180);
  const body = text(formData, "body", 4000);
  const messageType = text(formData, "message_type", 40) || "information";
  if (!profile.organization_id || !authProfileId || !title || !body) back(authProfileId, "error", "Mesaj başlığı ve içeriği zorunludur.");

  if (studentId) {
    const verified = await verifyLinkedStudent(authProfileId, studentId, profile.organization_id);
    if (!verified.ok) back(authProfileId, "error", verified.message);
  }

  const { error } = await adminClient().from("guardian_messages").insert({
    organization_id: profile.organization_id,
    guardian_id: authProfileId,
    student_id: studentId || null,
    title,
    body,
    message_type: messageType,
    channel: "panel",
    sent_by: profile.id,
    sent_at: new Date().toISOString(),
  });
  if (error) back(authProfileId, "error", `Portal mesajı gönderilemedi: ${error.message}`);

  revalidatePath(`/veliler/${authProfileId}`);
  revalidatePath("/veli-mesajlar");
  back(authProfileId, "saved", "Mesaj veli portalına gönderildi.");
}

export async function toggleGuardianProgressVisibility(formData: FormData) {
  const profile = await requireProfile([...managementRoles]);
  const authProfileId = text(formData, "guardian_profile_id", 100);
  const noteId = text(formData, "note_id", 100);
  const studentId = text(formData, "student_id", 100);
  if (!profile.organization_id || !authProfileId || !noteId || !studentId) back(authProfileId, "error", "Gelişim notu bulunamadı.");

  const verified = await verifyLinkedStudent(authProfileId, studentId, profile.organization_id);
  if (!verified.ok) back(authProfileId, "error", verified.message);

  const admin = adminClient();
  const { data: current } = await admin.from("progress_notes").select("id,visible_to_guardian").eq("id", noteId).eq("student_id", studentId).maybeSingle();
  if (!current) back(authProfileId, "error", "Gelişim notu bulunamadı.");
  const next = !current.visible_to_guardian;
  const { error } = await admin.from("progress_notes").update({ visible_to_guardian: next }).eq("id", noteId).eq("student_id", studentId);
  if (error) back(authProfileId, "error", error.message);

  revalidatePath(`/veliler/${authProfileId}`);
  revalidatePath("/veli-gelisim");
  back(authProfileId, "saved", next ? "Gelişim notu veli portalında görünür hale getirildi." : "Gelişim notu veli portalından gizlendi.");
}
