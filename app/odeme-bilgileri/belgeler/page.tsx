import Link from "next/link";
import { requireProfile } from "@/lib/auth/profile";
import { documentAdmin } from "@/lib/payments/document-admin";
import { hasDocumentDetails, isReceivedBankPayment } from "@/lib/payments/document-state";
import MatchPayment from "./match-payment";
import "./style.css";

export const dynamic = "force-dynamic";
const money = (value: number | string | null) => value == null ? "Tutar belirtilmedi" : `${Number(value).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} TL`;
const date = (value: string | null) => value ? new Date(value).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" }) : "—";
const labels: Record<string, string> = { waiting_customer: "Müşteri bilgileri bekleniyor", customer_completed: "Bilgiler tamamlandı", waiting_payment: "Ödeme eşleştirmesi bekleniyor", payment_received: "Ödeme eşleştirildi · Fatura bekliyor", document_pending: "Belge işlemi bekliyor", document_created: "Belge oluşturuldu", document_sent: "Belge gönderildi", error: "İşlem hatası", cancelled: "İptal edildi" };

export default async function PaymentDocumentReviewPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const profile = await requireProfile(["owner", "admin", "accounting"]);
  const params = await searchParams;
  const studentId = typeof params.studentId === "string" ? params.studentId : "";
  if (!profile.organization_id) return <main>Kurum bilgisi bulunamadı.</main>;
  const db = documentAdmin();
  let query = db.from("payment_document_requests").select("id,student_id,enrollment_id,payment_id,expected_amount,status,recipient_type,recipient_name,tax_identity_number,tax_office,address,customer_consent_at,customer_completed_at,expires_at,document_type,document_number,document_status,created_at", { count: "exact" }).eq("organization_id", profile.organization_id).order("created_at", { ascending: false }).limit(50);
  let bankQuery = db.from("student_payments").select("id,student_id,amount,received_at,description", { count: "exact" }).eq("organization_id", profile.organization_id).in("payment_method", ["bank_transfer", "eft"]).eq("payment_status", "received").is("cancelled_at", null).order("received_at", { ascending: false }).limit(25);
  if (studentId) { query = query.eq("student_id", studentId); bankQuery = bankQuery.eq("student_id", studentId); }
  const [requestsResult, bankResult] = await Promise.all([query, bankQuery]);
  const rows = requestsResult.data || [];
  const bankRows = bankResult.data || [];
  const ids = [...new Set([...rows, ...bankRows].map(r => r.student_id))];
  const [studentsResult, paymentsResult] = ids.length ? await Promise.all([
    db.from("students").select("id,first_name,last_name").eq("organization_id", profile.organization_id).in("id", ids),
    db.from("student_payments").select("id,student_id,enrollment_id,amount,currency,payment_method,payment_status,cancelled_at,received_at").eq("organization_id", profile.organization_id).in("student_id", ids).order("received_at", { ascending: false }).limit(500),
  ]) : [{ data: [], error: null }, { data: [], error: null }];
  const payments = paymentsResult.data || [];
  const names = new Map((studentsResult.data || []).map(s => [s.id, `${s.first_name || ""} ${s.last_name || ""}`.trim()]));
  const error = requestsResult.error || bankResult.error || studentsResult.error || paymentsResult.error;
  const canMatch = ["owner", "admin"].includes(profile.role);
  return <main className="document-review"><header><Link href={studentId ? `/odeme-bilgileri?studentId=${encodeURIComponent(studentId)}` : "/odeme-bilgileri"}>← Ödeme Bilgilerine Dön</Link><p>SPRİNT · YÖNETİCİ KONTROLÜ</p><h1>Havale / EFT ve Fatura Takibi</h1><span>Mevcut ödeme kaydı, müşteri bilgileri ve belge durumu birlikte kontrol edilir.</span></header>
    <nav style={{display:"flex",gap:12,flexWrap:"wrap",marginTop:18}}><Link href="/fatura-merkezi">Fatura Merkezi</Link><Link href="/fatura-merkezi?tab=issued">Kesilen Faturalar</Link><Link href="/fatura-merkezi/banka">VakıfBank Excel Yükle</Link></nav><section className="integration-notice"><h2>NetteFatura bağlantısı hazırlanıyor</h2><p>Fatura, e-Arşiv ve adres defteri test servisleri belirlendi. Test firma bilgileri, başarılı test faturası ve canlı IP/VKN yetkilendirmesi tamamlanmadan sistem fatura göndermez.</p><p><b>Banka bağlantısı kurulmadı.</b> Aşağıdaki liste SprintOS'a kaydedilen ödemelerdir. VakıfBank IBAN hareketleri otomatik okunmuyor.</p></section>
    {error ? <section role="alert" className="integration-notice">Ödeme / belge verileri tam yüklenemedi. Lütfen tekrar deneyiniz; boş liste işlem olmadığı anlamına gelmez.</section> : <>
    <section><h2>Güvenli Ödeme Talepleri</h2><p>{requestsResult.count || 0} talep · En yeni {rows.length} kayıt gösteriliyor.</p>{payments.length === 500 ? <p>Ödeme seçeneklerinde son 500 kayıt gösteriliyor. Eski kayıtlar için kursiyer filtresini kullanınız.</p> : null}
    {!rows.length ? <div className="empty">Henüz güvenli ödeme talebi bulunmuyor. Kursiyer dosyasından güvenli bağlantı oluşturulduğunda burada görünecek.</div> : null}
    <div className="request-list">{rows.map(row => {
      const linked = payments.find(p => p.id === row.payment_id);
      const options = payments.filter(p => p.student_id === row.student_id && (!row.enrollment_id || p.enrollment_id === row.enrollment_id) && isReceivedBankPayment(p) && (row.expected_amount == null || Math.round(Number(row.expected_amount) * 100) === Math.round(Number(p.amount) * 100)));
      const missing = !hasDocumentDetails(row);
      const hasDocument = Boolean(row.document_number) || ["document_created", "document_sent"].includes(row.status);
      return <article key={row.id}><div className="request-title"><Link href={`/ogrenciler/${row.student_id}`}>{names.get(row.student_id) || "Kursiyer Dosyası"}</Link><strong>{money(row.expected_amount)}</strong></div><p className="status">{labels[row.status] || "Kontrol gerekli"}</p><dl><dt>Talep tarihi</dt><dd>{date(row.created_at)}</dd><dt>Belge alıcısı</dt><dd>{row.recipient_name || "Henüz girilmedi"}</dd><dt>Belge bilgileri</dt><dd>{missing ? "Eksik / müşteri onayı bekleniyor" : "Tamamlandı"}</dd><dt>Ödeme kaydı</dt><dd>{row.payment_id ? (linked && isReceivedBankPayment(linked) ? `${money(linked.amount)} · ${date(linked.received_at)}` : "Bağlı ödeme kontrol edilmeli") : "Eşleştirilmedi"}</dd><dt>Belge numarası</dt><dd>{row.document_number || "Henüz oluşturulmadı"}</dd><dt>Belge türü</dt><dd>{row.document_type === "e_smm" && !hasDocument ? "Eski e-SMM varsayımı · Belge türü doğrulanmalı" : row.document_type === "pending_classification" ? "Alıcı sorgusu sonrası belirlenecek" : row.document_type}</dd></dl>
        {!hasDocument && !["cancelled", "error"].includes(row.status) && Date.parse(row.expires_at) <= Date.now() ? <p className="warning">Müşteri bağlantısının süresi dolmuş. Gerekirse kursiyer dosyasından yeni bağlantı oluşturunuz.</p> : null}
        {canMatch && row.status === "waiting_payment" && !row.payment_id && !missing ? (options.length ? <MatchPayment requestId={row.id} payments={options.map(p => ({ id: p.id, label: `${money(p.amount)} · ${date(p.received_at)}` }))} /> : <p className="warning">Bu kursiyer / dönem ve tutarla eşleşen alınmış havale/EFT kaydı yok. Ödeme Merkezini kontrol ediniz.</p>) : null}
      </article>;
    })}</div></section>
    <section><h2>SprintOS'a Kaydedilen Havale / EFT Ödemeleri</h2><p>{bankResult.count || 0} ödeme · En yeni {bankRows.length} kayıt. Bu sayı banka hesabındaki toplam hareket sayısı değildir.</p>{!bankRows.length ? <p className="empty">Kayıtlı havale/EFT ödemesi bulunamadı.</p> : null}<div className="request-list">{bankRows.map(row => <article key={row.id}><div className="request-title"><Link href={`/ogrenciler/${row.student_id}`}>{names.get(row.student_id) || "Kursiyer Dosyası"}</Link><strong>{money(row.amount)}</strong></div><p>{date(row.received_at)}</p><p>{row.description || "Açıklama girilmemiş"}</p><Link href={`/odeme-bilgileri?studentId=${encodeURIComponent(row.student_id)}`}>Güvenli ödeme / belge bilgilerini aç →</Link></article>)}</div></section>
    </>}
  </main>;
}
