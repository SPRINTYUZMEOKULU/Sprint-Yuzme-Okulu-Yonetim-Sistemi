"use client";

import PortalCredentialManager from "../portal-credential-manager";
import { portalSetupWhatsAppUrl } from "@/lib/guardian/portal-message";
import { rememberPortalCredential } from "@/lib/guardian/credential-draft";
import { confirmPortalSetupSent, createPortalSetupLink } from "../portal-credential-actions";
import { useMemo, useRef, useState } from "react";
import type { GuardianBulkResult } from "./bulk-account-actions";

export type GuardianBulkCandidate = { key: string; fullName: string; phone: string; studentIds: string[]; studentNames: string[]; state: "new" | "pending" | "active" };

async function prepareChunk(studentIds: string[], resetExisting: boolean) {
  const response = await fetch("/api/guardian-portal/bulk-prepare", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ studentIds, resetExisting }),
    signal: AbortSignal.timeout(40_000),
  });
  if (response.redirected) throw new Error("Oturumunuzu yenileyin ve tekrar deneyin.");
  const body = await response.json().catch(() => null);
  if (!response.ok || !Array.isArray(body?.results)) {
    throw new Error(body?.error || "Hazırlık isteği tamamlanamadı.");
  }
  return body.results as GuardianBulkResult[];
}

function CredentialDetails({ accountId }: { accountId: string }) {
  const [open, setOpen] = useState(false);
  return <details onToggle={event => setOpen(event.currentTarget.open)}>
    <summary>Giriş bilgileri ve kopyalama</summary>
    {open && <PortalCredentialManager accountId={accountId}/>}
  </details>;
}

export default function BulkAccountManager({ candidates }: { candidates: GuardianBulkCandidate[] }) {
  const recommended = useMemo(() => candidates.filter((item) => item.state !== "active").map((item) => item.key), [candidates]);
  const [selected, setSelected] = useState<Set<string>>(() => new Set(recommended));
  const [resetExisting,setResetExisting]=useState(false);
  const [busy, setBusy] = useState(false); const [progress, setProgress] = useState(0); const [results, setResults] = useState<GuardianBulkResult[]>([]); const [sendIndex, setSendIndex] = useState(0);
  const sharing = useRef(false);
  const [shareError, setShareError] = useState("");
  const [prepareError, setPrepareError] = useState("");
  const [pendingDispatch, setPendingDispatch] = useState("");
  const [shareBusy, setShareBusy] = useState(false);
  const failedPreparation = useRef<{ candidates: GuardianBulkCandidate[]; offset: number; reset: boolean } | null>(null);
  const selectedCandidates = candidates.filter((item) => selected.has(item.key)); const successful = results.filter((item, index) => item.ok && item.accountId && results.findIndex((entry) => entry.ok && entry.accountId === item.accountId) === index); const current = successful[sendIndex];
  const toggle = (key: string) => setSelected((currentSet) => { const next = new Set(currentSet); if (next.has(key)) next.delete(key); else next.add(key); return next; });
  async function prepare(resume = false) {
    if (busy || sharing.current || pendingDispatch) return;
    const previous = resume ? failedPreparation.current : null;
    const queue = previous?.candidates ?? selectedCandidates;
    if (!queue.length) return;
    let offset = previous?.offset ?? 0;
    const reset = previous?.reset ?? resetExisting;
    const all = resume ? [...results] : [];
    setBusy(true);
    setPrepareError("");
    failedPreparation.current = null;
    if (!resume) {
      setProgress(0);
      setResults([]);
      setSendIndex(0);
      setShareError("");
    }
    try {
      while (offset < queue.length) {
        const chunk = queue.slice(offset, offset + 2);
        const chunkResults = await prepareChunk(chunk.flatMap(item => item.studentIds), reset && offset !== previous?.offset);
        for (const value of chunkResults) {
          if (value.ok && value.password && value.accountId && value.revision) {
            rememberPortalCredential({ ...value, password: value.password, accountId: value.accountId, revision: value.revision });
          }
        }
        all.push(...chunkResults);
        offset += chunk.length;
        setResults([...all]);
        setProgress(offset);
      }
    } catch (error) {
      failedPreparation.current = { candidates: queue, offset, reset };
      setPrepareError(error instanceof Error && error.name !== "TimeoutError" ? error.message : "Sunucu zamanında yanıt vermedi.");
    } finally {
      setBusy(false);
    }
  }

  function advance() {
    setPendingDispatch("");
    setShareError("");
    setSendIndex(index => index + 1);
  }

  async function confirmSent() {
    if (!pendingDispatch || sharing.current) return;
    sharing.current = true;
    setShareBusy(true);
    try {
      const result = await confirmPortalSetupSent(pendingDispatch);
      if (result.ok) advance();
      else setShareError(result.message);
    } catch {
      setShareError("Gönderim kaydedilemedi. Tekrar deneyin.");
    } finally {
      sharing.current = false;
      setShareBusy(false);
    }
  }
  async function openNext() {
    if (!current?.accountId || pendingDispatch) return;
    if (sharing.current) return;
    sharing.current = true;
    setShareBusy(true);
    setShareError("");
    const target = window.open("about:blank", "_blank");
    if (!target) {
      setShareError("WhatsApp penceresine izin verip tekrar deneyin.");
      sharing.current = false;
      setShareBusy(false);
      return;
    }
    target.opener = null;
    try {
      const contact = await createPortalSetupLink({ accountId: current.accountId });
      if (!contact.ok) {
        target?.close();
        setShareError(contact.message);
        return;
      }
      const href = portalSetupWhatsAppUrl(contact, window.location.origin);
      target.location.replace(href);
      setPendingDispatch(contact.dispatchId);
    } catch {
      target?.close();
      setShareError("Şifre oluşturma mesajı açılamadı. Tekrar deneyin.");
    } finally {
      sharing.current = false;
      setShareBusy(false);
    }
  }
  return <section className="bulkGuardianPanel"><div className="bulkGuardianHead"><div><small>TOPLU VELİ HESABI VE ŞİFRE GÖNDERİMİ</small><h2>Velileri öğrencilerden otomatik hazırla</h2><p>Hesabı olmayanlar ve ilk girişi bekleyenler seçili gelir. Mevcut hesapların şifresi korunur. Şifre yenileme için aşağıdaki ayrı seçeneği işaretleyin.</p></div><span>{selected.size} veli seçili</span></div><label><input type="checkbox" checked={resetExisting} disabled={busy} onChange={e=>setResetExisting(e.target.checked)}/> Seçilen mevcut hesapların şifresini de yenile (aynı hesaba bağlı tüm kursiyerleri etkiler)</label><div className="bulkGuardianTools"><button type="button" disabled={busy} onClick={() => setSelected(new Set(recommended))}>Önerilenleri Seç</button><button type="button" disabled={busy} onClick={() => setSelected(new Set(candidates.map((item) => item.key)))}>Tüm Uygun Velileri Seç</button><button type="button" disabled={busy} onClick={() => setSelected(new Set())}>Seçimi Temizle</button><button className="primary" type="button" disabled={busy || shareBusy || !!pendingDispatch || !selected.size} onClick={() => void prepare()}>{busy ? `Hazırlanıyor… ${progress}/${selectedCandidates.length}` : "Seçilenlere Hesap + Şifre Hazırla"}</button></div>{prepareError && <p role="alert">{prepareError} <button type="button" disabled={busy || shareBusy || !!pendingDispatch} onClick={() => void prepare(true)}>Kaldığı Yerden Devam Et</button></p>}<details className="bulkGuardianList" open={candidates.length <= 12}><summary>Seçilecek velileri göster ({candidates.length})</summary><div>{candidates.map((item) => <label key={item.key} className={item.state === "active" ? "active" : ""}><input type="checkbox" checked={selected.has(item.key)} disabled={busy} onChange={() => toggle(item.key)}/><span><strong>{item.fullName}</strong><small>{item.phone} · {item.studentNames.join(", ")}</small></span><em>{item.state === "new" ? "Hesap oluşturulacak" : item.state === "pending" ? "İlk giriş bekleniyor" : "Aktif hesap · şifre korunur"}</em></label>)}</div></details>{results.length ? <div className="bulkGuardianResults"><div className="bulkResultSummary"><strong>{successful.length} veli için giriş bilgileri hazır</strong><span>{busy ? "Hazırlık devam ediyor" : prepareError ? "Hazırlık durakladı" : results.filter((item) => !item.ok).length ? `${results.filter((item) => !item.ok).length} işlem tamamlanamadı` : "Tüm işlemler tamamlandı"}</span></div>{current ? pendingDispatch ? <div className="bulkGuardianTools">
      <button className="whatsapp" type="button" disabled={shareBusy} onClick={confirmSent}>Gönderildi Olarak Kaydet · {current.fullName}</button>
      <button type="button" disabled={shareBusy} onClick={advance}>Göndermeden Geç</button>
    </div> : <>
      <button type="button" className="whatsapp" disabled={shareBusy} onClick={openNext}>WhatsApp Mesajını Aç ({sendIndex + 1}/{successful.length}) · {current.fullName}</button>
      {shareError && <button type="button" disabled={shareBusy} onClick={advance}>Bu Veliyi Atla</button>}
    </> : successful.length && !busy ? <div className="bulkDone">WhatsApp gönderim sırasının sonuna ulaşıldı.</div> : null}{shareError && <p role="alert">{shareError}</p>}<div className="bulkResultRows">{results.map((item, index) => <div key={`${item.key}-${index}`} className={item.ok ? "ok" : "error"}><span>{item.ok ? "✓" : "!"}</span><p><strong>{item.fullName}</strong><small>{item.message}</small></p>{item.ok && item.accountId ? <CredentialDetails accountId={item.accountId}/> : null}</div>)}</div></div> : null}</section>;
}
