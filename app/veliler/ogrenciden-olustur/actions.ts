"use server";

import { createClient as createAdminClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth/profile";

const roles = ["owner", "admin", "branch_manager", "registration_staff"] as const;

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase yönetici bağlantısı yapılandırılmamış.");
  return createAdminClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function normalizePhone(value: unknown) {
  let digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("0090")) digits = digits.slice(4);
  if (digits.startsWith("90") && digits.length === 12) digits = digits.slice(2);
  if (digits.startsWith("0") && digits.length === 11) digits = digits.slice(1);
  if (digits.length !== 10 || !digits.startsWith("5")) return "";
  return `+90${digits}`;
}

function phoneCandidates(phone: string) {
  const local = phone.replace(/^\+90/, "");
  return [phone, `90${local}`, `0${local}`, local];
}

function safeMessage(value: string) {
  return encodeURIComponent(value.slice(0, 260));
}

export async function createOrLinkGuardianFromStudent(formData: FormData) {
  const profile = await requireProfile([...roles]);
  const organizationId = profile.organization_id;
  const studentId = String(formData.get("student_id") || "").trim();
  if (!organizationId || !studentId) redirect(`/veliler/ogrenciden-olustur?error=${safeMessage("Öğrenci bulunamadı.")}`);

  const admin = adminClient();
  const { data: student, error: studentError } = await admin
    .from("students")
    .select("id,first_name,last_name,guardian_name,guardian_phone,guardian_email")
    .eq("id", studentId)
    .eq("organization_id", organizationId)
    .eq("is_deleted", false)
    .maybeSingle();

  if (studentError || !student) redirect(`/veliler/ogrenciden-olustur?error=${safeMessage(studentError?.message || "Öğrenci bulunamadı.")}`);

  const guardianName = String(student.guardian_name || "").trim();
  const guardianEmail = String(student.guardian_email || "").trim().toLowerCase();
  const phone = normalizePhone(student.guardian_phone);
  const studentName = `${student.first_name || ""} ${student.last_name || ""}`.trim();

  if (!guardianName) redirect(`/veliler/ogrenciden-olustur?error=${safeMessage(`${studentName} için veli adı eksik.`)}&student=${studentId}`);
  if (!phone) redirect(`/veliler/ogrenciden-olustur?error=${safeMessage(`${studentName} için geçerli veli telefonu eksik.`)}&student=${studentId}`);

  const { data: existingLink } = await admin
    .from("guardian_students")
    .select("guardian_id")
    .eq("student_id", studentId)
    .limit(1)
    .maybeSingle();

  if (existingLink?.guardian_id) {
    const { data: linkedGuardian } = await admin
      .from("profiles")
      .select("id,organization_id,role")
      .eq("id", existingLink.guardian_id)
      .maybeSingle();
    if (linkedGuardian?.organization_id === organizationId && linkedGuardian?.role === "guardian") {
      redirect(`/veliler/ogrenciden-olustur?saved=${safeMessage("Öğrenci zaten bir veli hesabına bağlı.")}&guardian=${linkedGuardian.id}&student=${studentId}`);
    }
    redirect(`/veliler/ogrenciden-olustur?error=${safeMessage("Öğrencide geçersiz/eski bir veli bağlantısı bulundu. Önce bağlantı kaydı düzeltilmelidir.")}&student=${studentId}`);
  }

  let guardian: any = null;
  const candidates = phoneCandidates(phone);
  const { data: byPhone, error: phoneLookupError } = await admin
    .from("profiles")
    .select("id,full_name,email,phone,role,is_active")
    .eq("organization_id", organizationId)
    .eq("role", "guardian")
    .in("phone", candidates)
    .limit(1)
    .maybeSingle();
  if (phoneLookupError) redirect(`/veliler/ogrenciden-olustur?error=${safeMessage(phoneLookupError.message)}&student=${studentId}`);
  guardian = byPhone;

  if (!guardian && guardianEmail) {
    const { data: byEmail } = await admin
      .from("profiles")
      .select("id,full_name,email,phone,role,is_active")
      .eq("organization_id", organizationId)
      .eq("role", "guardian")
      .eq("email", guardianEmail)
      .limit(1)
      .maybeSingle();
    guardian = byEmail;
  }

  let guardianId = guardian?.id || "";
  let created = false;

  if (guardianId) {
    const { data: authData, error: authLookupError } = await admin.auth.admin.getUserById(guardianId);
    if (authLookupError || !authData.user) redirect(`/veliler/ogrenciden-olustur?error=${safeMessage("Mevcut veli hesabının kimlik kaydı bulunamadı.")}&student=${studentId}`);

    if (authData.user.phone !== phone) {
      const { error: phoneUpdateError } = await admin.auth.admin.updateUserById(guardianId, {
        phone,
        user_metadata: {
          ...(authData.user.user_metadata || {}),
          full_name: guardianName,
          role: "guardian",
          organization_id: organizationId,
        },
      });
      if (phoneUpdateError) redirect(`/veliler/ogrenciden-olustur?error=${safeMessage(`Veli telefonu Auth hesabına bağlanamadı: ${phoneUpdateError.message}`)}&student=${studentId}`);
    }

    const { error: profileUpdateError } = await admin.from("profiles").update({
      phone,
      full_name: guardian.full_name || guardianName,
      email: guardian.email || guardianEmail || null,
      is_active: true,
      updated_at: new Date().toISOString(),
    }).eq("id", guardianId).eq("organization_id", organizationId);
    if (profileUpdateError) redirect(`/veliler/ogrenciden-olustur?error=${safeMessage(profileUpdateError.message)}&student=${studentId}`);
  } else {
    const temporarySecret = `Sprint-${crypto.randomUUID()}-A9!`;
    const { data: createdUser, error: createError } = await admin.auth.admin.createUser({
      phone,
      password: temporarySecret,
      user_metadata: {
        full_name: guardianName,
        role: "guardian",
        organization_id: organizationId,
      },
    });
    if (createError || !createdUser.user) {
      const message = createError?.message || "Veli hesabı oluşturulamadı.";
      redirect(`/veliler/ogrenciden-olustur?error=${safeMessage(message)}&student=${studentId}`);
    }
    guardianId = createdUser.user.id;
    created = true;

    const { error: profileError } = await admin.from("profiles").upsert({
      id: guardianId,
      organization_id: organizationId,
      full_name: guardianName,
      phone,
      email: guardianEmail || null,
      role: "guardian",
      is_active: true,
      last_sign_in_at: null,
      updated_at: new Date().toISOString(),
    }, { onConflict: "id" });
    if (profileError) {
      await admin.auth.admin.deleteUser(guardianId);
      redirect(`/veliler/ogrenciden-olustur?error=${safeMessage(`Veli profili oluşturulamadı: ${profileError.message}`)}&student=${studentId}`);
    }
  }

  const { error: linkError } = await admin.from("guardian_students").upsert({
    guardian_id: guardianId,
    student_id: studentId,
    relationship: "Veli",
    is_primary: true,
    is_payment_contact: true,
    receives_messages: true,
    portal_access: true,
  }, { onConflict: "guardian_id,student_id" });

  if (linkError) {
    if (created) await admin.auth.admin.deleteUser(guardianId);
    redirect(`/veliler/ogrenciden-olustur?error=${safeMessage(`Veli öğrenciye bağlanamadı: ${linkError.message}`)}&student=${studentId}`);
  }

  try {
    await admin.from("student_activity_logs").insert({
      organization_id: organizationId,
      student_id: studentId,
      activity_type: "guardian_portal_created_from_student",
      title: created ? "Veli portal hesabı oluşturuldu" : "Mevcut veli hesabı bağlandı",
      description: `${guardianName} öğrenci üzerinden veli portalına bağlandı.`,
      source_type: "guardian_creation_wizard",
      source_id: guardianId,
      performed_at: new Date().toISOString(),
    });
  } catch {}

  revalidatePath("/veliler");
  revalidatePath("/veliler/ogrenciden-olustur");
  revalidatePath(`/ogrenciler/${studentId}`);
  revalidatePath(`/veliler/${guardianId}`);

  const saved = created
    ? "Veli hesabı oluşturuldu ve öğrenciye bağlandı. Telefon doğrulaması için hazır."
    : "Mevcut veli hesabı bulundu ve öğrenciye bağlandı.";
  redirect(`/veliler/ogrenciden-olustur?saved=${safeMessage(saved)}&guardian=${guardianId}&student=${studentId}`);
}
