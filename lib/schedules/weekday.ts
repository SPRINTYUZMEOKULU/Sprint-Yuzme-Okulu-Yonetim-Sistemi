// Schedule and enrollment data may use either 0 or 7 for Sunday.
export function normalizeWeekday(day: number) {
  return day === 7 ? 0 : day;
}

export function weekdayForDate(date: string) {
  return new Date(`${date}T12:00:00Z`).getUTCDay();
}

export function scheduleWeekdaysForDate(date: string) {
  const day = weekdayForDate(date);
  return day === 0 ? [0, 7] : [day];
}

export function isScheduleOnDate(weekday: number, date: string) {
  return normalizeWeekday(weekday) === weekdayForDate(date);
}
