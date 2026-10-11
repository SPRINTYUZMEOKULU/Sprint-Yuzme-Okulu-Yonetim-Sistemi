import { attendanceRoster } from "@/lib/attendance/roster";
import { isScheduleOnDate, weekdayForDate } from "@/lib/schedules/weekday";

export const ATTENDANCE_HISTORY_DAYS = 90;
export function historyStart(today: string) {
  const date = new Date(`${today}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() - ATTENDANCE_HISTORY_DAYS);
  return date.toISOString().slice(0, 10);
}

// Only dates supported by the current registration and schedule are actionable.
// New registrations are not projected backwards before they were created.
export function pastAttendance(p: {
  today: string; schedules: any[]; students: any[]; enrollments: any[];
  memberships: any[]; records: any[]; closures: any[];
  branches: any[]; groups: any[];
}) {
  const result: Array<{date:string;branchId:string;branchName:string;time:string;missingCount:number;href:string}> = [];
  const records = new Map<string, any[]>();
  for (const row of p.records) records.set(row.lesson_date, [...(records.get(row.lesson_date) || []), row]);
  const start = historyStart(p.today);
  for (let cursor = new Date(`${start}T12:00:00Z`); cursor.toISOString().slice(0,10) < p.today; cursor.setUTCDate(cursor.getUTCDate()+1)) {
    const date = cursor.toISOString().slice(0,10);
    const slots = new Map<string, {branchId:string;time:string;missing:Set<string>}>();
    for (const schedule of p.schedules) {
      if (!isScheduleOnDate(Number(schedule.weekday), date)) continue;
      if (schedule.created_at && String(schedule.created_at).slice(0,10)>date) continue;
      if (p.closures.some(row => row.event_date===date && (!row.branch_id || row.branch_id===schedule.branch_id)
        && (!row.start_time || String(schedule.start_time)>=String(row.start_time))
        && (!row.end_time || String(schedule.start_time)<String(row.end_time)))) continue;
      const enrollments = p.enrollments.filter(row =>
        (!row.created_at || String(row.created_at).slice(0,10)<=date)
        && (!row.actual_started_at || String(row.actual_started_at).slice(0,10)<=date));
      const roster = attendanceRoster({...p,enrollments,compensationLessons:[]}, schedule.group_id, schedule.id, date, weekdayForDate(date));
      const saved = new Set((records.get(date)||[]).filter(row => row.schedule_id===schedule.id || (!row.schedule_id && row.group_id===schedule.group_id)).map(row=>row.student_id));
      const time = String(schedule.start_time||"").slice(0,5);
      const key = JSON.stringify([schedule.branch_id,time]);
      const slot = slots.get(key)||{branchId:schedule.branch_id,time,missing:new Set<string>()};
      for (const student of roster.students) {
        const enrollment = roster.enrollmentByStudent.get(student.id);
        if (!saved.has(student.id) && Number(enrollment?.total_lessons||0)>Number(enrollment?.used_lessons||0)) slot.missing.add(student.id);
      }
      slots.set(key,slot);
    }
    for (const slot of slots.values()) if (slot.missing.size) {
      const params = new URLSearchParams({date,branchId:slot.branchId,time:slot.time});
      result.push({date,branchId:slot.branchId,branchName:p.branches.find(row=>row.id===slot.branchId)?.name||"Şube",time:slot.time,missingCount:slot.missing.size,href:`/yoklama?${params}`});
    }
  }
  return result.sort((a,b)=>b.date.localeCompare(a.date)||a.time.localeCompare(b.time));
}
