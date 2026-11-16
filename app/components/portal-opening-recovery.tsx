'use client';
import {useEffect} from 'react';
import {usePathname} from 'next/navigation';
import {allowPortalReload,isStalePortalChunk} from '@/lib/guardian/opening-recovery';
export default function PortalOpeningRecovery(){
 const path=usePathname();
 useEffect(()=>{
  if(!path.startsWith('/veli-')&&path!=='/login')return;
  const recover=(error:unknown)=>{try{if(isStalePortalChunk(error)&&allowPortalReload(window.sessionStorage))window.location.reload();}catch{/* A blocked storage API must not cause another opening error. */}};
  const onError=(event:ErrorEvent)=>recover(event.error||event.message);
  const onRejection=(event:PromiseRejectionEvent)=>recover(event.reason);
  window.addEventListener('error',onError);window.addEventListener('unhandledrejection',onRejection);
  return()=>{window.removeEventListener('error',onError);window.removeEventListener('unhandledrejection',onRejection);};
 },[path]);return null;
}
