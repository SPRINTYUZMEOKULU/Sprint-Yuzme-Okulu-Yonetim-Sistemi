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

function openSection(sectionId: string) {
  const nextHash = `#${sectionId}`;

  if (window.location.hash === nextHash) {
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  } else {
    window.location.hash = sectionId;
  }
}

function findQuickAction(label: string) {
  return Array.from(
    document.querySelectorAll<HTMLElement>(
      ".fileCommandActions button, .fileCommandActions a",
    ),
  ).find((item) => cleanText(item).includes(label));
}

function openPaymentEntry() {
  const paymentButton = findQuickAction("ödeme al");

  if (paymentButton) {
    dispatchRoutedClick(paymentButton);
    return;
  }

  openSection("odeme");
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

        // Ödeme Al kendi React ödeme formunu açar. Burada olaya müdahale etmiyoruz.
        if (text.includes("ödeme al")) return;

        // Ödeme Geçmişi yalnızca finans sekmesini / geçmiş kayıtları gösterir.
        if (text.includes("ödeme geçmişi")) {
          event.preventDefault();
          event.stopImmediatePropagation();
          openSection("odeme");
          return;
        }

        if (text.includes("bilgileri düzenle")) {
          event.preventDefault();
          event.stopImmediatePropagation();

          const profileTrigger = document.querySelector<HTMLElement>(
            "[data-open-profile-center='1']",
          );

          if (profileTrigger) dispatchRoutedClick(profileTrigger);
          return;
        }

        if (
          quickAction.matches("[data-renewal-button='1']") ||
          text.includes("kayıt yenile") ||
          text.includes("onay bekliyor") ||
          text.includes("onaylandı · tamamla")
        ) {
          event.preventDefault();
          event.stopImmediatePropagation();
          window.dispatchEvent(new CustomEvent("sprint:open-renewal"));
          return;
        }

        // Grup/şube, telafi, mesaj, A4 ve sil/arşivle kendi React işleyicilerini kullanır.
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

      // Ödeme ile ilgili "İşlemi Aç" her zaman tahsilat giriş ekranını açar.
      if (href === "#odeme" || cardText.includes("ödeme")) {
        event.preventDefault();
        event.stopImmediatePropagation();
        openPaymentEntry();
        return;
      }

      // İletişim uyarıları öğrenci / veli bilgi merkezine gider.
      if (
        href === "#genel-bilgiler" ||
        cardText.includes("telefon") ||
        cardText.includes("iletişim")
      ) {
        const profileTrigger = document.querySelector<HTMLElement>(
          "[data-open-profile-center='1']",
        );

        if (profileTrigger) {
          event.preventDefault();
          event.stopImmediatePropagation();
          dispatchRoutedClick(profileTrigger);
        }
        return;
      }

      // Ders hakkı / yenileme uyarıları kayıt yenileme merkezine gider.
      if (
        cardText.includes("ders hakkı") ||
        cardText.includes("kayıt yenile") ||
        cardText.includes("yenileme")
      ) {
        event.preventDefault();
        event.stopImmediatePropagation();
        window.dispatchEvent(new CustomEvent("sprint:open-renewal"));
        return;
      }

      // Diğer uyarılarda mevcut href hedefini bozmuyoruz.
    };

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  return null;
}
