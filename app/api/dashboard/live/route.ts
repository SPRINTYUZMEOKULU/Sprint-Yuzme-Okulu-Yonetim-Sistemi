import { NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";

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
  const day = new Date(`${iso}T12:00:00+03:00`).getDay();
  return { iso, weekday: day === 0 ? 7 : day, month: Number(parts.month), date: Number(parts.day) };
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

  const [branchesResult, groupsResult, schedulesResult, enrollmentsResult, attendanceResult, studentsResult, approvalsResult, cashResult, alertsResult, preregResult] = await Promise.all([
    supabase.from("branches").select("id,name,is_active").eq("organization_id", profile.organization_id).eq("is_active", true),
    supabase.from("training_groups").select("id,branch_id,name,is_active").eq("organization_id", profile.organization_id).eq("is_active", true),
    supabase.from("lesson_schedules").select("id,branch_id,group_id,coach_id,weekday,start_time,end_time,is_active").eq("organization_id", profile.organization_id).eq("weekday", today.weekday).eq("is_active", true).order("start_time"),
    supabase.from("student_enrollments").select("id,student_id,branch_id,group_id,status").eq("organization_id", profile.organization_id).eq("status", "active"),
    supabase.from("attendance_records").select("id,student_id,group_id,schedule_id,status,lesson_date").eq("organization_id", profile.organization_id).eq("lesson_date", today.iso),
    supabase.from("students").select("id,first_name,last_name,birth_date,phone,guardian_phone,guardian_name,branch_id,status").eq("organization_id", profile.organization_id).eq("status", "active"),
    supabase.from("approval_requests").select("id", { count: "exact", head: true }).eq("organization_id", profile.organization_id).eq("status", "pending"),
    supabase.from("payments").select("id", { count: "exact", head: true }).eq("organization_id", profile.organization_id).eq("cash_status", "handoff_pending"),
    supabase.from("alerts").select("id", { count: "exact", head: true }).eq("organization_id", profile.organization_id).eq("status", "open"),
    supabase.from("students").select("id", { count: "exact", head: true }).eq("organization_id", profile.organization_id).eq("status", "pre_registration"),
  ]);

  const branches = branchesResult.data || [];
  const groups = groupsResult.data || [];
  const schedules = schedulesResult.data || [];
  const enrollments = enrollmentsResult.data || [];
  const attendance = attendanceResult.data || [];
  const students = studentsResult.data || [];

  const branchMap = new Map(branches.map((row) => [row.id, row.name]));
  const groupMap = new Map(groups.map((row) => [row.id, row.name]));
  const enrolledByGroup = new Map<string, Set<string>>();

  for (const enrollment of enrollments) {
    if (!enrollment.group_id) continue;
    if (!enrolledByGroup.has(enrollment.group_id)) enrolledByGroup.set(enrollment.group_id, new Set());
    enrolledByGroup.get(enrollment.group_id)?.add(enrollment.student_id);
  }

  const sessions = schedules.map((schedule) => {
    const enrolled = enrolledByGroup.get(schedule.group_id || "") || new Set<string>();
    const recorded = new Set(
      attendance
        .filter((row) => row.schedule_id === schedule.id || (!row.schedule_id && row.group_id === schedule.group_id))
        .map((row) => row.student_id)
    );
    const studentCount = enrolled.size;
    const attendanceCount = recorded.size;
    const attendanceComplete = studentCount > 0 && attendanceCount >= studentCount;

    return {
      id: schedule.id,
      branchId: schedule.branch_id,
      branchName: branchMap.get(schedule.branch_id || "") || "Şube",
      groupId: schedule.group_id,
      groupName: groupMap.get(schedule.group_id || "") || "Grup",
      startTime: String(schedule.start_time || "").slice(0, 5),
      endTime: String(schedule.end_time || "").slice(0, 5),
      studentCount,
      attendanceCount,
      attendanceComplete,
    };
  });

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
      return {
        id: student.id,
        name: fullName,
        age: Number.isFinite(birthYear) ? Math.max(0, currentYear - birthYear) : null,
        branchName: branchMap.get(student.branch_id || "") || "",
        whatsappUrl: phone ? `https://wa.me/${phone}?text=${encodeURIComponent(message)}` : null,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "tr"));

  const pendingAttendance = sessions.filter((session) => !session.attendanceComplete).length;

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
    },
  });
}
