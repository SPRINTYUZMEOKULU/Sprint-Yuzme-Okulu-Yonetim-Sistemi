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
  month: string; // YYYY-MM
};

const ALLOWED_ROLES = [
  "owner",
  "admin",
  "branch_manager",
  "registration_staff",
  "accounting",
  "coach",
];

const ALLOWED_STATUSES: AttendanceStatus[] = [
  "present",
  "absent",
  "excused",
  "compensation",
];

async function getAuthorizedProfile() {
  return requireProfile(ALLOWED_ROLES);
}

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

    if (!input.groupId) {
      return {
        ok: false,
        count: 0,
        message: "Grup seçilmedi.",
      };
    }

    if (!input.scheduleId) {
      return {
        ok: false,
        count: 0,
        message: "Ders seansı seçilmedi.",
      };
    }

    if (!input.lessonDate) {
      return {
        ok: false,
        count: 0,
        message: "Ders tarihi seçilmedi.",
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

    // Grup gerçekten bu organizasyona mı ait?
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
        message: "Grup bulunamadı veya bu kuruma ait değil.",
      };
    }

    // Seans gerçekten seçilen gruba mı ait?
    const { data: schedule, error: scheduleError } = await supabase
      .from("lesson_schedules")
      .select("id, group_id, branch_id, coach_id, is_active")
      .eq("id", input.scheduleId)
      .eq("group_id", input.groupId)
      .eq("organization_id", organizationId)
      .maybeSingle();

    if (scheduleError || !schedule) {
      return {
        ok: false,
        count: 0,
        message: "Ders seansı bulunamadı.",
      };
    }

    const studentIds = input.records.map(
      (record) => record.studentId
    );

    // Gönderilen öğrencilerin gerçekten kuruma ait olduğunu doğrula.
    const { data: validStudents, error: studentsError } =
      await supabase
        .from("students")
        .select("id")
        .eq("organization_id", organizationId)
        .in("id", studentIds);

    if (studentsError) {
      return {
        ok: false,
        count: 0,
        message: `Öğrenciler doğrulanamadı: ${studentsError.message}`,
      };
    }

    const validStudentIds = new Set(
      (validStudents || []).map((student) => student.id)
    );

    const hasInvalidStudent = input.records.some(
      (record) => !validStudentIds.has(record.studentId)
    );

    if (hasInvalidStudent) {
      return {
        ok: false,
        count: 0,
        message:
          "Yoklama listesinde bu kuruma ait olmayan öğrenci bulundu.",
      };
    }

    const now = new Date().toISOString();

    const rows = input.records.map((record) => ({
      organization_id: organizationId,
      branch_id:
        schedule.branch_id ||
        group.branch_id ||
        input.branchId ||
        null,

      student_id: record.studentId,
      enrollment_id: record.enrollmentId,
      group_id: input.groupId,
      schedule_id: input.scheduleId,

      coach_id:
        schedule.coach_id ||
        input.coachId ||
        group.primary_coach_id ||
        null,

      lesson_date: input.lessonDate,
      status: record.status,
      coach_note: record.coachNote,

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
      console.error("attendance_records upsert error:", error);

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
      message: "Yoklama başarıyla kaydedildi.",
    };
  } catch (error) {
    console.error("saveAttendance error:", error);

    return {
      ok: false,
      count: 0,
      message:
        error instanceof Error
          ? `Yoklama kaydedilemedi: ${error.message}`
          : "Yoklama kaydedilirken beklenmeyen bir hata oluştu.",
    };
  }
}

export async function getAttendanceForDate(
  input: DailyAttendanceInput
) {
  try {
    const profile = await getAuthorizedProfile();
    const supabase = await createClient();

    if (!profile.organization_id) {
      return {
        ok: false,
        records: [],
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
        records: [],
        message: "Grup, seans ve tarih bilgisi gerekli.",
      };
    }

    const { data, error } = await supabase
      .from("attendance_records")
      .select(
        `
        id,
        student_id,
        enrollment_id,
        group_id,
        schedule_id,
        coach_id,
        lesson_date,
        status,
        coach_note,
        recorded_by,
        updated_by,
        edited_at,
        created_at,
        updated_at
        `
      )
      .eq("organization_id", profile.organization_id)
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
      message:
        data && data.length
          ? "Kayıtlı yoklama yüklendi."
          : "Bu tarih için henüz yoklama alınmamış.",
    };
  } catch (error) {
    console.error("getAttendanceForDate error:", error);

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

    if (!profile.organization_id) {
      return {
        ok: false,
        records: [],
        message: "Organizasyon bilgisi bulunamadı.",
      };
    }

    if (!input.groupId) {
      return {
        ok: false,
        records: [],
        message: "Grup seçilmedi.",
      };
    }

    if (!/^\d{4}-\d{2}$/.test(input.month)) {
      return {
        ok: false,
        records: [],
        message: "Ay bilgisi geçersiz.",
      };
    }

    const [yearText, monthText] = input.month.split("-");
    const year = Number(yearText);
    const monthNumber = Number(monthText);

    const startDate =
      `${yearText}-${monthText}-01`;

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
        `
        id,
        student_id,
        enrollment_id,
        group_id,
        schedule_id,
        coach_id,
        lesson_date,
        status,
        coach_note,
        recorded_by,
        updated_by,
        edited_at,
        created_at,
        updated_at
        `
      )
      .eq("organization_id", profile.organization_id)
      .eq("group_id", input.groupId)
      .gte("lesson_date", startDate)
      .lt("lesson_date", nextMonth)
      .order("lesson_date", { ascending: true });

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
      message: "Aylık yoklama yüklendi.",
    };
  } catch (error) {
    console.error("getMonthlyAttendance error:", error);

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
