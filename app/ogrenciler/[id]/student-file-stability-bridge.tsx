"use client";

import { useEffect } from "react";

const targetToTabLabel: Record<string, string> = {
  "genel-bilgiler": "Genel Bilgiler",
  duzenle: "Genel Bilgiler",
  "kurs-kaydi": "Kayıt ve Program",
  odeme: "Ödeme ve Kasa",
  yoklama: "Yoklama",
  "ders-hareketleri": "Ders ve Telafi",
  saglik: "Sağlık ve Beyanlar",
  notlar: "Notlar",
  mesajlar: "Mesajlar",
  "islem-gecmisi": "İşlem Geçmişi",
};

function keepLessonSummaryGlobal() {
  const metricGrid = document.querySelector<HTMLElement>(".studentFilePage .metricGrid");
  if (!metricGrid) return;

  metricGrid.hidden = false;
  metricGrid.removeAttribute("hidden");
  metricGrid.removeAttribute("data-file-panel");
  metricGrid.removeAttribute("data-file-tab");
  metricGrid.removeAttribute("aria-hidden");
}

function openCorrectTab(target: string) {
  const label = targetToTabLabel[target];
  if (!label) return;

  const button = Array.from(
    document.querySelectorAll<HTMLButtonElement>(".studentFileTabs button"),
  ).find((item) => (item.textContent || "").includes(label));

  button?.click();

  window.requestAnimationFrame(() => {
    document.getElementById(target)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  });
}

export default function StudentFileStabilityBridge() {
  useEffect(() => {
    keepLessonSummaryGlobal();

    const raf = window.requestAnimationFrame(keepLessonSummaryGlobal);
    const timer = window.setTimeout(keepLessonSummaryGlobal, 250);

    const observer = new MutationObserver(() => keepLessonSummaryGlobal());
    const root = document.querySelector<HTMLElement>(".studentFilePage");
    if (root) {
      observer.observe(root, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["hidden", "data-file-panel", "data-file-tab"],
      });
    }

    const onAlertClick = (event: MouseEvent) => {
      const link = (event.target as Element | null)?.closest<HTMLAnchorElement>(
        ".studentFilePage .smartAlertGrid a[href^='#']",
      );
      if (!link) return;

      const target = link.getAttribute("href")?.replace(/^#/, "") || "";
      if (!targetToTabLabel[target]) return;

      event.preventDefault();
      event.stopPropagation();
      openCorrectTab(target);
    };

    document.addEventListener("click", onAlertClick, true);

    return () => {
      window.cancelAnimationFrame(raf);
      window.clearTimeout(timer);
      observer.disconnect();
      document.removeEventListener("click", onAlertClick, true);
    };
  }, []);

  return null;
}
