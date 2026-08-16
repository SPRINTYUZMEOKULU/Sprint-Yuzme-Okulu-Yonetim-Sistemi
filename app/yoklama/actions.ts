"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

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
  organizationId: string;
  currentProfileId: string;
  branchId: string | null;
  groupId: string;
  scheduleId: string;
  coachId: string | null;
  lessonDate: string;
  records: AttendanceRecordInput[];
};

export async function saveAttendance(input: SaveAttendanceInput) {
  try {
    const supabase = await createClient();

    if (!input.organizationId) {
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

    if (!input.records.length) {
      return {
        ok: false,
        count: 0,
        message: "Kaydedilecek öğrenci bulunamadı.",
      };
    }

    const allowedStatuses: AttendanceStatus[] = [
      "present",
      "absent",
      "excused",
      "compensation",
    ];

    const invalidRecord = input.records.find(
      (record) =>
        !record.studentId ||
        !allowedStatuses.includes(record.status)
    );

    if (invalidRecord) {
      return {
        ok: false,
        count: 0,
        message: "Geçersiz yoklama kaydı tespit edildi.",
      };
    }

    const rows = input.records.map((record) => ({
      organization_id: input.organizationId,
      branch_id: input.branchId,
      student_id: record.studentId,
      enrollment_id: record.enrollmentId,
      group_id: input.groupId,
      schedule_id: input.scheduleId,
      coach_id: input.coachId,
      lesson_date: input.lessonDate,
      status: record.status,
      coach_note: record.coachNote,
      recorded_by: input.currentProfileId,
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
