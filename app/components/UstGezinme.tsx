"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

type MenuItem = {
  label: string;
  href: string;
};

const menuItems: MenuItem[] = [
  {
    label: "Ana Sayfa",
    href: "/",
  },
  {
    label: "Öğrenciler",
    href: "/ogrenciler",
  },
  {
    label: "Gruplar",
    href: "/gruplar",
  },
  {
    label: "Ders Programı",
    href: "/ders-programi",
  },
  {
    label: "Operasyon Planı",
    href: "/operasyon-plani",
  },
  {
    label: "Yoklama",
    href: "/yoklama",
  },
  {
    label: "Ödemeler",
    href: "/odemeler",
  },
  {
    label: "Kullanıcılar ve Yetkiler",
    href: "/kullanicilar-ve-yetkiler",
  },
];

export default function UstGezinme() {
  const pathname = usePathname();
  const router = useRouter();

  function isActive(href: string) {
    if (href === "/") {
      return pathname === "/";
    }

    return (
      pathname === href ||
      pathname.startsWith(`${href}/`)
    );
  }

  return (
    <div
      style={{
        position: "sticky",
        top: 0,
        zIndex: 100,
        width: "100%",
        background: "rgba(255,255,255,0.96)",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        borderBottom: "1px solid #e4eaf3",
        boxShadow: "0 4px 18px rgba(15,23,42,0.04)",
      }}
    >
      <div
        style={{
          maxWidth: 1580,
          margin: "0 auto",
          padding: "10px 18px",
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        {/* GERİ */}
        <button
          type="button"
          onClick={() => router.back()}
          title="Geri"
          style={{
            width: 40,
            height: 40,
            flexShrink: 0,
            border: "1px solid #dce5f2",
            borderRadius: 11,
            background: "#ffffff",
            color: "#13233f",
            fontSize: 20,
            fontWeight: 900,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          ←
        </button>

        {/* LOGO */}
        <Link
          href="/"
          title="Ana Sayfa"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 9,
            textDecoration: "none",
            flexShrink: 0,
          }}
        >
          <span
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              border: "1px solid #dce5f2",
              background: "#ffffff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
            }}
          >
            <Image
              src="/icons/icon-192.png"
              alt="Sprint Yüzme Okulu"
              width={38}
              height={38}
              style={{
                objectFit: "contain",
              }}
            />
          </span>

          <span
            style={{
              display: "flex",
              flexDirection: "column",
              lineHeight: 1.1,
            }}
          >
            <strong
              style={{
                color: "#13233f",
                fontSize: 14,
                fontWeight: 900,
              }}
            >
              SprintOS
            </strong>

            <small
              style={{
                color: "#64748b",
                fontSize: 9,
                marginTop: 3,
              }}
            >
              Sprint Yüzme Okulu
            </small>
          </span>
        </Link>

        {/* SAYFA MENÜSÜ */}
        <nav
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            gap: 6,
            overflowX: "auto",
            padding: "2px 2px",
            scrollbarWidth: "thin",
          }}
        >
          {menuItems.map((item) => {
            const active = isActive(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  whiteSpace: "nowrap",
                  textDecoration: "none",
                  padding: "10px 12px",
                  borderRadius: 9,
                  fontSize: 11,
                  fontWeight: 850,
                  transition: "all .15s ease",

                  background: active
                    ? "#1769e8"
                    : "transparent",

                  color: active
                    ? "#ffffff"
                    : "#475569",

                  border: active
                    ? "1px solid #1769e8"
                    : "1px solid transparent",
                }}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* ANA SAYFA KISAYOLU */}
        <Link
          href="/"
          title="Ana Sayfa"
          style={{
            flexShrink: 0,
            height: 40,
            padding: "0 13px",
            borderRadius: 10,
            background: "#edf5ff",
            border: "1px solid #dbeafe",
            color: "#1769e8",
            textDecoration: "none",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 11,
            fontWeight: 900,
          }}
        >
          Ana Sayfa
        </Link>
      </div>
    </div>
  );
}
