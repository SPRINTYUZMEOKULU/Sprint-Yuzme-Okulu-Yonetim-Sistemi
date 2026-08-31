"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

type MenuItem = { label: string; href: string; moduleKey: string };
type AccessResponse = {
  ok: boolean;
  role?: string;
  is_super_user?: boolean;
  allowed_modules?: string[];
};

const menuItems: MenuItem[] = [
  { label: "Ana Sayfa", href: "/", moduleKey: "dashboard" },
  { label: "Ön Kayıtlar", href: "/on-kayitlar", moduleKey: "preregistration" },
  { label: "Öğrenciler", href: "/ogrenciler", moduleKey: "students" },
  { label: "Şubeler", href: "/subeler", moduleKey: "branches" },
  { label: "Gruplar", href: "/gruplar", moduleKey: "groups" },
  { label: "Ders Programı", href: "/ders-programi", moduleKey: "schedule" },
  { label: "Operasyon Planı", href: "/operasyon-plani", moduleKey: "operations" },
  { label: "Yoklama", href: "/yoklama", moduleKey: "attendance" },
  { label: "Ödemeler", href: "/odemeler", moduleKey: "finance" },
  { label: "Kasa", href: "/kasa", moduleKey: "finance" },
  { label: "Raporlar", href: "/raporlar", moduleKey: "reports" },
  { label: "Kullanıcılar ve Yetkiler", href: "/kullanicilar-ve-yetkiler", moduleKey: "permissions" },
];

export default function UstGezinme() {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState("");
  const [superUser, setSuperUser] = useState(false);
  const [modules, setModules] = useState<string[]>([]);

  useEffect(() => setMenuOpen(false), [pathname]);

  useEffect(() => {
    document.documentElement.classList.toggle("topMenuOpen", menuOpen);
    return () => document.documentElement.classList.remove("topMenuOpen");
  }, [menuOpen]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const response = await fetch("/api/auth/access", {
          cache: "no-store",
          credentials: "same-origin",
        });
        const data = (await response.json()) as AccessResponse;
        if (cancelled || !response.ok || !data.ok) return;
        setRole(String(data.role || ""));
        setSuperUser(Boolean(data.is_super_user));
        setModules(Array.isArray(data.allowed_modules) ? data.allowed_modules : []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, []);

  const fullAccess = role === "owner" || superUser || modules.includes("*");
  const visibleItems = useMemo(
    () => fullAccess ? menuItems : menuItems.filter((item) => modules.includes(item.moduleKey)),
    [fullAccess, modules]
  );

  const active = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);

  function logout() {
    if (loggingOut) return;
    setLoggingOut(true);
    window.location.href = "/auth/signout";
  }

  return (
    <>
      <header className="proTopNav">
        <div className="proTopNavInner">
          <button type="button" className="navIcon back" onClick={() => router.back()} aria-label="Geri dön">‹</button>

          <Link href="/" className="navBrand">
            <span className="navLogo">
              <Image src="/icons/icon-192.png" alt="Sprint Yüzme Okulu" width={38} height={38} priority />
            </span>
            <span className="navBrandText"><strong>SprintOS</strong><small>Yüzme Okulu Yönetimi</small></span>
          </Link>

          <nav className="desktopLinks" aria-label="Ana menü">
            {loading ? <span className="navLoading">Menü hazırlanıyor…</span> : visibleItems.map((item) => (
              <Link key={item.href} href={item.href} className={active(item.href) ? "active" : ""}>{item.label}</Link>
            ))}
          </nav>

          <div className="navActions">
            <button
              type="button"
              className={`hamburger ${menuOpen ? "open" : ""}`}
              onClick={() => setMenuOpen((value) => !value)}
              aria-label={menuOpen ? "Menüyü kapat" : "Menüyü aç"}
              aria-expanded={menuOpen}
            ><span /><span /><span /></button>

            <button type="button" className="logout" onClick={logout} disabled={loggingOut}>
              <b>↪</b><span>{loggingOut ? "Çıkılıyor…" : "Güvenli Çıkış"}</span>
            </button>
          </div>
        </div>
      </header>

      <button type="button" className={`menuShade ${menuOpen ? "open" : ""}`} onClick={() => setMenuOpen(false)} aria-label="Menüyü kapat" />

      <aside className={`mobileDrawer ${menuOpen ? "open" : ""}`}>
        <header><div><small>SPRİNT YÜZME OKULU</small><strong>Yönetim Menüsü</strong></div><button type="button" onClick={() => setMenuOpen(false)}>×</button></header>
        <nav>
          {visibleItems.map((item) => (
            <Link key={item.href} href={item.href} className={active(item.href) ? "active" : ""}><span>{item.label}</span><b>→</b></Link>
          ))}
        </nav>
        <button type="button" className="drawerLogout" onClick={logout} disabled={loggingOut}>{loggingOut ? "Çıkış yapılıyor…" : "Güvenli Çıkış"}</button>
      </aside>

      <style jsx global>{`
        html.topMenuOpen { overflow: hidden; }
        .proTopNav, .proTopNav * { box-sizing: border-box; }
        .proTopNav { position: sticky; top: 0; z-index: 1000; width: 100%; background: rgba(255,255,255,.97); border-bottom: 1px solid #e2e8f0; box-shadow: 0 6px 22px rgba(15,23,42,.07); backdrop-filter: blur(16px); }
        .proTopNavInner { width: 100%; max-width: 1680px; min-height: 68px; margin: auto; padding: 9px 18px; display: flex; align-items: center; gap: 11px; }
        .proTopNav button, .proTopNav a, .mobileDrawer button, .mobileDrawer a { touch-action: manipulation; -webkit-tap-highlight-color: transparent; transition: transform .15s ease, background .15s ease, box-shadow .15s ease; }
        .proTopNav button:active, .proTopNav a:active, .mobileDrawer button:active, .mobileDrawer a:active { transform: scale(.965); }
        .navIcon { width: 42px; height: 42px; flex: 0 0 42px; border: 1px solid #dbe4ef; border-radius: 13px; background: #fff; color: #13233f; font: 900 29px/1 system-ui; cursor: pointer; }
        .navBrand { flex: 0 0 auto; display: flex; align-items: center; gap: 9px; color: #13233f; text-decoration: none; }
        .navLogo { width: 45px; height: 45px; display: grid; place-items: center; overflow: hidden; border: 1px solid #dbe4ef; border-radius: 14px; background: #fff; }
        .navLogo img { object-fit: contain; }
        .navBrandText { display: grid; line-height: 1.08; min-width: 130px; }
        .navBrandText strong { font-size: 16px; font-weight: 950; }
        .navBrandText small { margin-top: 4px; color: #738198; font-size: 10px; }
        .desktopLinks { flex: 1 1 auto; min-width: 0; display: flex; align-items: center; justify-content: center; gap: 3px; overflow-x: auto; scrollbar-width: none; }
        .desktopLinks::-webkit-scrollbar { display: none; }
        .desktopLinks a { flex: 0 0 auto; min-height: 38px; padding: 0 10px; display: inline-flex; align-items: center; border-radius: 10px; color: #5c697d; font-size: 10.5px; font-weight: 850; text-decoration: none; white-space: nowrap; }
        .desktopLinks a:hover { color: #1769e8; background: #f1f7ff; }
        .desktopLinks a.active { color: #fff; background: #1769e8; box-shadow: 0 7px 17px rgba(23,105,232,.22); }
        .navLoading { color: #8492a6; font-size: 11px; }
        .navActions { flex: 0 0 auto; display: flex; align-items: center; gap: 7px; }
        .hamburger { display: none; width: 43px; height: 42px; padding: 0; border: 1px solid #dbe4ef; border-radius: 12px; background: #fff; color: #13233f; cursor: pointer; align-items: center; justify-content: center; flex-direction: column; gap: 4px; }
        .hamburger span { width: 18px; height: 2px; border-radius: 8px; background: currentColor; transition: .18s ease; }
        .hamburger.open span:nth-child(1) { transform: translateY(6px) rotate(45deg); }
        .hamburger.open span:nth-child(2) { opacity: 0; }
        .hamburger.open span:nth-child(3) { transform: translateY(-6px) rotate(-45deg); }
        .logout { height: 42px; padding: 0 13px; display: flex; align-items: center; gap: 7px; border: 1px solid #fecdd3; border-radius: 12px; background: #fff1f2; color: #be123c; font: 900 11px system-ui; cursor: pointer; }
        .logout b { font-size: 19px; }.logout:disabled,.drawerLogout:disabled{opacity:.6;cursor:wait}
        .menuShade { position: fixed; z-index: 1090; inset: 0; display: none; padding: 0; border: 0; background: rgba(3,12,28,.58); opacity: 0; visibility: hidden; pointer-events: none; transition: .2s ease; }
        .mobileDrawer { position: fixed; z-index: 1100; top: 0; right: 0; width: min(88vw,380px); height: 100dvh; padding: 18px; background: #071b3b; color: #fff; transform: translateX(105%); transition: transform .22s ease; box-shadow: -24px 0 60px rgba(3,12,28,.38); overflow-y: auto; }
        .mobileDrawer.open { transform: translateX(0); }
        .mobileDrawer header { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding-bottom: 15px; border-bottom: 1px solid rgba(255,255,255,.13); }
        .mobileDrawer header div { display: grid; gap: 4px; }.mobileDrawer header small{color:#82b8ff;font-size:10px;font-weight:900;letter-spacing:1px}.mobileDrawer header strong{font-size:21px}
        .mobileDrawer header button { width: 42px; height: 42px; border: 1px solid rgba(255,255,255,.2); border-radius: 13px; background: rgba(255,255,255,.09); color: #fff; font-size: 27px; cursor: pointer; }
        .mobileDrawer nav { display: grid; gap: 7px; padding: 16px 0; }
        .mobileDrawer nav a { min-height: 50px; padding: 0 15px; display: flex; align-items: center; justify-content: space-between; border-radius: 13px; color: #c9d6e8; background: rgba(255,255,255,.04); text-decoration: none; font: 800 14px system-ui; }
        .mobileDrawer nav a.active { color: #fff; background: #1769e8; box-shadow: 0 8px 22px rgba(23,105,232,.25); }
        .drawerLogout { width: 100%; min-height: 50px; border: 1px solid #fb7185; border-radius: 13px; background: #be123c; color: #fff; font: 900 13px system-ui; cursor: pointer; }
        @media(max-width:1280px){.navBrandText{display:none}.desktopLinks{justify-content:flex-start}.desktopLinks a{padding:0 8px;font-size:10px}}
        @media(max-width:820px){
          .proTopNavInner{min-height:62px;padding:8px 9px;gap:7px}.desktopLinks{display:none}.navBrand{flex:1 1 auto;min-width:0}.navBrandText{display:grid;min-width:0}.navBrandText small{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
          .navLogo{width:41px;height:41px;flex:0 0 41px}.navIcon{width:40px;height:40px;flex-basis:40px}.hamburger{display:flex}.logout{width:43px;padding:0;justify-content:center}.logout span{display:none}
          .menuShade{display:block}.menuShade.open{opacity:1;visibility:visible;pointer-events:auto}
        }
        @media(max-width:430px){.proTopNavInner{padding-left:6px;padding-right:6px}.navBrandText strong{font-size:14px}.navBrandText small{font-size:9px}.navIcon,.hamburger,.logout{width:38px;height:38px;flex-basis:38px}.navLogo{width:38px;height:38px;flex-basis:38px}}
      `}</style>
    </>
  );
}
