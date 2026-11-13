"use client";
import { useState } from "react";
import { calculateZeroDeductionEsmm, type EsmmAmountBasis } from "@/lib/invoicing/esmm-zero-deduction";
const exampleProfile = { vatRate: "20", stoppageRate: "0", withholdingRate: "0" };
const money = (value: string) => `${Number(value).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TL`;
export default function EsmmAmountPreview() {
  const [amount, setAmount] = useState("4000,00");
  const [basis, setBasis] = useState<EsmmAmountBasis>("collected");
  let result: ReturnType<typeof calculateZeroDeductionEsmm> | null = null;
  let error = "";
  try { result = calculateZeroDeductionEsmm(amount, basis, exampleProfile); } catch (e) { error = e instanceof Error ? e.message : "Tutar kontrol edilemedi."; }
  return <section className="esmm-preview" aria-labelledby="esmm-preview-title">
    <div className="esmm-preview-heading"><div><span>PAYLAŞILAN MAKBUZ ÖRNEĞİ</span><h2 id="esmm-preview-title">Tahsilat ve vergi dağılımı</h2></div><b>Önizleme</b></div>
    <p className="esmm-example-profile">KDV %20 · GV stopajı %0 · KDV tevkifatı %0</p>
    <p className="esmm-preview-help">Bu oranlar paylaştığınız örneğe aittir; tüm alıcı ve hizmetlere otomatik uygulanmaz.</p>
    <div className="esmm-preview-inputs">
      <label>Tutarın anlamı<select value={basis} onChange={e => setBasis(e.target.value as EsmmAmountBasis)}><option value="collected">Tahsil edilen tutar · KDV dahil</option><option value="gross">Brüt hizmet bedeli · KDV hariç</option></select></label>
      <label>{basis === "collected" ? "Tahsil edilen tutar (TL)" : "Brüt hizmet bedeli (TL)"}<input inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} autoComplete="off" spellCheck={false}/></label>
    </div>
    {error ? <p role="alert" className="esmm-preview-error">{error}</p> : null}
    {result ? <div className="esmm-preview-result" aria-live="polite">
      <dl><div><dt>Brüt hizmet bedeli</dt><dd data-amount="gross">{money(result.grossAmount)}</dd></div><div><dt>GV stopajı · %0</dt><dd>{money(result.stoppageTaxAmount)}</dd></div><div><dt>Net ücret</dt><dd>{money(result.netAmount)}</dd></div><div><dt>KDV · %20</dt><dd data-amount="vat">{money(result.vatTaxAmount)}</dd></div><div><dt>KDV tevkifatı · %0</dt><dd>{money(result.witholdingTaxAmount)}</dd></div><div className="esmm-preview-total"><dt>Net tahsilat</dt><dd data-amount="collected">{money(result.payableAmount)}</dd></div></dl>
      <p>{basis === "collected" ? "KDV, girdiğiniz tahsilatın içinden ayrıldı; tutarın üzerine tekrar eklenmedi." : "KDV, girdiğiniz brüt hizmet bedelinin üzerine eklendi."}</p>
    </div> : null}
  </section>;
}
