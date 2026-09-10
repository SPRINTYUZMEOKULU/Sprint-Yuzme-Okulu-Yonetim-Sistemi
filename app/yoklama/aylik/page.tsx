import Link from "next/link";
import { requireProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import AttendancePrintButton from "../print-button";
import "../history.css";

export const dynamic="force-dynamic";
const tr=(v:string)=>new Intl.DateTimeFormat("tr-TR",{day:"2-digit",month:"short",year:"numeric"}).format(new Date(`${v}T12:00:00`));
const monthLabel=(v:string)=>new Intl.DateTimeFormat("tr-TR",{month:"long",year:"numeric"}).format(new Date(`${v}-01T12:00:00`));

export default async function Page({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){
 const p=await searchParams;const profile=await requireProfile(["owner","admin","branch_manager","registration_staff","accounting","coach"]);const s=await createClient();const now=new Date();const month=p.month||`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;const start=`${month}-01`;const d=new Date(`${start}T12:00:00`);d.setMonth(d.getMonth()+1);const end=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-01`;
 const [{data:rows},{data:students},{data:groups},{data:branches}]=await Promise.all([
  s.from("attendance_records").select("student_id,group_id,branch_id,lesson_date,status").eq("organization_id",profile.organization_id).gte("lesson_date",start).lt("lesson_date",end).order("lesson_date",{ascending:false}),
  s.from("students").select("id,first_name,last_name").eq("organization_id",profile.organization_id),s.from("training_groups").select("id,name").eq("organization_id",profile.organization_id),s.from("branches").select("id,name,short_name").eq("organization_id",profile.organization_id)
 ]);
 const sm=new Map((students||[]).map(x=>[x.id,`${x.first_name||""} ${x.last_name||""}`.trim()]));const gm=new Map((groups||[]).map(x=>[x.id,x.name]));const bm=new Map((branches||[]).map(x=>[x.id,x.short_name||x.name]));const byDate=new Map<string,any[]>();for(const r of rows||[]){const a=byDate.get(r.lesson_date)||[];a.push(r);byDate.set(r.lesson_date,a)}
 const stats=(rows||[]).reduce((acc:any,r:any)=>{acc[r.status]=(acc[r.status]||0)+1;return acc},{present:0,absent:0,excused:0,compensation:0});
 return <main className="ahRoot"><header className="ahHead"><div><small>SPRINTOS · YOKLAMA</small><h1>{monthLabel(month)} Yoklama Özeti</h1><p>Aylık yoklama kayıtları ve yazdırılabilir çıktı.</p></div><div className="ahHeadActions"><AttendancePrintButton label="Aylık Çıktı Al"/><Link href="/yoklama">Günlük Yoklama</Link></div></header><form className="ahFilter"><label>Ay<input type="month" name="month" defaultValue={month}/></label><button>Ayı Göster</button><Link href="/yoklama/gecmis">Geçmiş Kayıtlar</Link></form><section className="ahSummary"><div><b>{rows?.length||0}</b><span>Toplam kayıt</span></div><div><b>{stats.present}</b><span>Katıldı</span></div><div><b>{stats.absent}</b><span>Katılmadı</span></div><div><b>{stats.excused}</b><span>İzinli</span></div><div><b>{stats.compensation}</b><span>Telafi</span></div><div><b>{byDate.size}</b><span>Ders günü</span></div></section><div className="ahDays">{[...byDate.entries()].map(([date,list])=><section className="ahDay" key={date}><header><strong>{tr(date)}</strong><span>{list.length} kayıt</span></header>{list.map((r,i)=><div className="ahRow" key={`${r.student_id}-${i}`}><div><b>{sm.get(r.student_id)||"Kursiyer"}</b><small>{bm.get(r.branch_id)||"Şube"} · {gm.get(r.group_id)||"Grup"}</small></div><span className={`st ${r.status}`}>{r.status==="present"?"✓ Katıldı":r.status==="absent"?"✕ Katılmadı":r.status==="excused"?"○ İzinli":"T Telafi"}</span></div>)}</section>)}{!byDate.size&&<div className="ahEmpty">Bu ay için kayıtlı yoklama bulunamadı.</div>}</div></main>
}