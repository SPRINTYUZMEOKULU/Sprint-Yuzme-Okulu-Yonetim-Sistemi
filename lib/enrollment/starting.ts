type StartEnrollment = {id?:string;status?:string|null;start_date?:string|null;start_confirmation_required?:boolean|null;actual_started_at?:string|null;lesson_weekdays?:number[]|null};
type Attendance = {enrollment_id?:string|null;lesson_date?:string|null;status?:string|null};

export function awaitingEnrollmentStart(enrollment:StartEnrollment|undefined,today:string,attendance:Attendance[],legacyStarted=false){
  if(!enrollment||enrollment.actual_started_at)return false;
  if(enrollment.status==="scheduled"||enrollment.start_confirmation_required||Boolean(enrollment.start_date&&enrollment.start_date>today))return true;
  const attended=attendance.some(row=>row.enrollment_id===enrollment.id&&!!enrollment.start_date&&!!row.lesson_date&&row.lesson_date>=enrollment.start_date&&["present","absent","excused"].includes(row.status||""));
  return !attended&&!legacyStarted;
}

export function nextRegisteredLesson<S extends {id:string;weekday:number|null;start_time?:string|null;end_time?:string|null}>(schedules:S[],startDate:string|null|undefined,today:string,weekdays?:number[]|null){
  const base=startDate&&startDate>today?startDate:today;
  const days=new Set((weekdays||[]).map(day=>Number(day)===0?7:Number(day)));
  for(let offset=0;offset<60;offset++){
    const cursor=new Date(`${base}T12:00:00Z`);cursor.setUTCDate(cursor.getUTCDate()+offset);
    const date=cursor.toISOString().slice(0,10),day=cursor.getUTCDay()||7;
    if(days.size&&!days.has(day))continue;
    const schedule=schedules.filter(s=>(Number(s.weekday)||7)===day).sort((a,b)=>String(a.start_time||"").localeCompare(String(b.start_time||"")))[0];
    if(schedule)return {date,startTime:String(schedule.start_time||"").slice(0,5),endTime:String(schedule.end_time||"").slice(0,5),scheduleId:schedule.id};
  }
  return null;
}
