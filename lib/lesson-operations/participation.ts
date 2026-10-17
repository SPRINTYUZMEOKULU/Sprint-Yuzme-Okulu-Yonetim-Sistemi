// Schedules use JS weekdays (Sunday=0); attendance plans may use ISO (Sunday=7).
export function participationWeekday(value: unknown): number {
  if (value === null || value === undefined || value === "") return -1;
  const day = Number(value);
  return Number.isInteger(day) && day >= 0 && day <= 7 ? (day === 0 ? 7 : day) : -1;
}

// The attendance plan belongs to a registration, never to an older package.
export function participationDays(planDays: unknown, enrollmentDays: unknown, groupDays: unknown[]): number[] {
  const normalize = (value: unknown) => Array.isArray(value) ? [...new Set(value.map(participationWeekday).filter(day => day >= 1 && day <= 7))] : [];
  return normalize(planDays).length ? normalize(planDays) : normalize(enrollmentDays).length ? normalize(enrollmentDays) : normalize(groupDays);
}
