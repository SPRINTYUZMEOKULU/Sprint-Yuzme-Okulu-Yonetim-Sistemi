import { attendanceRoster } from "@/lib/attendance/roster";
import { cancellationSummary } from "@/lib/dashboard/cancellation-summary";
export async function loadAttendanceEligibility(client:any,organizationId:string){
 async function read(table:string,columns:string,filter?:[string,unknown]){const rows:any[]=[];for(let offset=0;;offset+=500){let q=client.from(table).select(columns).eq("organization_id",organizationId);if(filter)q=q.eq(...filter);const r=await q.order("id").range(offset,offset+499);if(r.error)throw new Error("Yoklama uygunluğu doğrulanamadı.");rows.push(...(r.data||[]));if((r.data||[]).length<500)return rows;}}
 const [students,enrollments,memberships,compensationLessons,cancellations]=await Promise.all([
  read("students","id,status,is_deleted",["is_deleted",false]),
  read("student_enrollments","id,student_id,group_id,status,start_date,created_at,lesson_weekdays,total_lessons,used_lessons,start_confirmation_required,actual_started_at",["status","active"]),
  read("student_group_memberships","id,student_id,group_id,is_active",["is_active",true]),
  read("student_compensation_lessons","id,student_id,target_group_id,target_schedule_id,lesson_date,status",["status","planned"]),
  read("student_activity_logs","id,student_id,source_id,old_value,new_value",["activity_type","lesson_cancellation_compensation"])
 ]);return {students,enrollments,memberships,compensationLessons,cancellations};
}
export function missingAttendanceStudents(context:Awaited<ReturnType<typeof loadAttendanceEligibility>>,schedule:any,date:string,records:any[]){
 const day=new Date(date+'T12:00:00Z').getUTCDay()||7;
 const roster=attendanceRoster(context,schedule.group_id,schedule.id,date,day);
 const cancelled=new Set(cancellationSummary(schedule.id,date,context.cancellations,[]).studentIds);
 const saved=new Set(records.filter(r=>r.lesson_date===date&&(r.schedule_id===schedule.id||(!r.schedule_id&&r.group_id===schedule.group_id))).map(r=>r.student_id));
 return roster.students.filter(s=>!cancelled.has(s.id)&&!saved.has(s.id)&&(roster.compensationIds.has(s.id)||Number(roster.enrollmentByStudent.get(s.id)?.total_lessons||0)>Number(roster.enrollmentByStudent.get(s.id)?.used_lessons||0)));
}
