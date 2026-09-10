import { NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import { saveAttendance } from "@/app/yoklama/actions";

export const dynamic = "force-dynamic";

function todayTR() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((p) => p.type === type)?.value || "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function isoWeekday(date: string) {
  const day = new Date(`${date}T12:00:00+03:00`).getDay();
  return day === 0 ? 7 : day;
}

export async function POST(request: Request) {
  try {
    const profile = await requireProfile([
      "owner",
      "admin",
      "branch_manager",
      "registration_staff",
      "accounting",
      "coach",
    ]);
    const organizationId = profile.organization_id;
    const body = await request.json().catch(() => ({}));
    const studentId = String(body?.studentId || "").trim();

    if (!studentId) {
      return NextResponse.json({ ok: false, error: "Öğrenci bilgisi eksik." }, { status: 400 });
    }

    const supabase = await createClient();
    const today = todayTR();

    const [{ data: student }, { data: enrollment }, { data: existingAttendance }] = await Promise.all([
      supabase
        .from("students")
        .select("id,status")
        .eq("organization_id", organizationId)
        .eq("id", studentId)
        .eq("is_deleted", false)
        .maybeSingle(),
      supabase
        .from("student_enrollments")
        .select("id,student_id,group_id,branch_id,start_date,status,created_at")
        .eq("organization_id", organizationId)
        .eq("student_id", studentId)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("attendance_records")
        .select("id")
        .eq("organization_id", organizationId)
        .eq("student_id", studentId)
        .limit(1),
    ]);

    if (!student || student.status !== "active") {
      return NextResponse.json({ ok: false, error: "Aktif öğrenci kaydı bulunamadı." }, { status: 404 });
    }
    if (existingAttendance?.length) {
      return NextResponse.json({ ok: true, alreadyStarted: true, message: "Öğrencinin yoklama kaydı zaten mevcut." });
    }
    if (!enrollment?.group_id) {
      return NextResponse.json({ ok: false, error: "Aktif grup kaydı bulunamadı." }, { status: 400 });
    }
    if (enrollment.start_date && enrollment.start_date > today) {
      return NextResponse.json({ ok: false, error: `Başlangıç tarihi henüz gelmedi: ${enrollment.start_date}` }, { status: 400 });
    }

    const weekday = isoWeekday(today);
    const { data: schedules, error: scheduleError } = await supabase
      .from("lesson_schedules")
      .select("id,branch_id,group_id,start_time,end_time,is_active")
      .eq("organization_id", organizationId)
      .eq("group_id", enrollment.group_id)
      .eq("weekday", weekday)
      .eq("is_active", true)
      .order("start_time", { ascending: true });

    if (scheduleError) {
      return NextResponse.json({ ok: false, error: scheduleError.message }, { status: 500 });
    }
    const schedule = schedules?.[0];
    if (!schedule) {
      return NextResponse.json({ ok: false, error: "Bugün için bu gruba ait aktif ders programı bulunamadı." }, { status: 400 });
    }

    const result = await saveAttendance({
      branchId: schedule.branch_id || enrollment.branch_id || null,
      groupId: enrollment.group_id,
      scheduleId: schedule.id,
      coachId: null,
      lessonDate: today,
      records: [
        {
          studentId,
          enrollmentId: enrollment.id,
          status: "present",
          coachNote: "İlk ders Başlangıç Merkezi üzerinden başlatıldı.",
        },
      ],
    });

    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.message || "İlk ders başlatılamadı." }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      message: "İlk ders başlatıldı. Yoklama işlendi ve ders hakkı güncellendi.",
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "İlk ders başlatılamadı." },
      { status: 500 },
    );
  }
}
