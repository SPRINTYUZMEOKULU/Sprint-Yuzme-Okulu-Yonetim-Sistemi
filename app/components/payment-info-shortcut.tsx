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

    function createSecureLink(className: string) {
      const link = document.createElement("a");
      link.href = securePaymentUrl;
      link.className = className;
      link.setAttribute("aria-label", "Belge bilgisi ve güvenli ödeme bağlantısı gönder");
      link.addEventListener("click", (event) => {
        event.stopPropagation();
        (event as any).stopImmediatePropagation?.();
      });
      link.innerHTML = `<span class="securePaymentInlineIcon">✓</span><span class="securePaymentInlineText"><b>Güvenli Ödeme</b><small>Belge bilgisi + ödeme linki</small></span>`;
      return link;
    }

    function enhancePaymentAreas() {
      // Dijital kursiyer dosyasındaki mevcut IBAN/QR ve Ödeme Al akışına dokunmadan
      // bağımsız Güvenli Ödeme kartını ekle.
      const fileActions = document.querySelector<HTMLElement>(".fileCommandActions");
      if (fileActions && !fileActions.querySelector(":scope > .securePaymentInline")) {
        const iban = Array.from(fileActions.querySelectorAll<HTMLElement>("button, a")).find((element) => {
          const text = (element.textContent || "").replace(/\s+/g, " ").trim();
          return text.includes("IBAN / QR") || text.includes("Ödeme bilgisi gönder");
        });
        const payment = Array.from(fileActions.querySelectorAll<HTMLElement>("button, a")).find((element) => {
          const text = (element.textContent || "").replace(/\s+/g, " ").trim();
          return text === "Ödeme Al" || text.startsWith("Ödeme Al ") || text.includes("Plan ve tahsilat");
        });
        const target = iban || payment;
        if (target) target.insertAdjacentElement("afterend", createSecureLink("securePaymentInline"));
      }

      // Ödeme & Vade paneli gerçek finans bileşenidir. Buraya da mevcut dört butonu
      // değiştirmeden beşinci, bağımsız Güvenli Ödeme butonunu ekle.
      const financeTabs = document.querySelector<HTMLElement>(".sfcTabs");
      if (financeTabs && !financeTabs.querySelector(":scope > .securePaymentFinance")) {
        financeTabs.appendChild(createSecureLink("securePaymentFinance"));
      }
    }

    const style = document.createElement("style");
    style.dataset.securePaymentInline = "true";
    style.textContent = `
      .securePaymentInline,.securePaymentFinance{box-sizing:border-box;min-height:58px;display:flex;align-items:center;justify-content:center;gap:10px;padding:11px 16px;border-radius:18px;border:1px solid #a9dfc1;background:linear-gradient(135deg,#effbf4,#e3f7ec);color:#08783e;text-decoration:none!important;font-family:inherit;font-weight:800;box-shadow:0 7px 18px rgba(17,130,73,.08);transition:transform .16s ease,box-shadow .16s ease,border-color .16s ease}
      .securePaymentInline:hover,.securePaymentFinance:hover{transform:translateY(-1px);border-color:#70c899;box-shadow:0 10px 22px rgba(17,130,73,.14)}
      .securePaymentInlineIcon{display:grid;place-items:center;width:32px;height:32px;flex:0 0 32px;border-radius:10px;background:#0a9b53;color:#fff;font-size:17px;font-weight:900}
      .securePaymentInlineText{display:flex;flex-direction:column;align-items:flex-start;line-height:1.08}
      .securePaymentInlineText b{font-size:14px}.securePaymentInlineText small{margin-top:4px;color:#56856c;font-size:10px;font-weight:700}
      .sfcTabs>.securePaymentFinance{grid-column:1/-1;background:linear-gradient(135deg,#effbf4,#e3f7ec)!important;color:#08783e!important}
      @media(max-width:720px){.securePaymentInline{width:100%;min-height:58px}.sfcTabs>.securePaymentFinance{grid-column:1/-1}}
    `;
    if (!document.querySelector("style[data-secure-payment-inline='true']")) document.head.appendChild(style);

    enhancePaymentAreas();
    const observer = new MutationObserver(enhancePaymentAreas);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      document.querySelectorAll(".securePaymentInline,.securePaymentFinance").forEach((node) => node.remove());
      document.querySelector("style[data-secure-payment-inline='true']")?.remove();
    };
  }, [pathname]);

  return null;
}
