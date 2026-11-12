"use client";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { formatDisplayDate } from "@/lib/dates/display";

type Props = {studentId:string;studentName:string;scheduleId:string;date:string;disabled?:boolean};
export default function StudentAttendanceFollowup({studentId,studentName,scheduleId,date,disabled}:Props) {
  const id=useId();
  const [open,setOpen]=useState(false),[kind,setKind]=useState(""),[note,setNote]=useState(""),[saving,setSaving]=useState(false),[message,setMessage]=useState(""),[noteId,setNoteId]=useState("");
  const saveLock=useRef(false);
  const trigger=useRef<HTMLButtonElement>(null),dialog=useRef<HTMLDivElement>(null),choice=useRef<HTMLSelectElement>(null);
  function close(){if(saving)return;setOpen(false);trigger.current?.focus();}
  useEffect(()=>{if(!open)return;choice.current?.focus();function key(e:KeyboardEvent){if(e.key==="Escape"){e.preventDefault();if(!saving){setOpen(false);trigger.current?.focus();}}if(e.key==="Tab"){const nodes=dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled),select,textarea,a[href]');if(!nodes?.length)return;const first=nodes[0],last=nodes[nodes.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}}document.addEventListener("keydown",key);return()=>document.removeEventListener("keydown",key);},[open,saving]);
  async function save(){if(saveLock.current||!kind)return;saveLock.current=true;setSaving(true);setMessage("");try{
    const response=await fetch("/api/attendance-student-followups",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({studentId,scheduleId,date,kind,note})});
    const result=await response.json();if(!response.ok||!result.ok)throw new Error(result.error||"Takip kaydedilemedi.");
    setNoteId(result.note_id);setMessage([result.message,result.warning].filter(Boolean).join(" "));window.dispatchEvent(new Event("sprintos-followup-changed"));
  }catch(error){setMessage(error instanceof Error?error.message:"Bağlantı hatası. Tekrar deneyin.");}finally{saveLock.current=false;setSaving(false);}}
  return <>
    <button ref={trigger} type="button" className={`followupTrigger ${noteId?"recorded":""}`} disabled={disabled} aria-haspopup="dialog" onClick={()=>setOpen(true)}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 3h6v4H9zM9 12h6M9 16h4"/></svg><span>{noteId?"Takip kayıtlı":"Takip"}</span></button>
    {open&&createPortal(<div className="followupBackdrop" onClick={e=>{if(e.target===e.currentTarget)close();}}><div ref={dialog} className="followupDialog" role="dialog" aria-modal="true" aria-labelledby={`${id}-title`}>
      <header><div><small>YOKLAMA · ÖĞRENCİ TAKİBİ</small><h2 id={`${id}-title`}>{studentName}</h2><p>{formatDisplayDate(date)}</p></div><button type="button" onClick={close} disabled={saving} aria-label="Takip panelini kapat">×</button></header>
      <p>Gerekli bir arama veya kontrol için takip oluşturun. Geldi / Gelmedi seçiminiz ve ders hakları bu işlemden etkilenmez.</p>
      <label htmlFor={`${id}-kind`}>Takip türü</label><select ref={choice} id={`${id}-kind`} value={kind} disabled={saving||!!noteId} onChange={e=>setKind(e.target.value)}><option value="">Seçin · isteğe bağlı</option><option value="call">Veli aranacak</option><option value="absence">Devamsızlık takibi</option><option value="information">Bilgi alınacak</option><option value="other">Diğer</option></select>
      <label htmlFor={`${id}-note`}>Açıklama <small>İsteğe bağlı</small></label><textarea id={`${id}-note`} rows={3} maxLength={2000} value={note} disabled={saving||!!noteId} onChange={e=>setNote(e.target.value)} placeholder="Arama nedeni veya kontrol edilecek bilgi"/>
      {message&&<p className="followupMessage" role="status" aria-live="polite">{message}</p>}
      {noteId&&<Link href={`/ogrenciler/${studentId}?noteId=${noteId}#notlar`}>Öğrenci dosyasında takibi aç</Link>}
      <footer><button type="button" disabled={saving} onClick={close}>{noteId?"Kapat":"Vazgeç"}</button>{!noteId&&<button type="button" className="followupSave" disabled={saving||!kind} onClick={()=>void save()}>{saving?"Kaydediliyor…":"Takibi Kaydet"}</button>}</footer>
    </div></div>,document.body)}
    <style jsx>{`
      .followupTrigger{display:inline-flex;align-items:center;justify-content:center;gap:5px;min-height:42px;padding:8px;border:1px solid #d8e2ec;border-radius:10px;background:#fff;color:#53677e;font:inherit;font-size:10px;font-weight:800;cursor:pointer}.followupTrigger.recorded{color:#176344;background:#edf9f2;border-color:#b8dcca}.followupTrigger:disabled{opacity:.45}.followupBackdrop{position:fixed;inset:0;z-index:12000;background:rgba(15,23,42,.5);padding:20px;display:flex;align-items:center;justify-content:center;box-sizing:border-box}.followupDialog{width:min(100%,460px);max-height:calc(100dvh - 40px);overflow:auto;padding:22px;box-sizing:border-box;border:1px solid #dbe5f1;border-radius:20px;background:#fff;box-shadow:0 20px 60px rgba(15,23,42,.2);color:#173556;display:grid;gap:12px}.followupDialog header{display:flex;justify-content:space-between;align-items:flex-start}.followupDialog header small{font-size:10px;letter-spacing:.08em;color:#64748b}.followupDialog h2{margin:5px 0;font-size:20px}.followupDialog p{margin:0;color:#64748b;font-size:13px;line-height:1.6}.followupDialog label{font-size:13px;font-weight:750}.followupDialog label small{font-weight:400;color:#64748b}.followupDialog select,.followupDialog textarea{width:100%;padding:11px;border:1px solid #ccd8e8;border-radius:10px;background:#fff;font:inherit;font-size:14px;box-sizing:border-box}.followupDialog button{min-height:42px;padding:9px 15px;border:1px solid #ccd8e8;border-radius:10px;background:#f7faff;color:#173556;font:inherit;font-size:13px;font-weight:750;cursor:pointer}.followupDialog header button{font-size:21px;padding:3px 12px}.followupDialog footer{display:flex;gap:8px;justify-content:flex-end;margin-top:5px}.followupDialog .followupSave{background:#176de9;border-color:#176de9;color:#fff}.followupDialog button:disabled{opacity:.5;cursor:default}.followupDialog .followupMessage{padding:10px;border-radius:10px;background:#edf5ff;color:#173556}.followupDialog a{color:#176de9;font-size:13px}@media(max-width:640px){.followupBackdrop{padding:12px;padding-bottom:calc(12px + env(safe-area-inset-bottom,0px))}.followupDialog{padding:18px}}
    `}</style>
  </>;
}
