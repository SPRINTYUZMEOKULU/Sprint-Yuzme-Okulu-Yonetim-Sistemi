import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizePortalPhone } from "./portal-recipient";

export function portalPhoneCandidates(phone: string) {
  const local = phone.replace(/^\+90/, "");
  return [phone, `90${local}`, `0${local}`, local, `0090${local}`];
}

function nameKey(name: string) {
  return name.normalize("NFC").trim().replace(/\s+/g, " ").toLocaleLowerCase("tr-TR");
}

type PendingGuardian = {
  id: string;
  phone: string | null;
  full_name: string | null;
  email: string | null;
};

export async function reuseSiblingAccount(
  admin: SupabaseClient,
  organizationId: string,
  studentId: string,
  pending: PendingGuardian,
  recipient: { fullName: string; phone: string; email: string; relationship: string },
) {
  const { fullName, phone, email, relationship } = recipient;
  if (relationship === "Kendisi" || !phone) return null;

  const conflict = "Veli adı, telefonu veya hesap bağlantısı eşleşmiyor. Öğrenci dosyası ile Veli Merkezi’ndeki bilgileri kontrol edin.";
  const { data: profiles, error: profileError } = await admin.from("profiles")
    .select("id,full_name,phone,email,is_active")
    .eq("organization_id", organizationId).eq("role", "guardian")
    .in("phone", portalPhoneCandidates(phone)).limit(2);
  if (profileError) throw new Error("Mevcut veli hesabı kontrol edilemedi.");
  if (!profiles?.length) return null;
  if (profiles.length !== 1) throw new Error(conflict);
  const [profile] = profiles;

  const { data: guardian, error: guardianError } = await admin.from("guardians")
    .select("id,full_name,phone,email,is_active,login_enabled")
    .eq("organization_id", organizationId).eq("auth_user_id", profile.id).maybeSingle();
  if (guardianError) throw new Error("Mevcut veli bağlantısı kontrol edilemedi.");
  if (!guardian) return null;

  const names = [fullName, pending.full_name, guardian.full_name, profile.full_name].map(name => nameKey(name || ""));
  const emails = [email, pending.email, guardian.email, profile.email]
    .map(value => value?.trim().toLowerCase())
    .filter(value => value && !value.endsWith("@login.sprintos.local"));
  if (!profile.is_active || !guardian.is_active || !guardian.login_enabled || !names[0] ||
      names.some(name => name !== names[0]) || new Set(emails).size > 1 ||
      [pending.phone, guardian.phone, profile.phone].some(value => normalizePortalPhone(value) !== phone)) {
    throw new Error(conflict);
  }

  const { data: identity, error: identityError } = await admin.auth.admin.getUserById(profile.id);
  if (identityError || normalizePortalPhone(identity.user?.phone) !== phone) throw new Error(conflict);

  // Move the existing relationship in one write so its flags and timestamps are retained.
  const { data: moved, error: moveError } = await admin.from("guardian_students")
    .update({ guardian_id: guardian.id }).eq("student_id", studentId)
    .eq("guardian_id", pending.id).eq("is_primary", true).eq("portal_access", true)
    .select("student_id").maybeSingle();
  if (moveError) throw new Error("Veli bağlantısı değiştirilemedi. Öğrenci dosyasını yenileyip tekrar deneyin.");
  if (!moved) {
    const { data: existing, error: existingError } = await admin.from("guardian_students")
      .select("student_id").eq("student_id", studentId).eq("guardian_id", guardian.id)
      .eq("is_primary", true).eq("portal_access", true).maybeSingle();
    if (existingError || !existing) throw new Error(conflict);
  }

  if (moved) {
    const { error: auditError } = await admin.from("student_activity_logs").insert({
      organization_id: organizationId, student_id: studentId,
      activity_type: "guardian_portal_linked", title: "Mevcut veli portal hesabına bağlandı",
      description: "Veli bilgileri eşleştirilerek kardeşler aynı portal hesabına bağlandı.",
      source_type: "guardian_portal", source_id: profile.id, performed_at: new Date().toISOString(),
    });
    if (auditError) return { accountId: profile.id, message: "Veli hesabı bağlandı. İşlem geçmişi kaydedilemedi." };
  }

  return { accountId: profile.id, message: "Kursiyer mevcut veli hesabına bağlandı." };
}
