"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";

const managerRoles = ["owner", "admin"] as const;
const registrationRoles = ["owner", "admin", "branch_manager", "registration_staff"] as const;

function text(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

function bool(formData: FormData, key: string) {
  return formData.get(key) === "on";
}

function nullableText(formData: FormData, key: string) {
  return text(formData, key) || null;
}

function studentIdFrom(formData: FormData) {
  return text(formData, "student_id") || text(formData, "legacy_student_id");
}

function compensationCount(formData: FormData) {
  const value = Number(formData.get("legacy_compensation_count") || 0);
  return Number.isInteger(value) && value >= 0 && value <= 100 ? value : -1;
}

function weekdaysFrom(formData: FormData) {
  return formData
    .getAll("lesson_weekdays")
    .map(Number)
    .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6);
}

function jsDayToIsoDay(day: number) {
  return day === 0 ? 7 : day;
}

function validDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function extendByLessonDays(baseDate: string, weekdays: number[], count: number) {
  if (!validDate(baseDate) || !weekdays.length || count < 1) return baseDate || null;

  const selected = new Set(weekdays);
  const cursor = new Date(`${baseDate}T12:00:00`);
  let added = 0;
  let guard = 0;

  while (added < count && guard < 730) {
    cursor.setDate(cursor.getDate() + 1);
    if (selected.has(cursor.getDay())) added += 1;
    guard += 1;
  }

  return cursor.toISOString().slice(0, 10);
}

function formDraft(formData: FormData) {
  const totalLessons = Number(formData.get("total_lessons") || 0);
  return {
    branch_id: nullableText(formData, "branch_id"),
    group_id: nullableText(formData, "group_id"),
    package_id: nullableText(formData, "package_id"),
    coach_id: nullableText(formData, "coach_id"),
    start_date: nullableText(formData, "start_date"),
    planned_end_date: nullableText(formData, "planned_end_date"),
    lesson_weekdays: weekdaysFrom(formData),
    total_lessons: Number.isInteger(totalLessons) && totalLessons > 0 ? totalLessons : null,
    payment_due_date: nullableText(formData, "payment_due_date"),
    whatsapp_opened: bool(formData, "whatsapp_opened"),
  };
}

async function addCompensation(params: {
  organizationId: string;
  studentId: string;
  count: number;
  performedBy: string;
}) {
  if (params.count < 1) return { previous: 0, next: 0 };

  const supabase = await createClient();
  const { data: current } = await supabase
    .from("student_lesson_balance")
    .select("student_id,compensation_lesson_balance")
    .eq("student_id", params.studentId)
    .limit(1)
    .maybeSingle();

  const previous = Math.max(0, Number(current?.compensation_lesson_balance || 0));
  const next = previous + params.count;

  const { error } = await supabase
    .from("student_lesson_balance")
    .update({ compensation_lesson_balance: next })
    .eq("student_id", params.studentId);

  if (error) throw new Error(`Telafi bakiyesi güncellenemedi: ${error.message}`);

  await supabase.from("student_activity_logs").insert({
    organization_id: params.organizationId,
    student_id: params.studentId,
    activity_type: "legacy_transfer_compensation_added",
    title: "Aktarımdan gelen telafi eklendi",
    description: `${params.count} adet telafi dersi eski sistem aktarımı kapsamında eklendi. Yeni telafi bakiyesi: ${next}.`,
    old_value: { compensation_lesson_balance: previous },
    new_value: { compensation_lesson_balance: next, added: params.count },
    source_type: "registration_completion_legacy_transfer",
    source_id: params.studentId,
    performed_by: params.performedBy,
    performed_at: new Date().toISOString(),
  });

  return { previous, next };
}

export async function addLegacyTransferCompensation(formData: FormData) {
  const profile = await requireProfile([...registrationRoles]);
  const organizationId = profile.organization_id;
  const studentId = studentIdFrom(formData);
  const count = compensationCount(formData);

  if (!organizationId || !studentId) {
    redirect(`/on-kayitlar?error=${encodeURIComponent("Öğrenci bilgisi bulunamadı.")}`);
  }

  if (count < 1) {
    redirect(`/kayit-tamamlama/${studentId}?error=${encodeURIComponent("Eklenecek telafi sayısını 1-100 arasında giriniz.")}#onaylar`);
  }

  const supabase = await createClient();
  const { data: student } = await supabase
    .from("students")
    .select("id")
    .eq("id", studentId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (!student) {
    redirect(`/kayit-tamamlama/${studentId}?error=${encodeURIComponent("Öğrenci bulunamadı.")}#onaylar`);
  }

  const currentDraft = formDraft(formData);
  const weekdays = currentDraft.lesson_weekdays;
  const formEndDate = currentDraft.planned_end_date || "";

  const { data: checklist } = await supabase
    .from("registration_completion_checklists")
    .select("draft_data")
    .eq("organization_id", organizationId)
    .eq("student_id", studentId)
    .maybeSingle();

  const previousDraft =
    checklist?.draft_data && typeof checklist.draft_data === "object"
      ? (checklist.draft_data as Record<string, unknown>)
      : {};

  const previousCompensationEnd = String(previousDraft.legacy_compensation_planned_end_date || "");
  const baseEndDate = validDate(previousCompensationEnd) ? previousCompensationEnd : formEndDate;
  const newCompensationEnd = extendByLessonDays(baseEndDate, weekdays, count);
  const previousAdded = Math.max(0, Number(previousDraft.legacy_compensation_added_count || 0));
  const now = new Date().toISOString();

  try {
    await addCompensation({ organizationId, studentId, count, performedBy: profile.id });
  } catch (error) {
    redirect(`/kayit-tamamlama/${studentId}?error=${encodeURIComponent(error instanceof Error ? error.message : "Telafi eklenemedi.")}#onaylar`);
  }

  const { error: draftError } = await supabase
    .from("registration_completion_checklists")
    .upsert(
      {
        organization_id: organizationId,
        student_id: studentId,
        draft_data: {
          ...previousDraft,
          ...currentDraft,
          legacy_compensation_added_count: previousAdded + count,
          legacy_compensation_planned_end_date: newCompensationEnd,
          legacy_compensation_updated_at: now,
        },
        draft_saved_at: now,
        payment_due_date: currentDraft.payment_due_date || currentDraft.start_date || null,
        payment_due_date_manual: bool(formData, "payment_due_date_manual"),
        payment_note: nullableText(formData, "payment_note"),
        message_draft: nullableText(formData, "message_body"),
        message_prepared: Boolean(text(formData, "message_body")),
        swim_cap_delivered: bool(formData, "swim_cap_delivered"),
        updated_by: profile.id,
        updated_at: now,
      },
      { onConflict: "student_id" }
    );

  if (draftError) {
    redirect(`/kayit-tamamlama/${studentId}?error=${encodeURIComponent(`Telafi eklendi ancak ekran bilgileri korunamadı: ${draftError.message}`)}#onaylar`);
  }

  revalidatePath(`/kayit-tamamlama/${studentId}`);
  revalidatePath(`/ogrenciler/${studentId}`);
  revalidatePath("/ogrenciler");

  const endQuery = newCompensationEnd ? `&legacy_compensation_end=${encodeURIComponent(newCompensationEnd)}` : "";
  redirect(`/kayit-tamamlama/${studentId}?legacy_compensation_added=${count}${endQuery}#onaylar`);
}

export async function managerConfirmLegacyTransfer(formData: FormData) {
  const profile = await requireProfile([...managerRoles]);
  const organizationId = profile.organization_id;
  const studentId = studentIdFrom(formData);
  const count = compensationCount(formData);

  const branchId = text(formData, "branch_id");
  const groupId = text(formData, "group_id");
  const packageId = nullableText(formData, "package_id");
  const coachId = nullableText(formData, "coach_id");
  const startDate = text(formData, "start_date");
  const plannedEndDate = text(formData, "planned_end_date");
  const paymentDueDate = text(formData, "payment_due_date") || startDate;
  const paymentNote = nullableText(formData, "payment_note");
  const totalLessons = Number(formData.get("total_lessons") || 0);
  const weekdays = weekdaysFrom(formData);
  const isoWeekdays = weekdays.map(jsDayToIsoDay).sort((a, b) => a - b);
  const messageBody = text(formData, "message_body");
  const messageSent = bool(formData, "message_sent");
  const swimCapDelivered = bool(formData, "swim_cap_delivered");

  if (!organizationId || !studentId) {
    redirect(`/on-kayitlar?error=${encodeURIComponent("Öğrenci bilgisi bulunamadı.")}`);
  }

  if (count < 0) {
    redirect(`/kayit-tamamlama/${studentId}?error=${encodeURIComponent("Telafi sayısı 0-100 arasında olmalıdır.")}#onaylar`);
  }

  if (!branchId || !groupId || !startDate || !plannedEndDate || !weekdays.length || !Number.isInteger(totalLessons) || totalLessons < 1 || totalLessons > 100 || !paymentDueDate || !validDate(paymentDueDate)) {
    redirect(`/kayit-tamamlama/${studentId}?error=${encodeURIComponent("Yönetici teyidinden önce şube, grup, başlangıç tarihi, katılım günleri, vade ve ders sayısı doldurulmalıdır.")}#kayit-plani`);
  }

  const supabase = await createClient();
  const [{ data: student }, { data: checklist }] = await Promise.all([
    supabase
      .from("students")
      .select("id,first_name,last_name,status,branch_id")
      .eq("id", studentId)
      .eq("organization_id", organizationId)
      .maybeSingle(),
    supabase
      .from("registration_completion_checklists")
      .select("draft_data")
      .eq("organization_id", organizationId)
      .eq("student_id", studentId)
      .maybeSingle(),
  ]);

  if (!student) {
    redirect(`/kayit-tamamlama/${studentId}?error=${encodeURIComponent("Öğrenci bulunamadı.")}#onaylar`);
  }

  const savedDraft =
    checklist?.draft_data && typeof checklist.draft_data === "object"
      ? (checklist.draft_data as Record<string, unknown>)
      : {};
  const savedCompensationEnd = String(savedDraft.legacy_compensation_planned_end_date || "");
  const initialCompensationEnd = validDate(savedCompensationEnd) ? savedCompensationEnd : plannedEndDate;
  const now = new Date().toISOString();

  const { data: existingConsent } = await supabase
    .from("registration_consents")
    .select("id,rules_accepted,health_declaration")
    .eq("organization_id", organizationId)
    .eq("student_id", studentId)
    .order("accepted_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!existingConsent?.rules_accepted || !existingConsent?.health_declaration) {
    const { error: consentError } = await supabase.from("registration_consents").insert({
      organization_id: organizationId,
      student_id: studentId,
      registration_for: "legacy_transfer_manager_override",
      health_declaration: true,
      health_note: null,
      rules_accepted: true,
      whatsapp_permission: false,
      contact_request: null,
      rules_version: "YONETICI-TEYIDI-AKTARIM-v1",
      form_version: "SPRINT-LEGACY-AKTARIM-v1",
      accepted_at: now,
      form_snapshot: {
        source: "legacy_transfer_manager_override",
        manager_profile_id: profile.id,
        confirmed_at: now,
        administrative_override: true,
        note: "Eski sistemden aktarılan öğrenci için eksik sağlık beyanı ve kural kabul kaydı yönetici teyidiyle idari olarak onaylandı. Veli/öğrenci elektronik kabulü değildir.",
      },
    });

    if (consentError) {
      redirect(`/kayit-tamamlama/${studentId}?error=${encodeURIComponent(`Yönetici teyidi kaydedilemedi: ${consentError.message}`)}#onaylar`);
    }
  }

  await supabase
    .from("student_enrollments")
    .update({ status: "completed" })
    .eq("organization_id", organizationId)
    .eq("student_id", studentId)
    .eq("status", "active");

  const { data: enrollment, error: enrollmentError } = await supabase
    .from("student_enrollments")
    .insert({
      organization_id: organizationId,
      student_id: studentId,
      package_id: packageId,
      group_id: groupId,
      start_date: startDate,
      planned_end_date: plannedEndDate,
      lesson_weekdays: weekdays,
      total_lessons: totalLessons,
      used_lessons: 0,
      payment_due_date: paymentDueDate,
      status: "active",
    })
    .select("id")
    .single();

  if (enrollmentError || !enrollment) {
    redirect(`/kayit-tamamlama/${studentId}?error=${encodeURIComponent(enrollmentError?.message || "Aktarım kaydı oluşturulamadı.")}#onaylar`);
  }

  await supabase
    .from("student_group_memberships")
    .update({ is_active: false, ended_at: startDate })
    .eq("student_id", studentId)
    .eq("is_active", true);

  const { error: membershipError } = await supabase.from("student_group_memberships").insert({
    organization_id: organizationId,
    student_id: studentId,
    group_id: groupId,
    started_at: startDate,
    is_active: true,
  });

  if (membershipError) {
    await supabase.from("student_enrollments").delete().eq("id", enrollment.id);
    redirect(`/kayit-tamamlama/${studentId}?error=${encodeURIComponent(`Grup üyeliği oluşturulamadı: ${membershipError.message}`)}#onaylar`);
  }

  await supabase
    .from("student_attendance_plans")
    .update({ is_active: false, updated_by: profile.id, updated_at: now })
    .eq("student_id", studentId)
    .eq("is_active", true);

  const { error: attendanceError } = await supabase.from("student_attendance_plans").insert({
    organization_id: organizationId,
    student_id: studentId,
    enrollment_id: enrollment.id,
    group_id: groupId,
    selected_weekdays: isoWeekdays,
    weekly_frequency: isoWeekdays.length,
    package_lesson_count: totalLessons,
    start_date: startDate,
    normal_planned_end_date: plannedEndDate,
    compensation_planned_end_date: initialCompensationEnd,
    is_active: true,
    created_by: profile.id,
    updated_by: profile.id,
  });

  if (attendanceError) {
    redirect(`/kayit-tamamlama/${studentId}?error=${encodeURIComponent(`Katılım planı oluşturulamadı: ${attendanceError.message}`)}#onaylar`);
  }

  const { data: updatedStudent, error: studentError } = await supabase
    .from("students")
    .update({
      status: "active",
      branch_id: branchId,
      preferred_group_id: groupId,
      preferred_package_id: packageId,
      preferred_days: weekdays.join(","),
      updated_at: now,
    })
    .eq("id", studentId)
    .eq("organization_id", organizationId)
    .select("id,student_number,first_name,last_name")
    .single();

  if (studentError || !updatedStudent) {
    redirect(`/kayit-tamamlama/${studentId}?error=${encodeURIComponent(studentError?.message || "Öğrenci aktif hale getirilemedi.")}#onaylar`);
  }

  const draftData = {
    ...savedDraft,
    branch_id: branchId,
    group_id: groupId,
    package_id: packageId,
    coach_id: coachId,
    start_date: startDate,
    planned_end_date: plannedEndDate,
    lesson_weekdays: weekdays,
    total_lessons: totalLessons,
    payment_due_date: paymentDueDate,
    legacy_compensation_planned_end_date: initialCompensationEnd,
    legacy_manager_confirmation: {
      status: "confirmed",
      confirmed_by: profile.id,
      confirmed_at: now,
      administrative_override: true,
    },
  };

  await supabase.from("registration_completion_checklists").upsert(
    {
      organization_id: organizationId,
      student_id: studentId,
      enrollment_id: enrollment.id,
      group_selected: true,
      attendance_days_selected: true,
      health_declaration_received: true,
      rules_accepted: true,
      message_prepared: Boolean(messageBody),
      message_sent: messageSent,
      location_sent: messageSent,
      swim_cap_delivered: swimCapDelivered,
      payment_due_date: paymentDueDate,
      payment_due_date_manual: bool(formData, "payment_due_date_manual"),
      payment_note: paymentNote,
      message_draft: messageBody || null,
      draft_data: draftData,
      draft_saved_at: now,
      completed_by: profile.id,
      completed_at: now,
      updated_by: profile.id,
      updated_at: now,
    },
    { onConflict: "student_id" }
  );

  await supabase.from("student_activity_logs").insert({
    organization_id: organizationId,
    student_id: studentId,
    activity_type: "legacy_transfer_manager_confirmed",
    title: "Aktarım yönetici teyidiyle tamamlandı",
    description:
      `${student.first_name} ${student.last_name} eski sistemden aktarım kaydı yönetici teyidiyle doğrudan aktif kayda alındı. ` +
      `Sağlık ve kurallar eksikliği idari teyit olarak kaydedildi; elektronik veli onayı olarak işaretlenmedi.`,
    old_value: { status: student.status, branch_id: student.branch_id },
    new_value: {
      status: "active",
      branch_id: branchId,
      group_id: groupId,
      package_id: packageId,
      total_lessons: totalLessons,
      start_date: startDate,
      planned_end_date: plannedEndDate,
      compensation_planned_end_date: initialCompensationEnd,
      payment_due_date: paymentDueDate,
      manager_override: true,
    },
    source_type: "registration_completion_legacy_transfer",
    source_id: enrollment.id,
    performed_by: profile.id,
    approved_by: profile.id,
    performed_at: now,
    approved_at: now,
  });

  if (count > 0) {
    try {
      await addCompensation({ organizationId, studentId, count, performedBy: profile.id });
    } catch (error) {
      redirect(`/ogrenciler/${studentId}?saved=legacy_transfer&warning=${encodeURIComponent(error instanceof Error ? error.message : "Kayıt aktarıldı ancak telafi eklenemedi.")}`);
    }
  }

  await supabase.from("system_notifications").insert({
    organization_id: organizationId,
    recipient_profile_id: null,
    notification_type: "legacy_transfer_completed",
    title: "Aktarılan öğrenci kaydı tamamlandı",
    body: `${updatedStudent.first_name} ${updatedStudent.last_name} yönetici teyidiyle aktif kayda alındı.`,
    priority: "normal",
    student_id: studentId,
    source_type: "registration_completion_legacy_transfer",
    source_id: enrollment.id,
    target_path: `/ogrenciler/${studentId}`,
    push_required: false,
  });

  revalidatePath("/on-kayitlar");
  revalidatePath("/odemeler");
  revalidatePath("/kasa");
  revalidatePath("/ogrenciler");
  revalidatePath(`/ogrenciler/${studentId}`);
  revalidatePath(`/kayit-tamamlama/${studentId}`);

  redirect(`/ogrenciler/${studentId}?saved=legacy_transfer`);
}
