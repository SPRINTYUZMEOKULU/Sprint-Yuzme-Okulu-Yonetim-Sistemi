import { readSettings } from "@/lib/settings/server";
import { loadAttendanceEligibility, missingAttendanceStudents } from "@/lib/notifications/attendance-eligibility";
import { filterEffectivelyActiveSchedules } from "@/lib/schedules/effective";
import { createNotification } from "@/lib/notifications/create-notification";

export async function runAttendanceBackground(client:any,organizationId:string,date:string,currentMinutes:number,notify:typeof createNotification=createNotification){
 const {values:attendanceSettings}=await readSettings(client,organizationId,"ders");
 const warningMinutes=Number(attendanceSettings.missing_alert_minutes);
 const day=new Date(`${date}T12:00:00Z`).getUTCDay()||7;
 const [eligibility,schedules,groups,branches,records,existing]=await Promise.all([
  loadAttendanceEligibility(client,organizationId),
  client.from("lesson_schedules").select("id,group_id,branch_id,coach_id,weekday,start_time,end_time,is_active").eq("organization_id",organizationId).eq("is_active",true).in("weekday",day===7?[0,7]:[day]),
  client.from("training_groups").select("id,name,is_active").eq("organization_id",organizationId),
  client.from("branches").select("id,is_active").eq("organization_id",organizationId),
  client.from("attendance_records").select("student_id,schedule_id,group_id,lesson_date").eq("organization_id",organizationId).eq("lesson_date",date),
  client.from("system_notifications").select("id,entity_id,metadata,is_read").eq("organization_id",organizationId).eq("event_key","attendance_missing").contains("metadata",{lesson_date:date})
 ]);
 if(schedules.error||groups.error||branches.error||records.error||existing.error)throw new Error("Arka plan yoklama verileri yüklenemedi.");
 const active=filterEffectivelyActiveSchedules<any>(schedules.data||[],branches.data||[],groups.data||[]);
 const overdue=active.filter((schedule:any)=>{const [h,m]=String(schedule.start_time).slice(0,5).split(':').map(Number);return attendanceSettings.missing_alert_enabled&&currentMinutes>=h*60+m+warningMinutes&&missingAttendanceStudents(eligibility,schedule,date,records.data||[]).length>0});
 const overdueIds=new Set(overdue.map(s=>s.id));
 let resolved=0,created=0,pushSent=0,pushFailed=0;
 for(const row of existing.data||[]){if(!row.is_read&&!overdueIds.has(row.entity_id)){
  const result=await client.from("system_notifications").update({is_read:true,metadata:{...row.metadata,resolved_reason:"cancelled_or_no_pending_attendance",resolved_at:new Date().toISOString()}}).eq("organization_id",organizationId).eq("id",row.id);
  if(result.error)throw new Error("Geçersiz yoklama uyarısı kapatılamadı.");resolved++;
 }}
 const sentSchedules=new Set((existing.data||[]).map((row:any)=>row.entity_id));
 for(const schedule of overdue){
  if(sentSchedules.has(schedule.id))continue;
  const group=(groups.data||[]).find((g:any)=>g.id===schedule.group_id);
  const time=String(schedule.start_time).slice(0,5);
  const result=await notify({organizationId,title:"Yoklama alınmadı",body:`${group?.name||"Grup"} · ${time} dersi başlayalı ${warningMinutes} dakikadan fazla oldu. Yoklama henüz tamamlanmadı.`,category:"attendance",eventKey:"attendance_missing",notificationType:"attendance_missing",priority:"high",severity:"warning",sourceType:"lesson_schedule",sourceId:schedule.id,entityType:"lesson_schedule",entityId:schedule.id,
   targetPath:`/yoklama?${new URLSearchParams({date,branchId:schedule.branch_id||"",time,scheduleId:schedule.id})}`,
   metadata:{lesson_date:date,group_id:schedule.group_id,schedule_id:schedule.id,start_time:schedule.start_time,branch_id:schedule.branch_id,coach_id:schedule.coach_id,trigger:"server_scheduler"},push:true});
  if(!result.ok)throw new Error(result.message);created+=result.notificationIds.length?1:0;pushSent+=result.push.sent;pushFailed+=result.push.failed;
 }
 return {created,resolved,pushSent,pushFailed};
}
