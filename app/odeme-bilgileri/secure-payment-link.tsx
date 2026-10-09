"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import DocumentRecipient from "./document-recipient";
import { DOCUMENT_STATUS_LABELS, isReceivedPayment } from "@/lib/payments/document-rules";
import "./secure-payment.css";
type PhoneCandidate = { phone: string; label: string; source: string };
type Payment = { id: string; enrollment_id: string; amount: number; payment_method: string; payment_status: string; cancelled_at: string | null; received_at: string };
type DocumentRequest = { id: string; enrollment_id: string; public_token: string; expected_amount: number; status: string; recipient_name: string | null; expires_at: string; payment_id: string | null; document_number: string | null; document_pdf_url: string | null; created_at: string };
type Finance = { remaining: number; packageName: string; enrollment: { id: string; start_date: string; planned_end_date: string } | null };
function normalizePhone(value: string) { let d = value.replace(/\D/g, ""); if(d.startsWith("0090")) d=d.slice(2); if(d.length===11&&d.startsWith("0"))d=`90${d.slice(1)}`; if(d.length===10)d=`90${d}`; return d; }
const money = (v: number) => Number(v).toLocaleString("tr-TR", { style: "currency", currency: "TRY" });
const date = (v: string) => new Date(v).toLocaleDateString("tr-TR");
export default function SecurePaymentLink({ studentId, studentName, phoneCandidates = [] }: { studentId: string; studentName?: string; phoneCandidates?: PhoneCandidate[] }) {
  const phones = phoneCandidates.filter((p, i, list) => /^90\d{10}$/.test(normalizePhone(p.phone)) && list.findIndex(x=>normalizePhone(x.phone)===normalizePhone(p.phone))===i);
  const [phone, setPhone] = useState(normalizePhone(phones[0]?.phone || ""));
  const [amount, setAmount] = useState("");
  const [finance, setFinance] = useState<Finance | null>(null);
  const [requests, setRequests] = useState<DocumentRequest[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [url, setUrl] = useState("");
  const load = useCallback(async (signal?: AbortSignal) => {
    const response = await fetch(`/api/payment-document-request?studentId=${encodeURIComponent(studentId)}`, { cache:"no-store", signal });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "Bilgiler yüklenemedi.");
    setFinance(data.finance); setRequests(data.requests); setPayments(data.payments);
  }, [studentId]);
  useEffect(() => { const controller = new AbortController(); setLoading(true); load(controller.signal).catch(e => { if(e.name!=="AbortError") setStatus(e.message); }).finally(()=>{if(!controller.signal.aborted)setLoading(false);}); return ()=>controller.abort(); }, [load]);
  async function create() {
    setBusy(true); setStatus("Bağlantı hazırlanıyor…");
    try {
      const response = await fetch("/api/payment-document-request", {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({studentId,expectedAmount:amount||null})});
      const data = await response.json();
      if(!response.ok)throw new Error(data.message);
      setUrl(data.url); setStatus("Bağlantı hazır. Kopyalayabilir veya WhatsApp’ta açabilirsiniz."); await load();
    } catch(e) {setStatus(e instanceof Error?e.message:"İşlem tamamlanamadı.");} finally {setBusy(false);}
  }
  async function copy(value: string) {try {await navigator.clipboard.writeText(value);setStatus("Bağlantı kopyalandı.");}catch{setStatus("Kopyalama kullanılamıyor; bağlantıyı seçip kopyalayınız.");}}
  const message = `SPRİNT YÜZME OKULU | GÜVENLİ ÖDEME\n\n${studentName ? `${studentName} için ` : ""}belge bilgilerinizi girip IBAN / QR bilgilerine ulaşmak için bağlantıyı açınız:\n\n${url}\n\nBilgilendirme: 0551 896 83 19`;
  async function update(requestId: string, action: string, fields: Record<string, unknown> = {}) {
    setBusy(true);
    try { const response=await fetch("/api/payment-document-request",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({requestId,action,...fields})});const data=await response.json();if(!response.ok)throw new Error(data.message);setStatus(data.message);await load(); }
    catch(e){setStatus(e instanceof Error?e.message:"İşlem tamamlanamadı.");}finally{setBusy(false);}
  }
  return <section className="sp-center">
    <div className="sp-heading"><span className="sp-shield" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6z"/><path d="m8 12 3 3 5-6"/></svg></span><div><span className="sp-eyebrow">ÖDEME VE BELGE TAKİBİ</span><h2>Güvenli Ödeme Merkezi</h2><p>Müşteri bilgilerini alır, mevcut tahsilatla eşleştirir.</p></div></div>
    {loading ? <p role="status">Güncel kayıt ve ödeme bilgileri yükleniyor…</p> : <>
      <div className="sp-stats"><div><span>Aktif dönem paket bakiyesi</span><strong>{money(finance?.remaining || 0)}</strong><small>{finance?.packageName || "Aktif paket bulunmuyor"}</small></div><div><span>Kayıt dönemi</span><strong>{finance?.enrollment ? date(finance.enrollment.start_date) : "—"}</strong><small>{finance?.enrollment?.planned_end_date ? `${date(finance.enrollment.planned_end_date)} tarihine kadar` : ""}</small></div></div>
      <div className="sp-create"><h3>Müşteriye özel bağlantı hazırla</h3><p>Tutar boş bırakılırsa güncel paket bakiyesi kullanılır. Ek borçlar bu talebe dahil değildir.</p><label>Talep tutarı<input value={amount} onChange={e=>setAmount(e.target.value)} inputMode="decimal" placeholder={String(finance?.remaining || 0)}/></label><button type="button" disabled={busy || !finance?.enrollment || !finance.remaining} onClick={create}>{busy?"İşlem yapılıyor…":"Güvenli Bağlantı Oluştur"}</button>
      {url ? <div className="sp-share"><label>Gönderilecek bağlantı<input value={url} readOnly onFocus={e=>e.target.select()}/></label><button type="button" className="sp-secondary" onClick={()=>copy(url)}>Bağlantıyı Kopyala</button>{phones.length ? <label>İletişim kişisi<select value={phone} onChange={e=>setPhone(e.target.value)}>{phones.map(p=><option key={normalizePhone(p.phone)} value={normalizePhone(p.phone)}>{p.label} · {p.phone}</option>)}</select></label> : <p>Kayıtlı iletişim numarası yok; bağlantıyı kopyalayabilirsiniz.</p>}{phone ? <a className="sp-whatsapp" href={`https://wa.me/${phone}?text=${encodeURIComponent(message)}`} target="_blank" rel="noopener noreferrer">WhatsApp’ta Mesajı Aç</a> : null}<small>WhatsApp açılması mesajın gönderildiği anlamına gelmez. Gönderimi WhatsApp’ta tamamlayınız.</small></div> : null}</div>
      <div className="sp-list-heading"><h3>Ödeme ve belge talepleri</h3><button type="button" className="sp-secondary" disabled={busy} onClick={()=>{setBusy(true);load().catch(e=>setStatus(e.message)).finally(()=>setBusy(false));}}>Yenile</button></div>
      {!requests.length ? <div className="sp-empty">Henüz ödeme bağlantısı oluşturulmadı.</div> : requests.map(r=>{
        const linked=payments.find(p=>p.id===r.payment_id);
        const matches=payments.filter(p=>isReceivedPayment(p)&&["bank_transfer","eft","transfer"].includes(p.payment_method)&&p.enrollment_id===r.enrollment_id&&Math.round(Number(p.amount)*100)===Math.round(Number(r.expected_amount)*100)&&!requests.some(other=>other.payment_id===p.id));
        const expired=new Date(r.expires_at).getTime()<Date.now();
        return <article className="sp-request" key={r.id}><div className="sp-request-top"><strong>{r.expected_amount == null ? "Tutar belirtilmemiş" : money(r.expected_amount)}</strong><span className={`sp-badge ${r.status==="cancelled"?"muted":""}`}>{DOCUMENT_STATUS_LABELS[r.status] || "Kontrol gerekli"}</span></div><p>{r.recipient_name ? `Belge alıcısı: ${r.recipient_name}` : "Müşteri bilgileri henüz tamamlanmadı."}</p><small>Oluşturma: {date(r.created_at)} · Link süresi: {date(r.expires_at)}{expired?" (doldu)":""}</small><div className="sp-reference">Ödeme açıklaması: SPRINT-{r.id.slice(0,8).toUpperCase()}</div>
          {r.status!=="cancelled"&&!expired&&!r.payment_id?<button type="button" className="sp-secondary" onClick={()=>{setUrl(`${window.location.origin}/odeme-belge/${r.public_token}`);setStatus("Mevcut bağlantı paylaşım alanına alındı.");}}>Bağlantıyı Paylaş</button>:null}
          {r.recipient_name ? <DocumentRecipient studentId={studentId} requestId={r.id}/> : null}
          {r.status==="waiting_payment" ? <form onSubmit={e=>{e.preventDefault();const fd=new FormData(e.currentTarget);void update(r.id,"match",{paymentId:fd.get("paymentId")});}}><label>Mevcut havale / EFT tahsilatı<select name="paymentId" required defaultValue=""><option value="" disabled>Tahsilat seçiniz</option>{matches.map(p=><option key={p.id} value={p.id}>{date(p.received_at)} · {money(p.amount)} · {p.payment_method}</option>)}</select></label><button disabled={busy||!matches.length}>Tahsilatla Eşleştir</button>{!matches.length?<p>Uygun tahsilat yok. Önce kursiyer ödeme merkezinden gelen havale/EFT’yi kaydediniz.</p>:null}<Link className="sp-file-link" href={`/ogrenciler/${studentId}?payment=history`}>Kursiyer Ödeme Merkezini Aç</Link></form>:null}
          {r.payment_id ? <p className={linked&&isReceivedPayment(linked)?"sp-ok":"sp-alert"}>{linked&&isReceivedPayment(linked)?"Mevcut tahsilata bağlı; ikinci bir ödeme kaydı oluşturulmadı.":"Bağlı tahsilatı kontrol ediniz. İptal veya geçmiş kayıt olabilir."}</p>:null}
          {r.status==="document_pending"||r.status==="payment_received" ? <form onSubmit={e=>{e.preventDefault();const fd=new FormData(e.currentTarget);void update(r.id,"document",{documentNumber:fd.get("documentNumber"),documentUrl:fd.get("documentUrl")});}}><h4>Hazırlanan belgeyi kaydet</h4><p>Belgeyi kullandığınız muhasebe sağlayıcısında düzenledikten sonra buraya ekleyiniz.</p><label>Belge numarası<input name="documentNumber" required maxLength={100}/></label><label>Belge bağlantısı<input name="documentUrl" type="url" required placeholder="https://…"/></label><button disabled={busy}>Belgeyi Tahsilata Bağla</button></form>:null}
          {r.document_number?<p><b>Belge: {r.document_number}</b>{r.document_pdf_url?<a className="sp-file-link" href={r.document_pdf_url} target="_blank" rel="noopener noreferrer">Belgeyi Aç</a>:null}</p>:null}
          {["waiting_customer","customer_completed","waiting_payment"].includes(r.status)&&!r.payment_id ? <button type="button" className="sp-cancel" disabled={busy} onClick={()=>{if(window.confirm("Bu ödeme bağlantısı iptal edilsin mi? Kursiyer borcu ve tahsilatlar değişmez."))void update(r.id,"cancel");}}>Bağlantıyı İptal Et</button>:null}
        </article>;
      })}
      <div className="sp-note">Otomatik e-belge sağlayıcısı henüz bağlı değil. Bu merkez belge bilgilerini, tahsilat eşleştirmesini ve hazırlanmış belgeleri takip eder.</div>
    </>}
    {status?<div className="sp-feedback" role="status" aria-live="polite">{status}</div>:null}
  </section>;
}
