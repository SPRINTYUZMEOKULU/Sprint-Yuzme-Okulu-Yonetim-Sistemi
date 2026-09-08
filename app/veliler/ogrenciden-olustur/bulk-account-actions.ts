"use server";

import { createClient as createAdminClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth/profile";

const roles = ["owner", "admin", "branch_manager", "registration_staff"] as const;

export type GuardianBulkResult = {
  ok: boolean;
  key: string;
  fullName: string;
  phone: string;
  email: string;
  password?: string;
  studentNames: string[];
  status: "created" | "linked" | "password_reset" | "error";
  message: string;
};

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase yönetici bağlantısı yapılandırılmamış.");
  return createAdminClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function normalizePhone(value: unknown) {
  let digits = String(value || "").replace(/\D/g, "");
  if (digits.startsWith("0090")) digits = digits.slice(4);
  if (digits.startsWith("90") && digits.length === 12) digits = digits.slice(2);
  if (digits.startsWith("0") && digits.length === 11) digits = digits.slice(1);
  return digits.length === 10 && digits.startsWith("5") ? `+90${digits}` : "";
}

function phoneCandidates(phone: string) {
  const local = phone.replace(/^\+90/, "");
  return [phone, `90${local}`, `0${local}`, local];
}

function temporaryPassword() {
  return `Sp-${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}-A9!`;
}

export async function prepareGuardianAccountBatch(studentIdsValue: string[]): Promise<GuardianBulkResult[]> {
  const profile = await requireProfile([...roles]);
  const organizationId = profile.organization_id;
  const studentIds = [...new Set((studentIdsValue || []).map(String).map((id) => id.trim()).filter(Boolean))].slice(0, 100);
  if (!organizationId || !studentIds.length) return [];

  const admin = adminClient();
  const { data: students, error: studentError } = await admin
    .from("students")
    .select("id,first_name,last_name,phone,guardian_name,guardian_phone,guardian_email")
    .eq("organization_id", organizationId)
    .eq("is_deleted", false)
    .in("id", studentIds);

  if (studentError) {
    return [{ ok: false, key: "batch", fullName: "", phone: "", email: "", studentNames: [], status: "error", message: studentError.message }];
  }

  const groups = new Map<string, { fullName: string; phone: string; email: string; relationship: string; students: any[] }>();
  for (const student of students || []) {
    const studentName = `${student.first_name || ""} ${student.last_name || ""}`.trim();
    const guardianName = String(student.guardian_name || "").trim();
    const guardianPhone = normalizePhone(student.guardian_phone);
    const ownPhone = normalizePhone(student.phone);
    const usesSelf = !guardianName && !guardianPhone && Boolean(ownPhone);
    const phone = guardianPhone || ownPhone;
    const fullName = guardianName || studentName;
    const email = usesSelf ? "" : String(student.guardian_email || "").trim().toLowerCase();
    if (!fullName || !phone) continue;
    const current = groups.get(phone);
    if (current) current.students.push(student);
    else groups.set(phone, { fullName, phone, email, relationship: usesSelf ? "Kendisi" : "Veli", students: [student] });
  }

  const results: GuardianBulkResult[] = [];
  for (const [key, group] of groups) {
    const candidates = phoneCandidates(group.phone);
    const studentNames = group.students.map((student) => `${student.first_name || ""} ${student.last_name || ""}`.trim());
    const password = temporaryPassword();
    let created = false;
    try {
      const { data: existingProfile, error: lookupError } = await admin.from("profiles").select("id,full_name,phone,email,is_active").eq("organization_id", organizationId).eq("role", "guardian").in("phone", candidates).limit(1).maybeSingle();
      if (lookupError) throw lookupError;
      let authUserId = existingProfile?.id || "";
      if (!authUserId) {
        const payload: any = { phone: group.phone, phone_confirm: true, password, user_metadata: { full_name: group.fullName, role: "guardian", organization_id: organizationId } };
        if (group.email) { payload.email = group.email; payload.email_confirm = true; }
        const { data: createdUser, error: createError } = await admin.auth.admin.createUser(payload);
        if (createError || !createdUser.user) throw createError || new Error("Veli giriş hesabı oluşturulamadı.");
        authUserId = createdUser.user.id;
        created = true;
      } else {
        const { data: authData, error: authLookupError } = await admin.auth.admin.getUserById(authUserId);
        if (authLookupError || !authData.user) throw authLookupError || new Error("Veli kimlik hesabı bulunamadı.");
        const { error: updateAuthError } = await admin.auth.admin.updateUserById(authUserId, { password, phone: group.phone, phone_confirm: true, user_metadata: { ...(authData.user.user_metadata || {}), full_name: group.fullName, role: "guardian", organization_id: organizationId } });
        if (updateAuthError) throw updateAuthError;
      }

      const { error: profileError } = await admin.from("profiles").upsert({ id: authUserId, organization_id: organizationId, full_name: existingProfile?.full_name || group.fullName, phone: group.phone, email: existingProfile?.email || group.email || null, role: "guardian", is_active: true, updated_at: new Date().toISOString() }, { onConflict: "id" });
      if (profileError) throw profileError;

      let guardianRecord: any = null;
      const { data: byAuth } = await admin.from("guardians").select("id,auth_user_id").eq("organization_id", organizationId).eq("auth_user_id", authUserId).limit(1).maybeSingle();
      guardianRecord = byAuth;
      if (!guardianRecord) {
        const { data: byPhone } = await admin.from("guardians").select("id,auth_user_id").eq("organization_id", organizationId).in("phone", candidates).limit(1).maybeSingle();
        guardianRecord = byPhone;
      }
      if (guardianRecord) {
        const { error } = await admin.from("guardians").update({ auth_user_id: authUserId, full_name: group.fullName, phone: group.phone, email: group.email || null, relationship: group.relationship, login_enabled: true, is_active: true, first_login_required: true, updated_at: new Date().toISOString() }).eq("id", guardianRecord.id).eq("organization_id", organizationId);
        if (error) throw error;
      } else {
        const { data: inserted, error } = await admin.from("guardians").insert({ organization_id: organizationId, auth_user_id: authUserId, full_name: group.fullName, phone: group.phone, email: group.email || null, relationship: group.relationship, login_enabled: true, is_active: true, first_login_required: true, portal_created_at: new Date().toISOString() }).select("id").single();
        if (error || !inserted) throw error || new Error("Veli portal kaydı oluşturulamadı.");
        guardianRecord = inserted;
      }

      for (const student of group.students) {
        const { error: linkError } = await admin.from("guardian_students").upsert({ guardian_id: guardianRecord.id, student_id: student.id, relationship: group.relationship, is_primary: true, is_payment_contact: true, receives_messages: true, portal_access: true }, { onConflict: "guardian_id,student_id" });
        if (linkError) throw linkError;
        await admin.from("student_activity_logs").insert({ organization_id: organizationId, student_id: student.id, activity_type: created ? "guardian_portal_bulk_created" : "guardian_portal_password_reset", title: created ? "Veli portal hesabı toplu işlemle oluşturuldu" : "Veli portal giriş bilgileri yenilendi", description: `${group.fullName} için giriş bilgileri Veli Yönetim Merkezi üzerinden hazırlandı.`, source_type: "guardian_bulk_accounts", source_id: authUserId, performed_at: new Date().toISOString() });
      }

      results.push({ ok: true, key, fullName: group.fullName, phone: group.phone, email: group.email, password, studentNames, status: created ? "created" : existingProfile ? "password_reset" : "linked", message: created ? "Veli hesabı oluşturuldu ve şifresi hazırlandı." : "Veli hesabının yeni geçici şifresi hazırlandı." });
    } catch (error) {
      results.push({ ok: false, key, fullName: group.fullName, phone: group.phone, email: group.email, studentNames, status: "error", message: error instanceof Error ? error.message : "Veli hesabı hazırlanamadı." });
    }
  }
  revalidatePath("/veliler");
  revalidatePath("/veliler/ogrenciden-olustur");
  return results;
}
