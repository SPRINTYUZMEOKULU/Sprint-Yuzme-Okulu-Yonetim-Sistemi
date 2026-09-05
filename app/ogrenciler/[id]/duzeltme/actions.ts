"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import { bulkTransferStudents } from "../../bulk-actions";

function text(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

function nullable(formData: FormData, key: string) {
  const value = text(formData, key);
  return value || null;
}

function isoToJsDay(day: number) {
  return day === 7 ? 0 : day;
}

function validDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function uniqueStrings(values: FormDataEntryValue[]) {
  return Array.from(
    new Set(
      values
        .map(String)
        .map((v) => v.trim())
        .filter(Boolean),
    ),
  );
}

function calculatePlannedEndDate(
  startDate: string,
  lessonCount: number,
  isoWeekdays: number[],
) {
  const allowedDays = new Set(isoWeekdays.map(isoToJsDay));
  const cursor = new Date(`${startDate}T12:00:00Z`);
  let remaining = lessonCount;
  let safety = 0;

  while (remaining > 0 && safety < 730) {
    if (allowedDays.has(cursor.getUTCDay())) remaining -= 1;
    if (remaining > 0) cursor.setUTCDate(cursor.getUTCDate() + 1);
    safety += 1;
  }

  return remaining === 0 ? cursor.toISOString().slice(0, 10) : null;
}

export async function applyManagerCorrection(formData: FormData) {
  const profile = await requireProfile(["owner", "admin"]);
  const organizationId = profile.organization_id;
  const studentId = text(formData, "student_id");
  const reason = text(formData, "correction_reason");

  if (!organizationId || !studentId) {
    redirect("/ogrenciler?error=Öğrenci bilgisi bulunamadı");
  }

  if (reason.length < 5) {
    redirect(
      `/ogrenciler/${studentId}/duzeltme?error=${encodeURIComponent("Düzeltme gerekçesini en az 5 karakter yazınız.")}`,
    );
  }

  const branchId = text(formData, "branch_id");
  const groupId = text(formData, "group_id");
  const packageId = text(formData, "package_id");
  const startDate = text(formData, "start_date");
  const paymentDueDate = nullable(formData, "payment_due_date");
  const selectedScheduleIds = uniqueStrings(formData.getAll("schedule_ids"));
  const requestedTotalLessons = Number(formData.get("total_lessons") || 0);

  if (
    !branchId ||
    !groupId ||
    !packageId ||
    !validDate(startDate) ||
    !selectedScheduleIds.length
  ) {
    redirect(
      `/ogrenciler/${studentId}/duzeltme?error=${encodeURIComponent("Şube, grup, paket, başlangıç tarihi ve en az bir ders seansı seçilmelidir.")}`,
    );
  }

  if (paymentDueDate && !validDate(paymentDueDate)) {
    redirect(
      `/ogrenciler/${studentId}/duzeltme?error=${encodeURIComponent("Ödeme vade tarihi geçersiz.")}`,
    );
  }

  const supabase = await createClient();
  const now = new Date().toISOString();

  const [
    studentResult,
    enrollmentResult,
    membershipResult,
    planResult,
    branchResult,
    groupResult,
    packageResult,
    schedulesResult,
  ] = await Promise.all([
    supabase
      .from("students")
      .select("*")
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
    supabase
      .from("student_group_memberships")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("student_id", studentId)
      .eq("is_active", true)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("student_attendance_plans")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("student_id", studentId)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("branches")
      .select("id,name")
      .eq("organization_id", organizationId)
      .eq("id", branchId)
      .eq("is_active", true)
      .maybeSingle(),
    supabase
      .from("training_groups")
      .select("id,name,branch_id")
      .eq("organization_id", organizationId)
      .eq("id", groupId)
      .eq("is_active", true)
      .maybeSingle(),
    supabase
      .from("course_packages")
      .select("id,name,lesson_count,price")
      .eq("organization_id", organizationId)
      .eq("id", packageId)
      .maybeSingle(),
    supabase
      .from("lesson_schedules")
      .select("id,group_id,weekday,start_time,end_time")
      .eq("organization_id", organizationId)
      .eq("group_id", groupId)
      .eq("is_active", true)
      .in("id", selectedScheduleIds),
  ]);

  const loadError =
    studentResult.error ||
    enrollmentResult.error ||
    membershipResult.error ||
    planResult.error ||
    branchResult.error ||
    groupResult.error ||
    packageResult.error ||
    schedulesResult.error;
  if (loadError) {
    redirect(
      `/ogrenciler/${studentId}/duzeltme?error=${encodeURIComponent(`Düzeltme verileri yüklenemedi: ${loadError.message}`)}`,
    );
  }

  const student = studentResult.data;
  let enrollment = enrollmentResult.data;
  const membership = membershipResult.data;
  const oldPlan = planResult.data;
  const branch = branchResult.data;
  const group = groupResult.data;
  const coursePackage = packageResult.data;
  const schedules = schedulesResult.data || [];

  if (!student || !enrollment || !branch || !group || !coursePackage) {
    redirect(
      `/ogrenciler/${studentId}/duzeltme?error=${encodeURIComponent("Aktif öğrenci/kayıt veya seçilen program bulunamadı.")}`,
    );
  }

  if (group.branch_id !== branchId) {
    redirect(
      `/ogrenciler/${studentId}/duzeltme?error=${encodeURIComponent("Seçilen grup ile şube eşleşmiyor.")}`,
    );
  }

  if (schedules.length !== selectedScheduleIds.length) {
    redirect(
      `/ogrenciler/${studentId}/duzeltme?error=${encodeURIComponent("Seçilen ders seanslarından biri geçersiz.")}`,
    );
  }

  const isoWeekdays = Array.from(
    new Set(
      schedules
        .map((row: any) => Number(row.weekday))
        .filter((day: number) => Number.isInteger(day) && day >= 1 && day <= 7),
    ),
  ).sort((a, b) => a - b);
  if (!isoWeekdays.length) {
    redirect(
      `/ogrenciler/${studentId}/duzeltme?error=${encodeURIComponent("Ders programında geçerli gün bulunamadı.")}`,
    );
  }

  const totalLessons =
    Number.isInteger(requestedTotalLessons) && requestedTotalLessons > 0
      ? requestedTotalLessons
      : Number(coursePackage.lesson_count || 0);

  const usedLessons = Math.max(0, Number(enrollment.used_lessons || 0));
  if (!totalLessons || totalLessons < usedLessons) {
    redirect(
      `/ogrenciler/${studentId}/duzeltme?error=${encodeURIComponent(`Toplam ders sayısı kullanılan ders sayısından (${usedLessons}) az olamaz.`)}`,
    );
  }
  const plannedEndDate = calculatePlannedEndDate(
    startDate,
    totalLessons,
    isoWeekdays,
  );
  if (!plannedEndDate) {
    redirect(
      `/ogrenciler/${studentId}/duzeltme?error=${encodeURIComponent("Planlanan bitiş tarihi hesaplanamadı.")}`,
    );
  }

  const oldSnapshot = {
    student: {
      first_name: student.first_name,
      last_name: student.last_name,
      birth_date: student.birth_date,
      phone: student.phone,
      email: student.email,
      guardian_name: student.guardian_name,
      guardian_phone: student.guardian_phone,
      guardian_email: student.guardian_email,
      branch_id: student.branch_id,
      preferred_group_id: student.preferred_group_id,
      preferred_package_id: student.preferred_package_id,
    },
    enrollment: {
      id: enrollment.id,
      branch_id: enrollment.branch_id,
      group_id: enrollment.group_id,
      package_id: enrollment.package_id,
      start_date: enrollment.start_date,
      planned_end_date: enrollment.planned_end_date,
      total_lessons: enrollment.total_lessons,
      used_lessons: enrollment.used_lessons,
      lesson_weekdays: enrollment.lesson_weekdays,
      payment_due_date: enrollment.payment_due_date,
    },
    membership: membership
      ? {
          id: membership.id,
          group_id: membership.group_id,
          started_at: membership.started_at,
        }
      : null,
    attendance_plan: oldPlan
      ? {
          id: oldPlan.id,
          group_id: oldPlan.group_id,
          selected_weekdays: oldPlan.selected_weekdays,
          normal_planned_end_date: oldPlan.normal_planned_end_date,
          compensation_planned_end_date: oldPlan.compensation_planned_end_date,
        }
      : null,
  };

  const currentProgramSignature = `${enrollment.branch_id || student.branch_id || ""}|${enrollment.group_id || membership?.group_id || ""}|${JSON.stringify(Array.isArray(oldPlan?.selected_weekdays) ? oldPlan.selected_weekdays : [])}`;
  const newProgramSignature = `${branchId}|${groupId}|${JSON.stringify(isoWeekdays)}`;

  if (currentProgramSignature !== newProgramSignature) {
    const transferResult = await bulkTransferStudents({
      studentIds: [studentId],
      targetBranchId: branchId,
      targetGroupId: groupId,
      targetScheduleIds: selectedScheduleIds,
      effectiveDate: startDate,
      prepareMessages: false,
      updateAttendancePlans: true,
      logHistory: false,
    });

    if (!transferResult.ok || !transferResult.transferredCount) {
      redirect(
        `/ogrenciler/${studentId}/duzeltme?error=${encodeURIComponent(transferResult.message || "Program düzeltmesi uygulanamadı.")}`,
      );
    }

    const refreshedEnrollment = await supabase
      .from("student_enrollments")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("student_id", studentId)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (refreshedEnrollment.error || !refreshedEnrollment.data) {
      redirect(
        `/ogrenciler/${studentId}/duzeltme?error=${encodeURIComponent("Program düzeltildi ancak aktif kayıt yeniden okunamadı.")}`,
      );
    }
    enrollment = refreshedEnrollment.data;
  }

  const enrollmentUpdate = await supabase
    .from("student_enrollments")
    .update({
      group_id: groupId,
      package_id: packageId,
      start_date: startDate,
      planned_end_date: plannedEndDate,
      total_lessons: totalLessons,
      lesson_weekdays: isoWeekdays.map(isoToJsDay),
      updated_at: now,
    })
    .eq("organization_id", organizationId)
    .eq("id", enrollment.id);

  if (enrollmentUpdate.error) {
    redirect(
      `/ogrenciler/${studentId}/duzeltme?error=${encodeURIComponent(`Kayıt/paket düzeltilemedi: ${enrollmentUpdate.error.message}`)}`,
    );
  }

  // Bazı eski kurulumlarda bu iki kolon henüz bulunmuyor. Ana kayıt işlemini
  // engellemeden, mevcut olan opsiyonel kolonları ayrı ayrı güncelliyoruz.
  for (const optionalUpdate of [
    { branch_id: branchId },
    { payment_due_date: paymentDueDate },
  ]) {
    const optionalResult = await supabase
      .from("student_enrollments")
      .update(optionalUpdate)
      .eq("organization_id", organizationId)
      .eq("id", enrollment.id);

    const message = optionalResult.error?.message || "";
    const missingSchemaColumn =
      optionalResult.error &&
      /could not find the .* column|schema cache/i.test(message);

    if (optionalResult.error && !missingSchemaColumn) {
      redirect(
        `/ogrenciler/${studentId}/duzeltme?error=${encodeURIComponent(`Kayıt ek bilgileri düzeltilemedi: ${message}`)}`,
      );
    }
  }

  const updatedEnrollmentResult = await supabase
    .from("student_enrollments")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("id", enrollment.id)
    .maybeSingle();

  if (updatedEnrollmentResult.error || !updatedEnrollmentResult.data) {
    redirect(
      `/ogrenciler/${studentId}/duzeltme?error=${encodeURIComponent("Güncellenen kayıt tekrar okunamadı.")}`,
    );
  }

  const updatedEnrollment = updatedEnrollmentResult.data;

  const studentUpdate = await supabase
    .from("students")
    .update({
      first_name: text(formData, "first_name"),
      last_name: text(formData, "last_name"),
      birth_date: nullable(formData, "birth_date"),
      phone: nullable(formData, "phone"),
      email: nullable(formData, "email"),
      guardian_name: nullable(formData, "guardian_name"),
      guardian_phone: nullable(formData, "guardian_phone"),
      guardian_email: nullable(formData, "guardian_email"),
      branch_id: branchId,
      preferred_group_id: groupId,
      preferred_package_id: packageId,
      preferred_days: isoWeekdays.map(isoToJsDay).join(","),
      updated_at: now,
    })
    .eq("organization_id", organizationId)
    .eq("id", studentId);

  if (studentUpdate.error) {
    redirect(
      `/ogrenciler/${studentId}/duzeltme?error=${encodeURIComponent(`Öğrenci bilgileri düzeltilemedi: ${studentUpdate.error.message}`)}`,
    );
  }

  const activePlanResult = await supabase
    .from("student_attendance_plans")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("student_id", studentId)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const activePlan = activePlanResult.data;
  if (activePlan?.id) {
    const currentCompEnd = activePlan.compensation_planned_end_date || null;
    const normalEnd = updatedEnrollment.planned_end_date || null;
    const compensationEnd =
      currentCompEnd && normalEnd
        ? currentCompEnd >= normalEnd
          ? currentCompEnd
          : normalEnd
        : currentCompEnd || normalEnd;

    await supabase
      .from("student_attendance_plans")
      .update({
        group_id: groupId,
        selected_weekdays: isoWeekdays,
        weekly_frequency: isoWeekdays.length,
        package_lesson_count: totalLessons,
        start_date: startDate,
        normal_planned_end_date: normalEnd,
        compensation_planned_end_date: compensationEnd,
        updated_by: profile.id,
        updated_at: now,
      })
      .eq("organization_id", organizationId)
      .eq("id", activePlan.id);
  }

  const newSnapshot = {
    student: {
      first_name: text(formData, "first_name"),
      last_name: text(formData, "last_name"),
      birth_date: nullable(formData, "birth_date"),
      phone: nullable(formData, "phone"),
      email: nullable(formData, "email"),
      guardian_name: nullable(formData, "guardian_name"),
      guardian_phone: nullable(formData, "guardian_phone"),
      guardian_email: nullable(formData, "guardian_email"),
      branch_id: branchId,
      preferred_group_id: groupId,
      preferred_package_id: packageId,
    },
    enrollment: {
      id: updatedEnrollment.id,
      branch_id: branchId,
      group_id: groupId,
      package_id: packageId,
      package_name: coursePackage.name,
      start_date: startDate,
      planned_end_date: updatedEnrollment.planned_end_date,
      total_lessons: totalLessons,
      used_lessons: updatedEnrollment.used_lessons,
      lesson_weekdays: isoWeekdays.map(isoToJsDay),
      payment_due_date: paymentDueDate,
    },
    program: {
      branch_name: branch.name,
      group_name: group.name,
      schedule_ids: selectedScheduleIds,
      selected_weekdays: isoWeekdays,
    },
  };

  const logResult = await supabase.from("student_activity_logs").insert({
    organization_id: organizationId,
    student_id: studentId,
    activity_type: "manager_data_correction",
    title: "Yönetici veri düzeltmesi",
    description: reason,
    old_value: oldSnapshot,
    new_value: newSnapshot,
    source_type: "manager_correction_center",
    source_id: updatedEnrollment.id,
    performed_by: profile.id,
    approved_by: profile.id,
    performed_at: now,
    approved_at: now,
  });

  if (logResult.error) {
    console.error("MANAGER CORRECTION AUDIT LOG ERROR", logResult.error);
  }

  revalidatePath(`/ogrenciler/${studentId}`);
  revalidatePath(`/ogrenciler/${studentId}/duzeltme`);
  revalidatePath("/ogrenciler");
  revalidatePath("/odemeler");
  revalidatePath("/yoklama");

  redirect(`/ogrenciler/${studentId}/duzeltme?saved=1`);
}
