"use client";
import {openCurrentWhatsapp} from "@/lib/messaging/current-recipient";
import { useState } from "react";
import { useRouter } from "next/navigation";
type Schedule={id:string;group_id:string;weekday:number;start_time:string;end_time:string};
export type CompensationNotification={id:string;body:string;recipient:string;status:string};
export default function CompensationPlanEditor({id,date,status="planned",notification:initialNotification=null,studentId,canPrepare=false,schedules,groups,branches}:{id:string;date:string;status?:string;notification?:CompensationNotification|null;studentId:string;canPrepare?:boolean;schedules:Schedule[];groups:{id:string;name:string;branch_id:string}[];branches:{id:string;name:string}[]}){
 const router=useRouter();
 const [open,setOpen]=useState(false),[day,setDay]=useState(date),[schedule,setSchedule]=useState("");
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(""),[prepareMessage,setPrepareMessage]=useState(true);
 const [changed,setChanged]=useState(false);
 const [notification,setNotification]=useState<CompensationNotification|null>(initialNotification);
 const today=new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Istanbul"}).format(new Date());
 const weekday=new Date(`${day}T12:00:00Z`).getUTCDay();
 const choices=schedules.filter(s=>(Number(s.weekday)%7)===weekday&&groups.some(g=>g.id===s.group_id));
 async function submit(action:"cancel"|"reschedule"){
  if(busy)return;setBusy(true);setMessage("");
  try{
   const response=await fetch("/api/compensation-management",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({id,action,lesson_date:day,target_schedule_id:schedule,prepare_message:prepareMessage})});
   const result=await response.json();setMessage((result.message||result.error||"İşlem tamamlanamadı.")+(result.messageWarning||""));
   if(response.ok){setChanged(true);setNotification(result.notification||null);setOpen(false);router.refresh();}
  }catch{setMessage("İşlem doğrulanamadı. Sayfayı yenileyip telafiyi kontrol edin.");}finally{setBusy(false);}
 }
 async function messageAction(action:"prepare"|"confirm_sent"){
  if(busy)return;setBusy(true);
  try{const response=await fetch("/api/compensation-management",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id,action,message_id:notification?.id})});const result=await response.json();setMessage(result.message||result.error||"Mesaj hazırlandı.");if(response.ok){if(result.notification)setNotification(result.notification);else if(notification)setNotification({...notification,status:"sent"});router.refresh();}}
  catch{setMessage("Mesaj durumu kaydedilemedi. Kontrol edip tekrar deneyin.");}finally{setBusy(false);}
 }
 return <div className="makeupEditor">
  {status==="planned"&&<button type="button" className="makeupEditToggle" aria-expanded={open} onClick={()=>{if(!open){setDay(date);setSchedule("");}setOpen(!open);}} disabled={busy}>{open?"Düzenlemeyi Kapat":"Telafiyi Düzenle"}</button>}
  {open&&status==="planned"&&<div className="makeupFields">
   <div className="makeupFormIntro"><strong>Yeni telafi planı</strong><p>Yalnızca bu öğrencinin telafisi taşınır. Mevcut ders hakkı korunur.</p></div>
   <div className="makeupInputGrid"><label>Yeni telafi tarihi<input type="date" min={today} value={day} onChange={e=>{setDay(e.target.value);setSchedule("");}} disabled={busy}/></label>
   <label>Şube, grup ve seans<select value={schedule} onChange={e=>setSchedule(e.target.value)} disabled={busy}><option value="">Seans seçin</option>{choices.map(s=>{const group=groups.find(g=>g.id===s.group_id);return <option key={s.id} value={s.id}>{s.start_time.slice(0,5)}–{s.end_time.slice(0,5)} · {group?.name} · {branches.find(b=>b.id===group?.branch_id)?.name}</option>})}</select></label></div>
   {day&&!choices.length&&<p className="makeupHelp">Bu gün için aktif seans bulunmuyor. Farklı bir tarih seçin.</p>}
   <label className="makeupCheck"><input type="checkbox" checked={prepareMessage} onChange={e=>setPrepareMessage(e.target.checked)} disabled={busy}/><span>Değişiklik bilgilendirme mesajını hazırla<small>Kaydettikten sonra kontrol edip WhatsApp’ta gönderebilirsiniz.</small></span></label>
   <div className="makeupFormActions"><button type="button" className="makeupSave" disabled={busy||!schedule||!day||day<today} onClick={()=>void submit("reschedule")}>{busy?"Kaydediliyor…":"Yeni Planı Kaydet"}</button><button type="button" className="cancelMakeup" disabled={busy} onClick={()=>{if(confirm("Yalnızca bu öğrencinin bu telafisi iptal edilecek. Yeni plan oluşturulmayacak. Devam edilsin mi?"))void submit("cancel");}}>Telafiyi İptal Et</button></div>
   <small className="makeupHelp">Kaydettiğinizde eski seanstan çıkarılır ve seçtiğiniz seansa taşınır.</small>
  </div>}
  {notification&&<div className="makeupMessage"><div className="makeupMessageHead"><strong>Telafi bilgilendirmesi</strong><span>{notification.status==="sent"?"Gönderildi olarak kaydedildi":"Hazır · Henüz gönderilmedi"}</span></div><label>Mesaj önizlemesi<textarea readOnly rows={7} value={notification.body}/></label><p className="makeupHelp">Alıcı: {notification.recipient||"Telefon bilgisi eksik. Öğrenci iletişim bilgilerini güncelleyin."}</p><div className="makeupFormActions">{notification.recipient&&notification.status!=="sent"&&<button type="button" className="makeupWhatsapp" disabled={busy} onClick={()=>{setBusy(true);void openCurrentWhatsapp(studentId,notification.recipient,notification.body).then(recipient=>{setNotification({...notification,recipient});setMessage(`Güncel alıcı: ${recipient}`);}).catch(error=>setMessage(error.message)).finally(()=>setBusy(false));}}>WhatsApp’ta Aç</button>}<button type="button" onClick={()=>{if(!navigator.clipboard){setMessage("Mesajı önizleme alanından seçerek kopyalayabilirsiniz.");return;}void navigator.clipboard.writeText(notification.body).then(()=>setMessage("Mesaj kopyalandı."),()=>setMessage("Mesajı önizleme alanından seçerek kopyalayabilirsiniz."));}}>Mesajı Kopyala</button>{notification.status!=="sent"&&<button type="button" disabled={busy} onClick={()=>{if(confirm("Mesajı WhatsApp üzerinden gönderdiğinizi onaylıyor musunuz?"))void messageAction("confirm_sent");}}>Gönderdim, Kaydet</button>}</div><small className="makeupHelp">WhatsApp’ı açmak gönderim onayı değildir. Gönderdikten sonra “Gönderdim, Kaydet” ile işaretleyin.</small></div>}
  {!notification&&(canPrepare||changed)&&<button type="button" className="makeupPrepare" disabled={busy} onClick={()=>void messageAction("prepare")}>Son Değişikliğin Mesajını Hazırla</button>}
  {message&&<p className="makeupResult" role="status">{message}</p>}
 </div>;
}
