"use client";
import {useState,useTransition} from "react";
import {useRouter} from "next/navigation";
import {submitEsmmSandbox,searchEsmmSandbox} from "./actions";
type Run={id:string;company:string;number:string;ettn:string;state:string;reportedNumber:string|null;report:string|null;date:string};
const states:Record<string,string>={
 reserved:"Kimlik ayrıldı · gönderim başlamadı",send_started:"Gönderim başlatıldı · sonuç sorgulanmalı",
 send_uncertain:"Sonuç belirsiz · tekrar göndermeyin",send_confirmed:"İşNet gönderim yanıtı alındı",
 provider_rejected:"Sağlayıcı reddetti · tekrar göndermeyin",search_pending:"Rapor kabulü bekleniyor",
 provider_report_accepted:"Sağlayıcı GİB raporu kabul edildi dedi · XML/PDF doğrulaması ayrıca gerekli"
};
export default function SandboxClient({runs}:{runs:Run[]}){
 const [company,setCompany]=useState("4810173324");
 const [number,setNumber]=useState("");
 const [confirmed,setConfirmed]=useState(false);
 const [busy,startTransition]=useTransition();
 const [feedback,setFeedback]=useState("");
 const router=useRouter();
 const allowed=/^[A-Z]{3}20[0-9]{11}$/.test(number);
 return <div style={{display:"grid",gap:18,marginTop:18}}>
  <section style={{border:"1px solid #d2e2f0",borderRadius:14,padding:18,background:"white",display:"grid",gap:12}}>
   <h2 style={{margin:0}}>Yeni sentetik TEST belgesi</h2>
   <p style={{margin:0}}>Bu işlem <strong>gerçek makbuz kesmez</strong>. Düğmeye basınca yalnız İşNet TEST InvoiceService'e bir kez gönderilir. İkinci gönderim otomatik yapılmaz. Günlük en fazla üç test kaydı.</p>
   <label style={{display:"grid",gap:6,fontWeight:600}}>İşNet test firması
    <select value={company} onChange={e=>setCompany(e.target.value)} disabled={busy} style={{padding:12,borderRadius:9,border:"1px solid #bdd4e4"}}>
     <option value="4810173324">İşNet test firması</option><option value="1234567805">Test firma 05</option>
    </select></label>
   <label style={{display:"grid",gap:6,fontWeight:600}}>Yeni yetkili TEST makbuz numarası
    <input value={number} onChange={e=>setNumber(e.target.value.toUpperCase().replace(/\s/g,""))} autoComplete="off" maxLength={16}
     placeholder="DTR20… (İşNet'in verdiği yeni numara)" style={{padding:12,borderRadius:9,border:"1px solid #bdd4e4"}}/>
   </label>
   <p style={{margin:0,fontSize:13}}>16 karakter: üç harf + yıl ile başlayan 13 rakam. Önceki test makbuzlarının numaralarını <strong>yeniden girmeyin</strong>. Buradaki yeni numaranın İşNet TEST firmasında geçerli seri ve sıra numarası olduğundan emin olun.</p>
   <label style={{display:"flex",alignItems:"flex-start",gap:10}}>
    <input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)} style={{marginTop:4}}/>
    <span>Gerçek kişi veya öğrenci bilgisi göndermeyeceğimi, işlemin yalnızca sentetik TEST ortamında bir kez gönderim başlatacağını ve yeni test numarasının yetkili olduğunu onaylıyorum.</span>
   </label>
   <button type="button" disabled={busy||!confirmed||!allowed} onClick={()=>startTransition(async()=>{
    try{const r=await submitEsmmSandbox(company,number,confirmed);setFeedback(r.message);if(('runId' in r && r.runId)||r.ok){setConfirmed(false);setNumber("");router.refresh();}}
    catch{setFeedback("Test işlemi doğrulanamadı. Yeniden gönderim yapmadan kayıt durumunu kontrol edin.");}
   })} style={{padding:13,background:"#095f9b",color:"#fff",border:0,borderRadius:9,opacity:(busy||!confirmed||!allowed)?0.5:1}}>
    {busy?"TEST işlemi sürüyor…":"Yalnız TEST ortamına bir kez gönder"}</button>
   {feedback?<p role="status" style={{margin:0}}>{feedback}</p>:null}
  </section>
  <section style={{border:"1px solid #d2e2f0",borderRadius:14,padding:18,background:"white"}}>
   <h2 style={{marginTop:0}}>Test kayıtları ve rapor sorgusu</h2>
   <p>Gönderim sonrası aynı ETTN ile yalnızca SearchESMM sorgulanır. Sonuç belirsiz olsa bile yeniden gönderilmez.</p>
   {!runs.length?<p>Henüz test kaydı oluşturulmadı.</p>:null}
   <div style={{display:"grid",gap:12}}>
   {runs.map(run=><article key={run.id} style={{border:"1px solid #e1eaf1",borderRadius:10,padding:14,display:"grid",gap:7,overflowWrap:"anywhere"}}>
    <strong>{run.number} · {run.company}</strong>
    <span style={{fontSize:13}}>{states[run.state]||"Kontrol gerekli"}</span>
    <span style={{fontSize:12}}>ETTN: {run.ettn}</span>
    {run.report?<span style={{fontSize:13}}>İşNet rapor durumu: {run.report}</span>:null}
    {run.reportedNumber?<span style={{fontSize:13}}>İşNet belge numarası: {run.reportedNumber}</span>:null}
    <button disabled={busy||run.state==="reserved"} style={{padding:"9px 12px",background:"#e7f2fa",border:"1px solid #b1d0e8",borderRadius:8,width:"max-content",maxWidth:"100%"}} onClick={()=>startTransition(async()=>{
     try{const r=await searchEsmmSandbox(run.id);setFeedback(r.message);router.refresh();}
     catch{setFeedback("Test sorgusu başarısız. Gönderimi tekrarlamayın.");}
    })}>{busy?"Sorgulanıyor…":"İşNet rapor durumunu sorgula"}</button>
   </article>)}
   </div>
  </section>
 </div>;
}
