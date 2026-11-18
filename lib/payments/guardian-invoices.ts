import "server-only";
import { documentAdmin } from "./document-admin";

export const invoiceBucket = "guardian-invoice-pdfs";
export const maxInvoiceBytes = 3 * 1024 * 1024;
const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
export const isInvoiceId = (value: string) => uuid.test(value);
export const invoicePrefix = (profileId: string, org: string) => `guardian-pdf:${profileId}/${org}/`;
export const issuedStatuses = ["document_created", "document_sent"];

export function invoiceObject(reference: unknown, org: string, requestId: string) {
  if (typeof reference !== "string" || !reference.startsWith("guardian-pdf:")) return null;
  const path = reference.slice("guardian-pdf:".length);
  const [recipient, organization, id, file, extra] = path.split("/");
  if (extra !== undefined || !isInvoiceId(recipient) || organization !== org || id !== requestId ||
      !file?.endsWith(".pdf") || !isInvoiceId(file.slice(0, -4))) return null;
  return { recipient, path };
}

export async function invoiceRecipients(org: string, studentId: string) {
  const db = documentAdmin();
  const [student, links] = await Promise.all([
    db.from("students").select("id").eq("id", studentId).eq("organization_id", org)
      .eq("status", "active").eq("is_deleted", false).maybeSingle(),
    db.from("guardian_students").select("guardian_id").eq("student_id", studentId).eq("portal_access", true),
  ]);
  if (student.error || links.error) throw new Error("Veli bağlantısı doğrulanamadı.");
  if (!student.data || !links.data.length) return [];
  const { data: guardians, error } = await db.from("guardians").select("auth_user_id")
    .eq("organization_id", org).eq("is_active", true).eq("login_enabled", true)
    .in("id", links.data.map(row => row.guardian_id));
  if (error) throw new Error("Veli bağlantısı doğrulanamadı.");
  const ids = (guardians || []).map(row => row.auth_user_id).filter(Boolean);
  if (!ids.length) return [];
  const profiles = await db.from("profiles").select("id,full_name")
    .eq("organization_id", org).eq("role", "guardian").eq("is_active", true).in("id", ids);
  if (profiles.error) throw new Error("Veli hesabı doğrulanamadı.");
  return profiles.data;
}

export async function invoicePdfResponse(path: string, download: boolean) {
  const { data, error } = await documentAdmin().storage.from(invoiceBucket).download(path);
  if (error || !data) return new Response("Belge şu anda açılamıyor.", { status: 404 });
  return new Response(data, { headers: {
    "Content-Type": "application/pdf",
    "Content-Disposition": `${download ? "attachment" : "inline"}; filename="Sprint-fatura.pdf"`,
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'",
    "Referrer-Policy": "no-referrer",
  } });
}
