"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type IconName = "home" | "card" | "users" | "check" | "shield" | "wallet";

function Icon({ name }: { name: IconName }) {
  const common = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  if (name === "home") return <svg {...common}><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M9 21v-6h6v6"/></svg>;
  if (name === "card") return <svg {...common}><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18"/><path d="M7 15h4"/></svg>;
  if (name === "users") return <svg {...common}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
  if (name === "check") return <svg {...common}><rect x="3" y="3" width="18" height="18" rx="4"/><path d="m8 12 2.5 2.5L16 9"/></svg>;
  if (name === "shield") return <svg {...common}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/></svg>;
  return <svg {...common}><path d="M20 7H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h15a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2Z"/><path d="M16 13h4"/><path d="M18 11v4"/><path d="M5 7V5a2 2 0 0 1 2-2h10"/></svg>;
}

const items: Array<{ label: string; href: string; icon: IconName }> = [
  { label: "Ana Sayfa", href: "/", icon: "home" },
  { label: "Ödeme Merkezi", href: "/odemeler", icon: "card" },
  { label: "Öğrenciler", href: "/ogrenciler", icon: "users" },
  { label: "Yoklama", href: "/yoklama", icon: "check" },
  { label: "Onay Merkezi", href: "/onay-merkezi", icon: "shield" },
];

export default function FinanceQuickNav() {
  const pathname = usePathname();
  return (
    <nav className="financeQuickNav" aria-label="Finans hızlı menü">
      {items.map((item) => {
        const active = item.href === "/" ? pathname === "/" : pathname === item.href || pathname.startsWith(`${item.href}/`);
        return <Link key={item.href} href={item.href} className={`financeQuickLink${active ? " active" : ""}`}><span className="financeQuickIcon"><Icon name={item.icon}/></span><span>{item.label}</span></Link>;
      })}
      <style jsx global>{`
        .financeQuickNav{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px;margin:4px 0 20px;padding:12px;border:1px solid #d9e5f3;border-radius:22px;background:rgba(255,255,255,.96);box-shadow:0 10px 28px rgba(15,42,76,.055)}
        .financeQuickNav .financeQuickLink{box-sizing:border-box;min-width:0;min-height:78px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;padding:12px 10px;border:1px solid #dbe6f2;border-radius:16px;background:#fff;color:#173b63!important;font-size:13px;font-weight:850;line-height:1.2;text-align:center;text-decoration:none!important;box-shadow:0 4px 14px rgba(15,42,76,.035);transition:transform .15s ease,box-shadow .15s ease,border-color .15s ease,background .15s ease,color .15s ease}
        .financeQuickNav .financeQuickLink:visited{color:#173b63!important}
        .financeQuickNav .financeQuickLink:hover{border-color:#bfd4ef;box-shadow:0 9px 22px rgba(15,42,76,.075);transform:translateY(-1px)}
        .financeQuickNav .financeQuickLink.active{background:linear-gradient(135deg,#1876f6 0%,#0f67e8 100%);border-color:#1170f5;color:#fff!important;box-shadow:0 11px 25px rgba(17,112,245,.22)}
        .financeQuickNav .financeQuickLink.active:visited{color:#fff!important}
        .financeQuickNav .financeQuickIcon{width:38px;height:38px;display:grid;place-items:center;border-radius:12px;background:#edf5ff;color:#1370f5;flex:0 0 38px}
        .financeQuickNav .financeQuickLink.active .financeQuickIcon{background:rgba(255,255,255,.16);color:#fff}
        @media(max-width:900px){.financeQuickNav{grid-template-columns:repeat(3,minmax(0,1fr))}}
        @media(max-width:720px){.financeQuickNav{grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;padding:10px;border-radius:20px}.financeQuickNav .financeQuickLink{min-height:82px;padding:11px 8px;border-radius:15px;font-size:12.5px}.financeQuickNav .financeQuickLink:last-child{grid-column:1/-1}.financeQuickNav .financeQuickIcon{width:36px;height:36px;flex-basis:36px}}
      `}</style>
    </nav>
  );
}
