export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const DOCUMENT_STATUS_LABELS: Record<string, string> = {
  waiting_customer: "Bilgiler bekleniyor", customer_completed: "Bilgiler tamamlandı",
  waiting_payment: "Ödeme bekleniyor", payment_received: "Tahsilat eşleştirildi",
  document_pending: "Belge hazırlanacak", document_created: "Belge kaydedildi",
  document_sent: "Belge teslim edildi", error: "Kontrol gerekli", cancelled: "İptal edildi",
};
export function parseAmount(value: unknown) {
  const input = String(value ?? "").trim();
  if (!input) return null;
  const normalized = input.includes(",") ? input.replace(/\./g, "").replace(",", ".") : input;
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return NaN;
  return Math.round(Number(normalized) * 100) / 100;
}
export function validIdentity(value: string, company = false) {
  if (company) return /^\d{10}$/.test(value);
  if (!/^[1-9]\d{10}$/.test(value)) return false;
  const d = [...value].map(Number);
  const odd = d[0] + d[2] + d[4] + d[6] + d[8];
  const even = d[1] + d[3] + d[5] + d[7];
  return ((odd * 7 - even) % 10 + 10) % 10 === d[9] && d.slice(0, 10).reduce((s, n) => s + n, 0) % 10 === d[10];
}
export function validDocumentUrl(value: string) {
  try { const url = new URL(value); return url.protocol === "https:" && !url.username && !url.password; }
  catch { return false; }
}
export function isReceivedPayment(payment: { payment_status?: string | null; cancelled_at?: string | null }) {
  return !payment.cancelled_at && ["received", "recorded"].includes(payment.payment_status || "");
}
