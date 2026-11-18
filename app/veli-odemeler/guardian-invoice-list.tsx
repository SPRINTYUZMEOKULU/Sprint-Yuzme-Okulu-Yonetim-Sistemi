import Link from "next/link";
import { documentAdmin } from "@/lib/payments/document-admin";
import { invoiceObject, invoicePrefix, issuedStatuses } from "@/lib/payments/guardian-invoices";

const labels: Record<string, string> = { e_invoice: "e-Fatura", e_archive: "e-Arşiv Fatura", e_smm: "e-Serbest Meslek Makbuzu" };

export default async function GuardianInvoiceList({ org, guardianId, studentId }: {
  org: string;
  guardianId: string;
  studentId: string;
}) {
  const { data, error } = await documentAdmin().from("payment_document_requests")
    .select("id,document_number,document_type,document_pdf_url")
    .eq("organization_id", org).eq("student_id", studentId).in("status", issuedStatuses)
    .not("payment_id", "is", null).like("document_pdf_url", `${invoicePrefix(guardianId, org)}%`)
    .order("created_at", { ascending: false });
  const rows = (data || []).filter(row => invoiceObject(row.document_pdf_url, org, row.id)?.recipient === guardianId);
  return <section className="guardianCard" id="faturalar" style={{marginTop:18,scrollMarginTop:110}}>
    <h2>Faturalar ve makbuzlar</h2>
    {error ? <p role="alert">Belgeler şu anda yüklenemedi.</p> : rows.length === 0 ? <p>Henüz paylaşılan belge yok.</p> :
      <div className="guardianTableWrap"><table className="guardianTable">
        <thead><tr><th>Belge</th><th>Numara</th><th>PDF işlemleri</th></tr></thead>
        <tbody>{rows.map(row => <tr key={row.id}>
          <td>{labels[row.document_type] || "Ödeme belgesi"}</td><td>{row.document_number || "—"}</td>
          <td><Link href={`/veli-odemeler/belge/${row.id}`} target="_blank" rel="noopener noreferrer" prefetch={false}>Görüntüle</Link>
            {" · "}<a href={`/veli-odemeler/belge/${row.id}?download=1`}>İndir</a></td>
        </tr>)}</tbody>
      </table></div>}
  </section>;
}
