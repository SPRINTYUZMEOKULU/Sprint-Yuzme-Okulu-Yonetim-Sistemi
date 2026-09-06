"use client";

import { useEffect } from "react";

export default function RegistrationPaymentUiEnhancer() {
  useEffect(() => {
    function syncPaymentUi() {
      const links = Array.from(document.querySelectorAll<HTMLAnchorElement>("a.sectionLink"));
      for (const link of links) {
        const text = (link.textContent || "").replace(/\s+/g, " ").trim();
        if (!text.includes("Ödeme Al") && !text.includes("Plan Hazırla")) continue;

        link.textContent = "Ödeme Al / Vade Belirle ›";
        const href = link.getAttribute("href") || "";
        if (href.includes("?payment=plan")) {
          link.setAttribute("href", href.replace("?payment=plan", "?payment=due"));
        }
      }

      const allElements = Array.from(document.querySelectorAll<HTMLElement>("span, p, small"));
      for (const element of allElements) {
        const text = (element.textContent || "").trim();
        if (text === "Paket fiyatı seçildiğinde bakiye hesaplanır.") {
          element.textContent =
            "Paket seçildiğinde kayıt dönemi paket ücreti kadar otomatik borçlandırılır.";
        }
      }
    }

    syncPaymentUi();
    const observer = new MutationObserver(syncPaymentUi);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return null;
}
