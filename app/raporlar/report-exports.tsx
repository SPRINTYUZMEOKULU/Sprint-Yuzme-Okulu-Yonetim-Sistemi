"use client";
import { useState } from "react";

type Sheet = { name: string; rows: (string | number | null | undefined)[][] };
export default function ReportExports({sheets,filename}:{sheets:Sheet[];filename:string}) {
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
    <div><strong>Yönetici raporunu dışa aktar</strong><span>Seçili şube ve dönem · tüm satırlar · kontrol notları dahil</span></div>
    <div className="reportExportButtons"><button onClick={()=>window.print()}>A4 yazdır</button><button onClick={()=>window.print()}>PDF olarak kaydet</button><button onClick={excel} disabled={busy}>{busy?"Excel hazırlanıyor…":"Excel indir (.xlsx)"}</button></div>
    <small>PDF için açılan yazdırma ekranında “PDF olarak kaydet” veya paylaşma seçeneğini kullanın. A4 yatay düzen hazırlanır.</small>
    {error && <span role="alert">{error}</span>}
  </div>;
}
