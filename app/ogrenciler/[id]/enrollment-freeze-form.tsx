"use client";

import { useEffect, useState, type FormEvent } from "react";
import { enrollmentFreezeMessage } from "@/lib/messaging/enrollment-freeze-message";

function oneCalendarMonthAfter(value: string) {
  if (!value) return undefined;
  const date = new Date(`${value}T00:00:00Z`);
  const day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + 2, 0);
  date.setUTCDate(Math.min(day, date.getUTCDate()));
  return date.toISOString().slice(0, 10);
}

type FreezeItem = { id: string; status: string; new_values: Record<string, unknown> };

export default function EnrollmentFreezeForm({ studentId, enrollmentId, phone }: {
  studentId: string;
  enrollmentId?: string | null;
  phone: string;
}) {
  const [item, setItem] = useState<FreezeItem | null>(null);
  const [callback, setCallback] = useState(false);
  const [canConfirm, setCanConfirm] = useState(false);
  const [start, setStart] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(new Date());

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch(`/api/enrollment-freeze?student=${encodeURIComponent(studentId)}`, {
          signal: controller.signal, cache: "no-store",
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        setItem(data.item);
        setCanConfirm(Boolean(data.canConfirm));
      } catch (error) {
        if (!controller.signal.aborted) setError(error instanceof Error ? error.message : "Dondurma durumu yüklenemedi.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [studentId]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const values = new FormData(event.currentTarget);
    const resume = String(values.get("resume") || "");
    if (!item && !callback && resume <= start) {
      setError("Yeniden başlama tarihi dondurma başlangıcından sonra olmalıdır.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/enrollment-freeze", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(item ? { action: "confirm_resume", requestId: item.id, resume }
          : { enrollmentId, start, resume, callback, note: values.get("note") }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setItem(data.item);
      setNotice([data.delivery, data.staffWarning].filter(Boolean).join(" "));
    } catch (error) {
      setError(error instanceof Error ? error.message : "Dondurma talebi gönderilemedi.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <p role="status">Dondurma durumu yükleniyor…</p>;
  if (item) {
    const message = enrollmentFreezeMessage(item.status, item.new_values);
    const latest = String(item.new_values.freeze_resume_date || "");
    const first = String(item.new_values.freeze_start_date || "");
    return <div className="fileOpsResult">
      <strong>{item.status === "pending" ? "Yönetici onayı bekleniyor" : "Dondurma hakkı kullanıldı"}</strong>
      <p>{message}</p>
      {notice && <p role="status">{notice}</p>}
      {error && <p role="alert">{error}</p>}
      {item.status === "approved" && item.new_values.callback_pending === true && latest >= today && (
        <div>
          {phone && <p><a href={`tel:+${phone}`}>Telefonla ara</a></p>}
          {canConfirm && <form className="fileOpsFreezeForm" onSubmit={submit}>
            <label><span>Teyit edilen dönüş tarihi</span>
              <input type="date" name="resume" min={first > today ? first : today} max={latest} defaultValue={latest} required />
            </label>
            <button type="submit" disabled={busy}>{busy ? "Kaydediliyor…" : "Dönüş Tarihini Teyit Et"}</button>
          </form>}
        </div>
      )}
      {item.status === "pending" && <p><a href={`/onay-merkezi?requestId=${item.id}`}>Talebi Onay Merkezi’nde aç</a></p>}
      {phone && <a href={`https://wa.me/${phone}?text=${encodeURIComponent(`SPRİNT YÜZME OKULU\n\n${message}`)}`}
        target="_blank" rel="noopener noreferrer">WhatsApp’ta mesajı aç</a>}
    </div>;
  }
  if (!enrollmentId) return <p>{error || "Dondurma talebi için aktif kayıt gerekir."}</p>;

  return <form className="fileOpsFreezeForm" onSubmit={submit}>
    <p>Her kursiyerin yönetici onaylı bir dondurma hakkı vardır. Yeniden başlama tarihinden itibaren dersler kendi seans günlerinde devam eder.</p>
    <div className="fileOpsFreezeDates">
      <label><span>Dondurma başlangıcı</span><input type="date" name="start" required min={today} value={start} onChange={event => setStart(event.target.value)} /></label>
      {!callback && <label><span>Yeniden başlama tarihi</span><input type="date" name="resume" required min={start || today} max={oneCalendarMonthAfter(start)} /></label>}
    </div>
    <label><span><input type="checkbox" checked={callback} onChange={event => setCallback(event.target.checked)} /> Dönüş tarihi belli değil · Telefonla teyit edilecek</span></label>
    {callback && <p>En geç dönüş tarihi, başlangıçtan bir takvim ayı sonrası olarak belirlenir. Yöneticiye üç gün önce arama hatırlatması düşer.</p>}
    <label><span>Yöneticiye not (isteğe bağlı)</span><textarea name="note" maxLength={1000} rows={3} /></label>
    {error && <p className="fileOpsResult" role="alert">{error}</p>}
    <button type="submit" disabled={busy}>{busy ? "Gönderiliyor…" : "Yönetici Onayına Gönder"}</button>
  </form>;
}
