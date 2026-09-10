import { NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";

const ALLOWED_ROLES = [
  "owner",
  "admin",
  "branch_manager",
  "registration_staff",
  "accounting",
  "coach",
] as const;

function cleanPhone(value?: string | null) {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("90")) return digits;
  if (digits.startsWith("0")) return `90${digits.slice(1)}`;
  if (digits.length === 10) return `90${digits}`;
  return digits;
}

function classify(message: string, sourcePath: string) {
  const haystack = `${message} ${sourcePath}`.toLocaleLowerCase("tr-TR");

  if (/iban|ödeme|odeme|banka|qr/.test(haystack)) {
    return {
      contactType: "payment_information",
      templateKey: "payment_information",
      activityType: "payment_information_sent",
      title: "Ödeme bilgilendirmesi gönderildi",
    };
  }

  if (/şifre|sifre|portal|giriş bilg|giris bilg/.test(haystack)) {
    return {
      contactType: "portal_credentials",
      templateKey: "portal_credentials",
      activityType: "portal_credentials_sent",
      title: "Portal giriş bilgileri gönderildi",
    };
  }

  if (/yenile|yenileme/.test(haystack)) {
    return {
      contactType: "renewal",
      templateKey: "renewal",
      activityType: "renewal_message_sent",
      title: "Kayıt yenileme bilgilendirmesi gönderildi",
    };
  }

  if (/güncell|duzelt|düzelt|değişiklik|degisiklik/.test(haystack)) {
    return {
      contactType: "registration_update",
      templateKey: "registration_update",
      activityType: "registration_update_sent",
      title: "Kayıt güncelleme bilgilendirmesi gönderildi",
    };
  }

  if (/telafi/.test(haystack)) {
    return {
      contactType: "compensation",
      templateKey: "compensation",
      activityType: "compensation_message_sent",
      title: "Telafi bilgilendirmesi gönderildi",
    };
  }

  if (/seans|saat değiş|saat degis|grup değiş|grup degis|şube değiş|sube degis/.test(haystack)) {
    return {
      contactType: "schedule_change",
      templateKey: "schedule_change",
      activityType: "schedule_change_message_sent",
      title: "Program değişikliği bilgilendirmesi gönderildi",
    };
  }

  if (/hoş geld|hos geld|kaydınız tamam|kaydiniz tamam/.test(haystack)) {
    return {
      contactType: "welcome",
      templateKey: "welcome",
      activityType: "welcome_message_sent",
      title: "Hoş geldiniz / kayıt bilgilendirmesi gönderildi",
    };
  }

  return {
    contactType: "information",
    templateKey: "whatsapp_information",
    activityType: "whatsapp_message_sent",
    title: "WhatsApp bilgilendirmesi gönderildi",
  };
}

export async function POST(request: Request) {
  const profile = await requireProfile([...ALLOWED_ROLES]);
  const organizationId = profile.organization_id;

  if (!organizationId) {
    return NextResponse.json({ ok: false, message: "Organizasyon bulunamadı." }, { status: 400 });
  }

  const body = (await request.json().catch(() => null)) as {
    studentId?: string | null;
    recipient?: string | null;
    message?: string | null;
    sourcePath?: string | null;
  } | null;

  const suppliedStudentId = String(body?.studentId || "").trim();
  const recipient = cleanPhone(body?.recipient);
  const message = String(body?.message || "").trim();
  const sourcePath = String(body?.sourcePath || "").trim();

  if (!message) {
    return NextResponse.json({ ok: true, skipped: true, reason: "empty_message" });
  }

  const supabase = await createClient();
  let studentId = suppliedStudentId;

  if (studentId) {
    const { data } = await supabase
      .from("students")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("id", studentId)
      .maybeSingle();
    if (!data) studentId = "";
  }

  if (!studentId && recipient) {
    const local = recipient.startsWith("90") ? `0${recipient.slice(2)}` : recipient;
    const { data } = await supabase
      .from("students")
      .select("id")
      .eq("organization_id", organizationId)
      .or(`phone.eq.${recipient},phone.eq.${local},guardian_phone.eq.${recipient},guardian_phone.eq.${local}`)
      .limit(1)
      .maybeSingle();
    studentId = data?.id || "";
  }

  if (!studentId) {
    return NextResponse.json({ ok: true, skipped: true, reason: "student_not_resolved" });
  }

  const sentAt = new Date().toISOString();
  const recentCutoff = new Date(Date.now() - 20_000).toISOString();

  const { data: duplicate } = await supabase
    .from("message_logs")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("student_id", studentId)
    .eq("channel", "whatsapp")
    .eq("message_body", message)
    .gte("sent_at", recentCutoff)
    .limit(1)
    .maybeSingle();

  if (duplicate) {
    return NextResponse.json({ ok: true, duplicate: true, studentId });
  }

  const kind = classify(message, sourcePath);
  const metadata = {
    source: "global_whatsapp_capture",
    source_path: sourcePath || null,
    delivery_confirmation: "whatsapp_opened",
  };

  const [messageLog, contactLog, activityLog] = await Promise.all([
    supabase.from("message_logs").insert({
      organization_id: organizationId,
      student_id: studentId,
      template_key: kind.templateKey,
      channel: "whatsapp",
      recipient: recipient || null,
      subject: kind.title,
      message_body: message,
      status: "sent",
      prepared_by: profile.id,
      sent_by: profile.id,
      prepared_at: sentAt,
      sent_at: sentAt,
      metadata,
    }),
    supabase.from("student_contact_logs").insert({
      organization_id: organizationId,
      student_id: studentId,
      contact_type: kind.contactType,
      channel: "whatsapp",
      recipient_phone: recipient || null,
      message_text: message,
      status: "sent",
      handled_by: profile.id,
      prepared_at: sentAt,
      sent_at: sentAt,
      confirmed_at: sentAt,
    }),
    supabase.from("student_activity_logs").insert({
      organization_id: organizationId,
      student_id: studentId,
      activity_type: kind.activityType,
      title: kind.title,
      description: `WhatsApp üzerinden bilgilendirme gönderildi.${recipient ? ` Alıcı: ${recipient}` : ""}`,
      new_value: {
        channel: "whatsapp",
        template_key: kind.templateKey,
        recipient: recipient || null,
        sent_at: sentAt,
        source_path: sourcePath || null,
      },
      source_type: "whatsapp",
      source_id: studentId,
      performed_by: profile.id,
      performed_at: sentAt,
    }),
  ]);

  const error = messageLog.error || contactLog.error || activityLog.error;
  if (error) {
    return NextResponse.json(
      { ok: false, message: `WhatsApp geçmişi kaydedilemedi: ${error.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, studentId, sentAt, type: kind.contactType });
}
