import Link from "next/link";

import { requireProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";

import AttendanceClient from "./AttendanceClient";

export const dynamic = "force-dynamic";

export default async function AttendancePage() {
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

  return (
    <main
      style={{
        minHeight: "100vh",
        padding: "28px",
        background:
          "linear-gradient(180deg,#f5f8fc 0%,#eef3f9 100%)",
        color: "#10213a",
      }}
    >
      <div
        style={{
          maxWidth: 1500,
          margin: "0 auto",
        }}
      >
        <AttendanceClient
          groups={groupsResult.data || []}
          schedules={schedulesResult.data || []}
          memberships={membershipsResult.data || []}
          students={studentsResult.data || []}
          enrollments={enrollmentsResult.data || []}
          compensationLessons={compensationResult.data || []}
        />
      </div>
    </main>
  );
}
