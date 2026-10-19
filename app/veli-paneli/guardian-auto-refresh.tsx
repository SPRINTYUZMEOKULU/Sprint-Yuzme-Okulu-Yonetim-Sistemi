"use client";
import {useEffect} from 'react';
import {usePathname,useRouter} from 'next/navigation';
export default function GuardianAutoRefresh(){
 const router=useRouter(),pathname=usePathname();
 useEffect(()=>{
  let lastRefresh=Date.now();
  const refresh=()=>{if(document.visibilityState!=='visible'||Date.now()-lastRefresh<10000)return;lastRefresh=Date.now();router.refresh();};
  const pageShow=(event:PageTransitionEvent)=>{if(event.persisted)refresh();};
  document.addEventListener('visibilitychange',refresh);window.addEventListener('pageshow',pageShow);
  return()=>{document.removeEventListener('visibilitychange',refresh);window.removeEventListener('pageshow',pageShow);};
 },[router,pathname]);return null;
}
