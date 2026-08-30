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

type BulkTransferInput = {
  studentIds: string[];
  targetBranchId: string;
  targetGroupId: string;
  targetScheduleIds: string[];
  effectiveDate: string;
  prepareMessages: boolean;
  updateAttendancePlans: boolean;
  logHistory: boolean;
};

type BulkMessageInput = {
  studentIds: string[];
  templateKey:
    | "pool_closed"
    | "hygiene"
    | "technical"
    | "group_transfer"
    | "time_change"
    | "coach_change"
    | "renewal"
    | "payment"
    | "general";
  messageBody: string;
  subject?: string;
};

type PreparedBulkMessage = {
  studentId: string;
  studentName: string;
  recipient: string | null;
  message: string;
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

function uniqueStrings(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(
      values.filter(
        (value): value is string =>
          typeof value === "string" && value.trim().length > 0
      )
    )
  );
}

function formatDateTR(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return value;
  return `${String(day).padStart(2, "0")}.${String(month).padStart(
    2,
    "0"
  )}.${year}`;
}

function cleanPhone(value?: string | null) {
  return (value || "").replace(/\D/g, "");
}

function isoToJsDay(day: number) {
  return day === 7 ? 0 : day;
}

function calculateEndDate(
  startDate: string,
  lessonCount: number,
  isoWeekdays: number[]
) {
  if (lessonCount <= 0) return startDate;

  const selected = new Set(isoWeekdays);
  const cursor = new Date(`${startDate}T12:00:00`);
  let counted = 0;
  let guard = 0;

  while (counted < lessonCount && guard < 730) {
    const jsDay = cursor.getDay();
    const isoDay = jsDay === 0 ? 7 : jsDay;

    if (selected.has(isoDay)) {
      counted += 1;

      if (counted >= lessonCount) {
        const y = cursor.getFullYear();
        const m = String(cursor.getMonth() + 1).padStart(2, "0");
        const d = String(cursor.getDate()).padStart(2, "0");
        return `${y}-${m}-${d}`;
      }
    }

    cursor.setDate(cursor.getDate() + 1);
    guard += 1;
  }

  return startDate;
}

function timeText(value?: string | null) {
  return value ? value.slice(0, 5) : "";
}

export async function bulkTransferStudents(input: BulkTransferInput) {
  try {
    const profile = await requireProfile([...ALLOWED_ROLES]);
    const organizationId = profile.organization_id;

    if (!organizationId) {
      return {
        ok: false as const,
        message: "Organizasyon bilgisi bulunamadı.",
      };
    }

    const studentIds = uniqueStrings(input.studentIds);

    if (
      !studentIds.length ||
      !input.targetBranchId ||
      !input.targetGroupId ||
      !input.effectiveDate ||
      !input.targetScheduleIds?.length
    ) {
      return {
        ok: false as const,
        message:
          "Öğrenci, yeni şube, grup, ders seansı ve başlangıç tarihi zorunludur.",
      };
    }

    const supabase = await createClient();

    const [
      studentsResult,
      targetBranchResult,
      targetGroupResult,
      schedulesResult,
      enrollmentsResult,
      membershipsResult,
      plansResult,
      balancesResult,
    ] = await Promise.all([
      supabase
        .from("students")
        .select(
          "id,first_name,last_name,student_number,phone,guardian_phone,branch_id,preferred_group_id"
        )
        .eq("organization_id", organizationId)
        .in("id", studentIds),

      supabase
        .from("branches")
        .select("id,name")
        .eq("organization_id", organizationId)
        .eq("id", input.targetBranchId)
        .maybeSingle(),

      supabase
        .from("training_groups")
        .select("id,branch_id,name,course_type,primary_coach_id")
        .eq("organization_id", organizationId)
        .eq("id", input.targetGroupId)
        .maybeSingle(),

      supabase
        .from("lesson_schedules")
        .select(
          "id,group_id,branch_id,coach_id,weekday,start_time,end_time,is_active"
        )
        .eq("organization_id", organizationId)
        .eq("group_id", input.targetGroupId)
        .eq("is_active", true)
        .in("id", input.targetScheduleIds),

      supabase
        .from("student_enrollments")
        .select(
          "id,student_id,package_id,group_id,branch_id,start_date,planned_end_date,lesson_weekdays,total_lessons,used_lessons,status"
        )
        .eq("organization_id", organizationId)
        .eq("status", "active")
        .in("student_id", studentIds)
        .order("created_at", { ascending: false }),

      supabase
        .from("student_group_memberships")
        .select("id,student_id,group_id,started_at,is_active")
        .eq("organization_id", organizationId)
        .eq("is_active", true)
        .in("student_id", studentIds),

      supabase
        .from("student_attendance_plans")
        .select("*")
        .eq("organization_id", organizationId)
        .eq("is_active", true)
        .in("student_id", studentIds),

      supabase
        .from("student_lesson_balance")
        .select("student_id,compensation_lesson_balance")
        .in("student_id", studentIds),
    ]);

    const loadError =
      studentsResult.error ||
      targetBranchResult.error ||
      targetGroupResult.error ||
      schedulesResult.error ||
      enrollmentsResult.error ||
      membershipsResult.error ||
      plansResult.error ||
      balancesResult.error;

    if (loadError) {
      return {
        ok: false as const,
        message: `Aktarım verileri yüklenemedi: ${loadError.message}`,
      };
    }

    const targetBranch = targetBranchResult.data;
    const targetGroup = targetGroupResult.data;
    const targetSchedules = schedulesResult.data || [];

    if (!targetBranch || !targetGroup) {
      return {
        ok: false as const,
        message: "Yeni şube veya grup bulunamadı.",
      };
    }

    if (targetGroup.branch_id !== input.targetBranchId) {
      return {
        ok: false as const,
        message: "Seçilen grup seçilen şubeye ait değil.",
      };
    }

    if (targetSchedules.length !== uniqueStrings(input.targetScheduleIds).length) {
      return {
        ok: false as const,
        message: "Seçilen ders seanslarından biri geçersiz.",
      };
    }

    const targetWeekdays = Array.from(
      new Set(
        targetSchedules
          .map((schedule) => Number(schedule.weekday))
          .filter(
            (day) => Number.isInteger(day) && day >= 1 && day <= 7
          )
      )
    ).sort((a, b) => a - b);

    if (!targetWeekdays.length) {
      return {
        ok: false as const,
        message: "Yeni programda geçerli ders günü bulunamadı.",
      };
    }

    const enrollmentMap = new Map<string, any>();
    for (const enrollment of enrollmentsResult.data || []) {
      if (!enrollmentMap.has(enrollment.student_id)) {
        enrollmentMap.set(enrollment.student_id, enrollment);
      }
    }

    const membershipMap = new Map(
      (membershipsResult.data || []).map((row: any) => [
        row.student_id,
        row,
      ])
    );

    const planMap = new Map(
      (plansResult.data || []).map((row: any) => [
        row.student_id,
        row,
      ])
    );

    const balanceMap = new Map(
      (balancesResult.data || []).map((row: any) => [
        row.student_id,
        Math.max(
          0,
          Number(row.compensation_lesson_balance || 0)
        ),
      ])
    );

    const studentMap = new Map(
      (studentsResult.data || []).map((student: any) => [
        student.id,
        student,
      ])
    );

    const oldGroupIds = uniqueStrings(
      Array.from(enrollmentMap.values()).map((row: any) => row.group_id)
    );

    const oldBranchIds = uniqueStrings(
      Array.from(enrollmentMap.values()).map((row: any) => row.branch_id)
    );

    const [oldGroupsResult, oldBranchesResult] = await Promise.all([
      oldGroupIds.length
        ? supabase
            .from("training_groups")
            .select("id,name,branch_id")
            .eq("organization_id", organizationId)
            .in("id", oldGroupIds)
        : Promise.resolve({ data: [], error: null }),

      oldBranchIds.length
        ? supabase
            .from("branches")
            .select("id,name")
            .eq("organization_id", organizationId)
            .in("id", oldBranchIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    const oldGroupMap = new Map(
      (oldGroupsResult.data || []).map((row: any) => [row.id, row])
    );

    const oldBranchMap = new Map(
      (oldBranchesResult.data || []).map((row: any) => [row.id, row])
    );

    const scheduleText = targetSchedules
      .slice()
      .sort((a: any, b: any) => {
        const dayDiff =
          Number(a.weekday || 0) - Number(b.weekday || 0);
        if (dayDiff !== 0) return dayDiff;
        return String(a.start_time || "").localeCompare(
          String(b.start_time || "")
        );
      })
      .map(
        (schedule: any) =>
          `${DAY_NAMES[Number(schedule.weekday)] || "Ders"} ${timeText(
            schedule.start_time
          )}-${timeText(schedule.end_time)}`
      )
      .join(" • ");

    const now = new Date().toISOString();
    const succeeded: string[] = [];
    const failed: Array<{ studentId: string; reason: string }> = [];
    const preparedMessages: Array<{
      studentId: string;
      studentName: string;
      recipient: string | null;
      message: string;
    }> = [];

    for (const studentId of studentIds) {
      const student = studentMap.get(studentId);
      const enrollment = enrollmentMap.get(studentId);
      const oldMembership = membershipMap.get(studentId);
      const oldPlan = planMap.get(studentId);

      if (!student || !enrollment) {
        failed.push({
          studentId,
          reason: "Aktif öğrenci kaydı/paketi bulunamadı.",
        });
        continue;
      }

      const totalLessons = Math.max(
        Number(enrollment.total_lessons || 0),
        0
      );
      const usedLessons = Math.max(
        Number(enrollment.used_lessons || 0),
        0
      );
      const remainingLessons = Math.max(
        totalLessons - usedLessons,
        0
      );
      const compensationBalance = balanceMap.get(studentId) || 0;

      const newNormalEndDate = calculateEndDate(
        input.effectiveDate,
        remainingLessons,
        targetWeekdays
      );

      const newCompensationEndDate = calculateEndDate(
        input.effectiveDate,
        remainingLessons + compensationBalance,
        targetWeekdays
      );

      const oldGroup = enrollment.group_id
        ? oldGroupMap.get(enrollment.group_id)
        : null;

      const oldBranchId =
        enrollment.branch_id ??
        oldGroup?.branch_id ??
        student.branch_id ??
        null;

      const oldBranch = oldBranchId
        ? oldBranchMap.get(oldBranchId)
        : null;

      const enrollmentUpdate = await supabase
        .from("student_enrollments")
        .update({
          branch_id: input.targetBranchId,
          group_id: input.targetGroupId,
          planned_end_date: newNormalEndDate,
          lesson_weekdays: targetWeekdays.map(isoToJsDay),
          updated_at: now,
        })
        .eq("id", enrollment.id)
        .eq("organization_id", organizationId);

      if (enrollmentUpdate.error) {
        failed.push({
          studentId,
          reason: enrollmentUpdate.error.message,
        });
        continue;
      }

      if (oldMembership?.id) {
        const closeMembership = await supabase
          .from("student_group_memberships")
          .update({
            is_active: false,
            ended_at: input.effectiveDate,
          })
          .eq("id", oldMembership.id)
          .eq("organization_id", organizationId);

        if (closeMembership.error) {
          failed.push({
            studentId,
            reason: closeMembership.error.message,
          });
          continue;
        }
      }

      const newMembership = await supabase
        .from("student_group_memberships")
        .insert({
          organization_id: organizationId,
          student_id: studentId,
          group_id: input.targetGroupId,
          started_at: input.effectiveDate,
          is_active: true,
        });

      if (newMembership.error) {
        failed.push({
          studentId,
          reason: newMembership.error.message,
        });
        continue;
      }

      if (input.updateAttendancePlans) {
        if (oldPlan?.id) {
          const closePlan = await supabase
            .from("student_attendance_plans")
            .update({
              is_active: false,
              updated_by: profile.id,
              updated_at: now,
            })
            .eq("id", oldPlan.id)
            .eq("organization_id", organizationId);

          if (closePlan.error) {
            failed.push({
              studentId,
              reason: closePlan.error.message,
            });
            continue;
          }
        }

        const newPlan = await supabase
          .from("student_attendance_plans")
          .insert({
            organization_id: organizationId,
            student_id: studentId,
            enrollment_id: enrollment.id,
            group_id: input.targetGroupId,
            selected_weekdays: targetWeekdays,
            weekly_frequency: targetWeekdays.length,
            package_lesson_count: totalLessons,
            start_date: input.effectiveDate,
            normal_planned_end_date: newNormalEndDate,
            compensation_planned_end_date:
              newCompensationEndDate,
            is_active: true,
            created_by: profile.id,
            updated_by: profile.id,
          });

        if (newPlan.error) {
          failed.push({
            studentId,
            reason: newPlan.error.message,
          });
          continue;
        }
      }

      const studentUpdate = await supabase
        .from("students")
        .update({
          branch_id: input.targetBranchId,
          preferred_group_id: input.targetGroupId,
          preferred_days: targetWeekdays
            .map(isoToJsDay)
            .join(","),
          updated_at: now,
        })
        .eq("id", studentId)
        .eq("organization_id", organizationId);

      if (studentUpdate.error) {
        failed.push({
          studentId,
          reason: studentUpdate.error.message,
        });
        continue;
      }

      if (input.logHistory) {
        await supabase.from("student_activity_logs").insert({
          organization_id: organizationId,
          student_id: studentId,
          activity_type: "group_transfer",
          title: "Grup / şube aktarımı",
          description:
            `${oldBranch?.name || "Eski şube"} / ${
              oldGroup?.name || "Eski grup"
            } programından ` +
            `${targetBranch.name} / ${targetGroup.name} programına aktarıldı. ` +
            `${remainingLessons} normal ders hakkı yeni programa taşındı. ` +
            `Yeni planlanan bitiş: ${formatDateTR(newNormalEndDate)}.`,
          old_value: {
            branch_id: oldBranchId,
            group_id: enrollment.group_id,
            planned_end_date: enrollment.planned_end_date,
            used_lessons: usedLessons,
            remaining_lessons: remainingLessons,
          },
          new_value: {
            branch_id: input.targetBranchId,
            group_id: input.targetGroupId,
            selected_weekdays: targetWeekdays,
            schedule_ids: input.targetScheduleIds,
            effective_date: input.effectiveDate,
            planned_end_date: newNormalEndDate,
            compensation_end_date: newCompensationEndDate,
            remaining_lessons: remainingLessons,
          },
          source_type: "student_center_bulk_transfer",
          source_id: enrollment.id,
          performed_by: profile.id,
          approved_by: profile.id,
          performed_at: now,
          approved_at: now,
        });
      }

      if (input.prepareMessages) {
        const studentName =
          `${student.first_name || ""} ${student.last_name || ""}`.trim();

        const recipient =
          cleanPhone(student.guardian_phone) ||
          cleanPhone(student.phone) ||
          null;

        const message =
          `*SPRİNT YÜZME OKULU*\n\n` +
          `Sayın Velimiz,\n\n` +
          `${studentName} isimli öğrencimizin ders programı güncellenmiştir.\n\n` +
          `🏢 *Yeni Şube:* ${targetBranch.name}\n` +
          `👥 *Yeni Grup:* ${targetGroup.name}\n` +
          `📅 *Yeni Program:* ${scheduleText}\n` +
          `▶️ *Başlangıç:* ${formatDateTR(input.effectiveDate)}\n` +
          `🏊 *Kalan Normal Ders:* ${remainingLessons}\n` +
          `📌 *Yeni Planlanan Bitiş:* ${formatDateTR(
            newNormalEndDate
          )}\n\n` +
          `Dersleriniz yeni program doğrultusunda kaldığı yerden devam edecektir.\n\n` +
          `*Sprint Yüzme Okulu Yönetimi*`;

        await supabase.from("message_logs").insert({
          organization_id: organizationId,
          student_id: studentId,
          template_key: "group_transfer",
          channel: "whatsapp",
          recipient,
          subject: "Grup / Şube Değişikliği",
          message_body: message,
          status: "prepared",
          prepared_by: profile.id,
          metadata: {
            enrollment_id: enrollment.id,
            old_branch_id: oldBranchId,
            old_group_id: enrollment.group_id,
            new_branch_id: input.targetBranchId,
            new_group_id: input.targetGroupId,
            schedule_ids: input.targetScheduleIds,
            remaining_lessons: remainingLessons,
            planned_end_date: newNormalEndDate,
          },
        });

        await supabase.from("student_contact_logs").insert({
          organization_id: organizationId,
          student_id: studentId,
          contact_type: "group_transfer",
          channel: "whatsapp",
          recipient_phone: recipient,
          message_text: message,
          status: "prepared",
          prepared_at: now,
        });

        preparedMessages.push({
          studentId,
          studentName,
          recipient,
          message,
        });
      }

      succeeded.push(studentId);
      revalidatePath(`/ogrenciler/${studentId}`);
    }

    revalidatePath("/ogrenciler");
    revalidatePath("/yoklama");
    revalidatePath("/odemeler");
    revalidatePath("/veli-paneli");
    revalidatePath("/");

    return {
      ok: failed.length === 0,
      message:
        failed.length === 0
          ? `${succeeded.length} öğrenci başarıyla yeni programa aktarıldı.`
          : `${succeeded.length} öğrenci aktarıldı, ${failed.length} öğrenci için işlem tamamlanamadı.`,
      transferredCount: succeeded.length,
      failedCount: failed.length,
      failed,
      preparedMessages,
      target: {
        branchName: targetBranch.name,
        groupName: targetGroup.name,
        scheduleText,
      },
    };
  } catch (error) {
    return {
      ok: false as const,
      message:
        error instanceof Error
          ? `Toplu aktarım yapılamadı: ${error.message}`
          : "Toplu aktarım sırasında beklenmeyen hata oluştu.",
    };
  }
}

export async function prepareBulkStudentMessage(input: BulkMessageInput) {
  const preparedMessages: PreparedBulkMessage[] = [];

  try {
    const profile = await requireProfile([...ALLOWED_ROLES]);
    const organizationId = profile.organization_id;

    if (!organizationId) {
      return {
        ok: false as const,
        message: "Organizasyon bilgisi bulunamadı.",
        preparedMessages,
      };
    }

    const studentIds = uniqueStrings(input.studentIds);
    const body = input.messageBody?.trim();

    if (!studentIds.length || !body) {
      return {
        ok: false as const,
        message: "Öğrenci ve mesaj metni zorunludur.",
        preparedMessages,
      };
    }

    const supabase = await createClient();

    const { data: students, error } = await supabase
      .from("students")
      .select("id,first_name,last_name,phone,guardian_phone")
      .eq("organization_id", organizationId)
      .in("id", studentIds);

    if (error) {
      return {
        ok: false as const,
        message: `Öğrenciler yüklenemedi: ${error.message}`,
        preparedMessages,
      };
    }

    const now = new Date().toISOString();
    let count = 0;

    for (const student of students || []) {
      const recipient =
        cleanPhone(student.guardian_phone) ||
        cleanPhone(student.phone) ||
        null;

      const studentName =
        `${student.first_name || ""} ${student.last_name || ""}`.trim();

      await supabase.from("message_logs").insert({
        organization_id: organizationId,
        student_id: student.id,
        template_key: input.templateKey,
        channel: "whatsapp",
        recipient,
        subject: input.subject || "Bilgilendirme",
        message_body: body,
        status: "prepared",
        prepared_by: profile.id,
        metadata: {
          source: "student_center_bulk_message",
        },
      });

      await supabase.from("student_contact_logs").insert({
        organization_id: organizationId,
        student_id: student.id,
        contact_type: input.templateKey,
        channel: "whatsapp",
        recipient_phone: recipient,
        message_text: body,
        status: "prepared",
        prepared_at: now,
      });

      preparedMessages.push({
        studentId: student.id,
        studentName,
        recipient,
        message: body,
      });

      count += 1;
      revalidatePath(`/ogrenciler/${student.id}`);
    }

    revalidatePath("/ogrenciler");

    return {
      ok: true as const,
      count,
      message: `${count} öğrenci/veli için mesaj hazırlandı.`,
      preparedMessages,
    };
  } catch (error) {
    return {
      ok: false as const,
      message:
        error instanceof Error
          ? `Mesajlar hazırlanamadı: ${error.message}`
          : "Mesaj hazırlama sırasında beklenmeyen hata oluştu.",
      preparedMessages,
    };
  }
}
