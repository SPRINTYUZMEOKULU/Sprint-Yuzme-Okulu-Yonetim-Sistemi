"use client";
import {useState,useTransition} from "react";
import {useRouter} from "next/navigation";
import {recordPortalEsmm} from "./manual-esmm-actions";

export default function ManualEsmmForm({requestId}:{requestId:string}) {
 const [open,setOpen]=useState(false);
 const [number,setNumber]=useState("");
 const [ettn,setEttn]=useState("");
 const [issueDate,setIssueDate]=useState("");
 const [total,setTotal]=useState("");
 const [confirmed,setConfirmed]=useState(false);
 const [message,setMessage]=useState("");
 const [pending,startTransition]=useTransition();
 const router=useRouter();
 return <div className="manual-esmm-form" style={{marginTop:12,padding:14,border:"1px solid #d6e4ef",borderRadius:12}}>
  <button type="button" onClick={()=>setOpen(v=>!v)} disabled={pending}>{open?"Portal makbuz kaydını kapat":"Önceden kesilmiş e-SMM'yi ilişkilendir"}</button>
  {open?<div style={{display:"grid",gap:10,marginTop:14}}>
   <p style={{margin:0,fontSize:13}}>Bu işlem <strong>e-SMM kesmez</strong>. Yalnızca NetteFatura portalında gerçekten kesilmiş, numarası ve ETTN'si doğrulanmış belgenin referansını inceleme için kaydeder. PDF/XML ve sağlayıcı kabulü ayrıca kontrol edilmelidir.</p>
   <label>Makbuz numarası<input value={number} onChange={e=>setNumber(e.target.value.toUpperCase().trim())} placeholder="ABC2026000000001" maxLength={32} autoComplete="off"/></label>
   <label>ETTN<input value={ettn} onChange={e=>setEttn(e.target.value.trim())} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" maxLength={36} autoComplete="off"/></label>
   <label>Düzenlenme tarihi<input type="date" value={issueDate} onChange={e=>setIssueDate(e.target.value)}/></label>
   <label>Makbuz net tahsilat tutarı (TL)<input inputMode="decimal" value={total} onChange={e=>setTotal(e.target.value)} placeholder="4000.00" autoComplete="off"/></label>
   <label style={{display:"flex",alignItems:"start",gap:9}}><input type="checkbox" style={{width:19,flexShrink:0}} checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>Portaldaki belgeyi ve aynı tahsilat için daha önce makbuz kesilip kesilmediğini kontrol ettim. Bu belgenin zaten düzenlendiğini doğruluyorum.</label>
   <button type="button" disabled={!confirmed||pending||!number||!ettn||!issueDate||!total} onClick={()=>startTransition(async()=>{try{const r=await recordPortalEsmm(requestId,number,ettn,issueDate,total);setMessage(r.message);if(r.ok){setOpen(false);router.refresh();}}catch{setMessage("Kontrol tamamlanamadı; belge kaydedilmedi.");}})}>{pending?"Kontrol ediliyor…":"Makbuz referansını kaydet (kesim yapmaz)"}</button>
  </div>:null}
  {message?<p role="status">{message}</p>:null}
 </div>;
}
