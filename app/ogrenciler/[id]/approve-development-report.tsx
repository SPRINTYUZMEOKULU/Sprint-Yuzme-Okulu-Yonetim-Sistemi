"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ApproveDevelopmentReport({ studentId, id }: { studentId: string; id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [retry, setRetry] = useState(false);
  const [message, setMessage] = useState("");

  async function approve() {
    if (busy) return;
    setBusy(true);
    try {
      const response = await fetch("/api/coach-development", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, studentId }),
      });
      const result = await response.json();
      if (!response.ok || !result.saved) throw new Error(result.error || "Onay kaydedilemedi.");
      setRetry(Boolean(result.notificationError));
      setMessage(result.notificationError ? "Rapor yayımlandı. Bildirimleri yeniden deneyebilirsiniz." : "Rapor yayımlandı.");
      if (!result.notificationError) router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Onay kaydedilemedi.");
    } finally {
      setBusy(false);
    }
  }

  return <div>
    <button type="button" disabled={busy} onClick={() => void approve()}>
      {busy ? "Kaydediliyor…" : retry ? "Bildirimleri yeniden dene" : "Onayla ve veliye yayımla"}
    </button>
    {message ? <p role="status">{message}</p> : null}
  </div>;
}
