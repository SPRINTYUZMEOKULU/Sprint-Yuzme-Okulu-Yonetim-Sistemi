"use client";

import Link from "next/link";
import { useEffect, useId, useMemo, useRef, useState } from "react";

import "./attendance-reminder-panel.css";

type Student={id:string;first_name?:string|null;last_name?:string|null;student_number?:string|null};
type Reminder={id:string;title:string;description:string|null;priority:string;status:string;source_id:string|null;action_url:string|null;due_at:string|null;created_at:string|null;assigned_to:string|null};

type Props={students:Student[];context?:string;draftKey?:string;showCompleted?:boolean};

function fmt(value?:string|null){if(!value)return"—";const d=new Date(value);return Number.isNaN(d.getTime())?value:new Intl.DateTimeFormat("tr-TR",{day:"2-digit",month:"2-digit",year:"numeric"}).format(d)}
function nameOf(s:Student){return`${s.first_name||""} ${s.last_name||""}`.trim()||"Kursiyer"}

export default function AttendanceReminderPanel({students,context,draftKey,showCompleted=false}:Props){
  const [items,setItems]=useState<Reminder[]>([]),[loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[studentId,setStudentId]=useState(""),[note,setNote]=useState(""),[priority,setPriority]=useState("normal"),[dueDate,setDueDate]=useState(""),[message,setMessage]=useState("");
  const [expanded,setExpanded]=useState(!context);
  const [listOpen,setListOpen]=useState(showCompleted);
  const editorId=useId();
  const textareaRef=useRef<HTMLTextAreaElement>(null);
  useEffect(()=>{if(expanded&&context)textareaRef.current?.focus()},[expanded,context]);
  const studentOptions=useMemo(()=>[...students].sort((a,b)=>nameOf(a).localeCompare(nameOf(b),"tr")),[students]);

  async function load(){setLoading(true);try{const r=await fetch(`/api/attendance-reminders${showCompleted?"?includeCompleted=1":""}`,{cache:"no-store"});const j=await r.json();if(!r.ok||!j?.ok){setMessage(j?.error||"Notlar yüklenemedi. Lütfen tekrar deneyin.");return}setItems(Array.isArray(j.items)?j.items:[])}catch{setMessage("Notlar yüklenemedi. Bağlantınızı kontrol edin.")}finally{setLoading(false)}}
  useEffect(()=>{void load()},[]);
  const [draftReady,setDraftReady]=useState(false);
  useEffect(()=>{if(draftKey){try{const raw=localStorage.getItem(draftKey);if(raw){const draft=JSON.parse(raw);setNote(draft.note||"");if(draft.note)setExpanded(true);setStudentId(draft.studentId||"");setPriority(draft.priority||"normal");setDueDate(draft.dueDate||"")}}catch{}}setDraftReady(true)},[draftKey]);
  useEffect(()=>{if(!draftKey||!draftReady)return;try{if(note.trim())localStorage.setItem(draftKey,JSON.stringify({note,studentId,priority,dueDate}));else localStorage.removeItem(draftKey)}catch{}},[draftKey,draftReady,note,studentId,priority,dueDate]);

  async function submit(e:React.FormEvent){e.preventDefault();if(saving)return;if(note.trim().length<3){setMessage("Kısa bir açıklama yazın.");return}setSaving(true);setMessage("");try{const r=await fetch("/api/attendance-reminders",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({studentId:studentId||null,note:context?`${context}\n${note.trim()}`:note.trim(),priority,dueDate:dueDate||null})});const j=await r.json();if(!r.ok||!j?.ok){setMessage(j?.error||"Hatırlatma kaydedilemedi.");return}if(draftKey){try{localStorage.removeItem(draftKey)}catch{}}setNote("");setStudentId("");setPriority("normal");setDueDate("");setMessage("Not kaydedildi. Ana Notlar bölümüne eklendi.");if(context)setExpanded(false);await load()}catch{setMessage("Bağlantı hatası oluştu.")}finally{setSaving(false)}}

  async function complete(id:string){try{const r=await fetch("/api/attendance-reminders",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({id})});const j=await r.json();if(!r.ok||!j?.ok){setMessage(j?.error||"İşlem tamamlanamadı.");return}setItems(v=>showCompleted?v.map(x=>x.id===id?{...x,status:"completed"}:x):v.filter(x=>x.id!==id));setMessage("Not tamamlandı olarak işaretlendi.")}catch{setMessage("İşlem tamamlanamadı. Bağlantınızı kontrol edin.")}}


  return <section className="attendanceReminderPanel">
    <header className="arpHead">
      <div className="arpHeading"><span className="arpIcon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6"/><path d="m16 3 5 5-9 9-5 1 1-5Z"/></svg></span><div><h2>Hızlı Notlar</h2><p>Seansla ilgili bir durum mu var?</p></div></div>
      <button type="button" className="arpAdd" aria-expanded={expanded} aria-controls={editorId} onClick={()=>setExpanded(v=>!v)}>{expanded?"Kapat":"＋ Not Ekle"}</button>
    </header>
    {expanded?<form id={editorId} className="arpForm" onSubmit={submit}>
      {context?<div className="arpContext">{context}</div>:null}
      <label className="arpNoteLabel" htmlFor={`${editorId}-text`}>Notunuz</label>
      <textarea id={`${editorId}-text`} ref={textareaRef} disabled={saving} maxLength={4000} value={note} onChange={e=>setNote(e.target.value)} placeholder="Örn. Deniz listede görünmüyor; grup kaydı kontrol edilecek." rows={3}/>
      <details className="arpOptions" open={studentId||dueDate||priority!=="normal"?true:undefined}>
        <summary>Öğrenci seç / Hatırlatma ekle <span>İsteğe bağlı</span></summary>
        <div className="arpFields">
          {students.length?<label>İlgili öğrenci<select disabled={saving} value={studentId} onChange={e=>setStudentId(e.target.value)}><option value="">Genel seans notu</option>{studentOptions.map(s=><option key={s.id} value={s.id}>{nameOf(s)}{s.student_number?` · ${s.student_number}`:""}</option>)}</select></label>:null}
          <label>Öncelik<select disabled={saving} value={priority} onChange={e=>setPriority(e.target.value)}><option value="low">Düşük</option><option value="normal">Normal</option><option value="high">Önemli</option><option value="critical">Acil</option></select></label>
          <label>Hatırlatma tarihi<input disabled={saving} type="date" value={dueDate} onChange={e=>setDueDate(e.target.value)}/></label>
        </div>
      </details>
      <footer className="arpFormFooter"><small>{note.trim()&&draftKey?"Taslak korunuyor":"Ana Notlar bölümünde görünür"}</small><button className="arpSave" disabled={saving||note.trim().length<3}>{saving?"Kaydediliyor…":"Notu Kaydet"}</button></footer>
    </form>:null}
    {message?<div className="arpMessage" role="status">{message}<button type="button" aria-label="Mesajı kapat" onClick={()=>setMessage("")}>×</button></div>:null}
    <div className="arpBottom"><button type="button" className="arpListToggle" aria-expanded={listOpen} aria-controls={`${editorId}-list`} onClick={()=>setListOpen(v=>!v)}>{showCompleted?"Kayıtlı notlar":"Açık notlar"}<span>{loading?"…":items.length}</span><svg aria-hidden="true" viewBox="0 0 24 24" className={listOpen?"isOpen":""}><path d="m6 9 6 6 6-6"/></svg></button><Link className="arpAllNotes" href="/notlar">Tüm Notlar <span aria-hidden="true">↗</span></Link></div>
    {listOpen?<div id={`${editorId}-list`} className="arpList">{loading?<p className="arpEmpty">Notlar yükleniyor…</p>:items.length?items.map(item=><article key={item.id} className={`priority-${item.priority}`}><div className="arpMeta"><strong>{item.title}</strong><small>{fmt(item.created_at)}{item.due_at?` · Hatırlatma: ${fmt(item.due_at)}`:""}</small></div><p>{item.description}</p><div className="arpActions">{item.action_url?<Link href={item.action_url}>Kaydı Aç ↗</Link>:null}{item.status==="completed"?<span className="arpDone">Tamamlandı</span>:<button type="button" onClick={()=>void complete(item.id)}>✓ Tamamla</button>}</div></article>):<p className="arpEmpty">{showCompleted?"Henüz kayıtlı not yok.":"Açık not bulunmuyor."}</p>}</div>:null}
  </section>
}
