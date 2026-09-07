"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const PAYMENT_REDIRECT_KEY = "sprintos-open-student-payment";

function enhancePaymentCells() {
  const cards = Array.from(
    document.querySelectorAll<HTMLElement>(".studentGrid .studentCard")
  );

  for (const card of cards) {
    const cells = card.querySelectorAll<HTMLElement>(".dateRow > div");
    const paymentCell = cells[cells.length - 1];
    if (!paymentCell) continue;

    const label = paymentCell.querySelector<HTMLElement>("span");
    const value = paymentCell.querySelector<HTMLElement>("strong");
    if (!value || label?.textContent?.trim() !== "Ödeme") continue;

    paymentCell.classList.add("studentPaymentStatusCell");
    paymentCell.setAttribute("role", "button");
    paymentCell.setAttribute("tabindex", "0");
    paymentCell.setAttribute(
      "aria-label",
      "Öğrencinin ödeme sayfasını aç"
    );

    const waiting = value.classList.contains("paymentWarn");

    if (waiting) {
      value.textContent = "Ödeme Bekleniyor";
      paymentCell.classList.add("paymentWaitingCell");
      paymentCell.classList.remove("paymentClearCell");
    } else {
      value.textContent = "Borç Yok";
      paymentCell.classList.add("paymentClearCell");
      paymentCell.classList.remove("paymentWaitingCell");
    }
  }
}

export default function StudentPaymentStatusEnhancer() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname !== "/ogrenciler") return;

    enhancePaymentCells();

    const observer = new MutationObserver(() => enhancePaymentCells());
    observer.observe(document.body, { childList: true, subtree: true });

    const handleActivation = (event: Event) => {
      const target = event.target as HTMLElement | null;
      const paymentCell = target?.closest<HTMLElement>(
        ".studentPaymentStatusCell"
      );
      if (!paymentCell) return;

      if (event instanceof KeyboardEvent) {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
      }

      sessionStorage.setItem(PAYMENT_REDIRECT_KEY, "1");

      const card = paymentCell.closest<HTMLElement>(".studentCard");
      if (!card) return;

      if (event instanceof KeyboardEvent) {
        card.click();
      }
    };

    document.addEventListener("click", handleActivation, true);
    document.addEventListener("keydown", handleActivation, true);

    return () => {
      observer.disconnect();
      document.removeEventListener("click", handleActivation, true);
      document.removeEventListener("keydown", handleActivation, true);
    };
  }, [pathname]);

  useEffect(() => {
    if (!/^\/ogrenciler\/[^/]+$/.test(pathname)) return;
    if (sessionStorage.getItem(PAYMENT_REDIRECT_KEY) !== "1") return;

    sessionStorage.removeItem(PAYMENT_REDIRECT_KEY);

    window.requestAnimationFrame(() => {
      if (window.location.hash === "#odeme") {
        window.dispatchEvent(new HashChangeEvent("hashchange"));
        return;
      }

      window.location.hash = "odeme";
    });
  }, [pathname]);

  return (
    <style jsx global>{`
      .studentPaymentStatusCell {
        cursor: pointer;
        transition: transform 0.15s ease, box-shadow 0.15s ease,
          border-color 0.15s ease, background 0.15s ease;
      }

      .studentPaymentStatusCell:hover {
        transform: translateY(-1px);
      }

      .studentPaymentStatusCell:focus-visible {
        outline: 3px solid rgba(18, 104, 214, 0.22);
        outline-offset: 2px;
      }

      .studentPaymentStatusCell strong {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 36px;
        width: 100%;
        margin-top: 5px;
        padding: 8px 12px;
        border-radius: 12px;
        font-size: 14px;
        font-weight: 900;
        line-height: 1.15;
      }

      .studentPaymentStatusCell.paymentWaitingCell {
        border-color: #fecaca !important;
        background: #fff7f7 !important;
        box-shadow: inset 0 0 0 1px rgba(220, 38, 38, 0.04);
      }

      .studentPaymentStatusCell.paymentWaitingCell strong {
        color: #ffffff !important;
        background: linear-gradient(135deg, #dc2626, #ef4444);
        box-shadow: 0 8px 18px rgba(220, 38, 38, 0.18);
      }

      .studentPaymentStatusCell.paymentWaitingCell strong::before {
        content: "!";
        display: inline-grid;
        place-items: center;
        width: 20px;
        height: 20px;
        margin-right: 8px;
        border-radius: 999px;
        color: #dc2626;
        background: #ffffff;
        font-size: 13px;
        font-weight: 950;
      }

      .studentPaymentStatusCell.paymentWaitingCell strong::after,
      .studentPaymentStatusCell.paymentClearCell strong::after {
        content: "›";
        margin-left: auto;
        padding-left: 8px;
        font-size: 20px;
        line-height: 1;
      }

      .studentPaymentStatusCell.paymentClearCell {
        border-color: #bbf7d0 !important;
        background: #f7fff9 !important;
      }

      .studentPaymentStatusCell.paymentClearCell strong {
        color: #087443 !important;
        background: #ecfdf3;
        border: 1px solid #bbf7d0;
      }

      @media (max-width: 640px) {
        .studentPaymentStatusCell strong {
          min-height: 40px;
          font-size: 13px;
          padding-inline: 10px;
        }
      }
    `}</style>
  );
}
