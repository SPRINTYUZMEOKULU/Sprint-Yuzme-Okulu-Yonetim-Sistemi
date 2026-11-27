import { attendanceOperationsDb } from "@/lib/attendance/operations-db";
import { formatDisplayDate } from "@/lib/dates/display";

type Attendance = {
  id: string;
  schedule_id: string | null;
  lesson_date: string | null;
  status: string;
};

type Checkin = {
  staff_id: string;
  schedule_id: string;
  lesson_date: string;
  planned_start: string;
  staff: { first_name: string | null; last_name: string | null } | null;
};

async function loadHistory(organizationId: string, attendance: Attendance[]) {
  const lessons = new Map(attendance
    .filter((row) => ["present", "compensation"].includes(row.status) && row.lesson_date)
    .map((row) => [`${row.lesson_date}:${row.schedule_id ?? row.id}`, row]));
  const sessions = [...lessons.values()].filter((row) => row.schedule_id);
  const db = attendanceOperationsDb();
  const matches = new Map<string, Map<string, Checkin>>();
  for (let index = 0; index < sessions.length; index += 25) {
    const batch = sessions.slice(index, index + 25);
    const keys = new Set(batch.map((row) => `${row.lesson_date}:${row.schedule_id}`));
    const scheduleIds = [...new Set(batch.flatMap((row) => row.schedule_id ? [row.schedule_id] : []))];
    const dates = [...new Set(batch.flatMap((row) => row.lesson_date ? [row.lesson_date] : []))];
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await db.from("staff_checkins")
        .select("staff_id,schedule_id,lesson_date,planned_start,staff(first_name,last_name)")
        .eq("organization_id", organizationId)
        .in("schedule_id", scheduleIds).in("lesson_date", dates)
        .in("approval_status", ["approved", "auto_approved"]).not("completed_at", "is", null)
        .order("id").range(offset, offset + 499).returns<Checkin[]>();
      if (error) throw error;
      for (const row of data || []) {
        const key = `${row.lesson_date}:${row.schedule_id}`;
        if (!keys.has(key)) continue;
        const staff = matches.get(key) ?? new Map<string, Checkin>();
        staff.set(row.staff_id, row);
        matches.set(key, staff);
      }
      if ((data?.length ?? 0) < 500) break;
    }
  }

  const instructors = new Map<string, { name: string; lessons: Checkin[] }>();
  const unresolved: { key: string; date: string; reason: string }[] = [];
  for (const [key, lesson] of lessons) {
    const candidates = [...(matches.get(key)?.values() ?? [])];
    if (candidates.length !== 1) {
      unresolved.push({
        key, date: lesson.lesson_date!,
        reason: candidates.length ? "Seansı birden fazla eğitmen tamamlamış" : "Eşleşen onaylı eğitmen kaydı yok",
      });
      continue;
    }
    const entry = candidates[0];
    const name = [entry.staff?.first_name, entry.staff?.last_name].filter(Boolean).join(" ") || "Eğitmen adı bulunamadı";
    const instructor = instructors.get(entry.staff_id) ?? { name, lessons: [] };
    instructor.lessons.push(entry);
    instructors.set(entry.staff_id, instructor);
  }
  return { instructors: [...instructors].sort(([, a], [, b]) => a.name.localeCompare(b.name, "tr")), unresolved };
}

export default async function InstructorLessonHistory({ organizationId, attendance }: {
  organizationId: string;
  attendance: Attendance[] | null;
}) {
  const history = attendance ? await loadHistory(organizationId, attendance).catch((error) => {
    console.error("Eğitmen ders geçmişi alınamadı", error);
    return null;
  }) : null;

  return (
    <details className="panel" id="egitmen-ders-gecmisi">
      <summary><strong>Eğitmenlere göre ders geçmişi</strong></summary>
      <p>Öğrencinin katıldığı normal ve telafi dersleri, aynı seansa ait onaylı ve tamamlanmış eğitmen girişleriyle eşleştirilir.</p>
      {!history ? <p role="status">Ders geçmişi doğrulanamadı. Sayfayı yenileyerek tekrar deneyin.</p> : <>
        <div className="list">
          {history.instructors.map(([id, instructor]) => (
            <article key={id}>
              <div>
                <strong>{instructor.name} · {instructor.lessons.length} ders</strong>
                <ul>
                  {instructor.lessons.sort((a, b) => b.lesson_date.localeCompare(a.lesson_date) ||
                    a.planned_start.localeCompare(b.planned_start)).map((lesson) => (
                    <li key={`${lesson.lesson_date}:${lesson.schedule_id}`}>
                      {formatDisplayDate(lesson.lesson_date)} · {lesson.planned_start.slice(0, 5)}
                    </li>
                  ))}
                </ul>
              </div>
            </article>
          ))}
        </div>
        {!history.instructors.length ? <p>Doğrulanmış eğitmen dersi bulunamadı.</p> : null}
        {history.unresolved.length ? <details>
          <summary>Eğitmeni kesinleşmeyen dersler ({history.unresolved.length})</summary>
          <ul>{history.unresolved.map((row) => (
            <li key={row.key}>{formatDisplayDate(row.date)} · {row.reason}</li>
          ))}</ul>
        </details> : null}
      </>}
    </details>
  );
}
