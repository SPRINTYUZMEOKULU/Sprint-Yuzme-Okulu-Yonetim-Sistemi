"use client";

import { useEffect } from "react";

type RoutedMouseEvent = MouseEvent & { __sprintRouted?: boolean };

function cleanText(element: Element | null) {
  return (element?.textContent || "")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("tr-TR");
}

function isRenewalAction(element: HTMLElement | null) {
  if (!element) return false;
  const text = cleanText(element);
  return (
    element.dataset.renewalButton === "1" ||
    text.includes("kayıt yenile") ||
    text.includes("onay bekliyor") ||
    text.includes("onaylandı · tamamla")
  );
}

function openRenewal() {
  window.dispatchEvent(new CustomEvent("sprint:open-renewal"));
}

export default function StudentActionRouter() {
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const routedEvent = event as RoutedMouseEvent;
      if (routedEvent.__sprintRouted) return;

      const target = event.target as Element | null;
      if (!target) return;

      const quickAction = target.closest<HTMLElement>(
        ".fileCommandActions button, .fileCommandActions a",
      );

      if (quickAction) {
        const text = cleanText(quickAction);

        // Ödeme Al, Ödeme Geçmişi ve Vade Belirle aksiyonlarının tamamı
        // StudentFinanceCenter tarafından yönetilir. Burada ikinci bir ödeme
        // yönlendirmesi yapmıyoruz; böylece tüm ekranlar aynı finans modülünü açar.
        if (
          text.includes("ödeme al") ||
          text.includes("ödeme geçmişi") ||
          text.includes("vade")
        ) {
          return;
        }

        if (text.includes("bilgileri düzenle")) return;

        if(quickAction.dataset.renewalButton==="1")return;
        if (isRenewalAction(quickAction)) {
          event.preventDefault();
          event.stopImmediatePropagation();
          openRenewal();
        }
        return;
      }

      const alertAction = target.closest<HTMLElement>(
        ".smartAlertGrid a, .smartAlertGrid button",
      );
      if (!alertAction) return;

      const card =
        alertAction.closest<HTMLElement>(".smartAlertGrid > *") ||
        alertAction.parentElement;
      const cardText = cleanText(card);
      const href =
        alertAction instanceof HTMLAnchorElement
          ? alertAction.getAttribute("href") || ""
          : "";

      // Finans uyarıları da aynı StudentFinanceCenter tarafından yakalanır.
      if (href === "#odeme" || cardText.includes("ödeme")) return;

      if (
        href === "#genel-bilgiler" ||
        cardText.includes("telefon") ||
        cardText.includes("iletişim")
      ) {
        return;
      }

      if (
        cardText.includes("ders hakkı") ||
        cardText.includes("kayıt yenile") ||
        cardText.includes("yenileme")
      ) {
        event.preventDefault();
        event.stopImmediatePropagation();
        openRenewal();
      }
    };

    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("click", onClick, true);
    };
  }, []);

  return null;
}
