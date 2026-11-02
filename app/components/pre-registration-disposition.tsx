"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Mode = "archive" | "reject" | "delete" | "reject_delete";
export default function PreRegistrationDisposition({studentId,name}: {studentId:string;name:string}) {
  const router=useRouter();
  const [open,setOpen]=useState(false), [mode,setMode]=useState<Mode>("reject_delete"), [reason,setReason]=useState("");
  const [deletionText,setDeletionText]=useState(""), [busy,setBusy]=useState(false), [error,setError]=useState("");
  const [prepared,setPrepared]=useState<{phone:string;message:string}|null>(null), [opened,setOpened]=useState(false), [sent,setSent]=useState(false);
  const [done,setDone]=useState("");
  const messageId=useRef("");
  const lock=useRef(false);
  const removing=mode==="delete" || mode==="reject_delete", rejecting=mode==="reject" || mode==="reject_delete";
  async function call(action:string) {
    const response=await fetch("/api/pre-registration-disposition",{method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({studentId,action,reason,deletionText,confirmed:true,messageId:messageId.current})});
    const data=await response.json(); if(!response.ok || !data.ok) throw new Error(data.message || "İşlem tamamlanamadı."); return data;
  }
  async function run(task:()=>Promise<void>) {
    if(lock.current)return; lock.current=true;setBusy(true);setError("");
    try {await task()} catch(error) {setError(error instanceof Error ? error.message : "İşlem tamamlanamadı.")} finally {lock.current=false;setBusy(false)}
  }
  async function prepare() {
    await run(async()=>{
      if(!messageId.current) messageId.current=crypto.randomUUID();
      const data=await call("prepare_rejection");setPrepared({phone:data.phone,message:data.message});
    });
  }
  async function finish() {
    if (reason.trim().length<5) {setError("En az 5 karakterlik işlem gerekçesi girin.");return}
    if(removing && deletionText!=="SİL") {setError("Kalıcı silme için SİL yazın.");return}
    if(rejecting && !sent) {setError("Ret mesajını gönderip gönderimi onaylayın.");return}
    if(!window.confirm(`${name}\n\n${removing ? "Başvuru ve ona bağlı dosya kayıtları kalıcı olarak silinecek. Bu işlem geri alınamaz." : "Başvuru kapatılıp arşive kaldırılacak. Dosyası korunacak."}\n\nDevam edilsin mi?`))return;
    await run(async()=>{await call(mode);setDone(removing ? "Başvuru kalıcı olarak silindi." : rejecting ? "Başvuru reddedildi ve arşive kaldırıldı." : "Başvuru arşive kaldırıldı.");setOpen(false);router.push("/on-kayitlar/gerceklesmeyen");router.refresh()});
  }
  return <section onClick={event=>event.stopPropagation()} onKeyDown={event=>event.stopPropagation()} onContextMenu={event=>event.stopPropagation()} style={{margin:"12px 0",maxWidth:"100%",color:"#17345b"}}>
    <button type="button" onClick={()=>setOpen(!open)} aria-expanded={open} style={{padding:"10px 14px",border:"1px solid #fecdd3",borderRadius:10,background:"#fff1f2",color:"#9f1239",fontWeight:700}}>Başvuru İşlemleri · Reddet / Sil / Arşivle</button>
    {done && <p role="status">{done}</p>}
    {open && <div style={{display:"grid",gap:12,padding:16,marginTop:10,border:"1px solid #e2e8f0",borderRadius:14,background:"#fff",overflowWrap:"anywhere"}}>
      <strong>{name}</strong>
      <label>İşlem<select value={mode} disabled={busy} onChange={event=>{setMode(event.target.value as Mode);setError("")}} style={{display:"block",width:"100%",padding:10,marginTop:5}}>
        <option value="reject_delete">Reddet, mesaj gönder ve tamamen sil</option><option value="reject">Reddet ve mesaj gönder (arşivde tut)</option>
        <option value="archive">Arşive kaldır</option><option value="delete">Sistemden tamamen sil</option>
      </select></label>
      <label>İşlem gerekçesi<textarea value={reason} onChange={event=>setReason(event.target.value)} minLength={5} maxLength={500} disabled={busy} style={{display:"block",width:"100%",boxSizing:"border-box",minHeight:70,marginTop:5}}/></label>
      {rejecting && <div style={{display:"grid",gap:10,padding:12,background:"#f1f5f9",borderRadius:10}}>
        {!prepared ? <button type="button" disabled={busy || reason.trim().length<5} onClick={()=>void prepare()}>Ret Mesajını Hazırla</button> : <>
          <p style={{margin:0,whiteSpace:"pre-wrap"}}>{prepared.message}</p><small>Alıcı: +{prepared.phone}</small>
          <a href={`https://wa.me/${prepared.phone}?text=${encodeURIComponent(prepared.message)}`} target="_blank" rel="noreferrer" onClick={()=>setOpened(true)}>Ret Mesajını WhatsApp’ta Aç ↗</a>
          <small>WhatsApp’ın açılması gönderim sayılmaz. Mesajı gönderdikten sonra aşağıdan onaylayın.</small>
          <button type="button" disabled={busy || !opened || sent} onClick={()=>void run(async()=>{await call("confirm_rejection");setSent(true)})}>{sent ? "Gönderim tarafınızdan onaylandı ✓" : "Mesajı Gönderdim · Onayla"}</button>
        </>}
      </div>}
      {removing ? <label style={{color:"#9f1239"}}>Kalıcı silme geri alınamaz. Onay için SİL yazın.<input value={deletionText} onChange={event=>setDeletionText(event.target.value)} disabled={busy} autoComplete="off" style={{display:"block",width:"100%",boxSizing:"border-box",padding:10,marginTop:5}}/></label> : <small>Başvuru bekleyenler listesinden kaldırılır. Dosya ve geçmiş arşivde korunur.</small>}
      {error && <p role="alert" style={{color:"#b91c1c",margin:0}}>{error}</p>}
      <button type="button" disabled={busy || reason.trim().length<5 || (removing && deletionText!=="SİL") || (rejecting && !sent)} onClick={()=>void finish()} style={{padding:12,border:0,borderRadius:10,background:removing?"#b91c1c":"#1d4ed8",color:"white",fontWeight:700}}>{busy ? "İşleniyor…" : removing ? "Başvuruyu Kalıcı Sil" : "Başvuruyu Arşive Kaldır"}</button>
      <button type="button" disabled={busy} onClick={()=>setOpen(false)}>Vazgeç</button>
    </div>}
  </section>;
}
