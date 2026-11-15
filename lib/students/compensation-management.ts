export type MakeupSchedule = {id:string;group_id:string;weekday:number;start_time:string;end_time:string};
export type MakeupGroup = {id:string;name:string;branch_id:string};
export type MakeupBranch = {id:string;name:string};
export type MakeupNotice = {id:string;body:string;recipient:string;status:string};
export type ManagedMakeup = {
 id:string;student_id:string;lesson_date:string|null;status:string;note:string|null;
 target_group_id?:string;target_schedule_id?:string;
 student?:{first_name?:string;last_name?:string;student_number?:string|null}|null;
 notification?:MakeupNotice|null;canPrepare?:boolean;
};
export function currentMakeupNotice(item:ManagedMakeup,logs:any[]):MakeupNotice|null{
 const log=logs.find(row=>row.metadata?.compensation_id===item.id&&["prepared","sent"].includes(row.status)&&
  row.metadata?.current_plan?.date===item.lesson_date&&row.metadata?.current_plan?.schedule_id===item.target_schedule_id&&
  Boolean(row.metadata?.current_plan?.cancelled)===(item.status==="cancelled"));
 return log?{id:log.id,body:log.message_body,recipient:log.recipient||"",status:log.status}:null;
}
export function filterMakeups(items:ManagedMakeup[],tab:string,query:string,branch:string,groups:MakeupGroup[]){
 const search=query.trim().toLocaleLowerCase("tr-TR");
 const rows=items.filter(item=>(tab==="notifications"?item.notification?.status==="prepared":item.status===tab)&&
  (!branch||groups.some(group=>group.id===item.target_group_id&&group.branch_id===branch))&&
  (!search||[item.student?.first_name,item.student?.last_name,item.student?.student_number,item.note].filter(Boolean).join(" ").toLocaleLowerCase("tr-TR").includes(search)));
 return ["planned","notifications"].includes(tab)?rows.sort((a,b)=>String(a.lesson_date||"").localeCompare(String(b.lesson_date||""))):rows;
}
