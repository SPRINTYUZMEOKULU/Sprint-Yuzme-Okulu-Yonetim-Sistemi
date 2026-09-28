const DAY_NAMES = [
  "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar",
];

type Group = { id: string; branch_id: string | null; name: string; course_type?: string | null };
type Schedule = { id: string; group_id: string | null; weekday: number | null; start_time: string | null };

const isoDay = (day: number | null) => day === 0 ? 7 : Number(day);
const dayKey = (days: number[]) => [...new Set(days)].sort((a, b) => a - b).join(",");

// A group can contain extra sessions. Its named days, when present, identify
// the actual program more reliably than the full schedule inventory.
function namedDays(name: string) {
  const words = new Set(
    (name.match(/[A-Za-zÇĞİÖŞÜçğıöşü]+/g) || [])
      .map((word) => word.toLocaleLowerCase("tr-TR")),
  );
  const found = DAY_NAMES.flatMap((day, index) =>
    words.has(day.toLocaleLowerCase("tr-TR")) ? [index + 1] : [],
  );
  return dayKey(found);
}

export function matchingGroupForSessions(
  branchId: string,
  currentGroupId: string,
  selectedIds: string[],
  groups: Group[],
  schedules: Schedule[],
) {
  const chosen = schedules.filter((schedule) => selectedIds.includes(schedule.id));
  if (!chosen.length || chosen.length !== selectedIds.length) return null;
  const days = dayKey(chosen.map((schedule) => isoDay(schedule.weekday)));
  const current = groups.find((group) => group.id === currentGroupId);
  if (current && namedDays(current.name) === days) return null;
  const candidates = groups.filter((group) => {
    if (group.branch_id !== branchId || group.id === currentGroupId) return false;
    if (current?.course_type && group.course_type !== current.course_type) return false;
    if (namedDays(group.name) !== days) return false;
    return chosen.every((session) => schedules.some((candidate) =>
      candidate.group_id === group.id &&
      isoDay(candidate.weekday) === isoDay(session.weekday) &&
      String(candidate.start_time || "").slice(0, 5) === String(session.start_time || "").slice(0, 5),
    ));
  });
  if (candidates.length !== 1) return null;
  const target = candidates[0];
  const mapped = chosen.map((session) => schedules.find((candidate) =>
    candidate.group_id === target.id &&
    isoDay(candidate.weekday) === isoDay(session.weekday) &&
    String(candidate.start_time || "").slice(0, 5) === String(session.start_time || "").slice(0, 5),
  ));
  return mapped.every(Boolean) ? { groupId: target.id, scheduleIds: mapped.map((schedule) => schedule!.id) } : null;
}
