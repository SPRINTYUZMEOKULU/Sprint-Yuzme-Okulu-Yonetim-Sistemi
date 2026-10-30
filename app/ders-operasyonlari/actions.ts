"use server";

import { participationDays, participationWeekday } from "@/lib/lesson-operations/participation";
import { missingEnrollmentReason, type CancellationOutcome } from "@/lib/lesson-operations/outcomes";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function selectedStudentIdsFromCookie(value?: string) {
  return Array.from(
    new Set(
      decodeURIComponent(String(value || ""))
        .split(",")
        .map((id) => id.trim())
        .filter((id) => UUID_RE.test(id))
    )
  ).slice(0, 200);
}

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
  const outcomes: CancellationOutcome[] = [];

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

    const cookieStore = await cookies();
    const selectedStudentIds = selectedStudentIdsFromCookie(
      cookieStore.get("sprintos-lesson-operation-students")?.value
    );

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

    const sourceWeekday = participationWeekday(sourceSchedule.weekday);
    const cancelledDay = new Date(`${input.cancelledDate}T12:00:00Z`).getUTCDay() || 7;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.cancelledDate) || !sourceSchedule.is_active || cancelledDay !== sourceWeekday) {
      return { ok: false as const, message: "İptal tarihi seçilen seansın gününe uygun değil.", preparedMessages };
    }
    const allMembershipStudentIds = Array.from(new Set((membershipsResult.data || []).map((row: any) => row.student_id).filter(Boolean)));
    const membershipStudentIds = selectedStudentIds.length
      ? allMembershipStudentIds.filter((id: string) => selectedStudentIds.includes(id))
      : allMembershipStudentIds;

    if (!membershipStudentIds.length) {
      return {
        ok: false as const,
        message: selectedStudentIds.length
          ? "Seçili kursiyerlerden hiçbiri seçilen grubun aktif üyesi değil. Öğrenci Merkezi'nden seçimi kontrol edin."
          : "Bu grupta aktif kursiyer bulunamadı.",
        preparedMessages,
      };
    }

    const [studentsResult, enrollmentsResult, plansResult] = await Promise.all([
      supabase
        .from("students")
        .select("id,first_name,last_name,phone,guardian_phone,status,is_deleted")
        .eq("organization_id", organizationId)
        .eq("status", "active")
        .eq("is_active", true)
        .in("id", membershipStudentIds),
      supabase
        .from("student_enrollments")
        .select("id,student_id,group_id,planned_end_date,lesson_weekdays,status,created_at,start_date,start_confirmation_required,actual_started_at")
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
      if (!row.start_date || row.start_date > input.cancelledDate
        || (row.start_confirmation_required && !row.actual_started_at)
        || (row.actual_started_at && row.actual_started_at.slice(0, 10) > input.cancelledDate)) continue;
      if (!enrollmentMap.has(row.student_id)) enrollmentMap.set(row.student_id, row);
    }

    const planMap = new Map<string, any>();
    for (const row of plansResult.data || []) {
      if (!planMap.has(row.student_id)) planMap.set(row.student_id, row);
    }

    let customSchedule: any = null;
    if (input.compensationMode === "custom") {
      const targetResult = await supabase.from("lesson_schedules")
        .select("id,group_id,branch_id,weekday,start_time,end_time,is_active")
        .eq("organization_id", organizationId).eq("id", input.customScheduleId!).eq("is_active", true).maybeSingle();
      if (targetResult.error || !targetResult.data) {
        return { ok: false as const, message: "Seçilen telafi seansı bulunamadı veya aktif değil.", preparedMessages };
      }
      customSchedule = targetResult.data;
      const targetGroupResult = await supabase.from("training_groups")
        .select("id,branch_id,course_type,is_active").eq("organization_id", organizationId)
        .eq("id", customSchedule.group_id).eq("is_active", true).maybeSingle();
      const targetGroup = targetGroupResult.data;
      if (targetGroupResult.error || !targetGroup || targetGroup.branch_id !== group.branch_id
        || isAdultCourse(targetGroup.course_type) !== isAdultCourse(group.course_type)) {
        return { ok: false as const, message: "Telafi için aynı havuzdaki uygun çocuk veya yetişkin grubunu seçin.", preparedMessages };
      }
      const targetDay = new Date(`${input.customDate}T12:00:00Z`).getUTCDay() || 7;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(input.customDate || "") || input.customDate! <= input.cancelledDate || targetDay !== participationWeekday(customSchedule.weekday)) {
        return { ok: false as const, message: "Telafi tarihi iptal tarihinden sonra ve seçilen seansın gününe uygun olmalıdır.", preparedMessages };
      }
    }

    const now = new Date().toISOString();
    let processed = 0;
    let skipped = 0;
    let compensationCreated = 0;

    for (const student of studentsResult.data || []) {
      if (student.is_deleted) continue;
      const enrollment = enrollmentMap.get(student.id);
      const plan = (plansResult.data || []).find((row: any) => row.student_id === student.id && row.enrollment_id === enrollment?.id);

      if (!enrollment) {
        skipped += 1;
        outcomes.push({ studentId: student.id, studentName: `${student.first_name || ""} ${student.last_name || ""}`.trim(), groupName: group.name, status: "skipped", reason: missingEnrollmentReason((enrollmentsResult.data || []).filter(e => e.student_id === student.id), input.cancelledDate) });
        continue;
      }

      const selectedWeekdays = participationDays(plan?.selected_weekdays, enrollment.lesson_weekdays, groupSchedules.map((row: any) => row.weekday));

      if (sourceWeekday && selectedWeekdays.length && !selectedWeekdays.includes(sourceWeekday)) {
        skipped += 1;
        outcomes.push({ studentId: student.id, studentName: `${student.first_name || ""} ${student.last_name || ""}`.trim(), groupName: group.name, status: "skipped", reason: `Katılım günleri (${selectedWeekdays.map(day => DAY_NAMES[day]).join(", ")}) iptal edilen ${DAY_NAMES[sourceWeekday]} seansını kapsamıyor.` });
        continue;
      }

      // A repeated click or reopening the operation must never grant a second makeup right.
      const {data:previousOperation,error:previousError}=await supabase.from("student_activity_logs").select("id")
        .eq("organization_id",organizationId).eq("student_id",student.id)
        .eq("activity_type","lesson_cancellation_compensation").eq("source_id",input.scheduleId)
        .eq("old_value->>cancelled_lesson_date",input.cancelledDate).maybeSingle();
      if(previousError||previousOperation){
        skipped++;
        outcomes.push({studentId:student.id,studentName:`${student.first_name||""} ${student.last_name||""}`.trim(),groupName:group.name,status:"skipped",reason:previousError?"Önceki iptal kaydı doğrulanamadı; mükerrer telafiyi önlemek için işlem durduruldu.":"Bu dersin iptal / telafi işlemi zaten kayıtlı. Mevcut telafiyi kursiyer dosyasından düzenleyin."});
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
          outcomes.push({ studentId: student.id, studentName: `${student.first_name || ""} ${student.last_name || ""}`.trim(), groupName: group.name, status: "skipped", reason: "Telafi için uygun sonraki ders günü bulunamadı; katılım programını kontrol edin." });
          continue;
        }

        compensationDate = next.date;
        targetScheduleId = groupSchedules.find((row: any) => participationWeekday(row.weekday) === next.weekday)?.id || null;
        newCompensationEndDate = compensationDate;
      }

      if (input.compensationMode === "custom") {
        compensationDate = input.customDate || null;
        targetScheduleId = input.customScheduleId || null;
        newCompensationEndDate = laterDate(currentCompensationEndDate, compensationDate);
      }

      if(compensationDate&&targetScheduleId){
        const {data:occupied,error:occupiedError}=await supabase.from("student_compensation_lessons").select("id")
          .eq("organization_id",organizationId).eq("student_id",student.id).eq("lesson_date",compensationDate)
          .eq("target_schedule_id",targetScheduleId).in("status",["planned","completed"]).maybeSingle();
        if(occupiedError||occupied){skipped++;outcomes.push({studentId:student.id,studentName:`${student.first_name||""} ${student.last_name||""}`.trim(),groupName:group.name,status:"skipped",reason:occupiedError?"Telafi çakışması kontrol edilemedi.":"Bu tarih ve seansta zaten telafi var. Ayrı bir seans seçin."});continue;}
      }
      if (compensationDate) {
        const compensationInsert = await supabase
          .from("student_compensation_lessons")
          .insert({
            organization_id: organizationId,
            student_id: student.id,
            enrollment_id: enrollment.id,
            source_request_id: null,
            target_group_id: customSchedule?.group_id || input.groupId,
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
          outcomes.push({ studentId: student.id, studentName: `${student.first_name || ""} ${student.last_name || ""}`.trim(), groupName: group.name, status: "skipped", reason: "Telafi kaydı oluşturulamadı. Kursiyer dosyasından kontrol edin." });
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
          group_id: input.groupId,
          group_name: group.name,
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

      let messageWarning = "";
      if (input.prepareMessages) {
        const messageInsert = await supabase.from("message_logs").insert({
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
            target_group_id: customSchedule?.group_id || input.groupId,
            compensation_mode: input.compensationMode,
            compensation_date: compensationDate,
            old_normal_end_date: oldNormalEndDate,
            new_compensation_end_date: newCompensationEndDate,
            selected_operation: selectedStudentIds.length > 0,
          },
        });

        if (messageInsert.error) messageWarning = " Mesaj hazırlanamadı; kursiyer dosyasından kontrol edin.";
        else preparedMessages.push({
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
      outcomes.push({ studentId: student.id, studentName, groupName: group.name, status: "processed", reason: (compensationDate ? `Telafi planlandı: ${formatDateTR(compensationDate)}` : "Telafi hakkı saklı; planlama bekliyor.") + messageWarning, warning: Boolean(messageWarning) });
      revalidatePath(`/ogrenciler/${student.id}`);
    }

    revalidatePath("/ogrenciler");
    const skippedRows = outcomes.filter(item => item.status === "skipped");
    const skippedHistory = skippedRows.length ? await supabase.from("student_activity_logs").insert(skippedRows.map(item => ({
      organization_id: organizationId, student_id: item.studentId,
      activity_type: "lesson_cancellation_skipped", title: "Ders iptali · işlem uygulanmadı",
      description: item.reason, old_value: {cancelled_lesson_date: input.cancelledDate, schedule_id: input.scheduleId},
      new_value: {group_id: input.groupId, group_name: group.name, reason: item.reason},
      source_type: "lesson_cancellation_operation", source_id: input.scheduleId,
      performed_by: profile.id, performed_at: now,
    }))) : {error:null};
    revalidatePath("/ders-operasyonlari/gecmis");
    revalidatePath("/yoklama");
    revalidatePath("/ders-operasyonlari");
    revalidatePath("/veli-paneli");
    revalidatePath("/");

    return {
      ok: processed > 0,
      message:
        `${processed} ${selectedStudentIds.length ? "seçili " : ""}kursiyer için ders iptali işlendi. ` +
        (input.compensationMode === "reserve"
          ? "Telafi hakları planlama bekliyor."
          : `${compensationCreated} telafi dersi oluşturuldu.`) +
        (skipped ? ` ${skipped} kursiyere işlem uygulanmadı; isim ve gerekçeler aşağıda.` : "") +
        (skippedHistory.error ? " Atlanan kursiyerler işlem geçmişine kaydedilemedi; bu ekrandaki listeyi kontrol edin." : ""),
      processedCount: processed,
      compensationCreated,
      skippedCount: skipped,
      outcomes,
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
      outcomes,
      preparedMessages,
    };
  }
}

export type StartingCancellationMessage = {
  studentId: string;
  studentName: string;
  groupName: string;
  recipient: string | null;
  message: string;
};

export async function startingCancellationMessages(input: {
  date: string;
  groupIds: string[];
  reason: string;
  prepare?: boolean;
}) {
  const profile = await requireProfile([...ALLOWED_ROLES]);
  const organizationId = profile.organization_id;
  if (!organizationId || !/^\d{4}-\d{2}-\d{2}$/.test(input.date)) {
    return { ok: false, message: "Geçerli iptal tarihi seçin.", messages: [] as StartingCancellationMessage[] };
  }
  const groupIds = [...new Set(input.groupIds.filter((id) => UUID_RE.test(id)))].slice(0, 100);
  if (!groupIds.length) return { ok: true, message: "", messages: [] as StartingCancellationMessage[] };
  const supabase = await createClient();
  const [enrollments, groups, schedules] = await Promise.all([
    supabase.from("student_enrollments")
      .select("id,student_id,group_id,lesson_weekdays")
      .eq("organization_id", organizationId).eq("status", "active")
      .eq("start_date", input.date).eq("start_confirmation_required", true)
      .is("actual_started_at", null).in("group_id", groupIds),
    supabase.from("training_groups").select("id,name,course_type,branch_id")
      .eq("organization_id", organizationId).eq("is_active", true).in("id", groupIds),
    supabase.from("lesson_schedules").select("group_id,weekday,start_time")
      .eq("organization_id", organizationId).eq("is_active", true).in("group_id", groupIds),
  ]);
  const error = enrollments.error || groups.error || schedules.error;
  if (error) return { ok: false, message: error.message, messages: [] as StartingCancellationMessage[] };
  const ids = [...new Set((enrollments.data || []).map((e) => e.student_id))];
  if (!ids.length) return { ok: true, message: "", messages: [] as StartingCancellationMessage[] };
  const students = await supabase.from("students")
    .select("id,first_name,last_name,status,is_active,is_deleted,phone,guardian_phone")
    .eq("organization_id", organizationId).in("id", ids);
  if (students.error) return { ok: false, message: students.error.message, messages: [] as StartingCancellationMessage[] };
  const cookieStore = await cookies();
  const selectedIds = selectedStudentIdsFromCookie(cookieStore.get("sprintos-lesson-operation-students")?.value);
  const weekday = new Date(`${input.date}T12:00:00Z`).getUTCDay() || 7;
  const messages: StartingCancellationMessage[] = [];
  const seen = new Set<string>();
  for (const enrollment of enrollments.data || []) {
    const student = students.data?.find((s) => s.id === enrollment.student_id);
    const group = groups.data?.find((g) => g.id === enrollment.group_id);
    const groupSessions = (schedules.data || []).filter((s) => s.group_id === enrollment.group_id && participationWeekday(s.weekday) === weekday);
    const days = enrollment.lesson_weekdays;
    if (!student || !group || !groupSessions.length || student.is_deleted || !student.is_active
      || student.status === "passive" || seen.has(student.id)
      || (selectedIds.length && !selectedIds.includes(student.id))
      || (Array.isArray(days) && days.length && !participationDays(null, days, []).includes(weekday))) continue;
    seen.add(student.id);
    const adult = isAdultCourse(group.course_type);
    const recipient = adult ? cleanPhone(student.phone) || cleanPhone(student.guardian_phone) || null
      : cleanPhone(student.guardian_phone) || cleanPhone(student.phone) || null;
    const studentName = `${student.first_name} ${student.last_name}`.trim();
    const time = [...new Set(groupSessions.map((s) => String(s.start_time).slice(0,5)))].join(" / ");
    const message = `*SPRİNT YÜZME OKULU | BAŞLANGIÇ DERSİ BİLGİLENDİRMESİ*\n\nDeğerli ${adult ? "Kursiyerimiz" : "Velimiz"},\n\n*${studentName}* için ${formatDateTR(input.date)} tarihinde saat ${time} itibarıyla başlaması planlanan ilk yüzme dersimiz *${input.reason.trim() || "ders iptali"}* nedeniyle gerçekleştirilemeyecektir.\n\nİlk dersiniz henüz başlamamıştır; bu iptal nedeniyle paketinizden ders hakkı düşülmez. Yeni başlangıç tarihiniz planlandığında ayrıca bilgilendirme yapılacaktır.\n\nAnlayışınız için teşekkür ederiz.\n*Sprint Yüzme Okulu Yönetimi*`;
    if (input.prepare) {
      const existing = await supabase.from("message_logs").select("id,status")
        .eq("organization_id", organizationId).eq("student_id", student.id)
        .eq("template_key", "starting_lesson_cancellation")
        .contains("metadata", {cancelled_date: input.date, group_id: group.id}).limit(1);
      if (existing.error) return { ok: false, message: existing.error.message, messages };
      const row = existing.data?.[0];
      const payload = {recipient, message_body: message};
      const saved = row
        ? row.status === "prepared" ? await supabase.from("message_logs").update(payload).eq("id", row.id).eq("organization_id", organizationId) : {error:null}
        : await supabase.from("message_logs").insert({organization_id: organizationId,student_id: student.id,
          template_key:"starting_lesson_cancellation",channel:"whatsapp",...payload,
          subject:"Başlangıç dersiniz iptal edildi",status:"prepared",prepared_by:profile.id,
          metadata:{cancelled_date:input.date,group_id:group.id,enrollment_id:enrollment.id,reason:input.reason,starting_student:true}});
      if (saved.error) return { ok: false, message: saved.error.message, messages };
    }
    messages.push({studentId:student.id,studentName,groupName:group.name,recipient,message});
  }
  return {ok:true,message:input.prepare ? `${messages.length} başlangıç bilgilendirme mesajı hazırlandı.` : "",messages};
}

export async function confirmCancellationMessageSent(input: {studentId:string;message:string}) {
  const profile=await requireProfile([...ALLOWED_ROLES]);
  if(!profile.organization_id||!input.studentId||!input.message?.trim())return {ok:false,message:"Mesaj bilgisi eksik."};
  const supabase=await createClient();
  const {data:row,error}=await supabase.from("message_logs").select("id,status,metadata")
    .eq("organization_id",profile.organization_id).eq("student_id",input.studentId)
    .eq("template_key","lesson_cancellation_compensation").eq("channel","whatsapp")
    .eq("message_body",input.message).in("status",["prepared","sent","delivered","read"])
    .order("prepared_at",{ascending:false}).limit(1).maybeSingle();
  if(error||!row)return {ok:false,message:"Hazırlanmış iptal mesajı bulunamadı. Sayfayı yenileyin."};
  if(row.status!=="prepared")return {ok:true,message:"Gönderim zaten kayıtlı."};
  const now=new Date().toISOString();
  const {data:updated,error:updateError}=await supabase.from("message_logs").update({status:"sent",sent_at:now,sent_by:profile.id,
    metadata:{...(row.metadata||{}),delivery_confirmation:"user_confirmed",confirmed_at:now,confirmed_by:profile.id}})
    .eq("organization_id",profile.organization_id).eq("id",row.id).eq("status","prepared").select("id");
  if(updateError||!updated?.length)return {ok:false,message:"Gönderim kaydı güncellenemedi. Sayfayı yenileyip kontrol edin."};
  revalidatePath("/");revalidatePath("/ders-operasyonlari");revalidatePath("/ders-operasyonlari/gecmis");revalidatePath(`/ogrenciler/${input.studentId}`);
  return {ok:true,message:"Mesaj gönderildi olarak kaydedildi."};
}

export async function recordCancellationMessageOpened(input: {studentId:string;message:string}) {
  const profile=await requireProfile([...ALLOWED_ROLES]);
  if(!profile.organization_id||!input.studentId||!input.message?.trim())return {ok:false};
  const supabase=await createClient();
  const {data:row,error}=await supabase.from("message_logs").select("id,metadata")
    .eq("organization_id",profile.organization_id).eq("student_id",input.studentId)
    .eq("template_key","lesson_cancellation_compensation").eq("message_body",input.message).eq("status","prepared")
    .order("prepared_at",{ascending:false}).limit(1).maybeSingle();
  if(error||!row)return {ok:false};
  const result=await supabase.from("message_logs").update({metadata:{...row.metadata,delivery_confirmation:"whatsapp_opened",opened_at:new Date().toISOString()}})
    .eq("organization_id",profile.organization_id).eq("id",row.id).eq("status","prepared");
  revalidatePath("/");
  return {ok:!result.error};
}
