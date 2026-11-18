import { requireProfile } from "@/lib/auth/profile";
import { guardianStudentAccess } from "@/lib/guardian/access";
import { documentAdmin } from "@/lib/payments/document-admin";
import { invoiceObject, invoicePdfResponse, isInvoiceId, issuedStatuses } from "@/lib/payments/guardian-invoices";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await requireProfile(["guardian"]);
  const org = profile.organization_id;
  const { id } = await params;
  const missing = () => new Response("Belge bulunamadı.", { status: 404, headers: { "Cache-Control": "private, no-store" } });
  if (!org || !isInvoiceId(id)) return missing();
  const db = documentAdmin();
  const scope = await guardianStudentAccess(db, profile.id, org);
  if (scope.error || !scope.studentIds.length) return missing();
  const { data, error } = await db.from("payment_document_requests")
    .select("document_pdf_url").eq("organization_id", org).eq("id", id)
    .in("student_id", scope.studentIds).in("status", issuedStatuses).not("payment_id", "is", null).maybeSingle();
  const object = invoiceObject(data?.document_pdf_url, org, id);
  if (error || object?.recipient !== profile.id) return missing();
  return invoicePdfResponse(object.path, new URL(request.url).searchParams.get("download") === "1");
}
