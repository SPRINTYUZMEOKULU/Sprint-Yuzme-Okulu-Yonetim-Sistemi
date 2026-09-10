"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type Phase="waiting_start"|"waiting_first_attendance";
type StartingStudent={id:string;name:string;studentNumber:string|null;groupId:string|null;groupName:string;branchName:string;startDate:string|null;phase:Phase;daysUntilStart:number;nextLesson:{date:string;startTime:string;endTime:string;scheduleId:string}|null;guardianName:string|null;};

type ApiResult={ok:boolean;count?:number;waitingToStart?:number;waitingFirstAttendance?:number;students?:StartingStudent[]};

function formatDate(value?:string|null){if(!value)return "—";const d=new Date(`${value}T12:00:00+03:00`);if(Number.isNaN(d.getTime()))return value;return new Intl.DateTimeFormat("tr-TR",{day:"2-digit",month:"short",year:"numeric"}).format(d);}

export default function StartingStudentsPanel(){
 const pathname=usePathname();
 const [students,setStudents]=useState<StartingStudent[]>([]);
 const [loading,setLoading]=useState(false);
 const [open,setOpen]=useState(true);
 const [filter,setFilter]=useState<"all"|Phase>("all");
 const [counts,setCounts]=useState({all:0,waitingStart:0,waitingFirst:0});

 useEffect(()=>{if(pathname!=="/ogrenciler")return;let active=true;async function load(){try{setLoading(true);const response=await fetch("/api/starting-students",{cache:"no-store",credentials:"same-origin"});const result=(await response.json()) as ApiResult;if(active&&response.ok&&result.ok){const list=result.students||[];setStudents(list);setCounts({all:result.count??list.length,waitingStart:result.waitingToStart??list.filter(s=>s.phase==="waiting_start").length,waitingFirst:result.waitingFirstAttendance??list.filter(s=>s.phase==="waiting_first_attendance").length});}}catch{}finally{if(active)setLoading(false);}}void load();return()=>{active=false;};},[pathname]);

 const visible=useMemo(()=>students.filter(s=>filter==="all"||s.phase===filter).slice(0,8),[students,filter]);
 const filteredTotal=filter==="all"?counts.all:filter==="waiting_start"?counts.waitingStart:counts.waitingFirst;
 if(pathname!=="/ogrenciler")return null;

 return <section className="startHub">
  <div className="startHubHead">
   <div className="startHubTitle"><span>İLK DERS OPERASYONU</span><h2>Başlangıç Takip Merkezi</h2><p>Aktif kaydı tamamlanan kursiyerleri, gerçek başlangıç tarihine ve ilk yoklama durumuna göre ayrı takip edin.</p></div>
   <button type="button" className="collapseButton" onClick={()=>setOpen(v=>!v)}><strong>{loading?"…":counts.all}</strong><small>{open?"Listeyi gizle":"Listeyi göster"}</small></button>
  </div>

  <div className="startStats">
   <button type="button" className={filter==="all"?"active":""} onClick={()=>setFilter("all")}><small>Toplam Takip</small><strong>{counts.all}</strong><span>Tüm kursiyerler</span></button>
   <button type="button" className={filter==="waiting_start"?"active":""} onClick={()=>setFilter("waiting_start")}><small>Henüz Başlamadı</small><strong>{counts.waitingStart}</strong><span>Başlangıç tarihi ileride</span></button>
   <button type="button" className={filter==="waiting_first_attendance"?"active":""} onClick={()=>setFilter("waiting_first_attendance")}><small>İlk Yoklama Bekliyor</small><strong>{counts.waitingFirst}</strong><span>Başlangıç tarihi geldi</span></button>
  </div>

  {open?(visible.length?<div className="startGrid">{visible.map(student=>{const next=student.nextLesson;const waiting=student.phase==="waiting_start";return <article key={student.id} className={`startCard ${waiting?"future":"ready"}`}>
   <div className="startAvatar">{student.name.split(" ").slice(0,2).map(x=>x[0]).join("").toLocaleUpperCase("tr-TR")}</div>
   <div className="startBody">
    <div className="startTop"><div><strong>{student.name}</strong><small>{student.studentNumber||"Öğrenci numarası yok"}</small></div><span className={`phaseBadge ${waiting?"future":"ready"}`}>{waiting?"Başlangıç Bekliyor":"İlk Yoklama Bekliyor"}</span></div>
    <div className="startRoute"><b>{student.branchName}</b><span>•</span><span>{student.groupName}</span></div>
    <div className="startInfo">
      <div><small>Başlangıç</small><strong>{formatDate(student.startDate)}</strong>{waiting&&student.daysUntilStart>0?<em>{student.daysUntilStart} gün kaldı</em>:null}</div>
      <div><small>Sıradaki Ders</small><strong>{next?`${formatDate(next.date)} · ${next.startTime}${next.endTime?`–${next.endTime}`:""}`:"Program bulunamadı"}</strong></div>
    </div>
    <div className="startActions">
      <Link className="secondary" href={`/ogrenciler/${student.id}`}>Öğrenci Dosyası <b>›</b></Link>
      {waiting?<button type="button" className="waitingButton" disabled>Başlangıç Tarihi Bekleniyor</button>:<Link className="primary" href={`/kayit-tamamlama/${student.id}?arrival=1${next?`&scheduleId=${encodeURIComponent(next.scheduleId)}&date=${encodeURIComponent(next.date)}`:""}`}>İlk Derse Başlat <b>›</b></Link>}
    </div>
   </div>
  </article>})}</div>:<div className="startEmpty">{loading?"Kursiyerler kontrol ediliyor…":"Bu filtrede kursiyer bulunmuyor."}</div>):null}
  {open&&filteredTotal>8?<div className="startMore">+{filteredTotal-8} kursiyer daha bu grupta bulunuyor.</div>:null}

  <style jsx>{`
  .startHub{max-width:1500px;margin:0 auto 22px;padding:22px;border:1px solid #cfe0f4;border-radius:24px;background:linear-gradient(180deg,#fff 0%,#f8fbff 100%);box-shadow:0 16px 38px rgba(15,42,76,.06)}
  .startHubHead{display:flex;justify-content:space-between;gap:18px;align-items:flex-start}.startHubTitle>span{display:block;color:#1471ed;font-size:11px;font-weight:950;letter-spacing:.15em}.startHubTitle h2{margin:5px 0 5px;color:#10284d;font-size:26px;letter-spacing:-.02em}.startHubTitle p{margin:0;max-width:790px;color:#71839b;font-size:13px;line-height:1.5}.collapseButton{min-width:116px;min-height:76px;border:1px solid #b9d6fb;border-radius:18px;background:#edf6ff;color:#0b63d7;display:grid;place-items:center;align-content:center;gap:3px;cursor:pointer}.collapseButton strong{font-size:26px;line-height:1}.collapseButton small{font-size:10px;font-weight:850}
  .startStats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:18px}.startStats button{text-align:left;padding:14px 15px;border:1px solid #dbe7f4;border-radius:16px;background:#fff;color:#173654;cursor:pointer;transition:.16s ease}.startStats button:hover{transform:translateY(-1px);box-shadow:0 8px 18px rgba(15,42,76,.06)}.startStats button.active{border-color:#2a7df4;box-shadow:0 0 0 3px rgba(42,125,244,.08);background:#f7fbff}.startStats small{display:block;color:#7a8ba1;font-size:10px;font-weight:850}.startStats strong{display:block;margin:3px 0;color:#0d2d55;font-size:23px}.startStats span{color:#6d8097;font-size:11px}
  .startGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:16px}.startCard{display:grid;grid-template-columns:50px 1fr;gap:13px;padding:16px;border:1px solid #dce7f3;border-radius:18px;background:#fff;box-shadow:0 5px 18px rgba(15,42,76,.03)}.startCard.future{border-left:4px solid #f0ad3d}.startCard.ready{border-left:4px solid #1fa66a}.startAvatar{width:50px;height:50px;border-radius:16px;display:grid;place-items:center;background:#eaf3ff;color:#1167d7;font-weight:950}.startBody{min-width:0}.startTop{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}.startTop>div{display:grid;gap:2px}.startTop>div>strong{font-size:15px;color:#10284d}.startTop>div>small{color:#8a99ac;font-size:9px}.phaseBadge{padding:6px 9px;border-radius:999px;font-size:9px;font-weight:950;white-space:nowrap}.phaseBadge.future{background:#fff3dc;color:#a65f00}.phaseBadge.ready{background:#e8f8f0;color:#147a4e}.startRoute{display:flex;gap:6px;flex-wrap:wrap;margin:7px 0 10px;color:#71839b;font-size:11px}.startRoute b{color:#4d6685}.startInfo{display:grid;grid-template-columns:1fr 1.35fr;gap:8px}.startInfo>div{padding:10px 11px;border-radius:12px;background:#f7f9fc}.startInfo small{display:block;color:#8a99ac;font-size:9px;font-weight:850}.startInfo strong{display:block;margin-top:3px;color:#314968;font-size:11px}.startInfo em{display:inline-block;margin-top:5px;padding:3px 6px;border-radius:999px;background:#fff0d2;color:#9b5b00;font-size:9px;font-style:normal;font-weight:850}.startActions{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-top:12px}.startActions :global(a),.startActions button{min-height:44px;padding:0 12px;border-radius:12px;display:flex;align-items:center;justify-content:space-between;text-decoration:none;font-size:11px;font-weight:900}.startActions :global(a.secondary){border:1px solid #cfdef0;background:#fff;color:#173a61}.startActions :global(a.primary){border:1px solid #1269df;background:linear-gradient(135deg,#1674ed 0%,#0d60ce 100%);color:#fff;box-shadow:0 6px 15px rgba(22,116,237,.18)}.waitingButton{border:1px solid #eadab9;background:#fff9ee;color:#9b6a1c;justify-content:center;cursor:not-allowed}.startEmpty{margin-top:16px;padding:24px;border:1px dashed #d7e3f1;border-radius:16px;text-align:center;color:#7a8ba1;font-size:12px}.startMore{margin-top:12px;color:#57708d;font-size:11px;font-weight:850}
  @media(max-width:760px){.startHub{margin:0 14px 16px;padding:16px;border-radius:20px}.startHubHead{align-items:center}.startHubTitle h2{font-size:22px}.startStats{grid-template-columns:1fr}.startGrid{grid-template-columns:1fr}.startCard{grid-template-columns:44px 1fr;padding:13px}.startAvatar{width:44px;height:44px}.startInfo{grid-template-columns:1fr}.startTop{align-items:flex-start}.phaseBadge{white-space:normal;text-align:center}.startActions{grid-template-columns:1fr 1fr}}
  @media(max-width:420px){.startActions{grid-template-columns:1fr}.collapseButton{min-width:92px}.startHubTitle p{display:none}}
  `}</style>
 </section>;
}
