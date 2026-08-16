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
      "Bu öğrenci için
