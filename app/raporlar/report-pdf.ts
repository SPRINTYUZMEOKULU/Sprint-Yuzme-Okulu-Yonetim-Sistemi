import PdfPrinter from "pdfmake";
import fonts from "pdfmake/build/vfs_fonts";
import { formatDisplayDateTime } from "@/lib/dates/display";
import type { ReportSheet } from "./print-report";

export async function reportPdf(sheet: ReportSheet, filename: string): Promise<Uint8Array> {
  const printer = new PdfPrinter({ Roboto: {
    normal: Buffer.from(fonts["Roboto-Regular.ttf"], "base64"),
    bold: Buffer.from(fonts["Roboto-Medium.ttf"], "base64"),
    italics: Buffer.from(fonts["Roboto-Italic.ttf"], "base64"),
    bolditalics: Buffer.from(fonts["Roboto-MediumItalic.ttf"], "base64"),
  } });
  const summary = sheet.name === "Yönetici özeti";
  const columns = sheet.rows[0] || [];
  const money = (n: number) => new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(n);
  const value = (v: unknown, label: string) => typeof v === "number"
    ? /ücret|ödenen|kalan|tutar|tahsilat|taksit|borç/i.test(label) && !/ders|sayısı|adet/i.test(label) ? money(v) : String(v)
    : String(v ?? "—");
  const body = summary
    ? sheet.rows.map(row => [{ text: String(row[0]), bold: true, fillColor: "#edf3fb" }, row.slice(1).map(v => value(v, String(row[0]))).join(" · ")])
    : [columns.map(c => ({ text: String(c), bold: true, fillColor: "#eaf0fa" })), ...sheet.rows.slice(1).map(row => columns.map((c, i) => ({
        text: value(row[i], String(c)),
        color: /Süresi doldu|süresi dolmuş|Ödeme yapılmadı|Gecikmiş/.test(String(row[i])) ? "#a62020" : "#14243b",
      })))];
  if (!body.length) body.push(["Kayıt bulunamadı", ""] as never);
  const count = summary ? 2 : columns.length || 1;
  const weights = columns.map(c => /Yapılacak işlemler/.test(String(c)) ? 3 : /Öğrenci|Ek dönem/.test(String(c)) ? 1.8 : /Sıra/.test(String(c)) ? 0.5 : 1);
  const available = 841.89 - 48 - count * 7;
  const widths = summary ? [155, "*"] : count === 1 ? ["*"] : weights.map(w => available * w / weights.reduce((a, b) => a + b, 0));
  const doc = printer.createPdfKitDocument({
    pageSize: "A4", pageOrientation: summary ? "portrait" : "landscape", pageMargins: [24, 28, 24, 35],
    defaultStyle: { font: "Roboto", fontSize: summary ? 10 : 7, color: "#14243b" },
    info: { title: `${sheet.name} - ${filename}`, author: "Sprint Yüzme Okulu" },
    content: [
      { text: "SPRİNT YÜZME OKULU", bold: true, color: "#2457d6", fontSize: 12, margin: [0, 0, 0, 6] },
      { text: sheet.name, bold: true, fontSize: 20, margin: [0, 0, 0, 6] },
      { text: filename, fontSize: 9, margin: [0, 0, 0, 12] },
      { table: { headerRows: summary ? 0 : 1, widths, body }, layout: {
        hLineColor: () => "#d6dfeb", vLineColor: () => "#d6dfeb", hLineWidth: () => 0.5, vLineWidth: () => 0.5,
        paddingLeft: () => 3, paddingRight: () => 3, paddingTop: () => 5, paddingBottom: () => 5,
      } },
    ],
    footer: (page: number, pages: number) => ({ text: `${formatDisplayDateTime(new Date())} · ${page} / ${pages}`, alignment: "right", margin: [24, 8, 24, 0], fontSize: 8, color: "#526179" }),
  });
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on("data", chunk => chunks.push(chunk));
    doc.on("error", reject);
    doc.on("end", () => resolve(new Uint8Array(Buffer.concat(chunks))));
    doc.end();
  });
}
