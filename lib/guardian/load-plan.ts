export type GuardianDataView='overview'|'attendance'|'progress'|'payments'|'messages'|'announcements'|'documents'|'access'|'full';
export const HISTORY_PAGE_SIZE=40;
export function guardianHistoryPage(value?:string){const page=Number(value);return Number.isInteger(page)&&page>0?Math.min(page,10000):1;}
export function guardianLoadPlan(view:GuardianDataView){
 const full=view==='full',overview=view==='overview',history=view==='attendance',finance=view==='payments',announcements=view==='announcements';
 return {
  overview,full,enrollment:full||overview||history||finance||announcements,
  attendance:full||overview||history,notes:full||view==='progress'||view==='messages',
  messages:full||overview||view==='messages',documents:full||overview||view==='documents',
  requests:full||overview,finance:full||overview||finance,group:full||overview||history||announcements,
  schedule:full||overview||history,coach:full||overview,branch:full||overview,
  announcements:full||announcements,rights:full||overview,paymentHistory:finance,
  attendanceHistory:history,progressOnly:view==='progress',
 };
}
