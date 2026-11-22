import { createClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
import CopyIban, { CopyAccountOwner } from "./copy-iban";
import CustomerDocumentForm from "./customer-document-form";
import { DocumentDetailsToggle } from "./document-details-toggle";
import "./style.css";
import { publicDocumentState } from "@/lib/payments/document-state";

export const dynamic = "force-dynamic";

const IBAN = "TR14 0001 5001 5800 7357 4815 06";

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function PaymentBackLink({ fromGuardianPortal }: { fromGuardianPortal: boolean }) {
  return (
    <nav className="payment-back-nav" aria-label="Sayfa gezinme">
      {fromGuardianPortal ? (
        <a href="/veli-odemeler#guvenli-odeme">← Ödemelere Dön</a>
      ) : (
        <a href="https://wa.me/905518968319" rel="noreferrer">← WhatsApp’a Dön</a>
      )}
    </nav>
  );
}

export default async function PaymentDocumentPage({ params, searchParams }: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ kaynak?: string | string[] }>;
}) {
  const [{ token }, { kaynak }] = await Promise.all([params, searchParams]);
  const backLink = <PaymentBackLink fromGuardianPortal={kaynak === "veli"} />;
  const supabase = admin();
  const { data: req } = await supabase.from("payment_document_requests").select("student_id,expected_amount,status,expires_at,recipient_type,recipient_name,tax_identity_number,tax_office,address,city,district,postal_code,email,phone").eq("public_token", token).maybeSingle();
  if (!req) notFound();
  const state = publicDocumentState(req.status, req.expires_at);
  if (["cancelled", "expired"].includes(state)) return <main className="doc-page"><section className="doc-card">{backLink}<h1>Ödeme Bağlantısı</h1><p>Bu bağlantı iptal edilmiş veya süresi dolmuş. Sprint Yüzme Okulu ile iletişime geçiniz.</p></section></main>;
  const { data: student } = await supabase.from("students").select("first_name,last_name").eq("id", req.student_id).maybeSingle();


  return <main className="doc-page"><section className="doc-card">
    {backLink}<header className="payment-brand-header"><img src="/sprint-logo.png?v=6" alt="Sprint Yüzme Okulu orijinal logosu" className="payment-brand-logo" width={120} height={120}/><div className="payment-brand-copy"><p className="payment-brand-kicker">SPRİNT YÜZME OKULU</p><h2>Güvenli Ödeme ve Belge Bilgileri</h2><p>Kurumsal ödeme bilgilendirme sayfası</p></div></header>
    <div className="summary"><span>Kursiyer</span><strong>{student ? `${student.first_name} ${student.last_name}` : "Kursiyer"}</strong>{req.expected_amount != null && <><span>Ödenecek Tutar</span><strong>{Number(req.expected_amount).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} TL</strong></>}</div>
    {state === "received" || state === "document" ? <div className="notice success"><b>{state === "document" ? "Belgeniz oluşturuldu." : "Ödeme kaydınız eşleştirildi; belge işleminiz kontrol ediliyor."}</b><p>Bu işlem için tekrar ödeme yapmayınız.</p></div> : state === "review" ? <div className="notice">İşleminiz kontrol ediliyor. Sprint Yüzme Okulu ile iletişime geçiniz.</div> : state === "bank" ? <><DocumentDetailsToggle token={token} details={{recipient_type:req.recipient_type,recipient_name:req.recipient_name,tax_identity_number:req.tax_identity_number ? "••••" + String(req.tax_identity_number).slice(-2) : null,tax_office:req.tax_office,address:req.address,city:req.city,district:req.district,postal_code:req.postal_code,email:req.email ? "••••" + String(req.email).slice(-2) : null,phone:req.phone ? "••••" + String(req.phone).slice(-2) : null}} /><div className="notice success"><b>Belge bilgileriniz kaydedildi ✓</b><br/>Şimdi aşağıdaki banka bilgileriyle ödemenizi gerçekleştirebilirsiniz.</div><section className="bank-box"><span>BANKA</span><strong>VakıfBank</strong><span>IBAN</span><CopyIban iban={IBAN}/><span>HESAP SAHİBİ</span><CopyAccountOwner name="Nuran Uçar" /><img src="/payment/vakifbank-qr.jpg" alt="VakıfBank QR ödeme görseli"/><p>Ödeme açıklamasına kursiyerin adını ve soyadını yazınız. Banka hareketi eşleştirildikten sonra belge işleminiz kontrol edilir.</p></section></> : <><h1>Belge Bilgileriniz</h1><p className="intro">IBAN/Havale/EFT ödemenizin belgesini doğru bilgilerle düzenleyebilmemiz için bilgileri ödeme yapacak kişi olarak siz giriniz. Banka bilgileri form tamamlandıktan sonra açılır.</p><CustomerDocumentForm token={token} /></>}
    <footer>Bilgileriniz yalnızca ödeme ve belge işlemleri kapsamında kullanılır.</footer>
  </section></main>;
}
