"use client";

import { useRef, useState, type FormEvent } from "react";

export default function ManagementNoteForm({ studentId, scheduleId, date }: {
  studentId: string;
  scheduleId: string;
  date: string;
}) {
  const submission = useRef<{ id: string; subject: string; body: string } | null>(null);
  const busy = useRef(false);
  const [sending, setSending] = useState(false);
  const [saved, setSaved] = useState(false);
  const [retry, setRetry] = useState(false);
  const [feedback, setFeedback] = useState("");

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current) return;
    const form = new FormData(event.currentTarget);
    const subject = String(form.get("subject") || "student");
    const body = String(form.get("body") || "").trim();
    if (!body && !submission.current) {
      setFeedback("Notu yazın.");
      return;
    }
    busy.current = true;
    setSending(true);
    try {
      submission.current ??= { id: crypto.randomUUID(), subject, body };
      const response = await fetch("/api/coach-development", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...submission.current, studentId, scheduleId, lessonDate: date, kind: "management_note" }),
      });
      const result = await response.json();
      if (!response.ok || !result.saved) throw new Error(result.error || "Not kaydedilemedi.");
      setSaved(true);
      setRetry(Boolean(result.notificationError));
      setFeedback(result.notificationError ? "Not kaydedildi. Bildirimi yeniden deneyebilirsiniz."
        : result.recipientCount ? "Not kaydedildi ve yönetim bildirimi oluşturuldu." : "Not öğrenci dosyasına kaydedildi.");
    } catch (error) {
      setRetry(true);
      setFeedback(error instanceof Error ? error.message : "Not kaydedilemedi.");
    } finally {
      busy.current = false;
      setSending(false);
    }
  }

  return (
    <details className="saManagementNote">
      <summary>Kurum içi not</summary>
      <form onSubmit={send}>
        <label>Konu
          <select name="subject" disabled={sending || saved || retry}>
            <option value="student">Öğrenci hakkında</option>
            <option value="guardian">Veli hakkında</option>
          </select>
        </label>
        <label>Yönetim için not
          <textarea name="body" required maxLength={1500} disabled={sending || saved || retry} />
        </label>
        {!saved || retry ? <button type="submit" disabled={sending}>
          {sending ? "Kaydediliyor…" : retry ? "Tekrar dene" : "Yönetime bildir"}
        </button> : null}
        {feedback ? <p role="status">{feedback}</p> : null}
      </form>
    </details>
  );
}
