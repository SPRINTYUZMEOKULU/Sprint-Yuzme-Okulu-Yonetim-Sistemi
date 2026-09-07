"use server";

import { createClient as createAdminClient } from "@supabase/supabase-js";
import { requireProfile } from "@/lib/auth/profile";

const roles = ["owner", "admin", "branch_manager", "registration_staff"] as const;

export async function getGuardianPhoneContact(studentIdValue: string) {
  const profile = await requireProfile([...roles]);
  const organizationId = profile.organization_id;
  const studentId = String(studentIdValue || "").trim();
  if (!organizationId || !studentId) return { ok: false as const, message: "Öğrenci bulunamadı." };
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return { ok: false as const, message: "Supabase yönetici bağlantısı yapılandırılmamış." };
  const admin = createAdminClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: link } = await admin.from("guardian_students").select("guardian_id").eq("student_id", studentId).limit(1).maybeSingle();
  if (!link?.guardian_id) return { ok: false as const, message: "Öğrenciye bağlı veli hesabı bulunamadı." };
  const { data: guardian } = await admin.from("profiles").select("full_name,phone,is_active").eq("id", link.guardian_id).eq("organization_id", organizationId).eq("role", "guardian").maybeSingle();
  if (!guardian) return { ok: false as const, message: "Veli hesabı bulunamadı." };
  if (!guardian.is_active) return { ok: false as const, message: "Veli portal hesabı pasif durumda." };
  if (!guardian.phone) return { ok: false as const, message: "Telefonla giriş için veli telefon numarası eklenmelidir." };
  return { ok: true as const, guardian: { fullName: guardian.full_name || "Değerli Velimiz", phone: guardian.phone } };
}
