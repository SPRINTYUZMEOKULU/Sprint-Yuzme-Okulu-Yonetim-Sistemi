"use client";

import { useEffect } from "react";

export default function SidebarBranchClickFix() {
  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;

      if (target.closest(".sidebarBranchToggle")) return;

      const link = target.closest<HTMLAnchorElement>(".proSidebar .proNavItem.hasBranchMenu");
      if (!link) return;

      const toggle = link.querySelector<HTMLElement>(".sidebarBranchToggle");
      if (!toggle) return;

      event.preventDefault();
      event.stopPropagation();
      toggle.click();
    };

    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, []);

  return null;
}
