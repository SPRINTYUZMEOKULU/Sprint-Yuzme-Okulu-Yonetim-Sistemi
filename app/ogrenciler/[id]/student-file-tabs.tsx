"use client";

import { useEffect, useState } from "react";

const tabs = [
  { id: "genel-bilgiler", label: "Genel Bilgiler" },
  { id: "kurs-kaydi", label: "Kayıt ve Program" },
  { id: "odeme", label: "Ödeme ve Kasa" },
  { id: "yoklama", label: "Yoklama" },
  { id: "ders-hareketleri", label: "Ders ve Telafi" },
  { id: "saglik", label: "Sağlık ve Beyanlar" },
] as const;

type TabId = (typeof tabs)[number]["id"];

const targetToTab: Record<string, TabId> = {
  "genel-bilgiler": "genel-bilgiler",
  duzenle: "genel-bilgiler",
  "kurs-kaydi": "kurs-kaydi",
  odeme: "odeme",
  yoklama: "yoklama",
  "ders-hareketleri": "ders-hareketleri",
  saglik: "saglik",
};

function tabForHash(hash: string): TabId {
  const target = hash.replace(/^#/, "");
  return targetToTab[target] ?? "genel-bilgiler";
}

export default function StudentFileTabs() {
  const [activeTab, setActiveTab] = useState<TabId>("genel-bilgiler");

  useEffect(() => {
    const root = document.querySelector<HTMLElement>(".studentFilePage");
    if (!root) return;

    root.classList.add("tabsReady");

    const applyTab = (tab: TabId, scrollTarget?: string) => {
      setActiveTab(tab);
      root.dataset.activeTab = tab;

      if (scrollTarget) {
        window.requestAnimationFrame(() => {
          document.getElementById(scrollTarget)?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
        });
      }
    };

    const syncFromHash = () => {
      const target = window.location.hash.replace(/^#/, "");
      applyTab(tabForHash(window.location.hash), target || undefined);
    };

    const onClick = (event: MouseEvent) => {
      const link = (event.target as Element | null)?.closest<HTMLAnchorElement>(
        'a[href^="#"]',
      );
      if (!link || !root.contains(link)) return;

      const target = link.getAttribute("href")?.slice(1);
      if (!target || !targetToTab[target]) return;

      event.preventDefault();
      const tab = targetToTab[target];
      window.history.replaceState(null, "", `#${target}`);
      applyTab(tab, target);
    };

    syncFromHash();
    window.addEventListener("hashchange", syncFromHash);
    root.addEventListener("click", onClick);

    return () => {
      root.classList.remove("tabsReady");
      delete root.dataset.activeTab;
      window.removeEventListener("hashchange", syncFromHash);
      root.removeEventListener("click", onClick);
    };
  }, []);

  const selectTab = (tab: TabId) => {
    const root = document.querySelector<HTMLElement>(".studentFilePage");
    setActiveTab(tab);
    if (root) root.dataset.activeTab = tab;
    window.history.replaceState(null, "", `#${tab}`);
  };

  return (
    <nav className="studentFileTabs" aria-label="Öğrenci dosyası bölümleri">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          className={activeTab === tab.id ? "active" : ""}
          aria-current={activeTab === tab.id ? "page" : undefined}
          onClick={() => selectTab(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  );
}
