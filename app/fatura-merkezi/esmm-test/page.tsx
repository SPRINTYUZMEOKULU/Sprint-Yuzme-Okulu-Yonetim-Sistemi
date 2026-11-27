import Link from "next/link";
import {requireProfile} from "@/lib/auth/profile";
import {documentAdmin} from "@/lib/payments/document-admin";
import SandboxClient from "./sandbox-client";
export const dynamic="force-dynamic";
export default async function EsmmSandboxPage(){
 const profile=await requireProfile(["owner","admin"]);
 if(!profile.organization_id||!profile.is_active)
  return <main><h1>Test erişimi yetkisiz</h1><Link href="/fatura-merkezi">Fatura Merkezine dön</Link></main>;
 const {data,error}=await documentAdmin().from("isnet_esmm_sandbox_runs")
 .select("id,test_company_code,requested_document_number,ettn,state,provider_document_number,provider_report_status,created_at")
 .eq("organization_id",profile.organization_id).order("created_at",{ascending:false}).limit(12);
 return <main style={{maxWidth:940,margin:"auto",padding:"20px 16px 100px",color:"#153955"}}>
  <Link href="/fatura-merkezi/esmm-hazirlik">← e-SMM hazırlığına dön</Link>
  <header style={{marginTop:16,padding:24,borderRadius:18,background:"#0b3c66",color:"white"}}>
   <p style={{fontSize:12,letterSpacing:1}}>SPRINTOS · İŞNET TEST ORTAMI</p><h1>Tek Seferlik e-SMM Testi</h1>
   <p>Yalnız İşNet'in doğruladığı iki TEST firması ve sentetik alıcı kullanılır. Gerçek firma ve kursiyer bilgilerinden bağımsızdır. Hiçbir gerçek e-SMM kesilmez.</p>
  </header>
  {error?<p role="alert">Test denetim kayıtları okunamadı; hiçbir işlem başlatmayın.</p>:
  <SandboxClient runs={(data||[]).map(r=>({id:r.id,company:r.test_company_code,number:r.requested_document_number,
   ettn:r.ettn,state:r.state,reportedNumber:r.provider_document_number,report:r.provider_report_status,date:r.created_at}))}/>}
  <section style={{border:"1px solid #e4d7aa",borderRadius:14,padding:18,marginTop:18,background:"#fffaf0"}}>
   <h2>Canlı geçiş için ayrı onay gerekiyor</h2>
   <p>TEST sonucu yalnızca <strong>“GibRaporuKabulEtti”</strong> olursa başarılı sayılabilir. Sağlayıcıdan alınan PDF ve XML'nin kimliği ayrıca doğrulanmalı, ardından kabul edilen XML, gerçek mükellef kimliği ve statik çıkış IP'si İşNet ile paylaşılmalıdır. Bu ekran canlı gönderim veya otomatik tekrar yapmaz.</p>
   <p>Test seri/numara kuralı için İşNet'in verdiği yetkili TEST numarasını kullanın. Eski DTR2026000000002 veya AAB2026000000539 numaralarını ve eski ETTN'leri yeniden kullanmayın.</p>
  </section>
 </main>;
}
