"use client";

import { useEffect, useState, type FormEvent } from "react";
import { enrollmentFreezeMessage } from "@/lib/messaging/enrollment-freeze-message";

type FreezeItem = { id: string; status: string; new_values: Record<string, unknown> };

export default function EnrollmentFreezeForm({ studentId, enrollmentId, phone }: {
  studentId: string;
  enrollmentId?: string | null;
  phone: string;
}) {
  const [item, setItem] = useState<FreezeItem | null>(null);
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
    if (resume <= start) {
      setError("Yeniden başlama tarihi dondurma başlangıcından sonra olmalıdır.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/enrollment-freeze", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enrollmentId, start, resume, note: values.get("note") }),
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
    return <div className="fileOpsResult" role="status">
      <strong>{item.status === "pending" ? "Yönetici onayı bekleniyor" : "Dondurma hakkı kullanıldı"}</strong>
      <p>{message}</p>
      {notice && <p>{notice}</p>}
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
      <label><span>Yeniden başlama tarihi</span><input type="date" name="resume" required min={start || today} /></label>
    </div>
    <label><span>Yöneticiye not (isteğe bağlı)</span><textarea name="note" maxLength={1000} rows={3} /></label>
    {error && <p className="fileOpsResult" role="alert">{error}</p>}
    <button type="submit" disabled={busy}>{busy ? "Gönderiliyor…" : "Yönetici Onayına Gönder"}</button>
  </form>;
}
