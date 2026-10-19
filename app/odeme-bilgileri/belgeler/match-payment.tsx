"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { matchDocumentPayment } from "./actions";

type Option = { id: string; label: string };
export default function MatchPayment({ requestId, payments }: { requestId: string; payments: Option[] }) {
  const [paymentId, setPaymentId] = useState("");
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  return <div className="match-payment"><label>Mevcut havale / EFT kaydı<select value={paymentId} onChange={e => setPaymentId(e.target.value)} disabled={pending}><option value="">Ödeme seçiniz</option>{payments.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}</select></label><button disabled={pending || !paymentId} onClick={() => startTransition(async () => { try { const result = await matchDocumentPayment(requestId, paymentId); setMessage(result.message); if (result.ok) router.refresh(); } catch { setMessage("İşlem tamamlanamadı. Tekrar deneyiniz."); } })}>{pending ? "Kaydediliyor…" : "Banka Girişini Kontrol Ettim · Eşleştir"}</button><p>Önce tutarı ve göndereni banka hareketinizle karşılaştırınız. Bu işlem fatura kesmez.</p><div role="status">{message}</div></div>;
}
