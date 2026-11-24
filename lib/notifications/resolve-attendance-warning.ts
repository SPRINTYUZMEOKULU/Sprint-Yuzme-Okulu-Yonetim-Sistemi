import { loadAttendanceEligibility, missingAttendanceStudents } from "@/lib/notifications/attendance-eligibility";
import type { attendanceOperationsDb } from "@/lib/attendance/operations-db";

export async function resolveAttendanceWarning(
  db: ReturnType<typeof attendanceOperationsDb>,
  organizationId: string,
  schedule: { id: string; group_id: string },
  lessonDate: string,
) {
  const warnings = await db.from("system_notifications").select("id")
    .eq("organization_id", organizationId)
    .eq("event_key", "attendance_missing")
    .eq("entity_id", schedule.id)
    .contains("metadata", { lesson_date: lessonDate })
    .eq("is_read", false);
  if (warnings.error) throw warnings.error;
  if (!warnings.data?.length) return;

  const [eligibility, records] = await Promise.all([
    loadAttendanceEligibility(db, organizationId),
    db.from("attendance_records").select("student_id,schedule_id,group_id,lesson_date")
      .eq("organization_id", organizationId).eq("lesson_date", lessonDate)
      .or(`schedule_id.eq.${schedule.id},and(schedule_id.is.null,group_id.eq.${schedule.group_id})`),
  ]);
  if (records.error) throw records.error;
  if (missingAttendanceStudents(eligibility, schedule, lessonDate, records.data ?? []).length) return;

  const { error } = await db.from("system_notifications")
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq("organization_id", organizationId).eq("is_read", false)
    .in("id", warnings.data.map((warning) => warning.id));
  if (error) throw error;
}
