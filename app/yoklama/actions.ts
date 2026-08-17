"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth/profile";

type AttendanceStatus =
  | "present"
  | "absent"
  | "excused"
  | "compensation";

type AttendanceRecordInput = {
  studentId: string;
  enrollmentId: string | null;
  status: AttendanceStatus;
  coachNote: string | null;
};

type SaveAttendanceInput = {
  branchId: string | null;
  groupId: string;
  scheduleId: string;
  coachId: string | null;
  lessonDate: string;
  records: AttendanceRecordInput[];
};

type DailyAttendanceInput = {
  groupId: string;
  scheduleId: string;
  lessonDate: string;
};

type MonthlyAttendanceInput = {
  groupId: string;
  month: string;
};

type CompensationLessonRow = {
  id: string;
  student_id: string;
  target_schedule_id: string | null;
  status: "planned" | "completed" | "cancelled";
};

const ALLOWED_ROLES = [
  "owner",
  "admin",
  "branch_manager",
  "registration_staff",
  "accounting",
  "coach",
] as const;

const ALLOWED_STATUSES: AttendanceStatus[] = [
  "present",
  "absent",
  "excused",
  "compensation",
];

async function getAuthorizedProfile() {
  return requireProfile([...ALLOWED_ROLES]);
}

/**
 * Yoklama kaydedildikten sonra aynı tarih / grup / seanstaki
 * telafi planlarını senkronize eder.
 *
 * compensation -> completed
 * diğer statüler -> tekrar planned
 *
 * Böylece geçmiş yoklama düzenlemelerinde telafi hakkı da
 * doğru şekilde geri açılabilir.
 */
async function syncCompensationLessons({
  supabase,
  organizationId,
  profileId,
  groupId,
  scheduleId,
  lessonDate,
  records,
}: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  organizationId: string;
  profileId: string;
  groupId: string;
  scheduleId: string;
  lessonDate: string;
  records: AttendanceRecordInput[];
}) {
  const studentIds = Array.from(
    new Set(records.map((record) => record.studentId))
  );

  if (!studentIds.length) {
    return {
      ok: true,
      completedCount: 0,
      reopenedCount: 0,
    };
  }

  /*
   * Hedef seansı tam eşleşen kayıtları ve eski/veri girişi sırasında
   * target_schedule_id boş bırakılmış kayıtları birlikte dikkate alıyoruz.
   */
  const { data, error } = await supabase
    .from("student_compensation_lessons")
    .select(
      "id, student_id, target_schedule_id, status"
    )
    .eq("organization_id", organizationId)
    .eq("target_group_id", groupId)
    .eq("lesson_date", lessonDate)
    .in("student_id", studentIds)
    .neq("status", "cancelled");

  if (error) {
    return {
      ok: false,
      completedCount: 0,
      reopenedCount: 0,
      message: `Telafi kayıtları kontrol edilemedi: ${error.message}`,
    };
  }

  const compensationLessons =
    (data || []) as CompensationLessonRow[];

  const matchingLessons = compensationLessons.filter(
    (lesson) =>
      !lesson.target_schedule_id ||
      lesson.target_schedule_id === scheduleId
  );

  if (!matchingLessons.length) {
    return {
      ok: true,
      completedCount: 0,
      reopenedCount: 0,
    };
  }

  const statusByStudent = new Map<
    string,
    AttendanceStatus
  >();

  records.forEach((record) => {
    statusByStudent.set(
      record.studentId,
      record.status
    );
  });

  const toComplete = matchingLessons.filter(
    (lesson) =>
      statusByStudent.get(lesson.student_id) ===
        "compensation" &&
      lesson.status !== "completed"
  );

  const toReopen = matchingLessons.filter(
    (lesson) =>
      statusByStudent.has(lesson.student_id) &&
      statusByStudent.get(lesson.student_id) !==
        "compensation" &&
      lesson.status === "completed"
  );

  const now = new Date().toISOString();

  if (toComplete.length) {
    const { error: completeError } = await supabase
      .from("student_compensation_lessons")
      .update({
        status: "completed",
        completed_by: profileId,
        completed_at: now,
        updated_at: now,
      })
      .in(
        "id",
        toComplete.map((lesson) => lesson.id)
      )
      .eq("organization_id", organizationId);

    if (completeError) {
      return {
        ok: false,
        completedCount: 0,
        reopenedCount: 0,
        message: `Telafi tamamlanamadı: ${completeError.message}`,
      };
    }
  }

  if (toReopen.length) {
    const { error: reopenError } = await supabase
      .from("student_compensation_lessons")
      .update({
        status: "planned",
        completed_by: null,
        completed_at: null,
        updated_at: now,
      })
      .in(
        "id",
        toReopen.map((lesson) => lesson.id)
      )
      .eq("organization_id", organizationId);

    if (reopenError) {
      return {
        ok: false,
        completedCount: toComplete.length,
        reopenedCount: 0,
        message: `Telafi kaydı tekrar açılamadı: ${reopenError.message}`,
      };
    }
  }

  return {
    ok: true,
    completedCount: toComplete.length,
    reopenedCount: toReopen.length,
  };
}

export async function saveAttendance(
  input: SaveAttendanceInput
) {
  try {
    const profile = await getAuthorizedProfile();
    const supabase = await createClient();

    const organizationId =
      profile.organization_id;

    if (!organizationId) {
      return {
        ok: false,
        count: 0,
        message:
          "Organizasyon bilgisi bulunamadı.",
      };
    }

    if (
      !input.groupId ||
      !input.scheduleId ||
      !input.lessonDate
    ) {
      return {
        ok: false,
        count: 0,
        message:
          "Grup, ders seansı ve tarih bilgisi zorunludur.",
      };
    }

    if (!input.records?.length) {
      return {
        ok: false,
        count: 0,
        message:
          "Kaydedilecek öğrenci bulunamadı.",
      };
    }

    const invalidRecord =
      input.records.find(
        (record) =>
          !record.studentId ||
          !ALLOWED_STATUSES.includes(
            record.status
          )
      );

    if (invalidRecord) {
      return {
        ok: false,
        count: 0,
        message:
          "Geçersiz yoklama kaydı tespit edildi.",
      };
    }

    /*
     * GRUP DOĞRULAMA
     */
    const {
      data: group,
      error: groupError,
    } = await supabase
      .from("training_groups")
      .select(
        "id, branch_id, primary_coach_id"
      )
      .eq("id", input.groupId)
      .eq(
        "organization_id",
        organizationId
      )
      .maybeSingle();

    if (groupError || !group) {
      return {
        ok: false,
        count: 0,
        message:
          "Grup bulunamadı veya bu kuruma ait değil.",
      };
    }

    /*
     * SEANS DOĞRULAMA
     */
    const {
      data: schedule,
      error: scheduleError,
    } = await supabase
      .from("lesson_schedules")
      .select(
        "id, branch_id, group_id, coach_id"
      )
      .eq("id", input.scheduleId)
      .eq("group_id", input.groupId)
      .eq(
        "organization_id",
        organizationId
      )
      .maybeSingle();

    if (scheduleError || !schedule) {
      return {
        ok: false,
        count: 0,
        message:
          "Seçilen ders programı bulunamadı.",
      };
    }

    /*
     * ÖĞRENCİLERİN KURUMA AİT OLDUĞUNU
     * DOĞRULA
     */
    const studentIds = Array.from(
      new Set(
        input.records.map(
          (record) => record.studentId
        )
      )
    );

    const {
      data: validStudents,
      error: studentError,
    } = await supabase
      .from("students")
      .select("id")
      .eq(
        "organization_id",
        organizationId
      )
      .in("id", studentIds);

    if (studentError) {
      return {
        ok: false,
        count: 0,
        message: `Öğrenciler doğrulanamadı: ${studentError.message}`,
      };
    }

    const validStudentIds = new Set(
      (validStudents || []).map(
        (student: { id: string }) =>
          student.id
      )
    );

    const unauthorizedStudent =
      input.records.some(
        (record) =>
          !validStudentIds.has(
            record.studentId
          )
      );

    if (unauthorizedStudent) {
      return {
        ok: false,
        count: 0,
        message:
          "Yoklama listesinde kuruma ait olmayan öğrenci bulundu.",
      };
    }

    const now =
      new Date().toISOString();

    /*
     * YOKLAMA SATIRLARI
     */
    const rows = input.records.map(
      (record) => ({
        organization_id:
          organizationId,

        branch_id:
          schedule.branch_id ??
          group.branch_id ??
          input.branchId ??
          null,

        student_id:
          record.studentId,

        enrollment_id:
          record.enrollmentId ?? null,

        group_id:
          input.groupId,

        schedule_id:
          input.scheduleId,

        coach_id:
          schedule.coach_id ??
          input.coachId ??
          group.primary_coach_id ??
          null,

        lesson_date:
          input.lessonDate,

        status:
          record.status,

        coach_note:
          record.coachNote?.trim() ||
          null,

        recorded_by:
          profile.id,

        updated_by:
          profile.id,

        edited_at:
          now,

        updated_at:
          now,
      })
    );

    /*
     * YOKLAMA UPSERT
     */
    const { error } = await supabase
      .from("attendance_records")
      .upsert(rows, {
        onConflict:
          "student_id,lesson_date,group_id,schedule_id",
      });

    if (error) {
      return {
        ok: false,
        count: 0,
        message: `Yoklama kaydedilemedi: ${error.message}`,
      };
    }

    /*
     * TELAFİ PLANLARINI SENKRONİZE ET
     */
    const compensationResult =
      await syncCompensationLessons({
        supabase,
        organizationId,
        profileId: profile.id,
        groupId: input.groupId,
        scheduleId: input.scheduleId,
        lessonDate: input.lessonDate,
        records: input.records,
      });

    /*
     * Yoklama başarıyla kaydedildi ancak telafi
     * senkronizasyonunda sorun oluştuysa bunu
     * kullanıcıya açıkça bildiriyoruz.
     */
    if (!compensationResult.ok) {
      revalidatePath("/yoklama");

      return {
        ok: true,
        count: rows.length,
        message:
          `Yoklama kaydedildi. Ancak ${compensationResult.message}`,
      };
    }

    revalidatePath("/yoklama");

    /*
     * SONUÇ MESAJI
     */
    if (
      compensationResult.completedCount >
      0
    ) {
      return {
        ok: true,
        count: rows.length,
        message:
          compensationResult.completedCount ===
          1
            ? "Yoklama kaydedildi. 1 telafi dersi tamamlandı."
            : `Yoklama kaydedildi. ${compensationResult.completedCount} telafi dersi tamamlandı.`,
      };
    }

    if (
      compensationResult.reopenedCount > 0
    ) {
      return {
        ok: true,
        count: rows.length,
        message:
          compensationResult.reopenedCount ===
          1
            ? "Yoklama güncellendi. 1 telafi hakkı tekrar açıldı."
            : `Yoklama güncellendi. ${compensationResult.reopenedCount} telafi hakkı tekrar açıldı.`,
      };
    }

    return {
      ok: true,
      count: rows.length,
      message:
        "Yoklama başarıyla kaydedildi.",
    };
  } catch (error) {
    return {
      ok: false,
      count: 0,
      message:
        error instanceof Error
          ? `Yoklama kaydedilemedi: ${error.message}`
          : "Yoklama kaydedilirken beklenmeyen hata oluştu.",
    };
  }
}

export async function getAttendanceForDate(
  input: DailyAttendanceInput
) {
  try {
    const profile =
      await getAuthorizedProfile();

    const supabase =
      await createClient();

    const organizationId =
      profile.organization_id;

    if (!organizationId) {
      return {
        ok: false,
        records: [],
        message:
          "Organizasyon bilgisi bulunamadı.",
      };
    }

    if (
      !input.groupId ||
      !input.scheduleId ||
      !input.lessonDate
    ) {
      return {
        ok: false,
        records: [],
        message:
          "Grup, seans ve tarih bilgisi eksik.",
      };
    }

    const { data, error } =
      await supabase
        .from("attendance_records")
        .select(
          "id, student_id, enrollment_id, group_id, schedule_id, coach_id, lesson_date, status, coach_note, recorded_by, updated_by, edited_at, created_at, updated_at"
        )
        .eq(
          "organization_id",
          organizationId
        )
        .eq(
          "group_id",
          input.groupId
        )
        .eq(
          "schedule_id",
          input.scheduleId
        )
        .eq(
          "lesson_date",
          input.lessonDate
        );

    if (error) {
      return {
        ok: false,
        records: [],
        message: `Yoklama yüklenemedi: ${error.message}`,
      };
    }

    return {
      ok: true,
      records: data || [],
      message: data?.length
        ? "Kayıtlı yoklama yüklendi."
        : "Bu tarih için henüz yoklama alınmamış.",
    };
  } catch (error) {
    return {
      ok: false,
      records: [],
      message:
        error instanceof Error
          ? error.message
          : "Günlük yoklama yüklenemedi.",
    };
  }
}

export async function getMonthlyAttendance(
  input: MonthlyAttendanceInput
) {
  try {
    const profile =
      await getAuthorizedProfile();

    const supabase =
      await createClient();

    const organizationId =
      profile.organization_id;

    if (!organizationId) {
      return {
        ok: false,
        records: [],
        message:
          "Organizasyon bilgisi bulunamadı.",
      };
    }

    if (
      !input.groupId ||
      !/^\d{4}-\d{2}$/.test(
        input.month
      )
    ) {
      return {
        ok: false,
        records: [],
        message:
          "Grup veya ay bilgisi geçersiz.",
      };
    }

    const [
      yearText,
      monthText,
    ] = input.month.split("-");

    const year =
      Number(yearText);

    const monthNumber =
      Number(monthText);

    const startDate =
      `${yearText}-${monthText}-01`;

    const nextMonth =
      monthNumber === 12
        ? `${year + 1}-01-01`
        : `${year}-${String(
            monthNumber + 1
          ).padStart(
            2,
            "0"
          )}-01`;

    const { data, error } =
      await supabase
        .from("attendance_records")
        .select(
          "id, student_id, enrollment_id, group_id, schedule_id, coach_id, lesson_date, status, coach_note, recorded_by, updated_by, edited_at, created_at, updated_at"
        )
        .eq(
          "organization_id",
          organizationId
        )
        .eq(
          "group_id",
          input.groupId
        )
        .gte(
          "lesson_date",
          startDate
        )
        .lt(
          "lesson_date",
          nextMonth
        )
        .order(
          "lesson_date",
          {
            ascending: true,
          }
        );

    if (error) {
      return {
        ok: false,
        records: [],
        message: `Aylık yoklama yüklenemedi: ${error.message}`,
      };
    }

    return {
      ok: true,
      records:
        data || [],
      message:
        "Aylık yoklama başarıyla yüklendi.",
    };
  } catch (error) {
    return {
      ok: false,
      records: [],
      message:
        error instanceof Error
          ? error.message
          : "Aylık yoklama yüklenemedi.",
    };
  }
}
