import { createClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
import CustomerDocumentForm from "./customer-document-form";
import "./style.css";

const IBAN = "TR14 0001 5001 5800 7357 4815 06";

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export default async function PaymentDocumentPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = admin();
  const { data: req } = await supabase.from("payment_document_requests").select("student_id,expected_amount,status,expires_at").eq("public_token", token).maybeSingle();
  if (!req) notFound();
  const expired = new Date(req.expires_at).getTime() < Date.now();
  const { data: student } = await supabase.from("students").select("first_name,last_name").eq("id", req.student_id).maybeSingle();
  const completed = ["waiting_payment","payment_received","document_pending","document_created","document_sent"].includes(req.status);

  return <main className="doc-page"><section className="doc-card">
    <header><div className="brand">SPRİNT <b>YÜZME OKULU</b></div><p>Güvenli Ödeme ve Belge Bilgileri</p></header>
    <div className="summary"><span>Kursiyer</span><strong>{student ? `${student.first_name} ${student.last_name}` : "Kursiyer"}</strong>{req.expected_amount != null && <><span>Ödenecek Tutar</span><strong>{Number(req.expected_amount).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} TL</strong></>}</div>
    {expired ? <div className="notice error">Bu güvenli bağlantının süresi dolmuş. Yeni ödeme bağlantısı için Sprint Yüzme Okulu ile iletişime geçiniz.</div> : completed ? <><div className="notice success"><b>Belge bilgileriniz kaydedildi ✓</b><br/>Şimdi aşağıdaki banka bilgileriyle ödemenizi gerçekleştirebilirsiniz.</div><section className="bank-box"><span>BANKA</span><strong>VakıfBank</strong><span>IBAN</span><b className="iban">{IBAN}</b><span>HESAP SAHİBİ</span><strong>Nuran Uçar</strong><img src="/payment/vakifbank-qr.jpg" alt="VakıfBank QR ödeme görseli"/><p>Açıklama yazmanıza gerek yoktur. Ödeme onaylandığında belgeniz bu bilgilerle hazırlanacaktır.</p></section></> : <><h1>Belge Bilgileriniz</h1><p className="intro">IBAN/Havale/EFT ödemenizin belgesini doğru bilgilerle düzenleyebilmemiz için bilgileri ödeme yapacak kişi olarak siz giriniz. Banka bilgileri form tamamlandıktan sonra açılır.</p><CustomerDocumentForm token={token} /></>}
    <footer>Bilgileriniz yalnızca ödeme ve belge işlemleri kapsamında kullanılır.</footer>
  </section></main>;
}
