"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { GuardianPaymentReminder } from "@/lib/guardian/payment-summary";

const money = (value: number) => new Intl.NumberFormat("tr-TR", {style:"currency", currency:"TRY"}).format(value);
const date = (value: string) => value.split("-").reverse().join(".");
export default function PaymentReminder({ reminder, accountId, enrollmentId, childId, previewGuardian }: {reminder: GuardianPaymentReminder | null; accountId: string; enrollmentId?: string; childId: string; previewGuardian?: string}) {
  const [notice, setNotice] = useState<string | null>(null);
  const key = reminder ? `guardian-payment:${accountId}:${enrollmentId}:${reminder.dueDate || "none"}:${reminder.amount}:${reminder.day}` : "";
  useEffect(() => {
    if (!key || previewGuardian) return;
    try { if (localStorage.getItem(key)) return; localStorage.setItem(key, "shown"); } catch { /* Reminder remains available when storage is disabled. */ }
    setNotice(key);
  }, [key, previewGuardian]);
  if (!reminder) return null;
  const title = reminder.state === "overdue" ? "Ödeme vadeniz geçti" : reminder.state === "today" ? "Bugün ödeme gününüz" : "Ödeme hatırlatması";
  const href = `/veli-odemeler?child=${encodeURIComponent(childId)}${previewGuardian ? `&previewGuardian=${encodeURIComponent(previewGuardian)}` : ""}`;
  const text = reminder.dueDate ? `${date(reminder.dueDate)} vadeli kalan ödeme: ${money(reminder.amount)}.` : `Kalan borç: ${money(reminder.debt)}. Vade tarihi henüz belirlenmedi.`;
  return <>
    <section className={`guardianPaymentReminder ${reminder.state}`} aria-label="Ödeme hatırlatması">
      <div><strong><span className="guardianReminderDot" aria-hidden="true"/>{title}</strong><p>{text}</p>{reminder.amount < reminder.debt ? <small>Toplam kalan borç: {money(reminder.debt)}</small> : null}</div>
      <Link href={href}>Ödeme detaylarını gör →</Link>
    </section>
    {notice === key ? <aside className="guardianPaymentToast" role="status" aria-live="polite"><button type="button" aria-label="Ödeme bildirimini kapat" onClick={() => setNotice(null)}>×</button><strong>{title}</strong><p>{text}</p><Link href={href} onClick={() => setNotice(null)}>Ödemelerimi aç</Link></aside> : null}
  </>;
}
