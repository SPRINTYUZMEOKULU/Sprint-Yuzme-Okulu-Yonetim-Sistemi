import { participationWeekday } from "./participation";

type Group = { id: string; branch_id: string | null; course_type?: string | null };
type Schedule = { id: string; group_id: string | null; weekday: number | null; start_time: string | null; end_time: string | null; is_active?: boolean | null };

export function compensationCourseKind(value?: string | null): string {
  const text = (value || "").toLocaleLowerCase("tr-TR").trim();
  if (/yetişkin|yetiskin|adult|master/.test(text)) return "adult";
  if (/takım|takim|performans|performance|team/.test(text)) return "team";
  if (/çocuk|cocuk|child|kids/.test(text)) return "child";
  return text ? `other:${text}` : "unknown";
}

export function compatibleCompensationGroups(source?: Group | null, target?: Group | null) {
  return Boolean(source && target && source.branch_id && source.branch_id === target.branch_id
    && (source.id === target.id || (compensationCourseKind(source.course_type) !== "unknown"
      && compensationCourseKind(source.course_type) === compensationCourseKind(target.course_type))));
}

// Collapse only the choices displayed to the user. Keep real schedule/group IDs
// so attendance and compensation records continue to use the existing links.
export function compensationTargetOptions<T extends Schedule>(sourceId: string, date: string, groups: Group[], schedules: T[]) {
  const source = groups.find(group => group.id === sourceId);
  const day = date ? new Date(`${date}T12:00:00Z`).getUTCDay() || 7 : 0;
  const choices = new Map<string, T>();
  const candidates = schedules.filter(schedule => schedule.is_active !== false
    && participationWeekday(schedule.weekday) === day
    && compatibleCompensationGroups(source, groups.find(group => group.id === schedule.group_id)))
    .sort((a, b) => Number(b.group_id === sourceId) - Number(a.group_id === sourceId) || a.id.localeCompare(b.id));
  for (const schedule of candidates) {
    // Incomplete times must not accidentally merge unrelated schedules.
    const key = schedule.start_time && schedule.end_time
      ? `${String(schedule.start_time).slice(0, 5)}:${String(schedule.end_time).slice(0, 5)}` : schedule.id;
    if (!choices.has(key)) choices.set(key, schedule);
  }
  return [...choices.values()].sort((a, b) => String(a.start_time).localeCompare(String(b.start_time)));
}
