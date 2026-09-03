"use client";

import { useEffect } from "react";

export default function ProfileCenterClickBridge() {
  useEffect(() => {
    const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>(".fileCommandActions button"));
    const button = buttons.find((item) =>
      (item.textContent || "").replace(/\s+/g, " ").includes("Bilgileri Düzenle"),
    );
    if (!button || button.dataset.profileCenterBridge === "1") return;

    button.dataset.profileCenterBridge = "1";
    const handler = (event: MouseEvent) => {
      if ((event as MouseEvent & { __profileCenterSynthetic?: boolean }).__profileCenterSynthetic) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      const synthetic = new MouseEvent("click", { bubbles: true, cancelable: true, view: window }) as MouseEvent & { __profileCenterSynthetic?: boolean };
      synthetic.__profileCenterSynthetic = true;
      button.dispatchEvent(synthetic);
    };

    button.addEventListener("click", handler);
    return () => button.removeEventListener("click", handler);
  }, []);

  return null;
}
