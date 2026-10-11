"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

export default function StudentStatusButton({ studentId, name, status, canApprove }: {
  studentId: string; name: string; status: string | null; canApprove: boolean;
}) {
  const router = useRouter();
  const locked = useRef(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const active = ["active", "aktif"].includes((status || "active").toLowerCase());
  const supported = active || ["passive", "pasif"].includes((status || "").toLowerCase());

  async function changeStatus() {
    if (locked.current || !supported) return;
    if (!window.confirm(`${name} ${active ? "pasife" : "aktife"} alınsın mı?`)) return;
    locked.current = true;
    setBusy(true);
    setMessage("");
    try {
      let requestId = pendingId;
      if (!requestId) {
        const response = await fetch("/api/student-status-requests", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ request_type: active ? "deactivate" : "activate", student_id: studentId,
            reason: "Dijital kursiyer dosyasında durum değişikliği onaylandı.", old_status: status }),
        });
        const data = await response.json();
        if (!response.ok || !data.ok) throw new Error(data.error || "Durum değişikliği kaydedilemedi.");
        requestId = data.request.id;
        setPendingId(requestId);
      }
      if (canApprove) {
        const response = await fetch("/api/approval-center", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: requestId, source: "student_status", action: "approve" }),
        });
        const data = await response.json();
        if (!response.ok || !data.ok) throw new Error(data.error || "Durum değişikliği onaylanamadı.");
        setPendingId(null);
        setMessage(`Kursiyer ${active ? "pasife" : "aktife"} alındı.`);
      } else {
        setMessage("Durum değişikliği yönetici onayına gönderildi.");
      }
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "İşlem tamamlanamadı.");
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }

  return <>
    <button type="button" className="studentStatusButton" disabled={busy || !supported || (!!pendingId && !canApprove)}
      onClick={changeStatus} title={active ? "Pasife al" : "Aktife al"}
      aria-label={`${name}: ${active ? "aktif, pasife al" : "pasif, aktife al"}`}>
      {busy ? "Kaydediliyor…" : pendingId && !canApprove ? "Onay bekliyor" : `${active ? "Aktif" : "Pasif"} ⇄`}
    </button>
    {message && <span role="status">{message}</span>}
  </>;
}
