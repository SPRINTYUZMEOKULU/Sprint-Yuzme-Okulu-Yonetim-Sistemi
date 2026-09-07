"use server";

import { createClient as createAdminClient } from "@supabase/supabase-js";
import { requireProfile } from "@/lib/auth/profile";

const roles = ["owner", "admin", "branch_manager", "registration_staff"] as const;

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase yönetici bağlantısı yapılandırılmamış.");
  return createAdminClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function resolveGuardian(studentId: string, organizationId: string) {
  const admin = adminClient();
  const { data: link, error: linkError } = await admin
    .from("guardian_students")
    .select("guardian_id")
    .eq("student_id", studentId)
    .limit(1)
    .maybeSingle();

  if (linkError || !link?.guardian_id) {
    return { ok: false as const, message: linkError?.message || "Öğrenciye bağlı veli/kursiyer portal hesabı bulunamadı." };
  }

  const { data: guardianRecord, error: guardianError } = await admin
    .from("guardians")
    .select("id,auth_user_id,full_name,phone,email,login_enabled,is_active")
    .eq("id", link.guardian_id)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (guardianError || !guardianRecord) {
    return { ok: false as const, message: guardianError?.message || "Veli/kursiyer portal kaydı bulunamadı." };
  }
  if (!guardianRecord.auth_user_id) {
    return { ok: false as const, message: "Portal hesabının giriş kullanıcısı henüz oluşturulmamış." };
  }
  if (guardianRecord.is_active === false || guardianRecord.login_enabled === false) {
    return { ok: false as const, message: "Veli/kursiyer portal hesabı pasif durumda." };
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("id,full_name,phone,email,is_active")
    .eq("id", guardianRecord.auth_user_id)
    .eq("organization_id", organizationId)
    .eq("role", "guardian")
    .maybeSingle();

  const phone = String(profile?.phone || guardianRecord.phone || "").trim();
  const email = String(profile?.email || guardianRecord.email || "").trim();
  const fullName = String(profile?.full_name || guardianRecord.full_name || "Değerli Velimiz").trim();

  return {
    ok: true as const,
    admin,
    authUserId: guardianRecord.auth_user_id as string,
    guardian: { fullName, phone, email },
  };
}

export async function getGuardianPhoneContact(studentIdValue: string) {
  const profile = await requireProfile([...roles]);
  const organizationId = profile.organization_id;
  const studentId = String(studentIdValue || "").trim();
  if (!organizationId || !studentId) return { ok: false as const, message: "Öğrenci bulunamadı." };

  const resolved = await resolveGuardian(studentId, organizationId);
  if (!resolved.ok) return resolved;
  if (!resolved.guardian.phone) {
    return { ok: false as const, message: "WhatsApp gönderimi için veli/kursiyer telefon numarası eklenmelidir." };
  }

  return { ok: true as const, guardian: resolved.guardian };
}

export async function setGuardianPortalPasswordAndGetContact(studentIdValue: string, passwordValue: string) {
  const profile = await requireProfile([...roles]);
  const organizationId = profile.organization_id;
  const studentId = String(studentIdValue || "").trim();
  const password = String(passwordValue || "");

  if (!organizationId || !studentId) return { ok: false as const, message: "Öğrenci bulunamadı." };
  if (password.length < 8) return { ok: false as const, message: "Portal şifresi en az 8 karakter olmalıdır." };

  const resolved = await resolveGuardian(studentId, organizationId);
  if (!resolved.ok) return resolved;

  const { error } = await resolved.admin.auth.admin.updateUserById(resolved.authUserId, { password });
  if (error) return { ok: false as const, message: `Portal şifresi kaydedilemedi: ${error.message}` };

  try {
    await resolved.admin.from("student_activity_logs").insert({
      organization_id: organizationId,
      student_id: studentId,
      activity_type: "guardian_portal_password_set",
      title: "Portal giriş şifresi tanımlandı",
      description: `${resolved.guardian.fullName} için portal giriş şifresi yönetici tarafından güncellendi.`,
      source_type: "guardian_portal",
      source_id: resolved.authUserId,
      performed_at: new Date().toISOString(),
    });
  } catch {}

  return {
    ok: true as const,
    message: "Portal şifresi kaydedildi. WhatsApp giriş mesajı hazırlanabilir.",
    guardian: resolved.guardian,
  };
}
