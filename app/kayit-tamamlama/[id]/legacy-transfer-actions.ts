"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import { completeRegistration } from "./actions";

const managerRoles = ["owner", "admin"] as const;
const registrationRoles = [
  "owner",
  "admin",
  "branch_manager",
  "registration_staff",
] as const;

function text(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

function bool(formData: FormData, key: string) {
  return formData.get(key) === "on";
}

function studentIdFrom(formData: FormData) {
  return text(formData, "student_id") || text(formData, "legacy_student_id");
}

function compensationCount(formData: FormData) {
  const value = Number(formData.get("legacy_compensation_count") || 0);
  return Number.isInteger(value) && value >= 0 && value <= 100 ? value : -1;
}

async function addCompensation(params: {
  organizationId: string;
  studentId: string;
  count: number;
  performedBy: string;
}) {
  if (params.count < 1) return;

  const supabase = await createClient();
  const { data: current } = await supabase
    .from("student_lesson_balance")
    .select("student_id,compensation_lesson_balance")
    .eq("student_id", params.studentId)
    .limit(1)
    .maybeSingle();

  const previous = Math.max(0, Number(current?.compensation_lesson_balance || 0));
  const next = previous + params.count;

  if (current) {
    const { error } = await supabase
      .from("student_lesson_balance")
      .update({ compensation_lesson_balance: next })
      .eq("student_id", params.studentId);

    if (error) throw new Error(`Telafi bakiyesi güncellenemedi: ${error.message}`);
  } else {
    const { error } = await supabase
      .from("student_lesson_balance")
      .insert({
        student_id: params.studentId,
        normal_lesson_balance: 0,
        compensation_lesson_balance: next,
      });

    if (error) throw new Error(`Telafi bakiyesi oluşturulamadı: ${error.message}`);
  }

  await supabase.from("student_activity_logs").insert({
    organization_id: params.organizationId,
    student_id: params.studentId,
    activity_type: "legacy_transfer_compensation_added",
    title: "Aktarımdan gelen telafi eklendi",
    description: `${params.count} adet telafi dersi yönetim tarafından eski sistem aktarımı kapsamında eklendi. Yeni telafi bakiyesi: ${next}.`,
    old_value: { compensation_lesson_balance: previous },
    new_value: { compensation_lesson_balance: next, added: params.count },
    source_type: "registration_completion_legacy_transfer",
    source_id: params.studentId,
    performed_by: params.performedBy,
    performed_at: new Date().toISOString(),
  });
}

export async function addLegacyTransferCompensation(formData: FormData) {
  const profile = await requireProfile([...registrationRoles]);
  const studentId = studentIdFrom(formData);
  const count = compensationCount(formData);

  if (!profile.organization_id || !studentId) {
    redirect(`/on-kayitlar?error=${encodeURIComponent("Öğrenci bilgisi bulunamadı.")}`);
  }

  if (count < 1) {
    redirect(
      `/kayit-tamamlama/${studentId}?error=${encodeURIComponent(
        "Eklenecek telafi sayısını 1-100 arasında giriniz."
      )}#onaylar`
    );
  }

  const supabase = await createClient();
  const { data: student } = await supabase
    .from("students")
    .select("id")
    .eq("id", studentId)
    .eq("organization_id", profile.organization_id)
    .maybeSingle();

  if (!student) {
    redirect(
      `/kayit-tamamlama/${studentId}?error=${encodeURIComponent("Öğrenci bulunamadı.")}#onaylar`
    );
  }

  try {
    await addCompensation({
      organizationId: profile.organization_id,
      studentId,
      count,
      performedBy: profile.id,
    });
  } catch (error) {
    redirect(
      `/kayit-tamamlama/${studentId}?error=${encodeURIComponent(
        error instanceof Error ? error.message : "Telafi eklenemedi."
      )}#onaylar`
    );
  }

  revalidatePath(`/kayit-tamamlama/${studentId}`);
  revalidatePath(`/ogrenciler/${studentId}`);
  revalidatePath("/ogrenciler");

  redirect(`/kayit-tamamlama/${studentId}?legacy_compensation_added=${count}#onaylar`);
}

export async function managerConfirmLegacyTransfer(formData: FormData) {
  const profile = await requireProfile([...managerRoles]);
  const studentId = studentIdFrom(formData);
  const count = compensationCount(formData);

  if (!profile.organization_id || !studentId) {
    redirect(`/on-kayitlar?error=${encodeURIComponent("Öğrenci bilgisi bulunamadı.")}`);
  }

  if (count < 0) {
    redirect(
      `/kayit-tamamlama/${studentId}?error=${encodeURIComponent(
        "Telafi sayısı 0-100 arasında olmalıdır."
      )}#onaylar`
    );
  }

  const supabase = await createClient();
  const { data: student } = await supabase
    .from("students")
    .select("id,first_name,last_name")
    .eq("id", studentId)
    .eq("organization_id", profile.organization_id)
    .maybeSingle();

  if (!student) {
    redirect(
      `/kayit-tamamlama/${studentId}?error=${encodeURIComponent("Öğrenci bulunamadı.")}#onaylar`
    );
  }

  const now = new Date().toISOString();

  const { data: existingConsent } = await supabase
    .from("registration_consents")
    .select("id,rules_accepted,health_declaration")
    .eq("organization_id", profile.organization_id)
    .eq("student_id", studentId)
    .order("accepted_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!existingConsent?.rules_accepted || !existingConsent?.health_declaration) {
    const { error: consentError } = await supabase.from("registration_consents").insert({
      organization_id: profile.organization_id,
      student_id: studentId,
      registration_for: "legacy_transfer_manager_override",
      health_declaration: true,
      health_note: null,
      rules_accepted: true,
      whatsapp_permission: false,
      contact_request: null,
      rules_version: "YONETICI-TEYIDI-AKTARIM-v1",
      form_version: "SPRINT-LEGACY-AKTARIM-v1",
      accepted_at: now,
      form_snapshot: {
        source: "legacy_transfer_manager_override",
        manager_profile_id: profile.id,
        confirmed_at: now,
        note: "Eski sistemden aktarılan öğrenci için eksik sağlık beyanı ve kural kabul kaydı yönetici teyidiyle idari olarak onaylandı. Bu kayıt veli/öğrenci elektronik kabulü değildir.",
      },
    });

    if (consentError) {
      redirect(
        `/kayit-tamamlama/${studentId}?error=${encodeURIComponent(
          `Yönetici teyidi kaydedilemedi: ${consentError.message}`
        )}#onaylar`
      );
    }
  }

  const { data: checklist } = await supabase
    .from("registration_completion_checklists")
    .select("draft_data")
    .eq("organization_id", profile.organization_id)
    .eq("student_id", studentId)
    .maybeSingle();

  const draftData =
    checklist?.draft_data && typeof checklist.draft_data === "object"
      ? (checklist.draft_data as Record<string, unknown>)
      : {};

  const { error: checklistError } = await supabase
    .from("registration_completion_checklists")
    .upsert(
      {
        organization_id: profile.organization_id,
        student_id: studentId,
        health_declaration_received: true,
        rules_accepted: true,
        draft_data: {
          ...draftData,
          legacy_manager_confirmation: {
            status: "confirmed",
            confirmed_by: profile.id,
            confirmed_at: now,
          },
        },
        draft_saved_at: now,
        updated_by: profile.id,
        updated_at: now,
      },
      { onConflict: "student_id" }
    );

  if (checklistError) {
    redirect(
      `/kayit-tamamlama/${studentId}?error=${encodeURIComponent(
        `Yönetici teyidi kontrol kaydına işlenemedi: ${checklistError.message}`
      )}#onaylar`
    );
  }

  await supabase.from("student_activity_logs").insert({
    organization_id: profile.organization_id,
    student_id: studentId,
    activity_type: "legacy_transfer_manager_confirmed",
    title: "Aktarım için yönetici teyidi verildi",
    description: `${student.first_name} ${student.last_name} için eski sistem aktarımında eksik sağlık beyanı ve kural kabul kaydı yönetici tarafından idari olarak teyit edildi.`,
    new_value: {
      health_declaration_received: true,
      rules_accepted: true,
      confirmation_type: "manager_legacy_transfer_override",
    },
    source_type: "registration_completion_legacy_transfer",
    source_id: studentId,
    performed_by: profile.id,
    performed_at: now,
  });

  if (count > 0) {
    try {
      await addCompensation({
        organizationId: profile.organization_id,
        studentId,
        count,
        performedBy: profile.id,
      });
    } catch (error) {
      redirect(
        `/kayit-tamamlama/${studentId}?error=${encodeURIComponent(
          error instanceof Error ? error.message : "Yönetici teyidi verildi ancak telafi eklenemedi."
        )}#onaylar`
      );
    }
  }

  revalidatePath(`/kayit-tamamlama/${studentId}`);
  revalidatePath(`/ogrenciler/${studentId}`);

  /*
   * Yönetici teyidi elektronik ön kayıt eksikliğini kaldırır ve mevcut
   * kayıt formunu aynı işlemde kesin kayda gönderir. Kayıt planı veya
   * WhatsApp gibi diğer zorunluluklar eksikse mevcut completeRegistration
   * doğrulamaları kullanıcıya hangi alanın kaldığını açıkça bildirir.
   */
  formData.set("legacy_manager_confirmed", "on");

  if (!bool(formData, "whatsapp_opened") || !bool(formData, "message_sent")) {
    redirect(
      `/kayit-tamamlama/${studentId}?legacy_manager_confirmed=1&error=${encodeURIComponent(
        "Yönetici teyidi kaydedildi. Sağlık ve kurallar engeli kaldırıldı. Kaydı aktarmak için yalnızca mevcut WhatsApp gönderim teyidini tamamlayınız."
      )}#whatsapp`
    );
  }

  return completeRegistration(formData);
}
