type AttendanceRow = { student_id: string; enrollment_id?: string | null; group_id?: string | null; lesson_date: string; status: string; schedule_id?: string | null; id?: string };

// Exact enrollment links also include makeups after the normal package end.
// Unlinked historical rows need both the current period and group to match.
export function attendanceSummary(rows: AttendanceRow[], enrollment: any) {
  const result = { present: 0, absent: 0, excused: 0 };
  if (!enrollment?.id) return result;
  const seen = new Set<string>();
  for (const row of rows) {
    if (row.student_id !== enrollment.student_id) continue;
    if (row.enrollment_id ? row.enrollment_id !== enrollment.id :
      !enrollment.start_date || row.lesson_date < enrollment.start_date ||
      !enrollment.planned_end_date || row.lesson_date > enrollment.planned_end_date ||
      row.group_id !== enrollment.group_id) continue;
    const key = `${row.lesson_date}:${row.schedule_id || row.group_id || row.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (row.status === "compensation") result.present++;
    else if (row.status === "present" || row.status === "absent" || row.status === "excused") result[row.status]++;
  }
  return result;
}

export async function loadStudentAttendance(client: any, organizationId: string | null, studentIds: string[], columns = "id,student_id,enrollment_id,group_id,schedule_id,lesson_date,status,updated_at") {
  if (!organizationId) return { data: [], error: { message: "Kurum bilgisi bulunamadı." } };
  const data: any[] = [];
  for (let offset = 0;; offset += 500) {
    const result = await client.from("attendance_records").select(columns)
      .eq("organization_id", organizationId).in("student_id", studentIds)
      .order("lesson_date", { ascending: false }).order("updated_at", { ascending: false })
      .order("id").range(offset, offset + 499);
    if (result.error) return { data: [], error: result.error };
    data.push(...(result.data || []));
    if ((result.data || []).length < 500) return { data, error: null };
  }
}
