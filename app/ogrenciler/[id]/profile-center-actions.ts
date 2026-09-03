"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

const staffRoles = [
  "owner",
  "admin",
  "branch_manager",
  "registration_staff",
  "accounting",
  "coach",
] as const;

const guardianManageRoles = ["owner", "admin", "branch_manager", "registration_staff"] as const;

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

type GuardianPortalPayload = {
  studentId: string;
  fullName: string;
  email: string;
  phone: string;
  relationship: string;
  temporaryPassword: string;
};

function clean(value: unknown, max: number) {
  return String(value ?? "").trim().slice(0, max);
}

function normalizePhone(value: unknown) {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("90") && digits.length === 12) return `+${digits}`;
  if (digits.startsWith("0") && digits.length === 11) return `+90${digits.slice(1)}`;
  if (digits.length === 10) return `+90${digits}`;
  return `+${digits}`;
}

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase yönetici bağlantısı yapılandırılmamış.");
  return createAdminClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function guardianPortalState(studentId: string, organizationId: string) {
  const admin = adminClient();
  const { data: link } = await admin
    .from("guardian_students")
    .select("guardian_id,relationship,is_primary")
    .eq("student_id", studentId)
    .order("is_primary", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!link?.guardian_id) return null;

  const { data: guardian } = await admin
    .from("profiles")
    .select("id,full_name,email,phone,role,is_active,organization_id")
    .eq("id", link.guardian_id)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (!guardian || guardian.role !== "guardian") return null;

  return {
    guardianId: guardian.id,
    fullName: guardian.full_name || "",
    email: guardian.email || "",
    phone: guardian.phone || "",
    relationship: link.relationship || "Veli",
    isPrimary: Boolean(link.is_primary),
    isActive: Boolean(guardian.is_active),
  };
}

export async function getStudentProfileForCenter(studentId: string) {
  const profile = await requireProfile([...staffRoles]);
  if (!profile.organization_id || !studentId) {
    return { ok: false as const, message: "Öğrenci bulunamadı.", student: null, guardianPortal: null };
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
      guardianPortal: null,
    };
  }

  let guardianPortal = null;
  try {
    guardianPortal = await guardianPortalState(studentId, profile.organization_id);
  } catch (error) {
    console.error("guardian portal state error", error);
  }

  return { ok: true as const, message: "", student: data, guardianPortal };
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

  if (error) return { ok: false as const, message: error.message };

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

export async function createOrLinkGuardianPortal(payload: GuardianPortalPayload) {
  const profile = await requireProfile([...guardianManageRoles]);
  const organizationId = profile.organization_id;
  const studentId = clean(payload.studentId, 100);
  if (!organizationId || !studentId) return { ok: false as const, message: "Öğrenci bulunamadı." };

  const fullName = clean(payload.fullName, 200);
  const email = clean(payload.email, 200).toLowerCase();
  const phone = normalizePhone(payload.phone);
  const relationship = clean(payload.relationship, 50) || "Veli";
  const temporaryPassword = clean(payload.temporaryPassword, 100);

  if (!fullName) return { ok: false as const, message: "Veli adı soyadı zorunludur." };
  if (!email && !phone) return { ok: false as const, message: "Veli için telefon veya e-posta zorunludur." };

  const admin = adminClient();
  const { data: student } = await admin
    .from("students")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("id", studentId)
    .maybeSingle();
  if (!student) return { ok: false as const, message: "Öğrenci bulunamadı." };

  let query = admin
    .from("profiles")
    .select("id,role,is_active,organization_id,full_name,email,phone")
    .eq("organization_id", organizationId)
    .eq("role", "guardian");

  if (email) query = query.eq("email", email);
  else query = query.eq("phone", phone);

  const { data: existing } = await query.limit(1).maybeSingle();
  let guardianId = existing?.id || "";
  let createdAuthUser = false;

  if (!guardianId) {
    if (temporaryPassword.length < 8) {
      return { ok: false as const, message: "Yeni veli hesabı için geçici şifre en az 8 karakter olmalıdır." };
    }

    const authPayload: any = {
      password: temporaryPassword,
      user_metadata: { full_name: fullName, role: "guardian", organization_id: organizationId },
    };
    if (email) {
      authPayload.email = email;
      authPayload.email_confirm = true;
    }
    if (phone) {
      authPayload.phone = phone;
      authPayload.phone_confirm = true;
    }

    const { data: created, error: createError } = await admin.auth.admin.createUser(authPayload);
    if (createError || !created.user) {
      return { ok: false as const, message: createError?.message || "Veli hesabı oluşturulamadı." };
    }
    guardianId = created.user.id;
    createdAuthUser = true;

    const { error: profileError } = await admin.from("profiles").upsert({
      id: guardianId,
      organization_id: organizationId,
      full_name: fullName,
      email: email || null,
      phone: phone || null,
      role: "guardian",
      is_active: true,
      updated_at: new Date().toISOString(),
    }, { onConflict: "id" });

    if (profileError) {
      await admin.auth.admin.deleteUser(guardianId);
      return { ok: false as const, message: `Veli profili oluşturulamadı: ${profileError.message}` };
    }
  }

  const { error: linkError } = await admin.from("guardian_students").upsert({
    guardian_id: guardianId,
    student_id: studentId,
    relationship,
    is_primary: true,
  }, { onConflict: "guardian_id,student_id" });

  if (linkError) {
    if (createdAuthUser) await admin.auth.admin.deleteUser(guardianId);
    return { ok: false as const, message: `Veli hesabı öğrenciye bağlanamadı: ${linkError.message}` };
  }

  await admin.from("student_activity_logs").insert({
    organization_id: organizationId,
    student_id: studentId,
    activity_type: "guardian_portal_linked",
    title: createdAuthUser ? "Veli portal hesabı oluşturuldu" : "Veli portal hesabı bağlandı",
    description: `${fullName} veli portalına ${relationship} olarak bağlandı.`,
    source_type: "guardian_profile",
    source_id: guardianId,
    performed_at: new Date().toISOString(),
  });

  revalidatePath(`/ogrenciler/${studentId}`);
  return {
    ok: true as const,
    message: createdAuthUser ? "Veli portal hesabı oluşturuldu ve öğrenciye bağlandı." : "Mevcut veli hesabı öğrenciye bağlandı.",
    guardianPortal: await guardianPortalState(studentId, organizationId),
  };
}

export async function setGuardianPortalActive(studentIdValue: string, active: boolean) {
  const profile = await requireProfile(["owner", "admin"]);
  const organizationId = profile.organization_id;
  const studentId = clean(studentIdValue, 100);
  if (!organizationId || !studentId) return { ok: false as const, message: "Öğrenci bulunamadı." };

  const state = await guardianPortalState(studentId, organizationId);
  if (!state?.guardianId) return { ok: false as const, message: "Bağlı veli hesabı bulunamadı." };

  const admin = adminClient();
  const { error } = await admin
    .from("profiles")
    .update({ is_active: active, updated_at: new Date().toISOString() })
    .eq("organization_id", organizationId)
    .eq("id", state.guardianId)
    .eq("role", "guardian");

  if (error) return { ok: false as const, message: error.message };
  revalidatePath(`/ogrenciler/${studentId}`);
  return { ok: true as const, message: active ? "Veli portal erişimi aktif edildi." : "Veli portal erişimi pasife alındı." };
}

export async function unlinkGuardianPortal(studentIdValue: string) {
  const profile = await requireProfile([...guardianManageRoles]);
  const organizationId = profile.organization_id;
  const studentId = clean(studentIdValue, 100);
  if (!organizationId || !studentId) return { ok: false as const, message: "Öğrenci bulunamadı." };

  const state = await guardianPortalState(studentId, organizationId);
  if (!state?.guardianId) return { ok: false as const, message: "Bağlı veli hesabı bulunamadı." };

  const admin = adminClient();
  const { error } = await admin
    .from("guardian_students")
    .delete()
    .eq("student_id", studentId)
    .eq("guardian_id", state.guardianId);

  if (error) return { ok: false as const, message: error.message };
  revalidatePath(`/ogrenciler/${studentId}`);
  return { ok: true as const, message: "Veli portal hesabının öğrenci bağlantısı kaldırıldı." };
}
