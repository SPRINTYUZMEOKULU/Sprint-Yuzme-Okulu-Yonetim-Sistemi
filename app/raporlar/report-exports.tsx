"use client";
import { useState } from "react";

type Sheet = { name: string; rows: (string | number | null | undefined)[][] };
export default function ReportExports({sheets,filename}:{sheets:Sheet[];filename:string}) {
  const [selected,setSelected]=useState("Yönetici özeti");
  const [pdfFile,setPdfFile]=useState<File | null>(null);
  const [pdfBusy,setPdfBusy]=useState(false);
  async function sharePdf() {
    if (!pdfFile) return;
    try {
      if (navigator.canShare?.({files:[pdfFile]})) await navigator.share({files:[pdfFile],title:"Sprint raporu"});
      else { const url=URL.createObjectURL(pdfFile); const a=document.createElement("a"); a.href=url; a.download=pdfFile.name; a.target="_blank"; a.rel="noopener"; a.click(); setTimeout(()=>URL.revokeObjectURL(url),60000); }
    } catch(e) { if (!(e instanceof DOMException && e.name === "AbortError")) setError("Paylaşım açılamadı. Paneli Safari’de açıp yeniden deneyin."); }
  }
  async function printSelected(format: "html" | "pdf" = "html") {
    setError("");
    const sheet=sheets.find(s=>s.name===selected);
    if(!sheet) return;
    if (format === "pdf") {
      setPdfBusy(true);setPdfFile(null);
      try {
        const data=new FormData(); data.set("report",JSON.stringify({sheet,filename})); data.set("format","pdf");
        const response=await fetch("/raporlar/yazdir",{method:"POST",body:data});
        if (!response.ok || !response.headers.get("content-type")?.includes("application/pdf")) throw new Error("PDF response");
        setPdfFile(new File([await response.blob()],`${filename}.pdf`,{type:"application/pdf"}));
      } catch {setError("PDF hazırlanamadı. Rapor ekranı açık kaldı; yeniden deneyin.");}
      finally {setPdfBusy(false);}
      return;
    }
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
    formatInput.value = format;
    form.appendChild(formatInput);
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
  return <div className="reportExportBar">
    <div><strong>Yönetici raporunu dışa aktar</strong><span>Önce rapor türünü seçin; yalnızca o bölüm çıktıya alınır.</span></div>
    <label className="reportPrintChoice">Çıktı türü<select value={selected} onChange={e=>setSelected(e.target.value)}>{sheets.map(s=><option key={s.name} value={s.name}>{s.name}{s.name === "Yönetici özeti" ? " (kısa özet)" : ` (${Math.max(0,s.rows.length-1)} satır)`}</option>)}</select></label>
    <div className="reportExportButtons"><button onClick={() => printSelected()}>A4 / PDF önizle</button><button disabled={pdfBusy} onClick={() => void printSelected("pdf")}>{pdfBusy ? "PDF hazırlanıyor…" : "PDF hazırla"}</button><button onClick={excel} disabled={busy}>{busy?"Excel hazırlanıyor…":"Excel indir (.xlsx)"}</button></div>
    <small>Özet varsayılan olarak açılır. Ayrıntılı ödeme, öğrenci ve eğitmen raporlarını ayrı ayrı yazdırabilirsiniz. Excel tüm raporları ayrı sekmelerde içerir.</small>
    {pdfFile && <div role="status"><strong>PDF hazır. Rapor ekranından çıkmadan kaydedebilirsiniz.</strong><button onClick={() => void sharePdf()}>PDF’yi paylaş / kaydet</button><button onClick={() => setPdfFile(null)}>Kapat / rapora dön</button></div>}
    {error && <span role="alert">{error}</span>}
  </div>;
}
