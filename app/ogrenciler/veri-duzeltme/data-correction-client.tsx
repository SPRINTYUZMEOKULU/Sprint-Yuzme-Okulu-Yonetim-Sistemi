"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";

export type CorrectionRow = {
  student_id: string; student_number: string; student_name: string; first_name: string; last_name: string; birth_date: string;
  phone: string; guardian_name: string; guardian_phone: string; email: string; guardian_email: string; swimming_level: string; status: string;
  branch_name: string; group_name: string; package_name: string; registration_note: string; start_date: string; payment_due_date: string;
  schedule_days: string; normal_end_date: string; compensation_end_date: string; package_lesson_count: number; total_lessons: number;
  used_lessons: number; normal_remaining: number; compensation_remaining: number; total_remaining: number; package_price: number;
  payment_received: number; payment_outstanding: number; payment_status: string; last_payment_at: string; issues: string;
};

type Props = { rows: CorrectionRow[]; branches: string[]; groups: string[]; packages: string[] };
type PreviewRow = { student_id: string; student_name: string; student_number: string; changes: Record<string, string>; error?: string };

const columns: Array<[keyof CorrectionRow, string, boolean]> = [
  ["student_id", "__STUDENT_ID", false], ["student_number", "Öğrenci No", false], ["student_name", "Öğrenci Ad Soyad", false],
  ["first_name", "Ad", true], ["last_name", "Soyad", true], ["birth_date", "Doğum Tarihi", true],
  ["phone", "Öğrenci Telefonu", true], ["guardian_name", "Veli Ad Soyad", true], ["guardian_phone", "Veli Telefonu", true],
  ["email", "Öğrenci E-posta", true], ["guardian_email", "Veli E-posta", true], ["swimming_level", "Seviye", true],
  ["branch_name", "Şube", true], ["group_name", "Grup", true], ["package_name", "Paket", true],
  ["start_date", "Başlangıç Tarihi", true], ["payment_due_date", "Ödeme Vade Tarihi", true], ["registration_note", "Kayıt Notu", true],
  ["status", "Kayıt Durumu (Bilgi)", false], ["schedule_days", "Program Günleri (Bilgi)", false],
  ["package_lesson_count", "Paket Ders Sayısı", false], ["total_lessons", "Toplam Ders", false], ["used_lessons", "Kullanılan Ders", false],
  ["normal_remaining", "Normal Kalan", false], ["compensation_remaining", "Telafi Kalan", false], ["total_remaining", "Toplam Kalan", false],
  ["normal_end_date", "Normal Bitiş", false], ["compensation_end_date", "Telafi Bitiş", false],
  ["package_price", "Paket Fiyatı", false], ["payment_received", "Tahsil Edilen", false], ["payment_outstanding", "Kalan Borç", false],
  ["payment_status", "Ödeme Durumu", false], ["last_payment_at", "Son Ödeme Tarihi", false], ["issues", "Eksik / Hatalı Bilgiler", false],
];
const editableKeys = new Set(columns.filter((x) => x[2]).map((x) => x[0]));
const headerToKey = new Map(columns.map((x) => [x[1], x[0]]));
function csvEscape(value: unknown) { return `"${String(value ?? "").replaceAll('"', '""')}"`; }
function normalized(value: unknown) { return String(value ?? "").trim(); }
function parseCSV(text: string) {
  const result: string[][] = []; let row: string[] = []; let cell = ""; let quoted = false;
  const source = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    if (quoted) { if (ch === '"' && source[i + 1] === '"') { cell += '"'; i++; } else if (ch === '"') quoted = false; else cell += ch; }
    else { if (ch === '"') quoted = true; else if (ch === ';') { row.push(cell); cell = ""; } else if (ch === '\n') { row.push(cell.replace(/\r$/, "")); result.push(row); row = []; cell = ""; } else cell += ch; }
  }
  row.push(cell.replace(/\r$/, "")); if (row.some((x) => x !== "")) result.push(row); return result;
}
async function fileToMatrix(file: File): Promise<string[][]> {
  const ext = file.name.toLocaleLowerCase("tr-TR").split(".").pop() || "";
  if (ext === "csv") return parseCSV(await file.text());
  if (ext === "xlsx" || ext === "xls") {
    const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: false });
    const firstSheet = workbook.SheetNames[0];
    if (!firstSheet) throw new Error("Excel dosyasında okunabilir sayfa bulunamadı.");
    return XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[firstSheet], { header: 1, raw: false, defval: "" }).map((row) => row.map(normalized));
  }
  throw new Error("Desteklenmeyen dosya türü. .xlsx, .xls veya .csv yükleyin.");
}

export default function DataCorrectionClient({ rows, branches, groups, packages }: Props) {
  const router = useRouter(); const inputRef = useRef<HTMLInputElement>(null);
  const [onlyIssues, setOnlyIssues] = useState(true); const [query, setQuery] = useState(""); const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [message, setMessage] = useState(""); const [applying, setApplying] = useState(false);
  const issueCount = rows.filter((r) => r.issues).length; const paymentIssue = rows.filter((r) => r.payment_outstanding > 0).length;
  const contactIssue = rows.filter((r) => !r.phone && !r.guardian_phone).length;
  const visible = useMemo(() => rows.filter((r) => {
    if (onlyIssues && !r.issues) return false;
    const haystack = `${r.student_name} ${r.student_number} ${r.guardian_name} ${r.phone} ${r.guardian_phone} ${r.issues}`.toLocaleLowerCase("tr-TR");
    return !query || haystack.includes(query.toLocaleLowerCase("tr-TR"));
  }), [rows, onlyIssues, query]);

  function exportFile(all = false) {
    const exportRows = all ? rows : visible; const headers = columns.map((x) => x[1]); const lines = [headers.map(csvEscape).join(";")];
    for (const row of exportRows) lines.push(columns.map(([key]) => csvEscape(row[key])).join(";"));
    const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8" }); const url = URL.createObjectURL(blob); const a = document.createElement("a");
    a.href = url; a.download = `SprintOS-Veri-Duzeltme-${new Date().toISOString().slice(0,10)}.csv`; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  }

  async function readImport(file?: File) {
    if (!file) return; setMessage("Dosya kontrol ediliyor…"); setPreview([]);
    try {
      const matrix = await fileToMatrix(file);
      if (matrix.length < 2) throw new Error("Dosyada veri satırı bulunamadı.");
      const headers = matrix[0].map(normalized); const idIndex = headers.indexOf("__STUDENT_ID"); const noIndex = headers.indexOf("Öğrenci No");
      if (idIndex < 0 || noIndex < 0) throw new Error("Bu dosya SprintOS Veri Düzeltme şablonu değil. Öğrenci ID ve Öğrenci No alanları bulunamadı.");
      const currentMap = new Map(rows.map((r) => [r.student_id, r])); const next: PreviewRow[] = [];
      for (const cells of matrix.slice(1)) {
        const id = normalized(cells[idIndex]); if (!id) continue; const current = currentMap.get(id); const studentNo = normalized(cells[noIndex]);
        if (!current) { next.push({ student_id:id, student_name:"Bilinmeyen kayıt", student_number:studentNo, changes:{}, error:"Öğrenci sistemde bulunamadı" }); continue; }
        if (studentNo && current.student_number && studentNo !== current.student_number) { next.push({ student_id:id, student_name:current.student_name, student_number:studentNo, changes:{}, error:"Öğrenci numarası eşleşmiyor" }); continue; }
        const changes: Record<string,string> = {};
        headers.forEach((header, index) => { const key = headerToKey.get(header); if (!key || !editableKeys.has(key)) return; const incoming = normalized(cells[index]); if (!incoming) return; const currentValue = normalized(current[key]); const compareIncoming = incoming === "TEMİZLE" ? "" : incoming; if (compareIncoming !== currentValue) changes[String(key)] = incoming; });
        if (Object.keys(changes).length) next.push({ student_id:id, student_name:current.student_name, student_number:current.student_number, changes });
      }
      setPreview(next); const errors = next.filter((x) => x.error).length; const changes = next.filter((x) => !x.error).length;
      setMessage(`${file.name} · ${matrix.length - 1} satır okundu · ${changes} öğrenci güncellenecek${errors ? ` · ${errors} hatalı satır` : ""}.`);
    } catch (e) { setMessage(e instanceof Error ? e.message : "Dosya okunamadı."); }
    finally { if (inputRef.current) inputRef.current.value = ""; }
  }

  async function applyImport() {
    const valid = preview.filter((x) => !x.error && Object.keys(x.changes).length); if (!valid.length) return;
    if (!window.confirm(`${valid.length} öğrencideki değişiklikler SprintOS'a uygulansın mı? İşlem geçmişine kaydedilecektir.`)) return;
    setApplying(true); setMessage("Değişiklikler uygulanıyor…");
    try { const response = await fetch("/api/student-data-correction-import", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ rows: valid }) }); const result = await response.json(); if (!response.ok) throw new Error(result.error || "Güncelleme tamamlanamadı."); setMessage(`${result.updated || 0} öğrenci güncellendi.${result.errors?.length ? ` ${result.errors.length} satır uygulanamadı.` : ""}`); setPreview([]); router.refresh(); }
    catch(e) { setMessage(e instanceof Error ? e.message : "Güncelleme sırasında hata oluştu."); } finally { setApplying(false); }
  }

  return <section className="dataCorrectionShell">
    <div className="qualityCards">
      <button onClick={()=>setOnlyIssues(false)}><span>Toplam Kayıt</span><strong>{rows.length}</strong></button><button onClick={()=>setOnlyIssues(true)}><span>Eksik / Kontrol</span><strong>{issueCount}</strong></button>
      <button onClick={()=>{setOnlyIssues(false);setQuery("Telefon eksik")}}><span>Telefon Eksik</span><strong>{contactIssue}</strong></button><button onClick={()=>{setOnlyIssues(false);setQuery("Ödeme bekliyor")}}><span>Ödeme Bekleyen</span><strong>{paymentIssue}</strong></button>
    </div>
    <div className="correctionToolbar"><div><h2>Toplu Veri Temizleme</h2><p>Excel’de öğrenciyi her zaman <b>Ad Soyad + Öğrenci No</b> ile görürsünüz. <code>__STUDENT_ID</code> eşleştirme için korunur.</p></div><div className="toolbarActions">
      <button className="primary" onClick={()=>exportFile(false)}>Eksik / Filtreli Veriyi Excel’e Aktar</button><button onClick={()=>exportFile(true)}>Tüm Detayları Excel’e Aktar</button>
      <button onClick={()=>inputRef.current?.click()}>Düzeltilmiş Excel/CSV’yi Kontrol Et</button>
      <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv" hidden onChange={(e)=>void readImport(e.target.files?.[0])}/>
    </div></div>
    <div className="referenceNote"><b>Güvenli içe aktarma:</b> .xlsx, .xls ve .csv desteklenir. Boş hücreler mevcut veriyi silmez. Bir alanı özellikle temizlemek için hücreye <b>TEMİZLE</b> yazın. Şube, Grup ve Paket değerlerini sistemdeki adlarıyla kullanın.<details><summary>Geçerli referansları göster</summary><p><b>Şubeler:</b> {branches.join(" · ")}</p><p><b>Paketler:</b> {packages.join(" · ")}</p><p><b>Gruplar:</b> {groups.join(" · ")}</p></details></div>
    <div className="searchRow"><input value={query} onChange={(e)=>setQuery(e.target.value)} placeholder="Öğrenci adı, SPR numarası, veli, telefon veya eksik bilgi ara…"/><label><input type="checkbox" checked={onlyIssues} onChange={(e)=>setOnlyIssues(e.target.checked)}/> Sadece eksik/kontrol gerekenleri göster</label></div>
    {message ? <div className="importMessage">{message}</div> : null}
    {preview.length ? <div className="previewBox"><div className="previewHead"><div><strong>İçe Aktarma Önizlemesi</strong><span>{preview.filter(x=>!x.error).length} öğrenci değişecek</span></div><button className="apply" disabled={applying} onClick={()=>void applyImport()}>{applying?"Uygulanıyor…":"Kontrol Ettim · Güncellemeleri Uygula"}</button></div>{preview.slice(0,30).map((p)=><div className={`previewRow ${p.error?"bad":""}`} key={p.student_id}><b>{p.student_name}</b><small>{p.student_number || "No yok"}</small><span>{p.error || Object.entries(p.changes).map(([k,v])=>`${k}: ${v}`).join(" · ")}</span></div>)}{preview.length>30?<p>+{preview.length-30} satır daha</p>:null}</div>:null}
    <div className="tableWrap"><table><thead><tr><th>Öğrenci</th><th>SPR No</th><th>Durum</th><th>İletişim</th><th>Şube / Grup</th><th>Paket / Ders</th><th>Ödeme</th><th>Eksik / Hatalı Bilgiler</th></tr></thead><tbody>{visible.slice(0,250).map((r)=><tr key={r.student_id}><td><b>{r.student_name}</b><small>{r.guardian_name || "Veli adı yok"}</small></td><td>{r.student_number || "—"}</td><td>{r.status || "—"}</td><td><span>{r.phone || "—"}</span><small>Veli: {r.guardian_phone || "—"}</small></td><td><b>{r.branch_name || "—"}</b><small>{r.group_name || "Grup yok"}</small></td><td><b>{r.package_name || "—"}</b><small>{r.used_lessons}/{r.total_lessons} kullanıldı · {r.total_remaining} kalan</small></td><td><b>{r.payment_outstanding.toLocaleString("tr-TR")} TL bekleyen</b><small>{r.payment_status || "—"}</small></td><td className={r.issues?"issue":"ok"}>{r.issues || "✓ Veri kontrolünde belirgin eksik yok"}</td></tr>)}</tbody></table></div>
    <style jsx>{`
      .dataCorrectionShell{max-width:1500px;margin:18px auto 50px}.qualityCards{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}.qualityCards button{padding:18px;text-align:left;border:1px solid #d9e6f4;border-radius:18px;background:#fff;cursor:pointer}.qualityCards span{display:block;color:#71839b;font-size:12px;font-weight:800}.qualityCards strong{display:block;margin-top:6px;color:#10284d;font-size:28px}.correctionToolbar{margin-top:14px;padding:20px;border:1px solid #d9e6f4;border-radius:20px;background:#fff;display:flex;justify-content:space-between;gap:18px;align-items:center}.correctionToolbar h2{margin:0 0 5px;color:#10284d}.correctionToolbar p{margin:0;color:#71839b;font-size:13px}.toolbarActions{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}.toolbarActions button,.apply{min-height:42px;padding:0 14px;border:1px solid #cfdced;border-radius:12px;background:#fff;color:#173a61;font-weight:850;cursor:pointer}.toolbarActions .primary,.apply{background:#176de9;color:#fff;border-color:#176de9}.referenceNote{margin-top:12px;padding:14px 16px;border:1px solid #d7e4f2;border-radius:16px;background:#f8fbff;color:#49627d;font-size:12px;line-height:1.5}.referenceNote summary{cursor:pointer;font-weight:800;margin-top:6px}.searchRow{margin-top:12px;display:flex;gap:12px;align-items:center}.searchRow>input{flex:1;min-height:48px;border:1px solid #d4e0ee;border-radius:14px;padding:0 14px}.searchRow label{font-size:12px;color:#526982;font-weight:750}.importMessage{margin-top:12px;padding:12px 14px;border-radius:13px;background:#eef6ff;color:#1458a6;font-weight:750}.previewBox{margin-top:12px;padding:16px;border:1px solid #bcd6f7;border-radius:18px;background:#fff}.previewHead{display:flex;justify-content:space-between;gap:12px;align-items:center;margin-bottom:10px}.previewHead div{display:grid}.previewHead span{font-size:12px;color:#71839b}.previewRow{display:grid;grid-template-columns:220px 130px 1fr;gap:10px;padding:9px 0;border-top:1px solid #edf1f6;font-size:12px}.previewRow.bad{color:#b42318}.tableWrap{margin-top:12px;overflow:auto;border:1px solid #d9e6f4;border-radius:18px;background:#fff}table{width:100%;border-collapse:collapse;min-width:1200px}th,td{padding:12px;border-bottom:1px solid #edf1f6;text-align:left;vertical-align:top;font-size:12px}th{position:sticky;top:0;background:#f4f8fd;color:#31506f;font-size:11px;z-index:1}td b,td span,td small{display:block}td small{margin-top:4px;color:#7b8ca3}.issue{color:#a45100;background:#fffaf0}.ok{color:#087443}@media(max-width:900px){.qualityCards{grid-template-columns:repeat(2,1fr)}.correctionToolbar{align-items:stretch;flex-direction:column}.toolbarActions{justify-content:flex-start}.searchRow{align-items:stretch;flex-direction:column}}
    `}</style>
  </section>;
}
