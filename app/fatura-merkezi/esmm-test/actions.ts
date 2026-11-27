"use server";
import { requireProfile } from "@/lib/auth/profile";
import { documentAdmin } from "@/lib/payments/document-admin";
import { IsnetEsmmTestClient, IsnetEsmmError, type EsmmTestDraft } from "@/lib/invoicing/isnet-esmm-test";
import { revalidatePath } from "next/cache";

const TEST_COMPANIES = new Set(["4810173324","1234567805"]);
const DOC_NUMBER=/^[A-Z]{3}20[0-9]{11}$/;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const refresh=()=>revalidatePath("/fatura-merkezi/esmm-test");
const forbidden="Yalnızca aktif SprintOS yöneticisi sentetik e-SMM testi başlatabilir.";
async function actor(){
 const profile=await requireProfile(["owner","admin"]);
 if(!profile.organization_id||!profile.is_active||!["owner","admin"].includes(profile.base_role)) throw new Error(forbidden);
 return profile;
}
function sampleTestDraft(ettn:string,externalDocumentNumber:string,documentNumber:string):EsmmTestDraft{
 // No real student, customer, payment, issuer tax data, or production credential.
 const now=new Date(Date.now()+3*60*60*1000).toISOString().slice(0,19)+"+03:00";
 return {
 ettn,externalDocumentNumber,documentNumber,documentDate:now,createdDate:now,
 note:"SADECE ISNET TEST ORTAMI / GERCEK MAKBUZ DEGIL",
 receiver:{taxCode:"0000000000",name:"SENTETIK TEST ALICISI",address:"Ornek Test Sokak No 1",city:"Ankara",town:"Cankaya",taxOffice:"",email:"test@example.invalid"},
 lines:[{
 productName:"SENTETIK TEST HIZMETI",productDescription:"TEST ONLY, no customer/payment",
 grossAmount:"100.00",netAmount:"100.00",payableAmount:"120.00",
 stoppageTaxAmount:"0.00",stoppageTaxRate:"0",stoppageTaxableAmount:"100.00",
 totalTaxAmount:"20.00",vatTaxAmount:"20.00",vatTaxRate:"20",vatTaxableAmount:"100.00",
 witholdingTaxAmount:"0.00",witholdingTaxCode:"",witholdingTaxRate:"0",witholdingTaxableAmount:"0.00"
 }],
 grossAmount:"100.00",payableAmount:"120.00",totalAmount:"100.00",
 totalCollectedVatAmount:"20.00",totalStoppageAmount:"0.00",totalTaxAmount:"20.00",
 totalVatAmount:"20.00",totalWitholdingAmount:"0.00"
 };
}
export async function submitEsmmSandbox(companyCode:string,documentNumber:string,confirmed:boolean){
 const p=await actor();
 if(!confirmed||!TEST_COMPANIES.has(companyCode)||!DOC_NUMBER.test(documentNumber))
   return {ok:false,message:"Yalnızca yetkili İşNet test firması ve yeni bir TEST makbuz numarasıyla açık onay verilerek işlem başlatılabilir."};
 const db=documentAdmin();
 const {data,error}=await db.rpc("reserve_isnet_esmm_sandbox_test",{
  p_org:p.organization_id,p_actor:p.id,p_test_company:companyCode,p_document_no:documentNumber
 });
 const row=Array.isArray(data)?data[0]:null;
 if(error||!row?.ok||!UUID.test(row.run_ettn||"")){
  const known:Record<string,string>={document_already_tested:"Bu test makbuz numarası daha önce kullanılmış. Aynısını göndermeyin.",daily_limit:"Bir günlük üç sentetik test sınırına ulaşıldı.",unauthorized:forbidden,invalid_test_parameters:"Test firma veya yeni test makbuz numarası geçersiz."};
  return {ok:false,message:known[row?.result_code]||"Test rezervasyonu oluşturulamadı. Hiçbir belge gönderilmedi."};
 }
 const runId=String(row.run_id),ettn=String(row.run_ettn),external=String(row.run_external);
 // Atomic one-way transition: if DB reservation cannot move to send_started, do not call SendESMM.
 const started=await db.from("isnet_esmm_sandbox_runs").update({state:"send_started",send_started_at:new Date().toISOString()})
   .eq("organization_id",p.organization_id).eq("id",runId).eq("state","reserved").select("id").maybeSingle();
 if(started.error||!started.data) return {ok:false,runId,message:"Test kimliği ayrıldı ancak gönderim kilidi açılamadı. Yeniden gönderim yapmayın; aynı test kaydını inceleyin."};
 try{
  const result=await new IsnetEsmmTestClient(companyCode).send(sampleTestDraft(ettn,external,documentNumber));
  const update=await db.from("isnet_esmm_sandbox_runs").update({state:"send_confirmed",provider_document_number:result.documentNumber})
    .eq("organization_id",p.organization_id).eq("id",runId).eq("state","send_started").select("id").maybeSingle();
  refresh();
  if(update.error||!update.data) return {ok:false,runId,message:"Test sağlayıcısı yanıt verdi ama kayıt kesinleştirilemedi. Yeniden göndermeyin; ETTN ile sorgulayın."};
  return {ok:true,runId,message:"Sentetik e-SMM TEST ortamına bir kez gönderildi. Bu yanıt GİB kabulü değildir. Aynı ETTN ile rapor durumunu sorgulayın."};
 }catch(err){
  const rejected=err instanceof IsnetEsmmError&&err.outcome==="rejected";
  await db.from("isnet_esmm_sandbox_runs").update({state:rejected?"provider_rejected":"send_uncertain"})
    .eq("organization_id",p.organization_id).eq("id",runId).eq("state","send_started");
  refresh();
  return {ok:false,runId,message:rejected?"İşNet test gönderimini reddetti. Yeni denemeden önce sebebi kontrol edin.":"Test gönderiminin sonucu belirsiz. Kesinlikle tekrar göndermeyin; aynı ETTN ile SearchESMM sorgulayın."};
 }
}
export async function searchEsmmSandbox(runId:string){
 const p=await actor();
 if(!UUID.test(runId)) return {ok:false,message:"Geçersiz test kaydı."};
 const db=documentAdmin();
 const {data:r,error}=await db.from("isnet_esmm_sandbox_runs")
  .select("id,ettn,test_company_code,requested_document_number,state,provider_document_number")
  .eq("organization_id",p.organization_id).eq("id",runId).maybeSingle();
 if(error||!r||!TEST_COMPANIES.has(r.test_company_code))return {ok:false,message:"Yetkili test kaydı bulunamadı."};
 if(r.state==="reserved")return {ok:false,message:"Bu testte gönderim başlatılmadı; sorgulanacak işlem yok."};
 try{
  const rows=await new IsnetEsmmTestClient(r.test_company_code).searchByEttn(r.ettn,false);
  if(rows.length!==1){
   if(rows.length===0)return {ok:false,message:"İşNet henüz bu ETTN için test kaydı döndürmedi. Yeniden göndermeyin, yalnızca sorgulayın."};
   return {ok:false,message:"Sağlayıcı birden fazla test kaydı döndürdü. Manuel kontrol gerekli."};
  }
  const result=rows[0];
  const returnedNumber=typeof result.DocumentNumber==="string"?result.DocumentNumber:"";
  if(!returnedNumber||!DOC_NUMBER.test(returnedNumber)||
     (r.provider_document_number&&r.provider_document_number!==returnedNumber))
    return {ok:false,message:"Sağlayıcı makbuz kimliği beklenen kayıtla uyuşmuyor. Manuel inceleme gerekli."};
  const report=typeof result.ReportStatus==="string"?result.ReportStatus:"";
  // This is a provider-reported status only; real PDF/XML and GIB evidence are not
  // accepted or archived by this read-only check.
  const next=report==="GibRaporuKabulEtti"?"provider_report_accepted":"search_pending";
  if(r.state!=="provider_report_accepted"){
   const write=await db.from("isnet_esmm_sandbox_runs")
    .update({state:next,provider_document_number:returnedNumber,provider_report_status:report.slice(0,100),searched_at:new Date().toISOString()})
    .eq("organization_id",p.organization_id).eq("id",runId)
    .neq("state","provider_report_accepted").select("id").maybeSingle();
   if(write.error)return {ok:false,message:"Sağlayıcı yanıtı alındı ama denetim kaydına yazılamadı."};
  }
  refresh();
  return {ok:true,message:report==="GibRaporuKabulEtti"?
   "İşNet GİB raporu kabul durumunu bildirdi. Canlı geçiş için XML ve PDF kimlikleri ayrıca doğrulanıp arşivlenmeli.":
   "İşNet test rapor durumu: "+(report||"henüz bilgi yok")+". Yeniden gönderim yapılmadı."};
 }catch{
  return {ok:false,message:"İşNet sorgusu başarısız veya belirsiz sonuç verdi. Makbuz tekrar gönderilmedi."};
 }
}
