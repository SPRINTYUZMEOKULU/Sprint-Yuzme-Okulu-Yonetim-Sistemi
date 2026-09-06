"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { Icons } from "@/app/components/dashboard-icons";

type SidebarItem = {
  label: string;
  href: string;
  icon: keyof typeof Icons;
  group: string;
};

type ChildItem = {
  label: string;
  href: string;
};

const branches: Record<string, ChildItem[]> = {
  "/on-kayitlar": [
    { label: "Yeni Ön Kayıt", href: "/on-kayit" },
    { label: "Ön Kayıt Listesi", href: "/on-kayitlar" },
  ],
  "/ogrenciler": [
    { label: "Öğrenci Merkezi", href: "/ogrenciler" },
    { label: "Aktif Öğrenciler", href: "/ogrenciler?durum=active" },
    { label: "Pasif / Arşiv", href: "/ogrenciler?durum=passive" },
  ],
  "/veliler": [
    { label: "Veli Merkezi", href: "/veliler" },
    { label: "Veli Talepleri", href: "/veli-talepleri" },
  ],
  "/subeler": [
    { label: "Şube Merkezi", href: "/subeler" },
    { label: "Gruplar", href: "/gruplar" },
  ],
  "/gruplar": [
    { label: "Grup Merkezi", href: "/gruplar" },
    { label: "Ders Programı", href: "/ders-programi" },
  ],
  "/ders-programi": [
    { label: "Ders Programı", href: "/ders-programi" },
    { label: "Operasyon Planı", href: "/operasyon-plani" },
  ],
  "/operasyon-plani": [
    { label: "Operasyon Planı", href: "/operasyon-plani" },
    { label: "Ders Programı", href: "/ders-programi" },
    { label: "Yoklama", href: "/yoklama" },
  ],
  "/yoklama": [
    { label: "Yoklama Merkezi", href: "/yoklama" },
    { label: "Ders Programı", href: "/ders-programi" },
  ],
  "/paketler": [
    { label: "Paket Yönetimi", href: "/paketler" },
    { label: "Ödemeler", href: "/odemeler" },
  ],
  "/kasa": [
    { label: "Günlük Kasa", href: "/kasa" },
    { label: "Ödemeler", href: "/odemeler" },
  ],
  "/odemeler": [
    { label: "Ödeme Merkezi", href: "/odemeler" },
    { label: "Günlük Kasa", href: "/kasa" },
    { label: "Paketler", href: "/paketler" },
  ],
  "/hazir-mesajlar": [
    { label: "Hazır Mesajlar", href: "/hazir-mesajlar" },
    { label: "Bildirimler", href: "/bildirimler" },
  ],
  "/bildirimler": [
    { label: "Bildirim Merkezi", href: "/bildirimler" },
    { label: "Uyarılar", href: "/uyarilar" },
  ],
  "/uyarilar": [
    { label: "Uyarı Merkezi", href: "/uyarilar" },
    { label: "Onay Merkezi", href: "/onay-merkezi" },
  ],
  "/onay-merkezi": [
    { label: "Onay Merkezi", href: "/onay-merkezi" },
    { label: "Kullanıcılar ve Yetkiler", href: "/kullanicilar-ve-yetkiler" },
  ],
  "/kullanicilar-ve-yetkiler": [
    { label: "Kullanıcılar ve Yetkiler", href: "/kullanicilar-ve-yetkiler" },
    { label: "Değişiklik ve Denetim", href: "/denetim-merkezi" },
  ],
  "/raporlar": [
    { label: "Rapor Merkezi", href: "/raporlar" },
  ],
  "/ayarlar": [
    { label: "Ayarlar Merkezi", href: "/ayarlar" },
    { label: "Mesaj ve Bildirim Ayarları", href: "/ayarlar/mesajlar" },
  ],
};

function basePath(href: string) {
  return href.split("?")[0];
}

export default function DashboardSidebarNav({
  items,
  openAlerts = 0,
  pendingApprovals = 0,
}: {
  items: SidebarItem[];
  openAlerts?: number;
  pendingApprovals?: number;
}) {
  const pathname = usePathname();
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    const current = items.find((item) => {
      const children = branches[item.href] || [];
      return children.some((child) => basePath(child.href) === pathname);
    });
    setExpanded(current?.href || null);
  }, [pathname, items]);

  const groups = [...new Set(items.map((item) => item.group))];

  return (
    <nav className="proNav dashboardBranchNav">
      {groups.map((group) => (
        <div className="navGroup" key={group}>
          <p>{group}</p>

          {items
            .filter((item) => item.group === group)
            .map((item) => {
              const Icon = Icons[item.icon];
              const children = branches[item.href] || [];
              const hasChildren = children.length > 0;
              const isExpanded = expanded === item.href;
              const isActive =
                item.href === "/"
                  ? pathname === "/"
                  : pathname === item.href || pathname.startsWith(`${item.href}/`);

              return (
                <div className={`branchNavItem ${isExpanded ? "expanded" : ""}`} key={item.href}>
                  <div className={`branchNavMain ${isActive ? "active" : ""}`}>
                    <Link href={item.href} className="proNavItem branchPrimaryLink">
                      <Icon />
                      <span>{item.label}</span>

                      {item.href === "/uyarilar" && openAlerts > 0 ? <b>{openAlerts}</b> : null}
                      {item.href === "/onay-merkezi" && pendingApprovals > 0 ? (
                        <b>{pendingApprovals}</b>
                      ) : null}
                    </Link>

                    {hasChildren ? (
                      <button
                        type="button"
                        className="branchToggle"
                        aria-label={`${item.label} alt işlemlerini ${isExpanded ? "kapat" : "aç"}`}
                        aria-expanded={isExpanded}
                        onClick={() => setExpanded((current) => (current === item.href ? null : item.href))}
                      >
                        <span>⌄</span>
                      </button>
                    ) : null}
                  </div>

                  {hasChildren && isExpanded ? (
                    <div className="branchChildren">
                      {children.map((child) => {
                        const childBase = basePath(child.href);
                        const childActive = pathname === childBase;
                        return (
                          <Link
                            key={`${item.href}-${child.href}-${child.label}`}
                            href={child.href}
                            className={childActive ? "active" : ""}
                          >
                            <i />
                            <span>{child.label}</span>
                            <b>→</b>
                          </Link>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              );
            })}
        </div>
      ))}

      <style jsx global>{`
        .dashboardBranchNav .branchNavItem{display:grid;gap:4px;margin-bottom:2px}
        .dashboardBranchNav .branchNavMain{display:flex;align-items:center;min-width:0;border-radius:14px}
        .dashboardBranchNav .branchPrimaryLink{flex:1 1 auto;min-width:0;margin:0!important}
        .dashboardBranchNav .branchNavMain.active>.branchPrimaryLink{background:linear-gradient(90deg,rgba(24,100,213,.72),rgba(20,77,166,.48));color:#fff;box-shadow:inset 3px 0 0 #42a5ff}
        .dashboardBranchNav .branchToggle{width:34px;height:38px;flex:0 0 34px;margin-left:-40px;margin-right:5px;display:grid;place-items:center;border:0;border-radius:10px;background:transparent;color:#9fb2ce;cursor:pointer;position:relative;z-index:2}
        .dashboardBranchNav .branchToggle:hover{background:rgba(255,255,255,.08);color:#fff}
        .dashboardBranchNav .branchToggle span{display:block;font-size:18px;font-weight:900;line-height:1;transition:transform .18s ease}
        .dashboardBranchNav .branchNavItem.expanded .branchToggle span{transform:rotate(180deg)}
        .dashboardBranchNav .branchChildren{display:grid;gap:3px;padding:2px 8px 7px 49px;animation:branchOpen .16s ease}
        .dashboardBranchNav .branchChildren a{min-height:34px;padding:6px 8px;display:grid;grid-template-columns:8px minmax(0,1fr) 16px;align-items:center;gap:8px;border-radius:9px;color:#92a7c5;text-decoration:none;font-size:12px;font-weight:750;line-height:1.25}
        .dashboardBranchNav .branchChildren a:hover,.dashboardBranchNav .branchChildren a.active{background:rgba(48,129,238,.12);color:#dbeafe}
        .dashboardBranchNav .branchChildren i{width:5px;height:5px;border-radius:999px;background:#4d79b4;box-shadow:0 0 0 3px rgba(77,121,180,.12)}
        .dashboardBranchNav .branchChildren a.active i{background:#48a7ff}
        .dashboardBranchNav .branchChildren b{font-size:12px;color:#6682a7;text-align:right}
        @keyframes branchOpen{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:translateY(0)}}
        html.sprintSidebarCollapsed .dashboardBranchNav .branchToggle,
        html.sprintSidebarCollapsed .dashboardBranchNav .branchChildren{display:none!important}
        @media(max-width:768px){
          .dashboardBranchNav .branchToggle{width:40px;height:44px;flex-basis:40px;margin-left:-46px;margin-right:4px}
          .dashboardBranchNav .branchChildren{padding-left:48px;padding-right:8px}
          .dashboardBranchNav .branchChildren a{min-height:38px;font-size:12.5px}
        }
      `}</style>
    </nav>
  );
}
