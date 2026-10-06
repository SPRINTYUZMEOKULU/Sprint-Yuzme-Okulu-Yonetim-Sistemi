"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";

export async function manageEnrollmentStart(input: {
  studentId: string; enrollmentId: string; expectedStartDate: string; startDate: string; confirm: boolean;
}) {
  const profile = await requireProfile(["owner","admin","branch_manager","registration_staff","accounting"]);
  if (!profile.organization_id || !input.studentId || !input.enrollmentId) {
    return { ok: false, message: "Kayıt bilgisi eksik." };
  }
  const supabase = await createClient();
  const { data: enrollment, error: enrollmentError } = await supabase.from("student_enrollments")
    .select("id").eq("id",input.enrollmentId).eq("student_id",input.studentId)
    .eq("organization_id",profile.organization_id).eq("status","active").maybeSingle();
  if (enrollmentError || !enrollment) return { ok:false, message:"Aktif kayıt bulunamadı." };
  const { data, error } = await supabase.rpc("manage_enrollment_start", {
    p_enrollment_id: input.enrollmentId,
    p_expected_start_date: input.expectedStartDate || null,
    p_start_date: input.startDate,
    p_confirm: input.confirm,
  });
  if (error) return { ok:false, message:error.message };
  if (!data?.ok) return { ok:false, message:"Başlangıç işlemi tamamlanamadı." };
  ["/ogrenciler",`/ogrenciler/${input.studentId}`,"/yoklama","/"].forEach(path=>revalidatePath(path));
  return { ok:true, message:String(data.message || "Başlangıç işlemi tamamlandı.") };
}
