export function reviewCollection(amount: number, remaining: number, description: string) {
  const excess = Math.max(0, Math.round((amount - Math.max(0, remaining)) * 100) / 100);
  if (!Number.isFinite(amount) || amount <= 0) return {excess: 0, error: "Geçerli bir ödeme tutarı giriniz.", confirmation: null};
  if (!excess) return {excess: 0, error: null, confirmation: null};
  if (description.trim().length < 5) return {excess, error: "Paket borcunu aşan tahsilat için açıklama yazınız (ör. üç aylık peşin ödeme).", confirmation: null};
  return {excess, error: null, confirmation: `${amount.toLocaleString("tr-TR")} TL tahsilat kaydedilecek. Bunun ${excess.toLocaleString("tr-TR")} TL tutarı seçili dönemin kalan paket borcunu aşıyor.\n\nAçıklama: ${description.trim()}\n\nGerçek alınan tutarı onaylıyor musunuz? Ders programı ve bitiş tarihi değişmeyecek.`};
}
