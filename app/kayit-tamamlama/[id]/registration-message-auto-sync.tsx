"use client";

import { useEffect } from "react";

export default function RegistrationMessageAutoSync() {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;

    const refreshMessage = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            const refreshButton = Array.from(
              document.querySelectorAll<HTMLButtonElement>("#whatsapp button")
            ).find((button) =>
              button.textContent?.replace(/\s+/g, " ").trim() === "Mesajı Yenile"
            );

            refreshButton?.click();

            const sentCheckbox = document.querySelector<HTMLInputElement>(
              '#whatsapp input[name="message_sent"]'
            );
            if (sentCheckbox?.checked && !sentCheckbox.disabled) {
              sentCheckbox.click();
            }
          });
        });
      }, 80);
    };

    const onFieldChange = (event: Event) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      if (!target.closest("#kayit-plani, #odeme")) return;
      if (!target.matches("input, select, textarea")) return;
      refreshMessage();
    };

    document.addEventListener("input", onFieldChange, true);
    document.addEventListener("change", onFieldChange, true);

    return () => {
      if (timer) clearTimeout(timer);
      document.removeEventListener("input", onFieldChange, true);
      document.removeEventListener("change", onFieldChange, true);
    };
  }, []);

  return null;
}
