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
  organizationId?: string;
  currentProfileId?: string;
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

async function getAuthorizedProfile() {
  return requireProfile([...ALLOWED_ROLES]);
}

export async function saveAttendance(
  input: SaveAttendanceInput
) {
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

    const invalidRecord = input.records.find(
      (record) =>
        !record.studentId ||
        !ALLOWED_STATUSES.includes(record.status)
    );

    if (invalidRecord) {
      return {
        ok: false,
        count: 0,
        message:
          "Geçersiz yoklama kaydı tespit edildi.",
      };
    }

    const { data: group, error: groupError } =
      await supabase
        .from("training_groups")
        .select(
          "id, organization_id, branch_id, primary_coach_id"
        )
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
      .select(
        "id, organization_id, branch_id, group_id, coach_id"
      )
      .eq("id", input.scheduleId)
      .eq("group_id", input.groupId)
      .eq("organization_id", organizationId)
      .maybeSingle();

    if (scheduleError || !schedule) {
      return {
        ok: false,
        count: 0,
        message:
          "Seçilen ders programı bulunamadı.",
      };
    }

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

    const unauthorizedStudent =
      input.records.some(
        (record) =>
          !validStudentIds.has(record.studentId)
      );

    if (unauthorizedStudent) {
      return {
        ok: false,
        count: 0,
        message:
          "Yoklama listesinde kuruma ait olmayan öğrenci bulundu.",
      };
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

      enrollment_id:
        record.enrollmentId ?? null,

      group_id: input.groupId,

      schedule_id: input.scheduleId,

      coach_id:
        schedule.coach_id ??
        input.coachId ??
        group.primary_coach_id ??
        null,

      lesson_date: input.lessonDate,

      status: record.status,

      coach_note:
        record.coachNote?.trim() || null,

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

    revalidatePath("/yoklama");

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
    const profile = await getAuthorizedProfile();
    const supabase = await createClient();

    const organizationId = profile.organization_id;

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
        message:
          "Organizasyon bilgisi bulunamadı.",
      };
    }

    if (
      !input.groupId ||
      !/^\d{4}-\d{2}$/.test(input.month)
    ) {
      return {
        ok: false,
        records: [],
        message:
          "Grup veya ay bilgisi geçersiz.",
      };
    }

    const [yearText, monthText] =
      input.month.split("-");

    const year = Number(yearText);
    const monthNumber = Number(monthText);

    const startDate =
      `${yearText}-${monthText}-01`;

    const nextMonth =
      monthNumber === 12
        ? `${year + 1}-01-01`
        : `${year}-${String(
            monthNumber + 1
          ).padStart(2, "0")}-01`;

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
