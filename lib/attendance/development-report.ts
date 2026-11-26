import { coachStudentScope } from "./coach-roster";

export const developmentReportTitle = "Gelişim raporu";

export const developmentSections = [
  { key: "strengths", label: "Gözlem ve kazanımlar" },
  { key: "focus", label: "Geliştirilecek beceriler" },
  { key: "goal", label: "Sonraki ders hedefi" },
] as const;

export function developmentReportBody(input: Record<string, unknown>) {
  const parts = [];
  for (const { key, label } of developmentSections) {
    const text = input[key];
    if (typeof text !== "string" || !text.trim() || text.trim().length > 900) return null;
    parts.push(`${label}\n${text.trim()}`);
  }
  return parts.join("\n\n");
}

export function reportStudentScope(
  schedule: { id: string; group_id: string; coach_id?: string | null },
  primaryCoachId: string | null | undefined,
  staffAssignments: Parameters<typeof coachStudentScope>[0],
  studentAssignments: Parameters<typeof coachStudentScope>[0],
  coachIds: Set<string>,
  studentIds: string[],
) {
  const assignedCoachIds = staffAssignments.filter((row) => row.is_active !== false &&
    (row.schedule_id === schedule.id || (!row.schedule_id && row.group_id === schedule.group_id)))
    .map((row) => row.coach_id);
  if (schedule.coach_id) assignedCoachIds.push(schedule.coach_id);
  if (!assignedCoachIds.length && primaryCoachId) assignedCoachIds.push(primaryCoachId);
  const assigned = assignedCoachIds.some((id) => Boolean(id && coachIds.has(id)));
  return coachStudentScope(studentAssignments, schedule.id, schedule.group_id, coachIds, assigned, studentIds);
}
