"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";

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

  const { error } = await supabase
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
    });

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

    email:
      getText(
        formData.get("email"),
        200
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

    guardian_email:
      getText(
        formData.get("guardian_email"),
        200
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
