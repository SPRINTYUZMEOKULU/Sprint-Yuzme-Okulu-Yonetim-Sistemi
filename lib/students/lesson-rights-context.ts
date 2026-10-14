import { studentLessonRights } from "@/lib/students/lesson-rights";

export async function loadLessonRightsContext(client:any,organizationId:string,studentIds?:string[]){
 async function read(table:string,columns:string,filter?:[string,string]){
  const rows:any[]=[];
  for(let offset=0;;offset+=500){
   let q=client.from(table).select(columns).eq("organization_id",organizationId);
   if(studentIds)q=q.in("student_id",studentIds);
   if(filter)q=q.eq(filter[0],filter[1]);
   const r=await q.order("id").range(offset,offset+499);
   if(r.error)throw new Error(`Ders ve telafi bilgileri yüklenemedi: ${r.error.message}`);
   rows.push(...(r.data||[]));if((r.data||[]).length<500)return rows;
  }
 }
 const [compensations,cancellations,schedules,balances]=await Promise.all([
  read("student_compensation_lessons","id,student_id,enrollment_id,lesson_date,status"),
  read("student_activity_logs","id,student_id,source_id,old_value,new_value",["activity_type","lesson_cancellation_compensation"]),
  client.from("lesson_schedules").select("id,group_id,start_time,end_time").eq("organization_id",organizationId),
  // This legacy view has no organization column; student IDs scope it explicitly.
  studentIds?.length ? client.from("student_lesson_balance").select("student_id,compensation_lesson_balance").in("student_id",studentIds) : Promise.resolve({data:[],error:null})
 ]);
 if(schedules.error||balances.error)throw new Error("Ders ve telafi bakiyesi doğrulanamadı.");
 const clock=new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Istanbul",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(new Date());
 const part=(t:string)=>clock.find(p=>p.type===t)?.value||"";
 return {compensations,cancellations,schedules:schedules.data||[],balances:new Map<string,number>((balances.data||[]).map((b:any)=>[b.student_id,Number(b.compensation_lesson_balance||0)])),today:`${part("year")}-${part("month")}-${part("day")}`,time:`${part("hour")}:${part("minute")}`};
}
export function rightsForEnrollment(context:Awaited<ReturnType<typeof loadLessonRightsContext>>,enrollment:any,legacyCompensation?:number){
 const rights=studentLessonRights({total:Number(enrollment?.total_lessons||0),scheduledUsed:Number(enrollment?.used_lessons||0),
  legacyCompensation:legacyCompensation??context.balances.get(enrollment?.student_id)??0,enrollment,
  compensations:context.compensations.filter(c=>c.student_id===enrollment?.student_id),
  cancellations:context.cancellations.filter(c=>c.student_id===enrollment?.student_id),schedules:context.schedules,today:context.today,time:context.time});
 const endDate=context.compensations.filter(c=>c.enrollment_id===enrollment?.id&&c.status==='planned').reduce((end,c)=>String(c.lesson_date)>end?String(c.lesson_date):end,String(enrollment?.planned_end_date||''));
 return {...rights,endDate:endDate||null};
}
