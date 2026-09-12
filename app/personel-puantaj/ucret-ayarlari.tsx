"use client";

import { useCallback, useEffect, useState } from "react";

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

const modelLabels: Record<string, string> = {
  per_lesson: "Ders başı",
  hourly: "Saatlik",
  monthly: "Aylık sabit",
  monthly_plus_lesson: "Sabit + ek ders",
};

export default function UcretAyarlari() {
  const [rows, setRows] = useState<StaffPayRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, StaffPayRow>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/personel-puantaj/ucret", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Ücret ayarları alınamadı.");
      const nextRows = Array.isArray(payload?.rows) ? payload.rows : [];
      setRows(nextRows);
      setDrafts(Object.fromEntries(nextRows.map((row: StaffPayRow) => [row.staffId, { ...row }])));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ücret ayarları alınamadı.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function patch(id: string, changes: Partial<StaffPayRow>) {
    setDrafts((prev) => ({ ...prev, [id]: { ...prev[id], ...changes } }));
  }

  async function save(id: string) {
    const row = drafts[id];
    if (!row) return;
    setBusy(id);
    setMessage(null);
    setError(null);
    try {
      const response = await fetch("/api/personel-puantaj/ucret", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
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
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ücret ayarı kaydedilemedi.");
    } finally {
      setBusy(null);
    }
  }

  if (loading && !rows.length) return <div className="payLoading">Personel ücret bilgileri hazırlanıyor…</div>;

  return (
    <>
      {message ? <div className="payNotice success">{message}</div> : null}
      {error ? <div className="payNotice danger">{error}</div> : null}

      <div className="payToolbar">
        <div>
          <strong>{rows.length} aktif personel</strong>
          <span>Her personelin ücret modelini ayrı belirleyebilirsiniz.</span>
        </div>
        <button type="button" onClick={() => void load()} disabled={loading}>{loading ? "Yenileniyor…" : "Listeyi Yenile"}</button>
      </div>

      <div className="payGrid">
        {rows.map((row) => {
          const draft = drafts[row.staffId] || row;
          return (
            <article className="payCard" key={row.staffId}>
              <header>
                <div className="payAvatar">{row.staffName.trim().slice(0, 1).toLocaleUpperCase("tr-TR")}</div>
                <div><strong>{row.staffName}</strong><span>{row.title || "Personel"}</span></div>
              </header>

              <label>
                <span>Ücret modeli</span>
                <select value={draft.payType} onChange={(e) => patch(row.staffId, { payType: e.target.value })}>
                  {Object.entries(modelLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>

              {(draft.payType === "per_lesson" || draft.payType === "monthly_plus_lesson") ? (
                <label><span>Ders başı ücret</span><div className="moneyInput"><b>₺</b><input type="number" min="0" step="1" value={draft.perLessonRate} onChange={(e) => patch(row.staffId, { perLessonRate: Number(e.target.value) })} /></div></label>
              ) : null}

              {draft.payType === "hourly" ? (
                <label><span>Saatlik ücret</span><div className="moneyInput"><b>₺</b><input type="number" min="0" step="1" value={draft.hourlyRate} onChange={(e) => patch(row.staffId, { hourlyRate: Number(e.target.value) })} /></div></label>
              ) : null}

              {(draft.payType === "monthly" || draft.payType === "monthly_plus_lesson") ? (
                <label><span>Aylık sabit ücret</span><div className="moneyInput"><b>₺</b><input type="number" min="0" step="1" value={draft.monthlySalary} onChange={(e) => patch(row.staffId, { monthlySalary: Number(e.target.value) })} /></div></label>
              ) : null}

              <label className="payToggle">
                <input type="checkbox" checked={draft.payrollActive} onChange={(e) => patch(row.staffId, { payrollActive: e.target.checked })} />
                <span>Puantaj ve hakediş hesabına dahil et</span>
              </label>

              <button className="paySave" type="button" onClick={() => void save(row.staffId)} disabled={busy === row.staffId}>
                {busy === row.staffId ? "Kaydediliyor…" : "Ücret Ayarını Kaydet"}
              </button>
            </article>
          );
        })}
      </div>
    </>
  );
}
