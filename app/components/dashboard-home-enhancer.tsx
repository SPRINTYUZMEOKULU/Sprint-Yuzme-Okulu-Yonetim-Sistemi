"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";

import { Icons } from "@/app/components/dashboard-icons";

type FavoriteItem = {
  label: string;
  href: string;
  icon: keyof typeof Icons;
  tone: string;
};

const favorites: FavoriteItem[] = [
  { label: "Öğrenciler", href: "/ogrenciler", icon: "child", tone: "blue" },
  { label: "Ön Kayıtlar", href: "/on-kayitlar", icon: "note", tone: "orange" },
  { label: "Ödemeler", href: "/odemeler", icon: "wallet", tone: "green" },
  { label: "Yoklama", href: "/yoklama", icon: "check", tone: "purple" },
  { label: "Gruplar", href: "/gruplar", icon: "branch", tone: "navy" },
  { label: "Hazır Mesajlar", href: "/hazir-mesajlar", icon: "message", tone: "cyan" },
];

function FavoriteBar() {
  return (
    <div className="homeFavoriteWrap" aria-label="Sık kullanılan işlemler">
      <div className="homeFavoriteHead">
        <div>
          <span>SIK KULLANILANLAR</span>
          <strong>Hızlı işlem merkezi</strong>
        </div>
        <Link href="/on-kayit" className="favoritePrimary">
          <b>+</b>
          <span>Yeni Ön Kayıt</span>
        </Link>
      </div>

      <div className="homeFavoriteGrid">
        {favorites.map((item) => {
          const Icon = Icons[item.icon];
          return (
            <Link key={item.href} href={item.href} className={`favoriteMini ${item.tone}`}>
              <i><Icon /></i>
              <span>{item.label}</span>
              <b>›</b>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export default function DashboardHomeEnhancer() {
  const pathname = usePathname();
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [isCoach, setIsCoach] = useState(false);

  useEffect(() => {
    if (pathname !== "/") {
      setHost(null);
      return;
    }

    const timer = window.setTimeout(() => {
      const target = document.querySelector<HTMLElement>(".heroActions");
      if (!target) return;

      const coachAction = target.textContent?.toLocaleLowerCase("tr-TR").includes("derse geldim") ?? false;
      setIsCoach(coachAction);
      if (!coachAction) {
        target.dataset.homeEnhanced = "true";
        setHost(target);
      }
    }, 0);

    return () => window.clearTimeout(timer);
  }, [pathname]);

  if (pathname !== "/" || isCoach || !host) return null;

  return (
    <>
      {createPortal(<FavoriteBar />, host)}
      <style jsx global>{`
        .heroActions[data-home-enhanced="true"] {
          width: min(720px, 58vw);
          display: block !important;
        }
        .heroActions[data-home-enhanced="true"] > a {
          display: none !important;
        }
        .homeFavoriteWrap {
          width: 100%;
          box-sizing: border-box;
          padding: 20px;
          border: 1px solid #dce5f1;
          border-radius: 22px;
          background: linear-gradient(145deg,#fff,#f7faff);
          box-shadow: 0 12px 32px rgba(23,48,83,.07);
        }
        .homeFavoriteHead {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 16px;
        }
        .homeFavoriteHead > div > span {
          display: block;
          color: #7185a1;
          font-size: 10px;
          font-weight: 850;
          letter-spacing: 1.2px;
        }
        .homeFavoriteHead > div > strong {
          display: block;
          margin-top: 5px;
          color: #142846;
          font-size: 17px;
          line-height: 1.3;
        }
        .favoritePrimary {
          min-height: 42px !important;
          padding: 0 14px !important;
          display: inline-flex !important;
          align-items: center;
          gap: 8px;
          flex-shrink: 0;
          border: 0 !important;
          border-radius: 13px !important;
          background: linear-gradient(135deg,#176de9,#0f5cca) !important;
          color: #fff !important;
          text-decoration: none;
          box-shadow: 0 6px 14px rgba(23,109,233,.2);
          font-size: 12px !important;
          font-weight: 850 !important;
        }
        .favoritePrimary b { font-size: 20px; line-height: 1; }
        .homeFavoriteGrid {
          display: grid;
          grid-template-columns: repeat(3,minmax(0,1fr));
          gap: 12px;
        }
        .favoriteMini {
          --favorite-color: #176de9;
          --favorite-tint: #edf4ff;
          min-width: 0;
          min-height: 88px !important;
          box-sizing: border-box;
          padding: 14px !important;
          display: grid !important;
          grid-template-columns: 42px minmax(0,1fr) 16px;
          align-items: center;
          gap: 10px !important;
          border: 1px solid #dfe7f2 !important;
          border-radius: 17px !important;
          background: linear-gradient(135deg,#fff,var(--favorite-tint)) !important;
          color: #233754 !important;
          text-decoration: none;
          font-size: 13px !important;
          font-weight: 850 !important;
          box-shadow: 0 3px 8px rgba(23,48,83,.035) !important;
          transition: transform .18s ease, box-shadow .18s ease, border-color .18s ease;
          touch-action: manipulation;
        }
        .favoriteMini i {
          width: 42px;
          height: 42px;
          display: grid;
          place-items: center;
          border: 1px solid rgba(255,255,255,.8);
          border-radius: 14px;
          background: var(--favorite-color);
          color: #fff;
          box-shadow: 0 5px 10px rgba(23,48,83,.12);
        }
        .favoriteMini i svg { width: 22px; height: 22px; }
        .favoriteMini > span { line-height: 1.35; overflow-wrap: anywhere; }
        .favoriteMini > b {
          display: grid;
          place-items: center;
          color: var(--favorite-color);
          font-size: 22px;
          font-weight: 500;
        }
        .favoriteMini:hover { transform: translateY(-2px); border-color: var(--favorite-color) !important; box-shadow: 0 9px 20px rgba(23,74,140,.1) !important; }
        .favoriteMini:active { transform: scale(.98); }
        .favoriteMini:focus-visible, .favoritePrimary:focus-visible { outline: 3px solid #176de9; outline-offset: 3px; }
        .favoriteMini.orange { --favorite-color:#c76a08; --favorite-tint:#fff4e8; }
        .favoriteMini.green { --favorite-color:#13815a; --favorite-tint:#edf9f2; }
        .favoriteMini.purple { --favorite-color:#7351df; --favorite-tint:#f3efff; }
        .favoriteMini.navy { --favorite-color:#24466e; --favorite-tint:#eef3f9; }
        .favoriteMini.cyan { --favorite-color:#087d93; --favorite-tint:#edf9fc; }
        @media (prefers-reduced-motion: reduce) {
          .favoriteMini { transition: none; }
          .favoriteMini:hover, .favoriteMini:active { transform: none; }
        }

        .proStat {
          border-width: 1.5px !important;
          box-shadow: 0 9px 25px rgba(19,43,76,.055) !important;
          transition: transform .16s ease, box-shadow .16s ease, border-color .16s ease, background .16s ease !important;
          touch-action: manipulation;
        }
        .proStat.blue { border-color: #c9ddfb !important; }
        .proStat.orange { border-color: #f6d8b9 !important; }
        .proStat.red { border-color: #f5cecf !important; }
        .proStat.purple { border-color: #ddd5fa !important; }
        .proStat.green { border-color: #c7ead9 !important; }
        .proStat:hover { transform: translateY(-2px); box-shadow: 0 14px 30px rgba(18,54,105,.09) !important; }
        .proStat:active {
          transform: scale(.975);
          box-shadow: 0 0 0 5px rgba(23,109,233,.12), 0 12px 28px rgba(18,54,105,.08) !important;
          background: #fafdff !important;
        }
        .proStat.orange:active { box-shadow: 0 0 0 5px rgba(230,126,34,.13), 0 12px 28px rgba(18,54,105,.08) !important; }
        .proStat.red:active { box-shadow: 0 0 0 5px rgba(229,72,77,.12), 0 12px 28px rgba(18,54,105,.08) !important; }
        .proStat.purple:active { box-shadow: 0 0 0 5px rgba(124,77,255,.12), 0 12px 28px rgba(18,54,105,.08) !important; }

        .liveOpsHeadline {
          padding: 14px 15px;
          margin-bottom: 11px !important;
          border: 1px solid #dde6f1;
          border-radius: 17px;
          background: linear-gradient(135deg,rgba(255,255,255,.96),rgba(247,250,255,.96));
          box-shadow: 0 8px 22px rgba(18,43,76,.04);
        }
        .liveOpsSummary { gap: 10px !important; }
        .liveSummaryCard {
          border-width: 1.5px !important;
          box-shadow: 0 7px 20px rgba(18,43,76,.045) !important;
        }
        .livePanel {
          border-color: #d9e3ef !important;
          box-shadow: 0 10px 28px rgba(18,43,76,.05) !important;
        }
        .livePanelHead {
          background: linear-gradient(180deg,#fff,#fbfcfe);
        }
        .priorityRow,
        .lessonRow,
        .birthdayRow {
          transition: background .15s ease, transform .15s ease;
        }
        .priorityRow:active,
        .lessonRow:active,
        .birthdayRow:active {
          background: #f5f9ff !important;
        }

        @media (max-width: 820px) {
          .heroRow { margin-bottom: 15px !important; }
          .heroActions[data-home-enhanced="true"] {
            width: 100%;
            margin-top: 14px !important;
          }
          .homeFavoriteWrap { padding: 18px; border-radius: 20px; }
          .homeFavoriteGrid { grid-template-columns: repeat(3,minmax(0,1fr)); gap: 10px; }
          .favoriteMini { min-height: 84px !important; padding: 12px !important; grid-template-columns: 38px minmax(0,1fr) 12px; font-size: 12px !important; }
          .favoriteMini i { width: 38px; height: 38px; border-radius: 12px; }
        }

        @media (max-width: 520px) {
          .dashboardContent { padding-top: 18px !important; }
          .heroRow h1 { font-size: 24px !important; line-height: 1.08; }
          .heroRow > div > p:last-child { font-size: 11px !important; }
          .homeFavoriteHead { margin-bottom: 14px; gap: 8px; }
          .homeFavoriteHead > div > strong { font-size: 15px; }
          .favoritePrimary { min-height: 42px !important; padding: 0 11px !important; }
          .favoritePrimary span { font-size: 11px; }
          .homeFavoriteGrid { grid-template-columns: repeat(2,minmax(0,1fr)); }
          .favoriteMini { min-height: 100px !important; grid-template-columns: minmax(0,1fr) 14px; gap: 8px !important; }
          .favoriteMini i { grid-column: 1; width: 40px; height: 40px; }
          .favoriteMini > span { grid-column: 1; grid-row: 2; }
          .favoriteMini > b { grid-column: 2; grid-row: 1 / 3; }
          .homeFavoriteWrap { padding: 14px; }

          .proStats {
            grid-template-columns: repeat(2,minmax(0,1fr)) !important;
            gap: 9px !important;
            margin-bottom: 14px !important;
          }
          .proStat {
            min-height: 112px !important;
            padding: 13px !important;
            display: grid !important;
            grid-template-columns: 38px minmax(0,1fr);
            gap: 10px !important;
            border-radius: 15px !important;
          }
          .statIcon { width: 38px !important; height: 38px !important; border-radius: 12px !important; }
          .statIcon svg { width: 18px !important; }
          .proStat span { font-size: 9.5px !important; }
          .proStat strong { margin: 5px 0 3px !important; font-size: 24px !important; }
          .proStat small { font-size: 8.5px !important; line-height: 1.25; }

          .liveOpsShell { margin-top: 14px !important; }
          .liveOpsHeadline { padding: 13px !important; border-radius: 15px; }
          .liveOpsHeadline h2 { font-size: 21px !important; line-height: 1.08; }
          .liveOpsHeadline p { font-size: 10px !important; line-height: 1.45; }
          .liveOpsSignal { padding: 7px 9px !important; font-size: 9px !important; }
          .liveOpsSummary {
            grid-template-columns: repeat(2,minmax(0,1fr)) !important;
            gap: 8px !important;
          }
          .liveSummaryCard {
            min-height: 98px !important;
            padding: 12px !important;
            border-radius: 14px !important;
          }
          .liveSummaryCard strong { font-size: 25px !important; }
          .liveOpsGrid { gap: 10px !important; }
          .livePanel { border-radius: 16px !important; }
          .livePanelHead { padding: 14px !important; }
          .livePanelHead h3 { font-size: 15px !important; }
          .priorityRow { padding: 11px 13px !important; }
        }
      `}</style>
    </>
  );
}
