"use client";

import { useMemo, useState } from "react";

type StaffPayRow = {
  staffId: string;
  staffName: string;
  title?: string;
  payType: string;
  perLessonRate: number;
  hourlyRate: number;
  monthlySalary: number;
  payrollActive: boolean;
};

type Props = {
  rows: StaffPayRow[];
  onSaved: () => Promise<void> | void;
};

const modelLabels: Record<string, string> = {
  per_lesson: "Ders başı",
  hourly: "Saatlik",
  monthly: "Aylık sabit",
  monthly_plus_lesson: "Sabit + ek ders",
};

export default function UcretAyarlari({ rows, onSaved }: Props) {
  const initial = useMemo(() => Object.fromEntries(rows.map((row) => [row.staffId, { ...row }])), [rows]);
  const [drafts, setDrafts] = useState<Record<string, StaffPayRow>>(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function patch(id: string, changes: Partial<StaffPayRow>) {
    setDrafts((prev) => ({ ...prev, [id]: { ...prev[id], ...changes } }));
  }

  async function save(id: string) {
    const row = drafts[id];
    if (!row) return;
    setBusy(id);
    setMessage(null);
    try {
      const response = await fetch("/api/personel-puantaj", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save_pay_settings",
          staffId: row.staffId,
          payType: row.payType,
          perLessonRate: Number(row.perLessonRate || 0),
          hourlyRate: Number(row.hourlyRate || 0),
          monthlySalary: Number(row.monthlySalary || 0),
          payrollActive: Boolean(row.payrollActive),
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Ücret ayarı kaydedilemedi.");
      setMessage(`${row.staffName} için ücret ayarları kaydedildi.`);
      await onSaved();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Ücret ayarı kaydedilemedi.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="ppPanel ppPaySettings">
      <div className="ppPanelHead">
        <div><p>PERSONEL ÜCRET AYARLARI</p><h2>Kimin ne kadar alacağını buradan belirleyin</h2></div>
        <span>{rows.length} personel</span>
      </div>
      {message ? <div className="ppNotice success">{message}</div> : null}
      <div className="ppPayCards">
        {rows.map((row) => {
          const draft = drafts[row.staffId] || row;
          return (
            <article className="ppPayCard" key={row.staffId}>
              <div className="ppPayIdentity">
                <strong>{row.staffName}</strong>
                <span>{row.title || "Personel"}</span>
              </div>
              <label>
                <span>Ücret modeli</span>
                <select value={draft.payType} onChange={(e) => patch(row.staffId, { payType: e.target.value })}>
                  {Object.entries(modelLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              {(draft.payType === "per_lesson" || draft.payType === "monthly_plus_lesson") ? (
                <label><span>Ders başı ücret (₺)</span><input type="number" min="0" step="1" value={draft.perLessonRate} onChange={(e) => patch(row.staffId, { perLessonRate: Number(e.target.value) })} /></label>
              ) : null}
              {draft.payType === "hourly" ? (
                <label><span>Saatlik ücret (₺)</span><input type="number" min="0" step="1" value={draft.hourlyRate} onChange={(e) => patch(row.staffId, { hourlyRate: Number(e.target.value) })} /></label>
              ) : null}
              {(draft.payType === "monthly" || draft.payType === "monthly_plus_lesson") ? (
                <label><span>Aylık sabit ücret (₺)</span><input type="number" min="0" step="1" value={draft.monthlySalary} onChange={(e) => patch(row.staffId, { monthlySalary: Number(e.target.value) })} /></label>
              ) : null}
              <label className="ppPayToggle"><input type="checkbox" checked={draft.payrollActive} onChange={(e) => patch(row.staffId, { payrollActive: e.target.checked })} /><span>Puantaj ve hakediş hesabına dahil et</span></label>
              <button className="ppPrimary" type="button" onClick={() => void save(row.staffId)} disabled={busy === row.staffId}>{busy === row.staffId ? "Kaydediliyor…" : "Ücret Ayarını Kaydet"}</button>
            </article>
          );
        })}
      </div>
    </section>
  );
}
