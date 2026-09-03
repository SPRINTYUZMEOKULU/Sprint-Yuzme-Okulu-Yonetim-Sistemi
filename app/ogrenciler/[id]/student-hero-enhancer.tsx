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
  { href: "#genel-bilgiler", label: "Genel Bilgiler", icon: "⌂" },
  { href: "#kurs-kaydi", label: "Kayıt & Program", icon: "▣" },
  { href: "#odeme", label: "Ödeme", icon: "₺" },
  { href: "#mesajlar", label: "Mesajlar", icon: "✉" },
] as const;

export default function StudentHeroEnhancer() {
  useEffect(() => {
    const enhance = () => {
      const hero = document.querySelector<HTMLElement>(".studentFilePage .studentHero");
      if (!hero) return;

      const status = hero.querySelector<HTMLElement>(".heroBadges .status");
      if (status) {
        const raw = (status.textContent || "").trim();
        const key = raw.toLocaleLowerCase("tr-TR").replace(/\s+/g, "_");
        status.textContent = STATUS_LABELS[key] || raw || "Aktif";
      }

      if (hero.querySelector("[data-hero-actions='1']")) return;

      const backButton = hero.querySelector<HTMLAnchorElement>(".backButton");
      if (!backButton) return;

      const actions = document.createElement("nav");
      actions.className = "heroTopActions";
      actions.dataset.heroActions = "1";
      actions.setAttribute("aria-label", "Öğrenci dosyası hızlı bağlantıları");

      for (const item of HERO_LINKS) {
        const link = document.createElement("a");
        link.href = item.href;
        link.className = "heroTopAction";
        link.innerHTML = `<span aria-hidden="true">${item.icon}</span><b>${item.label}</b>`;
        actions.appendChild(link);
      }

      backButton.classList.add("heroTopBack");
      actions.appendChild(backButton);
      hero.appendChild(actions);
    };

    enhance();
    const observer = new MutationObserver(enhance);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return (
    <style jsx global>{`
      .studentHero .heroTopActions {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 8px;
        flex-wrap: wrap;
        max-width: 580px;
        margin-left: auto;
      }
      .studentHero .heroTopAction,
      .studentHero .heroTopBack {
        min-height: 38px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 7px;
        padding: 9px 12px;
        border: 1px solid rgba(255,255,255,.22);
        border-radius: 12px;
        color: #fff;
        background: rgba(255,255,255,.09);
        text-decoration: none;
        font-size: 12px;
        font-weight: 800;
        white-space: nowrap;
        transition: background .18s ease, transform .18s ease, border-color .18s ease;
      }
      .studentHero .heroTopAction:hover,
      .studentHero .heroTopBack:hover {
        background: rgba(255,255,255,.17);
        border-color: rgba(255,255,255,.38);
        transform: translateY(-1px);
      }
      .studentHero .heroTopAction span {
        font-size: 14px;
        font-weight: 900;
        color: #ffd27a;
      }
      .studentHero .heroTopBack {
        background: rgba(4,24,48,.3);
      }
      @media (max-width: 1120px) {
        .studentHero { align-items: flex-start; flex-wrap: wrap; }
        .studentHero .heroTopActions { width: 100%; max-width: none; margin-left: 98px; justify-content: flex-start; }
      }
      @media (max-width: 680px) {
        .studentHero .heroTopActions { margin-left: 0; overflow-x: auto; flex-wrap: nowrap; justify-content: flex-start; padding-bottom: 3px; }
        .studentHero .heroTopAction,.studentHero .heroTopBack { flex: 0 0 auto; }
      }
    `}</style>
  );
}
