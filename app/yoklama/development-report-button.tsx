"use client";

import { useRef, useState, type FormEvent } from "react";
import { developmentReportBody, developmentSections } from "@/lib/attendance/development-report";
import { formatDisplayDate } from "@/lib/dates/display";
import "./development-report.css";

export default function DevelopmentReportButton({
  studentId, studentName, scheduleId, date, disabled,
}: {
  studentId: string;
  studentName: string;
  scheduleId: string;
  date: string;
  disabled: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const requestId = useRef<string | null>(null);
  const inFlight = useRef(false);
  const [fields, setFields] = useState({ strengths: "", focus: "", goal: "" });
  const [preview, setPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sent, setSent] = useState(false);
  const [needsRetry, setNeedsRetry] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [failed, setFailed] = useState(false);

  function review(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!developmentReportBody(fields)) {
      setFailed(true);
      setFeedback("Her rapor alanına bir değerlendirme yazın.");
      return;
    }
    setPreview(true);
    setFeedback("");
  }

  async function publish() {
    if (inFlight.current) return;
    inFlight.current = true;
    setSaving(true);
    setFailed(false);
    setFeedback("");
    try {
      requestId.current ??= crypto.randomUUID();
      const response = await fetch("/api/coach-development", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: requestId.current, studentId, scheduleId, lessonDate: date, ...fields }),
      });
      const data = await response.json();
      if (!response.ok || !data.saved) throw new Error(data.error || "Gelişim raporu paylaşılamadı.");
      setSent(true);
      setNeedsRetry(Boolean(data.notificationError));
      setFeedback(data.notificationError
        ? "Rapor onay bekliyor. Yönetim bildirimini yeniden deneyebilirsiniz."
        : data.recipientCount
          ? "Rapor yönetici onayına gönderildi."
          : "Rapor kaydedildi ve yönetici onayı bekliyor.");
    } catch (error) {
      setFailed(true);
      setFeedback(error instanceof Error ? error.message : "Gelişim raporu paylaşılamadı.");
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  }

  return (
    <>
      <button type="button" disabled={disabled} onClick={() => dialog.current?.showModal()}>
        {sent ? "Gelişim Raporunu Gör" : "Gelişim Raporu"}
      </button>
      <dialog className="developmentDialog" ref={dialog} aria-label={`Gelişim raporu · ${studentName}`}
        onCancel={(event) => { if (saving) event.preventDefault(); }}>
        <header className="developmentHeader">
          <div>
            <h2>Gelişim raporu</h2>
            <p>{studentName} · {formatDisplayDate(date)}</p>
          </div>
          <button type="button" disabled={saving} onClick={() => dialog.current?.close()}>Kapat</button>
        </header>
        {preview ? (
          <div className="developmentForm">
            {developmentSections.map(({ key, label }) => (
              <section className="developmentPreview" key={key}>
                <h3>{label}</h3>
                <p>{fields[key]}</p>
              </section>
            ))}
            {feedback ? <p className={failed ? "developmentError" : "developmentFeedback"} role={failed ? "alert" : "status"}>{feedback}</p> : null}
            <div className="developmentActions">
              {!requestId.current ? <button type="button" disabled={saving} onClick={() => setPreview(false)}>Düzenle</button> : null}
              {(!sent || needsRetry) ? <button type="button" className="developmentPrimary" disabled={saving} onClick={() => void publish()}>
                {saving ? "Paylaşılıyor…" : needsRetry ? "Bildirimi Yeniden Dene" : "Yönetici onayına gönder"}
              </button> : null}
            </div>
          </div>
        ) : (
          <form className="developmentForm" onSubmit={review}>
            {developmentSections.map(({ key, label }) => (
              <label key={key}>{label}
                <textarea required maxLength={900} value={fields[key]} onChange={(event) => setFields({ ...fields, [key]: event.target.value })} />
              </label>
            ))}
            {feedback ? <p className="developmentError" role="alert">{feedback}</p> : null}
            <div className="developmentActions"><button className="developmentPrimary" type="submit">Önizle</button></div>
          </form>
        )}
      </dialog>
    </>
  );
}
