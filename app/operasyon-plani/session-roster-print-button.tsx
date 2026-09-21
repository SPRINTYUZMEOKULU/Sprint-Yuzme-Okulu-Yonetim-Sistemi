"use client";

type PrintStudent = {
  id: string;
  name: string;
  age?: number | null;
  level?: string | null;
  group?: string | null;
};

type Props = {
  date: string;
  weekday: string;
  pool: string;
  startTime: string;
  endTime?: string | null;
  group?: string | null;
  primaryCoach?: string | null;
  backupCoach?: string | null;
  students: PrintStudent[];
  compact?: boolean;
  label?: string;
};

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(value: string) {
  const parsed = new Date(`${value}T12:00:00+03:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(parsed);
}

export default function SessionRosterPrintButton({
  date,
  weekday,
  pool,
  startTime,
  endTime,
  group,
  primaryCoach,
  backupCoach,
  students,
  compact = false,
  label = "Çıktı Al",
}: Props) {
  function printRoster(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();

    const popup = window.open("", "_blank", "width=980,height=760");
    if (!popup) {
      window.alert("Çıktı penceresi engellendi. Tarayıcıda açılır pencere izni verip tekrar deneyin.");
      return;
    }

    const rows = students
      .map(
        (student, index) => `
          <tr>
            <td class="num">${index + 1}</td>
            <td><strong>${escapeHtml(student.name)}</strong></td>
            <td>${escapeHtml(student.age === null || student.age === undefined ? "—" : `${student.age} yaş`)}</td>
            <td>${escapeHtml(student.level || "—")}</td>
            <td>${escapeHtml(student.group || group || "—")}</td>
            <td class="check">□</td>
            <td class="check">□</td>
            <td class="note"></td>
          </tr>`
      )
      .join("");

    popup.document.write(`<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8"/>
<title>${escapeHtml(pool)} - ${escapeHtml(startTime)} Seans Listesi</title>
<style>
@page{size:A4 landscape;margin:10mm}
*{box-sizing:border-box}
body{margin:0;font-family:Arial,Helvetica,sans-serif;color:#10233f;background:#fff}
.sheet{width:100%;margin:0 auto}
.head{display:flex;justify-content:space-between;gap:18px;align-items:flex-start;border-bottom:3px solid #1769e8;padding-bottom:12px}
.brand{font-size:21px;font-weight:900;color:#1769e8}
.sub{font-size:10px;letter-spacing:.12em;color:#64748b;margin-top:3px}
.session{font-size:23px;font-weight:900;text-align:right}
.meta{margin-top:4px;font-size:11px;color:#64748b;text-align:right}
.coaches{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:12px 0}
.coach{border:1px solid #dbe6f3;border-radius:9px;padding:8px 10px;background:#f8fbff}
.coach span{display:block;font-size:8px;font-weight:900;letter-spacing:.08em;color:#8291a6;text-transform:uppercase;margin-bottom:3px}
.coach strong{font-size:12px}
.summary{display:flex;gap:8px;align-items:center;margin:8px 0 10px;color:#475569;font-size:10px}
.pill{border:1px solid #dbe6f3;border-radius:999px;padding:5px 8px;background:#fff}
table{width:100%;border-collapse:collapse;table-layout:fixed}
th,td{border:1px solid #cfd9e6;padding:6px 7px;font-size:10px;vertical-align:middle}
th{background:#f0f5fb;text-align:left;font-size:9px;text-transform:uppercase;letter-spacing:.04em}
th:nth-child(1),td.num{width:34px;text-align:center}
th:nth-child(3){width:65px}
th:nth-child(4){width:100px}
th:nth-child(5){width:185px}
th:nth-child(6),th:nth-child(7){width:55px;text-align:center}
th:nth-child(8){width:145px}
td.check{text-align:center;font-size:17px}
td.note{height:30px}
.foot{display:flex;justify-content:space-between;margin-top:9px;color:#64748b;font-size:9px}
@media print{body{print-color-adjust:exact;-webkit-print-color-adjust:exact}}
</style>
</head>
<body>
<main class="sheet">
  <div class="head">
    <div>
      <div class="brand">SPRİNT YÜZME OKULU</div>
      <div class="sub">SPRİNTOS · SEANS KATILIM LİSTESİ</div>
    </div>
    <div>
      <div class="session">${escapeHtml(weekday)} · ${escapeHtml(startTime)}${endTime ? `–${escapeHtml(endTime)}` : ""}</div>
      <div class="meta">${escapeHtml(formatDate(date))} · ${escapeHtml(pool)}</div>
      ${group ? `<div class="meta">${escapeHtml(group)}</div>` : ""}
    </div>
  </div>

  <div class="coaches">
    <div class="coach"><span>Ana Eğitmen</span><strong>${escapeHtml(primaryCoach || "Atanmadı")}</strong></div>
    <div class="coach"><span>Yedek Eğitmen</span><strong>${escapeHtml(backupCoach || "Atanmadı")}</strong></div>
  </div>

  <div class="summary">
    <span class="pill">${students.length} öğrenci</span>
    <span>Liste seçilen günün aktif kayıt ve ders günü bilgisine göre hazırlanmıştır.</span>
  </div>

  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Öğrenci</th>
        <th>Yaş</th>
        <th>Seviye</th>
        <th>Grup</th>
        <th>Geldi</th>
        <th>Gelmedi</th>
        <th>Not</th>
      </tr>
    </thead>
    <tbody>${rows || '<tr><td colspan="8" style="text-align:center;padding:20px">Bu seans için öğrenci bulunamadı.</td></tr>'}</tbody>
  </table>

  <div class="foot">
    <span>SprintOS üzerinden oluşturulmuştur.</span>
    <span>${escapeHtml(new Date().toLocaleString("tr-TR"))}</span>
  </div>
</main>
<script>window.onload=()=>{window.print();}</script>
</body>
</html>`);

    popup.document.close();
  }

  return (
    <button
      type="button"
      onClick={printRoster}
      className={compact ? "sessionPrint compact" : "sessionPrint"}
      title="Bu seansın öğrenci listesini yazdır / PDF olarak kaydet"
    >
      <span aria-hidden="true">⎙</span>
      <span>{label}</span>
      <style jsx>{`
        .sessionPrint{
          display:inline-flex;align-items:center;justify-content:center;gap:6px;
          min-height:34px;padding:7px 10px;border:1px solid #cfe0f4;border-radius:9px;
          background:#fff;color:#1769e8;font-size:10px;font-weight:900;cursor:pointer;
          white-space:nowrap;
        }
        .sessionPrint.compact{min-height:30px;padding:5px 8px;font-size:9px}
        .sessionPrint:active{transform:translateY(1px)}
      `}</style>
    </button>
  );
}
