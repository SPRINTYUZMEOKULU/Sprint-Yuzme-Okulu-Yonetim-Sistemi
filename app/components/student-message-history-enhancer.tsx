"use client";

import { formatDisplayDateTime } from "@/lib/dates/display";
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
  deliveryConfirmation?: string | null;
};

type PaymentNotice = {
  deliveryConfirmation?: string | null;
  id: string;
  title: string;
  description: string;
  sentAt: string;
  recipient: string | null;
};

function formatDate(value?: string | null) {
  if (!value) return "—";
  try {
    return formatDisplayDateTime(new Date(value));
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
  const labels:Record<string,string>={confirmed:"Gönderim onaylandı",sent:"Gönderildi",opened:"WhatsApp açıldı · Onay bekliyor",prepared:"Hazırlandı",failed:"Gönderilemedi",cancelled:"İptal edildi"};
  const status=labels[item.status]||"Kayıtlı";
  const state=["confirmed","sent"].includes(item.status)?"success":item.status==="failed"?"error":"pending";
  const body=String(item.body||"");
  const preview=body.length>200?body.slice(0,200)+"…":body;
  const icon=state==="success"?"✓":state==="error"?"!":"◷";
  const title=String(item.title||"WhatsApp Bilgilendirmesi").replace(item.status==="opened"?/\\s+gönderildi$/i:/$^/,"");

  return `
    <article class="sprintMessageHistoryCard ${state}" data-message-history-id="${escapeHtml(item.id)}">
      <div class="sprintMessageHistoryIcon" aria-hidden="true">${icon}</div>
      <div class="sprintMessageHistoryBody">
        <div class="sprintMessageHistoryTitleRow">
          <strong>${escapeHtml(title)}</strong>
          <span class="sprintMessageHistoryBadge">WhatsApp</span>
        </div>
        <p class="sprintMessagePreview">${escapeHtml(preview||"Mesaj içeriği bulunamadı.")}</p>
        ${body.length>200?`<details class="sprintMessageFull"><summary>Mesajın tamamını göster</summary><div class="sprintMessageFullText">${escapeHtml(body)}</div></details>`:""}
        <div class="sprintMessageHistoryMeta"><span class="sprintMessageStatus ${state}">${escapeHtml(status)}</span><small>${escapeHtml(formatDate(item.sentAt))}${phone}</small></div>
        ${item.status==="confirmed"?'<small class="sprintMessageDeliveryNote">Kullanıcı onayıdır; WhatsApp teslim / okundu bilgisi değildir.</small>':""}
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
      <span>${item.deliveryConfirmation==="manual_confirmed"?"Gönderim onaylandı":"Bilgilendirme gönderildi"}${phone} • ${escapeHtml(formatDate(item.sentAt))}</span>
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
    .sprintMessageHistoryCard p{white-space:pre-wrap;margin:6px 0 7px!important;color:#475569!important;font-size:12px!important;line-height:1.45!important;display:block;overflow-wrap:anywhere}
    .sprintMessageHistoryCard small{color:#64748b;font-size:10px;font-weight:700}
    .sprintMessageHistoryCard.pending .sprintMessageHistoryIcon{background:#fff7ed;color:#b45309}
    .sprintMessageHistoryCard.error .sprintMessageHistoryIcon{background:#fff1f2;color:#be123c}
    .sprintMessageHistoryMeta{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:10px}
    .sprintMessageStatus{display:inline-flex;padding:5px 8px;border-radius:8px;font-size:10px;font-weight:800;background:#f1f5f9;color:#475569}
    .sprintMessageStatus.success{background:#ecfdf3;color:#166534}
    .sprintMessageStatus.pending{background:#fff7ed;color:#9a3412}
    .sprintMessageStatus.error{background:#fff1f2;color:#be123c}
    .sprintMessageFull{margin:8px 0;border:1px solid #dbe5ef;border-radius:10px;background:#f8fafc}
    .sprintMessageFull summary{cursor:pointer;padding:10px 12px;color:#1761b5;font-size:12px;font-weight:800;min-height:40px;box-sizing:border-box}
    .sprintMessageFullText{white-space:pre-wrap;overflow-wrap:anywhere;padding:12px;border-top:1px solid #dbe5ef;color:#334155;font-size:12px;line-height:1.6}
    .sprintMessageDeliveryNote{display:block;margin-top:7px;font-weight:500!important}
    @media(max-width:600px){.sprintMessageHistoryCard{grid-template-columns:28px minmax(0,1fr);padding:12px!important}.sprintMessageHistoryIcon{width:26px;height:26px}.sprintMessageHistoryMeta{align-items:flex-start;flex-direction:column}}
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
    if (head) {
      const badge = head.querySelector<HTMLElement>(".sprintMessageHistoryCount") || document.createElement("span");
      badge.className = "sprintMessageHistoryCount";
      badge.textContent = `${data.count || 0} iletişim kaydı`;
      head.appendChild(badge);
    }

    const list = messagePanel.querySelector<HTMLElement>(".list");
    if (list) {
      const timeline = data.timeline || [];
      list.classList.add("sprintUnifiedMessageList");
      const expanded=new Set(Array.from(list.querySelectorAll<HTMLDetailsElement>("article details[open]")).map(node=>node.closest("article")?.getAttribute("data-message-history-id")));
      const markup=timeline.length?timeline.map(renderMessage).join(""):'<p class="empty">Henüz WhatsApp mesaj kaydı yok.</p>';
      if(list.dataset.historyMarkup!==markup){
        list.innerHTML=markup;
        list.dataset.historyMarkup=markup;
        list.querySelectorAll<HTMLDetailsElement>("article details").forEach(node=>{
          if(expanded.has(node.closest("article")?.getAttribute("data-message-history-id")))node.open=true;
        });
      }
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
