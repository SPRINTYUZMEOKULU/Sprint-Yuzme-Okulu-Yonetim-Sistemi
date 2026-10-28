"use client";
import {createContext,useContext,useEffect,useState,type ReactNode} from "react";
import {formatDisplayDateTime} from "@/lib/dates/display";
type Note={id:string;author?:{name:string;role:string}|null;reminder_completed?:boolean;completion?:{reply:string;completed_at:string;author?:{name:string}|null}|null};
const Context=createContext<{notes:Note[];complete:(id:string,reply:string)=>Promise<void>;error:string}>({notes:[],complete:async()=>{},error:""});
export function StudentNoteFollowUps({studentId,children}:{studentId:string;children:ReactNode}){
 const [notes,setNotes]=useState<Note[]>([]),[error,setError]=useState("");
 async function load(){const res=await fetch(`/api/student-notes?studentId=${encodeURIComponent(studentId)}`,{cache:"no-store"});const data=await res.json();if(!res.ok)throw new Error(data.error||"Not durumu yüklenemedi.");setNotes(data.notes||[]);}
 useEffect(()=>{void load().catch(e=>setError(e.message));},[studentId]);
 async function complete(id:string,reply:string){setError("");const res=await fetch("/api/student-notes",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({id,student_id:studentId,reply})});const data=await res.json();if(!res.ok)throw new Error(data.error||"Not tamamlanamadı.");window.dispatchEvent(new Event("sprintos-note-completed"));await load();}
 return <Context.Provider value={{notes,complete,error}}>{error&&<p role="alert">{error}</p>}{children}</Context.Provider>;
}
export function StudentNoteFollowUp({noteId}:{noteId:string}){
 const context=useContext(Context),note=context.notes.find(n=>n.id===noteId);
 const [editing,setEditing]=useState(false),[reply,setReply]=useState(""),[saving,setSaving]=useState(false),[error,setError]=useState("");
 if(!note)return null;
 const done=!!note.completion||!!note.reminder_completed;
 async function save(){if(saving||!reply.trim())return;setSaving(true);setError("");try{await context.complete(noteId,reply.trim());setEditing(false);setReply("");}catch(e){setError(e instanceof Error?e.message:"Not tamamlanamadı.");}finally{setSaving(false);}}
 return <div className="noteFollowUp"><small>Yazan: <strong>{note.author?.name||"Yazar bilgisi bulunamadı"}</strong></small>
 {done?<div className="done"><strong>✓ Tamamlandı</strong>{note.completion&&<><p>{note.completion.reply}</p><small>Tamamlayan: {note.completion.author?.name||"Kullanıcı bilgisi bulunamadı"} · {formatDisplayDateTime(note.completion.completed_at)}</small></>}</div>:editing?<div className="editor"><label htmlFor={`note-result-${noteId}`}>Yapılan işlem / sonuç</label><textarea id={`note-result-${noteId}`} rows={3} maxLength={3000} value={reply} onChange={e=>setReply(e.target.value)}/><div><button type="button" disabled={saving} onClick={()=>setEditing(false)}>Vazgeç</button><button type="button" disabled={saving||!reply.trim()} onClick={()=>void save()}>{saving?"Kaydediliyor…":"Kaydet ve Tamamla"}</button></div></div>:<button type="button" onClick={()=>setEditing(true)}>✓ Tamamla / Sonuç Yaz</button>}
 {error&&<p role="alert">{error}</p>}
 <style jsx>{`.noteFollowUp{display:grid;gap:10px;margin-top:12px;color:#51627a}.noteFollowUp>small{font-size:12px}.noteFollowUp button{padding:10px 13px;min-height:42px;border-radius:10px;border:1px solid #b8dcca;background:#edf9f2;color:#176344;font-weight:750;cursor:pointer;justify-self:start}.noteFollowUp button:disabled{opacity:.5}.done{padding:12px;border:1px solid #b8dcca;border-radius:12px;background:#f0faf4;color:#23613e}.done p{white-space:pre-wrap}.editor{display:grid;gap:8px;padding:12px;border:1px solid #cedaea;border-radius:12px}.editor textarea{width:100%;box-sizing:border-box;border:1px solid #ccd8e8;border-radius:9px;padding:10px;font:inherit}.editor>div{display:flex;gap:8px;flex-wrap:wrap}.noteFollowUp [role=alert]{color:#b42318}`}</style></div>;
}
