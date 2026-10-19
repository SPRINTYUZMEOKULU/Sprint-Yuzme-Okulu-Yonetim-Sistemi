"use server";

import { linkGuardianStudentCanonical, unlinkGuardianStudentCanonical } from "./[id]/actions";
import { portalCredentialContact, savePortalCredential } from "./portal-credential-actions";
import { getGuardianContext } from "@/lib/guardian/data";
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
  redirect(`${path}${path.includes("?")?"&":"?"}${key}=${encodeURIComponent(message)}`);
}


function normalizePhone(value: unknown) {
  let digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("0090")) digits = digits.slice(4);
  if (digits.startsWith("90") && digits.length === 12) digits = digits.slice(2);
  if (digits.startsWith("0") && digits.length === 11) digits = digits.slice(1);
  return digits.length === 10 && digits.startsWith("5") ? `+90${digits}` : "";
}

async function ensureGuardianProfile(admin: ReturnType<typeof adminClient>, guardianId: string, organizationId: string) {
  const { data: existing, error: profileReadError } = await admin
    .from("profiles")
    .select("id,organization_id,role")
    .eq("id", guardianId)
    .maybeSingle();

  if (profileReadError) return { ok: false as const, message: profileReadError.message };

  if (existing) {
    if (existing.organization_id !== organizationId || existing.role !== "guardian") {
      return { ok: false as const, message: "Veli profili bu organizasyona ait değil veya veli rolünde değil." };
    }
    return { ok: true as const };
  }

  const { data: authResult, error: authError } = await admin.auth.admin.getUserById(guardianId);
  const authUser = authResult?.user;
  if (authError || !authUser) {
    return { ok: false as const, message: authError?.message || "Veli Auth hesabı bulunamadı." };
  }

  const metadata = authUser.user_metadata || {};
  if (metadata.role && metadata.role !== "guardian") {
    return { ok: false as const, message: "Auth hesabı veli rolünde değil." };
  }
  if (metadata.organization_id && metadata.organization_id !== organizationId) {
    return { ok: false as const, message: "Auth hesabı farklı bir organizasyona bağlı." };
  }

  const rawPhone = String(authUser.phone || "").replace(/\D/g, "");
  const { error: repairError } = await admin.from("profiles").upsert({
    id: guardianId,
    organization_id: organizationId,
    full_name: String(metadata.full_name || "Veli").trim().slice(0, 200),
    email: authUser.email || null,
    phone: rawPhone ? `+${rawPhone}` : null,
    role: "guardian",
    is_active: true,
    last_sign_in_at: authUser.last_sign_in_at || null,
    updated_at: new Date().toISOString(),
  }, { onConflict: "id" });

  if (repairError) return { ok: false as const, message: `Veli profili onarılamadı: ${repairError.message}` };
  return { ok: true as const };
}

export async function prepareGuardianPortalAccess(guardianProfileId: string, password?: string) {
  return password === undefined
    ? portalCredentialContact({accountId:guardianProfileId})
    : savePortalCredential({accountId:guardianProfileId},password);
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
  formData.set("guardian_profile_id", text(formData, "guardian_id", 100));
  return linkGuardianStudentCanonical(formData);
}

export async function unlinkGuardianStudent(formData: FormData) {
  formData.set("guardian_profile_id", text(formData, "guardian_id", 100));
  return unlinkGuardianStudentCanonical(formData);
}

export async function createGuardianRequest(formData: FormData) {
  const profile = await requireProfile(["guardian"]);
  const organizationId = profile.organization_id;
  const studentId = text(formData, "student_id", 100);
  const subject = text(formData, "subject", 200);
  const requestPath = `/veli-talepleri${studentId?`?child=${encodeURIComponent(studentId)}`:""}`;
  const description = text(formData, "description", 4000);
  if (!organizationId || !studentId || !subject || !description) back(requestPath, "error", "Öğrenci, konu ve açıklama zorunludur.");

  const context = await getGuardianContext(profile.id, studentId);
  if (!context.students.some(student => student.id === studentId)) back(requestPath, "error", "Bu öğrenci için talep oluşturma yetkiniz yok.");

  const requestNumber = `VTL-${new Date().getFullYear()}-${Date.now().toString().slice(-7)}`;
  const { data: created, error } = await adminClient().from("guardian_requests").insert({
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
  if (error) back(requestPath, "error", error.message);

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
  back(requestPath, "saved", `Talebiniz oluşturuldu. Talep numarası: ${requestNumber}`);
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
