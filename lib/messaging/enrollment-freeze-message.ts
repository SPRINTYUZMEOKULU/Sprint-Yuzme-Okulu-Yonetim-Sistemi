type FreezeValues = Record<string, unknown>;

export function enrollmentFreezeMessage(status: string, values: FreezeValues) {
  const date = (value: unknown) =>
    typeof value === "string" ? value.split("-").reverse().join(".") : "—";

  if (status === "rejected") return "Kayıt dondurma talebiniz onaylanmadı. Mevcut ders programınız devam ediyor.";
  const dates = `Dondurma başlangıcı: ${date(values.freeze_start_date)}. Yeniden başlama tarihi: ${date(values.freeze_resume_date)}.`;
  if (status === "approved") {
    return `Kayıt dondurma işleminiz onaylanmıştır. ${dates} Kalan ders haklarınız korunmuştur. Yeni planlanan paket bitişi: ${date(values.planned_end_date)}.`;
  }
  return `Kayıt dondurma talebiniz yönetici onayına sunulmuştur. ${dates} Karar verildiğinde sizi bilgilendireceğiz.`;
}
