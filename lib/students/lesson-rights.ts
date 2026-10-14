// A cancelled normal lesson moves to compensation; it does not create a second right.
export function studentLessonRights(p:{total:number;scheduledUsed:number;legacyCompensation:number;enrollment:any;compensations:any[];cancellations:any[];schedules:any[];today:string;time:string}){
 const e=p.enrollment;
 const operations=new Map<string,any>();
 for(const row of p.cancellations){
  const date=row.old_value?.cancelled_lesson_date;
  const schedule=p.schedules.find(s=>s.id===row.source_id);
  if(!date||!e||date<e.start_date||date>e.planned_end_date||schedule?.group_id!==e.group_id)continue;
  operations.set(`${row.source_id}:${date}`,{...row,date,schedule});
 }
 const rows=[...operations.values()];
 const elapsed=rows.filter(row=>row.date<p.today||(row.date===p.today&&String(row.schedule.end_time).slice(0,5)<=p.time)).length;
 const upcoming=rows.filter(row=>row.date>p.today||(row.date===p.today&&String(row.schedule.end_time).slice(0,5)>p.time)).length;
 const planned=p.compensations.filter(row=>row.enrollment_id===e?.id&&row.status==='planned').length;
 const reserved=rows.filter(row=>row.new_value?.compensation_mode==='reserve'&&!row.new_value?.compensation_date).length;
 const compensation=Math.max(0,p.legacyCompensation,planned+reserved);
 const completed=p.compensations.filter(row=>row.enrollment_id===e?.id&&row.status==='completed').length;
 const used=Math.max(0,p.scheduledUsed-elapsed)+completed;
 const normal=Math.max(0,p.total-p.scheduledUsed-upcoming);
 return {used,normal,compensation,total:normal+compensation};
}
