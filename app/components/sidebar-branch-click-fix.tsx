"use client";

import { useEffect } from "react";

export default function SidebarBranchClickFix() {
  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;

      const link = target.closest<HTMLAnchorElement>(
        ".proSidebar .proNavItem.hasBranchMenu",
      );
      if (!link) return;

      const childBox = link.nextElementSibling as HTMLElement | null;
      if (!childBox?.classList.contains("sidebarBranchChildren")) return;

      event.preventDefault();
      event.stopPropagation();

      const shouldOpen = childBox.hidden;

      document
        .querySelectorAll<HTMLElement>(
          ".proSidebar .sidebarBranchChildren:not([hidden])",
        )
        .forEach((box) => {
          if (box === childBox) return;
          box.hidden = true;
          const parent = box.previousElementSibling as HTMLElement | null;
          parent?.classList.remove("branchOpen");
          parent
            ?.querySelector<HTMLElement>(".sidebarBranchToggle")
            ?.setAttribute("aria-expanded", "false");
        });

      childBox.hidden = !shouldOpen;
      link.classList.toggle("branchOpen", shouldOpen);
      link
        .querySelector<HTMLElement>(".sidebarBranchToggle")
        ?.setAttribute("aria-expanded", String(shouldOpen));

      if (shouldOpen) {
        requestAnimationFrame(() => {
          childBox.scrollIntoView({ block: "nearest", behavior: "smooth" });
        });
      }
    };

    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, []);

  return null;
}
