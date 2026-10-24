"use client";
import { useState } from "react";

type Sheet = { name: string; rows: (string | number | null | undefined)[][] };
export default function ReportExports({sheets,filename}:{sheets:Sheet[];filename:string}) {
  const [selected,setSelected]=useState("Yönetici özeti");
  function printSelected(format: "html" | "pdf" = "html") {
    setError("");
    const sheet=sheets.find(s=>s.name===selected);
    if(!sheet) return;
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
    <div className="reportExportButtons"><button onClick={() => printSelected()}>A4 / PDF önizle</button><button onClick={() => printSelected("pdf")}>PDF indir</button><button onClick={excel} disabled={busy}>{busy?"Excel hazırlanıyor…":"Excel indir (.xlsx)"}</button></div>
    <small>Özet varsayılan olarak açılır. Ayrıntılı ödeme, öğrenci ve eğitmen raporlarını ayrı ayrı yazdırabilirsiniz. Excel tüm raporları ayrı sekmelerde içerir.</small>
    {error && <span role="alert">{error}</span>}
  </div>;
}
