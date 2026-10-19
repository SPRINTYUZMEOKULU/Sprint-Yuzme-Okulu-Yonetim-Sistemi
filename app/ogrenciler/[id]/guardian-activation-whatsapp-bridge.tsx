"use client";
import {useEffect} from "react";
export default function GuardianActivationWhatsAppBridge({studentId}:{studentId:string}) {
 useEffect(()=>{
    const openProfileCenter = (event: MouseEvent) => {
      const target = event.target as Element | null;
      const clickable = target?.closest<HTMLElement>("button,a,[role='button']");
      if (!clickable) return;
      if (clickable.matches("[data-open-profile-center='1']")) return;
      const text = clickable.textContent?.replace(/\s+/g, " ").trim().toLocaleLowerCase("tr-TR") || "";
      if (!text.includes("bilgileri düzenle")) return;

      event.preventDefault();
      event.stopPropagation();

      const trigger = document.createElement("button");
      trigger.type = "button";
      trigger.dataset.openProfileCenter = "1";
      trigger.style.display = "none";
      document.body.appendChild(trigger);
      trigger.click();
      trigger.remove();
    };

    document.addEventListener("click", openProfileCenter, true);

    return ()=>document.removeEventListener("click",openProfileCenter,true);
 },[studentId]);
 return null;
}
