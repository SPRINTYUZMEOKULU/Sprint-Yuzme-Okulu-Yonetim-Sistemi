"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

const STORAGE_KEY = "sprintos-sidebar-collapsed";

const sidebarBranches: Record<string, Array<{ label: string; href: string }>> = {
  "/on-kayitlar": [
    { label: "Yeni Ön Kayıt", href: "/on-kayit" },
    { label: "Ön Kayıt Merkezi", href: "/on-kayitlar" },
    { label: "Kesin Kayıt Merkezi", href: "/kesin-kayit-merkezi" },
    { label: "Ön Kayıt Form Ayarları", href: "/ayarlar/on-kayit-formu" },
  ],
  "/ogrenciler": [
    { label: "Öğrenci Merkezi", href: "/ogrenciler" },
    { label: "Kesin Kayıt Merkezi", href: "/kesin-kayit-merkezi" },
    { label: "Kayıt Yenileme Merkezi", href: "/kayit-yenilemeleri" },
    { label: "Aktif Öğrenciler", href: "/ogrenciler?durum=active" },
    { label: "Pasif / Arşiv", href: "/ogrenciler?durum=passive" },
    { label: "Ders İptali / Telafi", href: "/ders-operasyonlari" },
  ],
  "/veliler": [
    { label: "Veli Merkezi", href: "/veliler" },
    { label: "Veli Talepleri", href: "/veli-talepleri" },
  ],
  "/subeler": [
    { label: "Şube Merkezi", href: "/subeler" },
    { label: "Gruplar", href: "/gruplar" },
    { label: "Ders Programı", href: "/ders-programi" },
  ],
  "/gruplar": [
    { label: "Grup Merkezi", href: "/gruplar" },
    { label: "Ders Programı", href: "/ders-programi" },
    { label: "Ders İptali / Telafi", href: "/ders-operasyonlari" },
  ],
  "/ders-programi": [
    { label: "Ders Programı", href: "/ders-programi" },
    { label: "Operasyon Planı", href: "/operasyon-plani" },
    { label: "Ders İptali / Telafi", href: "/ders-operasyonlari" },
    { label: "Yoklama", href: "/yoklama" },
  ],
  "/operasyon-plani": [
    { label: "Operasyon Planı", href: "/operasyon-plani" },
    { label: "Ders İptali / Telafi", href: "/ders-operasyonlari" },
    { label: "Ders Programı", href: "/ders-programi" },
    { label: "Yoklama", href: "/yoklama" },
  ],
  "/yoklama": [
    { label: "Yoklama Merkezi", href: "/yoklama" },
    { label: "Ders Programı", href: "/ders-programi" },
    { label: "Ders İptali / Telafi", href: "/ders-operasyonlari" },
  ],
  "/paketler": [
    { label: "Paket Yönetimi", href: "/paketler" },
    { label: "Ödemeler", href: "/odemeler" },
    { label: "Kesin Kayıt Merkezi", href: "/kesin-kayit-merkezi" },
  ],
  "/kasa": [
    { label: "Günlük Kasa", href: "/kasa" },
    { label: "Ödeme Merkezi", href: "/odemeler" },
  ],
  "/odemeler": [
    { label: "Ödeme Merkezi", href: "/odemeler" },
    { label: "Günlük Kasa", href: "/kasa" },
    { label: "Paketler", href: "/paketler" },
    { label: "Kesin Kayıt Merkezi", href: "/kesin-kayit-merkezi" },
  ],
  "/hazir-mesajlar": [
    { label: "Hazır Mesajlar", href: "/hazir-mesajlar" },
    { label: "Bildirimler", href: "/bildirimler" },
    { label: "Mesaj Ayarları", href: "/ayarlar/mesajlar" },
  ],
  "/bildirimler": [
    { label: "Bildirim Merkezi", href: "/bildirimler" },
    { label: "Uyarılar", href: "/uyarilar" },
    { label: "Bildirim Ayarları", href: "/ayarlar/bildirimler" },
  ],
  "/uyarilar": [
    { label: "Uyarı Merkezi", href: "/uyarilar" },
    { label: "Bildirim Merkezi", href: "/bildirimler" },
    { label: "Onay Merkezi", href: "/onay-merkezi" },
  ],
  "/onay-merkezi": [
    { label: "Onay Merkezi", href: "/onay-merkezi" },
    { label: "Onay Kuralları", href: "/ayarlar/onay-merkezi" },
    { label: "Değişiklik ve Denetim", href: "/denetim-merkezi" },
    { label: "Kullanıcılar ve Yetkiler", href: "/kullanicilar-ve-yetkiler" },
  ],
  "/kullanicilar-ve-yetkiler": [
    { label: "Kullanıcılar ve Yetkiler", href: "/kullanicilar-ve-yetkiler" },
    { label: "Değişiklik ve Denetim", href: "/denetim-merkezi" },
    { label: "Onay Merkezi", href: "/onay-merkezi" },
  ],
  "/raporlar": [
    { label: "Rapor Merkezi", href: "/raporlar" },
    { label: "Değişiklik ve Denetim", href: "/denetim-merkezi" },
  ],
  "/ayarlar": [
    { label: "Ayarlar Merkezi", href: "/ayarlar" },
    { label: "Ön Kayıt Formu", href: "/ayarlar/on-kayit-formu" },
    { label: "Mesaj Ayarları", href: "/ayarlar/mesajlar" },
    { label: "Bildirim Ayarları", href: "/ayarlar/bildirimler" },
    { label: "Onay Kuralları", href: "/ayarlar/onay-merkezi" },
  ],
};

export default function SidebarToggle() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY) === "true";
      setCollapsed(saved);
      document.documentElement.classList.toggle("sprintSidebarCollapsed", saved);
    } catch {
      setCollapsed(false);
    }
    return () => {
      document.documentElement.classList.remove("sprintSidebarMobileOpen");
    };
  }, []);

  useEffect(() => {
    const links = Array.from(document.querySelectorAll<HTMLAnchorElement>(".proSidebar .proNavItem"));
    const cleanups: Array<() => void> = [];

    links.forEach((link) => {
      if (link.dataset.branchEnhanced === "1") return;
      const href = link.getAttribute("href") || "";
      const children = sidebarBranches[href];
      if (!children?.length) return;

      link.dataset.branchEnhanced = "1";
      link.classList.add("hasBranchMenu");

      const toggle = document.createElement("span");
      toggle.className = "sidebarBranchToggle";
      toggle.setAttribute("role", "button");
      toggle.setAttribute("tabindex", "0");
      toggle.setAttribute("aria-label", "Alt işlem merkezlerini aç");
      toggle.setAttribute("aria-expanded", "false");
      toggle.innerHTML = "⌄";
      link.appendChild(toggle);

      const childBox = document.createElement("div");
      childBox.className = "sidebarBranchChildren";
      childBox.hidden = true;
      childBox.innerHTML = children.map((child) => `<a href="${child.href}" class="sidebarBranchChild"><i></i><span>${child.label}</span><b>→</b></a>`).join("");
      link.insertAdjacentElement("afterend", childBox);

      const setOpen = (open: boolean) => {
        childBox.hidden = !open;
        link.classList.toggle("branchOpen", open);
        toggle.setAttribute("aria-expanded", String(open));
      };

      const activate = (event: Event) => {
        event.preventDefault();
        event.stopPropagation();
        const next = childBox.hidden;
        document.querySelectorAll<HTMLElement>(".proSidebar .sidebarBranchChildren:not([hidden])").forEach((box) => {
          if (box === childBox) return;
          box.hidden = true;
          box.previousElementSibling?.classList.remove("branchOpen");
          box.previousElementSibling?.querySelector<HTMLElement>(".sidebarBranchToggle")?.setAttribute("aria-expanded", "false");
        });
        setOpen(next);
      };

      const onKey = (event: KeyboardEvent) => {
        if (event.key === "Enter" || event.key === " ") activate(event);
      };

      toggle.addEventListener("click", activate);
      toggle.addEventListener("keydown", onKey);
      cleanups.push(() => {
        toggle.removeEventListener("click", activate);
        toggle.removeEventListener("keydown", onKey);
      });
    });

    return () => cleanups.forEach((cleanup) => cleanup());
  }, [mounted]);

  function openMobileMenu() {
    setMobileOpen(true);
    document.documentElement.classList.add("sprintSidebarMobileOpen");
  }

  function closeMobileMenu() {
    setMobileOpen(false);
    document.documentElement.classList.remove("sprintSidebarMobileOpen");
  }

  function handleToggle() {
    const isMobile = window.matchMedia("(max-width: 820px)").matches;
    if (isMobile) {
      if (mobileOpen) closeMobileMenu();
      else openMobileMenu();
      return;
    }
    const nextCollapsed = !collapsed;
    setCollapsed(nextCollapsed);
    document.documentElement.classList.toggle("sprintSidebarCollapsed", nextCollapsed);
    try { window.localStorage.setItem(STORAGE_KEY, String(nextCollapsed)); } catch {}
  }

  return (
    <>
      <button type="button" className="sprintSidebarToggle" onClick={handleToggle} aria-label={collapsed ? "Sol menüyü aç" : "Sol menüyü daralt"} aria-expanded={!collapsed} title={collapsed ? "Menüyü Aç" : "Menüyü Daralt"}>
        <span /><span /><span />
      </button>
      {mounted && mobileOpen && createPortal(<>
        <button type="button" className="sprintMobileMenuOverlay" onClick={closeMobileMenu} aria-label="Menüyü kapat" />
        <button type="button" className="sprintMobileMenuClose" onClick={closeMobileMenu} aria-label="Sol menüyü kapat" title="Menüyü Kapat"><span /><span /></button>
      </>, document.body)}
      <style jsx global>{`
        .sprintSidebarToggle{width:42px;height:42px;flex:0 0 42px;display:inline-flex;flex-direction:column;align-items:center;justify-content:center;gap:5px;padding:0;border:1px solid #dfe6f0;border-radius:12px;background:#fff;color:#13213b;cursor:pointer;box-shadow:0 7px 20px rgba(19,33,59,.08);transition:transform 160ms ease,background-color 160ms ease,border-color 160ms ease}
        .sprintSidebarToggle:hover{transform:translateY(-1px);border-color:#b9d3f8;background:#f3f8ff}.sprintSidebarToggle:focus-visible,.sprintMobileMenuClose:focus-visible{outline:3px solid rgba(23,105,232,.3);outline-offset:3px}.sprintSidebarToggle span{display:block;width:19px;height:2px;border-radius:999px;background:currentColor}.sprintMobileMenuOverlay,.sprintMobileMenuClose{display:none}
        .proSidebar .proNavItem.hasBranchMenu{position:relative;padding-right:42px}.proSidebar .sidebarBranchToggle{position:absolute;right:7px;top:50%;width:32px;height:34px;display:grid;place-items:center;transform:translateY(-50%);border-radius:9px;color:#8fa4c2;font-size:18px;font-weight:950;line-height:1;cursor:pointer;transition:background .16s ease,color .16s ease,transform .16s ease}.proSidebar .sidebarBranchToggle:hover{background:rgba(255,255,255,.08);color:#fff}.proSidebar .proNavItem.branchOpen .sidebarBranchToggle{transform:translateY(-50%) rotate(180deg);color:#dbeafe}.proSidebar .sidebarBranchChildren{display:grid;gap:3px;margin:2px 4px 7px 42px;padding:4px 0 2px 10px;border-left:1px solid rgba(122,161,211,.22);animation:sprintBranchOpen .16s ease}.proSidebar .sidebarBranchChildren[hidden]{display:none!important}.proSidebar .sidebarBranchChild{min-height:34px;padding:6px 8px;display:grid;grid-template-columns:7px minmax(0,1fr) 15px;align-items:center;gap:7px;border-radius:9px;color:#8fa4c2;text-decoration:none;font-size:11.5px;font-weight:760;line-height:1.2}.proSidebar .sidebarBranchChild:hover{background:rgba(44,124,231,.12);color:#e3efff}.proSidebar .sidebarBranchChild i{width:5px;height:5px;border-radius:999px;background:#4e78ad;box-shadow:0 0 0 3px rgba(78,120,173,.11)}.proSidebar .sidebarBranchChild b{color:#607da2;font-size:11px;text-align:right}@keyframes sprintBranchOpen{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:translateY(0)}}
        html.sprintSidebarCollapsed .proShell{grid-template-columns:86px minmax(0,1fr)}html.sprintSidebarCollapsed .proSidebar{padding-left:10px;padding-right:10px}html.sprintSidebarCollapsed .proBrand{justify-content:center;padding-left:0;padding-right:0}html.sprintSidebarCollapsed .proBrand>div:last-child,html.sprintSidebarCollapsed .navGroup>p{display:none}html.sprintSidebarCollapsed .proNavItem{justify-content:center;padding-left:0;padding-right:0}html.sprintSidebarCollapsed .proNavItem>span,html.sprintSidebarCollapsed .proNavItem>b,html.sprintSidebarCollapsed .sidebarBranchToggle,html.sprintSidebarCollapsed .sidebarBranchChildren{display:none!important}html.sprintSidebarCollapsed .proUser{display:flex;justify-content:center;padding-left:0;padding-right:0}html.sprintSidebarCollapsed .proUser>div:nth-child(2),html.sprintSidebarCollapsed .proUser>a{display:none}.proShell,.proSidebar{transition:grid-template-columns 220ms ease,width 220ms ease,transform 220ms ease,padding 220ms ease}
        @media(max-width:820px){html .proShell{display:block}html .proSidebar{position:fixed;z-index:8000;top:0;left:0;width:min(86vw,310px);height:100dvh;min-height:100dvh;padding:20px 16px;overflow-y:auto;overscroll-behavior:contain;transform:translateX(-105%);box-shadow:18px 0 50px rgba(3,15,36,.32)}html.sprintSidebarMobileOpen .proSidebar{transform:translateX(0)}html.sprintSidebarMobileOpen{overflow:hidden}html.sprintSidebarMobileOpen .sprintSidebarToggle{visibility:hidden;pointer-events:none}.sprintMobileMenuOverlay{display:block;position:fixed;z-index:7000;inset:0;width:100%;height:100%;margin:0;padding:0;border:0;background:rgba(4,14,32,.56);cursor:pointer}.sprintMobileMenuClose{display:inline-flex;position:fixed;z-index:99999;top:calc(env(safe-area-inset-top,0px) + 14px);left:calc(min(86vw,310px) - 58px);width:44px;height:44px;align-items:center;justify-content:center;padding:0;border:2px solid rgba(255,255,255,.75);border-radius:14px;background:#fff;color:#10213a;cursor:pointer;box-shadow:0 10px 30px rgba(3,15,36,.3)}.sprintMobileMenuClose span{position:absolute;width:21px;height:2.5px;border-radius:999px;background:currentColor}.sprintMobileMenuClose span:first-child{transform:rotate(45deg)}.sprintMobileMenuClose span:last-child{transform:rotate(-45deg)}html .proNav{display:block;overflow:visible;padding-top:18px}html .navGroup{display:block;margin-bottom:18px}html .navGroup>p{display:block}html .proNavItem{justify-content:flex-start;min-width:0;padding:0 11px}html .proNavItem.hasBranchMenu{padding-right:46px}.proSidebar .sidebarBranchToggle{right:5px;width:38px;height:40px}.proSidebar .sidebarBranchChildren{margin-left:40px;padding-left:10px}.proSidebar .sidebarBranchChild{min-height:38px;font-size:12px}html .proUser{display:grid}.proTopbar{gap:10px}.proTopbar>div:first-of-type{min-width:0;flex:1}}
      `}</style>
    </>
  );
}
