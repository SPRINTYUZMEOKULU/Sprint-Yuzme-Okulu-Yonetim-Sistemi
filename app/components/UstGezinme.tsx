"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

type MenuItem = {
  label: string;
  href: string;
  moduleKey: string;
};

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
  {
    label: "Kullanıcılar ve Yetkiler",
    href: "/kullanicilar-ve-yetkiler",
    moduleKey: "permissions",
  },
];

export default function UstGezinme() {
  const pathname = usePathname();
  const router = useRouter();

  const [loadingAccess, setLoadingAccess] = useState(true);
  const [role, setRole] = useState("");
  const [isSuperUser, setIsSuperUser] = useState(false);
  const [allowedModules, setAllowedModules] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function loadAccess() {
      try {
        const response = await fetch("/api/auth/access", {
          method: "GET",
          cache: "no-store",
          credentials: "same-origin",
        });

        const data = (await response.json()) as AccessResponse;

        if (cancelled) return;

        if (!response.ok || !data.ok) {
          setRole("");
          setIsSuperUser(false);
          setAllowedModules([]);
          return;
        }

        setRole(String(data.role || ""));
        setIsSuperUser(Boolean(data.is_super_user));
        setAllowedModules(
          Array.isArray(data.allowed_modules) ? data.allowed_modules : []
        );
      } catch (error) {
        console.error("SPRINTOS ACCESS MENU ERROR", error);

        if (!cancelled) {
          setRole("");
          setIsSuperUser(false);
          setAllowedModules([]);
        }
      } finally {
        if (!cancelled) {
          setLoadingAccess(false);
        }
      }
    }

    loadAccess();

    return () => {
      cancelled = true;
    };
  }, [pathname]);

  const fullAccess =
    role === "owner" || isSuperUser || allowedModules.includes("*");

  const visibleMenuItems = useMemo(() => {
    if (fullAccess) return menuItems;

    return menuItems.filter((item) =>
      allowedModules.includes(item.moduleKey)
    );
  }, [fullAccess, allowedModules]);

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  function handleLogout() {
    window.location.href = "/auth/signout";
  }

  const showHomeShortcut =
    fullAccess || allowedModules.includes("dashboard");

  return (
    <>
      <header className="topbar">
        <div className="topbarInner">
          <button
            type="button"
            onClick={() => router.back()}
            className="backBtn"
            aria-label="Geri"
            title="Geri"
          >
            ←
          </button>

          <Link href="/" className="brand" title="Ana Sayfa">
            <span className="logoWrap">
              <Image
                src="/icons/icon-192.png"
                alt="Sprint Yüzme Okulu"
                width={38}
                height={38}
                style={{ objectFit: "contain" }}
              />
            </span>

            <span className="brandText">
              <strong>SprintOS</strong>
              <small>Sprint Yüzme Okulu</small>
            </span>
          </Link>

          <nav className="navScroll">
            {loadingAccess ? (
              <span className="loading">Yetkiler yükleniyor…</span>
            ) : (
              visibleMenuItems.map((item) => {
                const active = isActive(item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`navItem ${active ? "active" : ""}`}
                  >
                    {item.label}
                  </Link>
                );
              })
            )}
          </nav>

          {showHomeShortcut && (
            <Link href="/" className="homeBtn" title="Ana Sayfa">
              Ana Sayfa
            </Link>
          )}

          <button
            type="button"
            onClick={handleLogout}
            className="logoutBtn"
            aria-label="Güvenli Çıkış"
            title="Güvenli Çıkış"
          >
            <span className="logoutIcon">⎋</span>
            <span className="logoutText">Güvenli Çıkış</span>
          </button>
        </div>
      </header>

      <style jsx>{`
        .topbar {
          position: sticky;
          top: 0;
          z-index: 1000;
          width: 100%;
          background: rgba(255, 255, 255, 0.97);
          backdrop-filter: blur(14px);
          -webkit-backdrop-filter: blur(14px);
          border-bottom: 1px solid #e4eaf3;
          box-shadow: 0 4px 18px rgba(15, 23, 42, 0.05);
        }

        .topbarInner {
          max-width: 1580px;
          margin: 0 auto;
          padding: 10px 18px;
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 0;
        }

        .backBtn {
          width: 40px;
          height: 40px;
          flex: 0 0 40px;
          border: 1px solid #dce5f2;
          border-radius: 11px;
          background: #ffffff;
          color: #13233f;
          font-size: 20px;
          font-weight: 900;
          cursor: pointer;
        }

        .brand {
          display: flex;
          align-items: center;
          gap: 9px;
          text-decoration: none;
          flex: 0 0 auto;
        }

        .logoWrap {
          width: 44px;
          height: 44px;
          flex: 0 0 44px;
          border-radius: 12px;
          border: 1px solid #dce5f2;
          background: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
        }

        .brandText {
          display: flex;
          flex-direction: column;
          line-height: 1.1;
        }

        .brandText strong {
          color: #13233f;
          font-size: 14px;
          font-weight: 900;
        }

        .brandText small {
          color: #64748b;
          font-size: 9px;
          margin-top: 3px;
        }

        .navScroll {
          flex: 1 1 auto;
          min-width: 0;
          display: flex;
          align-items: center;
          gap: 6px;
          overflow-x: auto;
          overflow-y: hidden;
          padding: 2px;
          scrollbar-width: thin;
        }

        .navItem {
          white-space: nowrap;
          text-decoration: none;
          padding: 10px 12px;
          border-radius: 9px;
          font-size: 11px;
          font-weight: 850;
          color: #475569;
          border: 1px solid transparent;
          background: transparent;
        }

        .navItem.active {
          background: #1769e8;
          color: #ffffff;
          border-color: #1769e8;
        }

        .loading {
          color: #94a3b8;
          font-size: 10px;
          padding: 10px 12px;
          white-space: nowrap;
        }

        .homeBtn {
          flex: 0 0 auto;
          height: 40px;
          padding: 0 13px;
          border-radius: 10px;
          background: #edf5ff;
          border: 1px solid #dbeafe;
          color: #1769e8;
          text-decoration: none;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 11px;
          font-weight: 900;
        }

        .logoutBtn {
          flex: 0 0 auto;
          height: 40px;
          padding: 0 13px;
          border-radius: 10px;
          border: 1px solid #fecdd3;
          background: #fff1f2;
          color: #be123c;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          font-size: 11px;
          font-weight: 900;
          cursor: pointer;
        }

        .logoutIcon {
          font-size: 17px;
          line-height: 1;
        }

        @media (max-width: 900px) {
          .topbarInner {
            padding: 8px 8px;
            gap: 6px;
          }

          .backBtn {
            width: 36px;
            height: 36px;
            flex-basis: 36px;
          }

          .brand {
            flex: 0 0 auto;
          }

          .logoWrap {
            width: 36px;
            height: 36px;
            flex-basis: 36px;
          }

          .brandText {
            display: none;
          }

          .homeBtn {
            display: none;
          }

          .navScroll {
            flex: 1 1 0;
            min-width: 0;
            max-width: none;
          }

          .navItem {
            padding: 8px 9px;
            font-size: 9.5px;
          }

          .logoutBtn {
            flex: 0 0 42px;
            width: 42px;
            height: 42px;
            padding: 0;
            border-radius: 12px;
            background: #be123c;
            color: #ffffff;
            border-color: #be123c;
          }

          .logoutText {
            display: none;
          }

          .logoutIcon {
            font-size: 21px;
          }
        }

        @media (max-width: 480px) {
          .topbarInner {
            padding-left: 6px;
            padding-right: 6px;
          }

          .backBtn {
            width: 34px;
            height: 34px;
            flex-basis: 34px;
          }

          .logoWrap {
            width: 34px;
            height: 34px;
            flex-basis: 34px;
          }

          .logoutBtn {
            flex-basis: 40px;
            width: 40px;
            height: 40px;
          }

          .navItem {
            padding: 8px 8px;
            font-size: 9px;
          }
        }
      `}</style>
    </>
  );
}
