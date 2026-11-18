"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth/profile";
import { createNotification } from "@/lib/notifications/create-notification";
import { documentAdmin } from "@/lib/payments/document-admin";
import { invoiceBucket, invoiceObject, invoicePrefix, invoiceRecipients, isInvoiceId, maxInvoiceBytes } from "@/lib/payments/guardian-invoices";
import { isReceivedBankPayment } from "@/lib/payments/document-state";

export async function publishGuardianInvoice(id: string, _previous: string, form: FormData) {
  const profile = await requireProfile(["owner", "admin", "accounting"]);
  const org = profile.organization_id;
  if (!org || !isInvoiceId(id)) return "Belge bulunamadı.";
  const db = documentAdmin();
  const { data: row, error } = await db.from("payment_document_requests")
    .select("id,student_id,payment_id,status,document_pdf_url")
    .eq("organization_id", org).eq("id", id).maybeSingle();
  if (error || !row?.payment_id || !["payment_received", "document_pending", "document_created", "document_sent"].includes(row.status)) {
    return "Önce geçerli tahsilatı belge talebiyle eşleştirin.";
  }
  const { data: payment } = await db.from("student_payments")
    .select("payment_method,payment_status,cancelled_at,amount,currency")
    .eq("organization_id", org).eq("student_id", row.student_id).eq("id", row.payment_id).maybeSingle();
  if (!payment || !isReceivedBankPayment(payment)) return "Eşleştirilen tahsilat doğrulanamadı.";

  const existing = invoiceObject(row.document_pdf_url, org, id);
  const recipient = existing?.recipient ?? String(form.get("recipient") || "");
  const recipients = await invoiceRecipients(org, row.student_id).catch(() => null);
  if (!recipients?.some(item => item.id === recipient)) return "Fatura alıcısının aktif veli hesabını doğrulayın.";

  if (!existing) {
    const number = String(form.get("document_number") || "").trim();
    const type = String(form.get("document_type") || "");
    const file = form.get("pdf");
    if (!number || number.length > 80 || !["e_invoice", "e_archive", "e_smm"].includes(type)) return "Düzenlenen belgenin numarasını ve türünü girin.";
    if (form.get("verified") !== "on") return "PDF ile alıcının eşleştiğini onaylayın.";
    if (!(file instanceof File) || file.size < 8 || file.size > maxInvoiceBytes ||
        await file.slice(0, 5).text() !== "%PDF-") return "En fazla 3 MB boyutunda geçerli bir PDF seçin.";

    let bucket = await db.storage.getBucket(invoiceBucket);
    if (bucket.error && bucket.error.message.toLowerCase().includes("not found")) {
      await db.storage.createBucket(invoiceBucket, { public: false, fileSizeLimit: maxInvoiceBytes, allowedMimeTypes: ["application/pdf"] });
      bucket = await db.storage.getBucket(invoiceBucket);
    }
    if (bucket.error || bucket.data.public) return "Özel PDF alanı doğrulanamadı.";

    const reference = `${invoicePrefix(recipient, org)}${id}/${randomUUID()}.pdf`;
    const object = invoiceObject(reference, org, id)!;
    const storage = db.storage.from(invoiceBucket);
    const upload = await storage.upload(object.path, file, { contentType: "application/pdf", upsert: false });
    if (upload.error) return "PDF yüklenemedi. Tekrar deneyin.";

    const update = db.from("payment_document_requests").update({
      document_pdf_url: reference, document_number: number, document_type: type, status: "document_sent",
      document_status: "document_sent", updated_at: new Date().toISOString(),
    }).eq("organization_id", org).eq("id", id).eq("payment_id", row.payment_id).eq("status", row.status);
    const saved = await (row.document_pdf_url ? update.eq("document_pdf_url", row.document_pdf_url) : update.is("document_pdf_url", null))
      .select("id").maybeSingle();
    if (saved.error || !saved.data) {
      // A transport error may follow a committed write; do not remove a file in that case.
      if (!saved.error) await storage.remove([object.path]);
      return "Belge kaydı doğrulanamadı. Sayfayı yenileyip belge durumunu kontrol edin.";
    }
  }

  const notice = await createNotification({
    organizationId: org, category: "payment", eventKey: "guardian_invoice_ready",
    title: "Ödeme belgeniz hazır", body: "Belgenizi Ödemeler bölümünden görüntüleyebilir ve indirebilirsiniz.",
    studentId: row.student_id, sourceType: "payment_document_request", sourceId: id,
    targetPath: `/veli-odemeler?child=${row.student_id}#faturalar`, recipientProfileIds: [recipient],
    createdBy: profile.id, severity: "success", push: true, dedupeKey: `guardian-invoice:${id}`,
  }).catch(() => null);

  revalidatePath("/veli-odemeler");
  revalidatePath("/fatura-merkezi");
  revalidatePath("/odeme-bilgileri/belgeler");
  revalidatePath(`/odeme-bilgileri/belgeler/paylas/${id}`);
  return notice?.ok ? "Belge veli panelinde erişime açıldı. Bildirim kaydı hazır."
    : "Belge veli panelinde erişime açıldı. Bildirim oluşmadı. Bildirimi yeniden deneyebilirsiniz.";
}
