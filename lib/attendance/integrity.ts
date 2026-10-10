export type AttendanceSelection = "present" | "absent" | "excused" | "compensation";
const statuses = new Set(["present", "absent", "excused", "compensation"]);

export function mergeAttendanceDraft(saved: Record<string, AttendanceSelection>, draft: unknown, allowedKeys: Set<string>) {
  const result = {...saved};
  if (!draft || typeof draft !== "object" || Array.isArray(draft)) return result;
  for (const [key, value] of Object.entries(draft)) {
    if (allowedKeys.has(key) && !result[key] && statuses.has(String(value))) result[key] = value as AttendanceSelection;
  }
  return result;
}

export function verifyAttendanceRows(expected: Array<{student_id:string;status:string}>, stored: Array<{student_id:string;status:string}> | null | undefined) {
  return expected.length > 0 && expected.every(row=>stored?.some(item=>item.student_id===row.student_id&&item.status===row.status));
}

// Refresh unchanged rows from the server; preserve local edits until saved.
export function mergeRemoteAttendance(current: Record<string, AttendanceSelection>, previous: Record<string, AttendanceSelection>, remote: Record<string, AttendanceSelection>, allowedKeys: Set<string>) {
  const result: Record<string, AttendanceSelection> = {};
  for (const key of allowedKeys) {
    const value = current[key] !== previous[key] ? current[key] : remote[key];
    if (value && statuses.has(value)) result[key] = value;
  }
  return result;
}
