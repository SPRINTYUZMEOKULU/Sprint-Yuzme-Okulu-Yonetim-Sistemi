import Link from "next/link";
import { requireProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import AttendancePrintButton from "../print-button";
import AttendanceExcelButton from "../attendance-excel-button";
import HistoricalAttendancePanel from "./historical-attendance-panel";
import "../history.css";
import "../history-polish.css";
import "./historical-attendance-panel.css";

export const dynamic="force-dynamic";
const tr=(v:string)=>new Intl.DateTimeFormat("tr-TR",{day:"2-digit",month:"short",year:"numeric"}).format(new Date(`${v}T12:00:00`));
const trTime=(v?:string|null)=>v?.slice(0,5)||"—";
const monthLabel=(v:string)=>new Intl.DateTimeFormat("tr-TR",{month:"long",year:"numeric"}).format(new Date(`${v}-01T12:00:00`));
const statusLabel=(status?:string|null)=>status==="present"?"Katıldı":status==="absent"?"Katılmadı":status==="excused"?"İzinli":status==="compensation"?"Telafi":"Belirsiz";
const safeSlug=(v:string)=>v.toLocaleLowerCase("tr-TR").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/ı/g,"i").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");

export default async function Page({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){
 const p=await searchParams;
 const profile=await requireProfile(["owner","admin","branch_manager","registration_staff","accounting","coach"]);
 const s=await createClient();
 const now=new Date();
 const month=p.month||`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;
 const branchId=p.branchId||"";
 const time=p.time||"";
 const start=`${month}-01`;
 const d=new Date(`${start}T12:00:00`);d.setMonth(d.getMonth()+1);
 const end=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-01`;

 const [{data:rows},{data:students},{data:groups},{data:branches},{data:schedules},{data:renewals}]=await Promise.all([
  s.from("attendance_records").select("student_id,group_id,branch_id,schedule_id,lesson_date,status,coach_note").eq("organization_id",profile.organization_id).gte("lesson_date",start).lt("lesson_date",end).order("lesson_date",{ascending:false}),
  s.from("students").select("id,first_name,last_name,student_number").eq("organization_id",profile.organization_id),
  s.from("training_groups").select("id,name").eq("organization_id",profile.organization_id),
  s.from("branches").select("id,name,short_name").eq("organization_id",profile.organization_id).order("name"),
  s.from("lesson_schedules").select("id,branch_id,start_time,end_time").eq("organization_id",profile.organization_id),
  s.from("student_renewal_events").select("student_id,renewal_status,note,created_at").eq("organization_id",profile.organization_id).gte("created_at",`${start}T00:00:00+03:00`).lt("created_at",`${end}T00:00:00+03:00`).order("created_at",{ascending:false})
 ]);

 const sm=new Map((students||[]).map(x=>[x.id,{name:`${x.first_name||""} ${x.last_name||""}`.trim(),number:x.student_number||""}]));
 const gm=new Map((groups||[]).map(x=>[x.id,x.name]));
 const bm=new Map((branches||[]).map(x=>[x.id,x.short_name||x.name]));
 const scheduleMap=new Map((schedules||[]).map(x=>[x.id,x]));
 const renewalMap=new Map<string,any>();
 for(const renewal of renewals||[])if(!renewalMap.has(renewal.student_id))renewalMap.set(renewal.student_id,renewal);

 const branchRows=(rows||[]).filter((r:any)=>!branchId||r.branch_id===branchId);
 const times=Array.from(new Set(branchRows.map((r:any)=>trTime(scheduleMap.get(r.schedule_id)?.start_time)).filter(v=>v!=="—"))).sort();
 const filteredRows=branchRows.filter((r:any)=>!time||trTime(scheduleMap.get(r.schedule_id)?.start_time)===time);
 const byDate=new Map<string,any[]>();
 for(const r of filteredRows){const a=byDate.get(r.lesson_date)||[];a.push(r);byDate.set(r.lesson_date,a)}
 const stats=filteredRows.reduce((acc:any,r:any)=>{acc[r.status]=(acc[r.status]||0)+1;return acc},{present:0,absent:0,excused:0,compensation:0});
 const notedCount=filteredRows.filter((r:any)=>String(r.coach_note||"").trim()).length;
 const filteredStudentIds=new Set(filteredRows.map((r:any)=>r.student_id));
 const renewedCount=Array.from(renewalMap.keys()).filter(id=>filteredStudentIds.has(id)).length;
 const selectedBranch=branchId?(bm.get(branchId)||"Seçili Şube"):"Tüm Şubeler";
 const reportTitle=`${branchId?`${selectedBranch} · `:""}${monthLabel(month)} Yoklama Raporu`;
 const exportRows=filteredRows.map((r:any)=>{const renewal=renewalMap.get(r.student_id);return{date:tr(r.lesson_date),time:trTime(scheduleMap.get(r.schedule_id)?.start_time),student:sm.get(r.student_id)?.name||"Kursiyer",branch:bm.get(r.branch_id)||"Şube",group:gm.get(r.group_id)||"Grup",status:statusLabel(r.status),note:r.coach_note||"",renewal:renewal?`Yenilendi · ${tr(String(renewal.created_at).slice(0,10))}${renewal.note?` · ${renewal.note}`:""}`:""}});
 const fileName=`sprintos-${safeSlug(selectedBranch)}-${month}${time?`-${time.replace(":","")}`:""}-yoklama`;

 return <main className="ahRoot">
  <header className="ahHead"><div><small>SPRINTOS · YOKLAMA RAPORLARI</small><h1>{reportTitle}</h1><p>Şube, saat ve ay bazında yoklama; antrenör notları ve kayıt yenileme hareketleri tek raporda.</p></div><div className="ahHeadActions"><AttendanceExcelButton rows={exportRows} fileName={fileName} label="Excel Raporu"/><AttendancePrintButton label="Yazdır / PDF"/></div></header>
  <nav className="ahTabs" aria-label="Yoklama görünümü"><Link href="/yoklama">Günlük Yoklama</Link><Link className="active" href={`/yoklama/aylik?month=${month}${branchId?`&branchId=${branchId}`:""}`}>Tüm Ay</Link><Link href="/yoklama/gecmis">Geçmiş Kayıtlar</Link></nav>

  <HistoricalAttendancePanel month={month}/>

  <form className="ahFilter ahReportFilter">
   <label>Ay<input type="month" name="month" defaultValue={month}/></label>
   <label>Şube<select name="branchId" defaultValue={branchId}><option value="">Tüm Şubeler</option>{(branches||[]).map((b:any)=><option key={b.id} value={b.id}>{b.short_name||b.name}</option>)}</select></label>
   <label>Saat<select name="time" defaultValue={time}><option value="">Tüm Saatler</option>{times.map(item=><option key={item} value={item}>{item}</option>)}</select></label>
   <button>Raporu Getir</button>
   <Link href={`/yoklama/aylik?month=${month}`}>Filtreleri Temizle</Link>
  </form>

  <div className="ahPeriodHint">{selectedBranch} · {monthLabel(month)}{time?` · ${time} seansı`:" · Tüm saatler"} · {filteredRows.length} yoklama kaydı</div>
  <section className="ahSummary ahSummaryExtended">
   <div><b>{filteredRows.length}</b><span>Toplam kayıt</span></div><div><b>{stats.present}</b><span>Katıldı</span></div><div><b>{stats.absent}</b><span>Katılmadı</span></div><div><b>{stats.excused}</b><span>İzinli</span></div><div><b>{stats.compensation}</b><span>Telafi</span></div><div><b>{byDate.size}</b><span>Ders günü</span></div><div><b>{notedCount}</b><span>Notlu yoklama</span></div><div><b>{renewedCount}</b><span>Kayıt yenilendi</span></div>
  </section>

  <div className="ahDays">{[...byDate.entries()].map(([date,list])=><section className="ahDay" key={date}><header><strong>{tr(date)}</strong><span>{list.length} kayıt</span></header>{list.map((r:any,i:number)=>{const schedule=scheduleMap.get(r.schedule_id);const renewal=renewalMap.get(r.student_id);return <div className="ahRow ahRichRow" key={`${r.student_id}-${r.schedule_id||"x"}-${i}`}><div className="ahRowMain"><b>{sm.get(r.student_id)?.name||"Kursiyer"}</b><small>{bm.get(r.branch_id)||"Şube"} · {gm.get(r.group_id)||"Grup"} · {trTime(schedule?.start_time)}{schedule?.end_time?`–${trTime(schedule.end_time)}`:""}</small><div className="ahRecordFlags">{r.coach_note&&<span className="ahNoteFlag">Not: {r.coach_note}</span>}{renewal&&<span className="ahRenewalFlag">✓ Kayıt yenilendi · {tr(String(renewal.created_at).slice(0,10))}</span>}</div></div><span className={`st ${r.status}`}>{r.status==="present"?"✓ Katıldı":r.status==="absent"?"✕ Katılmadı":r.status==="excused"?"○ İzinli":"T Telafi"}</span></div>})}</section>)}{!byDate.size&&<div className="ahEmpty">Bu filtrelere uygun yoklama kaydı bulunamadı.</div>}</div>
 </main>
}
