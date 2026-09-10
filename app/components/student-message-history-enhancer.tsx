"use client";

import { useEffect } from "react";

type TimelineItem = {
  id: string;
  type: string;
  title: string;
  channel: string;
  recipient: string | null;
  body: string;
  status: string;
  sentAt: string;
};

type PaymentNotice = {
  id: string;
  title: string;
  description: string;
  sentAt: string;
  recipient: string | null;
};

function formatDate(value?: string | null) {
  if (!value) return "—";
  try {
    return new Intl.DateTimeFormat("tr-TR", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Europe/Istanbul",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getStudentId() {
  const match = window.location.pathname.match(/^\/ogrenciler\/([^/?#]+)/i);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

function renderMessage(item: TimelineItem) {
  const phone = item.recipient ? ` • ${escapeHtml(item.recipient)}` : "";
  const status = item.status === "sent" ? "Gönderildi" : escapeHtml(item.status || "Kayıtlı");

  return `
    <article class="sprintMessageHistoryCard" data-message-history-id="${escapeHtml(item.id)}">
      <div class="sprintMessageHistoryIcon" aria-hidden="true">✓</div>
      <div class="sprintMessageHistoryBody">
        <div class="sprintMessageHistoryTitleRow">
          <strong>${escapeHtml(item.title || "WhatsApp Bilgilendirmesi")}</strong>
          <span class="sprintMessageHistoryBadge">WhatsApp</span>
        </div>
        <p>${escapeHtml(item.body || "Bilgilendirme gönderildi.")}</p>
        <small>${status}${phone} • ${escapeHtml(formatDate(item.sentAt))}</small>
      </div>
    </article>
  `;
}

function renderPaymentNotice(item: PaymentNotice) {
  const phone = item.recipient ? ` • ${escapeHtml(item.recipient)}` : "";
  return `
    <article class="sprintPaymentNotice" data-payment-notice-id="${escapeHtml(item.id)}">
      <div>
        <strong>WhatsApp ödeme bilgilendirmesi</strong>
        <p>${escapeHtml(item.description || "Ödeme bilgileri veli/kursiyere gönderildi.")}</p>
      </div>
      <span>Bilgilendirme gönderildi${phone} • ${escapeHtml(formatDate(item.sentAt))}</span>
    </article>
  `;
}

function ensureStyles() {
  if (document.getElementById("sprint-message-history-styles")) return;
  const style = document.createElement("style");
  style.id = "sprint-message-history-styles";
  style.textContent = `
    #mesajlar .sprintMessageHistorySummary{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
    #mesajlar .sprintMessageHistoryCount{display:inline-flex;align-items:center;gap:6px;padding:6px 10px;border-radius:999px;background:#ecfdf3;border:1px solid #bbf7d0;color:#166534;font-size:11px;font-weight:800}
    #mesajlar .list.sprintUnifiedMessageList{display:grid;gap:10px}
    .sprintMessageHistoryCard{display:grid!important;grid-template-columns:34px 1fr;gap:10px;align-items:start;padding:13px!important;border:1px solid #e5e7eb!important;border-radius:14px!important;background:#fff!important}
    .sprintMessageHistoryIcon{width:30px;height:30px;border-radius:9px;display:grid;place-items:center;background:#ecfdf3;color:#15803d;font-weight:900;font-size:14px}
    .sprintMessageHistoryBody{min-width:0}
    .sprintMessageHistoryTitleRow{display:flex;gap:8px;align-items:center;justify-content:space-between;flex-wrap:wrap}
    .sprintMessageHistoryTitleRow strong{font-size:13px}
    .sprintMessageHistoryBadge{display:inline-flex;padding:4px 7px;border-radius:999px;background:#eff6ff;color:#1d4ed8;font-size:10px;font-weight:800}
    .sprintMessageHistoryCard p{white-space:pre-wrap;margin:6px 0 7px!important;color:#475569!important;font-size:12px!important;line-height:1.45!important;display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;overflow:hidden}
    .sprintMessageHistoryCard small{color:#64748b;font-size:10px;font-weight:700}
    #odeme .sprintPaymentNotice{border:1px solid #dbeafe!important;background:#f8fbff!important;border-radius:12px!important;padding:11px 12px!important}
    #odeme .sprintPaymentNotice strong{color:#1e3a8a;font-size:12px}
    #odeme .sprintPaymentNotice p{margin:4px 0 0!important;color:#475569!important;font-size:11px!important}
    #odeme .sprintPaymentNotice span{color:#1d4ed8!important;font-size:10px!important;font-weight:800!important}
  `;
  document.head.appendChild(style);
}

async function enhance() {
  const studentId = getStudentId();
  if (!studentId) return;

  const messagePanel = document.querySelector<HTMLElement>("#mesajlar");
  const paymentPanel = document.querySelector<HTMLElement>("#odeme");
  if (!messagePanel && !paymentPanel) return;

  const response = await fetch(`/api/student-message-history?studentId=${encodeURIComponent(studentId)}`, {
    cache: "no-store",
  }).catch(() => null);
  if (!response?.ok) return;

  const data = (await response.json().catch(() => null)) as {
    ok?: boolean;
    timeline?: TimelineItem[];
    paymentNotices?: PaymentNotice[];
    count?: number;
  } | null;
  if (!data?.ok) return;

  ensureStyles();

  if (messagePanel) {
    const head = messagePanel.querySelector<HTMLElement>(".panelHead");
    if (head && !head.querySelector(".sprintMessageHistoryCount")) {
      const badge = document.createElement("span");
      badge.className = "sprintMessageHistoryCount";
      badge.textContent = `${data.count || 0} iletişim kaydı`;
      head.appendChild(badge);
    }

    const list = messagePanel.querySelector<HTMLElement>(".list");
    if (list) {
      const timeline = data.timeline || [];
      list.classList.add("sprintUnifiedMessageList");
      list.innerHTML = timeline.length
        ? timeline.map(renderMessage).join("")
        : '<p class="empty">Henüz WhatsApp mesaj kaydı yok.</p>';
    }
  }

  if (paymentPanel) {
    const list = paymentPanel.querySelector<HTMLElement>(".list");
    const notices = data.paymentNotices || [];
    if (list && notices.length) {
      list.querySelectorAll("[data-payment-notice-id]").forEach((node) => node.remove());
      const wrapper = document.createElement("div");
      wrapper.innerHTML = notices.slice(0, 10).map(renderPaymentNotice).join("");
      Array.from(wrapper.children).reverse().forEach((node) => list.prepend(node));
    }
  }
}

export default function StudentMessageHistoryEnhancer() {
  useEffect(() => {
    let timer = window.setTimeout(() => void enhance(), 100);

    const onVisible = () => {
      if (document.visibilityState === "visible") {
        window.clearTimeout(timer);
        timer = window.setTimeout(() => void enhance(), 120);
      }
    };

    const onFocus = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => void enhance(), 150);
    };

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onFocus);

    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  return null;
}
