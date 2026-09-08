"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

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
type TabMeta = Partial<Record<TabId, { count?: number; ready?: boolean }>>;

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

const panelToTab: Record<string, TabId> = {
  general: "genel-bilgiler",
  registration: "kurs-kaydi",
  finance: "odeme",
  attendance: "yoklama",
  lessons: "ders-hareketleri",
  health: "saglik",
  notes: "notlar",
  messages: "mesajlar",
  history: "islem-gecmisi",
};

const tabToLegacyPanel: Record<TabId, string> = {
  "genel-bilgiler": "general",
  "kurs-kaydi": "registration",
  odeme: "finance",
  yoklama: "attendance",
  "ders-hareketleri": "lessons",
  saglik: "health",
  notlar: "notes",
  mesajlar: "messages",
  "islem-gecmisi": "history",
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
  const panel = element.dataset.filePanel;
  if (panel && panelToTab[panel]) return panelToTab[panel];
  if (element.id && targetToTab[element.id]) return targetToTab[element.id];

  for (const node of Array.from(
    element.querySelectorAll<HTMLElement>("[data-file-panel]"),
  )) {
    const nestedPanel = node.dataset.filePanel;
    if (nestedPanel && panelToTab[nestedPanel]) return panelToTab[nestedPanel];
  }

  for (const node of Array.from(element.querySelectorAll<HTMLElement>("[id]"))) {
    if (targetToTab[node.id]) return targetToTab[node.id];
  }
  return headingTab(element);
}

function classifySections(root: HTMLElement) {
  for (const panel of Array.from(
    root.querySelectorAll<HTMLElement>("[data-file-panel]"),
  )) {
    const key = panel.dataset.filePanel || "";
    const tab = panelToTab[key];
    if (tab) panel.dataset.fileTab = tab;
  }

  for (const element of Array.from(root.children) as HTMLElement[]) {
    if (
      element.matches(
        ".studentHero,.smartAlertPanel,.notice,.studentFileOperations,.studentFileTabsHost",
      )
    ) {
      continue;
    }

    const directPanelTab = element.dataset.filePanel
      ? panelToTab[element.dataset.filePanel]
      : null;
    if (directPanelTab) {
      element.dataset.fileTab = directPanelTab;
      continue;
    }

    const children = Array.from(element.children).filter(
      (child): child is HTMLElement => child instanceof HTMLElement,
    );
    const childTabs = children
      .map((child) => ({ child, tab: tabForElement(child) }))
      .filter((item): item is { child: HTMLElement; tab: TabId } => Boolean(item.tab));
    const uniqueTabs = new Set(childTabs.map((item) => item.tab));

    if (childTabs.length > 0 && uniqueTabs.size > 0) {
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
  /*
   * Sayfada eski data-file-panel görünürlük CSS'i de hâlâ kullanılıyor.
   * Yeni sekme ile bu state birlikte ilerlemezse içerik DOM'da açık olsa bile
   * eski CSS tarafından gizleniyor. İki görünürlük kaynağını burada eşitliyoruz.
   */
  root.dataset.activeFileTab = tabToLegacyPanel[tab];

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

function articleCount(root: HTMLElement, selector: string) {
  return root.querySelectorAll(`${selector} article`).length;
}

function readTabMeta(root: HTMLElement): TabMeta {
  const health = root.querySelector<HTMLElement>("#saglik");
  const healthReady = Boolean(
    health?.querySelector<HTMLInputElement>('input[name="health_declaration"]:checked') ||
      health?.querySelector<HTMLInputElement>('input[name="rules_accepted"]:checked') ||
      health?.querySelector<HTMLTextAreaElement>('textarea[name="health_note"]')?.value.trim(),
  );

  const registrationCount =
    root.querySelectorAll('[data-file-panel="registration"] .list article').length ||
    (root.querySelector("#kurs-kaydi") ? 1 : 0);

  return {
    "genel-bilgiler": { ready: Boolean(root.querySelector("#genel-bilgiler")) },
    "kurs-kaydi": {
      count: registrationCount,
      ready: Boolean(root.querySelector("#kurs-kaydi")),
    },
    odeme: { count: articleCount(root, "#odeme") },
    yoklama: { count: articleCount(root, "#yoklama") },
    "ders-hareketleri": { count: articleCount(root, "#ders-hareketleri") },
    saglik: { ready: healthReady },
    notlar: { count: articleCount(root, "#notlar") },
    mesajlar: { count: articleCount(root, "#mesajlar") },
    "islem-gecmisi": { count: articleCount(root, "#islem-gecmisi") },
  };
}

export default function StudentFileTabs() {
  const [activeTab, setActiveTab] = useState<TabId>("genel-bilgiler");
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [meta, setMeta] = useState<TabMeta>({});

  const nav = useMemo(
    () => (
      <nav className="studentFileTabs" aria-label="Öğrenci dosyası bölümleri">
        {tabs.map((tab) => {
          const item = meta[tab.id];
          const hasCount = typeof item?.count === "number";
          const badge = hasCount
            ? String(item?.count ?? 0)
            : item?.ready
              ? "✓"
              : null;

          return (
            <button
              key={tab.id}
              type="button"
              className={activeTab === tab.id ? "active" : ""}
              aria-current={activeTab === tab.id ? "page" : undefined}
              onClick={() => {
                const root = document.querySelector<HTMLElement>(".studentFilePage");
                setActiveTab(tab.id);
                if (root) applyVisibility(root, tab.id);
                window.history.replaceState(null, "", `#${tab.id}`);
                window.requestAnimationFrame(() => {
                  document
                    .querySelector<HTMLElement>(".studentFileTabsHost")
                    ?.scrollIntoView({ behavior: "smooth", block: "start" });
                });
              }}
            >
              <span>{tab.label}</span>
              {badge !== null ? (
                <em
                  className={
                    hasCount && Number(item?.count || 0) === 0 ? "empty" : "filled"
                  }
                >
                  {badge}
                </em>
              ) : null}
            </button>
          );
        })}
      </nav>
    ),
    [activeTab, meta],
  );

  useEffect(() => {
    const root = document.querySelector<HTMLElement>(".studentFilePage");
    if (!root) return;

    classifySections(root);
    root.classList.add("tabsReady");
    setMeta(readTabMeta(root));

    const portalHost = document.createElement("div");
    portalHost.className = "studentFileTabsHost";
    const alerts = root.querySelector(".smartAlertPanel");
    if (alerts) alerts.insertAdjacentElement("afterend", portalHost);
    else root.querySelector(".studentHero")?.insertAdjacentElement("afterend", portalHost);
    if (!portalHost.parentElement) root.prepend(portalHost);
    setHost(portalHost);

    const observer = new MutationObserver(() => setMeta(readTabMeta(root)));
    observer.observe(root, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["checked"],
    });

    const applyTab = (tab: TabId, scrollTarget?: string) => {
      setActiveTab(tab);
      applyVisibility(root, tab);
      setMeta(readTabMeta(root));
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

    syncFromHash();
    window.addEventListener("hashchange", syncFromHash);

    return () => {
      observer.disconnect();
      window.removeEventListener("hashchange", syncFromHash);
      root.classList.remove("tabsReady");
      delete root.dataset.activeTab;
      for (const element of Array.from(
        root.querySelectorAll<HTMLElement>("[data-file-tab],[data-file-tab-container]"),
      )) {
        element.hidden = false;
        delete element.dataset.fileTab;
        delete element.dataset.fileTabContainer;
      }
      portalHost.remove();
      setHost(null);
    };
  }, []);

  return host ? createPortal(nav, host) : null;
}
