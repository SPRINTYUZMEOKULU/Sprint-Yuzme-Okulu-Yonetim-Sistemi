import type { SupabaseClient } from "@supabase/supabase-js";
import { attendanceRoster } from "@/lib/attendance/roster";
import { cancellationSummary } from "@/lib/dashboard/cancellation-summary";
import { loadAttendanceEligibility } from "@/lib/notifications/attendance-eligibility";
import { filterEffectivelyActiveSchedules } from "@/lib/schedules/effective";

export function sessionClock(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((value) => value.type === type)?.value;
  return {
    date: `${part("year")}-${part("month")}-${part("day")}`,
    minute: Number(part("hour")) * 60 + Number(part("minute")),
  };
}

export function isLessonDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function sessionMinutes(time: string) {
  const [hour, minute] = time.split(":").map(Number);
  return hour * 60 + minute;
}

export async function loadPersonnelSessions(client: SupabaseClient, organizationId: string, date: string) {
  const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
  const [schedules, assignments, branches, groups, exceptions, makeups, cancellations] = await Promise.all([
    client.from("lesson_schedules").select("id, branch_id, group_id, coach_id, weekday, start_time, end_time, is_active, makeup_date").eq("organization_id", organizationId)
      .or(`and(makeup_date.is.null,is_active.eq.true,weekday.in.(${weekday === 0 ? "0,7" : weekday})),makeup_date.eq.${date}`),
    client.from("lesson_staff_assignments").select("schedule_id, group_id, coach_id, assignment_role").eq("organization_id", organizationId).eq("is_active", true),
    client.from("branches").select("id, name, short_name, latitude, longitude, checkin_radius_m").eq("organization_id", organizationId).eq("is_active", true),
    client.from("training_groups").select("id, name, primary_coach_id").eq("organization_id", organizationId).eq("is_active", true),
    client.from("lesson_session_exceptions").select("schedule_id, group_id, branch_id, exception_type").eq("organization_id", organizationId).eq("lesson_date", date),
    client.from("student_compensation_lessons").select("target_schedule_id").eq("organization_id", organizationId).eq("lesson_date", date).in("status", ["planned", "completed"]),
    client.from("student_activity_logs").select("id").eq("organization_id", organizationId)
      .eq("activity_type", "lesson_cancellation_compensation").eq("old_value->>cancelled_lesson_date", date).limit(1),
  ]);
  const error = schedules.error || assignments.error || branches.error || groups.error || exceptions.error || makeups.error || cancellations.error;
  if (error) throw error;
  const branchMap = new Map((branches.data || []).map((branch) => [branch.id, branch]));
  const groupMap = new Map((groups.data || []).map((group) => [group.id, group]));
  const booked = new Set((makeups.data || []).map((row) => row.target_schedule_id));
  const candidates = (schedules.data || []).filter((row) => !row.makeup_date || booked.has(row.id));
  const eligible = filterEffectivelyActiveSchedules(
    candidates.map((row) => row.makeup_date ? { ...row, is_active: true } : row),
    branches.data || [],
    groups.data || [],
  );

  const cancellationContext = cancellations.data?.length ? await loadAttendanceEligibility(client, organizationId) : null;
  return eligible.flatMap((schedule) => {
    const cancelled = !schedule.makeup_date && (exceptions.data || []).some((row) =>
      ["cancelled", "not_held", "pool_closed", "frozen"].includes(row.exception_type) &&
      (row.schedule_id ? row.schedule_id === schedule.id : row.group_id ? row.group_id === schedule.group_id : row.branch_id === schedule.branch_id)
    );
    if (cancelled) return [];
    if (cancellationContext && !schedule.makeup_date) {
      const cancelledIds = new Set(cancellationSummary(schedule.id, date, cancellationContext.cancellations, []).studentIds);
      if (cancelledIds.size) {
        const roster = attendanceRoster(cancellationContext, schedule.group_id, schedule.id, date, weekday || 7);
        if (roster.students.every((student) => cancelledIds.has(student.id))) return [];
      }
    }
    const branch = branchMap.get(schedule.branch_id)!;
    const group = groupMap.get(schedule.group_id)!;
    const coaches = new Map<string, string>();
    if (schedule.coach_id) coaches.set(schedule.coach_id, "coach");
    for (const assignment of assignments.data || []) {
      if (assignment.schedule_id === schedule.id || (!assignment.schedule_id && assignment.group_id === schedule.group_id)) {
        coaches.set(assignment.coach_id, assignment.assignment_role || "coach");
      }
    }
    if (!coaches.size && group.primary_coach_id) coaches.set(group.primary_coach_id, "coach");
    return [{ ...schedule, branch, group, coaches }];
  });
}

export function branchHasCoordinates(branch: { latitude: number | null; longitude: number | null }) {
  return branch.latitude != null && branch.longitude != null &&
    Math.abs(Number(branch.latitude)) <= 90 && Math.abs(Number(branch.longitude)) <= 180;
}
