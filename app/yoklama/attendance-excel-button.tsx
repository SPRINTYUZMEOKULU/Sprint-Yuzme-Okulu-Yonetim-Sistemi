"use client";

type ExportRow = {
  date: string;
  student: string;
  branch: string;
  group: string;
  status: string;
};

type Props = {
  rows: ExportRow[];
  fileName: string;
  label?: string;
};

function csvCell(value: string) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

export default function AttendanceExcelButton({ rows, fileName, label = "Excel'e Aktar" }: Props) {
  function download() {
    const header = ["Tarih", "Öğrenci", "Şube", "Grup", "Durum"];
    const lines = [
      header.map(csvCell).join(";"),
      ...rows.map((row) => [row.date, row.student, row.branch, row.group, row.status].map(csvCell).join(";")),
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
    <button type="button" className="ahExcelButton" onClick={download} title="Excel ile açılabilen yoklama dosyasını indir">
      <span aria-hidden="true">▦</span>
      {label}
    </button>
  );
}
