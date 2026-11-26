"use client";
import { useEffect, useRef, useState } from "react";

type Sheet = { name: string; rows: (string | number | null | undefined)[][] };

function PdfDownload({ sheet, filename }: { sheet: Sheet; filename: string }) {
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const request = useRef<AbortController | null>(null);

  useEffect(() => () => request.current?.abort(), []);
  useEffect(() => {
    if (!file) return;
    const download = URL.createObjectURL(file);
    setUrl(download);
    return () => URL.revokeObjectURL(download);
  }, [file]);

  async function prepare() {
    if (request.current) return;
    const controller = new AbortController();
    request.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), 30_000);
    setBusy(true);
    setFile(null);
    setUrl("");
    setError("");
    try {
      const data = new FormData();
      data.set("report", JSON.stringify({ sheet, filename }));
      data.set("format", "pdf");
      const response = await fetch("/raporlar/yazdir", { method: "POST", body: data, signal: controller.signal });
      if (!response.ok || !response.headers.get("content-type")?.includes("application/pdf")) throw new Error("PDF response");
      const pdf = await response.blob();
      setFile(new File([pdf], `${filename}-${sheet.name}.pdf`, { type: "application/pdf" }));
    } catch {
      setError("PDF hazırlanamadı. Yeniden deneyin.");
    } finally {
      window.clearTimeout(timeout);
      request.current = null;
      setBusy(false);
    }
  }

  async function share(pdf: File) {
    try {
      await navigator.share({ files: [pdf], title: sheet.name });
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) setError("Paylaşım açılamadı. PDF’yi indirmeyi deneyin.");
    }
  }

  return <div className="reportPdfControls">
    <button type="button" onClick={prepare} disabled={busy}>{busy ? "PDF hazırlanıyor…" : "PDF hazırla"}</button>
    {file && url && <div className="reportPdfReady">
      <p role="status"><strong>{sheet.name}</strong> PDF dosyası hazır.</p>
      <div className="reportExportButtons">
        <a href={url} download={file.name}>PDF indir</a>
        {navigator.canShare?.({ files: [file] }) && <button type="button" onClick={() => void share(file)}>Paylaş / Dosyalara kaydet</button>}
      </div>
    </div>}
    {error && <span role="alert">{error}</span>}
  </div>;
}

export default function ReportExports({ sheets, filename, initialSelection }: {
  sheets: Sheet[];
  filename: string;
  initialSelection?: string;
}) {
  const [selected, setSelected] = useState(initialSelection);
  const sheet = sheets.find(item => item.name === selected) ?? sheets[0];

  function selectReport(name: string) {
    setSelected(name);
    const url = new URL(window.location.href);
    url.searchParams.set("reportType", name);
    window.history.replaceState(window.history.state, "", url);
  }

  function printSelected() {
    // A real same-origin document avoids blank popup printing on mobile browsers.
    const form = document.createElement("form");
    form.method = "POST";
    form.action = "/raporlar/yazdir";
    form.target = "_self";
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = "report";
    input.value = JSON.stringify({ sheet, filename });
    form.appendChild(input);
    const formatInput = document.createElement("input");
    formatInput.type = "hidden";
    formatInput.name = "format";
    formatInput.value = "html";
    form.appendChild(formatInput);
    const returnInput = document.createElement("input");
    returnInput.type = "hidden";
    returnInput.name = "returnTo";
    returnInput.value = window.location.pathname + window.location.search;
    form.appendChild(returnInput);
    document.body.appendChild(form);
    form.submit();
    form.remove();
  }
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  async function excel() {
    setBusy(true);setError("");
    try {
      const XLSX=await import("xlsx");
      const workbook=XLSX.utils.book_new();
      for(const sheet of sheets) {
        const rows=sheet.rows.map(row=>row.map(value=>typeof value === "number" && !Number.isFinite(value) ? null : value));
        const ws=XLSX.utils.aoa_to_sheet(rows);
        ws["!cols"]=rows[0]?.map((_,i)=>({wch:Math.min(65,Math.max(15,...rows.map(row=>String(row[i]??"").length)))}));
        XLSX.utils.book_append_sheet(workbook,ws,sheet.name);
      }
      XLSX.writeFile(workbook,`${filename}.xlsx`);
    } catch {setError("Excel hazırlanamadı. Lütfen yeniden deneyin.");}
    finally {setBusy(false);}
  }
  return <section className="reportExportBar" aria-labelledby="report-export-heading">
    <div><strong id="report-export-heading">Raporu dışa aktar</strong><span>PDF ve A4 önizleme seçili raporu içerir.</span></div>
    <label className="reportPrintChoice">Rapor türü
      <select name="reportType" form="report-filters" value={sheet.name} onChange={event => selectReport(event.target.value)}>
        {sheets.map(item => <option key={item.name} value={item.name}>{item.name}{item.name === "Yönetici özeti" ? "" : ` (${Math.max(0,item.rows.length-1)} satır)`}</option>)}
      </select>
    </label>
    <div className="reportExportButtons">
      <button type="button" onClick={printSelected}>A4 önizle</button>
      <button type="button" className="reportExcelButton" onClick={excel} disabled={busy}>{busy ? "Excel hazırlanıyor…" : "Tüm raporları Excel indir"}</button>
    </div>
    <PdfDownload key={sheet.name} sheet={sheet} filename={filename} />
    {error && <span role="alert">{error}</span>}
  </section>;
}
