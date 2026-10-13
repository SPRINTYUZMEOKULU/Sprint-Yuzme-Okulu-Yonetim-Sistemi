export function istanbulDate(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(date);
}

export function isISODate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function normalizeWeekdays(days: number[]): number[] {
  return Array.from(new Set(days.map(Number).map(day => day === 7 ? 0 : day)))
    .filter(day => Number.isInteger(day) && day >= 0 && day <= 6).sort((a, b) => a - b);
}

// A renewal keeps the student's program, even when the group offers extra days.
export function renewalWeekdays(previous: number[] | null | undefined, available: number[]): number[] {
  const groupDays = normalizeWeekdays(available);
  const selected = previous == null ? groupDays : normalizeWeekdays(previous);
  if (!selected.length || selected.some(day => !groupDays.includes(day))) {
    throw new Error("Öğrencinin seçili ders günleri aktif grup programıyla uyuşmuyor. Önce öğrenci programını kontrol ediniz.");
  }
  return selected;
}

export function calculatePackageEndDate(start: string, lessons: number, days: number[]): string {
  const selected = normalizeWeekdays(days);
  if (!isISODate(start) || !Number.isInteger(lessons) || lessons < 1 || !selected.length) {
    throw new Error("Başlangıç tarihi, ders sayısı veya seçili günler geçersiz.");
  }
  const cursor = new Date(`${start}T12:00:00Z`);
  let count = 0;
  for (let offset = 0; offset <= 730; offset += 1) {
    if (selected.includes(cursor.getUTCDay())) count += 1;
    if (count === lessons) return cursor.toISOString().slice(0, 10);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  throw new Error("Ders planı iki yıl içinde tamamlanamadı.");
}

// The final lesson date is inclusive; today's lesson is still valid.
export function enrollmentDateEnded(end: string | null | undefined, today: string): boolean {
  return Boolean(end && end < today);
}
