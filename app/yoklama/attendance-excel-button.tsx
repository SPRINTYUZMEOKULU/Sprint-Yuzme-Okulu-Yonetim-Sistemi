"use client";

type ExportRow = {
  date: string;
  time?: string;
  student: string;
  branch: string;
  group: string;
  status: string;
  note?: string;
  renewal?: string;
};

type Props = {
  rows: ExportRow[];
  fileName: string;
  label?: string;
};

function csvCell(value?: string) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

export default function AttendanceExcelButton({ rows, fileName, label = "Excel Raporu" }: Props) {
  function download() {
    const header = ["Tarih", "Saat", "Öğrenci", "Şube", "Grup", "Durum", "Antrenör Notu", "Kayıt Yenileme"];
    const lines = [
      header.map(csvCell).join(";"),
      ...rows.map((row) => [row.date, row.time, row.student, row.branch, row.group, row.status, row.note, row.renewal].map(csvCell).join(";")),
    ];
    const blob = new Blob(["\ufeff", lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${fileName}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <button type="button" className="ahExcelButton" onClick={download} title="Filtrelenmiş yoklama raporunu Excel ile açılabilen yatay tablo olarak indir">
      <span aria-hidden="true">▦</span>
      {label}
    </button>
  );
}
