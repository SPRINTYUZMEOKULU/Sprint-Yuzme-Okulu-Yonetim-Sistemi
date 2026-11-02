import "server-only";

export const PENDING_REGISTRATION_STATUSES = ["pre_registration", "waiting_payment", "waiting_approval"];
export const CLOSED_REGISTRATION_STATUS = "registration_declined";

export async function checkUnregisteredCandidate(client: any, organizationId: string, studentId: string) {
  const [student, enrollments, payments, attendance] = await Promise.all([
    client.from("students").select("id,first_name,last_name,status,branch_id,is_deleted").eq("organization_id", organizationId).eq("id", studentId).maybeSingle(),
    client.from("student_enrollments").select("id").eq("organization_id", organizationId).eq("student_id", studentId).limit(1),
    client.from("student_payments").select("id").eq("organization_id", organizationId).eq("student_id", studentId).eq("payment_status", "received").is("cancelled_at", null).limit(1),
    client.from("attendance_records").select("id").eq("organization_id", organizationId).eq("student_id", studentId).limit(1),
  ]);
  if (student.error || enrollments.error || payments.error || attendance.error) throw new Error("Kayıt ve ödeme geçmişi kontrol edilemedi. İşlem uygulanmadı.");
  if (!student.data || student.data.is_deleted || !PENDING_REGISTRATION_STATUSES.includes(student.data.status)) throw new Error("Bu başvuru artık kesin kayıt bekleyen durumda değil.");
  if (enrollments.data?.length || payments.data?.length || attendance.data?.length) throw new Error("Ders dönemi, tahsilatı veya yoklaması bulunan kişi ‘Kayıt Gerçekleşmedi’ olarak kapatılamaz. Dosyayı kontrol edin.");
  return student.data;
}

export async function requestPreRegistrationClosure(client: any, profile: {id: string; organization_id: string}, studentId: string, reason: string, confirmed: boolean) {
  if (!confirmed) throw new Error("İşlemi anladığınızı onaylayınız. Kayıt değiştirilmedi.");
  if (!studentId || reason.trim().length < 5) throw new Error("En az 5 karakterlik kapatma gerekçesi zorunludur.");
  const student = await checkUnregisteredCandidate(client, profile.organization_id, studentId);
  const {data: existing, error: lookupError} = await client.from("approval_requests").select("id").eq("organization_id", profile.organization_id)
    .eq("student_id", studentId).eq("request_type", "pre_registration_close").eq("status", "pending").limit(1).maybeSingle();
  if (lookupError) throw new Error("Bekleyen kapatma talebi kontrol edilemedi.");
  if (existing) return {id: existing.id, existing: true};
  const {data, error} = await client.from("approval_requests").insert({
    organization_id: profile.organization_id, student_id: studentId, branch_id: student.branch_id,
    entity_type: "student", entity_id: studentId, module: "student", request_type: "pre_registration_close",
    request_label: "Ön Kayıt · Kayıt Gerçekleşmedi", status: "pending", priority: "normal", requested_by: profile.id,
    reason: reason.trim().slice(0,500), description: `${student.first_name} ${student.last_name} için ön kayıt kapatma talebi. Yönetici onayına kadar kayıt korunur.`,
    old_values: {status: student.status}, new_values: {status: CLOSED_REGISTRATION_STATUS, is_active: false},
    metadata: {source: "pre_registration_center"},
  }).select("id").single();
  if (error || !data) throw new Error("Kapatma talebi kaydedilemedi. Kayıt değiştirilmedi.");
  return {id: data.id, existing: false};
}

export async function applyPreRegistrationClosure(client: any, organizationId: string, studentId: string, requestId: string) {
  const student = await checkUnregisteredCandidate(client, organizationId, studentId);
  const {data, error} = await client.from("students").update({status: CLOSED_REGISTRATION_STATUS, is_active: false, updated_at: new Date().toISOString()})
    .eq("organization_id", organizationId).eq("id", studentId).eq("status", student.status).select("id").maybeSingle();
  if (error || !data) throw new Error("Başvurunun durumu değişmiş olabilir. Kapatma uygulanamadı; dosyayı yenileyin.");
  const result = await client.from("system_notifications").update({is_read: true, read_at: new Date().toISOString()})
    .eq("organization_id", organizationId).eq("student_id", studentId).in("notification_type", ["registration_completion_required", "new_pre_registration"]);
  if (result.error) console.error("Closed registration notification resolution failed", requestId);
}
