import Link from "next/link";
import { requireProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import AttendanceExcelButton from "../attendance-excel-button";
import "../history.css";
import "../history-polish.css";

export const dynamic="force-dynamic";

type AttendanceRow={id:string;student_id:string;group_id:string;branch_id:string;schedule_id:string;lesson_date:string;status:string;coach_note:string|null};
type StudentInfo={name:string;number:string;phone:string;guardianName:string;guardianPhone:string};
type GroupInfo={id:string;branch_id:string|null;name:string|null;course_type:string|null};
type ScheduleInfo={id:string;group_id:string|null;branch_id:string|null;start_time:string|null;end_time:string|null};

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
 const sort=p.sort||"newest";

 const [{data:rows},{data:students},{data:groups},{data:branches},{data:schedules}]=await Promise.all([
  s.from("attendance_records").select("id,student_id,group_id,branch_id,schedule_id,lesson_date,status,coach_note").eq("organization_id",profile.organization_id).order("lesson_date",{ascending:false}).limit(3000),
  s.from("students").select("id,first_name,last_name,student_number,phone,guardian_name,guardian_phone").eq("organization_id",profile.organization_id),
  s.from("training_groups").select("id,branch_id,name,course_type").eq("organization_id",profile.organization_id),
  s.from("branches").select("id,name,short_name").eq("organization_id",profile.organization_id).order("name"),
  s.from("lesson_schedules").select("id,group_id,branch_id,start_time,end_time").eq("organization_id",profile.organization_id)
 ]);

 const attendanceRows=(rows||[]) as AttendanceRow[];
 const groupRows=(groups||[]) as GroupInfo[];
 const scheduleRows=(schedules||[]) as ScheduleInfo[];
 const sm=new Map<string,StudentInfo>((students||[]).map(x=>[x.id,{name:`${x.first_name||""} ${x.last_name||""}`.trim(),number:x.student_number||"",phone:x.phone||"",guardianName:x.guardian_name||"",guardianPhone:x.guardian_phone||""}]));
 const gm=new Map<string,GroupInfo>(groupRows.map(x=>[x.id,x]));
 const bm=new Map<string,string>((branches||[]).map(x=>[x.id,x.short_name||x.name||"Şube"]));
 const scm=new Map<string,ScheduleInfo>(scheduleRows.map(x=>[x.id,x]));
 const branchGroups=groupRows.filter(g=>!branchId||g.branch_id===branchId);
 const availableTimes:string[]=Array.from(new Set<string>(attendanceRows.filter(r=>!branchId||r.branch_id===branchId).map(r=>timeLabel(scm.get(r.schedule_id)?.start_time)).filter((item):item is string=>Boolean(item)))).sort();

 let filtered:AttendanceRow[]=attendanceRows.filter(r=>{
  const rowTime=timeLabel(scm.get(r.schedule_id)?.start_time);
  if(branchId&&r.branch_id!==branchId)return false;
  if(groupId&&r.group_id!==groupId)return false;
  if(status&&r.status!==status)return false;
  if(time&&rowTime!==time)return false;
  if(from&&r.lesson_date<from)return false;
  if(to&&r.lesson_date>to)return false;
  return true;
 });

 filtered=[...filtered].sort((a,b)=>{
  if(sort==="oldest")return String(a.lesson_date).localeCompare(String(b.lesson_date));
  if(sort==="name")return (sm.get(a.student_id)?.name||"").localeCompare(sm.get(b.student_id)?.name||"","tr");
  if(sort==="name-desc")return (sm.get(b.student_id)?.name||"").localeCompare(sm.get(a.student_id)?.name||"","tr");
  return String(b.lesson_date).localeCompare(String(a.lesson_date));
 });

 const dates=new Map<string,AttendanceRow[]>();
 for(const r of filtered){const a=dates.get(r.lesson_date)||[];a.push(r);dates.set(r.lesson_date,a)}
 const exportRows=filtered.map(r=>{const student=sm.get(r.student_id);return{date:tr(r.lesson_date),time:timeLabel(scm.get(r.schedule_id)?.start_time),student:student?.name||"Kursiyer",studentPhone:student?.phone||"",guardian:student?.guardianName||"",guardianPhone:student?.guardianPhone||"",branch:bm.get(r.branch_id)||"Şube",group:gm.get(r.group_id)?.name||"Grup",status:statusLabel(r.status),note:r.coach_note||"",renewal:""}});
 const qs=(extra:Record<string,string>)=>{const q=new URLSearchParams();if(branchId)q.set("branchId",branchId);if(groupId)q.set("groupId",groupId);if(time)q.set("time",time);if(from)q.set("from",from);if(to)q.set("to",to);if(sort)q.set("sort",sort);Object.entries(extra).forEach(([k,v])=>v?q.set(k,v):q.delete(k));return `/yoklama/gecmis?${q.toString()}`};

 return <main className="ahRoot">
  <header className="ahHead"><div><small>SPRINTOS · YOKLAMA</small><h1>Yoklama Geçmişi</h1><p>Geçmiş dersleri şube, grup, saat ve durum bazında filtreleyin; kursiyer dosyasına veya ilgili yoklama gününe tek dokunuşla geçin.</p></div><div className="ahHeadActions"><AttendanceExcelButton rows={exportRows} fileName="sprintos-yoklama-gecmisi" label="Excel Raporu"/><Link href="/yoklama">+ Yeni Yoklama</Link></div></header>

  <nav className="ahTabs" aria-label="Yoklama görünümü"><Link href="/yoklama">Günlük Yoklama</Link><Link href="/yoklama/aylik">Tüm Ay</Link><Link className="active" href="/yoklama/gecmis">Geçmiş</Link></nav>

  <form className="ahFilter ahHistoryFilter">
   <label>Şube<select name="branchId" defaultValue={branchId}><option value="">Tüm Şubeler</option>{(branches||[]).map((b:any)=><option key={b.id} value={b.id}>{b.short_name||b.name}</option>)}</select></label>
   <label>Grup<select name="groupId" defaultValue={groupId}><option value="">Tüm Gruplar</option>{branchGroups.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}</select></label>
   <label>Saat<select name="time" defaultValue={time}><option value="">Tüm Saatler</option>{availableTimes.map(item=><option key={item} value={item}>{item}</option>)}</select></label>
   <label>Durum<select name="status" defaultValue={status}><option value="">Tüm Durumlar</option><option value="present">Katıldı</option><option value="absent">Katılmadı</option><option value="excused">İzinli</option><option value="compensation">Telafi</option></select></label>
   <label>Sıralama<select name="sort" defaultValue={sort}><option value="newest">En yeni → eski</option><option value="oldest">En eski → yeni</option><option value="name">İsim A → Z</option><option value="name-desc">İsim Z → A</option></select></label>
   <label>Başlangıç<input type="date" name="from" defaultValue={from}/></label>
   <label>Bitiş<input type="date" name="to" defaultValue={to}/></label>
   <button>Filtrele</button><Link href="/yoklama/gecmis">Temizle</Link>
  </form>

  <div className="ahHistoryQuick"><Link className={!status?"active":""} href={qs({status:""})}>Tümü</Link><Link className={status==="present"?"active present":"present"} href={qs({status:"present"})}>✓ Katıldı</Link><Link className={status==="absent"?"active absent":"absent"} href={qs({status:"absent"})}>✕ Katılmadı</Link><Link className={status==="excused"?"active excused":"excused"} href={qs({status:"excused"})}>○ İzinli</Link><Link className={status==="compensation"?"active compensation":"compensation"} href={qs({status:"compensation"})}>T Telafi</Link></div>
  <div className="ahHistoryQuick"><Link className={sort==="newest"?"active":""} href={qs({sort:"newest",status})}>↓ En Yeni</Link><Link className={sort==="oldest"?"active":""} href={qs({sort:"oldest",status})}>↑ En Eski</Link><Link className={sort==="name"?"active":""} href={qs({sort:"name",status})}>A–Z</Link><Link className={sort==="name-desc"?"active":""} href={qs({sort:"name-desc",status})}>Z–A</Link></div>
  <div className="ahPeriodHint">{filtered.length} kayıt gösteriliyor · {sort==="oldest"?"en eskiden yeniye":sort==="name"?"isme göre A–Z":sort==="name-desc"?"isme göre Z–A":"en yeniden eskiye"}</div>

  <div className="ahDays">{[...dates.entries()].map(([date,list])=><section className="ahDay" key={date}><header><strong>{tr(date)}</strong><div className="ahDayHeadActions"><span>{list.length} kayıt</span><Link href={`/yoklama?date=${date}`} className="ahDayButton">Bu Güne Git</Link></div></header>{list.map((r,i)=>{const schedule=scm.get(r.schedule_id);const group=gm.get(r.group_id);const student=sm.get(r.student_id);const preferredPhone=student?.guardianPhone||student?.phone||"";return <div className="ahRow ahHistoryRow" key={`${r.id||r.student_id}-${i}`}><div className="ahRowMain"><b>{student?.name||"Kursiyer"}</b><small>{bm.get(r.branch_id)||"Şube"} · {group?.name||"Grup"}{timeLabel(schedule?.start_time)?` · ${timeLabel(schedule?.start_time)}${schedule?.end_time?`–${timeLabel(schedule.end_time)}`:""}`:""}</small>{(student?.phone||student?.guardianPhone)&&<div className="ahPhoneLine">{student?.phone&&<span>Öğrenci: {student.phone}</span>}{student?.guardianPhone&&<span>{student.guardianName?`${student.guardianName}: `:"Veli: "}{student.guardianPhone}</span>}</div>}{r.coach_note&&<span className="ahNoteFlag">Not: {r.coach_note}</span>}<div className="ahInlineActions"><Link href={`/ogrenciler/${r.student_id}`}>Öğrenci Dosyası</Link><Link href={`/yoklama?date=${r.lesson_date}&branchId=${r.branch_id||""}`}>Yoklamayı Aç</Link>{preferredPhone&&<a href={`tel:${phoneDigits(preferredPhone)}`}>Ara</a>}{preferredPhone&&<a href={`https://wa.me/${waPhone(preferredPhone)}`} target="_blank" rel="noreferrer">WhatsApp</a>}</div></div><span className={`st ${r.status}`}>{r.status==="present"?"✓ Katıldı":r.status==="absent"?"✕ Katılmadı":r.status==="excused"?"○ İzinli":"T Telafi"}</span></div>})}</section>)}{!dates.size&&<div className="ahEmpty">Bu filtrelere uygun geçmiş yoklama kaydı bulunamadı.</div>}</div>
 </main>
}
