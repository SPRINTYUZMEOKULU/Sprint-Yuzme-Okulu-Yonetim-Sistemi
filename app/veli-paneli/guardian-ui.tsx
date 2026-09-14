import type { ReactNode } from "react";
import Link from "next/link";
import type { GuardianStudent } from "@/lib/guardian/data";
import GuardianAutoRefresh from "./guardian-auto-refresh";

type IconName = "home" | "calendar" | "progress" | "wallet" | "message" | "bell" | "document" | "request" | "logout" | "swimmer" | "location";

export function GuardianIcon({ name, size = 20 }: { name: IconName; size?: number }) {
  const common = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  if (name === "home") return <svg {...common}><path d="m3 10 9-7 9 7"/><path d="M5 9.5V21h14V9.5"/><path d="M9 21v-7h6v7"/></svg>;
  if (name === "calendar") return <svg {...common}><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/><path d="m9 15 2 2 4-4"/></svg>;
  if (name === "progress") return <svg {...common}><path d="M4 19V9M10 19V5M16 19v-7M22 19H2"/><path d="m4 7 6-4 6 5 5-3"/></svg>;
  if (name === "wallet") return <svg {...common}><path d="M4 6h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6Z"/><path d="M16 11h5v5h-5a2.5 2.5 0 0 1 0-5ZM5 6V4h11"/></svg>;
  if (name === "message") return <svg {...common}><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z"/><path d="M8 9h8M8 13h5"/></svg>;
  if (name === "bell") return <svg {...common}><path d="M18 8a6 6 0 1 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></svg>;
  if (name === "document") return <svg {...common}><path d="M6 2h8l4 4v16H6Z"/><path d="M14 2v5h5M9 12h6M9 16h6"/></svg>;
  if (name === "request") return <svg {...common}><circle cx="12" cy="12" r="9"/><path d="M12 8v4l3 2M8 12h1"/></svg>;
  if (name === "logout") return <svg {...common}><path d="M10 17l5-5-5-5M15 12H3"/><path d="M13 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6"/></svg>;
  if (name === "location") return <svg {...common}><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></svg>;
  return <svg {...common}><path d="M2 15c3-2 5-2 8 0s5 2 8 0 4-2 4-2"/><path d="M6 11c1.5-2 3.5-3 6-3l3-3"/><circle cx="16.5" cy="4" r="1.5"/><path d="m10 8 3 4"/></svg>;
}

const navItems: Array<{ href: string; label: string; icon: IconName }> = [
  { href: "/veli-paneli", label: "Genel Bakış", icon: "home" },
  { href: "/veli-devam", label: "Dersler & Yoklama", icon: "calendar" },
  { href: "/veli-gelisim", label: "Gelişim", icon: "progress" },
  { href: "/veli-odemeler", label: "Ödemeler", icon: "wallet" },
  { href: "/veli-mesajlar", label: "Mesajlar", icon: "message" },
  { href: "/veli-duyurular", label: "Duyurular", icon: "bell" },
  { href: "/veli-belgeler", label: "Belgeler", icon: "document" },
  { href: "/veli-talepleri", label: "Talep Oluştur", icon: "request" },
];

function portalHref(href: string, selectedId?: string) {
  return selectedId ? `${href}?child=${encodeURIComponent(selectedId)}` : href;
}

export function GuardianHeader({ name, students, selectedId }: { name: string; students: GuardianStudent[]; selectedId?: string }) {
  return <>
    <GuardianAutoRefresh />
    <header className="guardianTop">
      <Link prefetch={false} href={portalHref("/veli-paneli", selectedId)} className="guardianBrand" aria-label="Sprint Yüzme Okulu portal ana sayfası">
        <span className="guardianBrandLogo"><img src="/sprint-logo.png" alt="Sprint Yüzme Okulu" /></span>
        <span className="guardianBrandText"><strong>SPRİNT</strong><small>Yüzme Okulu Portalı</small></span>
      </Link>
      <div className="guardianTopRight">
        <span className="guardianWelcome">Hoş geldiniz, <b>{name}</b></span>
        <span className="guardianLive"><i/> Canlı</span>
        <Link prefetch={false} className="guardianLogout" href="/auth/signout"><GuardianIcon name="logout" size={17}/><span>Çıkış</span></Link>
      </div>
    </header>
    <div className="guardianNavWrap">
      <nav className="guardianNav" aria-label="Portal menüsü">
        {navItems.map((item) => <Link prefetch={false} key={item.href} href={portalHref(item.href, selectedId)}><GuardianIcon name={item.icon} size={18}/><span>{item.label}</span></Link>)}
      </nav>
      {students.length > 1 ? <div className="childSwitch"><span>Öğrenci:</span>{students.map((student) => <Link prefetch={false} key={student.id} className={student.id === selectedId ? "active" : ""} href={portalHref("/veli-paneli", student.id)}>{student.first_name}</Link>)}</div> : null}
    </div>
  </>;
}

export function EmptyGuardian({ title, text }: { title: string; text: string }) {
  return <section className="guardianEmpty"><span className="guardianEmptyIcon"><GuardianIcon name="swimmer" size={34}/></span><h2>{title}</h2><p>{text}</p></section>;
}

export function StatusPill({ children, tone = "blue" }: { children: ReactNode; tone?: string }) {
  return <span className={`guardianPill ${tone}`}>{children}</span>;
}
