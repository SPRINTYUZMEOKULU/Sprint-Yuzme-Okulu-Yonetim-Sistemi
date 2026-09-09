import Link from "next/link";

import { requireProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";

import AttendanceClient from "./AttendanceClient";
import "./yoklama-professional.css";

export const dynamic = "force-dynamic";

type ScheduleRow = {
  id: string;
  group_id?: string | null;
  weekday?: number | null;
  start_time?: string | null;
};

function istanbulNow() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Istanbul",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());

  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value || "";

  const weekdayMap: Record<string, number> = {
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
    Sun: 7,
  };

  const hour = Number(part("hour")) || 0;
  const minute = Number(part("minute")) || 0;

  return {
    weekday: weekdayMap[part("weekday")] || 1,
    minutes: hour * 60 + minute,
  };
}

function scheduleStartMinutes(value?: string | null) {
  if (!value) return Number.MAX_SAFE_INTEGER;

  const [hourText, minuteText] = value.split(":");
  const hour = Number(hourText);
  const minute = Number(minuteText);

  if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
    return Number.MAX_SAFE_INTEGER;
  }

  return hour * 60 + minute;
}

function findNearestTodaySchedule(schedules: ScheduleRow[]) {
  const now = istanbulNow();

  const todaySchedules = schedules
    .filter(
      (schedule) =>
        Number(schedule.weekday) === now.weekday &&
        !!schedule.group_id
    )
    .sort(
      (a, b) =>
        scheduleStartMinutes(a.start_time) -
        scheduleStartMinutes(b.start_time)
    );

  if (!todaySchedules.length) return null;

  return (
    todaySchedules.find(
      (schedule) =>
        scheduleStartMinutes(schedule.start_time) >= now.minutes
    ) || todaySchedules[0]
  );
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
      <main
        style={{
          minHeight: "100vh",
          padding: 32,
          background: "#f4f7fb",
          color: "#10213a",
        }}
      >
        <h1>Yoklama</h1>

        <div
          style={{
            marginTop: 20,
            padding: 20,
            background: "#fff",
            border: "1px solid #fecaca",
            borderRadius: 16,
            color: "#991b1b",
          }}
        >
          Kullanıcının organizasyon bilgisi bulunamadı.
        </div>

        <Link
          href="/"
          style={{
            display: "inline-block",
            marginTop: 20,
            color: "#0b6ff4",
            fontWeight: 800,
            textDecoration: "none",
          }}
        >
          ← Yönetim Paneline Dön
        </Link>
      </main>
    );
  }

  const [
    groupsResult,
    schedulesResult,
    membershipsResult,
    studentsResult,
    enrollmentsResult,
    compensationResult,
  ] = await Promise.all([
    supabase
      .from("training_groups")
      .select(
        "id, organization_id, branch_id, name, course_type, capacity, primary_coach_id"
      )
      .eq("organization_id", organizationId)
      .order("sort_order", { ascending: true }),

    supabase
      .from("lesson_schedules")
      .select(
        "id, organization_id, branch_id, group_id, coach_id, weekday, start_time, end_time, is_active"
      )
      .eq("organization_id", organizationId)
      .eq("is_active", true)
      .order("weekday", { ascending: true })
      .order("start_time", { ascending: true }),

    supabase
      .from("student_group_memberships")
      .select(
        "id, student_id, group_id, level_id, started_at, ended_at, is_active"
      )
      .eq("organization_id", organizationId)
      .eq("is_active", true),

    supabase
      .from("students")
      .select(
        "id, first_name, last_name, student_number, phone, email, guardian_name, guardian_phone, guardian_email, swimming_level, medical_note, general_note, preferred_days, preferred_time"
      )
      .eq("organization_id", organizationId)
      .eq("is_deleted", false)
      .order("first_name", { ascending: true }),

    supabase
      .from("student_enrollments")
      .select(
        "id, student_id, group_id, start_date, planned_end_date, total_lessons, used_lessons, status"
      )
      .eq("organization_id", organizationId)
      .eq("status", "active"),

    supabase
      .from("student_compensation_lessons")
      .select(
        "id, organization_id, student_id, enrollment_id, source_request_id, target_group_id, target_schedule_id, lesson_date, status, note, created_by, completed_by, created_at, updated_at, completed_at"
      )
      .eq("organization_id", organizationId)
      .eq("status", "planned")
      .order("lesson_date", { ascending: true }),
  ]);

  const loadError =
    groupsResult.error ||
    schedulesResult.error ||
    membershipsResult.error ||
    studentsResult.error ||
    enrollmentsResult.error ||
    compensationResult.error;

  if (loadError) {
    return (
      <main
        style={{
          minHeight: "100vh",
          padding: 32,
          background: "#f4f7fb",
          color: "#10213a",
        }}
      >
        <h1>Yoklama</h1>

        <div
          style={{
            marginTop: 20,
            padding: 20,
            background: "#fff",
            border: "1px solid #fecaca",
            borderRadius: 16,
            color: "#991b1b",
          }}
        >
          Veriler yüklenemedi: {loadError.message}
        </div>

        <Link
          href="/"
          style={{
            display: "inline-block",
            marginTop: 20,
            color: "#0b6ff4",
            fontWeight: 800,
            textDecoration: "none",
          }}
        >
          ← Yönetim Paneline Dön
        </Link>
      </main>
    );
  }

  const groups = [...(groupsResult.data || [])];
  const schedules = [...(schedulesResult.data || [])];

  /*
   * Kullanıcı belirli bir grup / seans bağlantısından gelmediyse,
   * İstanbul saatine göre bugünün ilk yaklaşan dersini öne alıyoruz.
   * Böylece Yoklama ana sayfadan açıldığında kullanıcı doğrudan sıradaki
   * seansa gelir; isterse grup ve ders seçicilerinden manuel değiştirebilir.
   */
  const nearestSchedule =
    !requestedGroupId && !requestedScheduleId
      ? findNearestTodaySchedule(schedules as ScheduleRow[])
      : null;

  const preferredGroupId =
    requestedGroupId || nearestSchedule?.group_id || "";

  const preferredScheduleId =
    requestedScheduleId || nearestSchedule?.id || "";

  if (preferredGroupId) {
    groups.sort((a, b) => {
      if (a.id === preferredGroupId) return -1;
      if (b.id === preferredGroupId) return 1;
      return 0;
    });
  }

  if (preferredScheduleId) {
    schedules.sort((a, b) => {
      if (a.id === preferredScheduleId) return -1;
      if (b.id === preferredScheduleId) return 1;
      return 0;
    });
  }

  return (
    <main data-attendance-page>
      <div data-attendance-shell>
        <header data-attendance-hero>
          <span data-attendance-kicker>SPRİNTOS · YOKLAMA</span>
          <h1>Yoklama &amp; Ders Yönetimi</h1>
          <p>
            Günlük yoklama alın, ders katılımını takip edin ve kayıt yenileme
            uyarılarını tek ekrandan yönetin.
          </p>
        </header>

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
