export type StudentStart = {status?: string | null; start_date?: string | null; start_confirmation_required?: boolean; actual_started_at?: string | null};
export function startsAfterToday(student: StudentStart, today: string): boolean {
  if (student.status !== "active") return false;
  if (student.start_confirmation_required && !student.actual_started_at) return true;
  if (!student.start_date) return false;
  const start = student.start_date.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) return false;
  if (Number.isNaN(Date.parse(start + "T12:00:00Z"))) return false;
  return start > today;
}
type StartRow = {student_id: string; start_date?: string | null; start_confirmation_required?: boolean; actual_started_at?: string | null};
/** Rows are ordered newest first, just as in the Student Center. */
export function countStartedStudents(students: Array<{id: string; status: string | null}>, enrollments: StartRow[], plans: StartRow[], today: string): number {
  const latest = (rows: StartRow[]) => {
    const map = new Map<string, StartRow>();
    for (const row of rows) if (!map.has(row.student_id)) map.set(row.student_id, row);
    return map;
  };
  const enrollmentMap = latest(enrollments), planMap = latest(plans);
  return students.filter(student => {
    const enrollment = enrollmentMap.get(student.id);
    return student.status === "active" && !startsAfterToday({
      status: student.status,
      start_date: planMap.get(student.id)?.start_date ?? enrollment?.start_date,
      start_confirmation_required: Boolean(enrollment?.start_confirmation_required),
      actual_started_at: enrollment?.actual_started_at,
    }, today);
  }).length;
}
