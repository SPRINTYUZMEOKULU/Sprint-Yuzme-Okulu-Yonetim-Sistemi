"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";

const allowedRoles = ["owner", "admin", "branch_manager", "registration_staff"] as const;

function bool(formData: FormData, key: string) {
  return formData.get(key) === "on";
}

export async function completeRegistration(formData: FormData) {
  const profile = await requireProfile([...allowedRoles]);
  const supabase = await createClient();
  const studentId = String(formData.get("student_id") || "");
  const branchId = String(formData.get("branch_id") || "");
  const groupId = String(formData.get("group_id") || "");
  const packageId = String(formData.get("package_id") || "");
  const coachId = String(formData.get("coach_id") || "") || null;
  const startDate = String(formData.get("start_date") || "");
  const weekdays = formData.getAll("lesson_weekdays").map(Number).filter((n) => n >= 0 && n <= 6);
  const totalLessons = Number(formData.get("total_lessons") || 0);
  const messageBody = String(formData.get("message_body") || "").trim();
  const recipient = String(formData.get("recipient") || "").trim();

  if (!profile.organization_id || !studentId || !branchId || !groupId || !startDate || !weekdays.length || totalLessons < 1) {
    redirect(`/kayit-tamamlama/${studentId}?error=${encodeURIComponent("Şube, grup, başlangıç tarihi, ders sayısı ve katılım günleri zorunludur.")}`);
  }

  const { data: enrollment, error: enrollmentError } = await supabase
    .from("student_enrollments")
    .insert({
      organization_id: profile.organization_id,
      student_id: studentId,
      package_id: packageId || null,
      group_id: groupId,
      start_date: startDate,
      lesson_weekdays: weekdays,
      total_lessons: totalLessons,
      used_lessons: 0,
      status: "active"
    })
    .select("id,planned_end_date")
    .single();

  if (enrollmentError || !enrollment) {
    redirect(`/kayit-tamamlama/${studentId}?error=${encodeURIComponent(enrollmentError?.message || "Aktif kayıt oluşturulamadı.")}`);
  }

  await supabase.from("student_group_memberships").update({ is_active: false, ended_at: startDate }).eq("student_id", studentId).eq("is_active", true);

  const { error: membershipError } = await supabase.from("student_group_memberships").insert({
    organization_id: profile.organization_id,
    student_id: studentId,
    group_id: groupId,
    started_at: startDate,
    is_active: true
  });

  if (membershipError) {
    await supabase.from("student_enrollments").delete().eq("id", enrollment.id);
    redirect(`/kayit-tamamlama/${studentId}?error=${encodeURIComponent(membershipError.message)}`);
  }

  const { error: studentError } = await supabase
    .from("students")
    .update({ status: "active", branch_id: branchId })
    .eq("id", studentId)
    .eq("organization_id", profile.organization_id);

  if (studentError) {
    redirect(`/kayit-tamamlama/${studentId}?error=${encodeURIComponent(studentError.message)}`);
  }

  const checklist = {
    organization_id: profile.organization_id,
    student_id: studentId,
    enrollment_id: enrollment.id,
    payment_received: bool(formData, "payment_received"),
    group_selected: true,
    attendance_days_selected: weekdays.length > 0,
    health_declaration_received: bool(formData, "health_declaration_received"),
    rules_accepted: bool(formData, "rules_accepted"),
    message_prepared: Boolean(messageBody),
    message_sent: bool(formData, "message_sent"),
    location_sent: bool(formData, "location_sent"),
    swim_cap_delivered: bool(formData, "swim_cap_delivered"),
    receipt_created: bool(formData, "receipt_created"),
    completed_by: profile.id,
    completed_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  await supabase.from("registration_completion_checklists").upsert(checklist, { onConflict: "student_id" });

  if (messageBody) {
    await supabase.from("message_logs").insert({
      organization_id: profile.organization_id,
      student_id: studentId,
      template_key: "registration_completed",
      channel: "whatsapp",
      recipient: recipient || null,
      subject: "Kayıt Tamamlandı",
      message_body: messageBody,
      status: bool(formData, "message_sent") ? "opened" : "prepared",
      prepared_by: profile.id,
      sent_by: bool(formData, "message_sent") ? profile.id : null,
      sent_at: bool(formData, "message_sent") ? new Date().toISOString() : null,
      metadata: { coach_id: coachId, planned_end_date: enrollment.planned_end_date }
    });
  }

  revalidatePath("/on-kayitlar");
  revalidatePath("/ogrenciler");
  revalidatePath(`/ogrenciler/${studentId}`);
  redirect(`/ogrenciler/${studentId}?saved=registration`);
}
