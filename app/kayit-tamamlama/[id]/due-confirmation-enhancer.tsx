"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export default function DueConfirmationEnhancer() {
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [studentId, setStudentId] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const dueInput = document.querySelector<HTMLInputElement>('input[name="payment_due_date"]');
    const studentInput = document.querySelector<HTMLInputElement>('input[name="student_id"]');
    if (!dueInput || !studentInput) return;

    const wrapper = dueInput.closest<HTMLElement>(".dueDateField") || dueInput.parentElement;
    if (!wrapper) return;

    setTarget(wrapper);
    setStudentId(studentInput.value);

    const markUnconfirmed = () => {
      setConfirmed(false);
      setMessage("Vade değişti. Yeni tarihi tekrar onaylayınız.");
    };
    dueInput.addEventListener("change", markUnconfirmed);

    fetch(`/api/registration-due-confirmation?studentId=${encodeURIComponent(studentInput.value)}`, {
      cache: "no-store",
    })
      .then((r) => r.json())
      .then((data) => {
        if (data?.confirmed && data?.date === dueInput.value) {
          setConfirmed(true);
          setMessage("Vade tarihi onaylandı ve ödeme sistemiyle eşitlendi.");
        }
      })
      .catch(() => undefined);

    return () => dueInput.removeEventListener("change", markUnconfirmed);
  }, []);

  async function confirmDueDate() {
    const dueInput = document.querySelector<HTMLInputElement>('input[name="payment_due_date"]');
    const noteInput = document.querySelector<HTMLTextAreaElement | HTMLInputElement>('[name="payment_note"]');
    const dueDate = dueInput?.value || "";
    if (!studentId || !dueDate) {
      setMessage("Önce geçerli bir vade tarihi seçiniz.");
      return;
    }

    setBusy(true);
    setMessage("Vade tarihi onaylanıyor…");
    try {
      const response = await fetch("/api/registration-due-confirmation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId,
          dueDate,
          note: noteInput?.value || "",
        }),
      });
      const data = await response.json();
      if (!response.ok || !data?.ok) throw new Error(data?.message || "Vade tarihi onaylanamadı.");
      setConfirmed(true);
      setMessage("Vade tarihi onaylandı. Ödemeler, öğrenci dosyası, bildirimler ve uyarılar bu tarihi kullanacak.");
    } catch (error) {
      setConfirmed(false);
      setMessage(error instanceof Error ? error.message : "Vade tarihi onaylanamadı.");
    } finally {
      setBusy(false);
    }
  }

  if (!target) return null;

  return createPortal(
    <div className="dueConfirmationBox">
      <button
        type="button"
        className={confirmed ? "dueConfirmButton confirmed" : "dueConfirmButton"}
        onClick={confirmDueDate}
        disabled={busy}
      >
        {busy ? "Vade Onaylanıyor…" : confirmed ? "✓ Vade Tarihi Onaylandı" : "Vade Tarihini Onayla"}
      </button>
      <small className={confirmed ? "dueConfirmMessage success" : "dueConfirmMessage"}>{message}</small>
      <style jsx>{`
        .dueConfirmationBox{display:grid;gap:8px;margin-top:10px}.dueConfirmButton{min-height:44px;border:0;border-radius:12px;background:#1769e8;color:#fff;font:inherit;font-weight:900;cursor:pointer;box-shadow:0 9px 22px rgba(23,105,232,.18);transition:transform .15s ease,box-shadow .15s ease,opacity .15s ease}.dueConfirmButton:active{transform:scale(.985)}.dueConfirmButton:disabled{opacity:.72;cursor:wait}.dueConfirmButton.confirmed{background:#17854a;box-shadow:0 9px 22px rgba(23,133,74,.16)}.dueConfirmMessage{color:#7a5a11;font-size:11px;line-height:1.45}.dueConfirmMessage.success{color:#167442}
      `}</style>
    </div>,
    target,
  );
}
