"use client";

import { useEffect } from "react";

const STATUS_LABELS: Record<string, string> = {
  active: "Aktif",
  passive: "Pasif",
  pre_registration: "Ön Kayıt",
  pending: "Beklemede",
  completed: "Tamamlandı",
  archived: "Arşivli",
  frozen: "Donduruldu",
  cancelled: "İptal",
};

const HERO_LINKS = [
  { href: "/", label: "Ana Panel", icon: "⌂" },
  { href: "/on-kayitlar", label: "Ön Kayıtlar", icon: "＋" },
  { href: "/gruplar", label: "Gruplar", icon: "▣" },
  { href: "/yoklama", label: "Yoklama", icon: "✓" },
  { href: "/odemeler", label: "Ödemeler", icon: "₺" },
  { href: "/kayit-yenilemeleri", label: "Yenilemeler", icon: "↻" },
  { href: "/onay-merkezi", label: "Onay Merkezi", icon: "◆" },
] as const;

export default function StudentHeroEnhancer() {
  useEffect(() => {
    const hero = document.querySelector<HTMLElement>(".studentFilePage .studentHero");
    if (!hero) return;

    const status = hero.querySelector<HTMLElement>(".heroBadges .status");
    if (status) {
      const raw = (status.textContent || "").trim();
      const key = raw.toLocaleLowerCase("tr-TR").replace(/\s+/g, "_");
      const translated = STATUS_LABELS[key] || raw || "Aktif";
      if (raw !== translated) status.textContent = translated;
    }

    if (hero.querySelector("[data-hero-actions='1']")) return;
    const backButton = hero.querySelector<HTMLAnchorElement>(".backButton");
    if (!backButton) return;

    const actions = document.createElement("nav");
    actions.className = "heroTopActions";
    actions.dataset.heroActions = "1";
    actions.setAttribute("aria-label", "SprintOS hızlı modül bağlantıları");

    for (const item of HERO_LINKS) {
      const link = document.createElement("a");
      link.href = item.href;
      link.className = "heroTopAction";
      link.innerHTML = `<span aria-hidden="true">${item.icon}</span><b>${item.label}</b>`;
      actions.appendChild(link);
    }

    backButton.textContent = "← Öğrenciler";
    backButton.classList.add("heroTopBack");
    actions.appendChild(backButton);
    hero.appendChild(actions);
  }, []);

  return (
    <style jsx global>{`
      .studentHero .heroTopActions{display:flex;align-items:center;justify-content:flex-end;gap:7px;flex-wrap:wrap;max-width:760px;margin-left:auto}
      .studentHero .heroTopAction,.studentHero .heroTopBack{min-height:39px;display:inline-flex;align-items:center;justify-content:center;gap:7px;padding:9px 11px;border:1px solid rgba(255,255,255,.22);border-radius:12px;color:#fff;background:rgba(255,255,255,.09);text-decoration:none;font-size:11.5px;font-weight:850;white-space:nowrap;touch-action:manipulation;-webkit-tap-highlight-color:transparent}
      .studentHero .heroTopAction span{font-size:14px;font-weight:900;color:#ffd27a}.studentHero .heroTopBack{background:rgba(4,24,48,.3)}
      @media(max-width:1180px){.studentHero{align-items:flex-start;flex-wrap:wrap}.studentHero .heroTopActions{width:100%;max-width:none;margin-left:98px;justify-content:flex-start}}
      @media(max-width:680px){.studentHero{padding:20px 16px;gap:14px}.studentHero .heroTopActions{margin-left:0;width:100%;overflow-x:auto;overscroll-behavior-x:contain;flex-wrap:nowrap;justify-content:flex-start;padding:2px 0 7px;-webkit-overflow-scrolling:touch}.studentHero .heroTopAction,.studentHero .heroTopBack{flex:0 0 auto;min-height:46px}}
    `}</style>
  );
}
