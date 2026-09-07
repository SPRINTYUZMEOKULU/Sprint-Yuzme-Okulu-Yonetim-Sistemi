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

function normalizePhone(value: unknown) {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("90") && digits.length === 12) return `+${digits}`;
  if (digits.startsWith("0") && digits.length === 11) return `+90${digits.slice(1)}`;
  if (digits.length === 10) return `+90${digits}`;
  return `+${digits}`;
}

export async function autoProvisionGuardianPortal(studentIdValue: string) {
  const profile = await requireProfile([...roles]);
  const organizationId = profile.organization_id;
  const studentId = String(studentIdValue || "").trim();
  if (!organizationId || !studentId) return { ok: false as const, status: "error" as const, message: "Öğrenci bulunamadı." };

  const admin = adminClient();
  const { data: student, error: studentError } = await admin
    .from("students")
    .select("id,first_name,last_name,guardian_name,guardian_phone,guardian_email,status")
    .eq("id", studentId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (studentError || !student) {
    return { ok: false as const, status: "error" as const, message: studentError?.message || "Öğrenci bulunamadı." };
  }

  const fullName = String(student.guardian_name || "").trim();
  const email = String(student.guardian_email || "").trim().toLowerCase();
  const phone = normalizePhone(student.guardian_phone);

  if (!fullName || (!email && !phone)) {
    return {
      ok: true as const,
      status: "missing_contact" as const,
      message: "Kayıt tamamlandı; veli portalı için veli adı ve telefon/e-posta bilgisi eksik.",
    };
  }

  const { data: existingLink } = await admin
    .from("guardian_students")
    .select("guardian_id")
    .eq("student_id", studentId)
    .limit(1)
    .maybeSingle();

  if (existingLink?.guardian_id) {
    return {
      ok: true as const,
      status: "already_linked" as const,
      message: "Kayıt tamamlandı; öğrenci zaten bir veli portalı hesabına bağlı.",
      guardianId: existingLink.guardian_id,
    };
  }

  let guardian: any = null;
  if (email) {
    const { data } = await admin
      .from("profiles")
      .select("id,full_name,email,phone,role,is_active")
      .eq("organization_id", organizationId)
      .eq("role", "guardian")
      .eq("email", email)
      .limit(1)
      .maybeSingle();
    guardian = data;
  }

  if (!guardian && phone) {
    const { data } = await admin
      .from("profiles")
      .select("id,full_name,email,phone,role,is_active")
      .eq("organization_id", organizationId)
      .eq("role", "guardian")
      .eq("phone", phone)
      .limit(1)
      .maybeSingle();
    guardian = data;
  }

  let guardianId = guardian?.id || "";
  let created = false;

  if (!guardianId) {
    if (!email) {
      return {
        ok: true as const,
        status: "email_required" as const,
        message: "Kayıt tamamlandı; güvenli yeni veli hesabı oluşturmak için veli e-posta adresi eklenmeli.",
      };
    }

    const temporarySecret = `Sprint-${crypto.randomUUID()}-A9!`;
    const { data: createdUser, error: createError } = await admin.auth.admin.createUser({
      email,
      password: temporarySecret,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        role: "guardian",
        organization_id: organizationId,
      },
    });

    if (createError || !createdUser.user) {
      return {
        ok: false as const,
        status: "error" as const,
        message: createError?.message || "Veli hesabı otomatik oluşturulamadı.",
      };
    }

    guardianId = createdUser.user.id;
    created = true;

    const { error: profileError } = await admin.from("profiles").upsert({
      id: guardianId,
      organization_id: organizationId,
      full_name: fullName,
      email,
      phone: phone || null,
      role: "guardian",
      is_active: true,
      updated_at: new Date().toISOString(),
    }, { onConflict: "id" });

    if (profileError) {
      await admin.auth.admin.deleteUser(guardianId);
      return { ok: false as const, status: "error" as const, message: `Veli profili oluşturulamadı: ${profileError.message}` };
    }
  }

  const { error: linkError } = await admin.from("guardian_students").upsert({
    guardian_id: guardianId,
    student_id: studentId,
    relationship: "Veli",
    is_primary: true,
    receives_messages: true,
    portal_access: true,
  }, { onConflict: "guardian_id,student_id" });

  if (linkError) {
    if (created) await admin.auth.admin.deleteUser(guardianId);
    return { ok: false as const, status: "error" as const, message: `Veli hesabı öğrenciye bağlanamadı: ${linkError.message}` };
  }

  await admin.from("student_activity_logs").insert({
    organization_id: organizationId,
    student_id: studentId,
    activity_type: "guardian_portal_auto_provisioned",
    title: created ? "Veli portal hesabı otomatik oluşturuldu" : "Mevcut veli hesabı otomatik bağlandı",
    description: `${fullName} kesin kayıt sonrası veli portalına otomatik bağlandı.`,
    source_type: "registration_completion",
    source_id: guardianId,
    performed_at: new Date().toISOString(),
  });

  return {
    ok: true as const,
    status: created ? "created" as const : "linked" as const,
    message: created
      ? "Veli portal hesabı otomatik oluşturuldu ve öğrenciye bağlandı."
      : "Mevcut veli portal hesabı otomatik olarak öğrenciye bağlandı.",
    guardianId,
  };
}
