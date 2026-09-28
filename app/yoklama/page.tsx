import Link from "next/link";
import { requireProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import { filterEffectivelyActiveSchedules } from "@/lib/schedules/effective";
import QuickAttendanceClient from "./quick-attendance-client";
import "./session-attendance-nav.css";
export const dynamic="force-dynamic";
const Icon=({name}:{name:"back"|"today"|"month"|"history"})=>{const common={width:20,height:20,viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:1.9,strokeLinecap:"round" as const,strokeLinejoin:"round" as const,"aria-hidden":true};if(name==="back")return <svg {...common}><path d="M15 18l-6-6 6-6"/><path d="M9 12h10"/></svg>;if(name==="today")return <svg {...common}><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M8 3v4M16 3v4M3 10h18"/><path d="M9 15l2 2 4-4"/></svg>;if(name==="month")return <svg {...common}><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M8 3v4M16 3v4M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01M16 18h.01"/></svg>;return <svg {...common}><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/></svg>};
export default async function AttendancePage({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){const params=await searchParams;const profile=await requireProfile(["owner","admin","branch_manager","registration_staff","accounting","coach"]);const organizationId=profile.organization_id;const supabase=await createClient();if(!organizationId)return <main style={{minHeight:"100vh",padding:32,background:"#f4f7fb",color:"#10213a"}}><h1>Yoklama</h1><p>Organizasyon bilgisi bulunamadı.</p><Link href="/">← Yönetim Paneline Dön</Link></main>;
const [branches,groups,schedules,memberships,students,enrollments,compensation,staffAssignments,studentAssignments]=await Promise.all([supabase.from("branches").select("id,name,short_name").eq("organization_id",organizationId).eq("is_active",true).order("name"),supabase.from("training_groups").select("id,branch_id,name,course_type,primary_coach_id,is_active").eq("organization_id",organizationId).eq("is_active",true).order("sort_order"),supabase.from("lesson_schedules").select("id,branch_id,group_id,coach_id,weekday,start_time,end_time,is_active").eq("organization_id",organizationId).eq("is_active",true).order("weekday").order("start_time"),supabase.from("student_group_memberships").select("student_id,group_id,is_active").eq("organization_id",organizationId).eq("is_active",true),supabase.from("students").select("id,first_name,last_name,birth_date,status").eq("organization_id",organizationId).eq("is_deleted",false).order("first_name"),supabase.from("student_enrollments").select("id,student_id,group_id,total_lessons,used_lessons,lesson_weekdays,status").eq("organization_id",organizationId).eq("status","active"),supabase.from("student_compensation_lessons").select("student_id,target_group_id,target_schedule_id,lesson_date,status").eq("organization_id",organizationId).eq("status","planned"),supabase.from("lesson_staff_assignments").select("schedule_id,group_id,coach_id,sort_order,is_active").eq("organization_id",organizationId).eq("is_active",true).order("sort_order"),supabase.from("lesson_student_assignments").select("schedule_id,group_id,student_id,coach_id,is_active").eq("organization_id",organizationId).eq("is_active",true)]);const error=branches.error||groups.error||schedules.error||memberships.error||students.error||enrollments.error||compensation.error||staffAssignments.error||studentAssignments.error;if(error)return <main style={{minHeight:"100vh",padding:32,background:"#f4f7fb",color:"#10213a"}}><h1>Yoklama</h1><div style={{marginTop:18,padding:18,background:"#fff",border:"1px solid #fecaca",borderRadius:14,color:"#991b1b"}}>Veriler yüklenemedi: {error.message}</div></main>;
const effectiveSchedules=filterEffectivelyActiveSchedules(schedules.data||[],branches.data||[],groups.data||[]);
let coachVisibleSchedules=effectiveSchedules;
let coachVisibleGroups=groups.data||[];
let coachVisibleMemberships=memberships.data||[];
if(profile.role==="coach"){
  const {data:coachStaff}=await supabase.from("staff").select("id").eq("organization_id",organizationId).eq("auth_user_id",profile.id).eq("is_active",true).maybeSingle();
  // Operasyon planındaki coach_id alanları profile.id kullanıyor. Personel/puantaj
  // tarafındaki eski veya ek kayıtlar staff.id kullanabildiği için iki kimliği de
  // kabul ediyoruz. Böylece yetkisi açık eğitmenin atanmış seansları boş görünmez.
  const coachIds=new Set([profile.id,coachStaff?.id].filter(Boolean) as string[]);
  if(coachIds.size){
    const assignedRows=(staffAssignments.data||[]).filter((item:any)=>item.coach_id&&coachIds.has(item.coach_id));
    const studentAssignedRows=(studentAssignments.data||[]).filter((item:any)=>item.coach_id&&coachIds.has(item.coach_id));
    const assignedScheduleIds=new Set(assignedRows.map((item:any)=>item.schedule_id).filter(Boolean));
    const assignedGroupIds=new Set(assignedRows.map((item:any)=>item.group_id).filter(Boolean));
    const studentAssignedScheduleIds=new Set(studentAssignedRows.map((item:any)=>item.schedule_id).filter(Boolean));
    const studentAssignedGroupIds=new Set(studentAssignedRows.map((item:any)=>item.group_id).filter(Boolean));
    const studentAssignedIds=new Set(studentAssignedRows.map((item:any)=>item.student_id).filter(Boolean));
    for(const group of groups.data||[]){if(group.primary_coach_id&&coachIds.has(group.primary_coach_id))assignedGroupIds.add(group.id)}
    coachVisibleSchedules=effectiveSchedules.filter((schedule:any)=>(schedule.coach_id&&coachIds.has(schedule.coach_id))||assignedScheduleIds.has(schedule.id)||assignedGroupIds.has(schedule.group_id)||studentAssignedScheduleIds.has(schedule.id)||studentAssignedGroupIds.has(schedule.group_id));
    const visibleGroupIds=new Set(coachVisibleSchedules.map((schedule:any)=>schedule.group_id).filter(Boolean));
    coachVisibleGroups=(groups.data||[]).filter((group:any)=>visibleGroupIds.has(group.id));
    const broadGroupIds=new Set<string>();
    for(const schedule of coachVisibleSchedules as any[]){
      if((schedule.coach_id&&coachIds.has(schedule.coach_id))||assignedScheduleIds.has(schedule.id)||assignedGroupIds.has(schedule.group_id))broadGroupIds.add(schedule.group_id);
    }
    coachVisibleMemberships=(memberships.data||[]).filter((membership:any)=>broadGroupIds.has(membership.group_id)||studentAssignedIds.has(membership.student_id));
  }else{
    coachVisibleSchedules=[];
    coachVisibleGroups=[];
    coachVisibleMemberships=[];
  }
}
return <><nav className="saTopNav" aria-label="Yoklama hızlı erişim"><Link href="/operasyon-plani" className="saTopNavItem"><span className="saTopNavIcon"><Icon name="back"/></span><span><b>Geri</b><small>Operasyon</small></span></Link><Link href="/yoklama" className="saTopNavItem active"><span className="saTopNavIcon"><Icon name="today"/></span><span><b>Bugün</b><small>Günlük yoklama</small></span></Link><Link href="/yoklama/aylik" className="saTopNavItem"><span className="saTopNavIcon"><Icon name="month"/></span><span><b>Tüm Ay</b><small>Aylık görünüm</small></span></Link><Link href="/yoklama/gecmis" className="saTopNavItem"><span className="saTopNavIcon"><Icon name="history"/></span><span><b>Geçmiş</b><small>Ders kayıtları</small></span></Link></nav><QuickAttendanceClient branches={branches.data||[]} groups={coachVisibleGroups} schedules={coachVisibleSchedules} memberships={coachVisibleMemberships} students={students.data||[]} enrollments={enrollments.data||[]} compensationLessons={compensation.data||[]} initialBranchId={params.branchId||""}/></>}
