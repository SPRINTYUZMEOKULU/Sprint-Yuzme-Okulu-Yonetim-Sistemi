'use client';
import UiIcon from "@/app/components/ui-icon";
import {createClient} from '@/lib/supabase/browser';
import {useRouter} from 'next/navigation';
import {guardianNotificationPath} from '@/lib/guardian/notification-visibility';
import {useCallback,useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {formatDisplayDateTime} from '@/lib/dates/display';
type Notice={id:string;title:string;body:string;target_path:string;created_at:string};
export default function GuardianNotifications(){
 const [notices,setNotices]=useState<Notice[]>([]),[open,setOpen]=useState(false),[error,setError]=useState(''),[marking,setMarking]=useState<string|null>(null);
 const pathname=usePathname(),router=useRouter();
 const [profileId,setProfileId]=useState<string|null>(null);
 const markLock=useRef(false);
 const requestVersion=useRef(0),container=useRef<HTMLDivElement>(null);
 const refresh=useCallback(async()=>{const version=++requestVersion.current;try{const res=await fetch('/api/guardian-notifications',{cache:'no-store'});if(!res.ok)throw Error();const data=await res.json();if(version!==requestVersion.current)return;setNotices(Array.isArray(data.notifications)?data.notifications:[]);setProfileId(data.profileId||null);setError('');}catch{if(version===requestVersion.current)setError('Bildirimler yüklenemedi.');}},[]);
 useEffect(()=>{setOpen(false);void refresh();const focus=()=>{if(document.visibilityState==='visible')void refresh();};window.addEventListener('focus',focus);document.addEventListener('visibilitychange',focus);const timer=window.setInterval(focus,20000);return()=>{window.clearInterval(timer);window.removeEventListener('focus',focus);document.removeEventListener('visibilitychange',focus);};},[pathname,refresh]);
 useEffect(()=>{
  if(!profileId)return;
  let cleanup:(()=>void)|undefined;
  try{const db=createClient();const channel=db.channel(`guardian-notices:${profileId}`).on('postgres_changes',{event:'*',schema:'public',table:'system_notifications',filter:`recipient_user_id=eq.${profileId}`},()=>{void refresh();router.refresh();}).subscribe();cleanup=()=>{try{void Promise.resolve(db.removeChannel(channel)).catch(()=>{});}catch{}};}
  catch{/* Real-time may be unavailable on older browsers; focus and polling remain active. */}
  return()=>cleanup?.();
 },[profileId,router,refresh]);
 useEffect(()=>{if(!open)return;const escape=(event:KeyboardEvent)=>{if(event.key==='Escape')setOpen(false);};const outside=(event:PointerEvent)=>{if(event.target instanceof Node&&!container.current?.contains(event.target))setOpen(false);};document.addEventListener('keydown',escape);document.addEventListener('pointerdown',outside);return()=>{document.removeEventListener('keydown',escape);document.removeEventListener('pointerdown',outside);};},[open]);
 async function mark(id:string){if(markLock.current)return;markLock.current=true;setMarking(id);setError('');try{const res=await fetch('/api/guardian-notifications',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id})});if(!res.ok)throw Error();setNotices(rows=>rows.filter(n=>n.id!==id));}catch{setError('Okundu bilgisi kaydedilemedi.');}finally{markLock.current=false;setMarking(null);}}
 return <div className="guardianNotifications" ref={container}><button type="button" className={"guardianNotificationButton"+(notices.length?" guardianAttention":"")} aria-label={`Bildirimler, ${notices.length} okunmamış`} aria-expanded={open} aria-controls="guardian-notification-list" onClick={()=>{setOpen(!open);if(!open)void refresh();}}><svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></svg>{notices.length?<b>{notices.length}</b>:null}</button>{open?<section id="guardian-notification-list" className="guardianNotificationList" aria-label="Bildirimler"><div className="guardianCardHeader"><strong>Bildirimler</strong><button onClick={()=>setOpen(false)} aria-label="Bildirimleri kapat"><UiIcon name="close" size={18}/></button></div>{error?<p role="alert">{error}</p>:null}{!error&&!notices.length?<p>Okunmamış bildiriminiz yok.</p>:null}{notices.map(n=><article key={n.id}><Link href={guardianNotificationPath(n.target_path)||'/veli-paneli'} onClick={()=>setOpen(false)}><strong>{n.title}</strong><p>{n.body}</p><time>{Number.isNaN(Date.parse(n.created_at))?"":formatDisplayDateTime(new Date(n.created_at))}</time></Link><button type="button" disabled={marking!==null} onClick={()=>void mark(n.id)}>{marking===n.id?"Kaydediliyor…":"Okundu olarak işaretle"}</button></article>)}<button onClick={()=>void refresh()}>Yenile</button></section>:null}</div>;
}
