import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth/profile";
import { attendanceRoster } from "@/lib/attendance/roster";
import { coachStudentScope } from "@/lib/attendance/coach-roster";
import { developmentReportBody, developmentReportTitle } from "@/lib/attendance/development-report";
import { cancellationSummary } from "@/lib/dashboard/cancellation-summary";
import { loadAttendanceEligibility } from "@/lib/notifications/attendance-eligibility";
import { isLessonDate, loadPersonnelSessions, sessionClock } from "@/lib/personnel/sessions";
import { notifySharedNote } from "@/lib/guardian/note-sharing";

function validId(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value);
}

export async function POST(request: NextRequest) {
  const profile = await requireProfile(["coach"]);
  const org = profile.organization_id;
  if (!org || !profile.is_active || profile.base_role !== "coach") {
    return NextResponse.json({ error: "Bu işlem için aktif bir eğitmen hesabı gerekiyor." }, { status: 403 });
  }
  const input = await request.json().catch(() => null);
  const noteBody = input && typeof input === "object" ? developmentReportBody(input) : null;
  const { id, studentId, scheduleId, lessonDate } = input || {};
  if (!noteBody || !validId(id) || !validId(studentId) || !validId(scheduleId) ||
      typeof lessonDate !== "string" || !isLessonDate(lessonDate) || lessonDate > sessionClock().date) {
    return NextResponse.json({ error: "Üç rapor alanını doldurun ve geçerli bir ders tarihi seçin." }, { status: 400 });
  }

  try {
    const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const [staff, sessions, eligibility] = await Promise.all([
      db.from("staff").select("id").eq("organization_id", org).eq("auth_user_id", profile.id)
        .eq("is_active", true).eq("login_enabled", true).maybeSingle(),
      loadPersonnelSessions(db, org, lessonDate),
      loadAttendanceEligibility(db, org),
    ]);
    if (staff.error) throw staff.error;
    const session = sessions.find((row) => row.id === scheduleId);
    if (!staff.data || !session) {
      return NextResponse.json({ error: "Eğitmen hesabı veya seans doğrulanamadı." }, { status: 403 });
    }
    const assignments = await db.from("lesson_student_assignments").select("schedule_id, group_id, student_id, coach_id")
      .eq("organization_id", org).eq("is_active", true).eq("student_id", studentId)
      .or(`schedule_id.eq.${scheduleId},and(schedule_id.is.null,group_id.eq.${session.group_id})`);
    if (assignments.error) throw assignments.error;

    const coachIds = new Set([staff.data.id, profile.id]);
    const assigned = [...coachIds].some((coachId) => session.coaches.has(coachId));
    const allowed = coachStudentScope(assignments.data || [], session.id, session.group_id, coachIds, assigned, [studentId]);
    const roster = attendanceRoster(
      session.makeup_date ? { ...eligibility, memberships: [] } : eligibility,
      session.group_id, scheduleId, lessonDate, session.weekday || 7,
    );
    const cancelled = cancellationSummary(scheduleId, lessonDate, eligibility.cancellations, []).studentIds;
    if ((allowed && !allowed.includes(studentId)) ||
        !roster.students.some((student) => student.id === studentId && student.status === "active") ||
        cancelled.includes(studentId)) {
      return NextResponse.json({ error: "Yalnızca bu seanstaki kendi öğrencilerinize rapor gönderebilirsiniz." }, { status: 403 });
    }

    const note = await db.from("student_notes").upsert({
      id, organization_id: org, student_id: studentId, author_id: profile.id,
      note_type: "coach", target: developmentReportTitle, body: noteBody, is_guardian_visible: true,
    }, { onConflict: "id", ignoreDuplicates: true }).select("id").maybeSingle();
    if (note.error) throw note.error;
    if (!note.data) {
      const existing = await db.from("student_notes").select("id").eq("organization_id", org).eq("student_id", studentId)
        .eq("author_id", profile.id).eq("target", developmentReportTitle).eq("note_type", "coach").eq("is_guardian_visible", true)
        .eq("body", noteBody).eq("id", id).maybeSingle();
      if (existing.error) throw existing.error;
      if (!existing.data) return NextResponse.json({ error: "Bu rapor kimliği daha önce kullanılmış." }, { status: 409 });
    }

    for (const path of ["/veli-gelisim", "/veli-mesajlar", "/veli-paneli", `/ogrenciler/${studentId}`]) revalidatePath(path);
    try {
      const notification = await notifySharedNote(org, studentId, id, noteBody, profile.id, { developmentReport: true });
      return NextResponse.json({ saved: true, recipientCount: notification.count });
    } catch (error) {
      console.error("Gelişim raporu bildirim hatası:", error instanceof Error ? error.message : "unknown");
      return NextResponse.json({ saved: true, notificationError: true });
    }
  } catch (error) {
    console.error("Gelişim raporu kaydetme hatası:", error instanceof Error ? error.message : "database error");
    return NextResponse.json({ error: "Rapor kaydedilemedi. Tekrar deneyin." }, { status: 500 });
  }
}
