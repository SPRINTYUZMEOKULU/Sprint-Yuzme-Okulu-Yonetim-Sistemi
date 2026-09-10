"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";

const ROLES = ["owner", "admin", "branch_manager", "registration_staff"] as const;
const WAITING_STATUSES = ["pre_registration", "waiting_payment", "waiting_approval"];

function clean(value: FormDataEntryValue | null, max = 600) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export async function deactivateRegistrationCandidate(formData: FormData) {
  const profile = await requireProfile([...ROLES]);
  const studentId = clean(formData.get("student_id"), 80);
  const reason = clean(formData.get("reason"), 500);

  if (!profile.organization_id || !studentId) {
    redirect("/kesin-kayit-merkezi?error=Kursiyer bilgisi bulunamadı");
  }
  if (reason.length < 5) {
    redirect(`/kesin-kayit-merkezi?error=${encodeURIComponent("Pasife alma gerekçesini en az 5 karakter yazınız.")}`);
  }

  const supabase = await createClient();
  const { data: student, error: readError } = await supabase
    .from("students")
    .select("id,first_name,last_name,status")
    .eq("organization_id", profile.organization_id)
    .eq("id", studentId)
    .maybeSingle();

  if (readError || !student) {
    redirect(`/kesin-kayit-merkezi?error=${encodeURIComponent("Kursiyer kaydı bulunamadı.")}`);
  }
  if (!WAITING_STATUSES.includes(String(student.status || ""))) {
    redirect(`/kesin-kayit-merkezi?error=${encodeURIComponent("Bu kursiyer artık kesin kayıt bekleyen listede değil.")}`);
  }

  const previousStatus = student.status;
  const { error: updateError } = await supabase
    .from("students")
    .update({ status: "passive", is_active: false, updated_at: new Date().toISOString() })
    .eq("organization_id", profile.organization_id)
    .eq("id", studentId)
    .in("status", WAITING_STATUSES);

  if (updateError) {
    redirect(`/kesin-kayit-merkezi?error=${encodeURIComponent(`Kayıt pasife alınamadı: ${updateError.message}`)}`);
  }

  const editor = (profile as any).full_name || (profile as any).email || "Yetkili kullanıcı";
  await supabase.from("student_activity_logs").insert({
    organization_id: profile.organization_id,
    student_id: studentId,
    activity_type: "registration_candidate_deactivated",
    title: "Kesin kayıt adayından vazgeçildi",
    description: `${editor} tarafından kesin kayıt süreci durduruldu. Gerekçe: ${reason}`,
    old_value: { status: previousStatus },
    new_value: { status: "passive", is_active: false, reason },
    source_type: "definitive_registration_center",
    source_id: studentId,
    performed_by: profile.id,
    performed_at: new Date().toISOString(),
  });

  revalidatePath("/kesin-kayit-merkezi");
  revalidatePath("/on-kayitlar");
  revalidatePath("/ogrenciler");
  revalidatePath(`/ogrenciler/${studentId}`);
  redirect("/kesin-kayit-merkezi?passive=1");
}
