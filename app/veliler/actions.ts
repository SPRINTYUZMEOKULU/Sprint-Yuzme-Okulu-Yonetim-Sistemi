"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { requireProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import { createNotification } from "@/lib/notifications/create-notification";

const managementRoles = ["owner", "admin", "branch_manager", "registration_staff"] as const;
const staffRoles = ["owner", "admin", "branch_manager", "registration_staff", "accounting", "coach"] as const;

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase yönetici bağlantısı yapılandırılmamış.");
  return createAdminClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function text(formData: FormData, key: string, max = 3000) {
  return String(formData.get(key) || "").trim().slice(0, max);
}

function back(path: string, key: "saved" | "error", message: string): never {
  redirect(`${path}?${key}=${encodeURIComponent(message)}`);
}

export async function updateGuardian(formData: FormData) {
  const profile = await requireProfile([...managementRoles]);
  const guardianId = text(formData, "guardian_id", 100);
  const path = `/veliler/${guardianId}`;
  if (!profile.organization_id || !guardianId) back("/veliler", "error", "Veli bulunamadı.");

  const admin = adminClient();
  const { error } = await admin.from("profiles").update({
    full_name: text(formData, "full_name", 200) || null,
    phone: text(formData, "phone", 40) || null,
    is_active: formData.get("is_active") === "on",
    updated_at: new Date().toISOString(),
  }).eq("organization_id", profile.organization_id).eq("id", guardianId).eq("role", "guardian");

  if (error) back(path, "error", error.message);
  revalidatePath("/veliler");
  revalidatePath(path);
  back(path, "saved", "Veli bilgileri kaydedildi.");
}

export async function linkGuardianStudent(formData: FormData) {
  const profile = await requireProfile([...managementRoles]);
  const guardianId = text(formData, "guardian_id", 100);
  const studentId = text(formData, "student_id", 100);
  const path = `/veliler/${guardianId}`;
  if (!profile.organization_id || !guardianId || !studentId) back(path, "error", "Veli veya öğrenci seçilmedi.");

  const admin = adminClient();
  const { error } = await admin.from("guardian_students").upsert({
    guardian_id: guardianId,
    student_id: studentId,
    relationship: text(formData, "relationship", 50) || "Veli",
    is_primary: formData.get("is_primary") === "on",
    is_payment_contact: formData.get("is_payment_contact") === "on",
    receives_messages: formData.get("receives_messages") === "on",
    portal_access: formData.get("portal_access") === "on",
    is_emergency_contact: formData.get("is_emergency_contact") === "on",
  }, { onConflict: "guardian_id,student_id" });

  if (error) back(path, "error", `Öğrenci bağlanamadı: ${error.message}`);
  revalidatePath("/veliler");
  revalidatePath(path);
  back(path, "saved", "Öğrenci bağlantısı kaydedildi.");
}

export async function unlinkGuardianStudent(formData: FormData) {
  const profile = await requireProfile(["owner", "admin"]);
  const guardianId = text(formData, "guardian_id", 100);
  const studentId = text(formData, "student_id", 100);
  const path = `/veliler/${guardianId}`;
  const admin = adminClient();
  const { error } = await admin.from("guardian_students").delete()
    .eq("guardian_id", guardianId).eq("student_id", studentId);
  if (error) back(path, "error", error.message);
  revalidatePath("/veliler");
  revalidatePath(path);
  back(path, "saved", "Öğrenci bağlantısı kaldırıldı.");
}

export async function createGuardianRequest(formData: FormData) {
  const profile = await requireProfile(["guardian"]);
  const organizationId = profile.organization_id;
  const studentId = text(formData, "student_id", 100);
  const subject = text(formData, "subject", 200);
  const description = text(formData, "description", 4000);
  if (!organizationId || !studentId || !subject || !description) back("/veli-talepleri", "error", "Öğrenci, konu ve açıklama zorunludur.");

  const supabase = await createClient();
  const { data: link } = await supabase.from("guardian_students").select("student_id").eq("guardian_id", profile.id).eq("student_id", studentId).maybeSingle();
  if (!link) back("/veli-talepleri", "error", "Bu öğrenci için talep oluşturma yetkiniz yok.");

  const requestNumber = `VTL-${new Date().getFullYear()}-${Date.now().toString().slice(-7)}`;
  const { data: created, error } = await supabase.from("guardian_requests").insert({
    organization_id: organizationId,
    guardian_id: profile.id,
    student_id: studentId,
    request_number: requestNumber,
    category: text(formData, "category", 50) || "other",
    subject,
    description,
    priority: text(formData, "priority", 20) || "normal",
    status: "new",
  }).select("id").single();
  if (error) back("/veli-talepleri", "error", error.message);

  await createNotification({
    organizationId,
    category: "students",
    eventKey: "guardian_request_created",
    notificationType: "guardian_request_created",
    title: `Yeni veli talebi · ${requestNumber}`,
    body: `${profile.full_name || "Veli"}: ${subject}`,
    severity: text(formData, "priority", 20) === "urgent" ? "critical" : "info",
    priority: text(formData, "priority", 20) === "urgent" ? "critical" : "normal",
    studentId,
    sourceType: "guardian_request",
    sourceId: created?.id || null,
    targetPath: `/veli-talepleri?request=${created?.id || ""}`,
    push: true,
  });

  revalidatePath("/veli-talepleri");
  back("/veli-talepleri", "saved", `Talebiniz oluşturuldu. Talep numarası: ${requestNumber}`);
}

export async function manageGuardianRequest(formData: FormData) {
  const profile = await requireProfile([...staffRoles]);
  const organizationId = profile.organization_id;
  const requestId = text(formData, "request_id", 100);
  if (!organizationId || !requestId) back("/veli-talepleri", "error", "Talep bulunamadı.");

  const supabase = await createClient();
  const status = text(formData, "status", 30) || "reviewing";
  const guardianResponse = text(formData, "guardian_response", 4000) || null;
  const { data: requestRow, error } = await supabase.from("guardian_requests").update({
    status,
    priority: text(formData, "priority", 20) || "normal",
    assigned_to: text(formData, "assigned_to", 100) || null,
    internal_note: text(formData, "internal_note", 4000) || null,
    guardian_response: guardianResponse,
    responded_by: guardianResponse ? profile.id : null,
    responded_at: guardianResponse ? new Date().toISOString() : null,
    resolved_at: status === "resolved" ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
  }).eq("organization_id", organizationId).eq("id", requestId)
    .select("guardian_id,student_id,request_number").single();
  if (error) back("/veli-talepleri", "error", error.message);

  if (guardianResponse && requestRow?.guardian_id) {
    await createNotification({
      organizationId,
      category: "students",
      eventKey: "guardian_request_answered",
      notificationType: "guardian_request_answered",
      title: `Talebiniz yanıtlandı · ${requestRow.request_number}`,
      body: guardianResponse,
      severity: "success",
      priority: "normal",
      studentId: requestRow.student_id,
      sourceType: "guardian_request",
      sourceId: requestId,
      targetPath: `/veli-talepleri?request=${requestId}`,
      recipientProfileIds: [requestRow.guardian_id],
      push: true,
    });
  }

  revalidatePath("/veli-talepleri");
  back("/veli-talepleri", "saved", "Talep güncellendi.");
}
