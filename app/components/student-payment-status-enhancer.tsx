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

export default function StudentPaymentStatusEnhancer() {
  useEffect(() => {
    const match = window.location.pathname.match(/^\/ogrenciler\/([^/]+)$/);
    const studentId = match?.[1] || "";
    if (!studentId) return;

    let disposed = false;

    async function syncPaymentStatus() {
      try {
        const response = await fetch(
          `/api/student-payment-center?studentId=${encodeURIComponent(studentId)}`,
          { cache: "no-store" },
        );
        if (!response.ok) return;
        const data = await response.json();
        if (disposed || !data?.ok) return;

        const panel = document.querySelector<HTMLElement>("#odeme[data-file-panel='finance']");
        if (!panel) return;

        const enrollment = data.enrollment;
        const payments = Array.isArray(data.payments) ? data.payments : [];
        const total = Number(enrollment?.totalAmount || 0);
        const received = Number(enrollment?.totalReceived || 0);
        const remaining = Number(enrollment?.remainingPayment || 0);
        const paid = enrollment && remaining <= 0;
        const due = enrollment?.paymentDueDate ? dateText(enrollment.paymentDueDate) : "—";
        const dueTime = enrollment?.paymentDueDate
          ? new Date(`${String(enrollment.paymentDueDate).slice(0, 10)}T23:59:59+03:00`).getTime()
          : Number.NaN;
        const overdue = remaining > 0 && Number.isFinite(dueTime) && dueTime < Date.now();

        const headTotal = panel.querySelector<HTMLElement>(".panelHead > strong");
        if (headTotal) headTotal.textContent = `Toplam Tahsilat: ${money(received)}`;

        panel.querySelectorAll<HTMLElement>(".empty").forEach((node) => node.remove());

        let live = panel.querySelector<HTMLElement>("[data-payment-status-live='1']");
        if (!live) {
          live = document.createElement("div");
          live.dataset.paymentStatusLive = "1";
          panel.appendChild(live);
        }

        if (!enrollment) {
          live.innerHTML = `
            <div class="spsEmpty">
              <strong>Aktif paket kaydı bulunamadı.</strong>
              <span>Ödeme ve vade bilgisi için aktif kayıt gereklidir.</span>
            </div>
          `;
          return;
        }

        const latest = payments[0] || null;
        const statusText = paid ? "ÖDENDİ" : overdue ? "VADESİ GEÇTİ" : "ÖDEME BEKLİYOR";
        const statusClass = paid ? "paid" : overdue ? "overdue" : "waiting";

        live.innerHTML = `
          <div class="spsGrid">
            <article><span>Paket Ücreti</span><strong>${escapeHtml(money(total))}</strong><small>${escapeHtml(enrollment.packageName || "Aktif paket")}</small></article>
            <article><span>Ödenen</span><strong>${escapeHtml(money(received))}</strong><small>Aktif kayıt dönemi</small></article>
            <article><span>Kalan</span><strong>${escapeHtml(money(remaining))}</strong><small>Açık paket borcu</small></article>
            <article class="${statusClass}"><span>Durum</span><strong>${statusText}</strong><small>Vade: ${escapeHtml(due)}</small></article>
          </div>
          <div class="spsStatus ${statusClass}">
            <div>
              <b>${statusText}</b>
              <span>${remaining > 0 ? `${escapeHtml(money(remaining))} tahsilat bekliyor.` : "Aktif paket borcu kapandı."}</span>
              ${latest ? `<small>Son ödeme: ${escapeHtml(money(latest.amount))} · ${escapeHtml(dateText(latest.receivedAt || latest.received_at))}</small>` : `<small>Henüz tahsilat kaydı bulunmuyor.</small>`}
            </div>
            <button type="button" data-payment-history-open>Ödeme Geçmişini Aç</button>
          </div>
        `;

        live.querySelector<HTMLButtonElement>("[data-payment-history-open]")?.addEventListener("click", () => {
          window.location.href = `/ogrenciler/${encodeURIComponent(studentId)}?payment=history#odeme`;
        });

        if (!document.getElementById("student-payment-status-live-style")) {
          const style = document.createElement("style");
          style.id = "student-payment-status-live-style";
          style.textContent = `
            [data-payment-status-live='1']{margin-top:18px}
            .spsGrid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}
            .spsGrid article{border:1px solid #d9e5ef;border-radius:16px;padding:14px;background:#f9fbfd;display:flex;flex-direction:column;gap:5px}
            .spsGrid article span{font-size:10px;font-weight:900;letter-spacing:.07em;text-transform:uppercase;color:#70849a}
            .spsGrid article strong{font-size:18px;color:#0d3158}
            .spsGrid article small{font-size:10px;color:#71859a;line-height:1.3}
            .spsGrid article.waiting,.spsStatus.waiting{background:#fff9ed;border-color:#efd18d}
            .spsGrid article.overdue,.spsStatus.overdue{background:#fff1f1;border-color:#eaa0a5}
            .spsGrid article.paid,.spsStatus.paid{background:#eef9f2;border-color:#a7d9b8}
            .spsGrid article.waiting strong,.spsStatus.waiting b{color:#8b5b00}
            .spsGrid article.overdue strong,.spsStatus.overdue b{color:#b52d38}
            .spsGrid article.paid strong,.spsStatus.paid b{color:#14743b}
            .spsStatus{margin-top:12px;border:1px solid #d9e5ef;border-radius:16px;padding:14px 15px;display:flex;align-items:center;justify-content:space-between;gap:14px}
            .spsStatus>div{display:flex;flex-direction:column;gap:4px}.spsStatus b{font-size:13px}.spsStatus span{font-size:12px;color:#314e69}.spsStatus small{font-size:10px;color:#72869a}
            .spsStatus button{border:1px solid #b8d2e7;background:#fff;color:#0a5da8;font:inherit;font-size:11px;font-weight:900;padding:10px 12px;border-radius:11px;cursor:pointer;white-space:nowrap}
            .spsEmpty{padding:16px;border:1px dashed #c8d8e6;border-radius:14px;background:#f8fbfd;display:flex;flex-direction:column;gap:4px;color:#36536e}.spsEmpty strong{font-size:13px}.spsEmpty span{font-size:11px}
            @media(max-width:760px){.spsGrid{grid-template-columns:repeat(2,minmax(0,1fr))}.spsStatus{align-items:stretch;flex-direction:column}.spsStatus button{width:100%}}
          `;
          document.head.appendChild(style);
        }
      } catch {
        // Canlı finans özeti ana kursiyer dosyasını engellemez.
      }
    }

    void syncPaymentStatus();
    const timer = window.setInterval(syncPaymentStatus, 15000);
    const onFocus = () => void syncPaymentStatus();
    window.addEventListener("focus", onFocus);

    return () => {
      disposed = true;
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  return null;
}
