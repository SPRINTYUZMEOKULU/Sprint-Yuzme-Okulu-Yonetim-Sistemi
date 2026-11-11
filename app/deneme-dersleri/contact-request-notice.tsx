"use client";
import {useRef,useState} from "react";
import {useRouter} from "next/navigation";
import {markContactRequestResolved} from "./actions";
export default function ContactRequestNotice({studentId,label,resolved}:{studentId:string;label:string;resolved:boolean}) {
  const router=useRouter(),lock=useRef(false);
  const [done,setDone]=useState(resolved),[busy,setBusy]=useState(false),[message,setMessage]=useState("");
  async function mark() {
    if(lock.current || done)return;lock.current=true;setBusy(true);setMessage("");
    try{const result=await markContactRequestResolved(studentId);setMessage(result.message);if(result.ok){setDone(true);router.refresh();}}
    catch{setMessage("İletişim talebi işaretlenemedi. Kayıt işlemine devam edip daha sonra tekrar deneyebilirsiniz.");}
    finally{lock.current=false;setBusy(false);}
  }
  return done ? <div className="trialSaved" role="status"><strong>✓ İletişim talebi karşılandı</strong>{message ? <p>{message}</p>:null}</div> : <div className="followUpAlert" role="status"><strong>{label}</strong><p>Bilgilendirme uyarısıdır; kayıt işleminizi engellemez.</p><button type="button" disabled={busy} aria-busy={busy} onClick={mark}>{busy ? "İşaretleniyor…" : "Karşılandı"}</button>{message ? <p aria-live="polite">{message}</p>:null}</div>;
}
