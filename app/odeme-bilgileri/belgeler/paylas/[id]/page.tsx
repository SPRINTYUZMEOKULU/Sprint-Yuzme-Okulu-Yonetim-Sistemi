import Link from "next/link";
import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth/profile";
import { documentAdmin } from "@/lib/payments/document-admin";
import { invoiceObject, invoiceRecipients, isInvoiceId } from "@/lib/payments/guardian-invoices";
import PublishForm from "./publish-form";
import "../../style.css";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const profile = await requireProfile(["owner", "admin", "accounting"]);
  const org = profile.organization_id;
  const { id } = await params;
  if (!org || !isInvoiceId(id)) notFound();
  const { data: row } = await documentAdmin().from("payment_document_requests")
    .select("student_id,payment_id,recipient_name,created_by,document_number,document_type,document_pdf_url,status")
    .eq("organization_id", org).eq("id", id).maybeSingle();
  if (!row?.payment_id || !["payment_received", "document_pending", "document_created", "document_sent"].includes(row.status)) notFound();
  const recipients = await invoiceRecipients(org, row.student_id);
  const existing = invoiceObject(row.document_pdf_url, org, id);
  return <main className="document-review">
    <header><Link href={`/odeme-bilgileri/belgeler?studentId=${row.student_id}`}>Belge takibine dön</Link>
      <h1>Ödeme belgesini paylaş</h1>
      <p>{row.recipient_name || "Ödeme belgesi"} · Yetkili veli hesabına PDF erişimi</p>
    </header>
    <section className="integration-notice">
      {existing ? <p>Belge paylaşıldı. <Link href={`/fatura-merkezi/belge/${id}/pdf`}>PDF’i görüntüle</Link></p>
        : <p>Düzenlenmiş e-Fatura, e-Arşiv veya e-SMM PDF’ini yükleyin. En fazla 3 MB.</p>}
      {!existing && !recipients.length && <p>Bu kursiyer için etkin bir veli paneli hesabı bulunamadı.</p>}
      <PublishForm id={id} existing={Boolean(existing)} recipients={recipients}
        preferredRecipient={recipients.some(item => item.id === row.created_by) ? row.created_by : ""}
        number={row.document_number || ""} type={row.document_type || ""}/>
    </section>
  </main>;
}
