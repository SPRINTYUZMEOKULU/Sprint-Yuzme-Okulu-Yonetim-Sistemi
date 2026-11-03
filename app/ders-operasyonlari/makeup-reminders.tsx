"use client";
import { useRef, useState } from "react";
import { currentRecipient } from "@/lib/messaging/current-recipient";
import { loadTodayMakeupReminders, makeupReminderAction, type MakeupReminder } from "./reminder-actions";

export default function MakeupReminders(){
  const [rows,setRows]=useState<MakeupReminder[]>([]),[loaded,setLoaded]=useState(false),[busy,setBusy]=useState(false),[status,setStatus]=useState("");
  const [opened,setOpened]=useState<string[]>([]); const lock=useRef(false);
  async function run(task:()=>Promise<void>){if(lock.current)return;lock.current=true;setBusy(true);try{await task();}catch(e){setStatus(e instanceof Error?e.message:"İşlem tamamlanamadı.");}finally{lock.current=false;setBusy(false);}}
  async function load(){await run(async()=>{setRows(await loadTodayMakeupReminders());setLoaded(true);setStatus("");});}
  async function send(row:MakeupReminder,confirm=false){
    if(confirm&&!window.confirm(`${row.name} için hatırlatmayı WhatsApp’tan gönderdiniz mi?`))return;
    await run(async()=>{
      const popup=confirm?null:window.open("about:blank","_blank");
      if(!confirm&&!popup)throw new Error("WhatsApp penceresi açılamadı. Açılır pencere iznini kontrol edin.");
      if(popup)popup.opener=null;
      try{
      const fresh=await makeupReminderAction(row.id,confirm?"confirm":"prepare");
      setRows(items=>items.map(item=>item.id===fresh.id?fresh:item));
      if(fresh.sent){popup?.close();setStatus(`${fresh.name}: Gönderildi olarak kayıtlı.`);return;}
      const phone=await currentRecipient(fresh.studentId,fresh.recipient);
      if(popup)popup.location.href=`https://wa.me/${phone}?text=${encodeURIComponent(fresh.message)}`;
      setOpened(ids=>ids.includes(fresh.messageId)?ids:[...ids,fresh.messageId]);
      setStatus(`${fresh.name}: Mesajı WhatsApp’ta gönderip ardından gönderimi onaylayın.`);
      }catch(e){popup?.close();throw e;}
    });
  }
  const next=rows.find(row=>!row.sent&&row.recipient&&!opened.includes(row.messageId));
  return <section style={{margin:"18px auto",maxWidth:1140,padding:20,border:"1px solid #bcd6f6",borderRadius:18,background:"#fff",color:"#17345c"}}>
    <h2 style={{marginTop:0}}>Bugünkü telafi hatırlatmaları</h2>
    <p>Planlanan telafilerden bugünkü dersleri görüntüleyin. İlk planlama mesajından ayrı bir hatırlatma gönderilir.</p>
    <div style={{display:"flex",gap:10,flexWrap:"wrap"}}><button type="button" disabled={busy} onClick={()=>void load()}>{busy?"Kontrol ediliyor…":loaded?"Listeyi yenile":"Bugünkü telafileri göster"}</button>{next&&<button type="button" disabled={busy} onClick={()=>void send(next)}>Sıradaki hatırlatmayı aç</button>}</div>
    <p role="status" aria-live="polite">{status}</p>
    {loaded&&<p>{rows.length} telafi · {rows.filter(r=>r.sent).length} gönderildi{!rows.length?" · Hatırlatılacak bekleyen ders bulunamadı.":""}</p>}
    {rows.map(row=><article key={row.messageId} style={{padding:"14px 0",borderTop:"1px solid #dce5ef",overflowWrap:"anywhere"}}>
      <strong>{row.name}</strong><p>{row.time} · {row.branch}</p>
      <details><summary>Hatırlatma mesajını göster</summary><p style={{whiteSpace:"pre-wrap"}}>{row.message}</p></details>
      <p>{row.sent?"Gönderildi · Kullanıcı onaylı":!row.recipient?"Telefon eksik":opened.includes(row.messageId)?"WhatsApp açıldı · Gönderim onayı bekliyor":"Hatırlatma bekliyor"}</p>
      <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>{!row.sent&&row.recipient&&<button type="button" disabled={busy} onClick={()=>void send(row)}>WhatsApp’ta aç</button>}{!row.sent&&opened.includes(row.messageId)&&<button type="button" disabled={busy} onClick={()=>void send(row,true)}>Gönderildi olarak kaydet</button>}<a href={`/ogrenciler/${row.studentId}`}>Kursiyer dosyası</a></div>
    </article>)}
    <style jsx>{`button{min-height:44px;padding:10px 14px;border:1px solid #1268d6;border-radius:10px;background:#1268d6;color:white;font:inherit;cursor:pointer}button:disabled{opacity:.5}p{line-height:1.5}summary{cursor:pointer}`}</style>
  </section>;
}
