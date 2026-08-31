"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "sprintos-sidebar-collapsed";

export default function SidebarToggle() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    try {
      const saved =
        window.localStorage.getItem(STORAGE_KEY) === "true";

      setCollapsed(saved);

      document.documentElement.classList.toggle(
        "sprintSidebarCollapsed",
        saved
      );
    } catch {
      setCollapsed(false);
    }

    return () => {
      document.documentElement.classList.remove(
        "sprintSidebarMobileOpen"
      );
    };
  }, []);

  function handleToggle() {
    const isMobile =
      window.matchMedia("(max-width: 820px)").matches;

    if (isMobile) {
      const nextOpen = !mobileOpen;

      setMobileOpen(nextOpen);

      document.documentElement.classList.toggle(
        "sprintSidebarMobileOpen",
        nextOpen
      );

      return;
    }

    const nextCollapsed = !collapsed;

    setCollapsed(nextCollapsed);

    document.documentElement.classList.toggle(
      "sprintSidebarCollapsed",
      nextCollapsed
    );

    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        String(nextCollapsed)
      );
    } catch {
      // Tarayıcı depolamayı engellerse menü yine çalışmaya devam eder.
    }
  }

  function closeMobileMenu() {
    setMobileOpen(false);

    document.documentElement.classList.remove(
      "sprintSidebarMobileOpen"
    );
  }

  const expanded = mobileOpen || !collapsed;

  return (
    <>
      <button
        type="button"
        className="sprintSidebarToggle"
        onClick={handleToggle}
        aria-label={
          expanded
            ? "Sol menüyü kapat"
            : "Sol menüyü aç"
        }
        aria-expanded={expanded}
        title={
          expanded
            ? "Menüyü Daralt"
            : "Menüyü Aç"
        }
      >
        <span />
        <span />
        <span />
      </button>

      <button
        type="button"
        className="sprintSidebarOverlay"
        onClick={closeMobileMenu}
        aria-label="Menüyü kapat"
        tabIndex={mobileOpen ? 0 : -1}
      />

      <style jsx global>{`
        .sprintSidebarToggle {
          width: 42px;
          height: 42px;
          flex: 0 0 42px;
          display: inline-flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 5px;
          padding: 0;
          border: 1px solid #dfe6f0;
          border-radius: 12px;
          background: #ffffff;
          color: #13213b;
          cursor: pointer;
          box-shadow: 0 7px 20px rgba(19, 33, 59, 0.08);
          transition:
            transform 160ms ease,
            background-color 160ms ease,
            border-color 160ms ease;
        }

        .sprintSidebarToggle:hover {
          transform: translateY(-1px);
          border-color: #b9d3f8;
          background: #f3f8ff;
        }

        .sprintSidebarToggle:focus-visible {
          outline: 3px solid rgba(23, 105, 232, 0.22);
          outline-offset: 2px;
        }

        .sprintSidebarToggle span {
          display: block;
          width: 19px;
          height: 2px;
          border-radius: 999px;
          background: currentColor;
          transition:
            transform 180ms ease,
            opacity 180ms ease;
        }

        .sprintSidebarOverlay {
          display: none;
        }

        html.sprintSidebarCollapsed .proShell {
          grid-template-columns: 86px minmax(0, 1fr);
        }

        html.sprintSidebarCollapsed .proSidebar {
          padding-left: 10px;
          padding-right: 10px;
        }

        html.sprintSidebarCollapsed .proBrand {
          justify-content: center;
          padding-left: 0;
          padding-right: 0;
        }

        html.sprintSidebarCollapsed
          .proBrand
          > div:last-child {
          display: none;
        }

        html.sprintSidebarCollapsed .navGroup > p {
          display: none;
        }

        html.sprintSidebarCollapsed .proNavItem {
          justify-content: center;
          padding-left: 0;
          padding-right: 0;
        }

        html.sprintSidebarCollapsed
          .proNavItem
          > span,
        html.sprintSidebarCollapsed
          .proNavItem
          > b {
          display: none;
        }

        html.sprintSidebarCollapsed .proUser {
          display: flex;
          justify-content: center;
          padding-left: 0;
          padding-right: 0;
        }

        html.sprintSidebarCollapsed
          .proUser
          > div:nth-child(2),
        html.sprintSidebarCollapsed
          .proUser
          > a {
          display: none;
        }

        .proShell,
        .proSidebar {
          transition:
            grid-template-columns 220ms ease,
            width 220ms ease,
            transform 220ms ease,
            padding 220ms ease;
        }

        @media (max-width: 820px) {
          html .proShell {
            display: block;
          }

          html .proSidebar {
            position: fixed;
            z-index: 80;
            top: 0;
            left: 0;
            width: min(86vw, 310px);
            height: 100dvh;
            min-height: 100dvh;
            padding: 20px 16px;
            overflow-y: auto;
            transform: translateX(-105%);
            box-shadow: 18px 0 50px rgba(3, 15, 36, 0.28);
          }

          html.sprintSidebarMobileOpen .proSidebar {
            transform: translateX(0);
          }

          html .proNav {
            display: block;
            overflow: visible;
            padding-top: 18px;
          }

          html .navGroup {
            display: block;
            margin-bottom: 18px;
          }

          html .navGroup > p {
            display: block;
          }

          html .proNavItem {
            justify-content: flex-start;
            min-width: 0;
            padding: 0 11px;
          }

          html .proUser {
            display: grid;
          }

          html.sprintSidebarMobileOpen {
            overflow: hidden;
          }

          .sprintSidebarOverlay {
            position: fixed;
            z-index: 70;
            inset: 0;
            width: 100%;
            height: 100%;
            padding: 0;
            border: 0;
            background: rgba(4, 14, 32, 0.52);
            cursor: pointer;
          }

          html.sprintSidebarMobileOpen
            .sprintSidebarOverlay {
            display: block;
          }

          .proTopbar {
            gap: 10px;
          }

          .proTopbar > div:first-of-type {
            min-width: 0;
            flex: 1;
          }
        }
      `}</style>
    </>
  );
}
