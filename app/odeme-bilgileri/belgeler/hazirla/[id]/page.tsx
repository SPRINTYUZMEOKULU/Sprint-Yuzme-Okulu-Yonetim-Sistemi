import Link from "next/link";
import { requireProfile } from "@/lib/auth/profile";
import { documentAdmin } from "@/lib/payments/document-admin";
import { hasDocumentDetails, isReceivedBankPayment } from "@/lib/payments/document-state";
import PortalCopyFields from "./portal-copy-fields";
import "./style.css";

export const dynamic="force-dynamic";
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const cash=(v:number|string)=>Number(v).toLocaleString("tr-TR",{minimumFractionDigits:2,maximumFractionDigits:2})+" TL";
export default async function PortalHandoff({params}:{params:Promise<{id:string}>}){
 const profile=await requireProfile(["owner","admin"]);
 const {id}=await params;
 if(!uuid.test(id)||!profile.organization_id||!profile.is_active)
   return <main className="portal-handoff"><h1>İşlem erişime kapalı</h1><Link href="/odeme-bilgileri/belgeler">Belge takip ekranına dön</Link></main>;
 const db=documentAdmin();
 const {data:r,error}=await db.from("payment_document_requests")
  .select("id,student_id,enrollment_id,payment_id,status,document_type,document_status,expected_amount,recipient_type,recipient_name,tax_identity_number,tax_office,address,city,district,postal_code,email,customer_consent_at,customer_completed_at,document_number,provider_document_id,document_pdf_url,document_xml_url")
  .eq("organization_id",profile.organization_id).eq("id",id).maybeSingle();
 if(error||!r)return <main className="portal-handoff"><h1>Belge talebi bulunamadı</h1><Link href="/odeme-bilgileri/belgeler">Geri dön</Link></main>;
 const [{data:p,error:pe},{data:student,error:se},{data:portal,error:me},{data:approval,error:ae}] = await Promise.all([
  r.payment_id?db.from("student_payments").select("id,student_id,enrollment_id,amount,currency,payment_method,payment_status,cancelled_at,description,received_at").eq("organization_id",profile.organization_id).eq("id",r.payment_id).maybeSingle():Promise.resolve({data:null,error:null}),
  db.from("students").select("first_name,last_name").eq("organization_id",profile.organization_id).eq("id",r.student_id).maybeSingle(),
  db.from("manual_esmm_reconciliation").select("document_number,ettn,verification_state").eq("organization_id",profile.organization_id).eq("request_id",id).maybeSingle(),
  db.from("esmm_issue_approvals").select("id,issue_state").eq("organization_id",profile.organization_id).eq("request_id",id).maybeSingle()
 ]);
 const blocked:string[]=[];
 if(pe||se||me||ae){blocked.push("İlgili kayıtların tamamı okunamadı. İşleme devam etmeyin.");}
 if(r.document_type!=="e_smm")blocked.push("Belge türü e-SMM olarak doğrulanmamış.");
 if(!hasDocumentDetails(r)||!r.city?.trim()||!r.district?.trim())blocked.push("Alıcı kimlik, adres, il/ilçe bilgileri veya müşteri onayı eksik.");
 if(r.status!=="payment_received"||!p||!isReceivedBankPayment(p)||p.student_id!==r.student_id||
   (r.enrollment_id&&p.enrollment_id!==r.enrollment_id)||
   !r.expected_amount||Number(r.expected_amount)!==Number(p.amount))
  blocked.push("Tahsilat doğrulanmış ve doğru öğrenci/dönemle eşleşmiş değil.");
 if(p&&p.payment_method!=="bank_transfer"&&p.payment_method!=="eft")blocked.push("Ödeme yöntemi banka/havale değil.");
 if(r.document_status!=="not_created"||r.document_number||r.provider_document_id||r.document_pdf_url||r.document_xml_url)
  blocked.push("Bu talepte belge düzenlenmiş veya belge numarası mevcut; yeni makbuz oluşturmayın.");
 if(portal)blocked.push("Portalda düzenlenmiş makbuz referansı var: "+portal.document_number+". Yeni makbuz kesmeyin.");
 if(approval)blocked.push("e-SMM ön onayı mevcut; önce mevcut sağlayıcı işlem durumunu inceleyin.");
 const ready=blocked.length===0;
 const name=[student?.first_name,student?.last_name].filter(Boolean).join(" ");
 return <main className="portal-handoff">
  <header><Link href="/odeme-bilgileri/belgeler">← Belge Takibine Dön</Link><p>SPRINTOS · E-SMM MANUEL PORTAL AKTARIMI</p><h1>NetteFatura için Hazırla</h1>
    <span>Bu sayfa yalnızca doğrulanmış kayıtları kopyalamaya yardımcı olur. NetteFatura'ya otomatik giriş, gönderim veya e-SMM kesimi yapmaz.</span></header>
  <section className="handoff-card"><h2>Kursiyer ve talep</h2><p><strong>{name||"Kursiyer kaydı"}</strong> · {r.expected_amount?cash(r.expected_amount):"Tutar eksik"}</p><p>Makbuz alıcısı kursiyer yerine veli olabilir; alıcı bilgileri ayrıca doğrulanmalıdır.</p>
  {ready?<p className="handoff-ok" role="status">Alıcı ve banka tahsilatının kayıt kontrolleri tamam. Portalda düzenlemeden önce vergi profilini ve geçmiş makbuzları ayrıca kontrol edin.</p>:<div className="handoff-warning" role="alert"><strong>Portal aktarımına hazır değil.</strong><ul>{blocked.map((m,i)=><li key={i}>{m}</li>)}</ul></div>}
  </section>
  {ready&&p?<PortalCopyFields fields={[
    {label:"Belge alıcısı",value:r.recipient_name!.trim()},
    {label:r.recipient_type==="company"?"VKN":"TCKN",value:r.tax_identity_number!.trim(),sensitive:true},
    ...(r.tax_office?.trim()?[{label:"Vergi dairesi",value:r.tax_office.trim()}]:[]),
    {label:"Adres",value:r.address!.trim()},
    {label:"İl",value:r.city!.trim()},
    {label:"İlçe",value:r.district!.trim()},
    ...(r.postal_code?.trim()?[{label:"Posta kodu",value:r.postal_code.trim()}]:[]),
    ...(r.email?.trim()?[{label:"E-posta",value:r.email.trim(),sensitive:true}]:[]),
    {label:"Tahsil edilen tutar (TL)",value:Number(p.amount).toFixed(2)},
    {label:"Tahsilat tarihi",value:new Date(p.received_at).toLocaleDateString("tr-TR",{timeZone:"Europe/Istanbul"})}
  ]} />:null}
  <section className="handoff-card"><h2>Makbuzu kesmeden önce</h2>
    <ol><li>Hizmet açıklaması ve hizmet dönemini kursiyer paketine göre doğrulayın; ödeme açıklamasını tek başına vergi açıklaması kabul etmeyin.</li>
      <li>KDV, stopaj ve tevkifat türünü/oranını mali müşavirinizin onayladığı profile göre NetteFatura'da seçin. Bunları SprintOS varsaymıyor.</li>
      <li>NetteFatura'da aynı dönem ve aynı tahsilat için daha önce kesilmiş makbuz olup olmadığını sorgulayın.</li>
      <li>Portaldan gerçek e-SMM kesildikten sonra belge numarası, ETTN, tarih ve tutarı <Link href="/odeme-bilgileri/belgeler">Belge Takibi</Link> ekranındaki “Önceden kesilmiş e-SMM'yi ilişkilendir” bölümüne kaydedin.</li></ol>
  </section>
 </main>;
}
