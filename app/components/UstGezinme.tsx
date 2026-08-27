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
  { label: "Öğrenciler", href: "/ogrenciler", moduleKey: "students" },
  { label: "Gruplar", href: "/gruplar", moduleKey: "groups" },
  { label: "Ders Programı", href: "/ders-programi", moduleKey: "schedule" },
  { label: "Operasyon Planı", href: "/operasyon-plani", moduleKey: "operations" },
  { label: "Yoklama", href: "/yoklama", moduleKey: "attendance" },
  { label: "Ödemeler", href: "/odemeler", moduleKey: "finance" },
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
        if (!cancelled) setLoadingAccess(false);
      }
    }

    loadAccess();

    return () => {
      cancelled = true;
    };
  }, [pathname]);

  const fullAccess = role === "owner" || isSuperUser;

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
    window.location.assign("/auth/signout");
  }

  const showHomeShortcut =
    fullAccess || allowedModules.includes("dashboard");

  return (
    <>
      <header className="sprintTopbar">
        <div className="sprintTopbarInner">
          <button
            type="button"
            onClick={() => router.back()}
            title="Geri"
            aria-label="Geri"
            className="backButton"
          >
            ←
          </button>

          <Link href="/" title="Ana Sayfa" className="brandLink">
            <span className="logoBox">
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

          <nav className="menuScroll" aria-label="SprintOS ana menü">
            {loadingAccess ? (
              <span className="loadingText">Yetkiler yükleniyor…</span>
            ) : (
              visibleMenuItems.map((item) => {
                const active = isActive(item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`menuLink ${active ? "active" : ""}`}
                  >
                    {item.label}
                  </Link>
                );
              })
            )}
          </nav>

          {showHomeShortcut && (
            <Link href="/" title="Ana Sayfa" className="homeShortcut">
              Ana Sayfa
            </Link>
          )}

          <button
            type="button"
            onClick={handleLogout}
            title="Güvenli Çıkış"
            aria-label="Güvenli Çıkış"
            className="desktopLogout"
          >
            <span aria-hidden="true">🔒</span>
            <span className="logoutLabel">Güvenli Çıkış</span>
          </button>
        </div>
      </header>

      {/* MOBİLDE HER ZAMAN GÖRÜNEN SABİT ÇIKIŞ BUTONU */}
      <button
        type="button"
        onClick={handleLogout}
        title="Güvenli Çıkış"
        aria-label="Güvenli Çıkış"
        className="mobileLogout"
      >
        <span aria-hidden="true">🔒</span>
        <span>Çıkış</span>
      </button>

      <style jsx>{`
        .sprintTopbar {
          position: sticky;
          top: 0;
          z-index: 100;
          width: 100%;
          background: rgba(255, 255, 255, 0.96);
          backdrop-filter: blur(14px);
          -webkit-backdrop-filter: blur(14px);
          border-bottom: 1px solid #e4eaf3;
          box-shadow: 0 4px 18px rgba(15, 23, 42, 0.04);
        }

        .sprintTopbarInner {
          max-width: 1580px;
          margin: 0 auto;
          padding: 10px 18px;
          display: flex;
          align-items: center;
          gap: 12px;
          min-width: 0;
        }

        .backButton {
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
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .brandLink {
          display: flex;
          align-items: center;
          gap: 9px;
          text-decoration: none;
          flex-shrink: 0;
        }

        .logoBox {
          width: 44px;
          height: 44px;
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

        .menuScroll {
          flex: 1 1 auto;
          min-width: 0;
          display: flex;
          align-items: center;
          gap: 6px;
          overflow-x: auto;
          padding: 2px;
          scrollbar-width: thin;
        }

        .menuLink {
          white-space: nowrap;
          text-decoration: none;
          padding: 10px 12px;
          border-radius: 9px;
          font-size: 11px;
          font-weight: 850;
          transition: all 0.15s ease;
          background: transparent;
          color: #475569;
          border: 1px solid transparent;
        }

        .menuLink.active {
          background: #1769e8;
          color: #ffffff;
          border-color: #1769e8;
        }

        .loadingText {
          color: #94a3b8;
          font-size: 10px;
          padding: 10px 12px;
          white-space: nowrap;
        }

        .homeShortcut {
          flex-shrink: 0;
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

        .desktopLogout {
          flex-shrink: 0;
          height: 40px;
          padding: 0 14px;
          border-radius: 10px;
          background: #fff1f2;
          border: 1px solid #fecdd3;
          color: #be123c;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          font-size: 11px;
          font-weight: 900;
          cursor: pointer;
        }

        .mobileLogout {
          display: none;
        }

        @media (max-width: 900px) {
          .sprintTopbarInner {
            padding: 8px 10px;
            gap: 7px;
          }

          .backButton {
            width: 38px;
            height: 38px;
            flex-basis: 38px;
          }

          .logoBox {
            width: 40px;
            height: 40px;
          }

          .brandText {
            display: none;
          }

          .homeShortcut {
            display: none;
          }

          .desktopLogout {
            display: none;
          }

          .menuScroll {
            gap: 4px;
          }

          .menuLink {
            padding: 9px 10px;
            font-size: 10px;
          }

          .mobileLogout {
            position: fixed;
            right: 14px;
            bottom: calc(16px + env(safe-area-inset-bottom));
            z-index: 9999;
            min-width: 92px;
            height: 46px;
            padding: 0 15px;
            border-radius: 999px;
            background: #be123c;
            border: 1px solid #9f1239;
            color: #ffffff;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 7px;
            font-size: 12px;
            font-weight: 900;
            cursor: pointer;
            box-shadow: 0 10px 28px rgba(190, 18, 60, 0.28);
          }
        }

        @media (max-width: 480px) {
          .sprintTopbarInner {
            padding-left: 8px;
            padding-right: 8px;
          }

          .brandLink {
            gap: 0;
          }

          .logoBox {
            width: 38px;
            height: 38px;
          }

          .menuLink {
            padding: 8px 9px;
            font-size: 9.5px;
          }

          .mobileLogout {
            right: 12px;
            min-width: 88px;
            height: 44px;
            font-size: 11px;
          }
        }
      `}</style>
    </>
  );
}
