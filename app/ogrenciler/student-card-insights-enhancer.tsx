"use client";

import { useEffect } from "react";

const money=(value:number)=>new Intl.NumberFormat("tr-TR",{style:"currency",currency:"TRY",maximumFractionDigits:0}).format(Number(value||0));

function icon(name:"pin"|"group"|"calendar"){
  const paths={
    pin:'<path d="M12 21s6-5.3 6-12A6 6 0 0 0 6 9c0 6.7 6 12 6 12Z"/><circle cx="12" cy="9" r="2"/>',
    group:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>',
  } as const;
  return `<span class="sciInlineIcon"><svg viewBox="0 0 24 24" aria-hidden="true">${paths[name]}</svg></span>`;
}

function getStudentId(card:HTMLElement){
  const link=Array.from(card.querySelectorAll<HTMLAnchorElement>('a[href*="/ogrenciler/"]')).find((a)=>/\/ogrenciler\/[0-9a-f-]{20,}/i.test(a.getAttribute("href")||""));
  return link?.getAttribute("href")?.match(/\/ogrenciler\/([^/?#]+)/)?.[1]||"";
}

function paymentTarget(card:HTMLElement){
  return Array.from(card.querySelectorAll<HTMLElement>("div")).find((div)=>{
    const span=div.querySelector(":scope > span");
    return (span?.textContent||"").trim()==="Ödeme" && Boolean(div.querySelector(":scope > strong"));
  })?.querySelector<HTMLElement>(":scope > strong")||null;
}

function polishEmoji(card:HTMLElement){
  const walkers=document.createTreeWalker(card,NodeFilter.SHOW_TEXT);
  const nodes:Text[]=[];
  while(walkers.nextNode()){
    const n=walkers.currentNode as Text;
    if(/[📍👥🗓📅]/.test(n.data)) nodes.push(n);
  }
  for(const node of nodes){
    const parent=node.parentElement;
    if(!parent||parent.dataset.sciIconized==="1") continue;
    let html=node.data;
    html=html.replace(/📍\s*/g,icon("pin")).replace(/👥\s*/g,icon("group")).replace(/[🗓📅]\s*/g,icon("calendar"));
    const wrap=document.createElement("span");
    wrap.innerHTML=html;
    parent.replaceChild(wrap,node);
    parent.dataset.sciIconized="1";
  }
}

export default function StudentCardInsightsEnhancer(){
  useEffect(()=>{
    if(window.location.pathname!=="/ogrenciler") return;
    let cancelled=false;

    async function run(){
      const cards=Array.from(document.querySelectorAll<HTMLElement>(".studentCard"));
      cards.forEach(polishEmoji);
      const entries=cards.map((card)=>({card,id:getStudentId(card)})).filter((x)=>x.id);
      for(let i=0;i<entries.length;i+=80){
        const batch=entries.slice(i,i+80);
        try{
          const response=await fetch(`/api/student-card-insights?ids=${encodeURIComponent(batch.map((x)=>x.id).join(","))}`,{cache:"no-store"});
          const payload=await response.json();
          if(cancelled||!response.ok||!payload.ok) continue;
          const map=new Map<string,any>((payload.items||[]).map((x:any)=>[String(x.studentId),x]));
          for(const {card,id} of batch){
            const insight=map.get(id); if(!insight) continue;
            const target=paymentTarget(card);
            if(target){
              const f=insight.finance;
              target.classList.remove("paymentOk","paymentDue","paymentUnknown");
              if(!f?.hasActiveEnrollment){
                target.textContent="Finans verisi kontrol edilmeli";
                target.classList.add("paymentUnknown");
              }else if(f.remaining<=0 && f.total>0){
                target.textContent=`Ödendi · ${money(f.paid)}`;
                target.classList.add("paymentOk");
              }else if(f.paid>0){
                target.textContent=`${money(f.paid)} ödendi · ${money(f.remaining)} kaldı`;
                target.classList.add("paymentDue");
              }else{
                target.textContent=`Ödeme bekleniyor · ${money(f.remaining)} kalan`;
                target.classList.add("paymentDue");
              }
              target.title=f?.dueDate?`Vade: ${new Date(`${f.dueDate}T12:00:00`).toLocaleDateString("tr-TR")}`:"";
            }

            const old=card.querySelector(".sciAbsenceAlert"); old?.remove();
            const followup=insight.absenceFollowup;
            if(followup){
              const alert=document.createElement("div");
              alert.className="sciAbsenceAlert";
              alert.innerHTML=`<div><strong>2 ders üst üste devamsızlık</strong><span>${followup.first_absence_date} ve ${followup.second_absence_date} · Öğrenci/veli aranmalı ve gerekçe girilmeli.</span></div><button type="button">Gerekçe Gir</button>`;
              alert.querySelector("button")?.addEventListener("click",async()=>{
                const reason=window.prompt("Öğrenci/veli ile görüşme sonucunu ve devamsızlık gerekçesini giriniz:");
                if(!reason?.trim()) return;
                const button=alert.querySelector("button") as HTMLButtonElement|null;
                if(button){button.disabled=true;button.textContent="Kaydediliyor…";}
                const r=await fetch("/api/student-card-insights",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({followupId:followup.id,reason})});
                const p=await r.json();
                if(r.ok&&p.ok){alert.remove();window.alert(p.message||"Devamsızlık gerekçesi kaydedildi.");}
                else {if(button){button.disabled=false;button.textContent="Gerekçe Gir";} window.alert(p.error||"Gerekçe kaydedilemedi.");}
              });
              const actionArea=card.querySelector(".studentActions")||card.lastElementChild;
              actionArea?.insertAdjacentElement("beforebegin",alert);
            }
          }
        }catch{}
      }
    }

    const t1=window.setTimeout(()=>void run(),80);
    const t2=window.setTimeout(()=>void run(),700);
    return()=>{cancelled=true;window.clearTimeout(t1);window.clearTimeout(t2);};
  },[]);

  return <style jsx global>{`
    .sciInlineIcon{display:inline-grid;place-items:center;width:20px;height:20px;margin-right:7px;vertical-align:-4px;border-radius:7px;background:#eef5ff;color:#1769e8}.sciInlineIcon svg{width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
    .paymentDue{color:#b66a00!important}.paymentUnknown{color:#64748b!important}
    .sciAbsenceAlert{margin:12px 0 2px;padding:12px 13px;display:flex;align-items:center;justify-content:space-between;gap:12px;border:1px solid #f2c574;border-radius:14px;background:#fff8e8;color:#744600}.sciAbsenceAlert div{min-width:0;display:grid;gap:3px}.sciAbsenceAlert strong{font-size:13px}.sciAbsenceAlert span{font-size:11px;line-height:1.35;color:#8b641f}.sciAbsenceAlert button{flex:none;min-height:36px;padding:0 12px;border:1px solid #eab34f;border-radius:10px;background:#fff;color:#9b5d00;font-weight:900;cursor:pointer}.sciAbsenceAlert button:active{transform:translateY(1px)}.sciAbsenceAlert button:disabled{opacity:.65;cursor:wait}
    @media(max-width:640px){.sciAbsenceAlert{align-items:stretch;flex-direction:column}.sciAbsenceAlert button{width:100%}}
  `}</style>;
}
