"use client";

import { useEffect, useRef, useState } from "react";

const tabs = [
  { id: "genel-bilgiler", label: "Genel Bilgiler" },
  { id: "kurs-kaydi", label: "Kayıt ve Program" },
  { id: "odeme", label: "Ödeme ve Kasa" },
  { id: "yoklama", label: "Yoklama" },
  { id: "ders-hareketleri", label: "Ders ve Telafi" },
  { id: "saglik", label: "Sağlık ve Beyanlar" },
  { id: "notlar", label: "Notlar" },
  { id: "mesajlar", label: "Mesajlar" },
  { id: "islem-gecmisi", label: "İşlem Geçmişi" },
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
  notlar: "notlar",
  mesajlar: "mesajlar",
  "islem-gecmisi": "islem-gecmisi",
};

function tabForHash(hash: string): TabId {
  return targetToTab[hash.replace(/^#/, "")] ?? "genel-bilgiler";
}

function headingTab(element: HTMLElement): TabId | null {
  const text = (element.textContent || "").toLocaleUpperCase("tr-TR");

  if (text.includes("ANTRENÖR RAPORLARI")) return "ders-hareketleri";
  if (text.includes("KAYIT GEÇMİŞİ")) return "kurs-kaydi";
  if (text.includes("KAYIT DURUMU")) return "kurs-kaydi";
  if (text.includes("MESAJ GEÇMİŞİ")) return "mesajlar";
  if (text.includes("İŞLEM GEÇMİŞİ")) return "islem-gecmisi";
  if (text.includes("NOTLAR")) return "notlar";

  return null;
}

function tabForElement(element: HTMLElement): TabId | null {
  if (element.id && targetToTab[element.id]) return targetToTab[element.id];

  const nestedIds = Array.from(element.querySelectorAll<HTMLElement>("[id]"))
    .map((node) => node.id)
    .filter(Boolean);

  for (const id of nestedIds) {
    if (targetToTab[id]) return targetToTab[id];
  }

  return headingTab(element);
}

function classifySections(root: HTMLElement) {
  for (const element of Array.from(root.children) as HTMLElement[]) {
    if (
      element.matches(
        ".studentHero,.smartAlertPanel,.metricGrid,.notice,.studentFileOperations,.studentFileTabs",
      )
    ) {
      continue;
    }

    const children = Array.from(element.children).filter((child): child is HTMLElement =>
      child instanceof HTMLElement,
    );

    const childTabs = children
      .map((child) => ({ child, tab: tabForElement(child) }))
      .filter((item): item is { child: HTMLElement; tab: TabId } => Boolean(item.tab));

    const uniqueTabs = new Set(childTabs.map((item) => item.tab));

    if (childTabs.length > 1 && uniqueTabs.size > 1) {
      element.dataset.fileTabContainer = "true";
      for (const { child, tab } of childTabs) child.dataset.fileTab = tab;
      continue;
    }

    const tab = tabForElement(element);
    if (tab) element.dataset.fileTab = tab;
  }
}

function applyVisibility(root: HTMLElement, tab: TabId) {
  root.dataset.activeTab = tab;

  for (const element of Array.from(
    root.querySelectorAll<HTMLElement>("[data-file-tab]"),
  )) {
    element.hidden = element.dataset.fileTab !== tab;
  }

  for (const container of Array.from(
    root.querySelectorAll<HTMLElement>("[data-file-tab-container]"),
  )) {
    const visibleChild = Array.from(
      container.querySelectorAll<HTMLElement>(":scope > [data-file-tab]"),
    ).some((child) => !child.hidden);
    container.hidden = !visibleChild;
  }
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
      applyVisibility(root, tab);

      if (scrollTarget) {
        window.requestAnimationFrame(() =>
          document.getElementById(scrollTarget)?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          }),
        );
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

      for (const element of Array.from(
        root.querySelectorAll<HTMLElement>("[data-file-tab],[data-file-tab-container]"),
      )) {
        element.hidden = false;
      }
    };
  }, []);

  const selectTab = (tab: TabId) => {
    const root = document.querySelector<HTMLElement>(".studentFilePage");
    setActiveTab(tab);
    if (root) applyVisibility(root, tab);
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
