import type { SupabaseClient } from "@supabase/supabase-js";

export async function activePortalStudentIds(
  admin: SupabaseClient,
  organizationId: string,
  studentIds: string[],
) {
  const eligible = new Set<string>();
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(new Date());

  for (let offset = 0; offset < studentIds.length; offset += 100) {
    const ids = studentIds.slice(offset, offset + 100);
    const [students, frozen] = await Promise.all([
      admin.from("students").select("id").eq("organization_id", organizationId)
        .eq("is_deleted", false).eq("status", "active").in("id", ids),
      admin.from("student_enrollments").select("student_id").eq("organization_id", organizationId)
        .eq("status", "active").eq("freeze_restart_pending", true)
        .lte("freeze_start_date", today).in("student_id", ids),
    ]);
    if (students.error || frozen.error) throw new Error("Kursiyerlerin aktiflik durumu doğrulanamadı.");

    const frozenIds = new Set(frozen.data.map((row) => row.student_id));
    for (const student of students.data) {
      if (!frozenIds.has(student.id)) eligible.add(student.id);
    }
  }
  return eligible;
}
