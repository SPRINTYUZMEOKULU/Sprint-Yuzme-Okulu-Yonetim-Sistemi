"use server";

import { requireProfile } from "@/lib/auth/profile";
import { documentAdmin } from "@/lib/payments/document-admin";
import { hasDocumentDetails, isReceivedBankPayment } from "@/lib/payments/document-state";
import { revalidatePath } from "next/cache";

export async function matchDocumentPayment(requestId: string, paymentId: string) {
  const profile = await requireProfile(["owner", "admin"]);
  if (!profile.organization_id) return { ok: false, message: "Kurum bilgisi bulunamadı." };
  const db = documentAdmin();
  const [{ data: row, error: requestError }, { data: payment, error: paymentError }] = await Promise.all([
    db.from("payment_document_requests").select("id,student_id,enrollment_id,status,payment_id,expected_amount,recipient_type,recipient_name,tax_identity_number,tax_office,address,customer_consent_at,customer_completed_at,document_status,provider_document_id,document_number").eq("organization_id", profile.organization_id).eq("id", requestId).maybeSingle(),
    db.from("student_payments").select("id,student_id,enrollment_id,payment_method,payment_status,amount,currency,cancelled_at").eq("organization_id", profile.organization_id).eq("id", paymentId).maybeSingle(),
  ]);
  if (requestError || paymentError || !row || !payment) return { ok: false, message: "Talep veya ödeme kaydı bulunamadı." };
  if (row.status !== "waiting_payment" || row.payment_id || row.provider_document_id || row.document_number || row.document_status !== "not_created") return { ok: false, message: "Talep işleme alınmış. Sayfayı yenileyiniz." };
  if (!hasDocumentDetails(row)) return { ok: false, message: "Müşterinin belge bilgileri eksik." };
  if (row.student_id !== payment.student_id || (row.enrollment_id && row.enrollment_id !== payment.enrollment_id) || !isReceivedBankPayment(payment)) return { ok: false, message: "Aynı kursiyer ve döneme ait, alınmış bir havale/EFT ödemesi seçiniz." };
  if (row.expected_amount != null && Math.round(Number(row.expected_amount) * 100) !== Math.round(Number(payment.amount) * 100)) return { ok: false, message: "Talep ve ödeme tutarları farklı. Önce ödeme kaydını kontrol ediniz." };
  // No payment/cash row is created here. Existing payment_id uniqueness prevents reuse.
  // This is an association only: no invoice is approved or sent to a provider.
  const { data: saved, error } = await db.from("payment_document_requests").update({ payment_id: payment.id, status: "payment_received", updated_at: new Date().toISOString() }).eq("organization_id", profile.organization_id).eq("id", row.id).eq("status", "waiting_payment").eq("document_status", "not_created").is("payment_id", null).is("provider_document_id", null).is("document_number", null).select("id").maybeSingle();
  if (error || !saved) return { ok: false, message: error?.code === "23505" ? "Bu ödeme başka bir belge talebiyle eşleştirilmiş." : "Eşleştirme kaydedilemedi veya talep değişti. Sayfayı yenileyiniz." };
  revalidatePath("/odeme-bilgileri/belgeler");
  revalidatePath(`/ogrenciler/${row.student_id}`);
  return { ok: true, message: "Ödeme eşleştirildi. Fatura kesilmedi; entegrasyon testi ve yönetici fatura onayı bekleniyor." };
}
