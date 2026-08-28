"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";

function text(value: FormDataEntryValue | null, max = 500) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function nullable(value: FormDataEntryValue | null, max = 500) {
  const clean = text(value, max);
  return clean || null;
}

export async function updatePreRegistration(formData: FormData) {
  const profile = await requireProfile([
    "owner",
    "admin",
    "branch_manager",
    "registration_staff",
  ]);

  const supabase = await createClient();

  const studentId = text(formData.get("student_id"), 80);
  if (!studentId) {
    throw new Error("Ön kayıt kimliği bulunamadı.");
  }

  const { data: current, error: currentError } = await supabase
    .from("students")
    .select(
      "id,status,first_name,last_name,birth_date,phone,guardian_name,guardian_phone,branch_id,preferred_group_id,preferred_package_id,swimming_level,preferred_days,preferred_time,registration_note"
    )
    .eq("id", studentId)
    .eq("organization_id", profile.organization_id)
    .single();

  if (currentError || !current) {
    throw new Error("Ön kayıt bulunamadı.");
  }

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

    if (!branch) {
      throw new Error("Seçilen şube geçerli değil.");
    }
  }

  if (next.preferred_group_id) {
    const { data: group } = await supabase
      .from("training_groups")
      .select("id,branch_id")
      .eq("organization_id", profile.organization_id)
      .eq("id", next.preferred_group_id)
      .maybeSingle();

    if (!group) {
      throw new Error("Seçilen grup geçerli değil.");
    }

    if (next.branch_id && group.branch_id !== next.branch_id) {
      throw new Error("Seçilen grup seçilen şubeye bağlı değil.");
    }
  }

  if (next.preferred_package_id) {
    const { data: coursePackage } = await supabase
      .from("course_packages")
      .select("id")
      .eq("organization_id", profile.organization_id)
      .eq("id", next.preferred_package_id)
      .maybeSingle();

    if (!coursePackage) {
      throw new Error("Seçilen paket geçerli değil.");
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

  const changes: Record<
    string,
    {
      old: unknown;
      new: unknown;
    }
  > = {};

  for (const key of fields) {
    const oldValue = current[key] ?? null;
    const newValue = next[key] ?? null;

    if (String(oldValue ?? "") !== String(newValue ?? "")) {
      changes[key] = {
        old: oldValue,
        new: newValue,
      };
    }
  }

  if (!Object.keys(changes).length) {
    redirect(`/on-kayitlar?student=${encodeURIComponent(studentId)}`);
  }

  const { error: updateError } = await supabase
    .from("students")
    .update(next)
    .eq("id", studentId)
    .eq("organization_id", profile.organization_id)
    .eq("status", "pre_registration");

  if (updateError) {
    throw new Error(`Ön kayıt güncellenemedi: ${updateError.message}`);
  }

  const { data: relation } = await supabase
    .from("guardian_students")
    .select("guardian_id,is_primary")
    .eq("student_id", studentId)
    .order("is_primary", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (relation?.guardian_id && (next.guardian_name || next.guardian_phone)) {
    await supabase
      .from("guardians")
      .update({
        ...(next.guardian_name ? { full_name: next.guardian_name } : {}),
        ...(next.guardian_phone ? { phone: next.guardian_phone } : {}),
      })
      .eq("id", relation.guardian_id)
      .eq("organization_id", profile.organization_id);
  }

  const editor =
    (profile as { full_name?: string | null; email?: string | null }).full_name ||
    (profile as { email?: string | null }).email ||
    "Yetkili kullanıcı";

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

  const performedAt = new Date().toISOString();

  const { error: logError } = await supabase
    .from("student_activity_logs")
    .insert({
      organization_id: profile.organization_id,
      student_id: studentId,
      activity_type: "pre_registration_updated",
      title: "Ön kayıt bilgileri güncellendi",
      description: `${editor} tarafından şu alanlar güncellendi: ${changedText}.`,
      new_value: {
        edited_by: {
          profile_id: profile.id,
          name: editor,
        },
        changes,
      },
      source_type: "pre_registration_center",
      source_id: studentId,
      performed_at: performedAt,
    });

  if (logError) {
    console.error("pre-registration edit log error:", logError);
  }

  revalidatePath("/on-kayitlar");
  revalidatePath(`/kayit-tamamlama/${studentId}`);

  redirect(
    `/on-kayitlar?updated=1&student=${encodeURIComponent(studentId)}`
  );
}
