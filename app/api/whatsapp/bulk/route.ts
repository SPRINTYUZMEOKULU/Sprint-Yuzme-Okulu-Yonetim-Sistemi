import { NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";

const ALLOWED_ROLES = ["owner","admin","branch_manager","registration_staff"] as const;
const MAX_RECIPIENTS = 200;

type BulkMessage = {
  studentId?: string;
  recipient?: string;
  message?: string;
};

function cleanPhone(value?: string | null) {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("90")) return digits;
  if (digits.startsWith("0")) return `90${digits.slice(1)}`;
  if (digits.length === 10) return `90${digits}`;
  return digits;
}

function getMessageTitle(templateKey?: string | null) {
  const key = String(templateKey || "general").toLocaleLowerCase("tr-TR");
  if (key.includes("payment") || key.includes("odeme") || key.includes("bank") || key.includes("iban")) return "Ödeme bilgilendirmesi gönderildi";
  if (key.includes("renew") || key.includes("yenile")) return "Kayıt yenileme mesajı gönderildi";
  if (key.includes("welcome") || key.includes("hosgeld")) return "Hoş geldiniz mesajı gönderildi";
  if (key.includes("password") || key.includes("portal") || key.includes("sifre")) return "Portal giriş bilgileri gönderildi";
  if (key.includes("compensation") || key.includes("telafi")) return "Telafi bilgilendirmesi gönderildi";
  if (key.includes("schedule") || key.includes("seans") || key.includes("program")) return "Program bilgilendirmesi gönderildi";
  if (key.includes("branch") || key.includes("sube") || key.includes("group") || key.includes("grup")) return "Grup / şube bilgilendirmesi gönderildi";
  return "Akıllı mesaj gönderildi";
}

async function graphSend(options: {
  phoneNumberId: string;
  token: string;
  graphVersion: string;
  recipient: string;
  payload: Record<string, unknown>;
}) {
  const response = await fetch(
    `https://graph.facebook.com/${options.graphVersion}/${options.phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${options.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: options.recipient,
        ...options.payload,
      }),
      cache: "no-store",
    },
  );

  const data = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, data };
}

export async function POST(request: Request) {
  const profile = await requireProfile([...ALLOWED_ROLES]);
  const organizationId = profile.organization_id;
  if (!organizationId) {
    return NextResponse.json({ ok:false, message:"Organizasyon bilgisi bulunamadı." }, { status:400 });
  }

  const token = process.env.WHATSAPP_ACCESS_TOKEN?.trim();
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();
  const graphVersion = process.env.WHATSAPP_GRAPH_VERSION?.trim() || "v23.0";

  if (!token || !phoneNumberId) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "WhatsApp Business Cloud API henüz yapılandırılmamış. WHATSAPP_ACCESS_TOKEN ve WHATSAPP_PHONE_NUMBER_ID ortam değişkenlerini ekleyin.",
      },
      { status: 503 },
    );
  }

  const body = await request.json().catch(() => null) as {
    messages?: BulkMessage[];
    templateKey?: string;
    mediaUrl?: string | null;
  } | null;

  const templateKey = String(body?.templateKey || "general");
  const messageTitle = getMessageTitle(templateKey);
  const messages = Array.isArray(body?.messages) ? body!.messages!.slice(0, MAX_RECIPIENTS) : [];
  const mediaUrl = typeof body?.mediaUrl === "string" && /^https:\/\//i.test(body.mediaUrl.trim())
    ? body.mediaUrl.trim()
    : null;

  const normalized = messages
    .map((item) => ({
      studentId: String(item.studentId || ""),
      recipient: cleanPhone(item.recipient),
      message: String(item.message || "").trim(),
    }))
    .filter((item) => item.studentId && item.recipient && item.message);

  if (!normalized.length) {
    return NextResponse.json({ ok: false, message: "Gönderilebilir alıcı veya mesaj bulunamadı." }, { status: 400 });
  }

  const supabase = await createClient();
  const studentIds = Array.from(new Set(normalized.map(item=>item.studentId)));
  const { data: students, error: studentsError } = await supabase
    .from("students")
    .select("id,phone,guardian_phone,status")
    .eq("organization_id", organizationId)
    .in("id", studentIds);

  if (studentsError) {
    return NextResponse.json({ ok:false, message:`Alıcı doğrulaması yapılamadı: ${studentsError.message}` }, { status:500 });
  }

  const studentMap = new Map((students || []).map((student:any)=>[student.id, student]));
  const verified = normalized.filter(item=>{
    const student:any = studentMap.get(item.studentId);
    if (!student || student.status !== "active") return false;
    const allowed = new Set([cleanPhone(student.guardian_phone), cleanPhone(student.phone)].filter(Boolean));
    return allowed.has(item.recipient);
  });

  if (!verified.length) {
    return NextResponse.json({ ok:false, message:"Seçili alıcıların telefon numaraları kursiyer kayıtlarıyla doğrulanamadı." }, { status:400 });
  }

  const rejectedCount = normalized.length - verified.length;
  const results: Array<{
    studentId: string;
    recipient: string;
    ok: boolean;
    status?: number;
    providerMessageId?: string | null;
    error?: string;
  }> = [];

  for (const item of verified) {
    try {
      if (mediaUrl) {
        const mediaResult = await graphSend({
          phoneNumberId,
          token,
          graphVersion,
          recipient: item.recipient,
          payload: {
            type: "image",
            image: { link: mediaUrl },
          },
        });

        if (!mediaResult.ok) {
          results.push({
            studentId: item.studentId,
            recipient: item.recipient,
            ok: false,
            status: mediaResult.status,
            error: String((mediaResult.data as any)?.error?.message || "Görsel gönderilemedi."),
          });
          continue;
        }
      }

      const textResult = await graphSend({
        phoneNumberId,
        token,
        graphVersion,
        recipient: item.recipient,
        payload: {
          type: "text",
          text: { preview_url: true, body: item.message },
        },
      });

      const providerMessageId = (textResult.data as any)?.messages?.[0]?.id || null;
      const error = textResult.ok ? undefined : String((textResult.data as any)?.error?.message || "Mesaj gönderilemedi.");
      const sentAt = new Date().toISOString();

      results.push({
        studentId: item.studentId,
        recipient: item.recipient,
        ok: textResult.ok,
        status: textResult.status,
        providerMessageId,
        error,
      });

      const status = textResult.ok ? "sent" : "failed";
      const metadata = {
        source: "smart_ready_messages",
        provider: "meta_whatsapp_cloud_api",
        provider_message_id: providerMessageId,
        media_url: mediaUrl,
        http_status: textResult.status,
        error: error || null,
        template_key: templateKey,
      };

      await Promise.all([
        supabase.from("message_logs").insert({
          organization_id: organizationId,
          student_id: item.studentId,
          template_key: templateKey,
          channel: "whatsapp",
          recipient: item.recipient,
          subject: messageTitle,
          message_body: item.message,
          status,
          prepared_by: profile.id,
          sent_by: textResult.ok ? profile.id : null,
          prepared_at: sentAt,
          sent_at: textResult.ok ? sentAt : null,
          metadata,
        }),
        supabase.from("student_contact_logs").insert({
          organization_id: organizationId,
          student_id: item.studentId,
          contact_type: templateKey || "smart_message",
          channel: "whatsapp",
          recipient_phone: item.recipient,
          message_text: item.message,
          status,
          handled_by: profile.id,
          prepared_at: sentAt,
          sent_at: textResult.ok ? sentAt : null,
          confirmed_at: textResult.ok ? sentAt : null,
        }),
        supabase.from("student_activity_logs").insert({
          organization_id: organizationId,
          student_id: item.studentId,
          activity_type: textResult.ok ? "smart_message_sent" : "smart_message_failed",
          title: textResult.ok ? messageTitle : "Akıllı mesaj gönderilemedi",
          description: textResult.ok
            ? `WhatsApp üzerinden ${messageTitle.toLocaleLowerCase("tr-TR")}.`
            : `WhatsApp mesajı gönderilemedi${error ? `: ${error}` : "."}`,
          new_value: {
            channel: "whatsapp",
            template_key: templateKey,
            recipient: item.recipient,
            sent_at: textResult.ok ? sentAt : null,
            provider_message_id: providerMessageId,
            status,
          },
          source_type: "smart_ready_messages",
          source_id: providerMessageId || item.studentId,
          performed_by: profile.id,
          performed_at: sentAt,
        }),
      ]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Beklenmeyen WhatsApp API hatası.";
      const failedAt = new Date().toISOString();
      results.push({
        studentId: item.studentId,
        recipient: item.recipient,
        ok: false,
        error: message,
      });
      await Promise.all([
        supabase.from("message_logs").insert({
          organization_id: organizationId,
          student_id: item.studentId,
          template_key: templateKey,
          channel: "whatsapp",
          recipient: item.recipient,
          subject: "Akıllı mesaj gönderilemedi",
          message_body: item.message,
          status: "failed",
          prepared_by: profile.id,
          prepared_at: failedAt,
          metadata: { source:"smart_ready_messages", provider:"meta_whatsapp_cloud_api", media_url:mediaUrl, error:message },
        }),
        supabase.from("student_contact_logs").insert({
          organization_id: organizationId,
          student_id: item.studentId,
          contact_type: templateKey || "smart_message",
          channel: "whatsapp",
          recipient_phone: item.recipient,
          message_text: item.message,
          status: "failed",
          handled_by: profile.id,
          prepared_at: failedAt,
        }),
        supabase.from("student_activity_logs").insert({
          organization_id: organizationId,
          student_id: item.studentId,
          activity_type: "smart_message_failed",
          title: "Akıllı mesaj gönderilemedi",
          description: message,
          source_type: "smart_ready_messages",
          source_id: item.studentId,
          performed_by: profile.id,
          performed_at: failedAt,
        }),
      ]);
    }
  }

  const sent = results.filter((item) => item.ok).length;
  const failed = results.length - sent;
  const firstFailure = results.find((item) => !item.ok)?.error;

  return NextResponse.json({
    ok: sent > 0 && failed === 0 && rejectedCount === 0,
    sent,
    failed,
    rejected: rejectedCount,
    attempted: results.length,
    message:
      failed === 0 && rejectedCount === 0
        ? `${sent} WhatsApp mesajı başarıyla gönderildi.`
        : `${sent} mesaj gönderildi, ${failed} mesaj başarısız${rejectedCount ? `, ${rejectedCount} alıcı güvenlik doğrulamasından geçmedi` : ""}.${firstFailure ? ` İlk hata: ${firstFailure}` : ""}`,
    results,
    templateKey,
    performedBy: profile.id,
  }, { status: sent > 0 ? 200 : 422 });
}
