import { NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth/profile";

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
    .filter((item) => item.recipient && item.message);

  if (!normalized.length) {
    return NextResponse.json({ ok: false, message: "Gönderilebilir alıcı veya mesaj bulunamadı." }, { status: 400 });
  }

  const results: Array<{
    studentId: string;
    recipient: string;
    ok: boolean;
    status?: number;
    error?: string;
  }> = [];

  for (const item of normalized) {
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

      results.push({
        studentId: item.studentId,
        recipient: item.recipient,
        ok: textResult.ok,
        status: textResult.status,
        error: textResult.ok ? undefined : String((textResult.data as any)?.error?.message || "Mesaj gönderilemedi."),
      });
    } catch (error) {
      results.push({
        studentId: item.studentId,
        recipient: item.recipient,
        ok: false,
        error: error instanceof Error ? error.message : "Beklenmeyen WhatsApp API hatası.",
      });
    }
  }

  const sent = results.filter((item) => item.ok).length;
  const failed = results.length - sent;
  const firstFailure = results.find((item) => !item.ok)?.error;

  return NextResponse.json({
    ok: sent > 0 && failed === 0,
    sent,
    failed,
    attempted: results.length,
    message:
      failed === 0
        ? `${sent} WhatsApp mesajı başarıyla gönderildi.`
        : `${sent} mesaj gönderildi, ${failed} mesaj başarısız.${firstFailure ? ` İlk hata: ${firstFailure}` : ""}`,
    results,
    templateKey: body?.templateKey || null,
    performedBy: profile.id,
  }, { status: sent > 0 ? 200 : 422 });
}
