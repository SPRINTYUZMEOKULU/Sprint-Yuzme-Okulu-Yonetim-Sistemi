import Link from "next/link";

import { requireProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";

import SessionAttendanceClient from "./session-attendance-client";
import "./session-attendance.css";
import "./session-attendance-nav.css";

export const dynamic = "force-dynamic";

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const profile = await requireProfile([
    "owner",
    "admin",
    "branch_manager",
    "registration_staff",
    "accounting",
    "coach",
  ]);

  const organizationId = profile.organization_id;
  const supabase = await createClient();

  if (!organizationId) {
    return (
      <main style={{ minHeight: "100vh", padding: 32, background: "#f4f7fb", color: "#10213a" }}>
        <h1>Yoklama</h1>
        <p>Organizasyon bilgisi bulunamadı.</p>
        <Link href="/">← Yönetim Paneline Dön</Link>
      </main>
    );
  }

  const [
    branches,
    groups,
    schedules,
    memberships,
    students,
    enrollments,
    compensation,
    profiles,
    levels,
    attendanceHistory,
    staffAssignments,
  ] = await Promise.all([
    supabase.from("branches").select("id,name,short_name").eq("organization_id", organizationId).eq("is_active", true).order("name"),
    supabase.from("training_groups").select("id,branch_id,level_id,name,course_type,capacity,primary_coach_id,is_active").eq("organization_id", organizationId).eq("is_active", true).order("sort_order"),
    supabase.from("lesson_schedules").select("id,branch_id,group_id,coach_id,weekday,start_time,end_time,is_active").eq("organization_id", organizationId).eq("is_active", true).order("weekday").order("start_time"),
    supabase.from("student_group_memberships").select("student_id,group_id,level_id,is_active").eq("organization_id", organizationId).eq("is_active", true),
    supabase.from("students").select("id,first_name,last_name,student_number,phone,guardian_phone,swimming_level,medical_note,general_note").eq("organization_id", organizationId).eq("is_deleted", false).order("first_name"),
    supabase.from("student_enrollments").select("id,student_id,group_id,start_date,planned_end_date,total_lessons,used_lessons,status").eq("organization_id", organizationId).eq("status", "active"),
    supabase.from("student_compensation_lessons").select("student_id,target_group_id,target_schedule_id,lesson_date,status").eq("organization_id", organizationId).eq("status", "planned"),
    supabase.from("profiles").select("id,full_name").eq("organization_id", organizationId),
    supabase.from("swimming_levels").select("id,name").eq("organization_id", organizationId).order("sort_order"),
    supabase.from("attendance_records").select("student_id,group_id,lesson_date,status").eq("organization_id", organizationId).order("lesson_date", { ascending: false }).limit(3000),
    supabase.from("lesson_staff_assignments").select("schedule_id,group_id,coach_id,sort_order,is_active").eq("organization_id", organizationId).eq("is_active", true).order("sort_order"),
  ]);

  const error =
    branches.error ||
    groups.error ||
    schedules.error ||
    memberships.error ||
    students.error ||
    enrollments.error ||
    compensation.error ||
    profiles.error ||
    levels.error ||
    attendanceHistory.error ||
    staffAssignments.error;

  if (error) {
    return (
      <main style={{ minHeight: "100vh", padding: 32, background: "#f4f7fb", color: "#10213a" }}>
        <h1>Yoklama</h1>
        <div style={{ marginTop: 18, padding: 18, background: "#fff", border: "1px solid #fecaca", borderRadius: 14, color: "#991b1b" }}>
          Veriler yüklenemedi: {error.message}
        </div>
      </main>
    );
  }

  const baseSchedules = schedules.data || [];
  const scheduleById = new Map(baseSchedules.map((item) => [item.id, item]));
  const assignmentSchedules = (staffAssignments.data || [])
    .map((assignment, index) => {
      const source = scheduleById.get(assignment.schedule_id);
      if (!source || !assignment.coach_id) return null;
      return {
        ...source,
        id: `${source.id}__staff__${assignment.coach_id}__${index}`,
        group_id: assignment.group_id || source.group_id,
        coach_id: assignment.coach_id,
      };
    })
    .filter(Boolean);

  const visibleSchedules = [...baseSchedules, ...assignmentSchedules];

  return (
    <>
      <nav className="saTopNav" aria-label="Yoklama hızlı erişim">
        <Link href="/operasyon-plani" className="saTopNavItem">
          <span className="saTopNavIcon">←</span>
          <span><b>Geri</b><small>Operasyon Planı</small></span>
        </Link>
        <Link href="/yoklama" className="saTopNavItem active">
          <span className="saTopNavIcon">✓</span>
          <span><b>Bugün</b><small>Günlük Yoklama</small></span>
        </Link>
        <Link href="/raporlar" className="saTopNavItem">
          <span className="saTopNavIcon">▦</span>
          <span><b>Tüm Ayı Gör</b><small>Aylık Yoklama</small></span>
        </Link>
        <Link href="/raporlar" className="saTopNavItem">
          <span className="saTopNavIcon">↶</span>
          <span><b>Geçmiş</b><small>Ders Kayıtları</small></span>
        </Link>
      </nav>

      <SessionAttendanceClient
        branches={branches.data || []}
        groups={groups.data || []}
        schedules={visibleSchedules as any}
        memberships={memberships.data || []}
        students={students.data || []}
        enrollments={enrollments.data || []}
        compensationLessons={compensation.data || []}
        profiles={profiles.data || []}
        levels={levels.data || []}
        attendanceHistory={attendanceHistory.data || []}
        initialBranchId={params.branchId || ""}
      />
    </>
  );
}
