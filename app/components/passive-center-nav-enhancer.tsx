"use client";

import { useEffect } from "react";

export default function PassiveCenterNavEnhancer(){
  useEffect(()=>{
    const apply=()=>{
      document.querySelectorAll<HTMLAnchorElement>('a[href="/ogrenciler?durum=passive"]').forEach(link=>{
        link.href="/ogrenciler/pasif-merkezi";
        if((link.textContent||"").trim()==="Pasif / Arşiv") link.setAttribute("title","Pasif Öğrenci Merkezi");
      });
    };
    apply();
    const observer=new MutationObserver(apply);
    observer.observe(document.body,{subtree:true,childList:true});
    return()=>observer.disconnect();
  },[]);
  return null;
}
