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
  const requestedMode = String(formData.get("account_mode") || "guardian").trim() === "self" ? "self" : "guardian";
  if (!organizationId || !studentId) redirect(`/veliler/ogrenciden-olustur?error=${safeMessage("Öğrenci bulunamadı.")}`);

  const admin = adminClient();
  const { data: student, error: studentError } = await admin
    .from("students")
    .select("id,first_name,last_name,phone,guardian_name,guardian_phone,guardian_email")
    .eq("id", studentId)
    .eq("organization_id", organizationId)
    .eq("is_deleted", false)
    .maybeSingle();

  if (studentError || !student) redirect(`/veliler/ogrenciden-olustur?error=${safeMessage(studentError?.message || "Öğrenci bulunamadı.")}`);

  const studentName = `${student.first_name || ""} ${student.last_name || ""}`.trim();
  const guardianName = String(student.guardian_name || "").trim();
  const guardianPhone = normalizePhone(student.guardian_phone);
  const studentPhone = normalizePhone(student.phone);
  const useSelf = requestedMode === "self" || (!guardianName && !guardianPhone && Boolean(studentPhone));
  const accountName = useSelf ? studentName : guardianName;
  const accountPhone = useSelf ? studentPhone : guardianPhone;
  const accountEmail = useSelf ? "" : String(student.guardian_email || "").trim().toLowerCase();
  const relationship = useSelf ? "Kendisi" : "Veli";

  if (!accountName) redirect(`/veliler/ogrenciden-olustur?error=${safeMessage(`${studentName} için hesap sahibi adı eksik.`)}&student=${studentId}`);
  if (!accountPhone) {
    const message = useSelf
      ? `${studentName} için kursiyerin kendi telefon numarası eksik veya geçersiz.`
      : `${studentName} için geçerli veli telefonu eksik.`;
    redirect(`/veliler/ogrenciden-olustur?error=${safeMessage(message)}&student=${studentId}`);
  }

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
      redirect(`/veliler/ogrenciden-olustur?saved=${safeMessage("Öğrenci zaten bir portal hesabına bağlı.")}&guardian=${linkedGuardian.id}&student=${studentId}`);
    }
    redirect(`/veliler/ogrenciden-olustur?error=${safeMessage("Öğrencide geçersiz/eski bir portal bağlantısı bulundu. Önce bağlantı kaydı düzeltilmelidir.")}&student=${studentId}`);
  }

  let guardian: any = null;
  const candidates = phoneCandidates(accountPhone);
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

  if (!guardian && accountEmail) {
    const { data: byEmail } = await admin
      .from("profiles")
      .select("id,full_name,email,phone,role,is_active")
      .eq("organization_id", organizationId)
      .eq("role", "guardian")
      .eq("email", accountEmail)
      .limit(1)
      .maybeSingle();
    guardian = byEmail;
  }

  let guardianId = guardian?.id || "";
  let created = false;

  if (guardianId) {
    const { data: authData, error: authLookupError } = await admin.auth.admin.getUserById(guardianId);
    if (authLookupError || !authData.user) redirect(`/veliler/ogrenciden-olustur?error=${safeMessage("Mevcut portal hesabının kimlik kaydı bulunamadı.")}&student=${studentId}`);

    if (authData.user.phone !== accountPhone) {
      const { error: phoneUpdateError } = await admin.auth.admin.updateUserById(guardianId, {
        phone: accountPhone,
        user_metadata: {
          ...(authData.user.user_metadata || {}),
          full_name: accountName,
          role: "guardian",
          organization_id: organizationId,
        },
      });
      if (phoneUpdateError) redirect(`/veliler/ogrenciden-olustur?error=${safeMessage(`Telefon Auth hesabına bağlanamadı: ${phoneUpdateError.message}`)}&student=${studentId}`);
    }

    const { error: profileUpdateError } = await admin.from("profiles").update({
      phone: accountPhone,
      full_name: guardian.full_name || accountName,
      email: guardian.email || accountEmail || null,
      is_active: true,
      updated_at: new Date().toISOString(),
    }).eq("id", guardianId).eq("organization_id", organizationId);
    if (profileUpdateError) redirect(`/veliler/ogrenciden-olustur?error=${safeMessage(profileUpdateError.message)}&student=${studentId}`);
  } else {
    const temporarySecret = `Sprint-${crypto.randomUUID()}-A9!`;
    const { data: createdUser, error: createError } = await admin.auth.admin.createUser({
      phone: accountPhone,
      password: temporarySecret,
      user_metadata: {
        full_name: accountName,
        role: "guardian",
        organization_id: organizationId,
      },
    });
    if (createError || !createdUser.user) {
      const message = createError?.message || "Portal hesabı oluşturulamadı.";
      redirect(`/veliler/ogrenciden-olustur?error=${safeMessage(message)}&student=${studentId}`);
    }
    guardianId = createdUser.user.id;
    created = true;

    const { error: profileError } = await admin.from("profiles").upsert({
      id: guardianId,
      organization_id: organizationId,
      full_name: accountName,
      phone: accountPhone,
      email: accountEmail || null,
      role: "guardian",
      is_active: true,
      last_sign_in_at: null,
      updated_at: new Date().toISOString(),
    }, { onConflict: "id" });
    if (profileError) {
      await admin.auth.admin.deleteUser(guardianId);
      redirect(`/veliler/ogrenciden-olustur?error=${safeMessage(`Portal profili oluşturulamadı: ${profileError.message}`)}&student=${studentId}`);
    }
  }

  const { error: linkError } = await admin.from("guardian_students").upsert({
    guardian_id: guardianId,
    student_id: studentId,
    relationship,
    is_primary: true,
    is_payment_contact: true,
    receives_messages: true,
    portal_access: true,
  }, { onConflict: "guardian_id,student_id" });

  if (linkError) {
    if (created) await admin.auth.admin.deleteUser(guardianId);
    redirect(`/veliler/ogrenciden-olustur?error=${safeMessage(`Portal hesabı öğrenciye bağlanamadı: ${linkError.message}`)}&student=${studentId}`);
  }

  try {
    await admin.from("student_activity_logs").insert({
      organization_id: organizationId,
      student_id: studentId,
      activity_type: useSelf ? "student_self_portal_created" : "guardian_portal_created_from_student",
      title: created ? (useSelf ? "Kursiyer portal hesabı oluşturuldu" : "Veli portal hesabı oluşturuldu") : "Mevcut portal hesabı bağlandı",
      description: `${accountName} öğrenci üzerinden portal hesabına bağlandı.`,
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
    ? useSelf
      ? "Kursiyerin kendi portal hesabı oluşturuldu ve öğrenci kaydına bağlandı. Telefon doğrulaması için hazır."
      : "Veli hesabı oluşturuldu ve öğrenciye bağlandı. Telefon doğrulaması için hazır."
    : useSelf
      ? "Kursiyerin mevcut portal hesabı bulundu ve öğrenci kaydına bağlandı."
      : "Mevcut veli hesabı bulundu ve öğrenciye bağlandı.";
  redirect(`/veliler/ogrenciden-olustur?saved=${safeMessage(saved)}&guardian=${guardianId}&student=${studentId}`);
}
