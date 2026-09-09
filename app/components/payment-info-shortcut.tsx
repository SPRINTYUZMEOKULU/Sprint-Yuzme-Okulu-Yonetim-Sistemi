"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export default function PaymentInfoShortcut() {
  const pathname = usePathname();

  useEffect(() => {
    const match = pathname.match(/^\/ogrenciler\/([^/]+)$/);
    if (!match) return;

    const studentId = encodeURIComponent(match[1]);
    const paymentUrl = `/odeme-bilgileri?studentId=${studentId}`;

    function enhancePaymentAreas() {
      const candidates = Array.from(
        document.querySelectorAll<HTMLElement>("button, a"),
      ).filter((element) => {
        const text = (element.textContent || "").replace(/\s+/g, " ").trim();
        return text === "Ödeme Al" || text.startsWith("Ödeme Al ") || text.includes("Plan ve tahsilat");
      });

      candidates.forEach((target) => {
        const parent = target.parentElement;
        if (!parent || parent.querySelector(":scope > .paymentInfoInline")) return;

        const link = document.createElement("a");
        link.href = paymentUrl;
        link.className = "paymentInfoInline";
        link.setAttribute("aria-label", "IBAN ve QR ödeme bilgilerini aç");
        link.innerHTML = `
          <span class="paymentInfoInlineIcon">₺</span>
          <span class="paymentInfoInlineText">
            <b>IBAN / QR</b>
            <small>Ödeme bilgisi gönder</small>
          </span>
        `;

        parent.insertBefore(link, target.nextSibling);
      });
    }

    const style = document.createElement("style");
    style.dataset.paymentInfoInline = "true";
    style.textContent = `
      .paymentInfoInline {
        box-sizing: border-box;
        min-height: 54px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
        padding: 11px 16px;
        border-radius: 15px;
        border: 1px solid #9fc8f4;
        background: linear-gradient(135deg,#edf6ff,#dceeff);
        color: #075db8;
        text-decoration: none;
        font-family: inherit;
        font-weight: 800;
        box-shadow: 0 7px 18px rgba(34,113,198,.08);
        transition: transform .16s ease, box-shadow .16s ease, border-color .16s ease;
      }
      .paymentInfoInline:hover {
        transform: translateY(-1px);
        border-color: #6eafea;
        box-shadow: 0 10px 22px rgba(34,113,198,.14);
      }
      .paymentInfoInlineIcon {
        display: grid;
        place-items: center;
        width: 32px;
        height: 32px;
        flex: 0 0 32px;
        border-radius: 10px;
        background: #1976e9;
        color: #fff;
        font-size: 17px;
        font-weight: 900;
      }
      .paymentInfoInlineText {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        line-height: 1.08;
      }
      .paymentInfoInlineText b { font-size: 14px; }
      .paymentInfoInlineText small {
        margin-top: 4px;
        color: #5d7f9f;
        font-size: 10px;
        font-weight: 700;
      }
      @media (max-width:720px) {
        .paymentInfoInline { width: 100%; min-height: 58px; }
      }
    `;

    if (!document.querySelector("style[data-payment-info-inline='true']")) {
      document.head.appendChild(style);
    }

    enhancePaymentAreas();

    const observer = new MutationObserver(enhancePaymentAreas);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      document.querySelectorAll(".paymentInfoInline").forEach((node) => node.remove());
      document.querySelector("style[data-payment-info-inline='true']")?.remove();
    };
  }, [pathname]);

  return null;
}
