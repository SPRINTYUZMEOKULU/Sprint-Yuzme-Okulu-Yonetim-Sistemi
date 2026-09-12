"use client";

import { useEffect } from "react";

const PERSONEL_HREF = "/personel-puantaj";

function personIcon() {
  return `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <circle cx="12" cy="7" r="3"></circle>
      <path d="M5.5 20a6.5 6.5 0 0 1 13 0"></path>
      <path d="M18.5 8.5h3M20 7v3"></path>
    </svg>`;
}

function enhanceDashboardSidebar() {
  const nav = document.querySelector<HTMLElement>(".proSidebar .proNav");
  if (!nav || nav.querySelector('[data-personel-nav="1"]')) return;

  const group = document.createElement("div");
  group.className = "navGroup";
  group.dataset.personelNav = "1";
  group.innerHTML = `
    <p>PERSONEL</p>
    <a href="${PERSONEL_HREF}" class="proNavItem personelNavItem">
      ${personIcon()}
      <span>Personel &amp; Puantaj</span>
    </a>`;

  const groups = Array.from(nav.querySelectorAll<HTMLElement>(":scope > .navGroup"));
  const finance = groups.find((item) => item.querySelector(":scope > p")?.textContent?.trim() === "FİNANS");
  if (finance?.nextSibling) nav.insertBefore(group, finance.nextSibling);
  else nav.appendChild(group);
}

function enhanceGlobalMobileDrawer() {
  const nav = document.querySelector<HTMLElement>(".globalMobileDrawer nav");
  if (!nav || nav.querySelector('[data-personel-nav="1"]')) return;

  const section = document.createElement("section");
  section.dataset.personelNav = "1";
  section.innerHTML = `
    <p>PERSONEL</p>
    <a href="${PERSONEL_HREF}" class="personelMobileNavLink">
      <span>Personel &amp; Puantaj</span><b>→</b>
    </a>`;

  const sections = Array.from(nav.querySelectorAll<HTMLElement>(":scope > section"));
  const finance = sections.find((item) => item.querySelector(":scope > p")?.textContent?.trim() === "FİNANS");
  if (finance?.nextSibling) nav.insertBefore(section, finance.nextSibling);
  else nav.appendChild(section);
}

export default function PersonelNavEnhancer() {
  useEffect(() => {
    const apply = () => {
      enhanceDashboardSidebar();
      enhanceGlobalMobileDrawer();
    };

    apply();
    const observer = new MutationObserver(apply);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return (
    <style jsx global>{`
      .proSidebar .personelNavItem svg{width:20px;height:20px;flex:0 0 20px}
      .proSidebar .personelNavItem:active{transform:scale(.985)}
      @media(max-width:820px){
        .globalMobileDrawer section[data-personel-nav="1"]{margin-top:2px;margin-bottom:13px}
        .globalMobileDrawer section[data-personel-nav="1"]>p{margin:0 8px 6px;color:#6984a8;font-size:10px;font-weight:900;letter-spacing:1.6px}
        .globalMobileDrawer .personelMobileNavLink{width:100%;min-height:44px;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 12px;border:0;border-radius:11px;background:transparent;color:#cbd9ed;text-decoration:none;font-size:13px;font-weight:760;text-align:left}
        .globalMobileDrawer .personelMobileNavLink b{color:#6f91bd}
        .globalMobileDrawer .personelMobileNavLink:hover,.globalMobileDrawer .personelMobileNavLink:active{background:rgba(38,115,221,.18);color:#fff}
      }
    `}</style>
  );
}
