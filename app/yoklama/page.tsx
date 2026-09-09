import Link from "next/link";

import { requireProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";

import AttendanceClient from "./AttendanceClient";
import "./yoklama-professional.css";

export const dynamic = "force-dynamic";

function todayWeekdayTR() {
  const value = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Istanbul",
    weekday: "short",
  }).format(new Date());

  const map: Record<string, number> = {
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
    Sun: 7,
  };

  return map[value] || 1;
}

function nowMinutesTR() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Istanbul",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());

  const hour = Number(parts.find((part) => part.type === "hour")?.value || 0);
  const minute = Number(parts.find((part) => part.type === "minute")?.value || 0);
  return hour * 60 + minute;
}

function timeMinutes(value?: string | null) {
  if (!value) return 24 * 60;
  const [hour, minute] = value.slice(0, 5).split(":").map(Number);
  return hour * 60 + minute;
}

function minutesUntilNextLesson(
  weekday: number | null | undefined,
  startTime: string | null | undefined,
  todayWeekday: number,
  nowMinutes: number
) {
  const targetWeekday = Number(weekday || 0);
  if (targetWeekday < 1 || targetWeekday > 7) return Number.MAX_SAFE_INTEGER;

  let dayOffset = targetWeekday - todayWeekday;
  if (dayOffset < 0) dayOffset += 7;

  const start = timeMinutes(startTime);
  if (dayOffset === 0 && start < nowMinutes) dayOffset = 7;

  return dayOffset * 1440 + start - nowMinutes;
}

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const requestedGroupId = params.groupId || "";
  const requestedScheduleId = params.scheduleId || "";

  const profile = await requireProfile([
    "owner",
    "admin",
    "branch_manager",
    "registration_staff",
    "accounting",
    "coach",
  ]);

  const supabase = await createClient();
  const organizationId = profile.organization_id;

  if (!organizationId) {
    return (
      <main style={{ minHeight: "100vh", padding: 32, background: "#f4f7fb", color: "#10213a" }}>
        <h1>Yoklama</h1>
        <div style={{ marginTop: 20, padding: 20, background: "#fff", border: "1px solid #fecaca", borderRadius: 16, color: "#991b1b" }}>
          Kullanıcının organizasyon bilgisi bulunamadı.
        </div>
        <Link href="/" style={{ display: "inline-block", marginTop: 20, color: "#0b6ff4", fontWeight: 800, textDecoration: "none" }}>
          ← Yönetim Paneline Dön
        </Link>
      </main>
    );
  }

  const [
    branchesResult,
    groupsResult,
    schedulesResult,
    membershipsResult,
    studentsResult,
    enrollmentsResult,
    compensationResult,
  ] = await Promise.all([
    supabase
      .from("branches")
      .select("id, name, short_name")
      .eq("organization_id", organizationId)
      .eq("is_active", true)
      .order("name", { ascending: true }),
    supabase
      .from("training_groups")
      .select("id, organization_id, branch_id, name, course_type, capacity, primary_coach_id")
      .eq("organization_id", organizationId)
      .order("sort_order", { ascending: true }),
    supabase
      .from("lesson_schedules")
      .select("id, organization_id, branch_id, group_id, coach_id, weekday, start_time, end_time, is_active")
      .eq("organization_id", organizationId)
      .eq("is_active", true)
      .order("weekday", { ascending: true })
      .order("start_time", { ascending: true }),
    supabase
      .from("student_group_memberships")
      .select("id, student_id, group_id, level_id, started_at, ended_at, is_active")
      .eq("organization_id", organizationId)
      .eq("is_active", true),
    supabase
      .from("students")
      .select("id, first_name, last_name, student_number, phone, email, guardian_name, guardian_phone, guardian_email, swimming_level, medical_note, general_note, preferred_days, preferred_time")
      .eq("organization_id", organizationId)
      .eq("is_deleted", false)
      .order("first_name", { ascending: true }),
    supabase
      .from("student_enrollments")
      .select("id, student_id, group_id, start_date, planned_end_date, total_lessons, used_lessons, status")
      .eq("organization_id", organizationId)
      .eq("status", "active"),
    supabase
      .from("student_compensation_lessons")
      .select("id, organization_id, student_id, enrollment_id, source_request_id, target_group_id, target_schedule_id, lesson_date, status, note, created_by, completed_by, created_at, updated_at, completed_at")
      .eq("organization_id", organizationId)
      .eq("status", "planned")
      .order("lesson_date", { ascending: true }),
  ]);

  const loadError =
    branchesResult.error ||
    groupsResult.error ||
    schedulesResult.error ||
    membershipsResult.error ||
    studentsResult.error ||
    enrollmentsResult.error ||
    compensationResult.error;

  if (loadError) {
    return (
      <main style={{ minHeight: "100vh", padding: 32, background: "#f4f7fb", color: "#10213a" }}>
        <h1>Yoklama</h1>
        <div style={{ marginTop: 20, padding: 20, background: "#fff", border: "1px solid #fecaca", borderRadius: 16, color: "#991b1b" }}>
          Veriler yüklenemedi: {loadError.message}
        </div>
        <Link href="/" style={{ display: "inline-block", marginTop: 20, color: "#0b6ff4", fontWeight: 800, textDecoration: "none" }}>
          ← Yönetim Paneline Dön
        </Link>
      </main>
    );
  }

  const branchMap = new Map(
    (branchesResult.data || []).map((branch) => [
      branch.id,
      branch.short_name || branch.name || "Şube",
    ])
  );

  const todayWeekday = todayWeekdayTR();
  const nowMinutes = nowMinutesTR();
  const schedules = [...(schedulesResult.data || [])];

  // En yakın gelecek ders önce görünür. Aynı gün içindeki yaklaşan seanslar
  // geçmiş saatlerden önce gelir; sonra takip eden günler sıralanır.
  schedules.sort((a, b) => {
    if (requestedScheduleId) {
      if (a.id === requestedScheduleId) return -1;
      if (b.id === requestedScheduleId) return 1;
    }

    return (
      minutesUntilNextLesson(a.weekday, a.start_time, todayWeekday, nowMinutes) -
      minutesUntilNextLesson(b.weekday, b.start_time, todayWeekday, nowMinutes)
    );
  });

  const nearestByGroup = new Map<string, number>();
  schedules.forEach((schedule) => {
    if (!schedule.group_id) return;
    const distance = minutesUntilNextLesson(
      schedule.weekday,
      schedule.start_time,
      todayWeekday,
      nowMinutes
    );
    const current = nearestByGroup.get(schedule.group_id);
    if (current === undefined || distance < current) {
      nearestByGroup.set(schedule.group_id, distance);
    }
  });

  // Grup seçimini kolaylaştırmak için şube adını grubun başına ekliyoruz.
  // Böylece tek açılır listede önce şube, ardından gerçek grup/seans adı okunur.
  const groups = (groupsResult.data || []).map((group) => {
    const branchName = group.branch_id ? branchMap.get(group.branch_id) : null;
    const originalName = group.name || "İsimsiz grup";

    return {
      ...group,
      name: branchName && !originalName.toLocaleLowerCase("tr-TR").includes(branchName.toLocaleLowerCase("tr-TR"))
        ? `${branchName} · ${originalName}`
        : originalName,
    };
  });

  groups.sort((a, b) => {
    if (requestedGroupId) {
      if (a.id === requestedGroupId) return -1;
      if (b.id === requestedGroupId) return 1;
    }

    const aDistance = nearestByGroup.get(a.id) ?? Number.MAX_SAFE_INTEGER;
    const bDistance = nearestByGroup.get(b.id) ?? Number.MAX_SAFE_INTEGER;

    if (aDistance !== bDistance) return aDistance - bDistance;

    const aBranch = a.branch_id ? branchMap.get(a.branch_id) || "" : "";
    const bBranch = b.branch_id ? branchMap.get(b.branch_id) || "" : "";
    const branchCompare = aBranch.localeCompare(bBranch, "tr");
    if (branchCompare !== 0) return branchCompare;

    return (a.name || "").localeCompare(b.name || "", "tr");
  });

  return (
    <main data-attendance-page>
      <div data-attendance-shell>
        <div data-attendance-client>
          <AttendanceClient
            groups={groups}
            schedules={schedules}
            memberships={membershipsResult.data || []}
            students={studentsResult.data || []}
            enrollments={enrollmentsResult.data || []}
            compensationLessons={compensationResult.data || []}
          />
        </div>
      </div>
    </main>
  );
}
