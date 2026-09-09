"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type MissedItem={date:string;scheduleId:string;groupId:string;groupName:string;startTime:string;endTime:string};

function setNativeValue(element:HTMLInputElement|HTMLSelectElement,value:string){
  const proto=element instanceof HTMLSelectElement?HTMLSelectElement.prototype:HTMLInputElement.prototype;
  const descriptor=Object.getOwnPropertyDescriptor(proto,"value");
  descriptor?.set?.call(element,value);
  element.dispatchEvent(new Event(element instanceof HTMLSelectElement?"change":"input",{bubbles:true}));
  if(element instanceof HTMLInputElement)element.dispatchEvent(new Event("change",{bubbles:true}));
}

export default function AttendanceAutomationCenter(){
  const [reportItems,setReportItems]=useState<MissedItem[]>([]);
  const [portalTarget,setPortalTarget]=useState<Element|null>(null);
  const autoApplied=useRef(false);

  useEffect(()=>{
    let active=true;
    const sync=async()=>{try{await fetch("/api/attendance-alerts",{cache:"no-store",credentials:"same-origin"});}catch{}};
    void sync();
    const timer=window.setInterval(()=>void sync(),60000);
    return()=>{active=false;window.clearInterval(timer);};
  },[]);

  useEffect(()=>{
    if(!window.location.pathname.startsWith("/yoklama")||autoApplied.current)return;
    const params=new URLSearchParams(window.location.search);
    if(params.get("groupId")||params.get("scheduleId")){autoApplied.current=true;return;}
    let cancelled=false;
    (async()=>{
      try{
        const response=await fetch("/api/attendance-alerts/next",{cache:"no-store",credentials:"same-origin"});
        const data=await response.json();
        if(cancelled||!response.ok||!data?.ok||!data.next)return;
        const apply=()=>{
          const root=document.querySelector("[data-attendance-client]")||document;
          const date=root.querySelector('input[type="date"]') as HTMLInputElement|null;
          const selects=Array.from(root.querySelectorAll("select")) as HTMLSelectElement[];
          if(!date||selects.length<2)return false;
          setNativeValue(date,data.next.date);
          setNativeValue(selects[0],String(data.next.groupId||""));
          window.setTimeout(()=>{
            const latest=Array.from((document.querySelector("[data-attendance-client]")||document).querySelectorAll("select")) as HTMLSelectElement[];
            if(latest[1])setNativeValue(latest[1],String(data.next.scheduleId||""));
          },180);
          autoApplied.current=true;
          return true;
        };
        if(!apply()){
          const retry=window.setTimeout(()=>apply(),450);
          return()=>window.clearTimeout(retry);
        }
      }catch{}
    })();
    return()=>{cancelled=true;};
  },[]);

  useEffect(()=>{
    if(!window.location.pathname.startsWith("/raporlar")){setPortalTarget(null);return;}
    const target=document.querySelector(".reportsWrap");
    setPortalTarget(target);
    const params=new URLSearchParams(window.location.search);
    const query=new URLSearchParams();
    if(params.get("from"))query.set("from",params.get("from")!);
    if(params.get("to"))query.set("to",params.get("to")!);
    if(params.get("branch"))query.set("branch",params.get("branch")!);
    fetch(`/api/attendance-alerts/report?${query.toString()}`,{cache:"no-store",credentials:"same-origin"})
      .then(r=>r.json()).then(d=>{if(d?.ok&&Array.isArray(d.items))setReportItems(d.items);}).catch(()=>{});
  },[]);

  if(!portalTarget||!reportItems.length)return null;
  return createPortal(
    <section style={{margin:"16px 0",padding:18,border:"1px solid #fecaca",borderRadius:18,background:"linear-gradient(135deg,#fff7f7,#fff)",boxShadow:"0 10px 28px rgba(127,29,29,.06)"}}>
      <div style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"center",flexWrap:"wrap"}}>
        <div><div style={{fontSize:11,fontWeight:900,color:"#b91c1c",letterSpacing:".08em"}}>YOKLAMA KONTROLÜ</div><h2 style={{margin:"5px 0 3px",fontSize:20,color:"#7f1d1d"}}>⚠️ Alınmayan Yoklamalar</h2><p style={{margin:0,color:"#64748b",fontSize:13}}>Ders başlangıcından 15 dakika geçtiği halde yoklama kaydı oluşmayan seanslar.</p></div>
        <strong style={{padding:"9px 12px",borderRadius:999,background:"#fee2e2",color:"#991b1b"}}>{reportItems.length} seans</strong>
      </div>
      <div style={{display:"grid",gap:8,marginTop:14}}>{reportItems.slice(0,8).map(item=><a key={`${item.date}-${item.scheduleId}`} href={`/yoklama?groupId=${encodeURIComponent(item.groupId)}&scheduleId=${encodeURIComponent(item.scheduleId)}`} style={{display:"flex",justifyContent:"space-between",gap:10,alignItems:"center",padding:"11px 12px",border:"1px solid #fee2e2",borderRadius:12,background:"#fff",textDecoration:"none",color:"#10213a"}}><span><strong>{item.groupName}</strong><small style={{display:"block",marginTop:3,color:"#64748b"}}>{item.date} · {item.startTime}{item.endTime?` - ${item.endTime}`:""}</small></span><b style={{color:"#b91c1c"}}>Yoklamaya Git →</b></a>)}</div>
      {reportItems.length>8?<div style={{marginTop:10,fontSize:12,color:"#64748b"}}>+ {reportItems.length-8} başka eksik yoklama daha var.</div>:null}
    </section>,portalTarget
  );
}
