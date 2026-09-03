"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";

const ROLES = ["owner", "admin", "branch_manager", "registration_staff"] as const;

function text(value: FormDataEntryValue | null, max = 500) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function nullable(value: FormDataEntryValue | null, max = 500) {
  const clean = text(value, max);
  return clean || null;
}

async function getEditor() {
  const profile = await requireProfile([...ROLES]);
  const supabase = await createClient();
  const editor =
    (profile as { full_name?: string | null; email?: string | null }).full_name ||
    (profile as { email?: string | null }).email ||
    "Yetkili kullanıcı";

  return { profile, supabase, editor };
}

export async function updatePreRegistration(formData: FormData) {
  const { profile, supabase, editor } = await getEditor();
  const studentId = text(formData.get("student_id"), 80);

  if (!studentId) throw new Error("Ön kayıt kimliği bulunamadı.");

  const { data: current, error: currentError } = await supabase
    .from("students")
    .select(
      "id,status,first_name,last_name,birth_date,phone,guardian_name,guardian_phone,branch_id,preferred_group_id,preferred_package_id,swimming_level,preferred_days,preferred_time,registration_note"
    )
    .eq("id", studentId)
    .eq("organization_id", profile.organization_id)
    .single();

  if (currentError || !current) throw new Error("Ön kayıt bulunamadı.");
  if (current.status !== "pre_registration") {
    throw new Error("Bu kayıt artık ön kayıt durumunda değil.");
  }

  const next = {
    first_name: text(formData.get("first_name"), 60),
    last_name: text(formData.get("last_name"), 60),
    birth_date: nullable(formData.get("birth_date"), 10),
    phone: nullable(formData.get("phone"), 20),
    guardian_name: nullable(formData.get("guardian_name"), 120),
    guardian_phone: nullable(formData.get("guardian_phone"), 20),
    branch_id: nullable(formData.get("branch_id"), 80),
    preferred_group_id: nullable(formData.get("preferred_group_id"), 80),
    preferred_package_id: nullable(formData.get("preferred_package_id"), 80),
    swimming_level: nullable(formData.get("swimming_level"), 100),
    preferred_days: nullable(formData.get("preferred_days"), 150),
    preferred_time: nullable(formData.get("preferred_time"), 100),
    registration_note: nullable(formData.get("registration_note"), 1000),
  };

  const { data: currentConsent, error: consentLookupError } = await supabase
    .from("registration_consents")
    .select("*")
    .eq("organization_id", profile.organization_id)
    .eq("student_id", studentId)
    .order("accepted_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (consentLookupError) {
    throw new Error(`Kabul kayıtları okunamadı: ${consentLookupError.message}`);
  }

  const managementConfirmed = formData.get("management_confirmation") === "yes";
  const nextConsent = {
    registration_for: text(formData.get("registration_for"), 20) || "child",
    health_declaration: formData.get("health_declaration") === "yes",
    health_note: nullable(formData.get("health_note"), 1500),
    rules_accepted: formData.get("rules_accepted") === "yes",
    whatsapp_permission: formData.get("whatsapp_permission") === "yes",
    contact_request: nullable(formData.get("contact_request"), 80),
  };

  const consentWasChanged =
    String(currentConsent?.registration_for ?? "child") !== nextConsent.registration_for ||
    Boolean(currentConsent?.health_declaration) !== nextConsent.health_declaration ||
    String(currentConsent?.health_note ?? "") !== String(nextConsent.health_note ?? "") ||
    Boolean(currentConsent?.rules_accepted) !== nextConsent.rules_accepted ||
    Boolean(currentConsent?.whatsapp_permission) !== nextConsent.whatsapp_permission ||
    String(currentConsent?.contact_request ?? "") !== String(nextConsent.contact_request ?? "");

  if (consentWasChanged && !managementConfirmed) {
    throw new Error(
      "Sağlık ve kabul bilgilerini değiştirmek için veli/kursiyer beyanının yönetim tarafından teyit edildiğini işaretleyiniz."
    );
  }

  if (!next.first_name || !next.last_name) {
    throw new Error("Ad ve soyad boş bırakılamaz.");
  }

  if (next.branch_id) {
    const { data: branch } = await supabase
      .from("branches")
      .select("id")
      .eq("organization_id", profile.organization_id)
      .eq("id", next.branch_id)
      .maybeSingle();

    if (!branch) throw new Error("Seçilen şube geçerli değil.");
  }

  let selectedGroup: {
    id: string;
    branch_id: string | null;
    course_type: string | null;
    is_active: boolean | null;
  } | null = null;

  if (next.preferred_group_id) {
    const { data: group } = await supabase
      .from("training_groups")
      .select("id,branch_id,course_type,is_active")
      .eq("organization_id", profile.organization_id)
      .eq("id", next.preferred_group_id)
      .maybeSingle();

    if (!group) throw new Error("Seçilen grup geçerli değil.");

    const keepingCurrent = current.preferred_group_id === group.id;
    if (group.is_active === false && !keepingCurrent) {
      throw new Error("Pasif bir grup yeni seçim olarak kullanılamaz.");
    }

    if (next.branch_id && group.branch_id !== next.branch_id) {
      throw new Error("Seçilen grup seçilen şubeye bağlı değil.");
    }

    selectedGroup = group;
  }

  if (next.preferred_package_id) {
    const { data: coursePackage } = await supabase
      .from("course_packages")
      .select("id,course_type,is_active")
      .eq("organization_id", profile.organization_id)
      .eq("id", next.preferred_package_id)
      .maybeSingle();

    if (!coursePackage) throw new Error("Seçilen paket geçerli değil.");

    const keepingCurrent = current.preferred_package_id === coursePackage.id;
    if (coursePackage.is_active === false && !keepingCurrent) {
      throw new Error("Pasif bir paket yeni seçim olarak kullanılamaz.");
    }

    if (
      selectedGroup?.course_type &&
      coursePackage.course_type &&
      selectedGroup.course_type !== coursePackage.course_type
    ) {
      throw new Error("Seçilen paket, seçilen grubun kurs türüyle uyumlu değil.");
    }
  }

  const fields = [
    "first_name",
    "last_name",
    "birth_date",
    "phone",
    "guardian_name",
    "guardian_phone",
    "branch_id",
    "preferred_group_id",
    "preferred_package_id",
    "swimming_level",
    "preferred_days",
    "preferred_time",
    "registration_note",
  ] as const;

  const changes: Record<string, { old: unknown; new: unknown }> = {};

  for (const key of fields) {
    const oldValue = current[key] ?? null;
    const newValue = next[key] ?? null;

    if (String(oldValue ?? "") !== String(newValue ?? "")) {
      changes[key] = { old: oldValue, new: newValue };
    }
  }

  if (!Object.keys(changes).length && !consentWasChanged) {
    redirect(`/on-kayitlar?student=${encodeURIComponent(studentId)}`);
  }

  if (Object.keys(changes).length) {
    const { error: updateError } = await supabase
      .from("students")
      .update(next)
      .eq("id", studentId)
      .eq("organization_id", profile.organization_id)
      .eq("status", "pre_registration");

    if (updateError) {
      throw new Error(`Ön kayıt güncellenemedi: ${updateError.message}`);
    }
  }

  if (consentWasChanged) {
    const now = new Date().toISOString();
    const consentPayload = {
      ...nextConsent,
      accepted_at: now,
      rules_version: currentConsent?.rules_version || "SPRINT-KURALLAR-v1",
      form_version: currentConsent?.form_version || "SPRINT-YONETIM-TAMAMLAMA-v1",
      form_snapshot:
        currentConsent?.form_snapshot || {
          source: "management_completed_import",
          completed_at: now,
          completed_by: { profile_id: profile.id, name: editor },
          student: {
            first_name: next.first_name,
            last_name: next.last_name,
            phone: next.phone,
            guardian_name: next.guardian_name,
            guardian_phone: next.guardian_phone,
          },
          consents: nextConsent,
        },
    };

    const consentMutation = currentConsent?.student_id
      ? supabase
          .from("registration_consents")
          .update(consentPayload)
          .eq("organization_id", profile.organization_id)
          .eq("id", currentConsent.id)
      : supabase.from("registration_consents").insert({
          organization_id: profile.organization_id,
          student_id: studentId,
          ...consentPayload,
        });

    const { error: consentUpdateError } = await consentMutation;
    if (consentUpdateError) {
      throw new Error(`Sağlık ve kabul bilgileri kaydedilemedi: ${consentUpdateError.message}`);
    }
  }

  const { data: relation } = await supabase
    .from("guardian_students")
    .select("guardian_id,is_primary")
    .eq("student_id", studentId)
    .order("is_primary", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (relation?.guardian_id && (next.guardian_name || next.guardian_phone)) {
    const { error: guardianError } = await supabase
      .from("guardians")
      .update({
        ...(next.guardian_name ? { full_name: next.guardian_name } : {}),
        ...(next.guardian_phone ? { phone: next.guardian_phone } : {}),
      })
      .eq("id", relation.guardian_id)
      .eq("organization_id", profile.organization_id);

    if (guardianError) console.error("guardian sync error:", guardianError);
  }

  const changedLabels: Record<string, string> = {
    first_name: "Ad",
    last_name: "Soyad",
    birth_date: "Doğum tarihi",
    phone: "Telefon",
    guardian_name: "Veli adı",
    guardian_phone: "Veli telefonu",
    branch_id: "Şube",
    preferred_group_id: "Grup",
    preferred_package_id: "Paket",
    swimming_level: "Yüzme seviyesi",
    preferred_days: "Tercih edilen gün",
    preferred_time: "Tercih edilen saat",
    registration_note: "Kayıt notu",
  };

  const changedText = Object.keys(changes)
    .map((key) => changedLabels[key] || key)
    .join(", ");

  const completeChangedText = [
    changedText,
    consentWasChanged ? "Sağlık, iletişim ve elektronik kabul bilgileri" : "",
  ]
    .filter(Boolean)
    .join(", ");

  const { error: logError } = await supabase.from("student_activity_logs").insert({
    organization_id: profile.organization_id,
    student_id: studentId,
    activity_type: "pre_registration_updated",
    title: "Ön kayıt bilgileri güncellendi",
    description: `${editor} tarafından şu alanlar güncellendi: ${completeChangedText}.`,
    new_value: {
      edited_by: { profile_id: profile.id, name: editor },
      changes,
      consent_changes: consentWasChanged
        ? {
            health_declaration: nextConsent.health_declaration,
            health_note_provided: Boolean(nextConsent.health_note),
            rules_accepted: nextConsent.rules_accepted,
            whatsapp_permission: nextConsent.whatsapp_permission,
            contact_request: nextConsent.contact_request,
            management_confirmed: managementConfirmed,
          }
        : null,
    },
    source_type: "pre_registration_center",
    source_id: studentId,
    performed_at: new Date().toISOString(),
  });

  if (logError) console.error("pre-registration edit log error:", logError);

  revalidatePath("/on-kayitlar");
  revalidatePath(`/kayit-tamamlama/${studentId}`);
  redirect(`/on-kayitlar?updated=1&student=${encodeURIComponent(studentId)}`);
}

async function changePreRegistrationStatus(
  formData: FormData,
  mode: "passive" | "archived"
) {
  const { profile, supabase, editor } = await getEditor();
  const studentId = text(formData.get("student_id"), 80);

  if (!studentId) throw new Error("Ön kayıt kimliği bulunamadı.");

  const { data: student, error } = await supabase
    .from("students")
    .select("id,first_name,last_name,status")
    .eq("id", studentId)
    .eq("organization_id", profile.organization_id)
    .single();

  if (error || !student) throw new Error("Ön kayıt bulunamadı.");
  if (student.status !== "pre_registration") {
    throw new Error("Bu kayıt artık ön kayıt durumunda değil.");
  }

  const { error: updateError } = await supabase
    .from("students")
    .update({ status: "passive" })
    .eq("id", studentId)
    .eq("organization_id", profile.organization_id)
    .eq("status", "pre_registration");

  if (updateError) {
    throw new Error(
      mode === "passive"
        ? `Ön kayıt pasife alınamadı: ${updateError.message}`
        : `Ön kayıt listeden silinemedi: ${updateError.message}`
    );
  }

  const isArchive = mode === "archived";

  const { error: logError } = await supabase.from("student_activity_logs").insert({
    organization_id: profile.organization_id,
    student_id: studentId,
    activity_type: isArchive
      ? "pre_registration_archived"
      : "pre_registration_deactivated",
    title: isArchive ? "Ön kayıt listeden silindi" : "Ön kayıt pasife alındı",
    description: isArchive
      ? `${editor} tarafından ön kayıt yönetim listesinden kaldırıldı. Elektronik form ve denetim kayıtları korundu.`
      : `${editor} tarafından ön kayıt pasife alındı.`,
    new_value: {
      performed_by: { profile_id: profile.id, name: editor },
      previous_status: "pre_registration",
      new_status: "passive",
      archive_mode: isArchive,
    },
    source_type: "pre_registration_center",
    source_id: studentId,
    performed_at: new Date().toISOString(),
  });

  if (logError) console.error("pre-registration status log error:", logError);

  revalidatePath("/on-kayitlar");
  redirect(`/on-kayitlar?status=${isArchive ? "archived" : "passive"}`);
}

export async function deactivatePreRegistration(formData: FormData) {
  return changePreRegistrationStatus(formData, "passive");
}

export async function archivePreRegistration(formData: FormData) {
  return changePreRegistrationStatus(formData, "archived");
}
