"use client";

import { useEffect } from "react";

export default function ProfileCenterClickBridge() {
  useEffect(() => {
    const bind = () => {
      const buttons = Array.from(
        document.querySelectorAll<HTMLButtonElement>(".fileCommandActions button"),
      );
      const button = buttons.find((item) =>
        (item.textContent || "").replace(/\s+/g, " ").includes("Bilgileri Düzenle"),
      );
      if (!button || button.dataset.profileCenterBridge === "1") return;

      button.dataset.profileCenterBridge = "1";
      button.addEventListener("click", (event: MouseEvent) => {
        if ((event as MouseEvent & { __profileCenterSynthetic?: boolean }).__profileCenterSynthetic) return;
        event.preventDefault();
        event.stopImmediatePropagation();

        const synthetic = new MouseEvent("click", {
          bubbles: true,
          cancelable: true,
          view: window,
        }) as MouseEvent & { __profileCenterSynthetic?: boolean };
        synthetic.__profileCenterSynthetic = true;
        button.dispatchEvent(synthetic);
      });
    };

    bind();
    const observer = new MutationObserver(bind);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return null;
}
