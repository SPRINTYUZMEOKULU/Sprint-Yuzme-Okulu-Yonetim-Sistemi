import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { documentAdmin } from "@/lib/payments/document-server";
import { UUID, isReceivedPayment } from "@/lib/payments/document-rules";
import CustomerDocumentForm from "./customer-document-form";
import BankDetails from "./bank-details";
import "./style.css";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Güvenli Ödeme", robots: { index: false, follow: false }, referrer: "no-referrer" };
export default async function PaymentDocumentPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!UUID.test(token)) notFound();
  const db = documentAdmin();
  const result = await db.from("payment_document_requests").select("id,organization_id,student_id,expected_amount,status,expires_at,payment_id,document_number,document_pdf_url").eq("public_token", token).maybeSingle();
  if (result.error) throw new Error("Ödeme bağlantısı şu anda görüntülenemiyor.");
  const req = result.data;
  if (!req) notFound();
  const inactive = req.status === "cancelled" || new Date(req.expires_at).getTime() < Date.now();
  const { data: student } = inactive ? { data: null } : await db.from("students").select("first_name,last_name").eq("organization_id", req.organization_id).eq("id", req.student_id).maybeSingle();
  let paid = false;
  if (!inactive && req.payment_id) {
    const payment = await db.from("student_payments").select("payment_status,cancelled_at").eq("organization_id", req.organization_id).eq("student_id", req.student_id).eq("id", req.payment_id).maybeSingle();
    paid = !!payment.data && isReceivedPayment(payment.data);
  }
  const completed = ["waiting_payment", "payment_received", "document_pending", "document_created", "document_sent"].includes(req.status);
  return <main className="doc-page"><section className="doc-card">
    <header><img src="/sprint-logo.png" alt="Sprint Yüzme Okulu" className="doc-logo"/><span className="secure-tag">KİŞİYE ÖZEL ÖDEME BAĞLANTISI</span><h1>Güvenli Ödeme</h1><p>Belge bilgileriniz ve ödeme işleminiz tek yerde.</p></header>
    {inactive ? <div className="notice error"><b>{req.status === "cancelled" ? "Bu bağlantı iptal edildi." : "Bağlantının süresi doldu."}</b><br/>Yeni bağlantı için Sprint Yüzme Okulu ile iletişime geçiniz.</div> : <>
      <ol className="doc-steps" aria-label="İşlem aşamaları"><li className="active"><b>1</b>Belge bilgileri</li><li className={completed ? "active" : ""}><b>2</b>Ödeme</li><li className={paid ? "active" : ""}><b>3</b>Belge</li></ol>
      <div className="summary"><span>Kursiyer</span><strong>{student ? `${student.first_name || ""} ${student.last_name || ""}` : "Kursiyer"}</strong>{req.expected_amount != null ? <><span>Talep tutarı</span><strong>{Number(req.expected_amount).toLocaleString("tr-TR", { style: "currency", currency: "TRY" })}</strong></> : null}</div>
      {paid ? <><div className="notice success"><b>Tahsilatınız eşleştirildi</b><br/>Belge bilgileriniz ödeme kaydınıza bağlandı.</div>{req.document_number ? <div className="bank-box"><span>BELGE NUMARASI</span><strong>{req.document_number}</strong><p>Belgeniz kaydedildi. Belgeye erişmek için Sprint Yüzme Okulu ile iletişime geçebilirsiniz.</p></div> : <div className="notice">Belgeniz muhasebe tarafından hazırlanacak.</div>}</> : req.payment_id ? <div className="notice error">Tahsilat kaydı kontrol ediliyor. Yeniden ödeme yapmadan önce Sprint ile iletişime geçiniz.</div> : completed ? <><div className="notice success"><b>Belge bilgileriniz kaydedildi</b><br/>Aşağıdaki banka bilgileriyle ödemenizi tamamlayabilirsiniz.</div><BankDetails reference={`SPRINT-${req.id.slice(0, 8).toUpperCase()}`} /></> : <><h2>Belge Bilgileriniz</h2><p className="intro">Belgenin düzenleneceği kişi veya firma bilgilerini giriniz. Kaydettikten sonra IBAN ve QR bilgileri açılacaktır.</p><CustomerDocumentForm token={token}/></>}
      <a className="doc-support" href="tel:+905518968319">Yardım için Sprint’i Arayın</a>
    </>}
    <footer>Bilgileriniz ödeme ve belge işlemleri için kullanılır. Bu bağlantıyı yalnızca ödeme yapacak kişiyle paylaşınız.</footer>
  </section></main>;
}
