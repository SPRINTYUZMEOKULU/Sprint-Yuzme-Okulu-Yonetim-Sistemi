"use client";

import { useMemo, useState } from "react";
import { prepareGuardianAccountBatch, type GuardianBulkResult } from "./bulk-account-actions";

export type GuardianBulkCandidate = { key: string; fullName: string; phone: string; studentIds: string[]; studentNames: string[]; state: "new" | "pending" | "active" };

function whatsappPhone(value: string) { let digits = String(value || "").replace(/\D/g, ""); if (digits.startsWith("0")) digits = digits.slice(1); return digits.startsWith("90") ? digits : `90${digits}`; }
function message(result: GuardianBulkResult) { return [`Merhaba ${result.fullName || "Değerli Velimiz"},`, "", "SPRİNT YÜZME OKULU Veli / Kursiyer Portalı hesabınız hazırdır.", "", `Portal giriş adresi: ${window.location.origin}/login`, `Telefon: ${result.phone}`, result.email ? `E-posta: ${result.email}` : "", `Geçici giriş şifresi: ${result.password}`, "", "Giriş ekranında Veli Girişi bölümünü seçerek telefon numaranız ve geçici şifreniz ile giriş yapabilirsiniz.", "Güvenliğiniz için giriş yaptıktan sonra şifrenizi değiştirmenizi öneririz.", "", "SPRİNT YÜZME OKULU", "Bilgilendirme Hattı: 0551 896 83 19"].filter(Boolean).join("\n"); }

export default function BulkAccountManager({ candidates }: { candidates: GuardianBulkCandidate[] }) {
  const recommended = useMemo(() => candidates.filter((item) => item.state !== "active").map((item) => item.key), [candidates]);
  const [selected, setSelected] = useState<Set<string>>(() => new Set(recommended));
  const [busy, setBusy] = useState(false); const [progress, setProgress] = useState(0); const [results, setResults] = useState<GuardianBulkResult[]>([]); const [sendIndex, setSendIndex] = useState(0);
  const selectedCandidates = candidates.filter((item) => selected.has(item.key)); const successful = results.filter((item) => item.ok && item.password); const current = successful[sendIndex];
  const toggle = (key: string) => setSelected((currentSet) => { const next = new Set(currentSet); if (next.has(key)) next.delete(key); else next.add(key); return next; });
  async function prepare() {
    if (busy || !selectedCandidates.length) return;
    setBusy(true); setProgress(0); setResults([]); setSendIndex(0);
    const all: GuardianBulkResult[] = [];
    try {
      const chunks: GuardianBulkCandidate[][] = [];
      for (let i = 0; i < selectedCandidates.length; i += 10) chunks.push(selectedCandidates.slice(i, i + 10));
      for (const chunk of chunks) {
        const chunkResults = await prepareGuardianAccountBatch(chunk.flatMap((item) => item.studentIds));
        all.push(...chunkResults); setResults([...all]); setProgress(Math.min(selectedCandidates.length, all.length));
      }
    } catch (error) {
      all.push({ ok: false, key: "request", fullName: "Toplu işlem", phone: "", email: "", studentNames: [], status: "error", message: error instanceof Error ? error.message : "Toplu hesap işlemi tamamlanamadı." });
      setResults([...all]);
    } finally { setBusy(false); }
  }
  function openNext() { if (!current) return; window.open(`https://wa.me/${whatsappPhone(current.phone)}?text=${encodeURIComponent(message(current))}`, "_blank", "noopener,noreferrer"); setSendIndex((index) => Math.min(index + 1, successful.length)); }
  return <section className="bulkGuardianPanel"><div className="bulkGuardianHead"><div><small>TOPLU VELİ HESABI VE ŞİFRE GÖNDERİMİ</small><h2>Velileri öğrencilerden otomatik hazırla</h2><p>Hesabı olmayanlar ve ilk girişi bekleyenler seçili gelir. Daha önce giriş yapanların şifresi yalnızca siz seçerseniz yenilenir.</p></div><span>{selected.size} veli seçili</span></div><div className="bulkGuardianTools"><button type="button" onClick={() => setSelected(new Set(recommended))}>Önerilenleri Seç</button><button type="button" onClick={() => setSelected(new Set(candidates.map((item) => item.key)))}>Tüm Uygun Velileri Seç</button><button type="button" onClick={() => setSelected(new Set())}>Seçimi Temizle</button><button className="primary" type="button" disabled={busy || !selected.size} onClick={prepare}>{busy ? `Hazırlanıyor… ${progress}/${selectedCandidates.length}` : "Seçilenlere Hesap + Şifre Hazırla"}</button></div><details className="bulkGuardianList" open={candidates.length <= 12}><summary>Seçilecek velileri göster ({candidates.length})</summary><div>{candidates.map((item) => <label key={item.key} className={item.state === "active" ? "active" : ""}><input type="checkbox" checked={selected.has(item.key)} disabled={busy} onChange={() => toggle(item.key)}/><span><strong>{item.fullName}</strong><small>{item.phone} · {item.studentNames.join(", ")}</small></span><em>{item.state === "new" ? "Hesap oluşturulacak" : item.state === "pending" ? "İlk giriş bekleniyor" : "Aktif hesap · şifre yenilenir"}</em></label>)}</div></details>{results.length ? <div className="bulkGuardianResults"><div className="bulkResultSummary"><strong>{successful.length} veli için giriş bilgileri hazır</strong><span>{results.filter((item) => !item.ok).length ? `${results.filter((item) => !item.ok).length} işlem tamamlanamadı` : "Tüm işlemler tamamlandı"}</span></div>{current ? <button type="button" className="whatsapp" onClick={openNext}>📲 WhatsApp Mesajını Aç ({sendIndex + 1}/{successful.length}) · {current.fullName}</button> : successful.length ? <div className="bulkDone">✓ Seçilen tüm WhatsApp giriş mesajları açıldı.</div> : null}<div className="bulkResultRows">{results.map((item) => <div key={item.key} className={item.ok ? "ok" : "error"}><span>{item.ok ? "✓" : "!"}</span><p><strong>{item.fullName}</strong><small>{item.message}</small></p>{item.ok && item.password ? <code>{item.password}</code> : null}</div>)}</div></div> : null}</section>;
}
