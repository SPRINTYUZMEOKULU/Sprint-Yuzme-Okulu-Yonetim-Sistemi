"use client";
import { useState } from "react";
type Recipient = { recipient_type: string; recipient_name: string; tax_identity_number: string; tax_office: string; address: string; email: string; phone: string; customer_consent_at: string };
export default function DocumentRecipient({ studentId, requestId }: { studentId: string; requestId: string }) {
  const [recipient, setRecipient] = useState<Recipient | null>(null);
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function show() {
    if (visible) { setVisible(false); setRecipient(null); return; }
    setBusy(true);setError("");
    try { const r=await fetch(`/api/payment-document-request?studentId=${encodeURIComponent(studentId)}&requestId=${encodeURIComponent(requestId)}`,{cache:"no-store"});const data=await r.json();if(!r.ok)throw new Error(data.message);setRecipient(data.recipient);setVisible(true); }
    catch(e){setError(e instanceof Error?e.message:"Bilgiler açılamadı.");}finally{setBusy(false);}
  }
  return <div className="sp-recipient"><button type="button" className="sp-secondary" disabled={busy} onClick={show}>{busy?"Yükleniyor…":visible?"Belge Bilgilerini Gizle":"Belge Alıcısı Bilgilerini Gör"}</button>{error?<p role="alert">{error}</p>:null}{visible&&recipient?<dl><dt>{recipient.recipient_type==="company"?"Firma":"Ad soyad"}</dt><dd>{recipient.recipient_name}</dd><dt>{recipient.recipient_type==="company"?"Vergi No":"T.C. Kimlik No"}</dt><dd>{recipient.tax_identity_number}</dd>{recipient.tax_office?<><dt>Vergi dairesi</dt><dd>{recipient.tax_office}</dd></>:null}<dt>Adres</dt><dd>{recipient.address}</dd><dt>E-posta</dt><dd>{recipient.email||"Belirtilmedi"}</dd><dt>Telefon</dt><dd>{recipient.phone||"Belirtilmedi"}</dd><dt>Müşteri onayı</dt><dd>{new Date(recipient.customer_consent_at).toLocaleString("tr-TR")}</dd></dl>:null}</div>;
}
