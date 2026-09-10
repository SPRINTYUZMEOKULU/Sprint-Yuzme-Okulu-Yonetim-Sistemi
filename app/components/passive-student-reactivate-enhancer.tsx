"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

export default function PassiveStudentReactivateEnhancer(){
  const pathname=usePathname();

  useEffect(()=>{
    if(pathname!=="/ogrenciler/pasif-merkezi")return;
    let stopped=false;

    const enhance=()=>{
      if(stopped)return;
      document.querySelectorAll<HTMLElement>(".pcGrid article").forEach(card=>{
        if(card.querySelector("[data-reactivate-student]"))return;
        const fileLink=card.querySelector<HTMLAnchorElement>('a[href^="/ogrenciler/"]');
        const footer=fileLink?.parentElement;
        const match=fileLink?.getAttribute("href")?.match(/^\/ogrenciler\/([^/?#]+)/);
        if(!footer||!match)return;
        const studentId=decodeURIComponent(match[1]);
        const name=(card.querySelector("h3")?.textContent||"Öğrenci").trim();
        const button=document.createElement("button");
        button.type="button";
        button.dataset.reactivateStudent=studentId;
        button.textContent="Tekrar Aktife Al";
        Object.assign(button.style,{background:"#168254",color:"#fff",border:"0",borderRadius:"10px",fontWeight:"900",cursor:"pointer",minHeight:"38px",padding:"0 14px",fontSize:"11px"});
        button.onclick=async()=>{
          if(!window.confirm(`${name} yeniden aktif öğrenci olarak alınsın mı?`))return;
          const oldText=button.textContent;button.disabled=true;button.textContent="Aktife alınıyor…";
          try{
            const createRes=await fetch("/api/student-status-requests",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({request_type:"activate",student_id:studentId,reason:"Kursiyer yeniden başladı",description:"Pasif Öğrenci Merkezi üzerinden tekrar aktife alma işlemi başlatıldı.",old_status:"passive",new_status:"active"})});
            const created=await createRes.json().catch(()=>({}));
            if(!createRes.ok||!created?.ok){window.alert(created?.error||"Aktife alma talebi oluşturulamadı.");return}
            const requestId=created?.request?.id;
            if(requestId){
              const approveRes=await fetch("/api/approval-center",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:requestId,source:"student_status",action:"approve",review_note:"Pasif Öğrenci Merkezi üzerinden yeniden aktife alındı."})});
              const approved=await approveRes.json().catch(()=>({}));
              if(approveRes.ok&&approved?.ok){window.alert(`${name} tekrar aktif öğrenci olarak alındı.`);window.location.reload();return}
            }
            window.alert("Aktife alma talebi yönetici onayına gönderildi.");window.location.reload();
          }catch{window.alert("Aktife alma işlemi sırasında bağlantı hatası oluştu.")}
          finally{button.disabled=false;button.textContent=oldText}
        };
        footer.appendChild(button);
      });
    };

    enhance();
    const observer=new MutationObserver(enhance);observer.observe(document.body,{childList:true,subtree:true});
    return()=>{stopped=true;observer.disconnect()};
  },[pathname]);

  return null;
}
