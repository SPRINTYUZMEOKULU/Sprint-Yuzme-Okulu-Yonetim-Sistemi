type Assignment = { schedule_id?: string | null; group_id?: string | null; student_id?: string | null; coach_id?: string | null; is_active?: boolean | null };
// undefined grants the session roster; an empty array grants no students.
export function coachStudentScope(assignments: Assignment[], scheduleId: string, groupId: string, coachIds: Set<string>, broad: boolean, studentIds: string[]) {
  const rows=assignments.filter(a=>a.is_active!==false&&(a.schedule_id===scheduleId||(!a.schedule_id&&a.group_id===groupId)));
  const ownIds=new Set(rows.filter(a=>!a.coach_id||coachIds.has(a.coach_id)).map(a=>a.student_id));
  if(!broad)return rows.filter(a=>a.coach_id&&coachIds.has(a.coach_id)).map(a=>a.student_id).filter((id):id is string=>Boolean(id));
  if(!rows.some(a=>a.coach_id))return undefined;
  const otherIds=new Set(rows.filter(a=>a.coach_id&&!coachIds.has(a.coach_id)&&!ownIds.has(a.student_id)).map(a=>a.student_id));
  return studentIds.filter(id=>!otherIds.has(id));
}
