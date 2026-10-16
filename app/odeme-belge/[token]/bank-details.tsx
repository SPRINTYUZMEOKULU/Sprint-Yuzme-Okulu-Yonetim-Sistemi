"use client";
import { useState } from "react";
export default function BankDetails({ reference }: { reference: string }) {
  const [message, setMessage] = useState("");
  async function copy(text: string) {
    try { await navigator.clipboard.writeText(text); setMessage("Kopyalandı."); }
    catch { setMessage("Otomatik kopyalanamadı; bilgiyi seçip kopyalayabilirsiniz."); }
  }
  return <section className="bank-box"><div className="bank-title">Havale / EFT ile ödeme</div><span>BANKA</span><strong>VakıfBank</strong><span>HESAP SAHİBİ</span><strong>Nuran Uçar</strong><span>IBAN</span><b className="iban">TR14 0001 5001 5800 7357 4815 06</b><button type="button" onClick={() => copy("TR140001500158007357481506")}>IBAN’ı Kopyala</button><span>ÖDEME AÇIKLAMASI</span><strong>{reference}</strong><button type="button" className="secondary" onClick={() => copy(reference)}>Açıklamayı Kopyala</button><img src="/payment/vakifbank-qr.jpg" alt="VakıfBank ödeme QR kodu" width={340} height={340}/><p>Ödeme açıklamasına yukarıdaki referansı yazınız. Banka transferi Sprint tarafından kontrol edilip tahsilat kaydına bağlanır.</p><div role="status" aria-live="polite">{message}</div></section>;
}
