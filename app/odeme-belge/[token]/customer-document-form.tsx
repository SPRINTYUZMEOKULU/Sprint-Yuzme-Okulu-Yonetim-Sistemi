"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveCustomerDocumentInfo } from "./actions";

export default function CustomerDocumentForm({ token }: { token: string }) {
  const router = useRouter();
  const [type, setType] = useState("individual");
  const [message, setMessage] = useState("");
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  return <form className="doc-form" action={(fd) => startTransition(async () => { try { const r = await saveCustomerDocumentInfo(token, fd); setMessage(r.message); setDone(r.ok); if (r.ok) router.refresh(); } catch { setDone(false); setMessage("Bağlantı kontrol edilemedi. Tekrar deneyiniz."); } })}>
    <div className="type-grid">
      <label className={type === "individual" ? "selected" : ""}><input type="radio" name="recipient_type" value="individual" checked={type === "individual"} onChange={() => setType("individual")} /> Bireysel</label>
      <label className={type === "company" ? "selected" : ""}><input type="radio" name="recipient_type" value="company" checked={type === "company"} onChange={() => setType("company")} /> Kurumsal</label>
    </div>
    <label>{type === "company" ? "Firma Unvanı" : "Ad Soyad"}<input name="recipient_name" required autoComplete="name" /></label>
    <label>{type === "company" ? "Vergi No" : "T.C. Kimlik No"}<input name="tax_identity_number" required inputMode="numeric" maxLength={type === "company" ? 10 : 11} /></label>
    {type === "company" && <label>Vergi Dairesi<input name="tax_office" required /></label>}
    <div className="doc-address-grid">
      <label>İl<input name="city" required maxLength={100} autoComplete="address-level1" placeholder="Örn. Antalya" /></label>
      <label>İlçe<input name="district" required maxLength={100} autoComplete="address-level2" placeholder="Örn. Muratpaşa" /></label>
    </div>
    <label>Açık Adres<textarea name="address" required rows={3} maxLength={500} autoComplete="street-address" placeholder="Mahalle, cadde/sokak, bina ve kapı numarası" /></label>
    <label>Posta Kodu <span>(isteğe bağlı)</span><input name="postal_code" inputMode="numeric" maxLength={5} pattern="[0-9]{5}" autoComplete="postal-code" /></label>
    <label>E-posta <span>(isteğe bağlı)</span><input name="email" type="email" autoComplete="email" /></label>
    <label>Telefon <span>(isteğe bağlı)</span><input name="phone" type="tel" autoComplete="tel" /></label>
    <label className="consent"><input name="consent" type="checkbox" required /> Girdiğim bilgilerin ödeme belgesinin düzenlenmesinde kullanılmasını onaylıyorum.</label>
    <button disabled={pending || done}>{pending ? "Kaydediliyor…" : done ? "Bilgiler Kaydedildi ✓" : "Bilgileri Kaydet ve Ödemeye Geç"}</button>
    {message && <p role={done?"status":"alert"} className={done ? "success" : "error"}>{message}</p>}
  </form>;
}
