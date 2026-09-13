"use client";

import { useEffect } from "react";

/**
 * Kesin Kayıt Merkezi'nden ?portal=1 ile gelindiğinde
 * Öğrenci / Veli Bilgi Merkezi'ni otomatik açar ve Veli Portalı bölümüne götürür.
 */
export default function PortalQueryOpener() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("portal") !== "1") return;

    let attempts = 0;

    const openAndFocusPortal = () => {
      const existingPanel = document.querySelector<HTMLElement>(".profileCenterPanel");

      if (!existingPanel) {
        const trigger = document.createElement("button");
        trigger.type = "button";
        trigger.dataset.openProfileCenter = "1";
        trigger.style.display = "none";
        document.body.appendChild(trigger);
        trigger.click();
        trigger.remove();
      }

      const portalSection = document.querySelector<HTMLElement>(
        ".profileCenterPanel .portalSection",
      );

      if (portalSection) {
        portalSection.scrollIntoView({ behavior: "smooth", block: "start" });

        const url = new URL(window.location.href);
        url.searchParams.delete("portal");
        window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
        return;
      }

      attempts += 1;
      if (attempts < 24) window.setTimeout(openAndFocusPortal, 120);
    };

    window.setTimeout(openAndFocusPortal, 60);
  }, []);

  return null;
}
