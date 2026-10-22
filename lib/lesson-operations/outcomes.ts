export type CancellationOutcome = {
  studentId: string;
  studentName: string;
  groupName: string;
  status: "processed" | "skipped";
  reason: string;
  warning?: boolean;
};

export function missingEnrollmentReason(enrollments: any[], cancelledDate: string) {
  if (!enrollments.length) return "Bu grupta aktif kayıt dönemi bulunamadı.";
  if (enrollments.every(e => !e.start_date)) return "Kayıt başlangıç tarihi eksik.";
  if (enrollments.every(e => !e.start_date || e.start_date > cancelledDate)) return "Kayıt dönemi iptal tarihinden sonra başlıyor.";
  if (enrollments.some(e => e.start_confirmation_required && !e.actual_started_at)) return "Kursa başlatma onayı henüz verilmemiş.";
  return "Fiilî başlangıç tarihi iptal tarihinden sonra; bu derse işlem uygulanmadı.";
}
