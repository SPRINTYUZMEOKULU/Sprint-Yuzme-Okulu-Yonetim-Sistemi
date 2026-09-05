"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseAdminClient } from "@supabase/supabase-js";
import { createNotification } from "@/lib/notifications/create-notification";

const staffRoles = [
  "owner",
  "admin",
  "branch_manager",
  "registration_staff",
  "accounting",
  "coach",
] as const;

const approvalRoles = [
  "owner",
  "admin",
] as const;

function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Supabase yönetici bağlantısı yapılandırılmamış.");
  }

  return createSupabaseAdminClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function getText(
  value: FormDataEntryValue | null,
  maxLength = 2000
) {
  return typeof value === "string"
    ? value.trim().slice(0, maxLength)
    : "";
}

function goError(
  studentId: string,
  message: string
): never {
  redirect(
    `/ogrenciler/${studentId}?error=${encodeURIComponent(message)}`
  );
}

function goSaved(
  studentId: string,
  key: string
): never {
  redirect(
    `/ogrenciler/${studentId}?saved=${encodeURIComponent(key)}`
  );
}

function studentFullName(student: {
  first_name?: string | null;
  last_name?: string | null;
}) {
  return [student.first_name, student.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();
}

function reminderIso(value: string) {
  if (!value) return null;
  const parsed = new Date(`${value}:00+03:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

/* =========================================================
   NOT EKLE
   ========================================================= */

export async function addStudentNote(
  formData: FormData
) {
  const profile = await requireProfile([
    ...staffRoles,
  ]);

  const studentId = getText(
    formData.get("student_id"),
    100
  );

  const body = getText(
    formData.get("body"),
    4000
  );

  if (
    !studentId ||
    !body ||
    !profile.organization_id
  ) {
    goError(
      studentId,
      "Not alanı zorunludur."
    );
  }

  const supabase = await createClient();

  const { data: createdNote, error } = await supabase
    .from("student_notes")
    .insert({
      organization_id:
        profile.organization_id,

      student_id:
        studentId,

      author_id:
        profile.id,

      note_type:
        getText(
          formData.get("note_type"),
          50
        ) || "general",

      body,

      is_guardian_visible:
        formData.get(
          "is_guardian_visible"
        ) === "on",
    })
    .select("id")
    .single();

  if (error) {
    goError(
      studentId,
      error.message
    );
  }

  const reminderAt = reminderIso(getText(formData.get("reminder_at"), 30));

  if (reminderAt && createdNote?.id) {
    const { data: reminderLog } = await supabase
      .from("student_activity_logs")
      .insert({
        organization_id: profile.organization_id,
        student_id: studentId,
        activity_type: "student_note_reminder",
        title: "Öğrenci notu hatırlatması",
        description: body,
        source_type: "student_note",
        source_id: createdNote.id,
        performed_by: profile.id,
        performed_at: new Date().toISOString(),
        reminder_at: reminderAt,
        reminder_completed: false,
      })
      .select("id")
      .single();

    if (reminderLog?.id) {
      await createNotification({
        organizationId: profile.organization_id!,
        category: "students",
        eventKey: "student_note_reminder",
        notificationType: "student_note_reminder",
        title: "Öğrenci notu hatırlatması",
        body,
        severity: "warning",
        priority: "normal",
        studentId,
        sourceType: "student_note_reminder",
        sourceId: reminderLog.id,
        entityType: "student_note",
        entityId: createdNote.id,
        targetPath: `/ogrenciler/${studentId}#notlar`,
        recipientProfileIds: [profile.id],
        push: false,
        metadata: { reminder_at: reminderAt, student_id: studentId, note: body },
      });
    }
  }

  await supabase
    .from("student_timeline_events")
    .insert({
      organization_id:
        profile.organization_id,

      student_id:
        studentId,

      event_type:
        "note_added",

      title:
        "Yeni not eklendi",

      description:
        body,

      created_by:
        profile.id,
    });

  revalidatePath(
    `/ogrenciler/${studentId}`
  );

  goSaved(
    studentId,
    "note"
  );
}

/* =========================================================
   PROFİL GÜNCELLE
   ========================================================= */

export async function updateStudentProfile(
  formData: FormData
) {
  const profile = await requireProfile([
    ...staffRoles,
  ]);

  const studentId = getText(
    formData.get("student_id"),
    100
  );

  if (
    !studentId ||
    !profile.organization_id
  ) {
    goError(
      studentId,
      "Öğrenci bulunamadı."
    );
  }

  const supabase = await createClient();

  const payload = {
    phone:
      getText(
        formData.get("phone"),
        30
      ) || null,

    guardian_name:
      getText(
        formData.get("guardian_name"),
        200
      ) || null,

    guardian_phone:
      getText(
        formData.get("guardian_phone"),
        30
      ) || null,

    emergency_contact_name:
      getText(
        formData.get(
          "emergency_contact_name"
        ),
        200
      ) || null,

    emergency_contact_phone:
      getText(
        formData.get(
          "emergency_contact_phone"
        ),
        30
      ) || null,

    allergy_note:
      getText(
        formData.get("allergy_note"),
        2000
      ) || null,

    chronic_condition_note:
      getText(
        formData.get(
          "chronic_condition_note"
        ),
        2000
      ) || null,

    medication_note:
      getText(
        formData.get("medication_note"),
        2000
      ) || null,

    emergency_medical_note:
      getText(
        formData.get(
          "emergency_medical_note"
        ),
        2000
      ) || null,

    general_note:
      getText(
        formData.get("general_note"),
        4000
      ) || null,
  };

  const { error } = await supabase
    .from("students")
    .update(payload)
    .eq(
      "organization_id",
      profile.organization_id
    )
    .eq(
      "id",
      studentId
    );

  if (error) {
    goError(
      studentId,
      error.message
    );
  }

  const generalNote = getText(formData.get("general_note"), 4000);
  const generalReminderAt = reminderIso(
    getText(formData.get("general_note_reminder_at"), 30),
  );

  if (generalNote && generalReminderAt) {
    const { data: reminderLog } = await supabase
      .from("student_activity_logs")
      .insert({
        organization_id: profile.organization_id,
        student_id: studentId,
        activity_type: "student_note_reminder",
        title: "Genel öğrenci notu hatırlatması",
        description: generalNote,
        source_type: "student_general_note",
        source_id: studentId,
        performed_by: profile.id,
        performed_at: new Date().toISOString(),
        reminder_at: generalReminderAt,
        reminder_completed: false,
      })
      .select("id")
      .single();

    if (reminderLog?.id) {
      await createNotification({
        organizationId: profile.organization_id!,
        category: "students",
        eventKey: "student_note_reminder",
        notificationType: "student_note_reminder",
        title: "Genel öğrenci notu hatırlatması",
        body: generalNote,
        severity: "warning",
        priority: "normal",
        studentId,
        sourceType: "student_note_reminder",
        sourceId: reminderLog.id,
        targetPath: `/ogrenciler/${studentId}#genel-bilgiler`,
        recipientProfileIds: [profile.id],
        push: false,
        metadata: { reminder_at: generalReminderAt, student_id: studentId, note: generalNote },
      });
    }
  }

  await supabase
    .from("student_timeline_events")
    .insert({
      organization_id:
        profile.organization_id,

      student_id:
        studentId,

      event_type:
        "profile_updated",

      title:
        "Kursiyer bilgileri güncellendi",

      created_by:
        profile.id,
    });

  revalidatePath(
    `/ogrenciler/${studentId}`
  );

  goSaved(
    studentId,
    "profile"
  );
}

export async function updateStudentHealthAndConsents(formData: FormData) {
  const profile = await requireProfile([...staffRoles]);
  const studentId = getText(formData.get("student_id"), 100);

  if (!studentId || !profile.organization_id) {
    goError(studentId, "Öğrenci bulunamadı.");
  }

  if (formData.get("management_confirmed") !== "on") {
    goError(
      studentId,
      "Sağlık ve kabul bilgilerini kaydetmek için yönetim teyidi zorunludur.",
    );
  }

  const supabase = await createClient();
  const healthDeclaration = formData.get("health_declaration") === "on";
  const rulesAccepted = formData.get("rules_accepted") === "on";
  const whatsappPermission = formData.get("whatsapp_permission") === "on";
  const healthNote = getText(formData.get("health_note"), 2000) || null;

  const { data: student, error: studentError } = await supabase
    .from("students")
    .select("id,birth_date")
    .eq("organization_id", profile.organization_id)
    .eq("id", studentId)
    .single();

  if (studentError || !student) {
    goError(studentId, "Öğrenci bulunamadı veya bu kayda erişim yetkiniz yok.");
  }

  const { error: healthError } = await supabase
    .from("students")
    .update({
      allergy_note: getText(formData.get("allergy_note"), 2000) || null,
      chronic_condition_note:
        getText(formData.get("chronic_condition_note"), 2000) || null,
      medication_note: getText(formData.get("medication_note"), 2000) || null,
      emergency_medical_note:
        getText(formData.get("emergency_medical_note"), 2000) || null,
    })
    .eq("organization_id", profile.organization_id)
    .eq("id", studentId);

  if (healthError) {
    goError(studentId, `Sağlık bilgileri kaydedilemedi: ${healthError.message}`);
  }

  // Kullanıcı ve organizasyon erişimi yukarıda doğrulandı. Beyan tablosunun
  // RLS politikası yönetim INSERT işlemini kapattığı için yalnızca bu dar
  // sunucu işlemi admin istemcisiyle yürütülür.
  const admin = createAdminClient();
  const { data: existingConsent, error: lookupError } = await admin
    .from("registration_consents")
    .select("student_id,form_snapshot")
    .eq("student_id", studentId)
    .maybeSingle();

  if (lookupError) {
    goError(studentId, `Beyan bilgileri okunamadı: ${lookupError.message}`);
  }

  const now = new Date().toISOString();
  const previousSnapshot =
    existingConsent?.form_snapshot &&
    typeof existingConsent.form_snapshot === "object" &&
    !Array.isArray(existingConsent.form_snapshot)
      ? existingConsent.form_snapshot
      : {};
  const consentPayload = {
    organization_id: profile.organization_id,
    registration_for: "child",
    health_declaration: healthDeclaration,
    health_note: healthNote,
    rules_accepted: rulesAccepted,
    whatsapp_permission: whatsappPermission,
    contact_request: true,
    accepted_at: now,
    form_snapshot: {
      ...previousSnapshot,
      management_completion: {
        completed_at: now,
        completed_by: profile.id,
        source: "student_file",
      },
    },
  };

  const consentMutation = existingConsent
    ? admin
        .from("registration_consents")
        .update(consentPayload)
        .eq("student_id", studentId)
    : admin.from("registration_consents").insert({
        student_id: studentId,
        ...consentPayload,
      });
  const { error: consentError } = await consentMutation;

  if (consentError) {
    goError(studentId, `Beyan bilgileri kaydedilemedi: ${consentError.message}`);
  }

  await supabase.from("student_timeline_events").insert({
    organization_id: profile.organization_id,
    student_id: studentId,
    event_type: "health_consents_updated",
    title: "Sağlık ve kabul beyanları güncellendi",
    description:
      "Sağlık bilgileri ve kayıt kabulleri yönetim teyidiyle öğrenci dosyasından kaydedildi.",
    created_by: profile.id,
  });

  revalidatePath(`/ogrenciler/${studentId}`);
  revalidatePath("/on-kayitlar");
  goSaved(studentId, "health-consents");
}

/* =========================================================
   ÖĞRENCİ SİLME TALEBİ
   ========================================================= */

export async function requestStudentDeletion(
  formData: FormData
) {
  const profile = await requireProfile([
    ...staffRoles,
  ]);

  const studentId = getText(
    formData.get("student_id"),
    100
  );

  const reason = getText(
    formData.get("reason"),
    2000
  );

  if (
    !studentId ||
    !profile.organization_id
  ) {
    goError(
      studentId,
      "Öğrenci bulunamadı."
    );
  }

  if (reason.length < 5) {
    goError(
      studentId,
      "Silme nedeni zorunludur."
    );
  }

  const supabase = await createClient();

  const {
    data: student,
    error: studentError,
  } = await supabase
    .from("students")
    .select(
      `
      id,
      student_number,
      first_name,
      last_name,
      branch_id,
      status,
      is_deleted
      `
    )
    .eq(
      "organization_id",
      profile.organization_id
    )
    .eq(
      "id",
      studentId
    )
    .single();

  if (
    studentError ||
    !student
  ) {
    goError(
      studentId,
      "Öğrenci bulunamadı."
    );
  }

  if (student.is_deleted) {
    goError(
      studentId,
      "Bu öğrenci zaten arşivlenmiş."
    );
  }

  const {
    data: existingRequest,
  } = await supabase
    .from("student_change_requests")
    .select("id")
    .eq(
      "organization_id",
      profile.organization_id
    )
    .eq(
      "student_id",
      studentId
    )
    .eq(
      "request_type",
      "student_delete"
    )
    .eq(
      "status",
      "pending"
    )
    .maybeSingle();

  if (existingRequest) {
    goError(
      studentId,
      "Bu öğrenci için zaten yönetici onayı bekleyen bir silme talebi var."
    );
  }

  const fullName =
    studentFullName(student);

  const {
    data: request,
    error: requestError,
  } = await supabase
    .from("student_change_requests")
    .insert({
      organization_id:
        profile.organization_id,

      student_id:
        studentId,

      request_type:
        "student_delete",

      status:
        "pending",

      title:
        "Öğrenci silme talebi",

      reason,

      old_value: {
        student_number:
          student.student_number,

        full_name:
          fullName,

        branch_id:
          student.branch_id,

        status:
          student.status,
      },

      requested_value: {
        is_deleted: true,
      },

      requested_by:
        profile.id,
    })
    .select("id")
    .single();

  if (
    requestError ||
    !request
  ) {
    goError(
      studentId,
      requestError?.message ||
        "Silme talebi oluşturulamadı."
    );
  }

  await supabase
    .from("student_timeline_events")
    .insert({
      organization_id:
        profile.organization_id,

      student_id:
        studentId,

      event_type:
        "delete_requested",

      title:
        "Öğrenci silme talebi oluşturuldu",

      description:
        reason,

      created_by:
        profile.id,
    });

  await supabase
    .from("alerts")
    .insert({
      organization_id:
        profile.organization_id,

      branch_id:
        student.branch_id || null,

      student_id:
        studentId,

      alert_type:
        "student_delete_request",

      title:
        "Öğrenci silme talebi",

      description:
        `${student.student_number || "Öğrenci"} · ${fullName} için silme talebi yönetici onayı bekliyor. Neden: ${reason}`,

      priority:
        "important",

      status:
        "open",

      action_label:
        "Talebi İncele",

      deduplication_key:
        `student-delete-request-${request.id}`,
    });

  revalidatePath(
    `/ogrenciler/${studentId}`
  );

  revalidatePath(
    "/uyarilar"
  );

  revalidatePath(
    "/onay-merkezi"
  );

  goSaved(
    studentId,
    "delete-request"
  );
}

/* =========================================================
   SİLME TALEBİNİ ONAYLA
   OWNER / ADMIN
   ========================================================= */

export async function approveStudentDeletion(
  formData: FormData
) {
  const profile = await requireProfile([
    ...approvalRoles,
  ]);

  const requestId = getText(
    formData.get("request_id"),
    100
  );

  const studentId = getText(
    formData.get("student_id"),
    100
  );

  const reviewNote = getText(
    formData.get("review_note"),
    2000
  );

  if (
    !requestId ||
    !studentId ||
    !profile.organization_id
  ) {
    goError(
      studentId,
      "Silme talebi bulunamadı."
    );
  }

  const supabase = await createClient();

  const {
    data: requestRow,
    error: requestError,
  } = await supabase
    .from("student_change_requests")
    .select(
      `
      id,
      student_id,
      request_type,
      status,
      reason,
      requested_by
      `
    )
    .eq(
      "organization_id",
      profile.organization_id
    )
    .eq(
      "id",
      requestId
    )
    .single();

  if (
    requestError ||
    !requestRow
  ) {
    goError(
      studentId,
      "Silme talebi bulunamadı."
    );
  }

  if (
    requestRow.request_type !==
    "student_delete"
  ) {
    goError(
      studentId,
      "Geçersiz talep türü."
    );
  }

  if (
    requestRow.status !==
    "pending"
  ) {
    goError(
      studentId,
      "Bu talep daha önce sonuçlandırılmış."
    );
  }

  if (
    requestRow.student_id !==
    studentId
  ) {
    goError(
      studentId,
      "Talep ile öğrenci eşleşmiyor."
    );
  }

  const now =
    new Date().toISOString();

  const {
    error: archiveError,
  } = await supabase
    .from("students")
    .update({
      is_deleted: true,

      deleted_at:
        now,

      deleted_by:
        profile.id,

      deletion_reason:
        requestRow.reason ||
        "Yönetici onayı ile arşivlendi.",

      deletion_request_id:
        requestId,
    })
    .eq(
      "organization_id",
      profile.organization_id
    )
    .eq(
      "id",
      studentId
    );

  if (archiveError) {
    goError(
      studentId,
      archiveError.message
    );
  }

  const {
    error: requestUpdateError,
  } = await supabase
    .from("student_change_requests")
    .update({
      status:
        "approved",

      reviewed_by:
        profile.id,

      reviewed_at:
        now,

      review_note:
        reviewNote ||
        "Silme talebi onaylandı.",

      applied_at:
        now,
    })
    .eq(
      "organization_id",
      profile.organization_id
    )
    .eq(
      "id",
      requestId
    );

  if (requestUpdateError) {
    goError(
      studentId,
      requestUpdateError.message
    );
  }

  await supabase
    .from("student_timeline_events")
    .insert({
      organization_id:
        profile.organization_id,

      student_id:
        studentId,

      event_type:
        "student_archived",

      title:
        "Öğrenci arşivlendi",

      description:
        reviewNote ||
        requestRow.reason ||
        "Silme talebi yönetici tarafından onaylandı.",

      created_by:
        profile.id,
    });

  await supabase
    .from("alerts")
    .update({
      status:
        "resolved",
    })
    .eq(
      "organization_id",
      profile.organization_id
    )
    .eq(
      "student_id",
      studentId
    )
    .eq(
      "alert_type",
      "student_delete_request"
    )
    .eq(
      "status",
      "open"
    );

  await supabase
    .from("alerts")
    .insert({
      organization_id:
        profile.organization_id,

      student_id:
        studentId,

      alert_type:
        "student_delete_approved",

      title:
        "Öğrenci silme talebi onaylandı",

      description:
        "Öğrenci yönetici onayıyla arşivlendi. Kayıt kalıcı olarak silinmedi.",

      priority:
        "normal",

      status:
        "open",

      action_label:
        "Kaydı Gör",

      deduplication_key:
        `student-delete-approved-${requestId}`,
    });

  revalidatePath(
    `/ogrenciler/${studentId}`
  );

  revalidatePath(
    "/ogrenciler"
  );

  revalidatePath(
    "/uyarilar"
  );

  revalidatePath(
    "/onay-merkezi"
  );

  redirect(
    `/ogrenciler?archived=${encodeURIComponent(studentId)}`
  );
}

/* =========================================================
   SİLME TALEBİNİ REDDET
   OWNER / ADMIN
   ========================================================= */

export async function rejectStudentDeletion(
  formData: FormData
) {
  const profile = await requireProfile([
    ...approvalRoles,
  ]);

  const requestId = getText(
    formData.get("request_id"),
    100
  );

  const studentId = getText(
    formData.get("student_id"),
    100
  );

  const reviewNote = getText(
    formData.get("review_note"),
    2000
  );

  if (
    !requestId ||
    !studentId ||
    !profile.organization_id
  ) {
    goError(
      studentId,
      "Talep bulunamadı."
    );
  }

  if (
    reviewNote.length < 3
  ) {
    goError(
      studentId,
      "Red nedeni yazılmalıdır."
    );
  }

  const supabase = await createClient();

  const {
    data: requestRow,
    error: requestError,
  } = await supabase
    .from("student_change_requests")
    .select(
      "id,status,request_type,student_id"
    )
    .eq(
      "organization_id",
      profile.organization_id
    )
    .eq(
      "id",
      requestId
    )
    .single();

  if (
    requestError ||
    !requestRow
  ) {
    goError(
      studentId,
      "Silme talebi bulunamadı."
    );
  }

  if (
    requestRow.status !==
    "pending"
  ) {
    goError(
      studentId,
      "Bu talep daha önce sonuçlandırılmış."
    );
  }

  if (
    requestRow.request_type !==
    "student_delete"
  ) {
    goError(
      studentId,
      "Geçersiz talep türü."
    );
  }

  const now =
    new Date().toISOString();

  const { error } = await supabase
    .from("student_change_requests")
    .update({
      status:
        "rejected",

      reviewed_by:
        profile.id,

      reviewed_at:
        now,

      review_note:
        reviewNote,
    })
    .eq(
      "organization_id",
      profile.organization_id
    )
    .eq(
      "id",
      requestId
    );

  if (error) {
    goError(
      studentId,
      error.message
    );
  }

  await supabase
    .from("student_timeline_events")
    .insert({
      organization_id:
        profile.organization_id,

      student_id:
        studentId,

      event_type:
        "delete_request_rejected",

      title:
        "Öğrenci silme talebi reddedildi",

      description:
        reviewNote,

      created_by:
        profile.id,
    });

  await supabase
    .from("alerts")
    .update({
      status:
        "resolved",
    })
    .eq(
      "organization_id",
      profile.organization_id
    )
    .eq(
      "student_id",
      studentId
    )
    .eq(
      "alert_type",
      "student_delete_request"
    )
    .eq(
      "status",
      "open"
    );

  await supabase
    .from("alerts")
    .insert({
      organization_id:
        profile.organization_id,

      student_id:
        studentId,

      alert_type:
        "student_delete_rejected",

      title:
        "Öğrenci silme talebi reddedildi",

      description:
        reviewNote,

      priority:
        "normal",

      status:
        "open",

      action_label:
        "Öğrenciyi Gör",

      deduplication_key:
        `student-delete-rejected-${requestId}`,
    });

  revalidatePath(
    `/ogrenciler/${studentId}`
  );

  revalidatePath(
    "/uyarilar"
  );

  revalidatePath(
    "/onay-merkezi"
  );

  goSaved(
    studentId,
    "delete-rejected"
  );
}

/* =========================================================
   ARŞİVLENMİŞ ÖĞRENCİYİ GERİ YÜKLE
   OWNER / ADMIN
   ========================================================= */

export async function restoreStudent(
  formData: FormData
) {
  const profile = await requireProfile([
    ...approvalRoles,
  ]);

  const studentId = getText(
    formData.get("student_id"),
    100
  );

  const reason = getText(
    formData.get("reason"),
    2000
  );

  if (
    !studentId ||
    !profile.organization_id
  ) {
    goError(
      studentId,
      "Öğrenci bulunamadı."
    );
  }

  const supabase = await createClient();

  const {
    data: student,
    error: studentError,
  } = await supabase
    .from("students")
    .select(
      `
      id,
      student_number,
      first_name,
      last_name,
      is_deleted
      `
    )
    .eq(
      "organization_id",
      profile.organization_id
    )
    .eq(
      "id",
      studentId
    )
    .single();

  if (
    studentError ||
    !student
  ) {
    goError(
      studentId,
      "Öğrenci bulunamadı."
    );
  }

  if (!student.is_deleted) {
    goError(
      studentId,
      "Bu öğrenci zaten aktif durumda."
    );
  }

  const now =
    new Date().toISOString();

  const { error } = await supabase
    .from("students")
    .update({
      is_deleted:
        false,

      deleted_at:
        null,

      deleted_by:
        null,

      deletion_reason:
        null,

      deletion_request_id:
        null,
    })
    .eq(
      "organization_id",
      profile.organization_id
    )
    .eq(
      "id",
      studentId
    );

  if (error) {
    goError(
      studentId,
      error.message
    );
  }

  const {
    data: restoreRequest,
  } = await supabase
    .from("student_change_requests")
    .insert({
      organization_id:
        profile.organization_id,

      student_id:
        studentId,

      request_type:
        "student_restore",

      status:
        "approved",

      title:
        "Öğrenci geri yüklendi",

      reason:
        reason ||
        "Yönetici tarafından geri yüklendi.",

      old_value: {
        is_deleted:
          true,
      },

      requested_value: {
        is_deleted:
          false,
      },

      requested_by:
        profile.id,

      requested_at:
        now,

      reviewed_by:
        profile.id,

      reviewed_at:
        now,

      review_note:
        reason ||
        "Yönetici tarafından geri yüklendi.",

      applied_at:
        now,
    })
    .select("id")
    .single();

  await supabase
    .from("student_timeline_events")
    .insert({
      organization_id:
        profile.organization_id,

      student_id:
        studentId,

      event_type:
        "student_restored",

      title:
        "Öğrenci geri yüklendi",

      description:
        reason ||
        "Arşivlenen öğrenci yeniden aktif hale getirildi.",

      created_by:
        profile.id,
    });

  await supabase
    .from("alerts")
    .insert({
      organization_id:
        profile.organization_id,

      student_id:
        studentId,

      alert_type:
        "student_restored",

      title:
        "Öğrenci geri yüklendi",

      description:
        `${student.student_number || ""} ${studentFullName(student)} yeniden aktif öğrenci kayıtlarına alındı.`.trim(),

      priority:
        "normal",

      status:
        "open",

      action_label:
        "Öğrenciyi Gör",

      deduplication_key:
        `student-restored-${restoreRequest?.id || studentId}-${Date.now()}`,
    });

  revalidatePath(
    `/ogrenciler/${studentId}`
  );

  revalidatePath(
    "/ogrenciler"
  );

  revalidatePath(
    "/uyarilar"
  );

  goSaved(
    studentId,
    "restored"
  );
}

/* =========================================================
   ÖĞRENCİ NOTU DÜZENLE
   ========================================================= */
export async function updateStudentNote(formData: FormData) {
  const profile = await requireProfile([...staffRoles]);
  const studentId = getText(formData.get("student_id"), 100);
  const noteId = getText(formData.get("note_id"), 100);
  const body = getText(formData.get("body"), 4000);

  if (!studentId || !noteId || !body || !profile.organization_id) {
    goError(studentId, "Düzenlenecek not bilgisi eksik.");
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("student_notes")
    .update({ body })
    .eq("organization_id", profile.organization_id)
    .eq("student_id", studentId)
    .eq("id", noteId);

  if (error) goError(studentId, error.message);
  revalidatePath(`/ogrenciler/${studentId}`);
  goSaved(studentId, "note-updated");
}

/* =========================================================
   KAYIT AŞAMASI NOTU DÜZENLE / SİL
   ========================================================= */
export async function updateRegistrationNote(formData: FormData) {
  const profile = await requireProfile([...staffRoles]);
  const studentId = getText(formData.get("student_id"), 100);
  const noteId = getText(formData.get("note_id"), 100);
  const description = getText(formData.get("body"), 4000);

  if (!studentId || !noteId || !description || !profile.organization_id) {
    goError(studentId, "Düzenlenecek kayıt notu bilgisi eksik.");
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("student_activity_logs")
    .update({ description })
    .eq("organization_id", profile.organization_id)
    .eq("student_id", studentId)
    .eq("id", noteId)
    .eq("activity_type", "registration_note");

  if (error) goError(studentId, error.message);
  revalidatePath(`/ogrenciler/${studentId}`);
  goSaved(studentId, "registration-note-updated");
}

export async function deleteRegistrationNote(formData: FormData) {
  const profile = await requireProfile([...approvalRoles]);
  const studentId = getText(formData.get("student_id"), 100);
  const noteId = getText(formData.get("note_id"), 100);

  if (!studentId || !noteId || !profile.organization_id) {
    goError(studentId, "Silinecek kayıt notu bulunamadı.");
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("student_activity_logs")
    .delete()
    .eq("organization_id", profile.organization_id)
    .eq("student_id", studentId)
    .eq("id", noteId)
    .eq("activity_type", "registration_note");

  if (error) goError(studentId, error.message);

  await supabase
    .from("system_notifications")
    .delete()
    .eq("organization_id", profile.organization_id)
    .eq("source_type", "registration_note")
    .eq("source_id", noteId);

  revalidatePath(`/ogrenciler/${studentId}`);
  goSaved(studentId, "registration-note-deleted");
}

/* =========================================================
   NOT SİL - SADECE OWNER / ADMIN
   ========================================================= */
export async function deleteStudentNote(formData: FormData) {
  const profile = await requireProfile([
    ...approvalRoles,
  ]);

  const studentId = getText(
    formData.get("student_id"),
    100
  );

  const noteId = getText(
    formData.get("note_id"),
    100
  );

  if (
    !studentId ||
    !noteId ||
    !profile.organization_id
  ) {
    goError(
      studentId,
      "Silinecek not bulunamadı."
    );
  }

  const supabase = await createClient();

  const { data: note, error: noteError } =
    await supabase
      .from("student_notes")
      .select("id,note_type,body")
      .eq("organization_id", profile.organization_id)
      .eq("student_id", studentId)
      .eq("id", noteId)
      .single();

  if (noteError || !note) {
    goError(
      studentId,
      "Not bulunamadı veya silme yetkiniz yok."
    );
  }

  const { error } = await supabase
    .from("student_notes")
    .delete()
    .eq("organization_id", profile.organization_id)
    .eq("student_id", studentId)
    .eq("id", noteId);

  if (error) {
    goError(studentId, error.message);
  }

  const { data: reminderLogs } = await supabase
    .from("student_activity_logs")
    .select("id")
    .eq("organization_id", profile.organization_id)
    .eq("source_type", "student_note")
    .eq("source_id", noteId);

  const reminderIds = (reminderLogs || []).map((item) => item.id);
  if (reminderIds.length) {
    await supabase
      .from("system_notifications")
      .delete()
      .eq("organization_id", profile.organization_id)
      .in("source_id", reminderIds);
  }

  await supabase
    .from("student_activity_logs")
    .delete()
    .eq("organization_id", profile.organization_id)
    .eq("source_type", "student_note")
    .eq("source_id", noteId);

  await supabase
    .from("student_timeline_events")
    .insert({
      organization_id: profile.organization_id,
      student_id: studentId,
      event_type: "note_deleted",
      title: "Öğrenci notu yönetici tarafından silindi",
      description: `${String(note.note_type || "general").toUpperCase()}: ${String(note.body || "").slice(0, 500)}`,
      created_by: profile.id,
    });

  revalidatePath(`/ogrenciler/${studentId}`);

  goSaved(studentId, "note-deleted");
}


/* =========================================================
   KURSİYER İŞLEM MERKEZİ - HIZLI PROFİL GÜNCELLE
   Client panelinden çağrılır, redirect yapmaz.
   ========================================================= */
export async function updateStudentOperationalDetails(input: {
  studentId: string;
  phone?: string | null;
  email?: string | null;
  guardianName?: string | null;
  guardianPhone?: string | null;
  guardianEmail?: string | null;
  generalNote?: string | null;
}) {
  try {
    const profile = await requireProfile([
      ...staffRoles,
    ]);

    if (!profile.organization_id || !input.studentId) {
      return {
        ok: false as const,
        message: "Öğrenci veya organizasyon bilgisi bulunamadı.",
      };
    }

    const clean = (value?: string | null, max = 2000) =>
      typeof value === "string"
        ? value.trim().slice(0, max) || null
        : null;

    const supabase = await createClient();

    const { error } = await supabase
      .from("students")
      .update({
        phone: clean(input.phone, 30),
        email: clean(input.email, 200),
        guardian_name: clean(input.guardianName, 200),
        guardian_phone: clean(input.guardianPhone, 30),
        guardian_email: clean(input.guardianEmail, 200),
        general_note: clean(input.generalNote, 4000),
      })
      .eq("organization_id", profile.organization_id)
      .eq("id", input.studentId);

    if (error) {
      return {
        ok: false as const,
        message: error.message,
      };
    }

    await supabase
      .from("student_timeline_events")
      .insert({
        organization_id: profile.organization_id,
        student_id: input.studentId,
        event_type: "profile_updated",
        title: "Kursiyer bilgileri işlem merkezinden güncellendi",
        description:
          "İletişim / veli / genel not bilgileri Dijital Kursiyer Dosyası işlem merkezinden düzenlendi.",
        created_by: profile.id,
      });

    revalidatePath(`/ogrenciler/${input.studentId}`);
    revalidatePath("/ogrenciler");

    return {
      ok: true as const,
      message: "Kursiyer bilgileri başarıyla güncellendi.",
    };
  } catch (error) {
    return {
      ok: false as const,
      message:
        error instanceof Error
          ? error.message
          : "Bilgiler güncellenirken beklenmeyen hata oluştu.",
    };
  }
}
