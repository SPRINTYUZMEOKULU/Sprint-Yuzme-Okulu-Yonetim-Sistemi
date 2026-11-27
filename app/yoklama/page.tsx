import { attendanceRoster } from "@/lib/attendance/roster";
import { formatDisplayDate } from "@/lib/dates/display";
import { isLessonDate, loadPersonnelSessions } from "@/lib/personnel/sessions";
import DevelopmentReportButton from "./development-report-button";
import Link from "next/link";
import { attendanceOperationsDb } from "@/lib/attendance/operations-db";
import { reportStudentScope } from "@/lib/attendance/development-report";
import { coachStudentScope } from "@/lib/attendance/coach-roster";
import AttendanceBackButton from "./attendance-back-button";
import { requireProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import { filterEffectivelyActiveSchedules } from "@/lib/schedules/effective";
import QuickAttendanceClient from "./quick-attendance-client";
import "./session-attendance-nav.css";
export const dynamic="force-dynamic";
const Icon=({name}:{name:"back"|"today"|"month"|"history"})=>{const common={width:20,height:20,viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:1.9,strokeLinecap:"round" as const,strokeLinejoin:"round" as const,"aria-hidden":true};if(name==="back")return <svg {...common}><path d="M15 18l-6-6 6-6"/><path d="M9 12h10"/></svg>;if(name==="today")return <svg {...common}><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M8 3v4M16 3v4M3 10h18"/><path d="M9 15l2 2 4-4"/></svg>;if(name==="month")return <svg {...common}><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M8 3v4M16 3v4M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01M16 18h.01"/></svg>;return <svg {...common}><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/></svg>};
export default async function AttendancePage({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){const params=await searchParams;const todayDate=new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Istanbul",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());const attendanceDate=params.date||todayDate;const profile=await requireProfile(["owner","admin","branch_manager","registration_staff","accounting","coach"]);const organizationId=profile.organization_id;const supabase=await createClient();if(!organizationId||!profile.is_active)return <main style={{minHeight:"100vh",padding:32,background:"#f4f7fb",color:"#10213a"}}><h1>Yoklama</h1><p>Organizasyon bilgisi bulunamadı.</p><Link href="/">← Yönetim Paneline Dön</Link></main>;
const [branches,groups,schedules,memberships,students,enrollments,compensation,staffAssignments,studentAssignments]=await Promise.all([supabase.from("branches").select("id,name,short_name").eq("organization_id",organizationId).eq("is_active",true).order("name"),supabase.from("training_groups").select("id,branch_id,name,course_type,primary_coach_id,is_active").eq("organization_id",organizationId).eq("is_active",true).order("sort_order"),supabase.from("lesson_schedules").select("id,branch_id,group_id,coach_id,weekday,start_time,end_time,is_active,makeup_date").eq("organization_id",organizationId).or("is_active.eq.true,makeup_date.not.is.null").order("weekday").order("start_time"),supabase.from("student_group_memberships").select("student_id,group_id,is_active").eq("organization_id",organizationId).eq("is_active",true),supabase.from("students").select("id,first_name,last_name,birth_date,status").eq("organization_id",organizationId).eq("is_deleted",false).order("first_name"),supabase.from("student_enrollments").select("id,student_id,group_id,total_lessons,used_lessons,lesson_weekdays,status,start_date,planned_end_date,created_at,updated_at,start_confirmation_required,actual_started_at,freeze_start_date,freeze_resume_date,freeze_restart_pending").eq("organization_id",organizationId).in("status",["active","scheduled"]).order("created_at",{ascending:false}),supabase.from("student_compensation_lessons").select("student_id,enrollment_id,target_group_id,target_schedule_id,lesson_date,status").eq("organization_id",organizationId).in("status",["planned","completed"]),supabase.from("lesson_staff_assignments").select("schedule_id,group_id,coach_id,sort_order,is_active").eq("organization_id",organizationId).eq("is_active",true).order("sort_order"),supabase.from("lesson_student_assignments").select("schedule_id,group_id,student_id,coach_id,is_active").eq("organization_id",organizationId).eq("is_active",true)]);const error=branches.error||groups.error||schedules.error||memberships.error||students.error||enrollments.error||compensation.error||staffAssignments.error||studentAssignments.error;if(error)return <main style={{minHeight:"100vh",padding:32,background:"#f4f7fb",color:"#10213a"}}><h1>Yoklama</h1><div style={{marginTop:18,padding:18,background:"#fff",border:"1px solid #fecaca",borderRadius:14,color:"#991b1b"}}>Veriler yüklenemedi: {error.message}</div></main>;
const bookedScheduleIds = new Set((compensation.data||[]).map(row=>row.target_schedule_id));
const visibleSchedules = (schedules.data||[]).filter(row=>!row.makeup_date || bookedScheduleIds.has(row.id));
const effectiveSchedules=filterEffectivelyActiveSchedules(visibleSchedules.map(row=>row.makeup_date?{...row,is_active:true}:row),branches.data||[],groups.data||[]);
let allowedStudentIdsBySchedule:Record<string,string[]>|undefined;
let coachVisibleSchedules=effectiveSchedules;
let coachVisibleGroups=groups.data||[];
let coachVisibleMemberships=memberships.data||[];
const { data: coachStaff } = profile.base_role === "coach"
  ? await supabase.from("staff").select("id").eq("organization_id", organizationId).eq("auth_user_id", profile.id)
    .eq("is_active", true).eq("login_enabled", true).maybeSingle()
  : { data: null };
const requestedStaffId = params.personel;
let selectedStaff: { id: string; auth_user_id: string | null; first_name: string; last_name: string } | null = null;
if (requestedStaffId && profile.is_active && ["owner", "admin"].includes(profile.base_role)) {
  const db = attendanceOperationsDb();
  const result = await db.from("staff").select("id,auth_user_id,first_name,last_name")
    .eq("organization_id", organizationId).eq("id", requestedStaffId).eq("is_active", true).maybeSingle();
  selectedStaff = result.data;
  if (!selectedStaff) return <main><h1>Yoklama</h1><p>Personel kaydı bulunamadı.</p><Link href="/personel-puantaj">Personel Listesi</Link></main>;
}
const useOwnRoster = requestedStaffId && coachStaff?.id === requestedStaffId;
const scopedAttendance = Boolean(selectedStaff || useOwnRoster || (profile.role === "coach" && !profile.is_super_user));
const coachIds = new Set((selectedStaff ? [selectedStaff.auth_user_id, selectedStaff.id] : [profile.id, coachStaff?.id]).filter(Boolean) as string[]);
let reportScope: Record<string, string[] | null> | undefined;
if (coachStaff && profile.is_active) {
  const studentIds = (students.data || []).map((student) => student.id);
  const primaryCoaches = new Map((groups.data || []).map((group) => [group.id, group.primary_coach_id]));
  reportScope = Object.fromEntries(effectiveSchedules.map((schedule) => [
    schedule.id,
    reportStudentScope(schedule, primaryCoaches.get(schedule.group_id), staffAssignments.data || [],
      studentAssignments.data || [], coachIds, studentIds) ?? null,
  ]));
}
if(scopedAttendance){
  if(coachIds.size){
    const assignedRows=(staffAssignments.data||[]).filter((item:any)=>item.coach_id&&coachIds.has(item.coach_id));
    const studentAssignedRows=(studentAssignments.data||[]).filter((item:any)=>item.coach_id&&coachIds.has(item.coach_id));
    const assignedScheduleIds=new Set(assignedRows.map((item:any)=>item.schedule_id).filter(Boolean));
    const assignedGroupIds=new Set(assignedRows.filter((item:any)=>!item.schedule_id).map((item:any)=>item.group_id).filter(Boolean));
    const studentAssignedScheduleIds=new Set(studentAssignedRows.map((item:any)=>item.schedule_id).filter(Boolean));
    const studentAssignedGroupIds=new Set(studentAssignedRows.filter((item:any)=>!item.schedule_id).map((item:any)=>item.group_id).filter(Boolean));
    for(const group of groups.data||[]){if(group.primary_coach_id&&coachIds.has(group.primary_coach_id))assignedGroupIds.add(group.id)}
    coachVisibleSchedules=effectiveSchedules.filter((schedule:any)=>(schedule.coach_id&&coachIds.has(schedule.coach_id))||assignedScheduleIds.has(schedule.id)||assignedGroupIds.has(schedule.group_id)||studentAssignedScheduleIds.has(schedule.id)||studentAssignedGroupIds.has(schedule.group_id));
    if ((selectedStaff || useOwnRoster) && params.scheduleId) {
      coachVisibleSchedules = coachVisibleSchedules.filter((schedule) => schedule.id === params.scheduleId);
    }
    const visibleGroupIds=new Set(coachVisibleSchedules.map((schedule:any)=>schedule.group_id).filter(Boolean));
    coachVisibleGroups=(groups.data||[]).filter((group:any)=>visibleGroupIds.has(group.id));
    allowedStudentIdsBySchedule={};
    for(const schedule of coachVisibleSchedules as any[]){
      const broad=(schedule.coach_id&&coachIds.has(schedule.coach_id))||assignedScheduleIds.has(schedule.id)||assignedGroupIds.has(schedule.group_id);
      const allowed=coachStudentScope(studentAssignments.data||[],schedule.id,schedule.group_id,coachIds,Boolean(broad),(students.data||[]).map(student=>student.id));
      if(allowed)allowedStudentIdsBySchedule[schedule.id]=allowed;
    }

  }else{
    coachVisibleSchedules=[];
    coachVisibleGroups=[];
    coachVisibleMemberships=[];
  }
}
const cancellations: Record<string, string[]> = {};
const cancellationDb = attendanceOperationsDb();
const visibleScheduleIds = coachVisibleSchedules.map((schedule) => schedule.id);
for (let offset = 0; visibleScheduleIds.length > 0; offset += 500) {
  const result = await cancellationDb.from("student_activity_logs")
    .select("id,student_id,source_id,cancelled_date:old_value->>cancelled_lesson_date")
    .eq("organization_id", organizationId).eq("activity_type", "lesson_cancellation_compensation")
    .in("source_id", visibleScheduleIds).order("id").range(offset, offset + 499);
  if (result.error) return <main><h1>Yoklama</h1><p role="alert">İptal kayıtları doğrulanamadı. Lütfen sayfayı yenileyin.</p></main>;
  for (const row of result.data || []) {
    const permitted = row.source_id ? allowedStudentIdsBySchedule?.[row.source_id] : undefined;
    if (row.student_id && row.source_id && row.cancelled_date && (!permitted || permitted.includes(row.student_id))) {
      (cancellations[`${row.cancelled_date}:${row.source_id}`] ||= []).push(row.student_id);
    }
  }
  if ((result.data?.length || 0) < 500) break;
}
const panelDate = isLessonDate(attendanceDate) ? attendanceDate : todayDate;
const personnelPanelUrl = `/personel-puantaj?${new URLSearchParams({
  date: panelDate,
  ...(selectedStaff ? { personel: selectedStaff.id } : {}),
})}`;
if (params.gorunum === "gelisim" && (selectedStaff || profile.base_role === "coach")) {
  const session = (selectedStaff || coachStaff) && isLessonDate(attendanceDate) && attendanceDate <= todayDate
    ? (await loadPersonnelSessions(cancellationDb, organizationId, attendanceDate)).find((row) =>
        row.id === params.scheduleId && [...coachIds].some((id) => row.coaches.has(id)))
    : undefined;
  const roster = session ? attendanceRoster({
    students: students.data || [],
    enrollments: enrollments.data || [],
    memberships: session.makeup_date ? [] : memberships.data || [],
    compensationLessons: compensation.data || [],
  }, session.group_id, session.id, attendanceDate, session.weekday || 7) : null;
  const cancelled = session ? new Set(cancellations[`${attendanceDate}:${session.id}`]) : new Set<string>();
  const eligible = session && roster ? coachStudentScope(studentAssignments.data || [], session.id,
    session.group_id, coachIds, true, roster.students.map((student) => student.id)) : undefined;
  const reportStudents = roster?.students.filter((student) => student.status === "active" &&
    !cancelled.has(student.id) && (!eligible || eligible.includes(student.id))) || [];

  return (
    <main className="saReports">
      <Link className="saReportsBack" href={personnelPanelUrl}>{selectedStaff ? "Personel paneline dön" : "Eğitmen paneline dön"}</Link>
      <header>
        <h1>Gelişim raporları</h1>
        {session ? <p>{session.group.name} · {formatDisplayDate(attendanceDate)}</p> : null}
        {selectedStaff ? <p>{selectedStaff.first_name} {selectedStaff.last_name} kendi hesabından rapor hazırlayıp veliyle paylaşabilir.</p> : null}
      </header>
      {!session ? <p>{attendanceDate > todayDate ? "Bu seansın raporları ders günü açılır." : "Bu tarih için atanmış aktif bir seans bulunamadı."}</p> :
        reportStudents.length ? <ul>
          {reportStudents.map((student) => {
            const name = `${student.first_name || ""} ${student.last_name || ""}`.trim() || "Öğrenci";
            return <li key={student.id}>
              <strong>{name}</strong>
              {!selectedStaff && coachStaff ? <DevelopmentReportButton studentId={student.id}
                studentName={name} scheduleId={session.id} date={attendanceDate} disabled={false} /> : null}
            </li>;
          })}
        </ul> : <p>Bu seans için rapor hazırlanabilecek öğrenci bulunamadı.</p>}
    </main>
  );
}
return <>{selectedStaff || useOwnRoster ? <div className="saTopNav" aria-label="Eğitmen öğrenci görünümü">
  <Link href={personnelPanelUrl}>Personel Paneline Dön</Link>
  {selectedStaff ? <strong>{selectedStaff.first_name} {selectedStaff.last_name} · Öğrenci listesi</strong> : null}
</div> : null}<nav className="saTopNav" aria-label="Yoklama hızlı erişim"><AttendanceBackButton><span className="saTopNavIcon"><Icon name="back"/></span><span><b>Geri</b><small>Önceki ekran</small></span></AttendanceBackButton><Link href={`/yoklama?date=${todayDate}`} className="saTopNavItem active"><span className="saTopNavIcon"><Icon name="today"/></span><span><b>Bugün</b><small>Günlük yoklama</small></span></Link><Link href="/yoklama/aylik" className="saTopNavItem"><span className="saTopNavIcon"><Icon name="month"/></span><span><b>Tüm Ay</b><small>Aylık görünüm</small></span></Link><Link href="/yoklama/gecmis" className="saTopNavItem"><span className="saTopNavIcon"><Icon name="history"/></span><span><b>Geçmiş</b><small>Ders kayıtları</small></span></Link></nav><QuickAttendanceClient key={`${attendanceDate}:${params.branchId||""}:${params.time||""}:${params.scheduleId||""}:${selectedStaff?.id||""}`} viewerId={selectedStaff ? `${profile.id}:${selectedStaff.id}` : profile.id} cancellations={cancellations} branches={scopedAttendance?(branches.data||[]).filter(branch=>coachVisibleSchedules.some(schedule=>schedule.branch_id===branch.id)):branches.data||[]} groups={coachVisibleGroups} schedules={coachVisibleSchedules} allowedStudentIdsBySchedule={allowedStudentIdsBySchedule} reportScope={reportScope} memberships={coachVisibleMemberships} students={students.data||[]} enrollments={enrollments.data||[]} compensationLessons={compensation.data||[]} initialBranchId={params.branchId||""} initialDate={attendanceDate} initialTime={params.time} initialScheduleId={params.scheduleId}/></>}
