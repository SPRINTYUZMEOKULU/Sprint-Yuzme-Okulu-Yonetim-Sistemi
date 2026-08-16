"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";

const allowedRoles = [
  "owner",
  "admin",
  "branch_manager",
  "registration_staff",
] as const;

function bool(
  formData: FormData,
  key: string
) {
  return formData.get(key) === "on";
}

function jsDayToIsoDay(
  day: number
) {
  return day === 0 ? 7 : day;
}

export async function completeRegistration(
  formData: FormData
) {
  const profile =
    await requireProfile([
      ...allowedRoles,
    ]);

  const supabase =
    await createClient();

  const studentId = String(
    formData.get("student_id") || ""
  );

  const branchId = String(
    formData.get("branch_id") || ""
  );

  const groupId = String(
    formData.get("group_id") || ""
  );

  const packageId = String(
    formData.get("package_id") || ""
  );

  const coachId =
    String(
      formData.get("coach_id") || ""
    ) || null;

  const startDate = String(
    formData.get("start_date") || ""
  );

  const plannedEndDate = String(
    formData.get(
      "planned_end_date"
    ) || ""
  );

  const weekdays = formData
    .getAll("lesson_weekdays")
    .map(Number)
    .filter(
      (day) =>
        Number.isInteger(day) &&
        day >= 0 &&
        day <= 6
    );

  const isoWeekdays = weekdays
    .map(jsDayToIsoDay)
    .sort(
      (a, b) => a - b
    );

  const totalLessons = Number(
    formData.get(
      "total_lessons"
    ) || 0
  );

  const messageBody = String(
    formData.get(
      "message_body"
    ) || ""
  ).trim();

  const recipient = String(
    formData.get("recipient") || ""
  ).trim();

  if (
    !profile.organization_id ||
    !studentId ||
    !branchId ||
    !groupId ||
    !startDate ||
    !plannedEndDate ||
    !weekdays.length ||
    !Number.isInteger(totalLessons) ||
    totalLessons < 1 ||
    totalLessons > 100
  ) {
    redirect(
      `/kayit-tamamlama/${studentId}?error=${encodeURIComponent(
        "Şube, grup, başlangıç tarihi, katılım günleri ve 1-100 arası ders sayısı zorunludur."
      )}`
    );
  }

  /*
   * ---------------------------------------------------------
   * Önce öğrenciyi kontrol et
   * ---------------------------------------------------------
   */

  const {
    data: studentBefore,
    error: studentLookupError,
  } = await supabase
    .from("students")
    .select(`
      id,
      first_name,
      last_name,
      student_number,
      status,
      branch_id
    `)
    .eq("id", studentId)
    .eq(
      "organization_id",
      profile.organization_id
    )
    .single();

  if (
    studentLookupError ||
    !studentBefore
  ) {
    redirect(
      `/kayit-tamamlama/${studentId}?error=${encodeURIComponent(
        studentLookupError?.message ||
          "Öğrenci bulunamadı."
      )}`
    );
  }

  /*
   * ---------------------------------------------------------
   * Eski aktif enrollment varsa kapat.
   * Yenilemede iki aktif kayıt kalmasın.
   * ---------------------------------------------------------
   */

  await supabase
    .from("student_enrollments")
    .update({
      status: "completed",
    })
    .eq("student_id", studentId)
    .eq("status", "active");

  /*
   * ---------------------------------------------------------
   * Yeni aktif kayıt
   * ---------------------------------------------------------
   */

  const {
    data: enrollment,
    error: enrollmentError,
  } = await supabase
    .from("student_enrollments")
    .insert({
      organization_id:
        profile.organization_id,

      student_id:
        studentId,

      package_id:
        packageId || null,

      group_id:
        groupId,

      start_date:
        startDate,

      planned_end_date:
        plannedEndDate,

      lesson_weekdays:
        weekdays,

      total_lessons:
        totalLessons,

      used_lessons:
        0,

      status:
        "active",
    })
    .select(
      "id,planned_end_date"
    )
    .single();

  if (
    enrollmentError ||
    !enrollment
  ) {
    redirect(
      `/kayit-tamamlama/${studentId}?error=${encodeURIComponent(
        enrollmentError?.message ||
          "Aktif kayıt oluşturulamadı."
      )}`
    );
  }

  /*
   * ---------------------------------------------------------
   * Grup üyeliği
   * ---------------------------------------------------------
   */

  await supabase
    .from(
      "student_group_memberships"
    )
    .update({
      is_active: false,
      ended_at:
        startDate,
    })
    .eq(
      "student_id",
      studentId
    )
    .eq(
      "is_active",
      true
    );

  const {
    error: membershipError,
  } = await supabase
    .from(
      "student_group_memberships"
    )
    .insert({
      organization_id:
        profile.organization_id,

      student_id:
        studentId,

      group_id:
        groupId,

      started_at:
        startDate,

      is_active:
        true,
    });

  if (membershipError) {
    await supabase
      .from(
        "student_enrollments"
      )
      .delete()
      .eq(
        "id",
        enrollment.id
      );

    redirect(
      `/kayit-tamamlama/${studentId}?error=${encodeURIComponent(
        membershipError.message
      )}`
    );
  }

  /*
   * ---------------------------------------------------------
   * Önceki aktif katılım planını kapat
   * ---------------------------------------------------------
   */

  await supabase
    .from(
      "student_attendance_plans"
    )
    .update({
      is_active: false,
      updated_by: profile.id,
      updated_at:
        new Date().toISOString(),
    })
    .eq(
      "student_id",
      studentId
    )
    .eq(
      "is_active",
      true
    );

  /*
   * ---------------------------------------------------------
   * Öğrencinin GERÇEK katılım planı
   *
   * Örneğin grup:
   * Pzt / Çar / Cum
   *
   * öğrenci:
   * Pzt / Çar
   *
   * ise burada yalnız [1,3] tutulur.
   * ---------------------------------------------------------
   */

  const {
    error:
      attendancePlanError,
  } = await supabase
    .from(
      "student_attendance_plans"
    )
    .insert({
      organization_id:
        profile.organization_id,

      student_id:
        studentId,

      enrollment_id:
        enrollment.id,

      group_id:
        groupId,

      selected_weekdays:
        isoWeekdays,

      weekly_frequency:
        isoWeekdays.length,

      package_lesson_count:
        totalLessons,

      start_date:
        startDate,

      normal_planned_end_date:
        plannedEndDate,

      compensation_planned_end_date:
        plannedEndDate,

      is_active:
        true,

      created_by:
        profile.id,

      updated_by:
        profile.id,
    });

  if (
    attendancePlanError
  ) {
    console.error(
      "student attendance plan error:",
      attendancePlanError
    );

    redirect(
      `/kayit-tamamlama/${studentId}?error=${encodeURIComponent(
        `Katılım planı oluşturulamadı: ${attendancePlanError.message}`
      )}`
    );
  }

  /*
   * ---------------------------------------------------------
   * Öğrenciyi aktif yap
   *
   * Burada Supabase trigger öğrenci numarasını
   * otomatik oluşturacak.
   * ---------------------------------------------------------
   */

  const {
    data: updatedStudent,
    error: studentError,
  } = await supabase
    .from("students")
    .update({
      status:
        "active",

      branch_id:
        branchId,

      preferred_group_id:
        groupId,

      preferred_package_id:
        packageId || null,

      preferred_days:
        weekdays.join(","),

      updated_at:
        new Date().toISOString(),
    })
    .eq(
      "id",
      studentId
    )
    .eq(
      "organization_id",
      profile.organization_id
    )
    .select(`
      id,
      student_number,
      first_name,
      last_name
    `)
    .single();

  if (
    studentError ||
    !updatedStudent
  ) {
    redirect(
      `/kayit-tamamlama/${studentId}?error=${encodeURIComponent(
        studentError?.message ||
          "Öğrenci aktif hale getirilemedi."
      )}`
    );
  }

  /*
   * ---------------------------------------------------------
   * Öğrenci işlem geçmişi
   * ---------------------------------------------------------
   */

  await supabase
    .from(
      "student_activity_logs"
    )
    .insert({
      organization_id:
        profile.organization_id,

      student_id:
        studentId,

      activity_type:
        "registration_completed",

      title:
        "Kayıt tamamlandı",

      description:
        `${totalLessons} derslik kayıt tamamlandı. ` +
        `${weekdays.length} gün/hafta katılım planlandı.`,

      old_value: {
        status:
          studentBefore.status,

        branch_id:
          studentBefore.branch_id,
      },

      new_value: {
        status:
          "active",

        student_number:
          updatedStudent.student_number,

        branch_id:
          branchId,

        group_id:
          groupId,

        package_id:
          packageId || null,

        total_lessons:
          totalLessons,

        weekdays:
          weekdays,

        start_date:
          startDate,

        planned_end_date:
          plannedEndDate,

        coach_id:
          coachId,
      },

      source_type:
        "registration_completion",

      source_id:
        enrollment.id,

      performed_by:
        profile.id,

      approved_by:
        profile.id,

      performed_at:
        new Date().toISOString(),

      approved_at:
        new Date().toISOString(),
    });

  /*
   * ---------------------------------------------------------
   * Kontrol listesi
   * ---------------------------------------------------------
   */

  const checklist = {
    organization_id:
      profile.organization_id,

    student_id:
      studentId,

    enrollment_id:
      enrollment.id,

    payment_received:
      bool(
        formData,
        "payment_received"
      ),

    group_selected:
      true,

    attendance_days_selected:
      weekdays.length > 0,

    health_declaration_received:
      bool(
        formData,
        "health_declaration_received"
      ),

    rules_accepted:
      bool(
        formData,
        "rules_accepted"
      ),

    message_prepared:
      Boolean(messageBody),

    message_sent:
      bool(
        formData,
        "message_sent"
      ),

    location_sent:
      bool(
        formData,
        "location_sent"
      ),

    swim_cap_delivered:
      bool(
        formData,
        "swim_cap_delivered"
      ),

    receipt_created:
      bool(
        formData,
        "receipt_created"
      ),

    completed_by:
      profile.id,

    completed_at:
      new Date().toISOString(),

    updated_at:
      new Date().toISOString(),
  };

  await supabase
    .from(
      "registration_completion_checklists"
    )
    .upsert(
      checklist,
      {
        onConflict:
          "student_id",
      }
    );

  /*
   * ---------------------------------------------------------
   * Mesaj geçmişi
   * ---------------------------------------------------------
   */

  if (messageBody) {
    await supabase
      .from("message_logs")
      .insert({
        organization_id:
          profile.organization_id,

        student_id:
          studentId,

        template_key:
          "registration_completed",

        channel:
          "whatsapp",

        recipient:
          recipient || null,

        subject:
          "Kayıt Tamamlandı",

        message_body:
          messageBody,

        status:
          bool(
            formData,
            "message_sent"
          )
            ? "opened"
            : "prepared",

        prepared_by:
          profile.id,

        sent_by:
          bool(
            formData,
            "message_sent"
          )
            ? profile.id
            : null,

        sent_at:
          bool(
            formData,
            "message_sent"
          )
            ? new Date().toISOString()
            : null,

        metadata: {
          coach_id:
            coachId,

          enrollment_id:
            enrollment.id,

          student_number:
            updatedStudent.student_number,

          planned_end_date:
            enrollment.planned_end_date,

          total_lessons:
            totalLessons,

          lesson_weekdays:
            weekdays,
        },
      });

    await supabase
      .from(
        "student_contact_logs"
      )
      .insert({
        organization_id:
          profile.organization_id,

        student_id:
          studentId,

        contact_type:
          "registration",

        channel:
          "whatsapp",

        recipient_phone:
          recipient || null,

        message_text:
          messageBody,

        status:
          bool(
            formData,
            "message_sent"
          )
            ? "sent"
            : "prepared",

        handled_by:
          profile.id,

        prepared_at:
          new Date().toISOString(),

        sent_at:
          bool(
            formData,
            "message_sent"
          )
            ? new Date().toISOString()
            : null,
      });
  }

  /*
   * ---------------------------------------------------------
   * Bildirim
   * ---------------------------------------------------------
   */

  await supabase
    .from(
      "system_notifications"
    )
    .insert({
      organization_id:
        profile.organization_id,

      recipient_profile_id:
        null,

      notification_type:
        "registration_completed",

      title:
        "Yeni öğrenci kaydı tamamlandı",

      body:
        `${updatedStudent.first_name} ${updatedStudent.last_name} ` +
        `${totalLessons} derslik paket ile aktif kayda alındı.`,

      priority:
        "normal",

      student_id:
        studentId,

      source_type:
        "registration_completion",

      source_id:
        enrollment.id,

      target_path:
        `/ogrenciler/${studentId}`,

      push_required:
        true,
    });

  revalidatePath(
    "/on-kayitlar"
  );

  revalidatePath(
    "/ogrenciler"
  );

  revalidatePath(
    `/ogrenciler/${studentId}`
  );

  redirect(
    `/ogrenciler/${studentId}?saved=registration`
  );
}
