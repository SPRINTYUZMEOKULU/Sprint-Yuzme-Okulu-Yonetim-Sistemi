"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { saveCustomerDocumentInfo } from "./actions";

export default function CustomerDocumentForm({ token }: { token: string }) {
  const router = useRouter();
  const [type, setType] = useState("individual");
  const [message, setMessage] = useState("");
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  return <form className="doc-form" action={(fd) => startTransition(async () => { const r = await saveCustomerDocumentInfo(token, fd); setMessage(r.message); setDone(r.ok); if (r.ok) router.refresh(); })}>
    <div className="type-grid">
      <label className={type === "individual" ? "selected" : ""}><input type="radio" name="recipient_type" value="individual" checked={type === "individual"} onChange={() => setType("individual")} /> Bireysel</label>
      <label className={type === "company" ? "selected" : ""}><input type="radio" name="recipient_type" value="company" checked={type === "company"} onChange={() => setType("company")} /> Kurumsal</label>
    </div>
    <label>{type === "company" ? "Firma Unvanı" : "Ad Soyad"}<input name="recipient_name" required autoComplete="name" maxLength={200} /></label>
    <label>{type === "company" ? "Vergi No" : "T.C. Kimlik No"}<input name="tax_identity_number" required inputMode="numeric" pattern={type === "company" ? "[0-9]{10}" : "[0-9]{11}"} minLength={type === "company" ? 10 : 11} maxLength={type === "company" ? 10 : 11} /></label>
    {type === "company" && <label>Vergi Dairesi<input name="tax_office" required /></label>}
    <label>Adres<textarea name="address" maxLength={500} required rows={3} /></label>
    <label>E-posta <span>(isteğe bağlı)</span><input name="email" type="email" autoComplete="email" /></label>
    <label>Telefon <span>(isteğe bağlı)</span><input name="phone" type="tel" autoComplete="tel" /></label>
    <label className="consent"><input name="consent" type="checkbox" required /> Girdiğim bilgilerin ödeme belgesinin düzenlenmesinde kullanılmasını onaylıyorum.</label>
    <button disabled={pending || done}>{pending ? "Kaydediliyor…" : done ? "Bilgiler Kaydedildi ✓" : "Bilgileri Kaydet ve Ödemeye Geç"}</button>
    {message && <p role="status" aria-live="polite" className={done ? "success" : "error"}>{message}</p>}
  </form>;
}
