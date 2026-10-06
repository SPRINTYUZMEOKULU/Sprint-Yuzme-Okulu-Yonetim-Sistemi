"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { manageEnrollmentStart } from "./enrollment-start-actions";

type Props = {
  studentId:string; enrollmentId:string; startDate:string; referenceDate:string; canManage:boolean;
};

export default function EnrollmentStartControl({studentId,enrollmentId,startDate,referenceDate,canManage}:Props) {
  const router=useRouter();
  const [nextDate,setNextDate]=useState(startDate);
  const [message,setMessage]=useState("");
  const [failed,setFailed]=useState(false);
  const [pending,startTransition]=useTransition();
  useEffect(()=>{setNextDate(startDate)},[startDate]);
  const dateArrived=Boolean(startDate)&&startDate<=referenceDate;
  const dateChanged=nextDate!==startDate;
  function submit(confirm:boolean) {
    setMessage("");setFailed(false);
    startTransition(async()=>{
      try {
        const result=await manageEnrollmentStart({
          studentId,enrollmentId,expectedStartDate:startDate,
          startDate:confirm?referenceDate:nextDate,confirm,
        });
        setMessage(result.message);setFailed(!result.ok);
        if(result.ok)router.refresh();
      } catch {
        setFailed(true);setMessage("Başlangıç işlemi kaydedilemedi. Tekrar deneyin.");
      }
    });
  }
  return <section className="startPanel" onClick={event=>event.stopPropagation()}>
    <div className="startHead"><span className="startIcon" aria-hidden="true">▶</span><div>
      <strong>{dateArrived?"Başlangıç Onayı Bekliyor":"Başlangıç Günü Bekleniyor"}</strong>
      <p>{dateArrived?"Başlat onayı verilene kadar Başlayacak listesinde kalır.":"Planlanan tarih geldiğinde Başlat butonu açılacak."}</p>
    </div></div>
    {canManage&&enrollmentId&&<div className="startControls">
      <label>Planlanan başlangıç<input type="date" aria-label="Planlanan başlangıç tarihi"
        min={referenceDate} value={nextDate} disabled={pending} onChange={event=>setNextDate(event.target.value)}/></label>
      <button type="button" className="changeDate" disabled={pending||!dateChanged||!nextDate||nextDate<referenceDate} onClick={()=>submit(false)}>Tarihi Güncelle</button>
      <button type="button" className="confirmStart" disabled={pending||!dateArrived||dateChanged} onClick={()=>submit(true)}>{pending?"İşleniyor…":"Başlat"}</button>
    </div>}
    {canManage&&dateArrived&&startDate<referenceDate&&<small className="lateNotice">Başlat seçildiğinde başlangıç bugün olarak kaydedilir; bitiş tarihi ders programına göre güncellenir.</small>}
    {message&&<p className={failed?"result error":"result"} role="status">{message}</p>}
    <style jsx>{`
      .startPanel{margin:0 0 14px;padding:13px;border:1px solid #f0cf8a;border-radius:14px;background:#fffaf0;color:#714d08}
      .startHead{display:flex;gap:10px;align-items:flex-start}.startIcon{width:32px;height:32px;flex-shrink:0;display:grid;place-items:center;border-radius:10px;background:#fff0d0;color:#a56800;font-size:12px}
      .startHead strong{font-size:13px}.startHead p{margin:4px 0 0;font-size:11px;line-height:1.4;color:#856b3d}
      .startControls{display:flex;gap:8px;align-items:flex-end;margin-top:11px;flex-wrap:wrap}
      label{display:grid;gap:4px;font-size:10px;font-weight:750;flex:1;min-width:145px}
      input{width:100%;box-sizing:border-box;min-height:40px;padding:7px 9px;border:1px solid #e2d1ac;border-radius:10px;background:#fff;color:#17345c;font:inherit;font-size:12px}
      button{min-height:40px;padding:8px 12px;border:1px solid #dfc58e;border-radius:10px;font-size:11px;font-weight:850;cursor:pointer}
      .changeDate{background:#fff;color:#795515}.confirmStart{background:#176fe8;border-color:#176fe8;color:#fff}
      button:disabled{opacity:.45;cursor:default}.lateNotice{display:block;margin-top:8px;font-size:10px;line-height:1.4}
      .result{margin:10px 0 0;color:#087443;font-size:11px;font-weight:750}.result.error{color:#b42318}
      @media(max-width:600px){.startControls{display:grid;grid-template-columns:1fr 1fr}.startControls label{grid-column:1/-1;min-width:0}button{min-height:44px}}
    `}</style>
  </section>;
}
