// The attendance plan belongs to a registration, never to an older package.
export function participationDays(planDays: unknown, enrollmentDays: unknown, groupDays: unknown[]): number[] {
  const normalize = (value: unknown) => Array.isArray(value) ? [...new Set(value.map(Number).filter(day => day >= 1 && day <= 7))] : [];
  return normalize(planDays).length ? normalize(planDays) : normalize(enrollmentDays).length ? normalize(enrollmentDays) : normalize(groupDays);
}
