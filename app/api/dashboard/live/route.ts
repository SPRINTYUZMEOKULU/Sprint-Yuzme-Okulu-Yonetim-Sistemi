import { summarizeSessionSlots } from "@/lib/dashboard/session-summary";
import { attendanceRoster } from "@/lib/attendance/roster";
import { NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import { filterEffectivelyActiveSchedules } from "@/lib/schedules/effective";
import { isScheduleOnDate, scheduleWeekdaysForDate, weekdayForDate } from "@/lib/schedules/weekday";

export const dynamic = "force-dynamic";

function turkeyDateParts() {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = Object.fromEntries(formatter.formatToParts(new Date()).map((part) => [part.type, part.value]));
  const iso = `${parts.year}-${parts.month}-${parts.day}`;
  return { iso, weekday: weekdayForDate(iso), month: Number(parts.month), date: Number(parts.day) };
}

function phoneForWhatsApp(value?: string | null) {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("90")) return digits;
  if (digits.startsWith("0")) return `90${digits.slice(1)}`;
  if (digits.length === 10) return `90${digits}`;
  return digits;
}

export async function GET() {
  const profile = await requireProfile([
    "owner",
    "admin",
    "branch_manager",
    "registration_staff",
    "accounting",
    "coach",
  ]);

  if (!profile.organization_id) {
    return NextResponse.json({ ok: false, error: "Kurum bilgisi bulunamadı." }, { status: 400 });
  }

  const supabase = await createClient();
  const today = turkeyDateParts();

  const [branchesResult, groupsResult, schedulesResult, enrollmentsResult, attendanceResult, attendanceEverResult, transferStartedResult, studentsResult, approvalsResult, cashResult, alertsResult, preregResult, celebrationsResult, membershipsResult, compensationResult, reminderNotesResult] = await Promise.all([
    supabase.from("branches").select("id,name,is_active").eq("organization_id", profile.organization_id).eq("is_active", true),
    supabase.from("training_groups").select("id,branch_id,name,is_active").eq("organization_id", profile.organization_id).eq("is_active", true),
    supabase.from("lesson_schedules").select("id,branch_id,group_id,coach_id,weekday,start_time,end_time,is_active").eq("organization_id", profile.organization_id).in("weekday", scheduleWeekdaysForDate(today.iso)).eq("is_active", true).order("start_time"),
    supabase.from("student_enrollments").select("id,student_id,branch_id,group_id,start_date,created_at,updated_at,lesson_weekdays,total_lessons,used_lessons,status,start_confirmation_required,actual_started_at").eq("organization_id", profile.organization_id).eq("status", "active").order("created_at", { ascending: false }),
    supabase.from("attendance_records").select("id,student_id,group_id,schedule_id,status,lesson_date,coach_note").eq("organization_id", profile.organization_id).eq("lesson_date", today.iso),
    supabase.from("attendance_records").select("student_id").eq("organization_id", profile.organization_id),
    supabase.from("student_activity_logs").select("student_id").eq("organization_id", profile.organization_id).eq("activity_type", "legacy_transfer_manager_confirmed"),
    supabase.from("students").select("id,first_name,last_name,birth_date,phone,guardian_phone,guardian_name,branch_id,status").eq("organization_id", profile.organization_id).eq("is_deleted", false),
    supabase.from("approval_requests").select("id", { count: "exact", head: true }).eq("organization_id", profile.organization_id).eq("status", "pending"),
    supabase.from("payments").select("id", { count: "exact", head: true }).eq("organization_id", profile.organization_id).eq("cash_status", "handoff_pending"),
    supabase.from("alerts").select("id", { count: "exact", head: true }).eq("organization_id", profile.organization_id).eq("status", "open"),
    supabase.from("students").select("id", { count: "exact", head: true }).eq("organization_id", profile.organization_id).eq("status", "pre_registration"),
    supabase.from("birthday_celebrations").select("id,student_id,celebration_year,status,sent_at,sent_by").eq("organization_id", profile.organization_id).eq("celebration_year", Number(today.iso.slice(0, 4))).eq("status", "sent"),
    supabase.from("student_group_memberships").select("student_id,group_id,is_active").eq("organization_id", profile.organization_id).eq("is_active", true),
    supabase.from("student_compensation_lessons").select("student_id,target_group_id,target_schedule_id,lesson_date,status").eq("organization_id", profile.organization_id).eq("status", "planned").eq("lesson_date", today.iso),
    supabase.from("alerts").select("id,title,description,status,created_at")
      .eq("organization_id", profile.organization_id).eq("alert_type", "attendance_reminder")
      .like("description", `${today.iso} · %`).order("created_at", { ascending: false }),
  ]);

  const rosterError = branchesResult.error || groupsResult.error || schedulesResult.error || membershipsResult.error || compensationResult.error || studentsResult.error || enrollmentsResult.error || attendanceResult.error;
  if (rosterError) return NextResponse.json({ ok: false, error: "Yoklama özeti yüklenemedi." }, { status: 500 });

  const branches = branchesResult.data || [];
  const groups = groupsResult.data || [];
  const schedules = filterEffectivelyActiveSchedules(
    schedulesResult.data || [],
    branchesResult.data || [],
    groupsResult.data || []
  );
  const enrollments = enrollmentsResult.data || [];
  const attendance = attendanceResult.data || [];
  const rosterStudents = studentsResult.data || [];
  const students = rosterStudents.filter((student) => student.status === "active");

  const branchMap = new Map(branches.map((row) => [row.id, row.name]));
  const groupMap = new Map(groups.map((row) => [row.id, row.name]));
  const attendedEver = new Set((attendanceEverResult.data || []).map((row: any) => String(row.student_id)).filter(Boolean));
  const transferStarted = new Set((transferStartedResult.data || []).map((row: any) => String(row.student_id)).filter(Boolean));
  const latestEnrollmentByStudent = new Map<string, any>();

  for (const enrollment of enrollments) {
    const studentId = String(enrollment.student_id || "");
    if (studentId && !latestEnrollmentByStudent.has(studentId)) latestEnrollmentByStudent.set(studentId, enrollment);
  }

  const groupSessions = schedules.map((schedule) => {
    const roster = attendanceRoster({students: rosterStudents, enrollments, memberships: membershipsResult.data || [], compensationLessons: compensationResult.data || []}, schedule.group_id || "", schedule.id, today.iso, today.weekday);
    const enrolled = new Set(roster.students.map((student) => student.id));
    const recorded = new Set(
      attendance
        .filter((row) => row.schedule_id === schedule.id || (!row.schedule_id && row.group_id === schedule.group_id))
        .map((row) => row.student_id)
        .filter((studentId) => enrolled.has(studentId))
    );
    const studentCount = enrolled.size;
    const attendanceCount = recorded.size;
    const blockedCount = roster.students.filter((student) => {
      const enrollment = roster.enrollmentByStudent.get(student.id);
      return !recorded.has(student.id) && !roster.compensationIds.has(student.id)
        && Math.max(0, Number(enrollment?.total_lessons || 0) - Number(enrollment?.used_lessons || 0)) <= 0;
    }).length;
    const missingCount = Math.max(0, studentCount - attendanceCount - blockedCount);
    const attendanceComplete = attendanceCount > 0 && missingCount === 0;
    const records = attendance.filter((row) => recorded.has(row.student_id)
      && (row.schedule_id === schedule.id || (!row.schedule_id && row.group_id === schedule.group_id)));
    const statusByStudent = new Map(records.map((row) => [row.student_id, row.status]));
    const statusCounts = { present: 0, absent: 0, excused: 0 };
    for (const status of statusByStudent.values()) {
      if (status === "present" || status === "compensation") statusCounts.present++;
      else if (status === "absent") statusCounts.absent++;
      else if (status === "excused") statusCounts.excused++;
    }

    const branchName = branchMap.get(schedule.branch_id || "") || "Şube";
    const startTime = String(schedule.start_time || "").slice(0, 5);
    const context = `${today.iso} · ${branchName} · ${startTime}`;
    const notes = (reminderNotesResult.data || [])
      .filter((note) => String(note.description || "").split("\n")[0].trim() === context)
      .map((note) => ({ id: note.id, title: note.title, text: String(note.description || "").split("\n").slice(1).join("\n").trim(), status: note.status }));
    for (const row of records) {
      if (!row.coach_note?.trim()) continue;
      const student = rosterStudents.find((student) => student.id === row.student_id);
      notes.push({ id: `attendance-${row.id}`, title: student ? `${student.first_name || ""} ${student.last_name || ""}`.trim() : "Öğrenci yoklama notu", text: row.coach_note.trim(), status: "saved" });
    }

    return {
      id: schedule.id,
      branchId: schedule.branch_id,
      branchName: branchMap.get(schedule.branch_id || "") || "Şube",
      groupId: schedule.group_id,
      groupName: groupMap.get(schedule.group_id || "") || "Grup",
      startTime: String(schedule.start_time || "").slice(0, 5),
      endTime: String(schedule.end_time || "").slice(0, 5),
      studentStates: roster.students.map((student) => {
        const enrollment = roster.enrollmentByStudent.get(student.id);
        return { id: student.id, status: statusByStudent.get(student.id) || null, blocked: !roster.compensationIds.has(student.id) && Math.max(0, Number(enrollment?.total_lessons || 0) - Number(enrollment?.used_lessons || 0)) <= 0 };
      }),
      studentCount,
      attendanceCount,
      attendanceComplete,
      missingCount,
      blockedCount,
      statusCounts,
      notes,
      notesAvailable: !reminderNotesResult.error,
    };
  });

  const sessions = summarizeSessionSlots(groupSessions);

  const celebrationMap = new Map((celebrationsResult.data || []).map((row: any) => [row.student_id, row]));

  const birthdays = students
    .filter((student) => {
      if (!student.birth_date) return false;
      const [, month, day] = String(student.birth_date).split("-").map(Number);
      return month === today.month && day === today.date;
    })
    .map((student) => {
      const birthYear = Number(String(student.birth_date).slice(0, 4));
      const currentYear = Number(today.iso.slice(0, 4));
      const phone = phoneForWhatsApp(student.guardian_phone || student.phone);
      const fullName = `${student.first_name || ""} ${student.last_name || ""}`.trim();
      const message = `🎂 *SPRİNT YÜZME OKULU*\n\nSevgili ${fullName}, doğum gününü kutluyor; sağlık, mutluluk ve başarı dolu nice güzel yaşlar diliyoruz. 🏊‍♂️🎉\n\n*Sprint Yüzme Okulu*`;
      const celebration = celebrationMap.get(student.id) as any;
      return {
        id: student.id,
        name: fullName,
        age: Number.isFinite(birthYear) ? Math.max(0, currentYear - birthYear) : null,
        branchName: branchMap.get(student.branch_id || "") || "",
        whatsappUrl: phone ? `https://wa.me/${phone}?text=${encodeURIComponent(message)}` : null,
        celebrated: Boolean(celebration),
        celebratedAt: celebration?.sent_at || null,
        celebratedBy: celebration?.sent_by || null,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "tr"));

  const pendingAttendance = sessions.filter((session) => session.missingCount > 0).length;

  // Başlangıç onayı bekleyen güncel dönem, eski yoklama ve aktarım geçmişinden
  // bağımsızdır. Başlatılmış dönemler bu sayaçtan çıkarılır.
  const scheduleByGroup = new Map<string, any[]>();
  for (const schedule of schedules) {
    const groupId = String(schedule.group_id || "");
    if (!groupId) continue;
    const rows = scheduleByGroup.get(groupId) || [];
    rows.push(schedule);
    scheduleByGroup.set(groupId, rows);
  }

  const todayStartingStudents = students.filter((student) => {
    const studentId = String(student.id);
    const enrollment = latestEnrollmentByStudent.get(studentId);
    if (!enrollment?.group_id || enrollment.actual_started_at) return false;
    if (!enrollment.start_confirmation_required && (attendedEver.has(studentId) || transferStarted.has(studentId))) return false;
    if (enrollment.start_date && String(enrollment.start_date) > today.iso) return false;

    return (scheduleByGroup.get(String(enrollment.group_id)) || []).some(
      (schedule) => isScheduleOnDate(Number(schedule.weekday), today.iso),
    );
  }).length;

  return NextResponse.json({
    ok: true,
    date: today.iso,
    sessions,
    birthdays,
    summary: {
      todayLessons: sessions.length,
      pendingAttendance,
      birthdays: birthdays.length,
      pendingApprovals: approvalsResult.count || 0,
      pendingCash: cashResult.count || 0,
      openAlerts: alertsResult.count || 0,
      preRegistrations: preregResult.count || 0,
      todayStartingStudents,
    },
  });
}
