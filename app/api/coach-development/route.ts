import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth/profile";
import { attendanceRoster } from "@/lib/attendance/roster";
import { coachStudentScope } from "@/lib/attendance/coach-roster";
import { developmentReportBody, developmentReportTitle, pendingDevelopmentReportTitle } from "@/lib/attendance/development-report";
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
  const internal = input?.kind === "management_note";
  const subject = input?.subject === "guardian" ? "Veli hakkında" : "Öğrenci hakkında";
  const text = typeof input?.body === "string" ? input.body.trim() : "";
  const noteBody = internal ? (text && text.length <= 1500 ? `${subject}\n${text}` : null)
    : input && typeof input === "object" ? developmentReportBody(input) : null;
  const target = internal ? "Kurum içi eğitmen notu" : pendingDevelopmentReportTitle;
  const noteType = internal ? "management" : "coach";
  const { id, studentId, scheduleId, lessonDate } = input || {};
  if (!noteBody || !validId(id) || !validId(studentId) || !validId(scheduleId) ||
      typeof lessonDate !== "string" || !isLessonDate(lessonDate) || lessonDate > sessionClock().date) {
    return NextResponse.json({ error: internal ? "Notu doldurun ve geçerli bir ders tarihi seçin." : "Üç rapor alanını doldurun ve geçerli bir ders tarihi seçin." }, { status: 400 });
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
      note_type: noteType, target, body: noteBody, is_guardian_visible: false,
    }, { onConflict: "id", ignoreDuplicates: true }).select("id").maybeSingle();
    if (note.error) throw note.error;
    if (!note.data) {
      const existing = await db.from("student_notes").select("id").eq("organization_id", org).eq("student_id", studentId)
        .eq("author_id", profile.id).eq("target", target).eq("note_type", noteType).eq("is_guardian_visible", false)
        .eq("body", noteBody).eq("id", id).maybeSingle();
      if (existing.error) throw existing.error;
      if (!existing.data) return NextResponse.json({ error: "Bu rapor kimliği daha önce kullanılmış." }, { status: 409 });
    }

    {
      revalidatePath(`/ogrenciler/${studentId}`);
      try {
        const { data: managers, error: managerError } = await db.from("profiles").select("id")
          .eq("organization_id", org).eq("is_active", true).in("role", ["owner", "admin"]);
        if (managerError) throw managerError;
        if (!managers?.length) return NextResponse.json({ saved: true, recipientCount: 0 });
        const { createNotification } = await import("@/lib/notifications/create-notification");
        const notification = await createNotification({
          organizationId: org, category: "students", eventKey: internal ? "coach_management_note" : "coach_report_pending",
          title: internal ? "Yeni kurum içi eğitmen notu" : "Gelişim raporu onay bekliyor",
          body: internal ? "Eğitmen, öğrenci dosyasına yönetim için bir not ekledi." : "Raporu öğrenci dosyasında inceleyip onaylayabilirsiniz.",
          studentId, sourceType: "student_note", sourceId: id, dedupeKey: `coach-note:${id}`,
          targetPath: `/ogrenciler/${studentId}#not-${id}`, recipientProfileIds: managers.map((manager) => manager.id),
          createdBy: profile.id, push: true,
        });
        if (!notification.ok) throw new Error(notification.message);
        return NextResponse.json({ saved: true, recipientCount: notification.recipientCount });
      } catch {
        return NextResponse.json({ saved: true, notificationError: true });
      }
    }

  } catch (error) {
    console.error("Gelişim raporu kaydetme hatası:", error instanceof Error ? error.message : "database error");
    return NextResponse.json({ error: "Rapor kaydedilemedi. Tekrar deneyin." }, { status: 500 });
  }
}


export async function PATCH(request: NextRequest) {
  const profile = await requireProfile(["owner", "admin"]);
  const org = profile.organization_id;
  if (!org || !profile.is_active || !["owner", "admin"].includes(profile.base_role)) {
    return NextResponse.json({ error: "Rapor onayı için yönetici yetkisi gerekiyor." }, { status: 403 });
  }
  const input = await request.json().catch(() => null);
  if (!validId(input?.id) || !validId(input?.studentId)) {
    return NextResponse.json({ error: "Rapor bilgisi geçersiz." }, { status: 400 });
  }
  const { id, studentId } = input;
  try {
    const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const approved = await db.from("student_notes")
      .update({ target: developmentReportTitle, is_guardian_visible: true })
      .eq("id", id).eq("student_id", studentId).eq("organization_id", org).eq("note_type", "coach")
      .eq("target", pendingDevelopmentReportTitle).eq("is_guardian_visible", false)
      .select("author_id,body").maybeSingle();
    if (approved.error) throw approved.error;
    const published = approved.data ? approved : await db.from("student_notes").select("author_id,body")
      .eq("id", id).eq("student_id", studentId).eq("organization_id", org).eq("note_type", "coach")
      .eq("target", developmentReportTitle).eq("is_guardian_visible", true).maybeSingle();
    if (published.error) throw published.error;
    if (!published.data) return NextResponse.json({ error: "Onaylanabilir rapor bulunamadı." }, { status: 404 });

    for (const path of ["/veli-gelisim", "/veli-mesajlar", "/veli-paneli", `/ogrenciler/${studentId}`]) revalidatePath(path);
    const { createNotification } = await import("@/lib/notifications/create-notification");
    const authorId = published.data.author_id;
    const deliveries = await Promise.allSettled([
      notifySharedNote(org, studentId, id, published.data.body, profile.id, { developmentReport: true }),
      ...(authorId ? [createNotification({
        organizationId: org, category: "reports", eventKey: "coach_report_approved",
        title: "Gelişim raporunuz onaylandı", body: "Raporunuz veli panelinde yayımlandı.",
        sourceType: "student_note", sourceId: id, dedupeKey: `coach-report-approved:${id}`,
        targetPath: "/personel-puantaj", recipientProfileIds: [authorId], createdBy: profile.id, push: true,
      }).then((result) => { if (!result.ok) throw new Error(result.message); })] : []),
    ]);
    return NextResponse.json({ saved: true, notificationError: deliveries.some((result) => result.status === "rejected") });
  } catch (error) {
    console.error("Gelişim raporu onay hatası:", error);
    return NextResponse.json({ error: "Rapor onayı tamamlanamadı." }, { status: 500 });
  }
}
