export type LessonBalanceSchedule={id:string;group_id?:string|null;weekday?:number|null;start_time?:string|null;end_time?:string|null};
export type LessonBalanceException={lesson_date?:string|null;group_id?:string|null;schedule_id?:string|null;exception_type?:string|null};
export type LessonBalanceInput={totalLessons:number;storedUsedLessons?:number;startDate?:string|null;normalEndDate?:string|null;schedules:LessonBalanceSchedule[];exceptions?:LessonBalanceException[];compensationBalance?:number;now?:Date};
const trDate=(d:Date)=>new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Istanbul",year:"numeric",month:"2-digit",day:"2-digit"}).format(d);
const n=(v:unknown)=>{const x=Number(v??0);return Number.isFinite(x)?x:0};
function matchesDay(s:LessonBalanceSchedule,d:Date){const js=d.getDay(),iso=js===0?7:js,day=Number(s.weekday);return day===js||day===iso}
function excluded(keys:Set<string>,date:string,s:LessonBalanceSchedule){return keys.has(date+":"+s.id)||keys.has(date+":group:"+String(s.group_id||""))}
export function calculateLessonBalance(input:LessonBalanceInput){
 const total=Math.max(0,n(input.totalLessons)),stored=Math.max(0,n(input.storedUsedLessons)),comp=Math.max(0,n(input.compensationBalance)),now=input.now||new Date();
 const keys=new Set<string>();for(const e of input.exceptions||[]){const d=String(e.lesson_date||"");if(!d)continue;if(e.schedule_id)keys.add(d+":"+e.schedule_id);if(e.group_id)keys.add(d+":group:"+e.group_id)}
 let elapsed=0;
 if(input.startDate&&input.schedules.length){const cursor=new Date(input.startDate+"T00:00:00+03:00");for(let guard=0;guard<730&&cursor<=now;guard++){const ymd=trDate(cursor);for(const s of input.schedules){if(!matchesDay(s,cursor))continue;const at=new Date(ymd+"T"+String(s.start_time||"00:00").slice(0,5)+":00+03:00");if(at<=now&&!excluded(keys,ymd,s))elapsed++}cursor.setDate(cursor.getDate()+1)}}
 const ended=Boolean(input.normalEndDate&&now>new Date(input.normalEndDate+"T23:59:59+03:00"));
 const used=ended?total:Math.min(total,Math.max(stored,elapsed)),normalRemaining=ended?0:Math.max(total-used,0);
 let projectedEnd:string|null=null;
 if(normalRemaining>0&&input.schedules.length){const cursor=new Date(trDate(now)+"T00:00:00+03:00");let count=0;for(let guard=0;guard<730;guard++){const ymd=trDate(cursor);for(const s of input.schedules){if(!matchesDay(s,cursor)||excluded(keys,ymd,s))continue;const at=new Date(ymd+"T"+String(s.start_time||"00:00").slice(0,5)+":00+03:00");if(at<=now)continue;if(++count>=normalRemaining){projectedEnd=ymd;break}}if(projectedEnd)break;cursor.setDate(cursor.getDate()+1)}}
 return{totalLessons:total,usedLessons:used,elapsedScheduledLessons:Math.min(total,elapsed),normalRemainingLessons:normalRemaining,compensationBalance:comp,totalRemainingLessons:normalRemaining+comp,normalEnded:ended,projectedRemainingEndDate:projectedEnd};
}
