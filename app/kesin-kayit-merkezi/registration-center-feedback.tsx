"use client";

import { useEffect } from "react";

export default function RegistrationCenterFeedback() {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>("[data-registration-center]");
    if (!root) return;

    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const control = target?.closest<HTMLElement>("a[data-action-feedback], button[data-action-feedback]");
      if (!control) return;

      control.classList.add("sprintActionPressed");

      const mode = control.dataset.actionFeedback || "default";
      if (mode === "open-registration" && control instanceof HTMLAnchorElement) {
        if (control.dataset.feedbackApplied === "1") return;
        control.dataset.feedbackApplied = "1";
        control.dataset.originalText = control.textContent || "";
        control.textContent = "Kesin Kayıt Açılıyor…";
        control.setAttribute("aria-busy", "true");
      }

      window.setTimeout(() => {
        control.classList.remove("sprintActionPressed");
      }, 280);
    };

    root.addEventListener("click", handleClick);
    return () => root.removeEventListener("click", handleClick);
  }, []);

  return (
    <style jsx global>{`
      [data-registration-center] a[data-action-feedback],
      [data-registration-center] button[data-action-feedback] {
        transition: transform 120ms ease, box-shadow 120ms ease, filter 120ms ease, opacity 120ms ease;
        -webkit-tap-highlight-color: transparent;
      }

      [data-registration-center] a[data-action-feedback]:active,
      [data-registration-center] button[data-action-feedback]:active,
      [data-registration-center] .sprintActionPressed {
        transform: scale(.965) translateY(1px);
        filter: brightness(.94);
        box-shadow: inset 0 2px 7px rgba(6, 35, 75, .18) !important;
      }

      [data-registration-center] a[aria-busy="true"] {
        pointer-events: none;
        opacity: .82;
      }
    `}</style>
  );
}
