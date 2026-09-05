"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import { createNotification } from "@/lib/notifications/create-notification";

import {
  updatePaymentDueDate,
} from "@/app/odemeler/actions";

/*
 * ============================================================
 * YETKİLİ ROLLER
 * ============================================================
 */

const allowedRoles = [
  "owner",
  "admin",
  "branch_manager",
  "registration_staff",
] as const;

/*
 * ============================================================
 * FORM YARDIMCILARI
 * ============================================================
 */

function bool(
  formData: FormData,
  key: string
) {
  return (
    formData.get(key) === "on"
  );
}

function text(
  formData: FormData,
  key: string
) {
  return String(
    formData.get(key) || ""
  ).trim();
}

function nullableText(
  formData: FormData,
  key: string
) {
  const value =
    text(
      formData,
      key
    );

  return (
    value ||
    null
  );
}

function validDate(
  value: string
) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(
      value
    )
  );
}

function jsDayToIsoDay(
  day: number
) {
  return (
    day === 0
      ? 7
      : day
  );
}

function getWeekdays(
  formData: FormData
) {
  return formData
    .getAll(
      "lesson_weekdays"
    )
    .map(Number)
    .filter(
      (day) =>
        Number.isInteger(day) &&
        day >= 0 &&
        day <= 6
    );
}

/*
 * ============================================================
 * TASLAK VERİSİNİ HAZIRLA
 * ============================================================
 */

function getDraftData(
  formData: FormData
) {
  const weekdays =
    getWeekdays(
      formData
    );

  const totalLessons =
    Number(
      formData.get(
        "total_lessons"
      ) || 0
    );

  return {
    branch_id:
      nullableText(
        formData,
        "branch_id"
      ),

    group_id:
      nullableText(
        formData,
        "group_id"
      ),

    package_id:
      nullableText(
        formData,
        "package_id"
      ),

    coach_id:
      nullableText(
        formData,
        "coach_id"
      ),

    start_date:
      nullableText(
        formData,
        "start_date"
      ),

    planned_end_date:
      nullableText(
        formData,
        "planned_end_date"
      ),

    lesson_weekdays:
      weekdays,

    total_lessons:
      Number.isInteger(
        totalLessons
      ) &&
      totalLessons > 0
        ? totalLessons
        : null,

    payment_due_date:
      nullableText(
        formData,
        "payment_due_date"
      ),

    whatsapp_opened:
      bool(
        formData,
        "whatsapp_opened"
      ),
  };
}

/*
 * ============================================================
 * 1) TASLAĞI KAYDET
 *
 * Kesin kayıt oluşturmaz.
 * Enrollment oluşturmaz.
 * Öğrenciyi aktif yapmaz.
 *
 * Kullanıcı başka bölüme gidip tekrar geri geldiğinde
 * kaldığı yerden devam edebilir.
 * ============================================================
 */

export async function saveRegistrationDraft(
  formData: FormData
) {
  const profile =
    await requireProfile([
      ...allowedRoles,
    ]);

  const supabase =
    await createClient();

  const studentId =
    text(
      formData,
      "student_id"
    );

  if (
    !profile.organization_id ||
    !studentId
  ) {
    redirect(
      `/on-kayitlar?error=${encodeURIComponent(
        "Öğrenci bilgisi bulunamadı."
      )}`
    );
  }

  /*
   * ----------------------------------------------------------
   * Öğrencinin bu organizasyona ait olduğunu doğrula
   * ----------------------------------------------------------
   */

  const {
    data: student,
    error: studentError,
  } =
    await supabase
      .from("students")
      .select(
        "id,status"
      )
      .eq(
        "id",
        studentId
      )
      .eq(
        "organization_id",
        profile.organization_id
      )
      .maybeSingle();

  if (
    studentError ||
    !student
  ) {
    redirect(
      `/kayit-tamamlama/${studentId}?error=${encodeURIComponent(
        "Öğrenci bulunamadı."
      )}`
    );
  }

  const startDate =
    text(
      formData,
      "start_date"
    );

  /*
   * Normal vade başlangıç tarihidir.
   *
   * Kullanıcı özel bir tarih seçmişse
   * payment_due_date_manual = true olur.
   */

  const paymentDueDate =
    text(
      formData,
      "payment_due_date"
    ) ||
    startDate;

  const paymentDueDateManual =
    bool(
      formData,
      "payment_due_date_manual"
    );

  const paymentNote =
    nullableText(
      formData,
      "payment_note"
    );

  const messageDraft =
    nullableText(
      formData,
      "message_body"
    );

  const activeEnrollmentId =
    nullableText(
      formData,
      "active_enrollment_id"
    );

  if (
    paymentDueDate &&
    !validDate(
      paymentDueDate
    )
  ) {
    redirect(
      `/kayit-tamamlama/${studentId}?error=${encodeURIComponent(
        "Geçerli bir ödeme vade tarihi seçiniz."
      )}`
    );
  }

  const now =
    new Date()
      .toISOString();

  /*
   * ----------------------------------------------------------
   * Taslak kaydı
   * ----------------------------------------------------------
   */

  const {
    error:
      draftError,
  } =
    await supabase
      .from(
        "registration_completion_checklists"
      )
      .upsert(
        {
          organization_id:
            profile.organization_id,

          student_id:
            studentId,

          draft_data:
            getDraftData(
              formData
            ),

          draft_saved_at:
            now,

          payment_due_date:
            paymentDueDate ||
            null,

          payment_due_date_manual:
            paymentDueDateManual,

          payment_note:
            paymentNote,

          message_draft:
            messageDraft,

          message_prepared:
            Boolean(
              messageDraft
            ),

          swim_cap_delivered:
            bool(
              formData,
              "swim_cap_delivered"
            ),

          updated_by:
            profile.id,

          updated_at:
            now,
        },
        {
          onConflict:
            "student_id",
        }
      );

  if (
    draftError
  ) {
    redirect(
      `/kayit-tamamlama/${studentId}?error=${encodeURIComponent(
        `Taslak kaydedilemedi: ${draftError.message}`
      )}`
    );
  }

  /*
   * ----------------------------------------------------------
   * ÖNEMLİ:
   *
   * Öğrencinin hâlihazırda aktif enrollment'ı varsa
   * vade değişikliği Ödemeler modülünün mevcut aksiyonu
   * üzerinden geçirilir.
   *
   * Böylece:
   *
   * - Ödemeler
   * - Kesin Kayıt Merkezi
   * - Onay Merkezi
   *
   * aynı ödeme vadesini kullanır.
   * ----------------------------------------------------------
   */

  if (
    activeEnrollmentId &&
    paymentDueDate
  ) {
    const result =
      await updatePaymentDueDate(
        activeEnrollmentId,
        paymentDueDate,
        paymentNote ||
          "Kesin Kayıt Merkezi üzerinden ödeme vade tarihi güncellendi."
      );

    if (
      !result.ok
    ) {
      redirect(
        `/kayit-tamamlama/${studentId}?error=${encodeURIComponent(
          result.message
        )}`
      );
    }
  }

  /*
   * ----------------------------------------------------------
   * İlgili ekranları yenile
   * ----------------------------------------------------------
   */

  revalidatePath(
    `/kayit-tamamlama/${studentId}`
  );

  revalidatePath(
    "/odemeler"
  );

  revalidatePath(
    `/ogrenciler/${studentId}`
  );

  redirect(
    `/kayit-tamamlama/${studentId}?saved=1`
  );
}

/*
 * ============================================================
 * 2) NOT + HATIRLATMA EKLE
 * ============================================================
 */

export async function addRegistrationNote(
  formData: FormData
) {
  const profile =
    await requireProfile([
      ...allowedRoles,
    ]);

  const supabase =
    await createClient();

  const studentId =
    text(
      formData,
      "student_id"
    );

  const note =
    text(
      formData,
      "note_text"
    );

  const reminderLocal =
    text(
      formData,
      "reminder_at"
    );

  if (
    !studentId ||
    !note
  ) {
    redirect(
      `/kayit-tamamlama/${studentId}?error=${encodeURIComponent(
        "Not alanını doldurunuz."
      )}#notlar`
    );
  }

  /*
   * ----------------------------------------------------------
   * Öğrenciyi doğrula
   * ----------------------------------------------------------
   */

  const {
    data: student,
  } =
    await supabase
      .from("students")
      .select(
        "id,first_name,last_name"
      )
      .eq(
        "id",
        studentId
      )
      .eq(
        "organization_id",
        profile.organization_id
      )
      .maybeSingle();

  if (
    !student
  ) {
    redirect(
      `/kayit-tamamlama/${studentId}?error=${encodeURIComponent(
        "Öğrenci bulunamadı."
      )}#notlar`
    );
  }

  /*
   * ----------------------------------------------------------
   * Hatırlatma
   * ----------------------------------------------------------
   */

  let reminderAt:
    | string
    | null =
    null;

  if (
    reminderLocal
  ) {
    /* datetime-local saat dilimi taşımaz. SprintOS Türkiye'de
     * çalıştığı için girilen saati UTC+03:00 olarak saklıyoruz. */
    const parsed =
      new Date(
        `${reminderLocal}:00+03:00`
      );

    if (
      Number.isNaN(
        parsed.getTime()
      )
    ) {
      redirect(
        `/kayit-tamamlama/${studentId}?error=${encodeURIComponent(
          "Hatırlatma tarihi geçersiz."
        )}#notlar`
      );
    }

    reminderAt =
      parsed.toISOString();
  }

  const now =
    new Date()
      .toISOString();

  /*
   * ----------------------------------------------------------
   * Not kaydı
   * ----------------------------------------------------------
   */

  const {
    data: noteLog,
    error:
      noteError,
  } =
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
          "registration_note",

        title:
          reminderAt
            ? "Kayıt notu ve hatırlatma"
            : "Kayıt notu",

        description:
          note,

        source_type:
          "registration_completion",

        source_id:
          studentId,

        performed_by:
          profile.id,

        performed_at:
          now,

        reminder_at:
          reminderAt,

        reminder_completed:
          false,
      })
      .select("id")
      .single();

  if (
    noteError
  ) {
    redirect(
      `/kayit-tamamlama/${studentId}?error=${encodeURIComponent(
        `Not kaydedilemedi: ${noteError.message}`
      )}#notlar`
    );
  }

  /*
   * ----------------------------------------------------------
   * Hatırlatma varsa merkezi bildirim kaydı
   *
   * Bu kayıt gelecekte hatırlatma işleyicisinin
   * takip edeceği metadata'yı taşır.
   * ----------------------------------------------------------
   */

  if (
    reminderAt
  ) {
    const reminderBody =
      `${student.first_name} ${student.last_name}: ${note}`;

    const notificationResult = await createNotification({
      organizationId: profile.organization_id!,
      category: "students",
      eventKey: "registration_note_reminder",
      notificationType: "registration_note_reminder",
      title: "Öğrenci notu hatırlatması",
      body: reminderBody,
      message: reminderBody,
      severity: "warning",
      priority: "normal",
      studentId,
      sourceType: "registration_note",
      sourceId: noteLog?.id || studentId,
      entityType: "student_activity_log",
      entityId: noteLog?.id || null,
      targetPath: `/kayit-tamamlama/${studentId}#notlar`,
      recipientProfileIds: [profile.id],
      push: false,
      metadata: {
        reminder_at: reminderAt,
        student_id: studentId,
        note,
      },
    });

    if (!notificationResult.ok) {
      console.error("Öğrenci notu hatırlatması oluşturulamadı:", notificationResult.message);
    }
  }

  revalidatePath(
    `/kayit-tamamlama/${studentId}`
  );

  revalidatePath(
    `/ogrenciler/${studentId}`
  );

  redirect(
    `/kayit-tamamlama/${studentId}?note_saved=1#notlar`
  );
}

/*
 * ============================================================
 * 3) STANDART DIŞI DERS SAYISI İÇİN YÖNETİCİ ONAYI
 * ============================================================
 */

export async function requestCustomLessonCountApproval(
  formData: FormData
) {
  const profile = await requireProfile([
    ...allowedRoles,
  ]);

  const supabase = await createClient();
  const studentId = text(formData, "student_id");
  const totalLessons = Number(formData.get("total_lessons") || 0);
  const branchId = text(formData, "branch_id");
  const groupId = text(formData, "group_id");
  const packageId = nullableText(formData, "package_id");
  const coachId = nullableText(formData, "coach_id");
  const startDate = text(formData, "start_date");
  const plannedEndDate = text(formData, "planned_end_date");
  const paymentDueDate = text(formData, "payment_due_date") || startDate;
  const paymentNote = nullableText(formData, "payment_note");
  const messageBody = text(formData, "message_body");
  const messageSent = bool(formData, "message_sent");
  const weekdays = getWeekdays(formData);

  if (!profile.organization_id || !studentId) {
    redirect(`/on-kayitlar?error=${encodeURIComponent("Öğrenci bilgisi bulunamadı.")}`);
  }

  if (totalLessons === 8 || totalLessons === 12) {
    redirect(
      `/kayit-tamamlama/${studentId}?error=${encodeURIComponent(
        "8 ve 12 ders standart paketlerdir; yönetici onayı gerektirmez."
      )}`
    );
  }

  if (
    !Number.isInteger(totalLessons) ||
    totalLessons < 1 ||
    totalLessons > 100 ||
    !branchId ||
    !groupId ||
    !startDate ||
    !plannedEndDate ||
    !weekdays.length ||
    !paymentDueDate ||
    !validDate(paymentDueDate)
  ) {
    redirect(
      `/kayit-tamamlama/${studentId}?error=${encodeURIComponent(
        "Yönetici onayına göndermeden önce kayıt planındaki zorunlu alanları tamamlayınız."
      )}`
    );
  }

  const { data: student } = await supabase
    .from("students")
    .select("id,first_name,last_name,status")
    .eq("id", studentId)
    .eq("organization_id", profile.organization_id)
    .maybeSingle();

  if (!student) {
    redirect(
      `/kayit-tamamlama/${studentId}?error=${encodeURIComponent("Öğrenci bulunamadı.")}`
    );
  }

  const now = new Date().toISOString();
  const draftData = getDraftData(formData);

  /*
   * Standart dışı ders sayısı onay beklerken öğrenci pasife alınmaz.
   * Aktif öğrenci ise aktif kalır; pasif ise yeniden ön kayıt statüsüne taşınır.
   */
  if (student.status === "passive") {
    await supabase
      .from("students")
      .update({
        status: "pre_registration",
        updated_at: now,
      })
      .eq("id", studentId)
      .eq("organization_id", profile.organization_id);
  }

  await supabase
    .from("registration_completion_checklists")
    .upsert(
      {
        organization_id: profile.organization_id,
        student_id: studentId,
        draft_data: draftData,
        draft_saved_at: now,
        payment_due_date: paymentDueDate,
        payment_due_date_manual: bool(formData, "payment_due_date_manual"),
        payment_note: paymentNote,
        message_draft: messageBody || null,
        message_prepared: Boolean(messageBody),
        message_sent: messageSent,
        location_sent: messageSent,
        swim_cap_delivered: bool(formData, "swim_cap_delivered"),
        updated_by: profile.id,
        updated_at: now,
      },
      { onConflict: "student_id" }
    );

  const { data: approvedExisting } = await supabase
    .from("approval_requests")
    .select("id,reviewed_at")
    .eq("organization_id", profile.organization_id)
    .eq("student_id", studentId)
    .eq("request_type", "registration_custom_lesson_count")
    .eq("status", "approved")
    .contains("new_values", { total_lessons: totalLessons })
    .order("reviewed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (approvedExisting) {
    const currentDraft = {
      ...draftData,
      custom_lesson_approval: {
        status: "approved",
        lesson_count: totalLessons,
        request_id: approvedExisting.id,
        reviewed_at: approvedExisting.reviewed_at,
      },
    };

    await supabase
      .from("registration_completion_checklists")
      .update({
        draft_data: currentDraft,
        draft_saved_at: now,
        updated_by: profile.id,
        updated_at: now,
      })
      .eq("student_id", studentId)
      .eq("organization_id", profile.organization_id);

    redirect(`/kayit-tamamlama/${studentId}?approval=approved#whatsapp`);
  }

  const { data: existing } = await supabase
    .from("approval_requests")
    .select("id")
    .eq("organization_id", profile.organization_id)
    .eq("student_id", studentId)
    .eq("request_type", "registration_custom_lesson_count")
    .eq("status", "pending")
    .contains("new_values", { total_lessons: totalLessons })
    .maybeSingle();

  let approvalRequestId = existing?.id || null;

  if (!existing) {
    const { data: request, error: requestError } = await supabase
      .from("approval_requests")
      .insert({
        organization_id: profile.organization_id,
        request_type: "registration_custom_lesson_count",
        request_label: "Kesin Kayıt · Standart Dışı Ders Sayısı",
        module: "enrollment",
        priority: "high",
        entity_type: "student",
        entity_id: studentId,
        student_id: studentId,
        branch_id: branchId,
        group_id: groupId,
        requested_by: profile.id,
        reason: `Standart paket dışı ${totalLessons} ders ile kesin kayıt talebi.`,
        description: `${student.first_name} ${student.last_name} için ${totalLessons} derslik kayıt planı yönetici onayı bekliyor. Öğrenci onay süresince pasife alınmaz.`,
        old_values: {
          standard_lesson_counts: [8, 12],
        },
        new_values: {
          ...draftData,
          total_lessons: totalLessons,
          branch_id: branchId,
          group_id: groupId,
          package_id: packageId,
          coach_id: coachId,
          start_date: startDate,
          planned_end_date: plannedEndDate,
          payment_due_date: paymentDueDate,
          payment_note: paymentNote,
          message_sent: messageSent,
        },
        status: "pending",
      })
      .select("id")
      .single();

    if (requestError || !request) {
      redirect(
        `/kayit-tamamlama/${studentId}?error=${encodeURIComponent(
          `Yönetici onay talebi oluşturulamadı: ${requestError?.message || "Bilinmeyen hata"}`
        )}`
      );
    }

    approvalRequestId = request.id;

    /*
     * MERKEZİ BİLDİRİM + GERÇEK WEB PUSH
     * Sadece system_notifications satırı eklemek telefona push göndermez.
     * Ön kayıtta çalışan merkezi motor burada da kullanılır.
     */
    try {
      const notificationBody =
        `${student.first_name} ${student.last_name} için ${totalLessons} derslik ` +
        `kesin kayıt yönetici onayı bekliyor.`;

      await createNotification({
        organizationId: profile.organization_id,
        category: "approvals",
        eventKey: "registration_custom_lesson_count_requested",
        notificationType: "registration_custom_lesson_count_requested",
        title: "Yönetici Onayı Bekliyor",
        body: notificationBody,
        message: notificationBody,
        severity: "warning",
        priority: "high",
        studentId,
        sourceType: "approval_request",
        sourceId: request.id,
        entityType: "approval_request",
        entityId: request.id,
        targetPath: "/onay-merkezi",
        push: true,
        metadata: {
          request_type: "registration_custom_lesson_count",
          requested_by: profile.id,
          total_lessons: totalLessons,
          branch_id: branchId,
          group_id: groupId,
          student_name: `${student.first_name} ${student.last_name}`,
        },
      });
    } catch (notificationError) {
      console.error(
        "registration custom lesson approval push error:",
        notificationError
      );
    }
  }

  await supabase
    .from("registration_completion_checklists")
    .update({
      draft_data: {
        ...draftData,
        custom_lesson_approval: {
          status: "pending",
          lesson_count: totalLessons,
          request_id: approvalRequestId,
          requested_at: now,
        },
      },
      draft_saved_at: now,
      updated_by: profile.id,
      updated_at: now,
    })
    .eq("student_id", studentId)
    .eq("organization_id", profile.organization_id);

  revalidatePath("/onay-merkezi");
  revalidatePath(`/kayit-tamamlama/${studentId}`);

  redirect(
    `/kayit-tamamlama/${studentId}?approval_requested=1#kayit-plani`
  );
}

/*
 * ============================================================
 * 3) KESİN KAYDI TAMAMLA
 * ============================================================
 */

export async function completeRegistration(
  formData: FormData
) {
  const profile =
    await requireProfile([
      ...allowedRoles,
    ]);

  const supabase =
    await createClient();

  /*
   * ==========================================================
   * FORM VERİLERİ
   * ==========================================================
   */

  const studentId =
    text(
      formData,
      "student_id"
    );

  const branchId =
    text(
      formData,
      "branch_id"
    );

  const groupId =
    text(
      formData,
      "group_id"
    );

  const packageId =
    text(
      formData,
      "package_id"
    );

  const coachId =
    nullableText(
      formData,
      "coach_id"
    );

  const startDate =
    text(
      formData,
      "start_date"
    );

  const plannedEndDate =
    text(
      formData,
      "planned_end_date"
    );

  const weekdays =
    getWeekdays(
      formData
    );

  const isoWeekdays =
    weekdays
      .map(
        jsDayToIsoDay
      )
      .sort(
        (a, b) =>
          a - b
      );

  const totalLessons =
    Number(
      formData.get(
        "total_lessons"
      ) || 0
    );

  const messageBody =
    text(
      formData,
      "message_body"
    );

  const recipient =
    text(
      formData,
      "recipient"
    );

  /*
   * ----------------------------------------------------------
   * ÖDEME VADESİ
   *
   * Varsayılan = başlangıç tarihi.
   * ----------------------------------------------------------
   */

  const paymentDueDate =
    text(
      formData,
      "payment_due_date"
    ) ||
    startDate;

  const paymentNote =
    nullableText(
      formData,
      "payment_note"
    );

  const messageSent =
    bool(
      formData,
      "message_sent"
    );

  const whatsappOpened =
    bool(
      formData,
      "whatsapp_opened"
    );

  const swimCapDelivered =
    bool(
      formData,
      "swim_cap_delivered"
    );

  /*
   * ==========================================================
   * ZORUNLU ALAN KONTROLÜ
   * ==========================================================
   */

  if (
    !profile.organization_id ||
    !studentId ||
    !branchId ||
    !groupId ||
    !startDate ||
    !plannedEndDate ||
    !weekdays.length ||
    !Number.isInteger(
      totalLessons
    ) ||
    totalLessons < 1 ||
    totalLessons > 100 ||
    !paymentDueDate ||
    !validDate(
      paymentDueDate
    )
  ) {
    redirect(
      `/kayit-tamamlama/${studentId}?error=${encodeURIComponent(
        "Şube, grup, başlangıç tarihi, katılım günleri, ödeme vadesi ve 1-100 arası ders sayısı zorunludur."
      )}`
    );
  }

  /*
   * ==========================================================
   * ÖĞRENCİ + ELEKTRONİK ONAY
   * ==========================================================
   */

  const [
    {
      data:
        studentBefore,

      error:
        studentLookupError,
    },

    {
      data:
        consent,
    },
  ] =
    await Promise.all([
      supabase
        .from(
          "students"
        )
        .select(`
          id,
          first_name,
          last_name,
          student_number,
          status,
          branch_id
        `)
        .eq(
          "id",
          studentId
        )
        .eq(
          "organization_id",
          profile.organization_id
        )
        .single(),

      supabase
        .from(
          "registration_consents"
        )
        .select(`
          health_declaration,
          health_note,
          rules_accepted,
          accepted_at,
          rules_version
        `)
        .eq(
          "organization_id",
          profile.organization_id
        )
        .eq(
          "student_id",
          studentId
        )
        .order(
          "accepted_at",
          {
            ascending:
              false,
          }
        )
        .limit(1)
        .maybeSingle(),
    ]);

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
   * ----------------------------------------------------------
   * Kurallar kabul kaydı zorunlu
   * ----------------------------------------------------------
   */

  if (
    !consent?.rules_accepted
  ) {
    redirect(
      `/kayit-tamamlama/${studentId}?error=${encodeURIComponent(
        "Ön kayıt kuralları kabul kaydı bulunmadan kesin kayıt tamamlanamaz."
      )}`
    );
  }

  if (!whatsappOpened || !messageSent) {
    redirect(
      `/kayit-tamamlama/${studentId}?error=${encodeURIComponent(
        "Kayıt tamamlanmadan önce WhatsApp'ta Aç butonuyla mesajı açınız, WhatsApp üzerinden gönderiniz ve ardından gönderim teyidini işaretleyiniz."
      )}#whatsapp`
    );
  }

  if (totalLessons !== 8 && totalLessons !== 12) {
    const { data: approvedRequest } = await supabase
      .from("approval_requests")
      .select("id")
      .eq("organization_id", profile.organization_id)
      .eq("student_id", studentId)
      .eq("request_type", "registration_custom_lesson_count")
      .eq("status", "approved")
      .contains("new_values", { total_lessons: totalLessons })
      .order("reviewed_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!approvedRequest) {
      redirect(
        `/kayit-tamamlama/${studentId}?error=${encodeURIComponent(
          `${totalLessons} ders standart paket dışıdır. Kesin kayıt için yönetici onayı gereklidir.`
        )}#kayit-plani`
      );
    }
  }

  /*
   * ==========================================================
   * ÖNCEKİ AKTİF ENROLLMENT'I KAPAT
   * ==========================================================
   */

  await supabase
    .from(
      "student_enrollments"
    )
    .update({
      status:
        "completed",
    })
    .eq(
      "student_id",
      studentId
    )
    .eq(
      "status",
      "active"
    );

  /*
   * ==========================================================
   * YENİ AKTİF ENROLLMENT
   *
   * Vade burada gerçek finans sistemine yazılır.
   * ==========================================================
   */

  const {
    data:
      enrollment,

    error:
      enrollmentError,
  } =
    await supabase
      .from(
        "student_enrollments"
      )
      .insert({
        organization_id:
          profile.organization_id,

        student_id:
          studentId,

        package_id:
          packageId ||
          null,

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

        /*
         * ÖDEMELER MODÜLÜYLE AYNI VADE
         */
        payment_due_date:
          paymentDueDate,

        status:
          "active",
      })
      .select(`
        id,
        planned_end_date,
        payment_due_date
      `)
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
   * ==========================================================
   * GRUP ÜYELİĞİ
   * ==========================================================
   */

  await supabase
    .from(
      "student_group_memberships"
    )
    .update({
      is_active:
        false,

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
    error:
      membershipError,
  } =
    await supabase
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

  if (
    membershipError
  ) {
    /*
     * Yeni enrollment yarım kalmasın.
     */

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
   * ==========================================================
   * ESKİ KATILIM PLANINI KAPAT
   * ==========================================================
   */

  await supabase
    .from(
      "student_attendance_plans"
    )
    .update({
      is_active:
        false,

      updated_by:
        profile.id,

      updated_at:
        new Date()
          .toISOString(),
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
   * ==========================================================
   * GERÇEK KATILIM PLANI
   * ==========================================================
   */

  const {
    error:
      attendancePlanError,
  } =
    await supabase
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
    redirect(
      `/kayit-tamamlama/${studentId}?error=${encodeURIComponent(
        `Katılım planı oluşturulamadı: ${attendancePlanError.message}`
      )}`
    );
  }

  /*
   * ==========================================================
   * ÖĞRENCİYİ AKTİF YAP
   * ==========================================================
   */

  const {
    data:
      updatedStudent,

    error:
      studentError,
  } =
    await supabase
      .from(
        "students"
      )
      .update({
        status:
          "active",

        branch_id:
          branchId,

        preferred_group_id:
          groupId,

        preferred_package_id:
          packageId ||
          null,

        preferred_days:
          weekdays.join(","),

        updated_at:
          new Date()
            .toISOString(),
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

  const now =
    new Date()
      .toISOString();

  /*
   * ==========================================================
   * ÖĞRENCİ İŞLEM GEÇMİŞİ
   * ==========================================================
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
        `${weekdays.length} gün/hafta katılım planlandı. ` +
        `Ödeme vadesi: ${paymentDueDate}.`,

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
          packageId ||
          null,

        total_lessons:
          totalLessons,

        weekdays:
          weekdays,

        start_date:
          startDate,

        planned_end_date:
          plannedEndDate,

        payment_due_date:
          paymentDueDate,

        payment_note:
          paymentNote,

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
        now,

      approved_at:
        now,
    });

  /*
   * ==========================================================
   * GERÇEK ÖDEME DURUMUNU HESAPLA
   *
   * Manuel ödeme checkboxı yok.
   * student_payments kaynak.
   * ==========================================================
   */

  const {
    data:
      currentPayments,
  } =
    await supabase
      .from(
        "student_payments"
      )
      .select(`
        id,
        payment_status,
        cancelled_at
      `)
      .eq(
        "organization_id",
        profile.organization_id
      )
      .eq(
        "student_id",
        studentId
      )
      .eq(
        "enrollment_id",
        enrollment.id
      );

  const paymentReceived =
    (
      currentPayments ||
      []
    ).some(
      (item) =>
        item.payment_status ===
          "received" &&
        !item.cancelled_at
    );

  /*
   * ==========================================================
   * KONTROL / TASLAK KAYDI
   * ==========================================================
   */

  await supabase
    .from(
      "registration_completion_checklists"
    )
    .upsert(
      {
        organization_id:
          profile.organization_id,

        student_id:
          studentId,

        enrollment_id:
          enrollment.id,

        /*
         * Otomatik
         */
        payment_received:
          paymentReceived,

        group_selected:
          true,

        attendance_days_selected:
          weekdays.length > 0,

        /*
         * Ön kayıttan otomatik
         */
        health_declaration_received:
          Boolean(
            consent
          ),

        rules_accepted:
          Boolean(
            consent?.rules_accepted
          ),

        /*
         * Mesaj
         */
        message_prepared:
          Boolean(
            messageBody
          ),

        message_sent:
          messageSent,

        /*
         * WhatsApp mesajında konum otomatik olduğu için,
         * mesaj gönderildi olarak işaretlenmişse konum da
         * gönderilmiş kabul edilir.
         */
        location_sent:
          messageSent,

        /*
         * Fiziksel teslim
         */
        swim_cap_delivered:
          swimCapDelivered,

        /*
         * Şimdilik mevcut ödeme ile ilişkilendiriyoruz.
         * İleride makbuz modülü gerçek makbuz kaynağı olacak.
         */
        receipt_created:
          paymentReceived,

        payment_due_date:
          paymentDueDate,

        payment_due_date_manual:
          bool(
            formData,
            "payment_due_date_manual"
          ),

        payment_note:
          paymentNote,

        message_draft:
          messageBody ||
          null,

        draft_data:
          getDraftData(
            formData
          ),

        draft_saved_at:
          now,

        completed_by:
          profile.id,

        completed_at:
          now,

        updated_by:
          profile.id,

        updated_at:
          now,
      },
      {
        onConflict:
          "student_id",
      }
    );

  /*
   * ==========================================================
   * WHATSAPP MESAJ GEÇMİŞİ
   * ==========================================================
   */

  if (
    messageBody
  ) {
    await supabase
      .from(
        "message_logs"
      )
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
          recipient ||
          null,

        subject:
          "Kayıt Tamamlandı",

        message_body:
          messageBody,

        status:
          messageSent
            ? "opened"
            : "prepared",

        prepared_by:
          profile.id,

        sent_by:
          messageSent
            ? profile.id
            : null,

        sent_at:
          messageSent
            ? now
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

          payment_due_date:
            enrollment.payment_due_date,

          total_lessons:
            totalLessons,

          lesson_weekdays:
            weekdays,
        },
      });

    /*
     * --------------------------------------------------------
     * İletişim geçmişi
     * --------------------------------------------------------
     */

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
          recipient ||
          null,

        message_text:
          messageBody,

        status:
          messageSent
            ? "sent"
            : "prepared",

        handled_by:
          profile.id,

        prepared_at:
          now,

        sent_at:
          messageSent
            ? now
            : null,
      });
  }

  /*
   * ==========================================================
   * KAYIT TAMAMLANDI BİLDİRİMİ
   * ==========================================================
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

  /*
   * ==========================================================
   * TÜM BAĞLI MODÜLLERİ YENİLE
   * ==========================================================
   */

  revalidatePath(
    "/on-kayitlar"
  );

  revalidatePath(
    "/odemeler"
  );

  revalidatePath(
    "/kasa"
  );

  revalidatePath(
    "/ogrenciler"
  );

  revalidatePath(
    `/ogrenciler/${studentId}`
  );

  revalidatePath(
    `/kayit-tamamlama/${studentId}`
  );

  /*
   * ==========================================================
   * ÖĞRENCİ MERKEZİNE GİT
   * ==========================================================
   */

  redirect(
    `/ogrenciler/${studentId}?saved=registration`
  );
}
