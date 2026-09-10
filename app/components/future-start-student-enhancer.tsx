"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

function parseTrDate(value: string) {
  const match = value.match(/(\d{2})\.(\d{2})\.(\d{4})/);
  if (!match) return null;
  const date = new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]), 12, 0, 0, 0);
  return Number.isNaN(date.getTime()) ? null : date;
}

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0, 0);
}

function daysBetween(date: Date) {
  return Math.max(0, Math.round((date.getTime() - startOfToday().getTime()) / 86400000));
}

function findStartDate(card: HTMLElement) {
  const candidates = Array.from(card.querySelectorAll<HTMLElement>("span"));
  const label = candidates.find((node) => node.textContent?.trim() === "Başlangıç");
  if (!label) return null;
  const container = label.parentElement;
  const value = container?.querySelector<HTMLElement>("strong")?.textContent || "";
  return parseTrDate(value);
}

export default function FutureStartStudentEnhancer() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname !== "/ogrenciler" && pathname !== "/baslayacak-kursiyerler") return;

    let scheduled = false;

    function updateStudentCenter() {
      const today = startOfToday();
      const cards = Array.from(document.querySelectorAll<HTMLElement>(".studentCard"));
      let hidden = 0;

      for (const card of cards) {
        const badge = card.querySelector<HTMLElement>(".statusBadge")?.textContent?.trim() || "";
        const startDate = findStartDate(card);
        const isFutureStarter = badge === "Aktif" && Boolean(startDate && startDate.getTime() > today.getTime());
        card.dataset.futureStarter = isFutureStarter ? "1" : "0";
        card.style.display = isFutureStarter ? "none" : "";
        if (isFutureStarter) hidden += 1;
      }

      const resultInfo = document.querySelector<HTMLElement>(".resultInfo");
      if (resultInfo && hidden > 0) {
        const visible = cards.filter((card) => card.style.display !== "none").length;
        resultInfo.innerHTML = `<strong>${visible}</strong> öğrenci gösteriliyor <span class="futureStarterHint">· ${hidden} henüz başlamadı, Başlayacak Kursiyerler'de</span>`;
      }

      const selectAll = Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find((button) =>
        (button.textContent || "").includes("Görünenlerin tümünü seç")
      );
      if (selectAll) {
        selectAll.title = hidden > 0 ? "Henüz başlangıç tarihi gelmeyen kursiyerler seçime dahil edilmez." : "";
      }
    }

    function updateStartingCenter() {
      document.querySelectorAll<HTMLElement>(".startingGroup").forEach((group) => {
        const heading = group.querySelector("h2")?.textContent || "";
        const isToday = heading.includes("Bugün");
        group.querySelectorAll<HTMLElement>(".startingStudentCard").forEach((card) => {
          const existing = card.querySelector<HTMLElement>(".futureStartNotice");
          if (isToday) {
            existing?.remove();
            return;
          }
          if (existing) return;

          const text = card.textContent || "";
          const date = parseTrDate(text);
          const days = date ? daysBetween(date) : null;
          const notice = document.createElement("div");
          notice.className = "futureStartNotice";
          notice.innerHTML = `<span>⏳</span><div><strong>Henüz İlk Ders Zamanı Gelmedi</strong><small>${date ? `Başlangıç: ${date.toLocaleDateString("tr-TR")} · ${days === 1 ? "yarın" : `${days} gün kaldı`}` : "Planlanan başlangıç tarihi bekleniyor"}</small></div>`;
          const actions = card.querySelector(".startingStudentActions");
          if (actions) card.insertBefore(notice, actions);
          else card.appendChild(notice);
        });
      });
    }

    function run() {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(() => {
        scheduled = false;
        if (pathname === "/ogrenciler") updateStudentCenter();
        if (pathname === "/baslayacak-kursiyerler") updateStartingCenter();
      });
    }

    run();
    const observer = new MutationObserver(run);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [pathname]);

  if (pathname !== "/ogrenciler" && pathname !== "/baslayacak-kursiyerler") return null;

  return (
    <style jsx global>{`
      .futureStarterHint{font-size:12px;color:#8a5a08;font-weight:700;margin-left:5px}
      .futureStartNotice{display:flex;align-items:center;gap:10px;margin:12px 0;padding:11px 13px;border:1px solid #f4d8a0;border-radius:12px;background:#fff9ec;color:#70450a}
      .futureStartNotice>span{display:grid;place-items:center;width:32px;height:32px;border-radius:10px;background:#ffefc7;font-size:16px;flex:0 0 auto}
      .futureStartNotice>div{display:grid;gap:2px}.futureStartNotice strong{font-size:12px;font-weight:900}.futureStartNotice small{font-size:11px;color:#8a672d;font-weight:700}
    `}</style>
  );
}
