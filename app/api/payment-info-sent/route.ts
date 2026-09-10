import { NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";

const ALLOWED_ROLES = [
  "owner",
  "admin",
  "branch_manager",
  "registration_staff",
  "accounting",
] as const;

function cleanPhone(value?: string | null) {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("90")) return digits;
  if (digits.startsWith("0")) return `90${digits.slice(1)}`;
  if (digits.length === 10) return `90${digits}`;
  return digits;
}

export async function POST(request: Request) {
  const profile = await requireProfile([...ALLOWED_ROLES]);
  const organizationId = profile.organization_id;

  if (!organizationId) {
    return NextResponse.json(
      { ok: false, message: "Organizasyon bilgisi bulunamadı." },
      { status: 400 },
    );
  }

  const body = (await request.json().catch(() => null)) as {
    studentId?: string;
    recipient?: string;
    message?: string;
    method?: "whatsapp" | "qr_share";
  } | null;

  const studentId = String(body?.studentId || "").trim();
  const recipient = cleanPhone(body?.recipient);
  const message = String(body?.message || "").trim();
  const method = body?.method === "qr_share" ? "qr_share" : "whatsapp";

  if (!studentId || !message) {
    return NextResponse.json(
      { ok: false, message: "Kursiyer veya mesaj bilgisi eksik." },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const { data: student, error: studentError } = await supabase
    .from("students")
    .select("id,phone,guardian_phone")
    .eq("organization_id", organizationId)
    .eq("id", studentId)
    .maybeSingle();

  if (studentError || !student) {
    return NextResponse.json(
      { ok: false, message: "Kursiyer doğrulanamadı." },
      { status: 404 },
    );
  }

  if (recipient) {
    const allowed = new Set(
      [cleanPhone(student.phone), cleanPhone(student.guardian_phone)].filter(Boolean),
    );
    if (!allowed.has(recipient)) {
      return NextResponse.json(
        { ok: false, message: "WhatsApp numarası kursiyer kaydıyla eşleşmiyor." },
        { status: 400 },
      );
    }
  }

  const sentAt = new Date().toISOString();
  const subject =
    method === "qr_share"
      ? "Ödeme QR bilgisi paylaşıldı"
      : "IBAN / QR ödeme bilgilendirmesi gönderildi";

  const [messageLog, activityLog, contactLog] = await Promise.all([
    supabase.from("message_logs").insert({
      organization_id: organizationId,
      student_id: studentId,
      template_key: "bank_info",
      channel: "whatsapp",
      recipient: recipient || null,
      subject,
      message_body: message,
      status: "sent",
      prepared_by: profile.id,
      sent_by: profile.id,
      prepared_at: sentAt,
      sent_at: sentAt,
      metadata: {
        source: "payment_information_center",
        method,
        delivery_confirmation: "manual_whatsapp_workflow",
      },
    }),
    supabase.from("student_activity_logs").insert({
      organization_id: organizationId,
      student_id: studentId,
      activity_type: "payment_information_sent",
      title: "Ödeme bilgilendirmesi gönderildi",
      description:
        method === "qr_share"
          ? "Kursiyere ödeme QR bilgisi paylaşım ekranı üzerinden gönderildi."
          : "Kursiyere IBAN / QR ödeme bilgilendirmesi WhatsApp üzerinden gönderildi.",
      new_value: {
        channel: "whatsapp",
        template_key: "bank_info",
        method,
        recipient: recipient || null,
        sent_at: sentAt,
      },
      source_type: "payment_information",
      performed_by: profile.id,
      performed_at: sentAt,
    }),
    supabase.from("student_contact_logs").insert({
      organization_id: organizationId,
      student_id: studentId,
      contact_type: "payment_information",
      channel: "whatsapp",
      recipient_phone: recipient || null,
      message_text: message,
      status: "sent",
      handled_by: profile.id,
      prepared_at: sentAt,
      sent_at: sentAt,
      confirmed_at: sentAt,
    }),
  ]);

  const error = messageLog.error || activityLog.error || contactLog.error;
  if (error) {
    return NextResponse.json(
      { ok: false, message: `Gönderim kaydı oluşturulamadı: ${error.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, sentAt });
}
