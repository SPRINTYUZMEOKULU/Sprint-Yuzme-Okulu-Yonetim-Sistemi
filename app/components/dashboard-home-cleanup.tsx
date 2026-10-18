"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export default function DashboardHomeCleanup() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname !== "/") return;

    function hideDuplicateQuickAccess() {
      const headings = Array.from(document.querySelectorAll<HTMLElement>("h1,h2,h3,strong"));
      const heading = headings.find((node) =>
        (node.textContent || "").includes("İhtiyacınız Olan Modüle Tek Tıkla Ulaşın"),
      );
      if (!heading) return;

      const section = heading.closest<HTMLElement>(".quickCard") ||
        heading.closest<HTMLElement>(".quickSection") ||
        null;

      if (section) {
        section.dataset.dashboardDuplicateQuickAccess = "hidden";
        section.style.display = "none";
      }
    }

    hideDuplicateQuickAccess();
    const observer = new MutationObserver(hideDuplicateQuickAccess);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, [pathname]);

  return null;
}

