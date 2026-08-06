"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";

const roles = ["owner","admin","branch_manager","registration_staff","accounting","coach"] as const;

export async function addStudentNote(formData: FormData) {
  const profile = await requireProfile([...roles]);
  const studentId = String(formData.get("student_id") || "");
  const body = String(formData.get("body") || "").trim();
  if (!studentId || !body || !profile.organization_id) redirect(`/ogrenciler/${studentId}?error=Not alanı zorunludur`);
  const supabase = await createClient();
  const { error } = await supabase.from("student_notes").insert({
    organization_id: profile.organization_id,
    student_id: studentId,
    author_id: profile.id,
    note_type: String(formData.get("note_type") || "general"),
    body,
    is_guardian_visible: formData.get("is_guardian_visible") === "on"
  });
  if (error) redirect(`/ogrenciler/${studentId}?error=${encodeURIComponent(error.message)}`);
  await supabase.from("student_timeline_events").insert({
    organization_id: profile.organization_id, student_id: studentId, event_type: "note_added",
    title: "Yeni not eklendi", description: body, created_by: profile.id
  });
  revalidatePath(`/ogrenciler/${studentId}`);
  redirect(`/ogrenciler/${studentId}?saved=note`);
}

export async function updateStudentProfile(formData: FormData) {
  const profile = await requireProfile([...roles]);
  const studentId = String(formData.get("student_id") || "");
  if (!studentId || !profile.organization_id) redirect(`/ogrenciler/${studentId}?error=Öğrenci bulunamadı`);
  const supabase = await createClient();
  const payload = {
    phone: String(formData.get("phone") || "") || null,
    email: String(formData.get("email") || "") || null,
    guardian_name: String(formData.get("guardian_name") || "") || null,
    guardian_phone: String(formData.get("guardian_phone") || "") || null,
    guardian_email: String(formData.get("guardian_email") || "") || null,
    emergency_contact_name: String(formData.get("emergency_contact_name") || "") || null,
    emergency_contact_phone: String(formData.get("emergency_contact_phone") || "") || null,
    allergy_note: String(formData.get("allergy_note") || "") || null,
    chronic_condition_note: String(formData.get("chronic_condition_note") || "") || null,
    medication_note: String(formData.get("medication_note") || "") || null,
    emergency_medical_note: String(formData.get("emergency_medical_note") || "") || null,
    general_note: String(formData.get("general_note") || "") || null
  };
  const { error } = await supabase.from("students").update(payload).eq("id", studentId);
  if (error) redirect(`/ogrenciler/${studentId}?error=${encodeURIComponent(error.message)}`);
  await supabase.from("student_timeline_events").insert({ organization_id: profile.organization_id, student_id: studentId, event_type: "profile_updated", title: "Kursiyer bilgileri güncellendi", created_by: profile.id });
  revalidatePath(`/ogrenciler/${studentId}`);
  redirect(`/ogrenciler/${studentId}?saved=profile`);
}
