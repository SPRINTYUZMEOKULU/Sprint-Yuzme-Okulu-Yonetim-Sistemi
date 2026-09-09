"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import GlobalSearch from "@/app/components/global-search";

type Child = { label: string; href: string };
type NavItem = { label: string; href: string; children?: Child[] };
type NavGroup = { title: string; items: NavItem[] };

const groups: NavGroup[] = [
  {
    title: "GENEL",
    items: [
      { label: "Ana Sayfa", href: "/" },
      {
        label: "Ön Kayıtlar",
        href: "/on-kayitlar",
        children: [
          { label: "Yeni Ön Kayıt", href: "/on-kayit" },
          { label: "Ön Kayıt Merkezi", href: "/on-kayitlar" },
          { label: "Kesin Kayıt Merkezi", href: "/kesin-kayit-merkezi" },
          { label: "Ön Kayıt Form Ayarları", href: "/ayarlar/on-kayit-formu" },
        ],
      },
      { label: "Kesin Kayıt Merkezi", href: "/kesin-kayit-merkezi" },
      {
        label: "Öğrenciler",
        href: "/ogrenciler",
        children: [
          { label: "Öğrenci Merkezi", href: "/ogrenciler" },
          { label: "Kesin Kayıt Merkezi", href: "/kesin-kayit-merkezi" },
          { label: "Başlayacak Kursiyerler", href: "/baslayacak-kursiyerler" },
          { label: "Kayıt Yenileme Merkezi", href: "/kayit-yenilemeleri" },
          { label: "Aktif Öğrenciler", href: "/ogrenciler?durum=active" },
          { label: "Pasif / Arşiv", href: "/ogrenciler?durum=passive" },
          { label: "Ders İptali / Telafi", href: "/ders-operasyonlari" },
        ],
      },
      {
        label: "Veliler",
        href: "/veliler",
        children: [
          { label: "Veli Merkezi", href: "/veliler" },
          { label: "Veli Talepleri", href: "/veli-talepleri" },
        ],
      },
    ],
  },
  {
    title: "EĞİTİM",
    items: [
      {
        label: "Şubeler",
        href: "/subeler",
        children: [
          { label: "Şube Merkezi", href: "/subeler" },
          { label: "Gruplar", href: "/gruplar" },
          { label: "Ders Programı", href: "/ders-programi" },
        ],
      },
      {
        label: "Gruplar",
        href: "/gruplar",
        children: [
          { label: "Grup Merkezi", href: "/gruplar" },
          { label: "Ders Programı", href: "/ders-programi" },
          { label: "Ders İptali / Telafi", href: "/ders-operasyonlari" },
        ],
      },
      {
        label: "Ders Programı",
        href: "/ders-programi",
        children: [
          { label: "Ders Programı", href: "/ders-programi" },
          { label: "Operasyon Planı", href: "/operasyon-plani" },
          { label: "Ders İptali / Telafi", href: "/ders-operasyonlari" },
          { label: "Yoklama", href: "/yoklama" },
        ],
      },
      {
        label: "Operasyon Planı",
        href: "/operasyon-plani",
        children: [
          { label: "Operasyon Planı", href: "/operasyon-plani" },
          { label: "Ders İptali / Telafi", href: "/ders-operasyonlari" },
          { label: "Ders Programı", href: "/ders-programi" },
          { label: "Yoklama", href: "/yoklama" },
        ],
      },
      {
        label: "Yoklama",
        href: "/yoklama",
        children: [
          { label: "Yoklama Merkezi", href: "/yoklama" },
          { label: "Ders Programı", href: "/ders-programi" },
          { label: "Ders İptali / Telafi", href: "/ders-operasyonlari" },
        ],
      },
      { label: "Ders İptali / Telafi", href: "/ders-operasyonlari" },
    ],
  },
  {
    title: "FİNANS",
    items: [
      {
        label: "Paketler",
        href: "/paketler",
        children: [
          { label: "Paket Yönetimi", href: "/paketler" },
          { label: "Ödemeler", href: "/odemeler" },
          { label: "Kesin Kayıt Merkezi", href: "/kesin-kayit-merkezi" },
        ],
      },
      {
        label: "Ödemeler",
        href: "/odemeler",
        children: [
          { label: "Ödeme Merkezi", href: "/odemeler" },
          { label: "Günlük Kasa", href: "/kasa" },
          { label: "Paketler", href: "/paketler" },
          { label: "Kesin Kayıt Merkezi", href: "/kesin-kayit-merkezi" },
        ],
      },
      {
        label: "Günlük Kasa",
        href: "/kasa",
        children: [
          { label: "Günlük Kasa", href: "/kasa" },
          { label: "Ödeme Merkezi", href: "/odemeler" },
        ],
      },
    ],
  },
  {
    title: "İLETİŞİM / YÖNETİM",
    items: [
      {
        label: "Hazır Mesajlar",
        href: "/hazir-mesajlar",
        children: [
          { label: "Hazır Mesajlar", href: "/hazir-mesajlar" },
          { label: "Bildirimler", href: "/bildirimler" },
          { label: "Mesaj Ayarları", href: "/ayarlar/mesajlar" },
        ],
      },
      {
        label: "Bildirimler",
        href: "/bildirimler",
        children: [
          { label: "Bildirim Merkezi", href: "/bildirimler" },
          { label: "Uyarılar", href: "/uyarilar" },
          { label: "Bildirim Ayarları", href: "/ayarlar/bildirimler" },
        ],
      },
      {
        label: "Uyarılar",
        href: "/uyarilar",
        children: [
          { label: "Uyarı Merkezi", href: "/uyarilar" },
          { label: "Bildirim Merkezi", href: "/bildirimler" },
          { label: "Onay Merkezi", href: "/onay-merkezi" },
        ],
      },
      {
        label: "Onay Merkezi",
        href: "/onay-merkezi",
        children: [
          { label: "Onay Merkezi", href: "/onay-merkezi" },
          { label: "Onay Kuralları", href: "/ayarlar/onay-merkezi" },
          { label: "Değişiklik ve Denetim", href: "/denetim-merkezi" },
          { label: "Kullanıcılar ve Yetkiler", href: "/kullanicilar-ve-yetkiler" },
        ],
      },
      {
        label: "Raporlar",
        href: "/raporlar",
        children: [
          { label: "Rapor Merkezi", href: "/raporlar" },
          { label: "Değişiklik ve Denetim", href: "/denetim-merkezi" },
        ],
      },
      {
        label: "Ayarlar",
        href: "/ayarlar",
        children: [
          { label: "Ayarlar Merkezi", href: "/ayarlar" },
          { label: "Ön Kayıt Formu", href: "/ayarlar/on-kayit-formu" },
          { label: "Mesaj Ayarları", href: "/ayarlar/mesajlar" },
          { label: "Bildirim Ayarları", href: "/ayarlar/bildirimler" },
          { label: "Onay Kuralları", href: "/ayarlar/onay-merkezi" },
        ],
      },
    ],
  },
];

function shouldHide(pathname: string) {
  if (pathname === "/") return true;
  return ["/login", "/giris", "/on-kayit", "/veli-paneli", "/veli-giris", "/reset-password", "/sifremi-unuttum"].some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

function cleanHref(href: string) {
  return href.split("?")[0];
}

function isActive(pathname: string, href: string) {
  const clean = cleanHref(href);
  if (clean === "/") return pathname === "/";
  return pathname === clean || pathname.startsWith(`${clean}/`);
}

function branchContainsPath(item: NavItem, pathname: string) {
  if (isActive(pathname, item.href)) return true;
  return Boolean(item.children?.some((child) => isActive(pathname, child.href)));
}

export default function GlobalMobileNav() {
  const pathname = usePathname() || "/";
  const initialBranch = useMemo(() => {
    for (const group of groups) {
      const match = group.items.find((item) => item.children?.length && branchContainsPath(item, pathname));
      if (match) return match.href;
    }
    return null;
  }, [pathname]);

  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(initialBranch);

  useEffect(() => {
    setOpen(false);
    setExpanded(initialBranch);
  }, [pathname, initialBranch]);

  if (shouldHide(pathname)) return null;

  return (
    <>
      <div className="globalMobileNavSpacer" />
      <header className="globalMobileNavBar">
        <button type="button" className="globalMobileMenuButton" onClick={() => setOpen(true)} aria-label="Ana menüyü aç" aria-expanded={open}>
          <span /><span /><span />
        </button>
        <div className="globalMobileSearch"><GlobalSearch /></div>
        <Link href="/" className="globalMobileHomeButton" aria-label="Ana sayfa" title="Ana Sayfa">⌂</Link>
      </header>

      {open ? (
        <div className="globalMobileDrawerRoot">
          <button className="globalMobileDrawerOverlay" onClick={() => setOpen(false)} aria-label="Menüyü kapat" />
          <aside className="globalMobileDrawer" aria-label="SprintOS ana menü">
            <div className="globalMobileDrawerHead">
              <div><small>SPRİNTOS</small><strong>Ana Menü</strong></div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Menüyü kapat">×</button>
            </div>
            <nav>
              {groups.map((group) => (
                <section key={group.title}>
                  <p>{group.title}</p>
                  {group.items.map((item) => {
                    const hasChildren = Boolean(item.children?.length);
                    const active = branchContainsPath(item, pathname);
                    const isExpanded = expanded === item.href;

                    if (!hasChildren) {
                      return <Link key={item.href} href={item.href} className={isActive(pathname, item.href) ? "active" : ""}>{item.label}<b>→</b></Link>;
                    }

                    return (
                      <div key={item.href} className={`globalMobileNavBranch ${isExpanded ? "open" : ""}`}>
                        <button
                          type="button"
                          className={`globalMobileNavBranchButton ${active ? "active" : ""}`}
                          onClick={() => setExpanded(isExpanded ? null : item.href)}
                          aria-expanded={isExpanded}
                        >
                          <span>{item.label}</span><b>{isExpanded ? "⌃" : "⌄"}</b>
                        </button>
                        {isExpanded ? (
                          <div className="globalMobileNavChildren">
                            {item.children!.map((child) => (
                              <Link key={`${item.href}-${child.href}-${child.label}`} href={child.href} className={isActive(pathname, child.href) ? "active" : ""}>
                                <i /><span>{child.label}</span><b>→</b>
                              </Link>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    );
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
          .globalMobileDrawer{position:absolute;left:0;top:0;bottom:0;width:min(92vw,430px);overflow:auto;background:#071a36;color:#fff;box-shadow:18px 0 50px rgba(0,0,0,.24);padding:calc(18px + env(safe-area-inset-top)) 14px calc(24px + env(safe-area-inset-bottom))}
          .globalMobileDrawerHead{display:flex;align-items:center;justify-content:space-between;padding:4px 6px 18px;border-bottom:1px solid rgba(255,255,255,.1)}.globalMobileDrawerHead small{display:block;color:#7fb4ff;font-weight:900;letter-spacing:2px;font-size:11px}.globalMobileDrawerHead strong{display:block;margin-top:4px;font-size:22px}.globalMobileDrawerHead button{width:40px;height:40px;border-radius:12px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.07);color:#fff;font-size:27px}
          .globalMobileDrawer nav{padding-top:12px}.globalMobileDrawer section{margin:0 0 13px}.globalMobileDrawer section>p{margin:0 8px 6px;color:#6984a8;font-size:10px;font-weight:900;letter-spacing:1.6px}
          .globalMobileDrawer a,.globalMobileNavBranchButton{width:100%;min-height:44px;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 12px;border:0;border-radius:11px;background:transparent;color:#cbd9ed;text-decoration:none;font:inherit;font-size:13px;font-weight:760;text-align:left}.globalMobileDrawer a b,.globalMobileNavBranchButton b{color:#6f91bd}.globalMobileDrawer a:hover,.globalMobileDrawer a.active,.globalMobileNavBranchButton:hover,.globalMobileNavBranchButton.active{background:rgba(38,115,221,.18);color:#fff}.globalMobileDrawer a.active,.globalMobileNavBranchButton.active{box-shadow:inset 3px 0 0 #2f80ed}
          .globalMobileNavChildren{margin:2px 0 7px 14px;padding:4px 0 4px 10px;border-left:1px solid rgba(127,180,255,.22)}.globalMobileNavChildren a{min-height:39px;padding:8px 10px;display:grid;grid-template-columns:7px minmax(0,1fr) 15px;gap:8px;font-size:11.5px;color:#9fb3cf}.globalMobileNavChildren a i{width:5px;height:5px;border-radius:999px;background:#4e82c5;box-shadow:0 0 0 3px rgba(78,130,197,.12)}.globalMobileNavChildren a.active{background:rgba(38,115,221,.14);color:#fff;box-shadow:none}.globalMobileNavBranch.open>.globalMobileNavBranchButton{background:rgba(255,255,255,.045);color:#fff}
        }
      `}</style>
    </>
  );
}
