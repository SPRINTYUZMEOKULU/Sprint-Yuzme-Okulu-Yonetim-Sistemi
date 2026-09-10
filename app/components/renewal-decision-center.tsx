"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

type Item = {
  studentId: string;
  studentNumber: string | null;
  name: string;
  totalLessons: number;
  usedLessons: number;
  remainingLessons: number;
  plannedEndDate: string | null;
  reason: string;
  passiveRequestPending: boolean;
};

function fmt(value?: string | null) {
  if (!value) return "—";
  const d = new Date(`${value}T12:00:00`);
  return Number.isNaN(d.getTime()) ? value : new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(d);
}

export default function RenewalDecisionCenter() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [items, setItems] = useState<Item[]>([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const visiblePage = pathname === "/" || pathname === "/ogrenciler" || pathname === "/kayit-yenilemeleri";

  useEffect(() => {
    if (!visiblePage) return;
    let cancelled = false;
    setLoading(true);
    fetch("/api/renewal-decision-queue", { cache: "no-store" })
      .then((r) => r.json().then((x) => ({ ok: r.ok, x })))
      .then(({ ok, x }) => {
        if (!cancelled && ok && x?.ok) {
          setItems(Array.isArray(x.items) ? x.items : []);
          setIndex(0);
        }
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [visiblePage, pathname]);

  useEffect(() => {
    if (!pathname.match(/^\/ogrenciler\/[^/]+$/)) return;
    if (searchParams.get("renewal") !== "1") return;
    const timer = window.setTimeout(() => window.dispatchEvent(new CustomEvent("sprint:open-renewal")), 350);
    return () => window.clearTimeout(timer);
  }, [pathname, searchParams]);

  useEffect(() => {
    if (pathname !== "/ogrenciler/pasif-merkezi") return;
    const studentId = searchParams.get("studentId");
    if (!studentId) return;
    const run = () => {
      const tab = Array.from(document.querySelectorAll<HTMLButtonElement>(".pcStats button")).find((b) => b.textContent?.includes("Pasife Alınabilir Aktif"));
      tab?.click();
      window.setTimeout(() => {
        const link = document.querySelector<HTMLAnchorElement>(`.pcGrid a[href='/ogrenciler/${studentId}']`);
        const card = link?.closest("article");
        const button = Array.from(card?.querySelectorAll<HTMLButtonElement>("button") || []).find((b) => b.textContent?.includes("Bu Öğrenciyi Pasife Al"));
        button?.click();
      }, 250);
    };
    const timer = window.setTimeout(run, 350);
    return () => window.clearTimeout(timer);
  }, [pathname, searchParams]);

  if (!visiblePage || loading || !items.length) return null;
  const current = items[Math.min(index, items.length - 1)];

  return (
    <aside className="renewalDecision" role="status" aria-live="polite">
      <div className="rdIcon">!</div>
      <div className="rdMain">
        <div className="rdTop"><span>KAYIT KARARI GEREKİYOR</span><b>{items.length} kursiyer</b></div>
        <h3>{current.name}</h3>
        <p>{current.reason}. Kayıt yenilenmeyecekse pasife alınması gerekiyor.</p>
        <small>{current.studentNumber ? `${current.studentNumber} · ` : ""}Bitiş: {fmt(current.plannedEndDate)} · Kalan ders: {current.remainingLessons}</small>
        <div className="rdActions">
          <a className="renew" href={`/ogrenciler/${current.studentId}?renewal=1`}>↻ Kayıt Yenile</a>
          <a className="passive" href={`/ogrenciler/pasif-merkezi?studentId=${current.studentId}`}>{current.passiveRequestPending ? "Pasife Alma Onay Bekliyor" : "Pasife Al"}</a>
          {items.length > 1 ? <button type="button" onClick={() => setIndex((i) => (i + 1) % items.length)}>Sonraki →</button> : null}
          <a className="all" href="/kayit-yenilemeleri">Tümünü Gör</a>
        </div>
      </div>
      <style jsx>{`
        .renewalDecision{position:fixed;right:22px;bottom:22px;z-index:1450;width:min(520px,calc(100vw - 28px));display:flex;gap:13px;padding:16px;border:1px solid #f0c36a;border-radius:18px;background:#fffaf0;box-shadow:0 18px 55px rgba(42,51,67,.18);font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#17345b}.rdIcon{width:38px;height:38px;flex:0 0 38px;display:grid;place-items:center;border-radius:12px;background:#fff0cc;color:#9a6100;font-size:19px;font-weight:950}.rdMain{min-width:0;flex:1}.rdTop{display:flex;align-items:center;justify-content:space-between;gap:10px}.rdTop span{font-size:9px;letter-spacing:.11em;font-weight:950;color:#9a6100}.rdTop b{font-size:10px;color:#7d5c1c}.rdMain h3{margin:5px 0 3px;font-size:15px}.rdMain p{margin:0;color:#665d4a;font-size:11px;line-height:1.45}.rdMain small{display:block;margin-top:5px;color:#8a7b61;font-size:10px}.rdActions{display:flex;gap:7px;flex-wrap:wrap;margin-top:11px}.rdActions a,.rdActions button{min-height:36px;padding:0 11px;border-radius:10px;border:1px solid #d7e1ec;background:#fff;color:#355b7d;text-decoration:none;font-size:11px;font-weight:900;display:inline-flex;align-items:center;justify-content:center;cursor:pointer}.rdActions .renew{background:#1769e0;border-color:#1769e0;color:#fff}.rdActions .passive{background:#fff1f0;border-color:#efc0bb;color:#b42318}.rdActions .all{margin-left:auto}@media(max-width:640px){.renewalDecision{right:12px;bottom:12px;padding:13px}.rdActions a,.rdActions button{flex:1 1 calc(50% - 5px)}.rdActions .all{margin-left:0}}
      `}</style>
    </aside>
  );
}
