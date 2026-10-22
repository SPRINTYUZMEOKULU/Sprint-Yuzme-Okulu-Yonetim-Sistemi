export type HistoryStudent = {studentId:string;name:string;status:"processed"|"skipped";reason:string;compensationDate:string|null;message:string|null;recipient:string|null;messageStatus:string;sentAt:string|null};
export type HistorySession = {key:string;date:string;scheduleId:string;groupName:string;time:string;performedAt:string;hasSkippedRecords:boolean;students:HistoryStudent[]};
export function buildCancellationHistory(logs:any[],messages:any[],names:Map<string,string>,schedules:Map<string,any>,groups:Map<string,string>):HistorySession[]{
 const sessions=new Map<string,HistorySession>();
 for(const log of [...logs].sort((a,b)=>String(b.performed_at).localeCompare(String(a.performed_at)))){
  const date=log.old_value?.cancelled_lesson_date,scheduleId=log.source_id||log.old_value?.schedule_id;
  if(!date||!scheduleId||!log.student_id)continue;
  const key=`${date}:${scheduleId}`;const schedule=schedules.get(scheduleId);
  let session=sessions.get(key);
  if(!session){session={key,date,scheduleId,groupName:log.new_value?.group_name||groups.get(schedule?.group_id)||"Ders seansı",time:schedule?.start_time?String(schedule.start_time).slice(0,5):"—",performedAt:log.performed_at,hasSkippedRecords:false,students:[]};sessions.set(key,session);}
  if(log.activity_type==="lesson_cancellation_skipped")session.hasSkippedRecords=true;
  if(session.students.some(s=>s.studentId===log.student_id))continue;
  const matches=messages.filter(m=>m.student_id===log.student_id&&m.metadata?.cancelled_date===date&&m.metadata?.source_schedule_id===scheduleId).sort((a,b)=>String(b.prepared_at).localeCompare(String(a.prepared_at)));
  const message=matches[0];
  session.students.push({studentId:log.student_id,name:names.get(log.student_id)||"Kursiyer",status:log.activity_type==="lesson_cancellation_skipped"?"skipped":"processed",reason:log.description||log.new_value?.reason||"",compensationDate:log.new_value?.compensation_date||null,message:message?.message_body||null,recipient:message?.recipient||null,messageStatus:message?.status||"none",sentAt:message?.sent_at||null});
 }
 return [...sessions.values()].sort((a,b)=>b.date.localeCompare(a.date)||b.performedAt.localeCompare(a.performedAt));
}
