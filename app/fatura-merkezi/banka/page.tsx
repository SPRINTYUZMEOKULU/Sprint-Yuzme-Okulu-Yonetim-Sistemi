import Link from "next/link";
import InvoiceNavigation from "../invoice-navigation";
import { requireProfile } from "@/lib/auth/profile";
import { documentAdmin } from "@/lib/payments/document-admin";
import { suggestBankStudents } from "@/lib/payments/bank-import";
import ImportFile from "./import-file";
import ReviewEntry from "./review-entry";
import "../style.css";
export const dynamic="force-dynamic";
export default async function BankReview({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}) {
  const profile=await requireProfile(["owner","admin","accounting"]);
  if(!profile.organization_id)return <main>Kurum bilgisi bulunamadı.</main>;
  const params=await searchParams;const page=Math.max(0,Math.min(10000,Number.parseInt(String(params.page||"0"),10)||0));const db=documentAdmin();
  const selectedStatus = typeof params.status === "string" && ["review","linked","excluded"].includes(params.status) ? params.status : "review";
  const nextHref = (nextPage:number) => `/fatura-merkezi/banka?status=${selectedStatus}&page=${nextPage}`;
  const [entries,students,reviewCount,linkedCount,excludedCount]=await Promise.all([
    db.from("invoice_bank_review").select("id,occurred_at,sender_name,amount,description,transaction_reference,source_file,source_row,similar_count,status,review_note,document_request_id,matched_student_id",{count:"exact"}).eq("organization_id",profile.organization_id).eq("status",selectedStatus).order("created_at",{ascending:false}).order("source_row",{ascending:true}).range(page*25,page*25+24),
    db.from("students").select("id,first_name,last_name,guardian_name").eq("organization_id",profile.organization_id).order("first_name").limit(2000),
    db.from("invoice_bank_entries").select("id",{count:"exact",head:true}).eq("organization_id",profile.organization_id).eq("status","review"),
    db.from("invoice_bank_entries").select("id",{count:"exact",head:true}).eq("organization_id",profile.organization_id).eq("status","linked"),
    db.from("invoice_bank_entries").select("id",{count:"exact",head:true}).eq("organization_id",profile.organization_id).eq("status","excluded"),
  ]);
  const requestIds=(entries.data||[]).map(x=>x.document_request_id).filter(Boolean);
  const requests=requestIds.length?await db.from("payment_document_requests").select("id,public_token,status,expires_at").eq("organization_id",profile.organization_id).in("id",requestIds):{data:[],error:null};
  const requestMap=new Map((requests.data||[]).map(x=>[x.id,x]));
  // Active secure requests can be reused after an explicit manager decision.
  const activeRequests = await db.from("payment_document_requests")
    .select("id,student_id,expected_amount,status,expires_at,recipient_name")
    .eq("organization_id",profile.organization_id)
    .in("status",["waiting_customer","waiting_payment"])
    .eq("document_status","not_created")
    .is("payment_id",null)
    .gt("expires_at",new Date().toISOString())
    .order("created_at",{ascending:false})
    .limit(500);
  const existingRequests = (activeRequests.data || []).map(row => ({
    id: row.id, studentId: row.student_id, amount: Number(row.expected_amount),
    status: row.status, recipientName: row.recipient_name || ""
  })).filter(row=>Number.isFinite(row.amount) && row.amount>0);

  const studentOptions=(students.data||[]).map(s=>({id:s.id,name:`${s.first_name} ${s.last_name}`}));
  return <main className="invoice-center"><header><InvoiceNavigation home="/fatura-merkezi"/><h1>Banka Hareketleri ve Kontrol</h1><p>Excel alternatif yolu, güvenli ödeme talepleriyle aynı belge sürecini kullanır.</p></header><nav><Link href="/fatura-merkezi?tab=issued">Kesilen Faturalar</Link><Link href="/odeme-bilgileri/belgeler">Güvenli Ödeme Talepleri</Link><Link href="/odemeler">Ödeme Merkezi</Link></nav><ImportFile/>
    <nav aria-label="Banka hareketi durum filtresi" className="invoice-bank-filters">
      <Link aria-current={selectedStatus==="review"?"page":undefined} className={selectedStatus==="review"?"active":""} href="/fatura-merkezi/banka?status=review">İnceleme Bekleyen ({reviewCount.error?"—":reviewCount.count??0})</Link>
      <Link aria-current={selectedStatus==="linked"?"page":undefined} className={selectedStatus==="linked"?"active":""} href="/fatura-merkezi/banka?status=linked">Belgeye Bağlanan ({linkedCount.error?"—":linkedCount.count??0})</Link>
      <Link aria-current={selectedStatus==="excluded"?"page":undefined} className={selectedStatus==="excluded"?"active":""} href="/fatura-merkezi/banka?status=excluded">Kapsam Dışı ({excludedCount.error?"—":excludedCount.count??0})</Link>
    </nav>
    <section><h2>{selectedStatus==="review"?"İnceleme Bekleyen Hareketler":selectedStatus==="linked"?"Belgeye Bağlanan Hareketler":"Kapsam Dışı Hareketler"}</h2><p>{entries.error?"Liste yüklenemedi":`${entries.count||0} hareket · Sayfa ${page+1}`}</p>{entries.error||students.error||requests.error||activeRequests.error||reviewCount.error||linkedCount.error||excludedCount.error?<p role="alert">Kontrol verileri tam yüklenemedi. İşlem yapmadan önce sayfayı yenileyiniz.</p>:<>{students.data?.length===2000?<p className="invoice-warning">Kursiyer listesinde ilk 2000 kayıt var. Listede görünmeyen kişiler için destek alın.</p>:null}{(activeRequests.data||[]).length===500?<p className="invoice-warning">Aktif belge talebi listesinde ilk 500 kayıt bulunuyor. Eşleştirme öncesi tüm kayıtları kontrol ediniz.</p>:null}{!entries.data?.length?<div className="invoice-card">Bu filtrede banka hareketi bulunmuyor. Diğer durumları üstteki sekmelerden kontrol edebilirsiniz.</div>:null}{entries.data?.map(entry=>{
      const request=requestMap.get(entry.document_request_id);const candidates=suggestBankStudents(entry.sender_name,entry.description,students.data||[]);
      return <article className="invoice-card" key={entry.id}><h3>{entry.sender_name} · {Number(entry.amount).toLocaleString("tr-TR",{minimumFractionDigits:2})} TL</h3><p>{new Date(entry.occurred_at).toLocaleString("tr-TR",{timeZone:"Europe/Istanbul"})}</p><p>{entry.description}</p><dl><dt>Referans</dt><dd>{entry.transaction_reference||"Yok · benzer hareket kontrolü gerekli"}</dd><dt>Kaynak</dt><dd>{entry.source_file} · Satır {entry.source_row}</dd><dt>Durum</dt><dd>{entry.status==="linked"?"Ortak belge talebine bağlandı":entry.status==="excluded"?"Kapsam dışında":"Yönetici kontrolü bekliyor"}</dd></dl>
        {Number(entry.similar_count)>1&&entry.status!=="excluded"?<p className="invoice-warning">{entry.similar_count} benzer hareket bulundu. Ayrı işlem doğrulamasını gerekçesiyle kaydediniz veya mükerrer olanı kapsam dışında bırakınız.</p>:null}
        {entry.status==="review"&&["owner","admin"].includes(profile.role)?<ReviewEntry entryId={entry.id} amount={Number(entry.amount)} students={studentOptions} suggested={candidates} similar={Number(entry.similar_count)>1} existingRequests={existingRequests}/>:null}
        {entry.review_note?<p>Kontrol notu: {entry.review_note}</p>:null}
        {request?<div className="invoice-actions"><Link href={`/odeme-bilgileri/belgeler?studentId=${entry.matched_student_id}`}>Ödeme / Belge Takibi</Link>{["waiting_customer","waiting_payment"].includes(request.status)&&Date.parse(request.expires_at)>Date.now()?<Link target="_blank" rel="noopener noreferrer" href={`/odeme-belge/${request.public_token}`}>Müşterinin Dolduracağı Bilgi Bağlantısı</Link>:null}</div>:null}
      </article>;
    })}</>}</section><nav>{page>0?<Link href={nextHref(page-1)}>Önceki</Link>:null}{(entries.count||0)>(page+1)*25?<Link href={nextHref(page+1)}>Sonraki</Link>:null}</nav></main>;
}
