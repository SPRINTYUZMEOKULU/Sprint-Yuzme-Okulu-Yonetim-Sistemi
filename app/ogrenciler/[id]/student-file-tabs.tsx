"use client";

import { useEffect, useRef, useState } from "react";

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
  notlar: "genel-bilgiler",
  "islem-gecmisi": "genel-bilgiler",
  mesajlar: "genel-bilgiler",
  "kurs-kaydi": "kurs-kaydi",
  odeme: "odeme",
  yoklama: "yoklama",
  "ders-hareketleri": "ders-hareketleri",
  saglik: "saglik",
};

function tabForHash(hash: string): TabId {
  return targetToTab[hash.replace(/^#/, "")] ?? "genel-bilgiler";
}

function classifySections(root: HTMLElement) {
  for (const element of Array.from(root.children) as HTMLElement[]) {
    if (element.matches(".studentHero,.smartAlertPanel,.metricGrid,.notice")) continue;

    const ids = [
      element.id,
      ...Array.from(element.querySelectorAll<HTMLElement>("[id]")).map((node) => node.id),
    ].filter(Boolean);
    let tab = ids.map((id) => targetToTab[id]).find(Boolean);

    if (!tab) {
      const text = element.textContent || "";
      if (text.includes("ANTRENÖR RAPORLARI")) tab = "ders-hareketleri";
      else if (text.includes("KAYIT GEÇMİŞİ")) tab = "kurs-kaydi";
      else if (
        text.includes("KAYIT DURUMU") ||
        text.includes("MESAJ GEÇMİŞİ") ||
        text.includes("NOTLAR") ||
        text.includes("İŞLEM GEÇMİŞİ")
      ) tab = "genel-bilgiler";
    }

    if (tab) element.dataset.fileTab = tab;
  }

  const generalRow = root.querySelector<HTMLElement>("#genel-bilgiler");
  if (generalRow) generalRow.dataset.mixedGeneralCourse = "true";
}

export default function StudentFileTabs() {
  const [activeTab, setActiveTab] = useState<TabId>("genel-bilgiler");
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const root = document.querySelector<HTMLElement>(".studentFilePage");
    const nav = navRef.current;
    if (!root || !nav) return;

    classifySections(root);
    root.classList.add("tabsReady");

    const alerts = root.querySelector(".smartAlertPanel");
    if (alerts) alerts.insertAdjacentElement("afterend", nav);
    else root.querySelector(".studentHero")?.insertAdjacentElement("afterend", nav);

    const applyTab = (tab: TabId, scrollTarget?: string) => {
      setActiveTab(tab);
      root.dataset.activeTab = tab;
      if (scrollTarget) {
        window.requestAnimationFrame(() =>
          document.getElementById(scrollTarget)?.scrollIntoView({ behavior: "smooth", block: "start" }),
        );
      }
    };

    const syncFromHash = () => {
      const target = window.location.hash.replace(/^#/, "");
      applyTab(tabForHash(window.location.hash), target || undefined);
    };

    const onClick = (event: MouseEvent) => {
      const link = (event.target as Element | null)?.closest<HTMLAnchorElement>('a[href^="#"]');
      if (!link || !root.contains(link)) return;
      const target = link.getAttribute("href")?.slice(1);
      if (!target || !targetToTab[target]) return;
      event.preventDefault();
      window.history.replaceState(null, "", `#${target}`);
      applyTab(targetToTab[target], target);
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
    <nav ref={navRef} className="studentFileTabs" aria-label="Öğrenci dosyası bölümleri">
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
