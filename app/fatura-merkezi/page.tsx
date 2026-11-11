import Link from "next/link";
import { requireProfile } from "@/lib/auth/profile";
import { documentAdmin } from "@/lib/payments/document-admin";
import "./style.css";

export const dynamic = "force-dynamic";

const typeNames: Record<string,string> = {
  e_smm: "e-SMM", e_invoice: "e-Fatura", e_archive: "e-Arşiv",
  pending_classification: "Belge türü doğrulanmalı"
};
const statusNames: Record<string,string> = {
  waiting_customer: "Veli belge bilgisi bekleniyor",
  customer_completed: "Müşteri bilgileri tamamlandı",
  waiting_payment: "Ödeme eşleştirmesi bekleniyor",
  payment_received: "Belge onayı bekleniyor",
  document_pending: "Belge işlemi bekliyor",
  document_created: "Sağlayıcı belge doğrulaması gerekli",
  document_sent: "Sistemde gönderildi olarak işaretli",
  error: "İşlem hatası", cancelled: "İptal edildi"
};
const money = (v:number|string|null) => v == null ? "Tutar girilmedi" :
  `${Number(v).toLocaleString("tr-TR",{minimumFractionDigits:2,maximumFractionDigits:2})} TL`;
const when = (v:string|null) => v ? new Date(v).toLocaleDateString("tr-TR",{timeZone:"Europe/Istanbul"}) : "—";
const awaiting = ["waiting_customer","customer_completed","waiting_payment","payment_received","document_pending","error"];

export default async function InvoiceCenter({searchParams}:{
  searchParams:Promise<Record<string,string|string[]|undefined>>
}) {
  const profile = await requireProfile(["owner","admin","accounting"]);
  if (!profile.organization_id) return <main>Kurum bilgisi bulunamadı.</main>;
  const params = await searchParams;
  const issued = params.tab === "issued";
  const page = Math.max(0,Math.min(10000,Number.parseInt(String(params.page||"0"),10)||0));
  const db = documentAdmin();

  // The "issued" tab is deliberately limited to records explicitly marked as sent
  // in SprintOS. It is not a guarantee of GIB acceptance or a provider archive sync.
  let documentQuery = db.from("payment_document_requests")
    .select("id,student_id,recipient_name,expected_amount,document_type,document_number,provider_document_id,document_status,document_pdf_url,document_xml_url,status,created_at",{count:"exact"})
    .eq("organization_id",profile.organization_id);
  if (issued) {
    documentQuery = documentQuery.eq("status","document_sent");
  } else {
    documentQuery = documentQuery.or("document_number.not.is.null,provider_document_id.not.is.null,status.in.(document_created,document_sent)");
  }

  const [documents, bank, pending, issuedCount, requests] = await Promise.all([
    documentQuery.order("created_at",{ascending:false}).range(page*25,page*25+24),
    db.from("invoice_bank_entries").select("id",{count:"exact",head:true})
      .eq("organization_id",profile.organization_id).eq("status","review"),
    db.from("payment_document_requests").select("id",{count:"exact",head:true})
      .eq("organization_id",profile.organization_id).in("status",awaiting),
    db.from("payment_document_requests").select("id",{count:"exact",head:true})
      .eq("organization_id",profile.organization_id).eq("status","document_sent"),
    db.from("payment_document_requests")
      .select("id,student_id,recipient_name,expected_amount,status,created_at,expires_at")
      .eq("organization_id",profile.organization_id).in("status",awaiting)
      .order("created_at",{ascending:false}).limit(15)
  ]);

  const studentIds = [...new Set((requests.data||[]).map(x=>x.student_id).filter(Boolean))];
  const students = studentIds.length
    ? await db.from("students").select("id,first_name,last_name")
        .eq("organization_id",profile.organization_id).in("id",studentIds)
    : {data:[],error:null};
  const studentNames = new Map((students.data||[]).map(s => [s.id,
    `${s.first_name||""} ${s.last_name||""}`.trim()]));
  const errors = [documents.error,bank.error,pending.error,issuedCount.error,requests.error,students.error].filter(Boolean);

  return <main className="invoice-center">
    <header>
      <Link href="/">← Ana Sayfa</Link>
      <p className="invoice-kicker">SPRİNT YÜZME OKULU · FİNANS</p>
      <h1>Fatura Merkezi</h1>
      <p>Ödeme talepleri, VakıfBank kontrolü ve belge işlemleri tek noktada takip edilir.</p>
    </header>

    <nav aria-label="Fatura merkezi" className="invoice-tabs">
      <Link className={!issued?"active":""} aria-current={!issued?"page":undefined} href="/fatura-merkezi">Genel Bakış</Link>
      <Link className={issued?"active":""} aria-current={issued?"page":undefined} href="/fatura-merkezi?tab=issued">Gönderildi Olarak İşaretlenenler</Link>
      <Link href="/fatura-merkezi/banka">VakıfBank Hareketleri</Link>
      <Link href="/odeme-bilgileri/belgeler">Belge ve Ödeme Takibi</Link>
    </nav>

    {errors.length>0 ? <p className="invoice-error" role="alert">
      Bazı bilgiler yüklenemedi. Eksik verileri sıfır işlem olarak değerlendirmeyiniz. Sayfayı yenileyip tekrar deneyiniz.
    </p> : null}

    <section className="invoice-grid" aria-label="İşlem özeti">
      <div><span>Banka incelemesi</span><strong>{bank.error?"—":bank.count??0}</strong>
        <Link href="/fatura-merkezi/banka">Hareketleri incele</Link></div>
      <div><span>İşlem bekleyen belge</span><strong>{pending.error?"—":pending.count??0}</strong>
        <Link href="/odeme-bilgileri/belgeler">Belgeleri kontrol et</Link></div>
      <div><span>Gönderildi olarak işaretli</span><strong>{issuedCount.error?"—":issuedCount.count??0}</strong>
        <Link href="/fatura-merkezi?tab=issued">Kayıtları görüntüle</Link></div>
    </section>

    <section className="invoice-notice" aria-labelledby="integration-status">
      <h2 id="integration-status">İşNet / NetteFatura bağlantı durumu</h2>
      <p><strong>Otomatik fatura veya e-SMM kesimi açık değil.</strong> İşNet test makbuzunun SearchESMM sorgusu, PDF/XML erişimi ve GİB kabul durumu henüz doğrulanmadı. Mali müşavir onayına göre e-SMM, e-Fatura veya e-Arşiv belge türü belirlenmelidir.</p>
      <p>Banka Excel dosyası ve gönderildi işaretleri kesin tahsilat ya da sağlayıcı tarafından doğrulanmış belge anlamına gelmez. Gerçek belge kesimi için yönetici, sağlayıcı ve mali müşavir doğrulaması gereklidir.</p>
    </section>

    {!issued ? <section className="invoice-pending">
      <div className="invoice-section-heading">
        <div><h2>İşlem Bekleyen Talepler</h2><p>En yeni 15 talep · Belgeler burada oluşturulmaz.</p></div>
        <Link href="/odeme-bilgileri/belgeler">Tüm taleplere git</Link>
      </div>
      {requests.error || students.error ? <p role="alert">Bekleyen talepler yüklenemedi.</p> :
        !(requests.data||[]).length ? <p className="invoice-card">Şu anda işlem bekleyen talep bulunmuyor.</p> :
        <div className="invoice-request-list">{(requests.data||[]).map(row=><article className="invoice-request" key={row.id}>
          <div><strong>{studentNames.get(row.student_id)||"Kursiyer"}</strong>
            <p>{statusNames[row.status]||"Yönetici kontrolü gerekli"}</p>
            <small>{when(row.created_at)} · {row.recipient_name||"Belge alıcısı bekleniyor"}</small></div>
          <div className="invoice-request-end"><b>{money(row.expected_amount)}</b>
            <Link href={`/odeme-bilgileri/belgeler?studentId=${encodeURIComponent(row.student_id)}`}>Talebi incele</Link></div>
        </article>)}</div>}
    </section> : null}

    <section>
      <div className="invoice-section-heading">
        <div><h2>{issued?"Gönderildi Olarak İşaretlenen Belgeler":"Sisteme Bağlanan Belge Kayıtları"}</h2>
          <p>{issued?"Bu liste yalnızca SprintOS'ta gönderildi durumuna alınmış kayıtları gösterir.":"Numarası veya sağlayıcı kimliği oluşmuş kayıtlar. Bunlar mutlaka GİB tarafından kabul edilmiş değildir."}</p></div>
        <span className="invoice-count">{documents.error?"—":`${documents.count??0} kayıt`}</span>
      </div>
      {documents.error ? <p role="alert">Belge listesi yüklenemedi.</p> :
        !documents.data?.length ? <div className="invoice-card">{issued?"Sistemde gönderildi olarak işaretlenen belge bulunmuyor.":"Sisteme bağlanan belge bulunmuyor. Bekleyen işlemleri yukarıdan inceleyebilirsiniz."}</div> :
        documents.data.map(row=><article key={row.id} className="invoice-card">
          <div className="invoice-document-head"><h3>{row.document_number||"Numara doğrulanmadı"}</h3>
            <span>{statusNames[row.status]||"Sağlayıcı doğrulaması gerekli"}</span></div>
          <dl>
            <dt>Belge alıcısı</dt><dd>{row.recipient_name||"Kontrol gerekli"}</dd>
            <dt>Belge türü</dt><dd>{typeNames[row.document_type]||"Belge türü doğrulanmalı"}</dd>
            <dt>Belge durumu</dt><dd>{row.document_status||"Kontrol gerekli"} · sağlayıcı/GİB kontrolü ayrıca gereklidir</dd>
          </dl>
          <div className="invoice-actions">
            <Link href={`/ogrenciler/${row.student_id}`}>Kursiyer Dosyası</Link>
            {row.document_pdf_url?<Link target="_blank" rel="noopener noreferrer" href={`/fatura-merkezi/belge/${row.id}/pdf`}>PDF Aç</Link>:<span>PDF henüz alınmadı</span>}
            {row.document_xml_url?<Link target="_blank" rel="noopener noreferrer" href={`/fatura-merkezi/belge/${row.id}/xml`}>XML Aç</Link>:null}
          </div>
        </article>)}
      <nav aria-label="Belge sayfaları">
        {page>0?<Link href={`/fatura-merkezi?tab=${issued?"issued":"overview"}&page=${page-1}`}>Önceki</Link>:null}
        {(documents.count||0)>(page+1)*25?<Link href={`/fatura-merkezi?tab=${issued?"issued":"overview"}&page=${page+1}`}>Sonraki</Link>:null}
      </nav>
    </section>
  </main>;
}
