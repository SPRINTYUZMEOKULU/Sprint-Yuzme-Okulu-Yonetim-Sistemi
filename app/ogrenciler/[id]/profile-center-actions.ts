"use server";

import { revalidatePath } from "next/cache";
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

type ProfileCenterPayload = {
  studentId: string;
  firstName: string;
  lastName: string;
  birthDate: string;
  phone: string;
  email: string;
  guardianName: string;
  guardianPhone: string;
  guardianEmail: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  generalNote: string;
};

function clean(value: unknown, max: number) {
  return String(value ?? "").trim().slice(0, max);
}

export async function getStudentProfileForCenter(studentId: string) {
  const profile = await requireProfile([...staffRoles]);
  if (!profile.organization_id || !studentId) {
    return { ok: false as const, message: "Öğrenci bulunamadı.", student: null };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("students")
    .select(
      "id,first_name,last_name,birth_date,phone,email,guardian_name,guardian_phone,guardian_email,emergency_contact_name,emergency_contact_phone,general_note,status",
    )
    .eq("organization_id", profile.organization_id)
    .eq("id", studentId)
    .maybeSingle();

  if (error || !data) {
    return {
      ok: false as const,
      message: error?.message || "Öğrenci bilgileri alınamadı.",
      student: null,
    };
  }

  return { ok: true as const, message: "", student: data };
}

export async function saveStudentProfileFromCenter(payload: ProfileCenterPayload) {
  const profile = await requireProfile([...staffRoles]);
  const studentId = clean(payload.studentId, 100);

  if (!profile.organization_id || !studentId) {
    return { ok: false as const, message: "Öğrenci bulunamadı." };
  }

  const firstName = clean(payload.firstName, 120);
  const lastName = clean(payload.lastName, 120);
  if (!firstName || !lastName) {
    return { ok: false as const, message: "Öğrenci adı ve soyadı zorunludur." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("students")
    .update({
      first_name: firstName,
      last_name: lastName,
      birth_date: clean(payload.birthDate, 10) || null,
      phone: clean(payload.phone, 30) || null,
      email: clean(payload.email, 200) || null,
      guardian_name: clean(payload.guardianName, 200) || null,
      guardian_phone: clean(payload.guardianPhone, 30) || null,
      guardian_email: clean(payload.guardianEmail, 200) || null,
      emergency_contact_name: clean(payload.emergencyContactName, 200) || null,
      emergency_contact_phone: clean(payload.emergencyContactPhone, 30) || null,
      general_note: clean(payload.generalNote, 4000) || null,
      updated_at: new Date().toISOString(),
    })
    .eq("organization_id", profile.organization_id)
    .eq("id", studentId);

  if (error) {
    return { ok: false as const, message: error.message };
  }

  await supabase.from("student_timeline_events").insert({
    organization_id: profile.organization_id,
    student_id: studentId,
    event_type: "profile_updated",
    title: "Öğrenci / veli bilgileri güncellendi",
    description: "Bilgiler Dijital Kursiyer Dosyası Bilgi Merkezi üzerinden güncellendi.",
    created_by: profile.id,
  });

  revalidatePath(`/ogrenciler/${studentId}`);
  return { ok: true as const, message: "Öğrenci ve veli bilgileri kaydedildi." };
}
