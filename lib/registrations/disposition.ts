import "server-only";

export const REJECTION_MESSAGE = "Başvurunuz değerlendirilmiş olup kaydınız uygun görülmemiştir. İlginiz için teşekkür ederiz.\nSprint Yüzme Okulu";
const CANDIDATE_STATUSES = ["pre_registration", "waiting_payment", "waiting_approval", "registration_declined"];

// These operations concern applicants only. Existing course and financial files use
// the student status workflow, so a mistaken click cannot erase a debt or attendance.
export async function getCandidate(client: any, organizationId: string, studentId: string) {
  const student = await client.from("students")
    .select("id,first_name,last_name,status,is_deleted,phone,guardian_phone,updated_at")
    .eq("organization_id", organizationId).eq("id", studentId).maybeSingle();
  if (student.error) throw new Error("Başvuru doğrulanamadı.");
  if (!student.data || student.data.is_deleted || !CANDIDATE_STATUSES.includes(student.data.status))
    throw new Error("Bu işlem yalnızca ön kayıt veya kapatılmış başvurularda kullanılabilir.");
  const histories = await Promise.all(["student_enrollments", "student_payments", "attendance_records", "student_financial_obligations", "student_payment_plans", "student_payment_installments"].map(table =>
    client.from(table).select("id").eq("organization_id", organizationId).eq("student_id", studentId).limit(1)));
  if (histories.some(result => result.error)) throw new Error("Ders ve ödeme geçmişi kontrol edilemedi. İşlem uygulanmadı.");
  if (histories.some(result => result.data?.length)) throw new Error("Ders dönemi, ödeme/borç veya yoklama kaydı bulunan dosya bu alandan kapatılamaz veya silinemez.");
  return student.data;
}

export async function disposeCandidate(client: any, profile: {id: string; organization_id: string}, input: {
  studentId: string; action: string; reason: string; confirmed: boolean; messageId?: string; deletionText?: string;
}) {
  if (!input.confirmed) throw new Error("İşlem onayı gereklidir.");
  if (!["archive", "reject", "delete", "reject_delete"].includes(input.action)) throw new Error("Geçersiz işlem.");
  if (input.reason.trim().length < 5) throw new Error("En az 5 karakterlik işlem gerekçesi girin.");
  const candidate = await getCandidate(client, profile.organization_id, input.studentId);
  const removing = ["delete", "reject_delete"].includes(input.action);
  if (removing && input.deletionText !== "SİL") throw new Error("Kalıcı silme için SİL yazın.");
  if (["reject", "reject_delete"].includes(input.action)) {
    const log = await client.from("message_logs").select("id,status,template_key,metadata")
      .eq("organization_id", profile.organization_id).eq("student_id", input.studentId).eq("id", input.messageId || "").maybeSingle();
    if (log.error || !log.data || log.data.template_key !== "registration_rejected" || log.data.status !== "sent" ||
        log.data.metadata?.delivery_confirmation !== "manual_confirmed") throw new Error("Ret mesajının gönderildiğini önce onaylayın. Başvuru korunuyor.");
  }
  const now = new Date().toISOString();
  if (removing) {
    const result = await client.rpc("delete_unregistered_applicant", {
      p_organization_id:profile.organization_id, p_actor_id:profile.id, p_student_id:input.studentId,
      p_expected_updated_at:candidate.updated_at, p_confirmation:input.deletionText,
      p_require_rejection:input.action === "reject_delete", p_message_id:input.messageId || null,
    });
    if (result.error || result.data !== input.studentId) throw new Error(result.error?.message || "Kalıcı silme tamamlanamadı. Dosyayı yenileyin.");
  } else {
    let query = client.from("students").update({status:"registration_declined",is_active:false,updated_at:now})
      .eq("organization_id",profile.organization_id).eq("id",input.studentId).eq("status",candidate.status);
    if(candidate.updated_at) query=query.eq("updated_at",candidate.updated_at);
    const result=await query.select("id").maybeSingle();
    if(result.error || !result.data) throw new Error("Başvuru değişmiş. İşlem uygulanamadı; dosyayı yenileyin.");
  }
  if (!removing) {
    const log = await client.from("student_activity_logs").insert({organization_id:profile.organization_id,student_id:input.studentId,
      activity_type:input.action === "reject" ? "registration_rejected" : "registration_archived",
      title:input.action === "reject" ? "Başvuru reddedildi" : "Başvuru arşive kaldırıldı",description:input.reason.trim().slice(0,500),
      performed_by:profile.id,performed_at:now,source_type:"pre_registration_disposition",source_id:input.studentId});
    if (log.error) console.error("Candidate disposition activity could not be recorded", log.error.code);
    const notifications = await client.from("system_notifications").update({is_read:true,read_at:now})
      .eq("organization_id",profile.organization_id).eq("student_id",input.studentId)
      .in("notification_type",["new_pre_registration","registration_completion_required"]);
    if (notifications.error) console.error("Candidate notifications could not be resolved",notifications.error.code);
  }
  return {deleted:removing};
}
