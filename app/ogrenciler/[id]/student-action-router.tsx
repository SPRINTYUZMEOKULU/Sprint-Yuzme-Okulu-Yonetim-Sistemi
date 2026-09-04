"use client";

import { useEffect } from "react";

type RoutedMouseEvent = MouseEvent & { __sprintRouted?: boolean };

function cleanText(element: Element | null) {
  return (element?.textContent || "")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("tr-TR");
}

function dispatchRoutedClick(element: HTMLElement) {
  const event = new MouseEvent("click", {
    bubbles: true,
    cancelable: true,
    view: window,
  }) as RoutedMouseEvent;
  event.__sprintRouted = true;
  element.dispatchEvent(event);
}

function findQuickAction(label: string) {
  return Array.from(
    document.querySelectorAll<HTMLElement>(
      ".fileCommandActions button, .fileCommandActions a",
    ),
  ).find((item) => cleanText(item).includes(label));
}

function openSection(sectionId: string) {
  const nextHash = `#${sectionId}`;
  if (window.location.hash === nextHash) {
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  } else {
    window.location.hash = sectionId;
  }
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

function hardOpenRenewal() {
  const url = new URL(window.location.href);
  url.searchParams.set("renewalOpen", "1");
  url.hash = "";
  window.location.assign(url.toString());
}

export default function StudentActionRouter() {
  useEffect(() => {
    let renewalTapAt = 0;

    const onPointerUp = (event: PointerEvent) => {
      const target = event.target as Element | null;
      const quickAction = target?.closest<HTMLElement>(
        ".fileCommandActions button, .fileCommandActions a, [data-renewal-button='1']",
      );
      if (!isRenewalAction(quickAction || null)) return;

      renewalTapAt = Date.now();
      event.preventDefault();
      event.stopImmediatePropagation();
      hardOpenRenewal();
    };

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

        if (text.includes("ödeme al")) {
          event.preventDefault();
          event.stopImmediatePropagation();
          const paymentTrigger = findQuickAction("ödeme al");
          if (paymentTrigger) dispatchRoutedClick(paymentTrigger);
          return;
        }

        if (text.includes("ödeme geçmişi")) {
          event.preventDefault();
          event.stopImmediatePropagation();
          openSection("odeme");
          return;
        }

        if (text.includes("bilgileri düzenle")) {
          return;
        }

        if (isRenewalAction(quickAction)) {
          event.preventDefault();
          event.stopImmediatePropagation();
          if (Date.now() - renewalTapAt < 1200) return;
          hardOpenRenewal();
          return;
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

      if (href === "#odeme" || cardText.includes("ödeme")) {
        const paymentTrigger = findQuickAction("ödeme al");
        if (paymentTrigger) {
          event.preventDefault();
          event.stopImmediatePropagation();
          dispatchRoutedClick(paymentTrigger);
        }
        return;
      }

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
        hardOpenRenewal();
      }
    };

    document.addEventListener("pointerup", onPointerUp, true);
    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("pointerup", onPointerUp, true);
      document.removeEventListener("click", onClick, true);
    };
  }, []);

  return null;
}
