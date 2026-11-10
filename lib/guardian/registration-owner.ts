/** Explicit public-form identity wins; missing guardian details never imply self. */
export function isSelfRegistration(registrationFor?: string | null, birthDate?: string | null): boolean {
  if (registrationFor === "adult" || registrationFor === "self") return true;
  if (registrationFor === "child") return false;
  if (!birthDate) return false;
  const date = new Date(`${birthDate.slice(0,10)}T12:00:00Z`);
  if (!Number.isFinite(date.getTime())) return false;
  const now = new Date();
  let age = now.getUTCFullYear() - date.getUTCFullYear();
  if (now.getUTCMonth() < date.getUTCMonth() || (now.getUTCMonth() === date.getUTCMonth() && now.getUTCDate() < date.getUTCDate())) age--;
  return age >= 18;
}
