"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type IconName = "home" | "card" | "users" | "check" | "shield" | "wallet";

function Icon({ name }: { name: IconName }) {
  const common = {
    width: 18,
    height: 18,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  if (name === "home") {
    return (
      <svg {...common}>
        <path d="M3 10.5 12 3l9 7.5" />
        <path d="M5 9.5V21h14V9.5" />
        <path d="M9 21v-6h6v6" />
      </svg>
    );
  }

  if (name === "card") {
    return (
      <svg {...common}>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="M3 10h18" />
        <path d="M7 15h4" />
      </svg>
    );
  }

  if (name === "users") {
    return (
      <svg {...common}>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    );
  }

  if (name === "check") {
    return (
      <svg {...common}>
        <rect x="3" y="3" width="18" height="18" rx="4" />
        <path d="m8 12 2.5 2.5L16 9" />
      </svg>
    );
  }

  if (name === "shield") {
    return (
      <svg {...common}>
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
        <path d="m9 12 2 2 4-4" />
      </svg>
    );
  }

  return (
    <svg {...common}>
      <path d="M20 7H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h15a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2Z" />
      <path d="M16 13h4" />
      <path d="M18 11v4" />
      <path d="M5 7V5a2 2 0 0 1 2-2h10" />
    </svg>
  );
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
        const active =
          item.href === "/"
            ? pathname === "/"
            : pathname === item.href || pathname.startsWith(`${item.href}/`);

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`financeQuickLink${active ? " active" : ""}`}
          >
            <span className="financeQuickIcon">
              <Icon name={item.icon} />
            </span>
            <span>{item.label}</span>
          </Link>
        );
      })}

      <style jsx>{`
        .financeQuickNav {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin: 2px 0 18px;
        }

        .financeQuickLink {
          min-height: 44px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 10px 14px;
          border: 1px solid #dbe5f1;
          border-radius: 14px;
          background: rgba(255, 255, 255, 0.94);
          color: #10213a;
          font-size: 14px;
          font-weight: 800;
          line-height: 1;
          text-decoration: none;
          box-shadow: 0 5px 16px rgba(15, 35, 66, 0.04);
          transition: border-color 160ms ease, box-shadow 160ms ease,
            transform 160ms ease, background 160ms ease, color 160ms ease;
        }

        .financeQuickLink:hover {
          border-color: #a9c6ee;
          box-shadow: 0 8px 22px rgba(15, 35, 66, 0.08);
          transform: translateY(-1px);
        }

        .financeQuickLink.active {
          background: #156ff5;
          border-color: #156ff5;
          color: #fff;
          box-shadow: 0 9px 22px rgba(21, 111, 245, 0.22);
        }

        .financeQuickIcon {
          width: 26px;
          height: 26px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 9px;
          background: #eef5ff;
          color: #1769db;
          flex: 0 0 auto;
        }

        .financeQuickLink.active .financeQuickIcon {
          background: rgba(255, 255, 255, 0.18);
          color: #fff;
        }

        @media (max-width: 720px) {
          .financeQuickNav {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 8px;
          }

          .financeQuickLink {
            min-width: 0;
            padding: 10px 11px;
            justify-content: flex-start;
            font-size: 13px;
          }

          .financeQuickLink:first-child {
            grid-column: 1 / -1;
          }
        }
      `}</style>
    </nav>
  );
}
