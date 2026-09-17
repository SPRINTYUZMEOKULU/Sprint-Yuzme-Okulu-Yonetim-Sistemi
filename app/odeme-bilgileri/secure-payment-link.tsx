"use client";

import { useMemo, useState } from "react";

type PhoneCandidate = { phone: string; label: string; source: string };

function normalizePhone(value?: string | null) {
  let digits = String(value || "").replace(/\D/g, "");
  if (digits.startsWith("0090")) digits = digits.slice(2);
  if (digits.startsWith("90") && digits.length === 12) return digits;
  if (digits.startsWith("0") && digits.length === 11) return `90${digits.slice(1)}`;
  if (digits.length === 10) return `90${digits}`;
  return digits;
}

export default function SecurePaymentLink({ studentId, studentName, phoneCandidates = [] }: { studentId: string; studentName?: string; phoneCandidates?: PhoneCandidate[] }) {
  const phones = useMemo(() => {
    const seen = new Set<string>();
    return phoneCandidates.filter((x) => { const p = normalizePhone(x.phone); if (!p || seen.has(p)) return false; seen.add(p); return true; });
  }, [phoneCandidates]);
  const [phone, setPhone] = useState(() => normalizePhone(phones[0]?.phone));
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");

  async function send() {
    if (!studentId || !phone) return setStatus("Gönderim için kursiyer ve telefon bilgisi gerekli.");
    setBusy(true); setStatus("Güvenli bağlantı hazırlanıyor…");
    try {
      const response = await fetch("/api/payment-document-request", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ studentId, expectedAmount: amount || null }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.url) throw new Error(data?.message || "Bağlantı oluşturulamadı.");
      const text = `SPRİNT YÜZME OKULU | ÖDEME BİLGİLERİ\n\n${studentName ? `${studentName} için ` : ""}IBAN/Havale ödeme işleminizi tamamlamak için aşağıdaki güvenli bağlantıyı açınız.\n\nBelge bilgilerinizi kendiniz girdikten sonra IBAN ve QR ödeme bilgileri görüntülenecektir.\n\n${data.url}\n\nBilgilendirme Hattı: 0551 896 83 19`;
      window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
      setStatus("Güvenli ödeme bağlantısı oluşturuldu ve WhatsApp açıldı.");
    } catch (e) { setStatus(e instanceof Error ? e.message : "Bağlantı oluşturulamadı."); }
    finally { setBusy(false); }
  }

  return <section style={{marginTop:16,padding:18,border:"1px solid #b9d8ef",borderRadius:16,background:"#f4faff"}}>
    <div style={{fontSize:11,fontWeight:900,color:"#0a5da8",letterSpacing:".08em"}}>GÜVENLİ IBAN ÖDEME AKIŞI</div>
    <h3 style={{margin:"6px 0 5px",color:"#0c3159"}}>Müşteriye Güvenli Ödeme Bağlantısı Gönder</h3>
    <p style={{margin:"0 0 14px",fontSize:12,lineHeight:1.5,color:"#58758f"}}>IBAN ve QR doğrudan gönderilmez. Müşteri önce kendi belge bilgilerini girer; ardından banka bilgileri açılır.</p>
    <div style={{display:"grid",gap:10}}>
      {phones.length > 1 ? <select value={phone} onChange={(e)=>setPhone(e.target.value)} style={{padding:12,borderRadius:11,border:"1px solid #cbdbe8"}}>{phones.map((x)=><option key={normalizePhone(x.phone)} value={normalizePhone(x.phone)}>{x.label} · {x.phone}</option>)}</select> : null}
      <input value={amount} onChange={(e)=>setAmount(e.target.value)} inputMode="decimal" placeholder="Ödenecek tutar (isteğe bağlı)" style={{padding:12,borderRadius:11,border:"1px solid #cbdbe8"}} />
      <button type="button" onClick={send} disabled={busy || !phone} style={{padding:14,border:0,borderRadius:12,background:"#0a5da8",color:"#fff",fontWeight:900,cursor:"pointer"}}>{busy ? "Hazırlanıyor…" : "WhatsApp ile Güvenli Bağlantı Gönder"}</button>
    </div>
    {status ? <div style={{marginTop:10,fontSize:12,fontWeight:700,color:"#315f86"}}>{status}</div> : null}
  </section>;
}
