import { NextRequest, NextResponse } from "next/server";
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

const LABELS: Record<string, string> = {
  payment_information: "Ödeme Bilgilendirmesi",
  registration_update: "Kayıt Güncelleme",
  renewal: "Kayıt Yenileme",
  portal_credentials: "Portal Giriş Bilgileri",
  compensation: "Telafi Bilgilendirmesi",
  schedule_change: "Program Değişikliği",
  welcome: "Hoş Geldiniz / Kayıt",
  information: "WhatsApp Bilgilendirmesi",
  bank_info: "Ödeme Bilgilendirmesi",
  whatsapp_information: "WhatsApp Bilgilendirmesi",
};

export async function GET(request: NextRequest) {
  const profile = await requireProfile([...ALLOWED_ROLES]);
  const organizationId = profile.organization_id;
  const studentId = String(request.nextUrl.searchParams.get("studentId") || "").trim();

  if (!organizationId || !studentId) {
    return NextResponse.json({ ok: false, message: "Öğrenci bilgisi eksik." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: student } = await supabase
    .from("students")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("id", studentId)
    .maybeSingle();

  if (!student) {
    return NextResponse.json({ ok: false, message: "Öğrenci bulunamadı." }, { status: 404 });
  }

  const [contactsResult, messagesResult, activityResult] = await Promise.all([
    supabase
      .from("student_contact_logs")
      .select("id,contact_type,channel,recipient_phone,message_text,status,prepared_at,sent_at,created_at")
      .eq("organization_id", organizationId)
      .eq("student_id", studentId)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("message_logs")
      .select("id,template_key,channel,recipient,subject,message_body,status,prepared_at,sent_at")
      .eq("organization_id", organizationId)
      .eq("student_id", studentId)
      .order("prepared_at", { ascending: false })
      .limit(100),
    supabase
      .from("student_activity_logs")
      .select("id,activity_type,title,description,new_value,performed_at")
      .eq("organization_id", organizationId)
      .eq("student_id", studentId)
      .in("activity_type", [
        "payment_information_sent",
        "registration_update_sent",
        "renewal_message_sent",
        "portal_credentials_sent",
        "compensation_message_sent",
        "schedule_change_message_sent",
        "welcome_message_sent",
        "whatsapp_message_sent",
      ])
      .order("performed_at", { ascending: false })
      .limit(100),
  ]);

  const contacts = contactsResult.data ?? [];
  const messages = messagesResult.data ?? [];
  const activities = activityResult.data ?? [];

  const merged = [
    ...contacts.map((row: any) => ({
      id: `contact-${row.id}`,
      rawId: row.id,
      type: row.contact_type || "information",
      title: LABELS[row.contact_type] || "WhatsApp Bilgilendirmesi",
      channel: row.channel || "whatsapp",
      recipient: row.recipient_phone || null,
      body: row.message_text || "Bilgilendirme gönderildi.",
      status: row.status || "sent",
      sentAt: row.sent_at || row.prepared_at || row.created_at,
      source: "contact",
    })),
    ...messages.map((row: any) => ({
      id: `message-${row.id}`,
      rawId: row.id,
      type: row.template_key || "information",
      title: row.subject || LABELS[row.template_key] || "WhatsApp Bilgilendirmesi",
      channel: row.channel || "whatsapp",
      recipient: row.recipient || null,
      body: row.message_body || "Bilgilendirme gönderildi.",
      status: row.status || "sent",
      sentAt: row.sent_at || row.prepared_at,
      source: "message",
    })),
  ];

  const seen = new Set<string>();
  const timeline = merged
    .filter((item: any) => item.sentAt)
    .sort((a: any, b: any) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime())
    .filter((item: any) => {
      const bodyKey = String(item.body || "").replace(/\s+/g, " ").trim().slice(0, 160);
      const timeBucket = Math.floor(new Date(item.sentAt).getTime() / 30000);
      const key = `${item.type}|${item.recipient || ""}|${bodyKey}|${timeBucket}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 60);

  const paymentNotices = activities
    .filter((row: any) => row.activity_type === "payment_information_sent")
    .map((row: any) => ({
      id: row.id,
      title: row.title || "Ödeme bilgilendirmesi gönderildi",
      description: row.description || "WhatsApp üzerinden ödeme bilgisi gönderildi.",
      sentAt: row.performed_at,
      recipient: row.new_value?.recipient || null,
    }));

  return NextResponse.json({
    ok: true,
    timeline,
    paymentNotices,
    count: timeline.length,
  });
}
