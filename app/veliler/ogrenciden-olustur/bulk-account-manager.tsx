"use client";

import PortalCredentialManager from "../portal-credential-manager";
import { portalMessage } from "@/lib/guardian/portal-message";
import { rememberPortalCredential, portalCredentialDraft } from "@/lib/guardian/credential-draft";
import { portalCredentialContact } from "../portal-credential-actions";
import { useMemo, useState } from "react";
import { prepareGuardianAccountBatch, type GuardianBulkResult } from "./bulk-account-actions";

export type GuardianBulkCandidate = { key: string; fullName: string; phone: string; studentIds: string[]; studentNames: string[]; state: "new" | "pending" | "active" };

function whatsappPhone(value: string) { let digits = String(value || "").replace(/\D/g, ""); if (digits.startsWith("0")) digits = digits.slice(1); return digits.startsWith("90") ? digits : `90${digits}`; }
function message(result: GuardianBulkResult) {return portalMessage({...result,password:result.password || ""},window.location.origin);}

export default function BulkAccountManager({ candidates }: { candidates: GuardianBulkCandidate[] }) {
  const recommended = useMemo(() => candidates.filter((item) => item.state !== "active").map((item) => item.key), [candidates]);
  const [selected, setSelected] = useState<Set<string>>(() => new Set(recommended));
  const [resetExisting,setResetExisting]=useState(false);
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
        const chunkResults = await prepareGuardianAccountBatch(chunk.flatMap((item) => item.studentIds),resetExisting);
        for(const value of chunkResults) if(value.ok && value.password && value.accountId && value.revision) rememberPortalCredential({...value,password:value.password,accountId:value.accountId,revision:value.revision});
        all.push(...chunkResults); setResults([...all]); setProgress(Math.min(selectedCandidates.length, all.length));
      }
    } catch (error) {
      all.push({ ok: false, key: "request", fullName: "Toplu işlem", phone: "", email: "", studentNames: [], status: "error", message: error instanceof Error ? error.message : "Toplu hesap işlemi tamamlanamadı." });
      setResults([...all]);
    } finally { setBusy(false); }
  }
  async function openNext() {
    if(!current?.accountId || !current.revision)return;
    const contact=await portalCredentialContact({accountId:current.accountId});
    if(!contact.ok || contact.revision!==current.revision || !portalCredentialDraft(current.accountId,current.revision)) {setResults(rows=>rows.map(row=>row.accountId===current.accountId?{...row,password:undefined,message:"Şifre değişti veya paylaşım süresi doldu. Giriş bilgileri alanını kullanın."}:row));return;}
    window.location.assign(`https://wa.me/${whatsappPhone(contact.phone)}?text=${encodeURIComponent(message({...current,...contact}))}`);
    setSendIndex(index=>Math.min(index+1,successful.length));
  }
  return <section className="bulkGuardianPanel"><div className="bulkGuardianHead"><div><small>TOPLU VELİ HESABI VE ŞİFRE GÖNDERİMİ</small><h2>Velileri öğrencilerden otomatik hazırla</h2><p>Hesabı olmayanlar ve ilk girişi bekleyenler seçili gelir. Mevcut hesapların şifresi korunur. Şifre yenileme için aşağıdaki ayrı seçeneği işaretleyin.</p></div><span>{selected.size} veli seçili</span></div><label><input type="checkbox" checked={resetExisting} disabled={busy} onChange={e=>setResetExisting(e.target.checked)}/> Seçilen mevcut hesapların şifresini de yenile (aynı hesaba bağlı tüm kursiyerleri etkiler)</label><div className="bulkGuardianTools"><button type="button" onClick={() => setSelected(new Set(recommended))}>Önerilenleri Seç</button><button type="button" onClick={() => setSelected(new Set(candidates.map((item) => item.key)))}>Tüm Uygun Velileri Seç</button><button type="button" onClick={() => setSelected(new Set())}>Seçimi Temizle</button><button className="primary" type="button" disabled={busy || !selected.size} onClick={prepare}>{busy ? `Hazırlanıyor… ${progress}/${selectedCandidates.length}` : "Seçilenlere Hesap + Şifre Hazırla"}</button></div><details className="bulkGuardianList" open={candidates.length <= 12}><summary>Seçilecek velileri göster ({candidates.length})</summary><div>{candidates.map((item) => <label key={item.key} className={item.state === "active" ? "active" : ""}><input type="checkbox" checked={selected.has(item.key)} disabled={busy} onChange={() => toggle(item.key)}/><span><strong>{item.fullName}</strong><small>{item.phone} · {item.studentNames.join(", ")}</small></span><em>{item.state === "new" ? "Hesap oluşturulacak" : item.state === "pending" ? "İlk giriş bekleniyor" : "Aktif hesap · şifre korunur"}</em></label>)}</div></details>{results.length ? <div className="bulkGuardianResults"><div className="bulkResultSummary"><strong>{successful.length} veli için giriş bilgileri hazır</strong><span>{results.filter((item) => !item.ok).length ? `${results.filter((item) => !item.ok).length} işlem tamamlanamadı` : "Tüm işlemler tamamlandı"}</span></div>{current ? <button type="button" className="whatsapp" onClick={openNext}>📲 WhatsApp Mesajını Aç ({sendIndex + 1}/{successful.length}) · {current.fullName}</button> : successful.length ? <div className="bulkDone">✓ Seçilen tüm WhatsApp giriş mesajları açıldı.</div> : null}<div className="bulkResultRows">{results.map((item) => <div key={item.key} className={item.ok ? "ok" : "error"}><span>{item.ok ? "✓" : "!"}</span><p><strong>{item.fullName}</strong><small>{item.message}</small></p>{item.ok && item.accountId ? <details><summary>Giriş bilgileri ve kopyalama</summary><PortalCredentialManager accountId={item.accountId}/></details> : null}</div>)}</div></div> : null}</section>;
}
