import { NextRequest, NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth/profile";
import { documentAdmin, currentDocumentFinance } from "@/lib/payments/document-server";
import { UUID, parseAmount, isReceivedPayment, validDocumentUrl } from "@/lib/payments/document-rules";
const ROLES = ["owner", "admin", "branch_manager", "registration_staff", "accounting"] as const;
const json = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "private, no-store" } });
export async function GET(request: NextRequest) {
  const profile = await requireProfile([...ROLES]);
  const studentId = request.nextUrl.searchParams.get("studentId") || "";
  if (!profile.organization_id || !UUID.test(studentId)) return json({ message: "Kursiyer seçiniz." }, 400);
  try {
    const db = documentAdmin();
    const requestId = request.nextUrl.searchParams.get("requestId");
    if (requestId) {
      if (!UUID.test(requestId)) return json({ message: "Talep geçersiz." }, 400);
      const details = await db.from("payment_document_requests").select("recipient_type,recipient_name,tax_identity_number,tax_office,address,email,phone,customer_consent_at").eq("organization_id", profile.organization_id).eq("student_id", studentId).eq("id", requestId).maybeSingle();
      if (details.error || !details.data) return json({ message: "Belge bilgileri okunamadı." }, 404);
      return json({ recipient: details.data });
    }
    const [finance, requests, payments] = await Promise.all([
      currentDocumentFinance(profile.organization_id, studentId),
      db.from("payment_document_requests").select("id,enrollment_id,public_token,expected_amount,status,recipient_name,recipient_type,customer_completed_at,expires_at,payment_id,document_status,document_number,document_pdf_url,created_at,updated_at").eq("organization_id", profile.organization_id).eq("student_id", studentId).order("created_at", { ascending: false }).limit(30),
      db.from("student_payments").select("id,enrollment_id,amount,payment_method,payment_status,cancelled_at,received_at").eq("organization_id", profile.organization_id).eq("student_id", studentId).order("received_at", { ascending: false }).limit(100),
    ]);
    if (requests.error || payments.error) throw new Error("Ödeme talepleri okunamadı.");
    return json({ finance, requests: requests.data || [], payments: payments.data || [] });
  } catch (e) { return json({ message: e instanceof Error ? e.message : "Bilgiler yüklenemedi." }, 500); }
}
export async function POST(request: NextRequest) {
  const profile = await requireProfile([...ROLES]);
  const body = await request.json().catch(() => ({}));
  const studentId = String(body.studentId || "");
  if (!profile.organization_id || !UUID.test(studentId)) return json({ message: "Kursiyer seçiniz." }, 400);
  try {
    const finance = await currentDocumentFinance(profile.organization_id, studentId);
    if (!finance.enrollment || finance.remaining <= 0) return json({ message: "Aktif kayıt döneminde ödenecek paket borcu bulunmuyor." }, 409);
    const entered = parseAmount(body.expectedAmount);
    const expectedAmount = entered === null ? finance.remaining : entered;
    if (!Number.isFinite(expectedAmount) || expectedAmount <= 0 || expectedAmount > finance.remaining) return json({ message: "Tutar güncel kalan paket borcundan fazla olamaz." }, 400);
    // Double clicks and retries reuse a still-valid request for the same period and amount.
    const db = documentAdmin();
    const existing = await db.from("payment_document_requests").select("public_token,expires_at").eq("organization_id", profile.organization_id).eq("student_id", studentId).eq("enrollment_id", finance.enrollment.id).eq("expected_amount", expectedAmount).in("status", ["waiting_customer", "waiting_payment"]).gt("expires_at", new Date().toISOString()).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (existing.error) throw new Error("Ödeme bağlantıları okunamadı.");
    let row = existing.data;
    if (!row) {
      const result = await db.from("payment_document_requests").insert({ organization_id: profile.organization_id, student_id: studentId, enrollment_id: finance.enrollment.id, payment_method: "bank_transfer", expected_amount: expectedAmount, status: "waiting_customer", created_by: profile.id }).select("public_token,expires_at").single();
      if (result.error || !result.data) throw new Error("Güvenli ödeme bağlantısı oluşturulamadı.");
      row = result.data;
    }
    return json({ url: `${request.nextUrl.origin}/odeme-belge/${row.public_token}`, expiresAt: row.expires_at, expectedAmount });
  } catch (e) { return json({ message: e instanceof Error ? e.message : "Bağlantı oluşturulamadı." }, 500); }
}
export async function PATCH(request: NextRequest) {
  const profile = await requireProfile([...ROLES]);
  const body = await request.json().catch(() => ({}));
  if (!profile.organization_id || !UUID.test(String(body.requestId || ""))) return json({ message: "Talep bulunamadı." }, 400);
  try {
    const db = documentAdmin();
    const result = await db.from("payment_document_requests").select("id,student_id,enrollment_id,payment_id,status,customer_completed_at,expected_amount,updated_at,document_number,document_pdf_url").eq("organization_id", profile.organization_id).eq("id", body.requestId).maybeSingle();
    if (result.error || !result.data) return json({ message: "Talep bulunamadı." }, 404);
    const row = result.data;
    let patch: Record<string, unknown> = {};
    if (body.action === "cancel") {
      if (!["waiting_customer", "customer_completed", "waiting_payment"].includes(row.status) || row.payment_id) return json({ message: "Tahsilata veya belgeye bağlanan talep iptal edilemez." }, 409);
      patch = { status: "cancelled" };
    } else if (body.action === "match") {
      if (!row.customer_completed_at || row.status !== "waiting_payment" || !UUID.test(String(body.paymentId || ""))) return json({ message: "Önce müşteri belge bilgilerini tamamlamalıdır." }, 409);
      const payment = await db.from("student_payments").select("id,enrollment_id,amount,payment_status,cancelled_at,payment_method").eq("organization_id", profile.organization_id).eq("student_id", row.student_id).eq("id", body.paymentId).maybeSingle();
      const p = payment.data;
      if (payment.error || !p || !isReceivedPayment(p) || !["bank_transfer", "eft", "transfer"].includes(p.payment_method) || p.enrollment_id !== row.enrollment_id || Math.round(Number(p.amount) * 100) !== Math.round(Number(row.expected_amount) * 100)) return json({ message: "Aynı kayıt dönemine ait, tutarı eşit ve geçerli havale/EFT tahsilatı seçiniz." }, 409);
      patch = { payment_id: p.id, status: "document_pending", document_status: "document_pending" };
    } else if (body.action === "document") {
      if (!row.payment_id || !["document_pending", "payment_received"].includes(row.status)) return json({ message: "Önce tahsilatı eşleştiriniz." }, 409);
      const payment = await db.from("student_payments").select("payment_status,cancelled_at").eq("organization_id", profile.organization_id).eq("id", row.payment_id).maybeSingle();
      if (payment.error || !payment.data || !isReceivedPayment(payment.data)) return json({ message: "Bağlı tahsilat geçerli değil; muhasebe kontrolü gerekiyor." }, 409);
      const number = String(body.documentNumber || "").trim().slice(0, 100);
      const url = String(body.documentUrl || "").trim();
      if (!number || !validDocumentUrl(url) || url.length > 2000) return json({ message: "Gerçek belge numarasını ve HTTPS belge bağlantısını giriniz." }, 400);
      patch = { document_number: number, document_pdf_url: url, status: "document_created", document_status: "document_created", document_provider: "manual" };
    } else return json({ message: "Geçersiz işlem." }, 400);
    const update = await db.from("payment_document_requests").update({ ...patch, updated_at: new Date().toISOString() }).eq("organization_id", profile.organization_id).eq("id", row.id).eq("status", row.status).eq("updated_at", row.updated_at).select("id").maybeSingle();
    if (update.error) return json({ message: update.error.code === "23505" ? "Bu tahsilat başka bir belge talebine bağlı." : "İşlem kaydedilemedi." }, 409);
    if (!update.data) return json({ message: "Talep başka bir işlemle değişti; yenileyip tekrar deneyiniz." }, 409);
    return json({ ok: true, message: "Talep güncellendi. Mevcut tahsilat kaydı korundu." });
  } catch { return json({ message: "İşlem tamamlanamadı." }, 500); }
}
