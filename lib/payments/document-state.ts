// A public payment link may collect details once. It must never reopen a paid invoice.
export function publicDocumentState(status: string, expiresAt: string, now = Date.now()) {
  if (status === "cancelled") return "cancelled";
  const expires = Date.parse(expiresAt);
  if (!Number.isFinite(expires) || expires <= now) return "expired";
  if (status === "waiting_customer") return "form";
  if (["customer_completed", "waiting_payment"].includes(status)) return "bank";
  if (["payment_received", "document_pending"].includes(status)) return "received";
  if (["document_created", "document_sent"].includes(status)) return "document";
  return "review";
}

export type DocumentDetails = {
  recipient_type: string | null;
  recipient_name: string | null;
  tax_identity_number: string | null;
  tax_office: string | null;
  address: string | null;
  customer_consent_at: string | null;
  customer_completed_at: string | null;
};

export function hasDocumentDetails(row: DocumentDetails) {
  return Boolean(row.recipient_name?.trim() && row.address?.trim() && row.customer_consent_at && row.customer_completed_at && (
    (row.recipient_type === "individual" && /^\d{11}$/.test(row.tax_identity_number || "")) ||
    (row.recipient_type === "company" && /^\d{10}$/.test(row.tax_identity_number || "") && row.tax_office?.trim())
  ));
}

export function isReceivedBankPayment(payment: { payment_method: string; payment_status: string; cancelled_at: string | null; amount: number | string; currency: string }) {
  return ["bank_transfer", "eft"].includes(payment.payment_method) && payment.payment_status === "received" && !payment.cancelled_at && payment.currency === "TRY" && Number.isFinite(Number(payment.amount)) && Number(payment.amount) > 0;
}
