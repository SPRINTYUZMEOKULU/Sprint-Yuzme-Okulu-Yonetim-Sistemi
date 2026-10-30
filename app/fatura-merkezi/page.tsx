import Link from "next/link";
import { requireProfile } from "@/lib/auth/profile";
import { documentAdmin } from "@/lib/payments/document-admin";
import "./style.css";
export const dynamic = "force-dynamic";
const typeNames:Record<string,string>={e_smm:"e-SMM",e_invoice:"e-Fatura",e_archive:"e-Arşiv",pending_classification:"Belge türü kontrol edilecek"};
const statusNames:Record<string,string>={not_created:"Henüz oluşturulmadı",document_pending:"İşlem bekliyor",created:"Oluşturuldu",sent:"Gönderildi",document_created:"Oluşturuldu",document_sent:"Gönderildi",error:"İşlem hatası"};
export default async function InvoiceCenter({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}) {
  const profile=await requireProfile(["owner","admin","accounting"]);
  if(!profile.organization_id) return <main>Kurum bilgisi bulunamadı.</main>;
  const params=await searchParams;
  const issued=params.tab==="issued";
  const page=Math.max(0,Math.min(10000,Number.parseInt(String(params.page||"0"),10)||0));
  const db=documentAdmin();
  const [documents,bank,pending]=await Promise.all([
    db.from("payment_document_requests").select("id,student_id,recipient_name,document_type,document_number,provider_document_id,document_status,document_pdf_url,document_xml_url,status,created_at",{count:"exact"}).eq("organization_id",profile.organization_id).or("document_number.not.is.null,provider_document_id.not.is.null,status.in.(document_created,document_sent)").order("created_at",{ascending:false}).range(page*25,page*25+24),
    db.from("invoice_bank_entries").select("id",{count:"exact",head:true}).eq("organization_id",profile.organization_id).eq("status","review"),
    db.from("payment_document_requests").select("id",{count:"exact",head:true}).eq("organization_id",profile.organization_id).in("status",["waiting_customer","customer_completed","waiting_payment","payment_received","document_pending","error"]),
  ]);
  return <main className="invoice-center"><header><Link href="/">← Ana Sayfa</Link><p>SPRİNT · FİNANS</p><h1>Fatura Merkezi</h1><p>Güvenli ödeme ve banka dosyası üzerinden gelen işlemler, ortak belge takibinde birleşir.</p></header>
    <nav aria-label="Fatura merkezi"><Link className={!issued?"active":""} href="/fatura-merkezi">Genel Bakış</Link><Link className={issued?"active":""} href="/fatura-merkezi?tab=issued">Kesilen Faturalar</Link><Link href="/fatura-merkezi/banka">VakıfBank Excel Yükle</Link><Link href="/odeme-bilgileri/belgeler">Güvenli Ödeme Talepleri</Link></nav>
    <div className="invoice-grid"><div>Sisteme Bağlanan Belgeler<strong>{documents.error?"Yüklenemedi":documents.count||0}</strong></div><div>Kontrol Bekleyen Banka Hareketi<strong>{bank.error?"Yüklenemedi":bank.count||0}</strong></div><div>İşlem Bekleyen Belge Talebi<strong>{pending.error?"Yüklenemedi":pending.count||0}</strong></div></div>
    <section className="invoice-notice" aria-labelledby="integration-status"><h2 id="integration-status">e-SMM entegrasyon durumu</h2><p><b>İşNet NetteFatura · Canlı makbuz kesimi henüz açık değil.</b></p><p>Akış: VakıfBank havale/EFT → kursiyer eşleştirme → müşterinin belge bilgileri → mevcut ödeme eşleştirme → yönetici belge onayı → e-SMM.</p><ul><li>Hazır: VakıfBank Excel aktarımı, mükerrer kontrolü ve banka inceleme kuyruğu.</li><li>Hazır: Müşterinin kendi doldurduğu güvenli bilgi bağlantısı ve mevcut havale/EFT ödemesiyle eşleştirme.</li><li>Hazır: İşNet e-SMM servis kılavuzu ve test bağlantısının gönderim/sorgulama hazırlığı.</li><li>Bekliyor: Test makbuzunun oluşturulması, durum ve PDF/XML doğrulaması.</li><li>Bekliyor: Hizmet/vergi ayarları, yönetici belge onayı ve mükerrer gönderimi önleyen gönderim bağlantısı.</li><li>Bekliyor: İşNet tarafından canlı firma/sabit çıkış IP yetkilendirmesi ve canlı servis bilgilerinin doğrulanması.</li></ul><p>Banka aktarımı ve ödeme eşleştirmesi makbuz kesmez. Nakit/POS otomatik belge akışına dahil değildir. Daha önceki e-Fatura/e-Arşiv testi e-SMM testi yerine geçmez.</p></section>
    <h2>{issued?"Kesilen Faturalar":"Son Bağlanan Belgeler"}</h2><p>Bu liste SprintOS'a bağlanmış belgeleri gösterir. NetteFatura'da daha önce kesilen faturalar henüz otomatik çekilmiyor. Belgelerin güncel sağlayıcı durumu bu aşamada senkronize edilmiyor.</p>
    {documents.error?<p role="alert">Belge listesi yüklenemedi. Lütfen tekrar deneyiniz.</p>:!documents.data?.length?<div className="invoice-card">Henüz sisteme bağlanmış fatura yok.</div>:documents.data.map(row=><article key={row.id} className="invoice-card"><h3>{row.document_number||"Numara bekleniyor"}</h3><dl><dt>Belge alıcısı</dt><dd>{row.recipient_name||"Kontrol gerekli"}</dd><dt>Tür / durum</dt><dd>{typeNames[row.document_type]||"Belge türü kontrol edilmeli"} · {statusNames[row.document_status]||"Durum doğrulanmalı"}</dd></dl><div className="invoice-actions"><Link href={`/ogrenciler/${row.student_id}`}>Kursiyer Dosyası</Link>{row.document_pdf_url?<Link target="_blank" rel="noopener noreferrer" href={`/fatura-merkezi/belge/${row.id}/pdf`}>PDF Aç</Link>:<span>PDF henüz alınmadı</span>}{row.document_xml_url?<Link target="_blank" rel="noopener noreferrer" href={`/fatura-merkezi/belge/${row.id}/xml`}>XML Aç</Link>:null}</div></article>)}
    <nav>{page>0?<Link href={`/fatura-merkezi?tab=${issued?"issued":"overview"}&page=${page-1}`}>Önceki</Link>:null}{(documents.count||0)>(page+1)*25?<Link href={`/fatura-merkezi?tab=${issued?"issued":"overview"}&page=${page+1}`}>Sonraki</Link>:null}</nav>
  </main>;
}
