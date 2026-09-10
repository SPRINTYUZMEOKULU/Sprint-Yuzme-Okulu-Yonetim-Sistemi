import { NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const profile = await requireProfile(["owner", "admin", "branch_manager", "registration_staff", "accounting"]);
    if (!profile.organization_id) return NextResponse.json({ ok: true, items: [] });

    const supabase = await createClient();
    const organizationId = profile.organization_id;

    const { data: students, error: studentError } = await supabase
      .from("students")
      .select("id,first_name,last_name,student_number,status,is_deleted")
      .eq("organization_id", organizationId)
      .eq("is_deleted", false)
      .eq("status", "active");

    if (studentError) throw studentError;
    const ids = (students || []).map((s: any) => s.id);
    if (!ids.length) return NextResponse.json({ ok: true, items: [] });

    const [enrollmentRes, balanceRes, requestRes] = await Promise.all([
      supabase
        .from("student_enrollments")
        .select("id,student_id,total_lessons,used_lessons,start_date,planned_end_date,status,created_at")
        .eq("organization_id", organizationId)
        .in("student_id", ids)
        .eq("status", "active")
        .order("created_at", { ascending: false }),
      supabase
        .from("student_lesson_balance")
        .select("student_id,compensation_lesson_balance")
        .in("student_id", ids),
      supabase
        .from("student_status_change_requests")
        .select("student_id,status,request_type,created_at")
        .eq("organization_id", organizationId)
        .in("student_id", ids)
        .eq("request_type", "deactivate")
        .eq("status", "pending"),
    ]);

    const latestEnrollment = new Map<string, any>();
    for (const row of enrollmentRes.data || []) if (!latestEnrollment.has(row.student_id)) latestEnrollment.set(row.student_id, row);
    const balanceMap = new Map((balanceRes.data || []).map((row: any) => [row.student_id, Number(row.compensation_lesson_balance || 0)]));
    const pendingPassive = new Set((requestRes.data || []).map((row: any) => row.student_id));

    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

    const items = (students || []).flatMap((student: any) => {
      const enrollment = latestEnrollment.get(student.id);
      if (!enrollment) return [];
      const total = Number(enrollment.total_lessons || 0);
      const used = Number(enrollment.used_lessons || 0);
      const compensation = Number(balanceMap.get(student.id) || 0);
      const remaining = Math.max(total - used, 0) + Math.max(compensation, 0);
      const endDate = enrollment.planned_end_date || null;
      const endedByRights = total > 0 && remaining <= 0;
      const endedByDate = Boolean(endDate && endDate <= today);
      if (!endedByRights && !endedByDate) return [];
      return [{
        studentId: student.id,
        studentNumber: student.student_number || null,
        name: `${student.first_name || ""} ${student.last_name || ""}`.trim() || "Kursiyer",
        totalLessons: total,
        usedLessons: used,
        remainingLessons: remaining,
        plannedEndDate: endDate,
        reason: endedByRights ? "Ders hakkı tamamlandı" : "Kayıt dönemi sona erdi",
        passiveRequestPending: pendingPassive.has(student.id),
      }];
    });

    items.sort((a: any, b: any) => String(a.plannedEndDate || "9999-12-31").localeCompare(String(b.plannedEndDate || "9999-12-31")));
    return NextResponse.json({ ok: true, count: items.length, items: items.slice(0, 100) });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Yenileme karar listesi alınamadı." }, { status: 500 });
  }
}
