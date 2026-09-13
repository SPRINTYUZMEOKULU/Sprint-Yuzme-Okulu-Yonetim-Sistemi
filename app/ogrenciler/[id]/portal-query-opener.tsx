"use client";

import { useEffect } from "react";

/**
 * Kesin Kayıt Merkezi'nden ?portal=1 ile gelindiğinde
 * Dijital Kursiyer Dosyası üzerinde kalmak yerine Öğrenci / Veli Bilgi Merkezi'ni
 * otomatik açar ve Veli Portalı bölümüne götürür.
 */
export default function PortalQueryOpener() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("portal") !== "1") return;

    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.dataset.openProfileCenter = "1";
    trigger.style.display = "none";
    document.body.appendChild(trigger);

    // StudentProfileCenter'ın global click dinleyicisini kullanarak mevcut merkezi aç.
    trigger.click();
    trigger.remove();

    let attempts = 0;
    const focusPortal = () => {
      const portalSection = document.querySelector<HTMLElement>(
        ".profileCenterPanel .portalSection",
      );

      if (portalSection) {
        portalSection.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }

      attempts += 1;
      if (attempts < 20) window.setTimeout(focusPortal, 120);
    };

    window.setTimeout(focusPortal, 180);

    // Sayfa yenilenirse aynı pencerenin tekrar açılmaması için query'yi temizle.
    const url = new URL(window.location.href);
    url.searchParams.delete("portal");
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
  }, []);

  return null;
}
