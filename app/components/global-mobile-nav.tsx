"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import GlobalSearch from "@/app/components/global-search";

const groups = [
  {
    title: "GENEL",
    items: [
      ["Ana Sayfa", "/"],
      ["Ön Kayıtlar", "/on-kayitlar"],
      ["Kesin Kayıt Merkezi", "/kesin-kayit-merkezi"],
      ["Öğrenciler", "/ogrenciler"],
      ["Veliler", "/veliler"],
    ],
  },
  {
    title: "EĞİTİM",
    items: [
      ["Şubeler", "/subeler"],
      ["Gruplar", "/gruplar"],
      ["Ders Programı", "/ders-programi"],
      ["Operasyon Planı", "/operasyon-plani"],
      ["Yoklama", "/yoklama"],
      ["Ders İptali / Telafi", "/ders-operasyonlari"],
    ],
  },
  {
    title: "FİNANS",
    items: [
      ["Paketler", "/paketler"],
      ["Ödemeler", "/odemeler"],
      ["Günlük Kasa", "/kasa"],
    ],
  },
  {
    title: "İLETİŞİM / YÖNETİM",
    items: [
      ["Hazır Mesajlar", "/hazir-mesajlar"],
      ["Bildirimler", "/bildirimler"],
      ["Uyarılar", "/uyarilar"],
      ["Onay Merkezi", "/onay-merkezi"],
      ["Raporlar", "/raporlar"],
      ["Ayarlar", "/ayarlar"],
    ],
  },
] as const;

function shouldHide(pathname: string) {
  if (pathname === "/") return true;
  return [
    "/login",
    "/giris",
    "/on-kayit",
    "/veli-paneli",
    "/veli-giris",
    "/reset-password",
    "/sifremi-unuttum",
  ].some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export default function GlobalMobileNav() {
  const pathname = usePathname() || "/";
  const [open, setOpen] = useState(false);

  useEffect(() => setOpen(false), [pathname]);

  if (shouldHide(pathname)) return null;

  return (
    <>
      <div className="globalMobileNavSpacer" />
      <header className="globalMobileNavBar">
        <button
          type="button"
          className="globalMobileMenuButton"
          onClick={() => setOpen(true)}
          aria-label="Ana menüyü aç"
          aria-expanded={open}
        >
          <span />
          <span />
          <span />
        </button>
        <div className="globalMobileSearch"><GlobalSearch /></div>
        <Link href="/" className="globalMobileHomeButton" aria-label="Ana sayfa" title="Ana Sayfa">⌂</Link>
      </header>

      {open ? (
        <div className="globalMobileDrawerRoot">
          <button className="globalMobileDrawerOverlay" onClick={() => setOpen(false)} aria-label="Menüyü kapat" />
          <aside className="globalMobileDrawer" aria-label="SprintOS ana menü">
            <div className="globalMobileDrawerHead">
              <div>
                <small>SPRİNTOS</small>
                <strong>Ana Menü</strong>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Menüyü kapat">×</button>
            </div>
            <nav>
              {groups.map((group) => (
                <section key={group.title}>
                  <p>{group.title}</p>
                  {group.items.map(([label, href]) => {
                    const active = href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
                    return <Link key={href} href={href} className={active ? "active" : ""}>{label}<b>→</b></Link>;
                  })}
                </section>
              ))}
            </nav>
          </aside>
        </div>
      ) : null}

      <style jsx global>{`
        .globalMobileNavBar,.globalMobileNavSpacer,.globalMobileDrawerRoot{display:none}
        @media(max-width:820px){
          .globalMobileNavSpacer{display:block;height:82px}
          .globalMobileNavBar{position:fixed;z-index:7600;left:0;right:0;top:0;display:grid;grid-template-columns:48px minmax(0,1fr) 48px;gap:10px;align-items:center;padding:calc(10px + env(safe-area-inset-top)) 14px 10px;background:rgba(248,251,255,.96);border-bottom:1px solid #dfe7f2;box-shadow:0 8px 24px rgba(15,35,70,.07);backdrop-filter:blur(14px)}
          .globalMobileMenuButton,.globalMobileHomeButton{width:48px;height:48px;border-radius:14px;border:1px solid #d8e2ef;background:#fff;color:#102442;display:flex;align-items:center;justify-content:center;box-shadow:0 6px 18px rgba(15,35,70,.07)}
          .globalMobileMenuButton{flex-direction:column;gap:5px;padding:0}.globalMobileMenuButton span{width:21px;height:2px;border-radius:999px;background:currentColor}.globalMobileHomeButton{text-decoration:none;font-size:25px;font-weight:900}
          .globalMobileSearch{min-width:0}.globalMobileSearch .searchBox{min-height:48px!important;height:48px!important;display:flex!important;align-items:center!important;gap:10px!important;padding:0 12px!important;border-radius:14px!important;background:#fff!important;border:1px solid #d8e2ef!important;box-shadow:none!important;color:#8a97aa!important}.globalMobileSearch .searchBox svg{width:18px!important;flex:0 0 18px}.globalMobileSearch .searchBox input{font-size:13px!important}.globalMobileSearch kbd{display:none!important}
          .globalMobileDrawerRoot{display:block;position:fixed;z-index:9000;inset:0}.globalMobileDrawerOverlay{position:absolute;inset:0;border:0;background:rgba(5,18,40,.46)}
          .globalMobileDrawer{position:absolute;left:0;top:0;bottom:0;width:min(86vw,360px);overflow:auto;background:#071a36;color:#fff;box-shadow:18px 0 50px rgba(0,0,0,.24);padding:calc(18px + env(safe-area-inset-top)) 14px calc(24px + env(safe-area-inset-bottom))}
          .globalMobileDrawerHead{display:flex;align-items:center;justify-content:space-between;padding:4px 6px 18px;border-bottom:1px solid rgba(255,255,255,.1)}.globalMobileDrawerHead small{display:block;color:#7fb4ff;font-weight:900;letter-spacing:2px;font-size:11px}.globalMobileDrawerHead strong{display:block;margin-top:4px;font-size:22px}.globalMobileDrawerHead button{width:40px;height:40px;border-radius:12px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.07);color:#fff;font-size:27px}
          .globalMobileDrawer nav{padding-top:12px}.globalMobileDrawer section{margin:0 0 13px}.globalMobileDrawer section>p{margin:0 8px 6px;color:#6984a8;font-size:10px;font-weight:900;letter-spacing:1.6px}.globalMobileDrawer a{min-height:44px;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 12px;border-radius:11px;color:#cbd9ed;text-decoration:none;font-size:13px;font-weight:760}.globalMobileDrawer a b{color:#6f91bd}.globalMobileDrawer a:hover,.globalMobileDrawer a.active{background:rgba(38,115,221,.18);color:#fff}.globalMobileDrawer a.active{box-shadow:inset 3px 0 0 #2f80ed}
        }
      `}</style>
    </>
  );
}
