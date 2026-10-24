import { requireProfile } from "@/lib/auth/profile";
import { printReportHtml, type ReportSheet } from "../print-report";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  await requireProfile(["owner", "admin", "branch_manager"]);
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return new Response("Geçersiz rapor isteği.", { status: 403 });
  }
  const form = await request.formData();
  const payload = form.get("report");
  if (typeof payload !== "string" || payload.length > 3_000_000) {
    return new Response("Rapor çok büyük veya geçersiz. Rapor merkezinden daha dar bir kapsam seçin.", { status: 400 });
  }
  let report: { sheet: ReportSheet; filename: string };
  try {
    report = JSON.parse(payload);
    if (!report || typeof report.filename !== "string" || typeof report.sheet?.name !== "string" || !Array.isArray(report.sheet.rows)
      || !report.sheet.rows.every(row => Array.isArray(row) && row.every(value => value == null || typeof value === "string" || (typeof value === "number" && Number.isFinite(value))))) throw new Error("Invalid report");
  } catch {
    return new Response("Rapor okunamadı. Rapor merkezinden yeniden oluşturun.", { status: 400 });
  }
  if (form.get("format") === "pdf") {
    try {
      const { reportPdf } = await import("../report-pdf");
      const pdf = await reportPdf(report.sheet, report.filename);
      const safeFilename = `${report.filename}-${report.sheet.name}`.replace(/[^a-zA-Z0-9_-]/g, "_");
      return new Response(pdf, { headers: {
        "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${safeFilename}.pdf"`,
        "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff",
      } });
    } catch (error) {
      console.error("Rapor PDF oluşturulamadı", error instanceof Error ? error.message : "PDF error");
      return new Response("PDF oluşturulamadı. Geri dönüp yeniden deneyin.", { status: 500 });
    }
  }
  return new Response(printReportHtml(report.sheet, report.filename), {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" },
  });
}

export function GET(request: Request) {
  return Response.redirect(new URL("/raporlar", request.url), 303);
}
