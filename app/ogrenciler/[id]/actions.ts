"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";

const allowedRoles = ["owner", "admin", "branch_manager", "registration_staff"] as const;

export async function updateAttendanceDays(formData: FormData) {
  await requireProfile([...allowedRoles]);
  const supabase = await createClient();
  const studentId = String(formData.get("student_id") || "");
  const enrollmentId = String(formData.get("enrollment_id") || "");
  const weekdays = formData.getAll("lesson_weekdays").map(Number).filter((n) => n >= 0 && n <= 6);

  if (!studentId || !enrollmentId || weekdays.length === 0) {
    redirect(`/ogrenciler/${studentId}?error=Katılım günleri seçilmelidir`);
  }

  const { error } = await supabase
    .from("student_enrollments")
    .update({ lesson_weekdays: weekdays })
    .eq("id", enrollmentId)
    .eq("student_id", studentId);

  if (error) redirect(`/ogrenciler/${studentId}?error=${encodeURIComponent(error.message)}`);
  revalidatePath(`/ogrenciler/${studentId}`);
  redirect(`/ogrenciler/${studentId}?saved=days`);
}

export async function addLessonAdjustment(formData: FormData) {
  const profile = await requireProfile([...allowedRoles]);
  const supabase = await createClient();
  const studentId = String(formData.get("student_id") || "");
  const enrollmentId = String(formData.get("enrollment_id") || "") || null;
  const adjustmentType = String(formData.get("adjustment_type") || "makeup");
  const lessonDate = String(formData.get("lesson_date") || "");

  if (!studentId || !lessonDate || !profile.organization_id) {
    redirect(`/ogrenciler/${studentId}?error=Zorunlu alanları doldurun`);
  }

  const payload = {
    organization_id: profile.organization_id,
    student_id: studentId,
    enrollment_id: enrollmentId,
    adjustment_type: adjustmentType,
    status: "planned",
    original_lesson_date: String(formData.get("original_lesson_date") || "") || null,
    lesson_date: lessonDate,
    branch_id: String(formData.get("branch_id") || "") || null,
    group_id: String(formData.get("group_id") || "") || null,
    coach_id: String(formData.get("coach_id") || "") || null,
    start_time: String(formData.get("start_time") || "") || null,
    end_time: String(formData.get("end_time") || "") || null,
    reason: String(formData.get("reason") || "") || null,
    note: String(formData.get("note") || "") || null,
    counts_as_package_lesson: formData.get("counts_as_package_lesson") === "on",
    increases_total_lessons: formData.get("increases_total_lessons") === "on",
    extends_end_date: formData.get("extends_end_date") === "on",
    created_by: profile.id
  };

  const { error } = await supabase.from("student_lesson_adjustments").insert(payload);
  if (error) redirect(`/ogrenciler/${studentId}?error=${encodeURIComponent(error.message)}`);

  revalidatePath(`/ogrenciler/${studentId}`);
  redirect(`/ogrenciler/${studentId}?saved=lesson`);
}
