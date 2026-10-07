type Enrollment={id:string;start_confirmation_required?:boolean;actual_started_at?:string|null;student_id?:string|null;group_id?:string|null;lesson_weekdays?:number[]|null;status?:string|null;start_date?:string|null;created_at?:string|null;updated_at?:string|null};
type Student={id:string;status?:string|null;first_name?:string|null;last_name?:string|null};
type Membership={student_id?:string|null;group_id?:string|null;is_active?:boolean|null};
type Compensation={student_id:string;target_group_id:string;target_schedule_id?:string|null;lesson_date:string;status:string};
function hasDay(e:Enrollment|undefined,uiDay:number){const ds=Array.isArray(e?.lesson_weekdays)?e!.lesson_weekdays!.map(Number):[];if(!ds.length)return true;return ds.includes(uiDay===7?0:uiDay)}
function enrollmentStamp(e:Enrollment){return Date.parse(e.created_at||e.updated_at||`${e.start_date||"1970-01-01"}T00:00:00Z`)||0}
function newestEnrollment(rows:Enrollment[]){return [...rows].sort((a,b)=>enrollmentStamp(b)-enrollmentStamp(a)||String(b.start_date||"").localeCompare(String(a.start_date||""))||String(b.id).localeCompare(String(a.id)))[0]}

// Shared by the daily attendance screen and dashboard counters.
export function attendanceRoster<S extends Student,E extends Enrollment>(p:{students:S[];enrollments:E[];memberships:Membership[];compensationLessons:Compensation[]},groupId:string,scheduleId:string,date:string,day:number){
   const enrollmentRows=p.enrollments.filter(e=>e.group_id===groupId&&e.status==="active");
   const enrollmentByStudent=new Map<string,E>();
   for(const enrollment of enrollmentRows){const studentId=enrollment.student_id||"";if(!studentId)continue;const current=enrollmentByStudent.get(studentId);enrollmentByStudent.set(studentId,current?newestEnrollment([current,enrollment]) as E:enrollment)}

   const memberIds=new Set(p.memberships.filter(m=>m.is_active!==false&&m.group_id===groupId&&m.student_id&&hasDay(enrollmentByStudent.get(m.student_id),day)).map(m=>m.student_id as string));
   const compensationIds=new Set(p.compensationLessons.filter(c=>c.status==="planned"&&c.target_group_id===groupId&&c.lesson_date===date&&(!c.target_schedule_id||c.target_schedule_id===scheduleId)).map(c=>c.student_id));
   const ids=new Set([...memberIds,...compensationIds]);
   const students=p.students.filter(s=>{const e=enrollmentByStudent.get(s.id);return !e?.start_confirmation_required||Boolean(e.actual_started_at)}).filter(s=>ids.has(s.id)&&String(s.status||"active").toLocaleLowerCase("tr-TR")!=="passive").sort((a,b)=>`${a.first_name||""} ${a.last_name||""}`.trim().localeCompare(`${b.first_name||""} ${b.last_name||""}`.trim(),"tr"));
   return {students,enrollmentByStudent,compensationIds};
}
