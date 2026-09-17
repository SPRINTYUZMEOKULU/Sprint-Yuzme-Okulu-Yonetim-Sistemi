"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export default function PaymentInfoShortcut() {
  const pathname = usePathname();

  useEffect(() => {
    const match = pathname.match(/^\/ogrenciler\/([^/]+)$/);
    if (!match) return;

    const studentId = encodeURIComponent(match[1]);
    const securePaymentUrl = `/odeme-bilgileri?studentId=${studentId}&mode=secure`;

    function enhancePaymentAreas() {
      const existingIban = Array.from(document.querySelectorAll<HTMLElement>("button, a")).find((element) => {
        const text = (element.textContent || "").replace(/\s+/g, " ").trim();
        return text.includes("IBAN / QR") || text.includes("Ödeme bilgisi gönder");
      });

      const paymentButton = Array.from(document.querySelectorAll<HTMLElement>("button, a")).find((element) => {
        const text = (element.textContent || "").replace(/\s+/g, " ").trim();
        return text === "Ödeme Al" || text.startsWith("Ödeme Al ") || text.includes("Plan ve tahsilat");
      });

      const target = existingIban || paymentButton;
      const parent = target?.parentElement;
      if (!target || !parent || parent.querySelector(":scope > .securePaymentInline")) return;

      const link = document.createElement("a");
      link.href = securePaymentUrl;
      link.className = "securePaymentInline";
      link.setAttribute("aria-label", "Belge bilgisi ve güvenli ödeme bağlantısı gönder");
      link.innerHTML = `<span class="securePaymentInlineIcon">✓</span><span class="securePaymentInlineText"><b>Güvenli Ödeme</b><small>Belge bilgisi + ödeme linki</small></span>`;
      target.insertAdjacentElement("afterend", link);
    }

    const style = document.createElement("style");
    style.dataset.securePaymentInline = "true";
    style.textContent = `.securePaymentInline{box-sizing:border-box;min-height:54px;display:inline-flex;align-items:center;justify-content:center;gap:10px;padding:11px 16px;border-radius:15px;border:1px solid #a9dfc1;background:linear-gradient(135deg,#effbf4,#e3f7ec);color:#08783e;text-decoration:none;font-family:inherit;font-weight:800;box-shadow:0 7px 18px rgba(17,130,73,.08);transition:transform .16s ease,box-shadow .16s ease,border-color .16s ease}.securePaymentInline:hover{transform:translateY(-1px);border-color:#70c899;box-shadow:0 10px 22px rgba(17,130,73,.14)}.securePaymentInlineIcon{display:grid;place-items:center;width:32px;height:32px;flex:0 0 32px;border-radius:10px;background:#0a9b53;color:#fff;font-size:17px;font-weight:900}.securePaymentInlineText{display:flex;flex-direction:column;align-items:flex-start;line-height:1.08}.securePaymentInlineText b{font-size:14px}.securePaymentInlineText small{margin-top:4px;color:#56856c;font-size:10px;font-weight:700}@media(max-width:720px){.securePaymentInline{width:100%;min-height:58px}}`;
    if (!document.querySelector("style[data-secure-payment-inline='true']")) document.head.appendChild(style);

    enhancePaymentAreas();
    const observer = new MutationObserver(enhancePaymentAreas);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      document.querySelectorAll(".securePaymentInline").forEach((node) => node.remove());
      document.querySelector("style[data-secure-payment-inline='true']")?.remove();
    };
  }, [pathname]);

  return null;
}
