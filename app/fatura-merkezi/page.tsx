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
    <div className="invoice-notice"><b>Fatura gönderimi henüz açılmadı.</b><p>Önce test firma bilgileriyle fatura oluşturma ve durum/PDF testleri tamamlanmalı; canlıda IP/VKN yetkisi gerekir. Banka dosyası yüklemek tek başına ödeme kaydı veya fatura oluşturmaz.</p></div>
    <h2>{issued?"Kesilen Faturalar":"Son Bağlanan Belgeler"}</h2><p>Bu liste SprintOS'a bağlanmış belgeleri gösterir. NetteFatura'da daha önce kesilen faturalar henüz otomatik çekilmiyor. Belgelerin güncel sağlayıcı durumu bu aşamada senkronize edilmiyor.</p>
    {documents.error?<p role="alert">Belge listesi yüklenemedi. Lütfen tekrar deneyiniz.</p>:!documents.data?.length?<div className="invoice-card">Henüz sisteme bağlanmış fatura yok.</div>:documents.data.map(row=><article key={row.id} className="invoice-card"><h3>{row.document_number||"Numara bekleniyor"}</h3><dl><dt>Belge alıcısı</dt><dd>{row.recipient_name||"Kontrol gerekli"}</dd><dt>Tür / durum</dt><dd>{typeNames[row.document_type]||"Belge türü kontrol edilmeli"} · {statusNames[row.document_status]||"Durum doğrulanmalı"}</dd></dl><div className="invoice-actions"><Link href={`/ogrenciler/${row.student_id}`}>Kursiyer Dosyası</Link>{row.document_pdf_url?<Link target="_blank" rel="noopener noreferrer" href={`/fatura-merkezi/belge/${row.id}/pdf`}>PDF Aç</Link>:<span>PDF henüz alınmadı</span>}{row.document_xml_url?<Link target="_blank" rel="noopener noreferrer" href={`/fatura-merkezi/belge/${row.id}/xml`}>XML Aç</Link>:null}</div></article>)}
    <nav>{page>0?<Link href={`/fatura-merkezi?tab=${issued?"issued":"overview"}&page=${page-1}`}>Önceki</Link>:null}{(documents.count||0)>(page+1)*25?<Link href={`/fatura-merkezi?tab=${issued?"issued":"overview"}&page=${page+1}`}>Sonraki</Link>:null}</nav>
  </main>;
}
