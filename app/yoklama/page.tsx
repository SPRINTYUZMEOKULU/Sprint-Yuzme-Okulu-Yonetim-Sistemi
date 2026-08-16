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

  const [
    groupsResult,
    schedulesResult,
    membershipsResult,
    studentsResult,
    enrollmentsResult,
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
      .select("id, first_name, last_name, student_number")
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
  ]);

  const loadError =
    groupsResult.error ||
    schedulesResult.error ||
    membershipsResult.error ||
    studentsResult.error ||
    enrollmentsResult.error;

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
          }}
        >
          ← Yönetim Paneline Dön
        </Link>
      </main>
    );
  }

  const groups = groupsResult.data || [];
  const schedules = schedulesResult.data || [];
  const memberships = membershipsResult.data || [];
  const students = studentsResult.data || [];
  const enrollments = enrollmentsResult.data || [];

  return (
    <main
      style={{
        minHeight: "100vh",
        padding: "32px",
        background:
          "linear-gradient(180deg,#f5f8fc 0%,#eef3f9 100%)",
        color: "#10213a",
      }}
    >
      <div
        style={{
          maxWidth: 1450,
          margin: "0 auto",
        }}
      >
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 20,
            marginBottom: 24,
            flexWrap: "wrap",
          }}
        >
          <div>
            <div
              style={{
                color: "#0b6ff4",
                fontSize: 12,
                fontWeight: 900,
                letterSpacing: ".12em",
              }}
            >
              SPRINTOS · YOKLAMA
            </div>

            <h1
              style={{
                margin: "6px 0 0",
                fontSize: 34,
                color: "#102f55",
              }}
            >
              Günlük Yoklama
            </h1>

            <p
              style={{
                margin: "8px 0 0",
                color: "#6b7b8f",
                fontSize: 14,
              }}
            >
              Şube, grup ve seans seçerek öğrencilerin günlük
              yoklamasını kaydedin.
            </p>
          </div>

          <Link
            href="/"
            style={{
              textDecoration: "none",
              padding: "12px 17px",
              borderRadius: 12,
              background: "#fff",
              color: "#15385f",
              border: "1px solid #dce5ee",
              fontWeight: 900,
              boxShadow: "0 5px 15px rgba(15,42,76,.06)",
            }}
          >
            ← Yönetim Paneli
          </Link>
        </header>

        <AttendanceClient
          organizationId={organizationId}
          currentProfileId={profile.id}
          groups={groups}
          schedules={schedules}
          memberships={memberships}
          students={students}
          enrollments={enrollments}
        />
      </div>
    </main>
  );
}
