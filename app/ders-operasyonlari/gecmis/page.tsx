import Link from "next/link";
import { requireProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import { buildCancellationHistory } from "@/lib/lesson-operations/history";
import HistoryClient from "./history-client";
export const dynamic="force-dynamic";
export default async function CancellationHistoryPage(){
 const profile=await requireProfile(["owner","admin","branch_manager","registration_staff"]);
 const db=await createClient(),org=profile.organization_id;
 if(!org)return <main>Organizasyon bilgisi bulunamadı.</main>;
 const since=new Date(Date.now()-30*86400000).toISOString();
 const [logs,messages,schedules,groups]=await Promise.all([
  db.from("student_activity_logs").select("id,student_id,activity_type,description,old_value,new_value,source_id,performed_at").eq("organization_id",org).in("activity_type",["lesson_cancellation_compensation","lesson_cancellation_skipped"]).gte("performed_at",since).order("performed_at",{ascending:false}).limit(1000),
  db.from("message_logs").select("student_id,message_body,recipient,status,sent_at,prepared_at,metadata").eq("organization_id",org).eq("template_key","lesson_cancellation_compensation").gte("prepared_at",since).order("prepared_at",{ascending:false}).limit(1000),
  db.from("lesson_schedules").select("id,group_id,start_time").eq("organization_id",org),
  db.from("training_groups").select("id,name").eq("organization_id",org),
 ]);
 const error=logs.error||messages.error||schedules.error||groups.error;
 if(error)return <main style={{padding:24}}><Link href="/ders-operasyonlari">Ders İptali / Telafi</Link><p role="alert">İşlem geçmişi yüklenemedi. Lütfen yeniden deneyin.</p></main>;
 const ids=[...new Set((logs.data||[]).map(l=>l.student_id))];
 const names=new Map<string,string>();
 for(let offset=0;offset<ids.length;offset+=100){
  const students=await db.from("students").select("id,first_name,last_name").eq("organization_id",org).in("id",ids.slice(offset,offset+100));
  if(students.error)return <main style={{padding:24}}>Kursiyer adları yüklenemedi. Lütfen yeniden deneyin.</main>;
  for(const s of students.data||[])names.set(s.id,`${s.first_name||""} ${s.last_name||""}`.trim());
 }
 const sessions=buildCancellationHistory(logs.data||[],messages.data||[],names,new Map((schedules.data||[]).map(s=>[s.id,s])),new Map((groups.data||[]).map(g=>[g.id,g.name])));
 return <HistoryClient sessions={sessions} truncated={(logs.data||[]).length>=1000||(messages.data||[]).length>=1000}/>;
}
