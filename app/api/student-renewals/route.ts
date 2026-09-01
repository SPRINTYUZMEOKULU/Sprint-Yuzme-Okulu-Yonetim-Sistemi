import { NextRequest, NextResponse } from "next/server";

import { requireProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";

const ROLES = [
  "owner",
  "admin",
  "branch_manager",
  "registration_staff",
] as const;

function isoDate(value: unknown) {
  const text = String(value || "");
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}

function calculateEndDate(
  startDate: string,
  lessonCount: number,
  weekdays: number[],
) {
  const selected = new Set(weekdays);
  const cursor = new Date(`${startDate}T12:00:00`);
  let count = 0;
  let guard = 0;

  while (count < lessonCount && guard < 730) {
    const jsDay = cursor.getDay();
    const isoDay = jsDay === 0 ? 7 : jsDay;
    if (selected.has(isoDay)) count += 1;
    if (count < lessonCount) cursor.setDate(cursor.getDate() + 1);
    guard += 1;
  }

  return cursor.toISOString().slice(0, 10);
}

export async function POST(request: NextRequest) {
  try {
    const profile = await requireProfile([...ROLES]);
    const body = await request.json();
    const organizationId = profile.organization_id;
    const studentId = String(body.studentId || "");
    const startDate = isoDate(body.startDate);
    const paymentDueDate = isoDate(body.paymentDueDate) || startDate;
    const lessonCount = Math.floor(Number(body.lessonCount));

    if (
      !organizationId ||
      !studentId ||
      !startDate ||
      lessonCount < 1 ||
      lessonCount > 200
    ) {
      return NextResponse.json(
        {
          error: "Öğrenci, başlangıç tarihi ve geçerli ders sayısı zorunludur.",
        },
        { status: 400 },
      );
    }

    const supabase = await createClient();
    const [{ data: student }, { data: activeEnrollment }] = await Promise.all([
      supabase
        .from("students")
        .select(
          "id,first_name,last_name,branch_id,preferred_group_id,preferred_package_id",
        )
        .eq("organization_id", organizationId)
        .eq("id", studentId)
        .maybeSingle(),
      supabase
        .from("student_enrollments")
        .select("*")
        .eq("organization_id", organizationId)
        .eq("student_id", studentId)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    if (!student) {
      return NextResponse.json(
        { error: "Öğrenci bulunamadı." },
        { status: 404 },
      );
    }

    const packageId = String(
      body.packageId ||
        activeEnrollment?.package_id ||
        student.preferred_package_id ||
        "",
    );
    const groupId = String(
      body.groupId ||
        activeEnrollment?.group_id ||
        student.preferred_group_id ||
        "",
    );
    const branchId = String(
      body.branchId || activeEnrollment?.branch_id || student.branch_id || "",
    );

    if (!packageId || !groupId || !branchId) {
      return NextResponse.json(
        { error: "Yenileme için paket, grup ve şube bilgisi eksik." },
        { status: 400 },
      );
    }

    const { data: schedules, error: scheduleError } = await supabase
      .from("lesson_schedules")
      .select("id,weekday")
      .eq("organization_id", organizationId)
      .eq("group_id", groupId)
      .eq("is_active", true);

    if (scheduleError) throw scheduleError;

    const weekdays = Array.from(
      new Set(
        (schedules || [])
          .map((row) => Number(row.weekday))
          .filter((day) => day >= 1 && day <= 7),
      ),
    );

    if (!weekdays.length) {
      return NextResponse.json(
        { error: "Seçilen grubun aktif ders programı bulunamadı." },
        { status: 400 },
      );
    }

    const plannedEndDate = calculateEndDate(startDate, lessonCount, weekdays);
    const now = new Date().toISOString();

    const { data: newEnrollment, error: insertError } = await supabase
      .from("student_enrollments")
      .insert({
        organization_id: organizationId,
        student_id: studentId,
        package_id: packageId,
        group_id: groupId,
        branch_id: branchId,
        start_date: startDate,
        planned_end_date: plannedEndDate,
        payment_due_date: paymentDueDate,
        lesson_weekdays: weekdays,
        weekly_frequency: weekdays.length,
        total_lessons: lessonCount,
        used_lessons: 0,
        status: "renewal_pending",
        created_at: now,
        updated_at: now,
      })
      .select("id")
      .single();

    if (insertError) throw insertError;

    if (activeEnrollment?.id) {
      const { error: closeError } = await supabase
        .from("student_enrollments")
        .update({ status: "completed", updated_at: now })
        .eq("organization_id", organizationId)
        .eq("id", activeEnrollment.id);

      if (closeError) {
        await supabase
          .from("student_enrollments")
          .delete()
          .eq("id", newEnrollment.id);
        throw closeError;
      }
    }

    const { error: activateError } = await supabase
      .from("student_enrollments")
      .update({ status: "active", updated_at: now })
      .eq("organization_id", organizationId)
      .eq("id", newEnrollment.id);

    if (activateError) throw activateError;

    await Promise.all([
      supabase.from("student_renewal_events").insert({
        organization_id: organizationId,
        student_id: studentId,
        previous_enrollment_id: activeEnrollment?.id || null,
        new_enrollment_id: newEnrollment.id,
        renewal_status: "completed",
        note:
          String(body.note || "")
            .trim()
            .slice(0, 1000) || null,
        created_by: profile.id,
      }),
      supabase
        .from("students")
        .update({
          status: "active",
          branch_id: branchId,
          preferred_group_id: groupId,
          preferred_package_id: packageId,
          updated_at: now,
        })
        .eq("organization_id", organizationId)
        .eq("id", studentId),
      supabase.from("student_activity_logs").insert({
        organization_id: organizationId,
        student_id: studentId,
        activity_type: "registration_renewed",
        title: "Kayıt yenilendi",
        description: `${lessonCount} derslik yeni dönem ${startDate} tarihinde başlayacak. Planlanan bitiş: ${plannedEndDate}.`,
        source_type: "student_renewal",
        source_id: newEnrollment.id,
        new_value: {
          enrollment_id: newEnrollment.id,
          lesson_count: lessonCount,
        },
        performed_at: now,
      }),
      supabase.from("system_notifications").insert({
        organization_id: organizationId,
        category: "registration",
        event_key: "student_registration_renewed",
        title: "Öğrenci kaydı yenilendi",
        message:
          `${student.first_name || ""} ${student.last_name || ""} için ${lessonCount} derslik yeni dönem oluşturuldu.`.trim(),
        severity: "success",
        entity_type: "student",
        entity_id: studentId,
        is_read: false,
        target_path: `/ogrenciler/${studentId}`,
        created_by: profile.id,
        metadata: { enrollment_id: newEnrollment.id },
      }),
    ]);

    return NextResponse.json({
      ok: true,
      message: `Kayıt yenilendi. Yeni bitiş tarihi: ${plannedEndDate}`,
      enrollmentId: newEnrollment.id,
    });
  } catch (error) {
    console.error("student renewal POST error", error);
    return NextResponse.json(
      { error: "Kayıt yenileme tamamlanamadı." },
      { status: 500 },
    );
  }
}
