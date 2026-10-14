export type CancellationSummary = {
  studentIds: string[]; plannedStudentIds: string[]; reservedStudentIds: string[];
  sentStudentIds: string[]; preparedStudentIds: string[]; reasons: string[];
};
// Only completed operations cancel attendance. Message drafts alone are not an operation.
export function cancellationSummary(scheduleId: string, date: string, activities: any[], messages: any[]): CancellationSummary {
  const operations = new Map<string, any>();
  for (const row of activities) {
    if (row.source_id !== scheduleId || row.old_value?.cancelled_lesson_date !== date || !row.student_id) continue;
    const previous = operations.get(row.student_id);
    if (!previous || String(row.performed_at || '') >= String(previous.performed_at || '')) operations.set(row.student_id, row);
  }
  const sent = new Set<string>(), prepared = new Set<string>();
  for (const row of messages) {
    if (row.metadata?.source_schedule_id !== scheduleId || row.metadata?.cancelled_date !== date || !row.student_id) continue;
    if (['sent','delivered','read'].includes(row.status)) sent.add(row.student_id);
    else if (row.status === 'prepared') prepared.add(row.student_id);
  }
  for (const id of sent) prepared.delete(id);
  const rows = [...operations.values()];
  return {
    studentIds: [...operations.keys()],
    plannedStudentIds: rows.filter(row => row.new_value?.compensation_date).map(row => row.student_id),
    reservedStudentIds: rows.filter(row => !row.new_value?.compensation_date).map(row => row.student_id),
    sentStudentIds: [...sent], preparedStudentIds: [...prepared],
    reasons: [...new Set<string>(rows.map(row => String(row.new_value?.reason || '')).filter(Boolean))],
  };
}
export function mergeCancellations(rows: CancellationSummary[]) {
  const union = (key: keyof CancellationSummary) => [...new Set(rows.flatMap(row => row[key]))];
  const sentStudentIds = union('sentStudentIds');
  return {studentIds:union('studentIds'),plannedStudentIds:union('plannedStudentIds'),reservedStudentIds:union('reservedStudentIds'),sentStudentIds,
    preparedStudentIds:union('preparedStudentIds').filter(id=>!sentStudentIds.includes(id)),reasons:union('reasons')};
}
