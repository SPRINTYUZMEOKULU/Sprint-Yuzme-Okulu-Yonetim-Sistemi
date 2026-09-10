import Link from "next/link";
import { requireProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import AttendanceExcelButton from "../attendance-excel-button";
import "../history.css";
import "../history-polish.css";

export const dynamic="force-dynamic";
const tr=(v:string)=>new Intl.DateTimeFormat("tr-TR",{day:"2-digit",month:"short",year:"numeric"}).format(new Date(`${v}T12:00:00`));
const statusLabel=(status?:string|null)=>status==="present"?"Katıldı":status==="absent"?"Katılmadı":status==="excused"?"İzinli":status==="compensation"?"Telafi":"Belirsiz";
const timeLabel=(v?:string|null)=>v?.slice(0,5)||"";
const phoneDigits=(v?:string|null)=>String(v||"").replace(/\D/g,"");
const waPhone=(v?:string|null)=>{let d=phoneDigits(v);if(d.startsWith("0"))d=`90${d.slice(1)}`;else if(d.length===10)d=`90${d}`;return d};

export default async function Page({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){
 const p=await searchParams;
 const profile=await requireProfile(["owner","admin","branch_manager","registration_staff","accounting","coach"]);
 const s=await createClient();
 const branchId=p.branchId||"";
 const groupId=p.groupId||"";
 const status=p.status||"";
 const time=p.time||"";
 const from=p.from||"";
 const to=p.to||"";

 const [{data:rows},{data:students},{data:groups},{data:branches},{data:schedules}]=await Promise.all([
  s.from("attendance_records").select("id,student_id,group_id,branch_id,schedule_id,lesson_date,status,coach_note").eq("organization_id",profile.organization_id).order("lesson_date",{ascending:false}).limit(3000),
  s.from("students").select("id,first_name,last_name,student_number,phone,guardian_name,guardian_phone").eq("organization_id",profile.organization_id),
  s.from("training_groups").select("id,branch_id,name,course_type").eq("organization_id",profile.organization_id),
  s.from("branches").select("id,name,short_name").eq("organization_id",profile.organization_id).order("name"),
  s.from("lesson_schedules").select("id,group_id,branch_id,start_time,end_time").eq("organization_id",profile.organization_id)
 ]);

 const sm=new Map((students||[]).map(x=>[x.id,{name:`${x.first_name||""} ${x.last_name||""}`.trim(),number:x.student_number||"",phone:x.phone||"",guardianName:x.guardian_name||"",guardianPhone:x.guardian_phone||""}]));
 const gm=new Map((groups||[]).map(x=>[x.id,x]));
 const bm=new Map((branches||[]).map(x=>[x.id,x.short_name||x.name]));
 const scm=new Map((schedules||[]).map(x=>[x.id,x]));
 const branchGroups=(groups||[]).filter((g:any)=>!branchId||g.branch_id===branchId);
 const availableTimes=Array.from(new Set((rows||[]).filter((r:any)=>!branchId||r.branch_id===branchId).map((r:any)=>timeLabel(scm.get(r.schedule_id)?.start_time)).filter(Boolean))).sort();

 const filtered=(rows||[]).filter((r:any)=>{
  const rowTime=timeLabel(scm.get(r.schedule_id)?.start_time);
  if(branchId&&r.branch_id!==branchId)return false;
  if(groupId&&r.group_id!==groupId)return false;
  if(status&&r.status!==status)return false;
  if(time&&rowTime!==time)return false;
  if(from&&r.lesson_date<from)return false;
  if(to&&r.lesson_date>to)return false;
  return true;
 });

 const dates=new Map<string,any[]>();
 for(const r of filtered){const a=dates.get(r.lesson_date)||[];a.push(r);dates.set(r.lesson_date,a)}
 const exportRows=filtered.map((r:any)=>{const student=sm.get(r.student_id);return{date:tr(r.lesson_date),time:timeLabel(scm.get(r.schedule_id)?.start_time),student:student?.name||"Kursiyer",studentPhone:student?.phone||"",guardian:student?.guardianName||"",guardianPhone:student?.guardianPhone||"",branch:bm.get(r.branch_id)||"Şube",group:gm.get(r.group_id)?.name||"Grup",status:statusLabel(r.status),note:r.coach_note||"",renewal:""}});

 return <main className="ahRoot">
  <header className="ahHead"><div><small>SPRINTOS · YOKLAMA</small><h1>Yoklama Geçmişi</h1><p>Geçmiş dersleri şube, grup, saat ve durum bazında filtreleyin; kursiyer dosyasına veya ilgili yoklama gününe tek dokunuşla geçin.</p></div><div className="ahHeadActions"><AttendanceExcelButton rows={exportRows} fileName="sprintos-yoklama-gecmisi" label="Excel Raporu"/><Link href="/yoklama">+ Yeni Yoklama</Link></div></header>

  <nav className="ahTabs" aria-label="Yoklama görünümü"><Link href="/yoklama">Günlük Yoklama</Link><Link href="/yoklama/aylik">Tüm Ay</Link><Link className="active" href="/yoklama/gecmis">Geçmiş</Link></nav>

  <form className="ahFilter ahHistoryFilter">
   <label>Şube<select name="branchId" defaultValue={branchId}><option value="">Tüm Şubeler</option>{(branches||[]).map((b:any)=><option key={b.id} value={b.id}>{b.short_name||b.name}</option>)}</select></label>
   <label>Grup<select name="groupId" defaultValue={groupId}><option value="">Tüm Gruplar</option>{branchGroups.map((g:any)=><option key={g.id} value={g.id}>{g.name}</option>)}</select></label>
   <label>Saat<select name="time" defaultValue={time}><option value="">Tüm Saatler</option>{availableTimes.map(item=><option key={item} value={item}>{item}</option>)}</select></label>
   <label>Durum<select name="status" defaultValue={status}><option value="">Tüm Durumlar</option><option value="present">Katıldı</option><option value="absent">Katılmadı</option><option value="excused">İzinli</option><option value="compensation">Telafi</option></select></label>
   <label>Başlangıç<input type="date" name="from" defaultValue={from}/></label>
   <label>Bitiş<input type="date" name="to" defaultValue={to}/></label>
   <button>Filtrele</button><Link href="/yoklama/gecmis">Temizle</Link>
  </form>

  <div className="ahHistoryQuick"><Link href="/yoklama">Bugünün Yoklaması</Link><Link href="/yoklama/aylik">Aylık Rapor</Link><Link href="/yoklama/gecmis?status=absent">Katılmayanlar</Link><Link href="/yoklama/gecmis?status=excused">İzinliler</Link></div>
  <div className="ahPeriodHint">{filtered.length} kayıt gösteriliyor · tarih sırasına göre en yeniden eskiye</div>

  <div className="ahDays">{[...dates.entries()].map(([date,list])=><section className="ahDay" key={date}><header><strong>{tr(date)}</strong><div className="ahDayHeadActions"><span>{list.length} kayıt</span><Link href={`/yoklama?date=${date}`} className="ahDayButton">Bu Güne Git</Link></div></header>{list.map((r:any,i:number)=>{const schedule=scm.get(r.schedule_id);const group=gm.get(r.group_id);const student=sm.get(r.student_id);const preferredPhone=student?.guardianPhone||student?.phone||"";return <div className="ahRow ahHistoryRow" key={`${r.id||r.student_id}-${i}`}><div className="ahRowMain"><b>{student?.name||"Kursiyer"}</b><small>{bm.get(r.branch_id)||"Şube"} · {group?.name||"Grup"}{timeLabel(schedule?.start_time)?` · ${timeLabel(schedule.start_time)}${schedule?.end_time?`–${timeLabel(schedule.end_time)}`:""}`:""}</small>{(student?.phone||student?.guardianPhone)&&<div className="ahPhoneLine">{student?.phone&&<span>Öğrenci: {student.phone}</span>}{student?.guardianPhone&&<span>{student.guardianName?`${student.guardianName}: `:"Veli: "}{student.guardianPhone}</span>}</div>}{r.coach_note&&<span className="ahNoteFlag">Not: {r.coach_note}</span>}<div className="ahInlineActions"><Link href={`/ogrenciler/${r.student_id}`}>Öğrenci Dosyası</Link><Link href={`/yoklama?date=${r.lesson_date}&branchId=${r.branch_id||""}`}>Yoklamayı Aç</Link>{preferredPhone&&<a href={`tel:${phoneDigits(preferredPhone)}`}>Ara</a>}{preferredPhone&&<a href={`https://wa.me/${waPhone(preferredPhone)}`} target="_blank" rel="noreferrer">WhatsApp</a>}</div></div><span className={`st ${r.status}`}>{r.status==="present"?"✓ Katıldı":r.status==="absent"?"✕ Katılmadı":r.status==="excused"?"○ İzinli":"T Telafi"}</span></div>})}</section>)}{!dates.size&&<div className="ahEmpty">Bu filtrelere uygun geçmiş yoklama kaydı bulunamadı.</div>}</div>
 </main>
}
