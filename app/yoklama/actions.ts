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

/*
 * NORMAL PAKETTEN DÜŞEN STATÜLER
 *
 * Sprint Yüzme Okulu kuralı:
 * - Geldi      -> ders hakkından düşer
 * - Gelmedi    -> ders hakkından düşer
 * - İzinli     -> yalnız bilgilendirme statüsüdür,
 *                 ders hakkından düşer
 * - Telafi     -> normal paketten düşmez
 */
const PACKAGE_CONSUMING_STATUSES: AttendanceStatus[] = [
  "present",
  "absent",
  "excused",
];

async function getAuthorizedProfile() {
  return requireProfile([...ALLOWED_ROLES]);
}

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

/*
 * ---------------------------------------------------------
 * AKTİF KAYITLARIN used_lessons DEĞERİNİ GERÇEK YOKLAMADAN
 * YENİDEN HESAPLA
 * ---------------------------------------------------------
 *
 * Neden +1 / -1 yapmıyoruz?
 *
 * Aynı yoklama tekrar kaydedilebilir veya geçmiş bir yoklama
 * düzeltilebilir. Körlemesine +1 yapmak mükerrer ders düşümüne
 * neden olur.
 *
 * Bunun yerine ilgili enrollment_id için attendance_records
 * tablosundaki gerçek normal ders kayıtlarını yeniden sayıyoruz.
 *
 * Telafi kayıtları (status = compensation) bu sayıya girmez.
 */
async function syncEnrollmentUsedLessons(params: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  organizationId: string;
  enrollmentIds: string[];
}) {
  const { supabase, organizationId, enrollmentIds } = params;

  if (!enrollmentIds.length) {
    return {
      ok: true as const,
      updatedEnrollmentIds: [] as string[],
      studentIds: [] as string[],
    };
  }

  const {
    data: enrollments,
    error: enrollmentError,
  } = await supabase
    .from("student_enrollments")
    .select(
      "id, student_id, total_lessons, used_lessons, status"
    )
    .eq("organization_id", organizationId)
    .in("id", enrollmentIds);

  if (enrollmentError) {
    return {
      ok: false as const,
      message: `Aktif kayıtlar doğrulanamadı: ${enrollmentError.message}`,
      updatedEnrollmentIds: [] as string[],
      studentIds: [] as string[],
    };
  }

  const validEnrollments = enrollments || [];

  if (!validEnrollments.length) {
    return {
      ok: true as const,
      updatedEnrollmentIds: [] as string[],
      studentIds: [] as string[],
    };
  }

  const validEnrollmentIds = validEnrollments.map(
    (enrollment) => enrollment.id
  );

  const {
    data: attendanceRows,
    error: attendanceError,
  } = await supabase
    .from("attendance_records")
    .select("id, enrollment_id, status")
    .eq("organization_id", organizationId)
    .in("enrollment_id", validEnrollmentIds)
    .in("status", PACKAGE_CONSUMING_STATUSES);

  if (attendanceError) {
    return {
      ok: false as const,
      message: `Ders hakkı hesaplanamadı: ${attendanceError.message}`,
      updatedEnrollmentIds: [] as string[],
      studentIds: [] as string[],
    };
  }

  const countMap = new Map<string, number>();

  for (const row of attendanceRows || []) {
    if (!row.enrollment_id) continue;

    countMap.set(
      row.enrollment_id,
      (countMap.get(row.enrollment_id) || 0) + 1
    );
  }

  const updatedEnrollmentIds: string[] = [];
  const studentIds: string[] = [];

  for (const enrollment of validEnrollments) {
    const rawCount = countMap.get(enrollment.id) || 0;

    const totalLessons = Math.max(
      Number(enrollment.total_lessons || 0),
      0
    );

    /*
     * Paket hakkı tanımlıysa kullanılan ders toplam paketi aşmasın.
     * total_lessons = 0 gibi eski/eksik kayıt varsa gerçek sayıyı
     * kaybetmemek için rawCount kullanıyoruz.
     */
    const nextUsedLessons =
      totalLessons > 0
        ? Math.min(rawCount, totalLessons)
        : rawCount;

    const currentUsedLessons = Math.max(
      Number(enrollment.used_lessons || 0),
      0
    );

    if (currentUsedLessons !== nextUsedLessons) {
      const { error: updateError } = await supabase
        .from("student_enrollments")
        .update({
          used_lessons: nextUsedLessons,
          updated_at: new Date().toISOString(),
        })
        .eq("id", enrollment.id)
        .eq("organization_id", organizationId);

      if (updateError) {
        return {
          ok: false as const,
          message: `Ders hakkı güncellenemedi: ${updateError.message}`,
          updatedEnrollmentIds,
          studentIds,
        };
      }
    }

    updatedEnrollmentIds.push(enrollment.id);

    if (enrollment.student_id) {
      studentIds.push(enrollment.student_id);
    }
  }

  return {
    ok: true as const,
    updatedEnrollmentIds,
    studentIds: uniqueStrings(studentIds),
  };
}

/*
 * ---------------------------------------------------------
 * YOKLAMA KAYDET
 * ---------------------------------------------------------
 */
export async function saveAttendance(input: SaveAttendanceInput) {
  try {
    const profile = await getAuthorizedProfile();
    const supabase = await createClient();

    const organizationId = profile.organization_id;

    if (!organizationId) {
      return {
        ok: false,
        count: 0,
        message: "Organizasyon bilgisi bulunamadı.",
      };
    }

    if (!input.groupId || !input.scheduleId || !input.lessonDate) {
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
        message: "Kaydedilecek öğrenci bulunamadı.",
      };
    }

    const invalidRecord = input.records.find(
      (record) =>
        !record.studentId ||
        !ALLOWED_STATUSES.includes(record.status)
    );

    if (invalidRecord) {
      return {
        ok: false,
        count: 0,
        message: "Geçersiz yoklama kaydı tespit edildi.",
      };
    }

    const { data: group, error: groupError } = await supabase
      .from("training_groups")
      .select("id, branch_id, primary_coach_id")
      .eq("id", input.groupId)
      .eq("organization_id", organizationId)
      .maybeSingle();

    if (groupError || !group) {
      return {
        ok: false,
        count: 0,
        message:
          "Grup bulunamadı veya bu kuruma ait değil.",
      };
    }

    const {
      data: schedule,
      error: scheduleError,
    } = await supabase
      .from("lesson_schedules")
      .select("id, branch_id, group_id, coach_id")
      .eq("id", input.scheduleId)
      .eq("group_id", input.groupId)
      .eq("organization_id", organizationId)
      .maybeSingle();

    if (scheduleError || !schedule) {
      return {
        ok: false,
        count: 0,
        message: "Seçilen ders programı bulunamadı.",
      };
    }

    const studentIds = uniqueStrings(
      input.records.map((record) => record.studentId)
    );

    const {
      data: validStudents,
      error: studentError,
    } = await supabase
      .from("students")
      .select("id")
      .eq("organization_id", organizationId)
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
        (student: { id: string }) => student.id
      )
    );

    const unauthorizedStudent = input.records.some(
      (record) => !validStudentIds.has(record.studentId)
    );

    if (unauthorizedStudent) {
      return {
        ok: false,
        count: 0,
        message:
          "Yoklama listesinde kuruma ait olmayan öğrenci bulundu.",
      };
    }

    /*
     * Enrollment ID gönderilen kayıtları ayrıca doğruluyoruz.
     * Böylece başka öğrenciye veya başka kuruma ait kayıt yanlışlıkla
     * yoklamaya bağlanamaz.
     */
    const enrollmentIds = uniqueStrings(
      input.records.map((record) => record.enrollmentId)
    );

    if (enrollmentIds.length) {
      const {
        data: validEnrollments,
        error: enrollmentValidationError,
      } = await supabase
        .from("student_enrollments")
        .select("id, student_id")
        .eq("organization_id", organizationId)
        .in("id", enrollmentIds);

      if (enrollmentValidationError) {
        return {
          ok: false,
          count: 0,
          message: `Öğrenci kayıtları doğrulanamadı: ${enrollmentValidationError.message}`,
        };
      }

      const enrollmentStudentMap = new Map<string, string>();

      for (const enrollment of validEnrollments || []) {
        enrollmentStudentMap.set(
          enrollment.id,
          enrollment.student_id
        );
      }

      const invalidEnrollment = input.records.find((record) => {
        if (!record.enrollmentId) return false;

        return (
          enrollmentStudentMap.get(record.enrollmentId) !==
          record.studentId
        );
      });

      if (invalidEnrollment) {
        return {
          ok: false,
          count: 0,
          message:
            "Yoklama listesinde öğrenciyle eşleşmeyen kayıt/paket bilgisi bulundu.",
        };
      }
    }

    const now = new Date().toISOString();

    const rows = input.records.map((record) => ({
      organization_id: organizationId,

      branch_id:
        schedule.branch_id ??
        group.branch_id ??
        input.branchId ??
        null,

      student_id: record.studentId,

      enrollment_id: record.enrollmentId ?? null,

      group_id: input.groupId,

      schedule_id: input.scheduleId,

      coach_id:
        schedule.coach_id ??
        input.coachId ??
        group.primary_coach_id ??
        null,

      lesson_date: input.lessonDate,

      status: record.status,

      coach_note: record.coachNote?.trim() || null,

      recorded_by: profile.id,
      updated_by: profile.id,
      edited_at: now,
      updated_at: now,
    }));

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
     * -------------------------------------------------------
     * DERS HAKKI SENKRONİZASYONU
     * -------------------------------------------------------
     *
     * Yoklama kaydı başarılı olduktan sonra ilgili paketlerin
     * used_lessons değerini gerçek yoklamadan yeniden hesaplıyoruz.
     *
     * Geldi / Gelmedi / İzinli -> paket hakkından düşer
     * Telafi                    -> normal paketten düşmez
     */
    const syncResult = await syncEnrollmentUsedLessons({
      supabase,
      organizationId,
      enrollmentIds,
    });

    if (!syncResult.ok) {
      /*
       * Yoklama kaydedildi ancak ders sayacı güncellenemediyse
       * kullanıcıya bunu açıkça bildiriyoruz.
       */
      revalidatePath("/yoklama");

      return {
        ok: false,
        count: rows.length,
        message:
          `Yoklama kaydedildi ancak ders hakkı güncellenemedi. ${syncResult.message}`,
      };
    }

    /*
     * -------------------------------------------------------
     * BAĞLI MODÜLLERİ YENİLE
     * -------------------------------------------------------
     */
    revalidatePath("/yoklama");
    revalidatePath("/ogrenciler");
    revalidatePath("/odemeler");
    revalidatePath("/");
    revalidatePath("/veli-paneli");

    for (const studentId of syncResult.studentIds) {
      revalidatePath(`/ogrenciler/${studentId}`);
    }

    return {
      ok: true,
      count: rows.length,
      message:
        "Yoklama başarıyla kaydedildi ve ders hakları güncellendi.",
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

/*
 * ---------------------------------------------------------
 * GÜNLÜK YOKLAMA YÜKLE
 * ---------------------------------------------------------
 */
export async function getAttendanceForDate(
  input: DailyAttendanceInput
) {
  try {
    const profile = await getAuthorizedProfile();
    const supabase = await createClient();

    const organizationId = profile.organization_id;

    if (!organizationId) {
      return {
        ok: false,
        records: [],
        message: "Organizasyon bilgisi bulunamadı.",
      };
    }

    if (!input.groupId || !input.scheduleId || !input.lessonDate) {
      return {
        ok: false,
        records: [],
        message: "Grup, seans ve tarih bilgisi eksik.",
      };
    }

    const { data, error } = await supabase
      .from("attendance_records")
      .select(
        "id, student_id, enrollment_id, group_id, schedule_id, coach_id, lesson_date, status, coach_note, recorded_by, updated_by, edited_at, created_at, updated_at"
      )
      .eq("organization_id", organizationId)
      .eq("group_id", input.groupId)
      .eq("schedule_id", input.scheduleId)
      .eq("lesson_date", input.lessonDate);

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

/*
 * ---------------------------------------------------------
 * AYLIK YOKLAMA
 * ---------------------------------------------------------
 */
export async function getMonthlyAttendance(
  input: MonthlyAttendanceInput
) {
  try {
    const profile = await getAuthorizedProfile();
    const supabase = await createClient();

    const organizationId = profile.organization_id;

    if (!organizationId) {
      return {
        ok: false,
        records: [],
        message: "Organizasyon bilgisi bulunamadı.",
      };
    }

    if (!input.groupId || !/^\d{4}-\d{2}$/.test(input.month)) {
      return {
        ok: false,
        records: [],
        message: "Grup veya ay bilgisi geçersiz.",
      };
    }

    const [yearText, monthText] = input.month.split("-");

    const year = Number(yearText);
    const monthNumber = Number(monthText);

    const startDate = `${yearText}-${monthText}-01`;

    const nextMonth =
      monthNumber === 12
        ? `${year + 1}-01-01`
        : `${year}-${String(monthNumber + 1).padStart(
            2,
            "0"
          )}-01`;

    const { data, error } = await supabase
      .from("attendance_records")
      .select(
        "id, student_id, enrollment_id, group_id, schedule_id, coach_id, lesson_date, status, coach_note, recorded_by, updated_by, edited_at, created_at, updated_at"
      )
      .eq("organization_id", organizationId)
      .eq("group_id", input.groupId)
      .gte("lesson_date", startDate)
      .lt("lesson_date", nextMonth)
      .order("lesson_date", {
        ascending: true,
      });

    if (error) {
      return {
        ok: false,
        records: [],
        message: `Aylık yoklama yüklenemedi: ${error.message}`,
      };
    }

    return {
      ok: true,
      records: data || [],
      message: "Aylık yoklama başarıyla yüklendi.",
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
