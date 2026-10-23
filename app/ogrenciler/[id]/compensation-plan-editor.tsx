"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
type Schedule={id:string;group_id:string;weekday:number;start_time:string;end_time:string};
export default function CompensationPlanEditor({id,date,schedules,groups,branches}:{id:string;date:string;schedules:Schedule[];groups:{id:string;name:string;branch_id:string}[];branches:{id:string;name:string}[]}){
 const router=useRouter();const [open,setOpen]=useState(false),[day,setDay]=useState(date),[schedule,setSchedule]=useState(""),[busy,setBusy]=useState(false),[message,setMessage]=useState("");
 const today=new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Istanbul"}).format(new Date());
 const weekday=new Date(`${day}T12:00:00Z`).getUTCDay();
 async function submit(action:"cancel"|"reschedule"){
  if(busy)return;
  setBusy(true);setMessage("");
  try{const response=await fetch("/api/compensation-management",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({id,action,lesson_date:day,target_schedule_id:schedule})});const result=await response.json();setMessage(result.message||result.error);if(response.ok){setOpen(false);router.refresh();}}
  catch{setMessage("İşlem doğrulanamadı. Sayfayı yenileyip telafiyi kontrol edin.");}finally{setBusy(false);}
 }
 return <div className="makeupEditor">
  <button type="button" aria-expanded={open} onClick={()=>setOpen(!open)} disabled={busy}>Telafiyi Düzenle</button>
  {open&&<div className="makeupFields"><p>Bu işlem yalnızca bu öğrenciyi etkiler. Başka seansa taşıma, mevcut telafi hakkını korur.</p>
   <label>Yeni telafi günü<input type="date" min={today} value={day} onChange={e=>{setDay(e.target.value);setSchedule("");}} disabled={busy}/></label>
   <label>Şube / grup / seans<select value={schedule} onChange={e=>setSchedule(e.target.value)} disabled={busy}><option value="">Seans seçin</option>{schedules.filter(s=>(Number(s.weekday)%7)===weekday).map(s=>{const group=groups.find(g=>g.id===s.group_id);return <option key={s.id} value={s.id}>{branches.find(b=>b.id===group?.branch_id)?.name} · {group?.name} · {s.start_time.slice(0,5)}–{s.end_time.slice(0,5)}</option>})}</select></label>
   <button type="button" disabled={busy||!schedule||!day} onClick={()=>void submit("reschedule")}>{busy?"Kaydediliyor…":"Eski Seansı Kaldır ve Yeni Seansa Taşı"}</button>
   <button type="button" className="cancelMakeup" disabled={busy} onClick={()=>{if(confirm("Yalnızca bu öğrencinin bu telafisi iptal edilecek. Yeni plan oluşturulmayacak. Devam edilsin mi?"))void submit("cancel");}}>Yalnızca Bu Telafiyi İptal Et</button>
  </div>}{message&&<p role="status">{message}</p>}
 </div>;
}
