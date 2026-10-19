export function attendancePresentation(status: string) {
  return ({present:{label:'Katıldı',tone:'green'},absent:{label:'Katılmadı',tone:'red'},excused:{label:'Mazeretli',tone:'orange'},compensation:{label:'Telafiye katıldı',tone:'blue'}} as Record<string,{label:string;tone:string}>)[status] || {label:'Durum bekleniyor',tone:'gray'};
}
export function enrollmentAttendance(rows:any[],enrollment:any) {
  if(!enrollment)return [];
  return rows.filter(row=>row.enrollment_id===enrollment.id || (!row.enrollment_id && row.lesson_date>=enrollment.start_date && (!enrollment.planned_end_date || row.lesson_date<=enrollment.planned_end_date)));
}
export function attendanceSummary(rows:any[]) {
  const ordered=[...rows].sort((a,b)=>String(b.lesson_date).localeCompare(String(a.lesson_date)));
  let absenceStreak=0;
  for(const row of ordered){if(row.status!=='absent')break;absenceStreak++;}
  const counted=rows.filter(row=>['present','absent','compensation'].includes(row.status));
  const present=counted.filter(row=>['present','compensation'].includes(row.status)).length;
  return {absenceStreak,latestAbsence:absenceStreak?ordered[0]:null,rate:counted.length?Math.round(present/counted.length*100):null};
}
export function currentDocumentConsent(document:any,consents:any[]) {
 return consents.find(consent=>consent.document_id===document.id && Number(consent.document_version)===Number(document.version));
}
export function visibleSchedules(rows:any[],enrollment:any,assignments:any[]) {
  const day=(value:number)=>Number(value)===0?7:Number(value);
  const days=(enrollment?.lesson_weekdays||[]).map(day);
  const assigned=assignments.filter(row=>row.group_id===enrollment?.group_id && row.schedule_id).map(row=>row.schedule_id);
  return rows.filter(row=>{
    if(days.length&&!days.includes(day(row.weekday)))return false;
    const selectedForDay=rows.filter(candidate=>day(candidate.weekday)===day(row.weekday)&&assigned.includes(candidate.id));
    return !selectedForDay.length||assigned.includes(row.id);
  }).sort((a,b)=>(day(a.weekday)-day(b.weekday))||String(a.start_time).localeCompare(String(b.start_time)));
}
export function safePortalUrl(value?:string|null) {
 try{if(!value)return null;const url=new URL(value);return ['https:','http:'].includes(url.protocol)?url.href:null;}catch{return null;}
}
