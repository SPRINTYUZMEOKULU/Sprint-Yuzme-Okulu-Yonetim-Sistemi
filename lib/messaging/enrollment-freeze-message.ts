type FreezeValues = Record<string, unknown>;

export function enrollmentFreezeMessage(status: string, values: FreezeValues) {
  const date = (value: unknown) =>
    typeof value === "string" ? value.split("-").reverse().join(".") : "—";

  if (status === "rejected") return "Kayıt dondurma talebiniz onaylanmadı. Mevcut ders programınız devam ediyor.";
  if (status === "resume_confirmed") {
    return `Dönüş tarihiniz ${date(values.freeze_resume_date)} olarak teyit edildi. Dersleriniz kendi seans günlerinizde devam edecektir. Planlanan paket bitişi: ${date(values.planned_end_date)}.`;
  }
  if (values.callback_pending) {
    const heading = status === "approved" ? "Kayıt dondurma işleminiz onaylanmıştır." : "Kayıt dondurma talebiniz yönetici onayına sunulmuştur.";
    return `${heading} Başlangıç: ${date(values.freeze_start_date)}. En geç dönüş: ${date(values.freeze_resume_date)}. Dönüş tarihinizi telefonla teyit etmek için sizi arayacağız. Daha erken bir tarih belirlenmezse dersleriniz bu tarihten itibaren kendi seans günlerinizde devam eder.`;
  }
  const dates = `Dondurma başlangıcı: ${date(values.freeze_start_date)}. Yeniden başlama tarihi: ${date(values.freeze_resume_date)}.`;
  if (status === "approved") {
    return `Kayıt dondurma işleminiz onaylanmıştır. ${dates} Kalan ders haklarınız korunmuştur. Yeni planlanan paket bitişi: ${date(values.planned_end_date)}.`;
  }
  return `Kayıt dondurma talebiniz yönetici onayına sunulmuştur. ${dates} Karar verildiğinde sizi bilgilendireceğiz.`;
}
