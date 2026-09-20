import { NextRequest, NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";

const editRoles = ["owner", "admin", "branch_manager"] as const;

function cleanIds(value: unknown) {
  if (!Array.isArray(value)) return [] as string[];
  return Array.from(
    new Set(
      value
        .map((item) => (typeof item === "string" ? item.trim() : ""))
        .filter(Boolean),
    ),
  ).slice(0, 500);
}


export async function GET() {
  const profile = await requireProfile(["owner", "admin", "branch_manager", "registration_staff", "accounting", "coach"]);
  const organizationId = profile.organization_id;

  if (!organizationId) {
    return NextResponse.json({ error: "Organizasyon bilgisi bulunamadı." }, { status: 400 });
  }

  const supabase = await createClient();
  const [studentsResult, groupsResult, schedulesResult, membershipsResult, branchesResult] = await Promise.all([
    supabase
      .from("students")
      .select("id,birth_date")
      .eq("organization_id", organizationId)
      .eq("is_deleted", false)
      .eq("status", "active"),
    supabase
      .from("training_groups")
      .select("id,name,branch_id,level_id,capacity,course_type,is_active")
      .eq("organization_id", organizationId)
      .eq("is_active", true)
      .order("name"),
    supabase
      .from("lesson_schedules")
      .select("id,group_id,branch_id,weekday,start_time,end_time,is_active")
      .eq("organization_id", organizationId)
      .eq("is_active", true)
      .order("weekday")
      .order("start_time"),
    supabase
      .from("student_group_memberships")
      .select("student_id,group_id")
      .eq("organization_id", organizationId)
      .eq("is_active", true),
    supabase
      .from("branches")
      .select("id,name")
      .eq("organization_id", organizationId)
      .eq("is_active", true),
  ]);

  const error =
    studentsResult.error ||
    groupsResult.error ||
    schedulesResult.error ||
    membershipsResult.error ||
    branchesResult.error;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const counts = new Map<string, number>();
  for (const membership of membershipsResult.data || []) {
    counts.set(membership.group_id, (counts.get(membership.group_id) || 0) + 1);
  }

  const scheduleMap = new Map<string, any[]>();
  for (const schedule of schedulesResult.data || []) {
    const list = scheduleMap.get(schedule.group_id) || [];
    list.push(schedule);
    scheduleMap.set(schedule.group_id, list);
  }

  const branchMap = new Map((branchesResult.data || []).map((item: any) => [item.id, item.name]));

  return NextResponse.json({
    students: studentsResult.data || [],
    groups: (groupsResult.data || []).map((group: any) => ({
      ...group,
      branch_name: branchMap.get(group.branch_id) || null,
      student_count: counts.get(group.id) || 0,
      schedules: scheduleMap.get(group.id) || [],
    })),
  });
}

export async function POST(request: NextRequest) {
  const profile = await requireProfile([...editRoles]);
  const organizationId = profile.organization_id;
  if (!organizationId) {
    return NextResponse.json({ error: "Organizasyon bilgisi bulunamadı." }, { status: 400 });
  }

  const payload = await request.json().catch(() => ({}));
  const action = String(payload.action || "");
  const studentIds = cleanIds(payload.student_ids);

  if (!studentIds.length) {
    return NextResponse.json({ error: "En az bir kursiyer seçilmelidir." }, { status: 400 });
  }

  const supabase = await createClient();

  const { data: validStudents, error: studentError } = await supabase
    .from("students")
    .select("id,branch_id")
    .eq("organization_id", organizationId)
    .eq("is_deleted", false)
    .in("id", studentIds);

  if (studentError) {
    return NextResponse.json({ error: studentError.message }, { status: 500 });
  }

  const validIds = (validStudents || []).map((item: any) => item.id);
  if (!validIds.length) {
    return NextResponse.json({ error: "Seçili kursiyer bulunamadı." }, { status: 404 });
  }

  if (action === "level") {
    const level = typeof payload.level === "string" ? payload.level.trim().slice(0, 100) : "";
    if (!level) {
      return NextResponse.json({ error: "Seviye seçilmelidir." }, { status: 400 });
    }

    const { error } = await supabase
      .from("students")
      .update({ swimming_level: level })
      .eq("organization_id", organizationId)
      .in("id", validIds);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await supabase.from("student_timeline_events").insert(
      validIds.map((studentId) => ({
        organization_id: organizationId,
        student_id: studentId,
        event_type: "level_updated",
        title: "Yüzme seviyesi güncellendi",
        description: level,
        created_by: profile.id,
      })),
    );

    return NextResponse.json({ ok: true, updated: validIds.length, action: "level" });
  }


  if (action === "group") {
    const groupId = typeof payload.group_id === "string" ? payload.group_id.trim() : "";
    if (!groupId) {
      return NextResponse.json({ error: "Grup seçilmelidir." }, { status: 400 });
    }

    const { data: targetGroup, error: groupError } = await supabase
      .from("training_groups")
      .select("id,name,branch_id,level_id,capacity")
      .eq("organization_id", organizationId)
      .eq("id", groupId)
      .eq("is_active", true)
      .maybeSingle();

    if (groupError || !targetGroup) {
      return NextResponse.json({ error: "Seçilen aktif grup bulunamadı." }, { status: 404 });
    }

    const { data: targetSchedules, error: scheduleError } = await supabase
      .from("lesson_schedules")
      .select("id,group_id,branch_id,weekday,start_time,end_time,is_active")
      .eq("organization_id", organizationId)
      .eq("group_id", groupId)
      .eq("is_active", true);

    if (scheduleError) {
      return NextResponse.json({ error: scheduleError.message }, { status: 500 });
    }

    const targetWeekdays = Array.from(
      new Set((targetSchedules || []).map((item: any) => Number(item.weekday)).filter((day) => Number.isInteger(day))),
    );

    const { data: memberships, error: membershipError } = await supabase
      .from("student_group_memberships")
      .select("id,student_id,group_id")
      .eq("organization_id", organizationId)
      .eq("is_active", true)
      .in("student_id", validIds);

    if (membershipError) {
      return NextResponse.json({ error: membershipError.message }, { status: 500 });
    }

    const membershipMap = new Map((memberships || []).map((row: any) => [row.student_id, row]));
    const now = new Date().toISOString();

    for (const studentId of validIds) {
      const current = membershipMap.get(studentId);

      if (current?.id) {
        const { error } = await supabase
          .from("student_group_memberships")
          .update({ group_id: groupId, level_id: targetGroup.level_id || null })
          .eq("id", current.id)
          .eq("organization_id", organizationId);
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      } else {
        const { error } = await supabase.from("student_group_memberships").insert({
          organization_id: organizationId,
          student_id: studentId,
          group_id: groupId,
          level_id: targetGroup.level_id || null,
          started_at: new Date().toISOString().slice(0, 10),
          is_active: true,
        });
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      }

      const { error: studentUpdateError } = await supabase
        .from("students")
        .update({
          branch_id: targetGroup.branch_id,
          preferred_group_id: groupId,
          preferred_days: targetWeekdays.join(","),
          updated_at: now,
        })
        .eq("organization_id", organizationId)
        .eq("id", studentId);

      if (studentUpdateError) {
        return NextResponse.json({ error: studentUpdateError.message }, { status: 500 });
      }

      const { error: enrollmentError } = await supabase
        .from("student_enrollments")
        .update({ group_id: groupId, updated_at: now })
        .eq("organization_id", organizationId)
        .eq("student_id", studentId)
        .eq("status", "active");

      if (enrollmentError) {
        return NextResponse.json({ error: enrollmentError.message }, { status: 500 });
      }

      await supabase
        .from("student_attendance_plans")
        .update({
          group_id: groupId,
          selected_weekdays: targetWeekdays,
          weekly_frequency: targetWeekdays.length,
          updated_by: profile.id,
          updated_at: now,
        })
        .eq("organization_id", organizationId)
        .eq("student_id", studentId)
        .eq("is_active", true);

      await supabase
        .from("lesson_student_assignments")
        .delete()
        .eq("organization_id", organizationId)
        .eq("student_id", studentId);

      const chosenCoachId =
        typeof payload.coach_id === "string" && payload.coach_id.trim()
          ? payload.coach_id.trim()
          : null;

      if ((targetSchedules || []).length) {
        const rows = (targetSchedules || []).map((schedule: any) => ({
          organization_id: organizationId,
          branch_id: schedule.branch_id || targetGroup.branch_id || null,
          schedule_id: schedule.id,
          group_id: groupId,
          student_id: studentId,
          coach_id: chosenCoachId,
          assignment_type: "session",
          is_active: true,
          updated_at: now,
        }));

        const { error: assignmentError } = await supabase
          .from("lesson_student_assignments")
          .upsert(rows, { onConflict: "schedule_id,student_id" });

        if (assignmentError) {
          return NextResponse.json({ error: assignmentError.message }, { status: 500 });
        }
      }
    }

    await supabase.from("student_timeline_events").insert(
      validIds.map((studentId) => ({
        organization_id: organizationId,
        student_id: studentId,
        event_type: "group_updated",
        title: "Eğitim grubu güncellendi",
        description: `Operasyon Planı üzerinden ${targetGroup.name} grubuna atandı.`,
        created_by: profile.id,
      })),
    );

    return NextResponse.json({
      ok: true,
      updated: validIds.length,
      action: "group",
      group_id: groupId,
      group_name: targetGroup.name,
    });
  }

  if (action === "coach") {
    const coachId = typeof payload.coach_id === "string" ? payload.coach_id.trim() : "";
    if (!coachId) {
      return NextResponse.json({ error: "Eğitmen seçilmelidir." }, { status: 400 });
    }

    const { data: coach, error: coachError } = await supabase
      .from("profiles")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("id", coachId)
      .eq("is_active", true)
      .maybeSingle();

    if (coachError || !coach) {
      return NextResponse.json({ error: "Seçilen eğitmen bulunamadı." }, { status: 404 });
    }

    const { data: memberships, error: membershipError } = await supabase
      .from("student_group_memberships")
      .select("student_id,group_id")
      .eq("organization_id", organizationId)
      .eq("is_active", true)
      .in("student_id", validIds);

    if (membershipError) {
      return NextResponse.json({ error: membershipError.message }, { status: 500 });
    }

    const groupIds = Array.from(
      new Set((memberships || []).map((item: any) => item.group_id).filter(Boolean)),
    );

    if (!groupIds.length) {
      return NextResponse.json({ error: "Seçili kursiyerlerin aktif grubu bulunamadı." }, { status: 400 });
    }

    const { data: schedules, error: scheduleError } = await supabase
      .from("lesson_schedules")
      .select("id,group_id,branch_id")
      .eq("organization_id", organizationId)
      .eq("is_active", true)
      .in("group_id", groupIds);

    if (scheduleError) {
      return NextResponse.json({ error: scheduleError.message }, { status: 500 });
    }

    const membershipMap = new Map(
      (memberships || []).map((item: any) => [item.student_id, item.group_id]),
    );

    const rows: any[] = [];
    for (const studentId of validIds) {
      const groupId = membershipMap.get(studentId);
      if (!groupId) continue;
      for (const schedule of (schedules || []) as any[]) {
        if (schedule.group_id !== groupId) continue;
        rows.push({
          organization_id: organizationId,
          branch_id: schedule.branch_id || null,
          schedule_id: schedule.id,
          group_id: groupId,
          student_id: studentId,
          coach_id: coachId,
          assignment_type: "session",
          is_active: true,
          updated_at: new Date().toISOString(),
        });
      }
    }

    if (!rows.length) {
      return NextResponse.json({ error: "Atama yapılabilecek aktif seans bulunamadı." }, { status: 400 });
    }

    const { error } = await supabase
      .from("lesson_student_assignments")
      .upsert(rows, { onConflict: "schedule_id,student_id" });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await supabase.from("student_timeline_events").insert(
      validIds.map((studentId) => ({
        organization_id: organizationId,
        student_id: studentId,
        event_type: "coach_assignment_updated",
        title: "Sorumlu eğitmen güncellendi",
        description: "Operasyon Planı üzerinden kalıcı seans eğitmeni atandı.",
        created_by: profile.id,
      })),
    );

    return NextResponse.json({ ok: true, updated: validIds.length, assignments: rows.length, action: "coach" });
  }

  return NextResponse.json({ error: "Geçersiz işlem." }, { status: 400 });
}
