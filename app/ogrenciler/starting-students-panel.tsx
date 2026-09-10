"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

type Phase="waiting_start"|"waiting_first_attendance";
type StartingStudent={id:string;name:string;studentNumber:string|null;groupId:string|null;groupName:string;branchName:string;startDate:string|null;phase:Phase;daysUntilStart:number;nextLesson:{date:string;startTime:string;endTime:string;scheduleId:string}|null;guardianName:string|null;};
type ApiResult={ok:boolean;count?:number;waitingToStart?:number;waitingFirstAttendance?:number;students?:StartingStudent[]};

export default function StartingStudentsPanel(){
 const pathname=usePathname();
 const [loading,setLoading]=useState(false);
 const [counts,setCounts]=useState({all:0,waitingStart:0,waitingFirst:0});

 useEffect(()=>{
  if(pathname!=="/ogrenciler")return;
  let active=true;
  async function load(){
   try{
    setLoading(true);
    const response=await fetch("/api/starting-students",{cache:"no-store",credentials:"same-origin"});
    const result=(await response.json()) as ApiResult;
    if(active&&response.ok&&result.ok){
     const list=result.students||[];
     setCounts({
      all:result.count??list.length,
      waitingStart:result.waitingToStart??list.filter(s=>s.phase==="waiting_start").length,
      waitingFirst:result.waitingFirstAttendance??list.filter(s=>s.phase==="waiting_first_attendance").length,
     });
    }
   }catch{}finally{if(active)setLoading(false);}
  }
  void load();
  return()=>{active=false;};
 },[pathname]);

 if(pathname!=="/ogrenciler")return null;

 return <section className="startHubCompact">
  <div className="startHubIntro">
   <span>BAŞLANGIÇ OPERASYONU</span>
   <div><h2>İlk Ders Takibi</h2><p>Henüz başlamayanları ve ilk yoklaması bekleyen kursiyerleri ayrı merkezden yönetin.</p></div>
  </div>

  <div className="startHubMetrics" aria-label="Başlangıç takip özeti">
   <div><small>Toplam Takip</small><strong>{loading?"…":counts.all}</strong></div>
   <div className="future"><small>Başlangıç Bekliyor</small><strong>{loading?"…":counts.waitingStart}</strong></div>
   <div className="ready"><small>İlk Yoklama Bekliyor</small><strong>{loading?"…":counts.waitingFirst}</strong></div>
  </div>

  <div className="startHubActions">
   <Link className="primary" href="/baslayacak-kursiyerler">Başlangıç Merkezini Aç <b>→</b></Link>
   {counts.waitingFirst>0?<Link href="/baslayacak-kursiyerler?filter=today#kursiyer-listesi">Bugünkü İlk Dersler</Link>:null}
  </div>

  <style jsx>{`
   .startHubCompact{max-width:1500px;margin:0 auto 18px;padding:16px 18px;border:1px solid #cfe0f4;border-radius:20px;background:#fff;display:grid;grid-template-columns:minmax(290px,1.25fr) minmax(420px,1fr) auto;gap:18px;align-items:center;box-shadow:0 10px 26px rgba(15,42,76,.045)}
   .startHubIntro{display:flex;align-items:center;gap:14px;min-width:0}.startHubIntro>span{flex:0 0 auto;padding:7px 9px;border-radius:9px;background:#edf5ff;color:#1471ed;font-size:9px;font-weight:950;letter-spacing:.11em}.startHubIntro h2{margin:0;color:#10284d;font-size:20px;letter-spacing:-.02em}.startHubIntro p{margin:4px 0 0;color:#71839b;font-size:11px;line-height:1.4}
   .startHubMetrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.startHubMetrics>div{min-height:62px;padding:10px 12px;border:1px solid #dde8f4;border-radius:13px;background:#f8fbff}.startHubMetrics small{display:block;color:#7d8fa5;font-size:9px;font-weight:850}.startHubMetrics strong{display:block;margin-top:4px;color:#15375f;font-size:22px;line-height:1}.startHubMetrics .future{background:#fffaf0;border-color:#f3dfb6}.startHubMetrics .future strong{color:#a56500}.startHubMetrics .ready{background:#f0fbf6;border-color:#c9ead9}.startHubMetrics .ready strong{color:#168253}
   .startHubActions{display:grid;gap:7px;min-width:190px}.startHubActions :global(a){min-height:40px;padding:0 13px;border:1px solid #d2dfef;border-radius:11px;display:flex;align-items:center;justify-content:space-between;gap:10px;text-decoration:none;color:#173a61;font-size:11px;font-weight:900;white-space:nowrap}.startHubActions :global(a.primary){background:linear-gradient(135deg,#1674ed,#0d60ce);border-color:#1269df;color:#fff;box-shadow:0 6px 15px rgba(22,116,237,.16)}
   @media(max-width:1050px){.startHubCompact{grid-template-columns:1fr}.startHubActions{grid-template-columns:1fr 1fr;min-width:0}}
   @media(max-width:760px){.startHubCompact{margin:0 14px 14px;padding:14px}.startHubIntro{align-items:flex-start;flex-direction:column;gap:8px}.startHubMetrics{grid-template-columns:repeat(3,1fr)}.startHubActions{grid-template-columns:1fr}.startHubIntro p{font-size:10px}}
   @media(max-width:460px){.startHubMetrics{grid-template-columns:1fr 1fr}.startHubMetrics>div:first-child{grid-column:1/-1}}
  `}</style>
 </section>;
}
