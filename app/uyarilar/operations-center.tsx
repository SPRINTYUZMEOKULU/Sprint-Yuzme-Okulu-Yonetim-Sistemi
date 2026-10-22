"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { LiveData } from "@/app/components/dashboard-live-operations";
import { formatDisplayDate } from "@/lib/dates/display";

export default function OperationsCenter() {
  const [data, setData] = useState<LiveData | null>(null);
  const [error, setError] = useState(false);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let active = true;
    let controller: AbortController | undefined;
    let requestVersion = 0;
    async function load() {
      const current = ++requestVersion;
      controller?.abort();
      const request = new AbortController();
      controller = request;
      const timeout = window.setTimeout(() => request.abort(), 15000);
      try {
        const response = await fetch("/api/dashboard/live", { cache: "no-store", signal: request.signal });
        const result = await response.json() as LiveData;
        if (!response.ok || !result.ok) throw new Error();
        if (active && current === requestVersion) { setData(result); setError(false); }
      } catch {
        if (active && current === requestVersion) setError(true);
      } finally { window.clearTimeout(timeout); }
    }
    void load();
    const refresh = () => { if (document.visibilityState === "visible") void load(); };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    const timer = window.setInterval(refresh, 30000);
    return () => {
      active = false; controller?.abort(); window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [version]);

  if (!data) return <section className="alertsCard" role="status">
    <strong>{error ? "İşlemler yüklenemedi" : "Bekleyen işlemler kontrol ediliyor…"}</strong>
    {error && <button onClick={() => setVersion(v => v + 1)}>Tekrar dene</button>}
  </section>;

  const { summary } = data;
  const past = data.pastAttendance || [];
  const pending = data.sessions.filter(session => !session.cancelled && session.missingCount > 0);
  const count = past.length + summary.pendingAttendance + summary.pendingApprovals + summary.pendingCash + summary.openAlerts + summary.todayStartingStudents;
  const categories = [
    { label: "Bugünkü yoklamalar", value: summary.pendingAttendance, href: "#bugunku-islemler", tone: "orange" },
    { label: "Geçmiş yoklama takibi", value: past.length, href: "#gecmis-islemler", tone: "orange" },
    { label: "Başlayacak kursiyerler", value: summary.todayStartingStudents, href: "/baslayacak-kursiyerler?filter=today#kursiyer-listesi", tone: "blue" },
    { label: "Yönetici onayı", value: summary.pendingApprovals, href: "/onay-merkezi", tone: "blue" },
    { label: "Kasa onayı", value: summary.pendingCash, href: "/kasa?durum=handoff_pending", tone: "purple" },
    { label: "Sistem uyarıları", value: summary.openAlerts, href: "#acik-uyarilar", tone: "red" },
  ];
  return <>
    {error && <div className="alertsCard errorCard" role="status">Veriler yenilenemedi. Son alınan bilgiler gösteriliyor. <button onClick={() => setVersion(v => v + 1)}>Yeniden dene</button></div>}
    <section className="operationSummary" aria-live="polite">
      <div><span>{formatDisplayDate(data.date)}</span><strong>{count ? `${count} işlem bekliyor` : "Bekleyen işlem yok"}</strong><small>Ana sayfayla aynı canlı veriler · Her seans bir işlem sayılır.</small></div>
      <b className={count ? "operationBadge active" : "operationBadge"}>{count}</b>
    </section>
    <section className="operationGrid" aria-label="İşlem kategorileri">
      {categories.map(item => <Link href={item.href} className={`operationCard ${item.tone} ${item.value ? "hasWork" : ""}`} key={item.label}>
        <div className="operationTop"><span>{item.label}</span><strong>{item.value}</strong></div>
        <p>{item.value ? "Bekleyen kayıtları açın" : "Bekleyen işlem bulunmuyor"}</p><b>Kayıtları göster →</b>
      </Link>)}
    </section>
    <section className="alertsCard" id="bugunku-islemler">
      <div className="alertsTitle"><h2>Bugünkü Bekleyen Yoklamalar</h2><span>{pending.length} seans</span></div>
      <div className="alertsList">{pending.map(session => {
        const params = new URLSearchParams({ date: data.date, time: session.startTime });
        if (session.branchId) params.set("branchId", session.branchId);
        return <article className="alertRow warning" key={session.id}>
          <div className="alertPulse" aria-hidden="true" /><div className="alertBody">
            <div className="alertMeta"><span>{formatDisplayDate(data.date)} · {session.startTime}</span></div>
            <h3>{session.branchName}</h3><p>{session.groups.map(g => g.groupName).join(" · ")} · {session.missingCount} kursiyerin yoklaması eksik</p>
          </div><div className="alertActions"><Link href={`/yoklama?${params}`}>Yoklamayı Aç →</Link></div>
        </article>;
      })}{!pending.length && <p>Bugün bekleyen yoklama bulunmuyor.</p>}</div>
    </section>
    <section className="alertsCard" id="gecmis-islemler">
      <div className="alertsTitle"><h2>Geçmiş Yoklama Takibi</h2><span>{past.length} seans</span></div>
      <div className="alertsList">{past.map(item => <article className="alertRow warning" key={`${item.date}:${item.branchId}:${item.time}`}>
        <div className="alertPulse" aria-hidden="true" /><div className="alertBody">
          <div className="alertMeta"><span>{formatDisplayDate(item.date)} · {item.time}</span></div>
          <h3>{item.branchName}</h3><p>{item.missingCount} kursiyerin yoklaması eksik</p>
        </div><div className="alertActions"><Link href={item.href}>İlgili Yoklamayı Aç →</Link></div>
      </article>)}{!past.length && <p>{data.historyAvailable === false ? "Geçmiş yoklama bilgileri alınamadı." : "Takipte geçmiş yoklama bulunmuyor."}</p>}</div>
    </section>
    {summary.preRegistrations > 0 && <Link href="/on-kayitlar" className="preRegStrip"><div><strong>{summary.preRegistrations} ön kayıt takipte</strong><span>Ön kayıt takibi işlem toplamına dahil değildir.</span></div><b>Ön Kayıtları Aç →</b></Link>}
  </>;
}
