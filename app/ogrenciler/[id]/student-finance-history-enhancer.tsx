"use client";

import { useEffect } from "react";

function money(value: unknown) {
  const amount = Number(value ?? 0);
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0);
}

function dateText(value?: string | null) {
  if (!value) return "—";
  const date = new Date(`${String(value).slice(0, 10)}T12:00:00`);
  return Number.isNaN(date.getTime())
    ? String(value)
    : new Intl.DateTimeFormat("tr-TR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }).format(date);
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export default function StudentFinanceHistoryEnhancer() {
  useEffect(() => {
    const studentId =
      window.location.pathname.match(/\/ogrenciler\/([^/]+)/)?.[1] || "";
    if (!studentId) return;

    let finance: any = null;
    let disposed = false;

    async function load() {
      try {
        const response = await fetch(
          `/api/student-payment-center?studentId=${encodeURIComponent(studentId)}`,
          { cache: "no-store" },
        );
        if (!response.ok) return;
        const payload = await response.json();
        if (!disposed && payload?.ok) finance = payload;
      } catch {
        // Yardımcı görünüm ana finans modülünü engellemez.
      }
    }

    function enhanceHistory() {
      const enrollment = finance?.enrollment;
      if (!enrollment || Number(enrollment.remainingPayment || 0) <= 0) return;

      const historyCard = Array.from(
        document.querySelectorAll<HTMLElement>(".sfcCard"),
      ).find((card) =>
        (card.textContent || "").toLocaleLowerCase("tr-TR").includes("tahsilat geçmişi"),
      );
      if (!historyCard || historyCard.querySelector("[data-unpaid-period-row='1']")) return;

      const remaining = Number(enrollment.remainingPayment || 0);
      const total = Number(enrollment.totalAmount || 0);
      const received = Number(enrollment.totalReceived || 0);
      const lessons = Number(enrollment.lessonCount || 0);
      const packageName = enrollment.packageName || "Aktif kurs paketi";
      const packageLabel = lessons > 0
        ? `${lessons} derslik ${packageName}`
        : packageName;
      const period = `${dateText(enrollment.startDate)} - ${dateText(enrollment.plannedEndDate)}`;
      const due = enrollment.paymentDueDate ? dateText(enrollment.paymentDueDate) : "—";
      const dueTime = enrollment.paymentDueDate
        ? new Date(`${String(enrollment.paymentDueDate).slice(0, 10)}T23:59:59+03:00`).getTime()
        : Number.NaN;
      const overdue = Number.isFinite(dueTime) && dueTime < Date.now();

      const empty = historyCard.querySelector<HTMLElement>(".sfcEmpty");
      if (empty) empty.remove();

      let list = historyCard.querySelector<HTMLElement>(".sfcHistory");
      if (!list) {
        list = document.createElement("div");
        list.className = "sfcHistory";
        historyCard.appendChild(list);
      }

      const article = document.createElement("article");
      article.dataset.unpaidPeriodRow = "1";
      article.className = overdue ? "sfcUnpaidPeriod overdue" : "sfcUnpaidPeriod";
      article.innerHTML = `
        <div>
          <b>${escapeHtml(money(remaining))} · ${overdue ? "VADESİ GEÇTİ" : "ÖDEME BEKLİYOR"}</b>
          <span>${escapeHtml(packageLabel)}</span>
          <span>${escapeHtml(period)} tarihleri arasındaki paket ücreti ödenmedi.</span>
          <small>Paket: ${escapeHtml(money(total))} · Ödenen: ${escapeHtml(money(received))} · Kalan: ${escapeHtml(money(remaining))} · Vade: ${escapeHtml(due)}</small>
        </div>
        <button type="button" class="sfcMini" data-open-unpaid-payment>Ödeme Al</button>
      `;

      list.prepend(article);
      article
        .querySelector<HTMLButtonElement>("[data-open-unpaid-payment]")
        ?.addEventListener("click", () => {
          const paymentButton = Array.from(
            document.querySelectorAll<HTMLButtonElement>(".sfcTabs button"),
          ).find((button) => (button.textContent || "").includes("Ödeme Al"));
          paymentButton?.click();
        });

      if (!document.getElementById("sfc-unpaid-period-style")) {
        const style = document.createElement("style");
        style.id = "sfc-unpaid-period-style";
        style.textContent = `
          .sfcUnpaidPeriod{background:#fff9ec!important;border-color:#efd18b!important}
          .sfcUnpaidPeriod b{color:#8a5d00!important}
          .sfcUnpaidPeriod.overdue{background:#fff1f1!important;border-color:#e99090!important;animation:sfcDebtPulse 1.25s ease-in-out infinite}
          .sfcUnpaidPeriod.overdue b{color:#b22f3a!important}
          @keyframes sfcDebtPulse{0%,100%{box-shadow:0 0 0 0 rgba(190,51,62,.06)}50%{box-shadow:0 0 0 6px rgba(190,51,62,.13)}}
        `;
        document.head.appendChild(style);
      }
    }

    void load();

    const observer = new MutationObserver(() => enhanceHistory());
    observer.observe(document.body, { childList: true, subtree: true });

    const interval = window.setInterval(enhanceHistory, 700);

    return () => {
      disposed = true;
      observer.disconnect();
      window.clearInterval(interval);
    };
  }, []);

  return null;
}
