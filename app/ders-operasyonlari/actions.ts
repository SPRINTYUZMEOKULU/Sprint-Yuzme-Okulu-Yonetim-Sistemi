"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";

const ALLOWED_ROLES = [
  "owner",
  "admin",
  "branch_manager",
  "registration_staff",
] as const;

type CompensationMode = "append_end" | "custom" | "reserve";

export type LessonCancellationInput = {
  groupId: string;
  scheduleId: string;
  cancelledDate: string;
  reason: string;
  description?: string;
  compensationMode: CompensationMode;
  customScheduleId?: string | null;
  customDate?: string | null;
  prepareMessages: boolean;
};

export type PreparedCancellationMessage = {
  studentId: string;
  studentName: string;
  recipient: string | null;
  message: string;
  oldNormalEndDate: string | null;
  newCompensationEndDate: string | null;
  compensationDate: string | null;
};

const DAY_NAMES: Record<number, string> = {
  1: "Pazartesi",
  2: "Salı",
  3: "Çarşamba",
  4: "Perşembe",
  5: "Cuma",
  6: "Cumartesi",
  7: "Pazar",
};

function formatDateTR(value?: string | null) {
  if (!value) return "—";
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return value;
  return `${String(day).padStart(2, "0")}.${String(month).padStart(2, "0")}.${year}`;
}

function cleanPhone(value?: string | null) {
  return (value || "").replace(/\D/g, "");
}

function normalizeCourseType(value?: string | null) {
  return (value || "").toLocaleLowerCase("tr-TR");
}

function isAdultCourse(value?: string | null) {
  const normalized = normalizeCourseType(value);
  return normalized.includes("yetişkin") || normalized.includes("yetiskin") || normalized.includes("adult") || normalized.includes("master");
}

function nextScheduledDate(afterDate: string, isoWeekdays: number[]) {
  const selected = new Set(isoWeekdays);
  const cursor = new Date(`${afterDate}T12:00:00`);
  cursor.setDate(cursor.getDate() + 1);

  for (let i = 0; i < 370; i += 1) {
    const jsDay = cursor.getDay();
    const isoDay = jsDay === 0 ? 7 : jsDay;

    if (selected.has(isoDay)) {
      const y = cursor.getFullYear();
      const m = String(cursor.getMonth() + 1).padStart(2, "0");
      const d = String(cursor.getDate()).padStart(2, "0");
      return { date: `${y}-${m}-${d}`, weekday: isoDay };
    }

    cursor.setDate(cursor.getDate() + 1);
  }

  return null;
}

function laterDate(a?: string | null, b?: string | null) {
  if (!a) return b || null;
  if (!b) return a;
  return a >= b ? a : b;
}

export async function applyLessonCancellation(input: LessonCancellationInput) {
  const preparedMessages: PreparedCancellationMessage[] = [];

  try {
    const profile = await requireProfile([...ALLOWED_ROLES]);
    const organizationId = profile.organization_id;

    if (!organizationId) {
      return { ok: false as const, message: "Organizasyon bilgisi bulunamadı.", preparedMessages };
    }

    if (!input.groupId || !input.scheduleId || !input.cancelledDate || !input.reason.trim()) {
      return { ok: false as const, message: "Grup, seans, iptal tarihi ve gerekçe zorunludur.", preparedMessages };
    }

    if (input.compensationMode === "custom" && (!input.customScheduleId || !input.customDate)) {
      return { ok: false as const, message: "Özel telafi için tarih ve seans seçilmelidir.", preparedMessages };
    }

    const supabase = await createClient();

    const [groupResult, sourceScheduleResult, schedulesResult, membershipsResult] = await Promise.all([
      supabase
        .from("training_groups")
        .select("id,name,branch_id,course_type")
        .eq("organization_id", organizationId)
        .eq("id", input.groupId)
        .maybeSingle(),
      supabase
        .from("lesson_schedules")
        .select("id,group_id,branch_id,weekday,start_time,end_time,is_active")
        .eq("organization_id", organizationId)
        .eq("id", input.scheduleId)
        .eq("group_id", input.groupId)
        .maybeSingle(),
      supabase
        .from("lesson_schedules")
        .select("id,group_id,branch_id,weekday,start_time,end_time,is_active")
        .eq("organization_id", organizationId)
        .eq("group_id", input.groupId)
        .eq("is_active", true),
      supabase
        .from("student_group_memberships")
        .select("student_id")
        .eq("organization_id", organizationId)
        .eq("group_id", input.groupId)
        .eq("is_active", true),
    ]);

    const loadError = groupResult.error || sourceScheduleResult.error || schedulesResult.error || membershipsResult.error;
    if (loadError) {
      return { ok: false as const, message: `Operasyon verileri yüklenemedi: ${loadError.message}`, preparedMessages };
    }

    const group = groupResult.data;
    const sourceSchedule = sourceScheduleResult.data;
    const groupSchedules = schedulesResult.data || [];

    if (!group || !sourceSchedule) {
      return { ok: false as const, message: "Seçilen grup veya ders seansı bulunamadı.", preparedMessages };
    }

    const sourceWeekday = Number(sourceSchedule.weekday || 0);
    const membershipStudentIds = Array.from(new Set((membershipsResult.data || []).map((row: any) => row.student_id).filter(Boolean)));

    if (!membershipStudentIds.length) {
      return { ok: false as const, message: "Bu grupta aktif kursiyer bulunamadı.", preparedMessages };
    }

    const [studentsResult, enrollmentsResult, plansResult] = await Promise.all([
      supabase
        .from("students")
        .select("id,first_name,last_name,phone,guardian_phone,status")
        .eq("organization_id", organizationId)
        .eq("status", "active")
        .in("id", membershipStudentIds),
      supabase
        .from("student_enrollments")
        .select("id,student_id,group_id,planned_end_date,status,created_at")
        .eq("organization_id", organizationId)
        .eq("group_id", input.groupId)
        .eq("status", "active")
        .in("student_id", membershipStudentIds)
        .order("created_at", { ascending: false }),
      supabase
        .from("student_attendance_plans")
        .select("id,student_id,enrollment_id,group_id,selected_weekdays,normal_planned_end_date,compensation_planned_end_date,is_active")
        .eq("organization_id", organizationId)
        .eq("group_id", input.groupId)
        .eq("is_active", true)
        .in("student_id", membershipStudentIds),
    ]);

    const secondaryError = studentsResult.error || enrollmentsResult.error || plansResult.error;
    if (secondaryError) {
      return { ok: false as const, message: `Kursiyer kayıtları yüklenemedi: ${secondaryError.message}`, preparedMessages };
    }

    const enrollmentMap = new Map<string, any>();
    for (const row of enrollmentsResult.data || []) {
      if (!enrollmentMap.has(row.student_id)) enrollmentMap.set(row.student_id, row);
    }

    const planMap = new Map<string, any>();
    for (const row of plansResult.data || []) {
      if (!planMap.has(row.student_id)) planMap.set(row.student_id, row);
    }

    const customSchedule = input.customScheduleId
      ? groupSchedules.find((row: any) => row.id === input.customScheduleId)
      : null;

    if (input.compensationMode === "custom" && !customSchedule) {
      return { ok: false as const, message: "Seçilen telafi seansı bu gruba ait değil.", preparedMessages };
    }

    const now = new Date().toISOString();
    let processed = 0;
    let skipped = 0;
    let compensationCreated = 0;

    for (const student of studentsResult.data || []) {
      const enrollment = enrollmentMap.get(student.id);
      const plan = planMap.get(student.id);

      if (!enrollment) {
        skipped += 1;
        continue;
      }

      const selectedWeekdays = Array.isArray(plan?.selected_weekdays)
        ? plan.selected_weekdays.map((day: unknown) => Number(day)).filter((day: number) => day >= 1 && day <= 7)
        : groupSchedules.map((row: any) => Number(row.weekday)).filter((day: number) => day >= 1 && day <= 7);

      if (sourceWeekday && selectedWeekdays.length && !selectedWeekdays.includes(sourceWeekday)) {
        skipped += 1;
        continue;
      }

      const oldNormalEndDate = plan?.normal_planned_end_date || enrollment.planned_end_date || null;
      const currentCompensationEndDate = plan?.compensation_planned_end_date || oldNormalEndDate;

      let compensationDate: string | null = null;
      let targetScheduleId: string | null = null;
      let newCompensationEndDate = currentCompensationEndDate;

      if (input.compensationMode === "append_end") {
        const baseDate = currentCompensationEndDate || oldNormalEndDate || input.cancelledDate;
        const next = nextScheduledDate(baseDate, selectedWeekdays);

        if (!next) {
          skipped += 1;
          continue;
        }

        compensationDate = next.date;
        targetScheduleId = groupSchedules.find((row: any) => Number(row.weekday) === next.weekday)?.id || null;
        newCompensationEndDate = compensationDate;
      }

      if (input.compensationMode === "custom") {
        compensationDate = input.customDate || null;
        targetScheduleId = input.customScheduleId || null;
        newCompensationEndDate = laterDate(currentCompensationEndDate, compensationDate);
      }

      if (compensationDate) {
        const compensationInsert = await supabase
          .from("student_compensation_lessons")
          .insert({
            organization_id: organizationId,
            student_id: student.id,
            enrollment_id: enrollment.id,
            source_request_id: null,
            target_group_id: input.groupId,
            target_schedule_id: targetScheduleId,
            lesson_date: compensationDate,
            status: "planned",
            note:
              `Tesis/grup kaynaklı ders iptali. Kaynak ders: ${formatDateTR(input.cancelledDate)} ` +
              `${String(sourceSchedule.start_time || "").slice(0, 5)}-${String(sourceSchedule.end_time || "").slice(0, 5)}. ` +
              `Gerekçe: ${input.reason.trim()}${input.description?.trim() ? ` · ${input.description.trim()}` : ""}`,
            created_by: profile.id,
            created_at: now,
            updated_at: now,
          });

        if (compensationInsert.error) {
          skipped += 1;
          continue;
        }

        compensationCreated += 1;

        if (plan?.id && newCompensationEndDate) {
          await supabase
            .from("student_attendance_plans")
            .update({
              compensation_planned_end_date: newCompensationEndDate,
              updated_by: profile.id,
              updated_at: now,
            })
            .eq("id", plan.id)
            .eq("organization_id", organizationId);
        }
      }

      const studentName = `${student.first_name || ""} ${student.last_name || ""}`.trim();
      const adult = isAdultCourse(group.course_type);
      const recipient = adult
        ? cleanPhone(student.phone) || cleanPhone(student.guardian_phone) || null
        : cleanPhone(student.guardian_phone) || cleanPhone(student.phone) || null;

      const sourceTime = `${String(sourceSchedule.start_time || "").slice(0, 5)}-${String(sourceSchedule.end_time || "").slice(0, 5)}`;
      const compensationText = input.compensationMode === "reserve"
        ? `İptal edilen dersinize ait telafi hakkınız saklıdır. Telafi tarihi ve saati planlandığında ayrıca tarafınıza bildirilecektir.`
        : input.compensationMode === "append_end"
          ? `İptal edilen dersiniz telafi olarak sisteminize eklenmiş ve mevcut programınızın sonuna, aynı ders gün/saat düzeniniz korunarak planlanmıştır.\n\n📌 *Normal planlanan bitiş tarihi:* ${formatDateTR(oldNormalEndDate)}\n✅ *Telafi sonrası güncellenen bitiş tarihi:* ${formatDateTR(newCompensationEndDate)}\n🟣 *Telafi dersi:* ${formatDateTR(compensationDate)}`
          : `İptal edilen dersiniz telafi olarak sisteminize eklenmiştir.\n\n📌 *Normal planlanan bitiş tarihi:* ${formatDateTR(oldNormalEndDate)}\n✅ *Telafi sonrası güncellenen bitiş tarihi:* ${formatDateTR(newCompensationEndDate)}\n🟣 *Telafi dersi:* ${formatDateTR(compensationDate)} · ${String(customSchedule?.start_time || "").slice(0, 5)}-${String(customSchedule?.end_time || "").slice(0, 5)}`;

      const message =
        `*SPRİNT YÜZME OKULU | DERS BİLGİLENDİRMESİ*\n\n` +
        `Değerli ${adult ? "Kursiyerimiz" : "Velimiz"},\n\n` +
        `*${studentName}* için ${formatDateTR(input.cancelledDate)} tarihindeki ${sourceTime} yüzme dersimiz *${input.reason.trim()}* nedeniyle gerçekleştirilemeyecektir.\n\n` +
        `${compensationText}\n\n` +
        `Sonraki normal dersiniz mevcut programınız doğrultusunda devam edecektir.\n\n` +
        `*Sprint Yüzme Okulu Yönetimi*`;

      await supabase.from("student_activity_logs").insert({
        organization_id: organizationId,
        student_id: student.id,
        activity_type: "lesson_cancellation_compensation",
        title: input.compensationMode === "reserve" ? "Ders iptali · telafi hakkı saklı" : "Ders iptali · telafi planlandı",
        description:
          `${formatDateTR(input.cancelledDate)} tarihli ${sourceTime} dersi iptal edildi. ` +
          `Gerekçe: ${input.reason.trim()}. ` +
          (compensationDate
            ? `Telafi: ${formatDateTR(compensationDate)}. Normal bitiş: ${formatDateTR(oldNormalEndDate)}. Telafi sonrası bitiş: ${formatDateTR(newCompensationEndDate)}.`
            : "Telafi hakkı saklı; tarih daha sonra planlanacak."),
        old_value: {
          cancelled_lesson_date: input.cancelledDate,
          schedule_id: input.scheduleId,
          normal_planned_end_date: oldNormalEndDate,
          compensation_planned_end_date: currentCompensationEndDate,
        },
        new_value: {
          reason: input.reason.trim(),
          compensation_mode: input.compensationMode,
          compensation_date: compensationDate,
          target_schedule_id: targetScheduleId,
          compensation_planned_end_date: newCompensationEndDate,
        },
        source_type: "lesson_cancellation_operation",
        source_id: input.scheduleId,
        performed_by: profile.id,
        approved_by: profile.id,
        performed_at: now,
        approved_at: now,
      });

      if (input.prepareMessages) {
        await supabase.from("message_logs").insert({
          organization_id: organizationId,
          student_id: student.id,
          template_key: "lesson_cancellation_compensation",
          channel: "whatsapp",
          recipient,
          subject: "Ders İptali / Telafi Bilgilendirmesi",
          message_body: message,
          status: "prepared",
          prepared_by: profile.id,
          metadata: {
            group_id: input.groupId,
            source_schedule_id: input.scheduleId,
            cancelled_date: input.cancelledDate,
            reason: input.reason.trim(),
            compensation_mode: input.compensationMode,
            compensation_date: compensationDate,
            old_normal_end_date: oldNormalEndDate,
            new_compensation_end_date: newCompensationEndDate,
          },
        });

        preparedMessages.push({
          studentId: student.id,
          studentName,
          recipient,
          message,
          oldNormalEndDate,
          newCompensationEndDate,
          compensationDate,
        });
      }

      processed += 1;
      revalidatePath(`/ogrenciler/${student.id}`);
    }

    revalidatePath("/ogrenciler");
    revalidatePath("/yoklama");
    revalidatePath("/ders-operasyonlari");
    revalidatePath("/veli-paneli");
    revalidatePath("/");

    return {
      ok: processed > 0,
      message:
        `${processed} kursiyer için ders iptali işlendi. ` +
        (input.compensationMode === "reserve"
          ? "Telafi hakları planlama bekliyor."
          : `${compensationCreated} telafi dersi oluşturuldu.`) +
        (skipped ? ` ${skipped} kursiyer seçili seansa dahil olmadığı veya kayıt bilgisi eksik olduğu için atlandı.` : ""),
      processedCount: processed,
      compensationCreated,
      skippedCount: skipped,
      preparedMessages,
      source: {
        groupName: group.name,
        cancelledDate: input.cancelledDate,
        sourceTime: `${String(sourceSchedule.start_time || "").slice(0, 5)}-${String(sourceSchedule.end_time || "").slice(0, 5)}`,
        weekday: DAY_NAMES[sourceWeekday] || "Ders",
      },
    };
  } catch (error) {
    return {
      ok: false as const,
      message: error instanceof Error ? `Ders operasyonu tamamlanamadı: ${error.message}` : "Ders operasyonu sırasında beklenmeyen hata oluştu.",
      preparedMessages,
    };
  }
}
