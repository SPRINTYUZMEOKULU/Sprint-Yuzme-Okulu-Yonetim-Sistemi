import { revalidatePath } from "next/cache";
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

function refreshStudentOperations(studentIds: string[]) {
  for (const route of ["/operasyon-plani", "/yoklama", "/yoklama/aylik", "/yoklama/gecmis", "/ogrenciler", "/raporlar", "/", "/veli-paneli", "/veli-devam"]) revalidatePath(route);
  for (const id of studentIds) revalidatePath(`/ogrenciler/${id}`);
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
    .select("id,branch_id,swimming_level")
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

    const { data: levelRow, error: levelLookupError } = await supabase
      .from("swimming_levels")
      .select("id,name,is_active")
      .eq("organization_id", organizationId)
      .ilike("name", level)
      .limit(1)
      .maybeSingle();

    if (levelLookupError) {
      return NextResponse.json({ error: levelLookupError.message }, { status: 500 });
    }

    let canonicalLevel = levelRow;
    if (canonicalLevel && canonicalLevel.is_active === false) {
      const { data: reactivatedLevel, error: reactivateLevelError } = await supabase
        .from("swimming_levels")
        .update({ is_active: true, updated_at: new Date().toISOString() })
        .eq("id", canonicalLevel.id)
        .eq("organization_id", organizationId)
        .select("id,name,is_active")
        .single();

      if (reactivateLevelError || !reactivatedLevel) {
        return NextResponse.json(
          { error: reactivateLevelError?.message || "Seviye kaydı aktifleştirilemedi." },
          { status: 500 },
        );
      }
      canonicalLevel = reactivatedLevel;
    }

    if (!canonicalLevel) {
      const { data: createdLevel, error: createLevelError } = await supabase
        .from("swimming_levels")
        .insert({
          organization_id: organizationId,
          name: level,
          is_active: true,
          updated_at: new Date().toISOString(),
        })
        .select("id,name,is_active")
        .single();

      if (createLevelError || !createdLevel) {
        return NextResponse.json(
          { error: createLevelError?.message || "Seviye kaydı oluşturulamadı." },
          { status: 500 },
        );
      }
      canonicalLevel = createdLevel;
    }

    const { data: currentMemberships, error: membershipLookupError } = await supabase
      .from("student_group_memberships")
      .select("id,student_id,level_id")
      .eq("organization_id", organizationId)
      .eq("is_active", true)
      .in("student_id", validIds);

    if (membershipLookupError) {
      return NextResponse.json({ error: membershipLookupError.message }, { status: 500 });
    }

    const studentChanges = (validStudents || [])
      .filter((student: any) => student.swimming_level !== canonicalLevel.name)
      .map((student: any) => student.id);
    const membershipChanges = (currentMemberships || [])
      .filter((membership: any) => membership.level_id !== canonicalLevel.id)
      .map((membership: any) => membership.id);

    if (studentChanges.length) {
      const { data, error } = await supabase
        .from("students")
        .update({ swimming_level: canonicalLevel.name })
        .eq("organization_id", organizationId)
        .in("id", studentChanges)
        .select("id");
      if (error || data?.length !== studentChanges.length) {
        return NextResponse.json({ error: error?.message || "Seviye değişikliği doğrulanamadı." }, { status: 500 });
      }
    }

    if (membershipChanges.length) {
      const { data, error } = await supabase
        .from("student_group_memberships")
        .update({ level_id: canonicalLevel.id })
        .eq("organization_id", organizationId)
        .eq("is_active", true)
        .in("id", membershipChanges)
        .select("id");
      if (error || data?.length !== membershipChanges.length) {
        return NextResponse.json({ error: error?.message || "Grup üyeliğindeki seviye doğrulanamadı." }, { status: 500 });
      }
    }

    const changedIds = Array.from(new Set([
      ...studentChanges,
      ...(currentMemberships || [])
        .filter((membership: any) => membershipChanges.includes(membership.id))
        .map((membership: any) => membership.student_id),
    ]));
    if (changedIds.length) await supabase.from("student_timeline_events").insert(
      changedIds.map((studentId) => ({
        organization_id: organizationId,
        student_id: studentId,
        event_type: "level_updated",
        title: "Yüzme seviyesi güncellendi",
        description: canonicalLevel.name,
        created_by: profile.id,
      })),
    );

    const { data: verifiedStudents, error: verifyStudentError } = await supabase
      .from("students")
      .select("id,swimming_level")
      .eq("organization_id", organizationId)
      .in("id", validIds);
    if (verifyStudentError || verifiedStudents?.length !== validIds.length ||
      verifiedStudents.some((student: any) => student.swimming_level !== canonicalLevel.name)) {
      return NextResponse.json({ error: verifyStudentError?.message || "Seviye ataması doğrulanamadı." }, { status: 500 });
    }

    const { data: verifiedMemberships, error: verifyMembershipError } = await supabase
      .from("student_group_memberships").select("id,level_id")
      .eq("organization_id", organizationId).eq("is_active", true).in("student_id", validIds);
    if (verifyMembershipError || verifiedMemberships?.some((row: any) => row.level_id !== canonicalLevel.id)) {
      return NextResponse.json({ error: "Grup üyeliği seviyesi yeniden doğrulanamadı." }, { status: 500 });
    }
    refreshStudentOperations(validIds);

    return NextResponse.json({
      ok: true,
      updated: changedIds.length,
      unchanged: validIds.length - changedIds.length,
      appliedIds: validIds,
      action: "level",
      level_id: canonicalLevel.id,
      level: canonicalLevel.name,
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
    const scheduledStudentIds = new Set(rows.map((row) => row.student_id));
    if (validIds.some((id) => !scheduledStudentIds.has(id))) {
      return NextResponse.json({ error: "Seçili kursiyerlerden en az birinin aktif grup veya seansı yok. Hiçbir eğitmen ataması yapılmadı." }, { status: 400 });
    }

    const { data: savedAssignments, error } = await supabase
      .from("lesson_student_assignments")
      .upsert(rows, { onConflict: "schedule_id,student_id" })
      .select("student_id,schedule_id,coach_id,is_active");

    const expectedAssignments = new Set(rows.map((row) => `${row.student_id}:${row.schedule_id}`));
    const confirmedAssignments = (savedAssignments || []).filter((row: any) =>
      row.coach_id === coachId && row.is_active &&
      expectedAssignments.has(`${row.student_id}:${row.schedule_id}`),
    );
    if (error || confirmedAssignments.length !== rows.length) {
      return NextResponse.json({ error: error?.message || "Toplu eğitmen ataması doğrulanamadı." }, { status: 500 });
    }

    const { data: reread, error: readError } = await supabase
      .from("lesson_student_assignments").select("student_id,schedule_id,coach_id,is_active")
      .eq("organization_id", organizationId).in("student_id", validIds)
      .in("schedule_id", rows.map((row) => row.schedule_id)).eq("is_active", true);
    const readKeys = new Set((reread || []).filter((row: any) => row.coach_id === coachId).map((row: any) => `${row.student_id}:${row.schedule_id}`));
    if (readError || rows.some((row) => !readKeys.has(`${row.student_id}:${row.schedule_id}`))) {
      return NextResponse.json({ error: "Eğitmen kaydı yeniden okunup doğrulanamadı. Seçiminiz korunuyor." }, { status: 500 });
    }
    refreshStudentOperations(validIds);

    const appliedIds = Array.from(new Set(rows.map((row) => row.student_id)));
    await supabase.from("student_timeline_events").insert(
      appliedIds.map((studentId) => ({
        organization_id: organizationId,
        student_id: studentId,
        event_type: "coach_assignment_updated",
        title: "Sorumlu eğitmen güncellendi",
        description: "Operasyon Planı üzerinden kalıcı seans eğitmeni atandı.",
        created_by: profile.id,
      })),
    );

    return NextResponse.json({ ok: true, updated: appliedIds.length, assignments: rows.length, appliedIds, coach_id: coachId, action: "coach" });
  }

  return NextResponse.json({ error: "Geçersiz işlem." }, { status: 400 });
}
