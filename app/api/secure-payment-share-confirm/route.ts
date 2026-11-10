import { NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth/profile";
import { documentAdmin } from "@/lib/payments/document-admin";

const allowed = ["owner", "admin", "branch_manager", "registration_staff", "accounting"] as const;
const isUuid = (v: unknown) => typeof v === "string" &&
  /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(v);
const phone = (v: unknown) => {
  const raw = String(v || "").replace(/\D/g, "");
  if (raw.length === 12 && raw.startsWith("90")) return raw;
  if (raw.length === 11 && raw.startsWith("0")) return "90" + raw.slice(1);
  if (raw.length === 10) return "90" + raw;
  return "";
};

// A user-confirmed bookkeeping event, NEVER a WhatsApp delivery receipt.
export async function POST(request: Request) {
  const profile = await requireProfile([...allowed]);
  if (!profile.organization_id) return NextResponse.json({ message: "Kurum bulunamadı." }, { status: 403 });
  const body = await request.json().catch(() => null);
  const requestId = body?.requestId;
  const recipient = phone(body?.recipient);
  if (!isUuid(requestId) || !recipient)
    return NextResponse.json({ message: "Belge talebi veya alıcı telefonu geçersiz." }, { status: 400 });

  const db = documentAdmin();
  const { data: doc, error: docError } = await db.from("payment_document_requests")
    .select("id,student_id,public_token,status,expires_at")
    .eq("id", requestId)
    .eq("organization_id", profile.organization_id)
    .maybeSingle();
  if (docError || !doc || !["waiting_customer", "waiting_payment"].includes(doc.status))
    return NextResponse.json({ message: "Aktif belge talebi bulunamadı." }, { status: 404 });

  if (new Date(doc.expires_at).getTime() <= Date.now())
    return NextResponse.json({ message: "Güvenli ödeme bağlantısının süresi dolmuş." }, { status: 400 });

  // The recipient must belong to the same student's permitted contact sources.
  // A client-supplied phone is never sufficient for a delivery-history claim.
  const [{ data: student, error: studentError }, { data: links, error: linksError },
    { data: previousContacts, error: preError }] = await Promise.all([
      db.from("students").select("phone,guardian_phone")
        .eq("organization_id", profile.organization_id).eq("id", doc.student_id).maybeSingle(),
      db.from("guardian_students").select("guardian_id").eq("student_id", doc.student_id),
      db.from("pre_registrations").select("phone,whatsapp_phone")
        .eq("organization_id", profile.organization_id)
        .eq("converted_student_id", doc.student_id).limit(20),
    ]);
  if (studentError || linksError || preError || !student)
    return NextResponse.json({ message: "Kursiyer iletişim bilgileri kontrol edilemedi." }, { status: 500 });
  const guardianIds = (links || []).map(link => link.guardian_id).filter(Boolean);
  const { data: guardians, error: guardiansError } = guardianIds.length
    ? await db.from("guardians").select("phone,is_active")
        .eq("organization_id", profile.organization_id).in("id", guardianIds)
    : { data: [], error: null };
  if (guardiansError) return NextResponse.json({ message: "Veli iletişim kayıtları kontrol edilemedi." }, { status: 500 });
  const contacts = [
    student.phone, student.guardian_phone,
    ...(guardians || []).filter(g => g.is_active !== false).map(g => g.phone),
    ...(previousContacts || []).flatMap(p => [p.phone,p.whatsapp_phone]),
  ];
  if (!contacts.some(contact => phone(contact) === recipient))
    return NextResponse.json({ message: "Alıcı numarası kursiyerin kayıtlı iletişim kişileriyle eşleşmiyor." }, { status: 400 });

  // A short retry protection for the same request/recipient; does not falsely confirm a delivery.
  const { data: recent, error: recentError } = await db.from("message_logs")
    .select("id,sent_at")
    .eq("organization_id", profile.organization_id)
    .eq("student_id", doc.student_id)
    .eq("template_key", "secure_payment_link")
    .eq("recipient", recipient)
    .eq("status", "sent")
    .contains("metadata", { document_request_id: doc.id })
    .gte("sent_at", new Date(Date.now() - 5 * 60 * 1000).toISOString())
    .limit(1);
  if (recentError) return NextResponse.json({ message: "Gönderim geçmişi okunamadı." }, { status: 500 });
  if (recent?.length) return NextResponse.json({ ok: true, alreadyRecorded: true });

  const now = new Date().toISOString();
  const { error } = await db.from("message_logs").insert({
    organization_id: profile.organization_id,
    student_id: doc.student_id,
    template_key: "secure_payment_link",
    channel: "whatsapp",
    recipient,
    subject: "Güvenli ödeme bağlantısı · Personel gönderim beyanı",
    message_body: "Güvenli ödeme bağlantısı WhatsApp üzerinden personel tarafından gönderildi olarak işaretlendi.",
    status: "sent",
    prepared_by: profile.id,
    sent_by: profile.id,
    prepared_at: now,
    sent_at: now,
    metadata: {
      source: "secure_payment_document_flow",
      document_request_id: doc.id,
      delivery_confirmation: "manual_staff_confirmation_not_provider_receipt"
    }
  });
  if (error) return NextResponse.json({ message: "Gönderim geçmişi kaydedilemedi." }, { status: 500 });
  return NextResponse.json({ ok: true, sentAt: now });
}
