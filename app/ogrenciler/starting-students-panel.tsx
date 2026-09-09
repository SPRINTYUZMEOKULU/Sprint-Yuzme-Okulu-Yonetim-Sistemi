"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type StartingStudent={
  id:string;
  name:string;
  studentNumber:string|null;
  groupId:string|null;
  groupName:string;
  branchName:string;
  startDate:string|null;
  nextLesson:{date:string;startTime:string;endTime:string;scheduleId:string}|null;
  guardianName:string|null;
};

function formatDate(value?:string|null){
  if(!value)return "—";
  const d=new Date(`${value}T12:00:00+03:00`);
  if(Number.isNaN(d.getTime()))return value;
  return new Intl.DateTimeFormat("tr-TR",{day:"2-digit",month:"short",year:"numeric"}).format(d);
}

export default function StartingStudentsPanel(){
  const pathname=usePathname();
  const [students,setStudents]=useState<StartingStudent[]>([]);
  const [loading,setLoading]=useState(false);
  const [open,setOpen]=useState(true);

  useEffect(()=>{
    if(pathname!=="/ogrenciler")return;
    let active=true;
    async function load(){
      try{
        setLoading(true);
        const response=await fetch("/api/starting-students",{cache:"no-store",credentials:"same-origin"});
        const result=await response.json();
        if(active&&response.ok&&result.ok)setStudents(result.students||[]);
      }catch{}finally{if(active)setLoading(false);}
    }
    void load();
    return()=>{active=false;};
  },[pathname]);

  const upcoming=useMemo(()=>students.slice(0,8),[students]);
  if(pathname!=="/ogrenciler")return null;

  return (
    <section className="startingStudentsPanel">
      <div className="startingStudentsHead">
        <div>
          <span>İLK DERS TAKİBİ</span>
          <h2>Başlayacak Kursiyerler</h2>
          <p>Kesin kaydı tamamlanmış, aktif kaydı bulunan ve henüz ilk yoklama kaydı oluşmamış kursiyerler.</p>
        </div>
        <button type="button" onClick={()=>setOpen(v=>!v)}>
          <strong>{loading?"…":students.length}</strong>
          <small>{open?"Listeyi gizle":"Listeyi göster"}</small>
        </button>
      </div>

      {open ? (
        upcoming.length ? (
          <div className="startingStudentsGrid">
            {upcoming.map((student)=>{
              const next=student.nextLesson;
              return <article key={student.id} className="startingStudentCard">
                <div className="startingAvatar" aria-hidden="true">{student.name.split(" ").slice(0,2).map(x=>x[0]).join("").toLocaleUpperCase("tr-TR")}</div>
                <div className="startingStudentBody">
                  <div className="startingStudentTop"><strong>{student.name}</strong><span>İlk Ders Bekleniyor</span></div>
                  <p>{student.branchName} · {student.groupName}</p>
                  <div className="startingMeta">
                    <span><b>Başlangıç</b>{formatDate(student.startDate)}</span>
                    <span><b>Sıradaki Ders</b>{next?`${formatDate(next.date)} · ${next.startTime}${next.endTime?`–${next.endTime}`:""}`:"Program bulunamadı"}</span>
                  </div>
                  <div className="startingActions">
                    <Link href={`/ogrenciler/${student.id}`}>Öğrenci Dosyası</Link>
                    {next&&student.groupId?<Link className="primary" href={`/yoklama?groupId=${encodeURIComponent(student.groupId)}&scheduleId=${encodeURIComponent(next.scheduleId)}&date=${encodeURIComponent(next.date)}`}>Yoklamaya Git</Link>:null}
                  </div>
                </div>
              </article>;
            })}
          </div>
        ) : (
          <div className="startingEmpty">{loading?"Başlayacak kursiyerler kontrol ediliyor…":"İlk dersini bekleyen kursiyer bulunmuyor."}</div>
        )
      ):null}

      {students.length>8&&open?<div className="startingMore">+{students.length-8} kursiyer daha ilk dersini bekliyor.</div>:null}

      <style jsx>{`
        .startingStudentsPanel{max-width:1500px;margin:0 auto 18px;padding:20px;border:1px solid #cfe0f4;border-radius:22px;background:linear-gradient(180deg,#fff 0%,#f8fbff 100%);box-shadow:0 10px 30px rgba(15,42,76,.05)}
        .startingStudentsHead{display:flex;justify-content:space-between;gap:18px;align-items:flex-start}.startingStudentsHead span{display:block;color:#1471ed;font-size:11px;font-weight:900;letter-spacing:.14em}.startingStudentsHead h2{margin:5px 0 5px;color:#10284d;font-size:24px}.startingStudentsHead p{margin:0;max-width:760px;color:#71839b;font-size:13px;line-height:1.45}.startingStudentsHead button{min-width:112px;min-height:74px;border:1px solid #b9d6fb;border-radius:17px;background:#edf6ff;color:#0b63d7;display:grid;place-items:center;align-content:center;gap:2px;cursor:pointer}.startingStudentsHead button strong{font-size:25px;line-height:1}.startingStudentsHead button small{font-size:10px;font-weight:800}.startingStudentsGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:16px}.startingStudentCard{display:grid;grid-template-columns:48px 1fr;gap:13px;padding:15px;border:1px solid #dce7f3;border-radius:17px;background:#fff}.startingAvatar{width:48px;height:48px;border-radius:15px;display:grid;place-items:center;background:#eaf3ff;color:#1167d7;font-weight:900}.startingStudentTop{display:flex;justify-content:space-between;gap:10px;align-items:center}.startingStudentTop>strong{font-size:15px;color:#10284d}.startingStudentTop>span{padding:5px 8px;border-radius:999px;background:#fff4df;color:#a86400;font-size:10px;font-weight:900;letter-spacing:0}.startingStudentBody>p{margin:5px 0 10px;color:#71839b;font-size:11px}.startingMeta{display:grid;grid-template-columns:1fr 1.4fr;gap:8px}.startingMeta span{padding:8px 9px;border-radius:11px;background:#f7f9fc;color:#314968;font-size:11px;letter-spacing:0}.startingMeta b{display:block;margin-bottom:3px;color:#8a99ac;font-size:9px}.startingActions{display:flex;justify-content:flex-end;gap:8px;margin-top:10px}.startingActions a{display:inline-flex;align-items:center;justify-content:center;min-height:34px;padding:0 11px;border:1px solid #d8e4f2;border-radius:10px;color:#284765;text-decoration:none;font-size:10px;font-weight:900}.startingActions a.primary{border-color:#176de9;background:#176de9;color:#fff}.startingEmpty{margin-top:15px;padding:20px;border:1px dashed #d7e3f1;border-radius:15px;text-align:center;color:#7a8ba1;font-size:12px}.startingMore{margin-top:11px;color:#57708d;font-size:11px;font-weight:800}
        @media(max-width:760px){.startingStudentsPanel{margin:0 14px 16px;padding:16px;border-radius:20px}.startingStudentsHead h2{font-size:21px}.startingStudentsHead p{font-size:12px}.startingStudentsHead button{min-width:88px;min-height:68px}.startingStudentsGrid{grid-template-columns:1fr}.startingStudentCard{grid-template-columns:42px 1fr;padding:13px}.startingAvatar{width:42px;height:42px}.startingStudentTop{align-items:flex-start}.startingStudentTop>span{white-space:nowrap}.startingMeta{grid-template-columns:1fr}.startingActions{justify-content:stretch}.startingActions a{flex:1}.startingStudentsHead{gap:10px}}
      `}</style>
    </section>
  );
}
