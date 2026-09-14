"use client";

import { useEffect } from "react";

function valueOf(form: HTMLFormElement, name: string) {
  const field = form.elements.namedItem(name) as HTMLInputElement | HTMLTextAreaElement | null;
  return field?.value?.trim() || "—";
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

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

function getCourseType() {
  const rows = Array.from(
    document.querySelectorAll<HTMLElement>("#kurs-kaydi .infoRows > div"),
  );
  const courseRow = rows.find((row) =>
    (row.querySelector("span")?.textContent || "")
      .toLocaleLowerCase("tr-TR")
      .includes("kurs türü"),
  );
  return courseRow?.querySelector("strong")?.textContent?.trim() || "";
}

function isAdultCourse() {
  const courseType = getCourseType().toLocaleLowerCase("tr-TR");
  return courseType.includes("yetişkin") || courseType.includes("adult");
}

function adaptAdultLabels(adult: boolean) {
  if (!adult) return;

  const generalPanel = document.querySelector<HTMLElement>("#duzenle.panel");
  generalPanel?.querySelectorAll<HTMLLabelElement>("form.formGrid label").forEach((label) => {
    const textNode = Array.from(label.childNodes).find((node) => node.nodeType === Node.TEXT_NODE);
    const raw = textNode?.textContent?.trim() || "";
    if (raw === "Veli Adı Soyadı" && textNode) textNode.textContent = "Yakını Adı Soyadı ";
    if (raw === "Veli Telefonu" && textNode) textNode.textContent = "Yakını Telefonu ";
    if (raw === "Veli E-postası" && textNode) textNode.textContent = "Yakını E-postası ";
  });

  const profilePanel = document.querySelector<HTMLElement>(".profileCenterPanel");
  if (!profilePanel) return;

  const title = profilePanel.querySelector<HTMLElement>("header h2");
  const intro = profilePanel.querySelector<HTMLElement>("header p");
  if (title) title.textContent = "Kursiyer Bilgi Merkezi";
  if (intro) {
    intro.textContent =
      "Kursiyer, yakını, acil durum ve portal erişimini tek merkezden yönetin.";
  }

  profilePanel.querySelectorAll<HTMLElement>(".sectionTitle strong").forEach((item) => {
    if (item.textContent?.trim() === "Veli Bilgileri") item.textContent = "Yakın Bilgileri";
  });

  profilePanel.querySelectorAll<HTMLElement>("label > span").forEach((item) => {
    const text = item.textContent?.trim();
    if (text === "Veli Adı Soyadı") item.textContent = "Yakını Adı Soyadı";
    if (text === "Veli Telefonu") item.textContent = "Yakını Telefonu";
    if (text === "Veli E-postası") item.textContent = "Yakını E-postası";
  });
}

function openFinanceCenter(action: "collect" | "history" | "due" = "collect") {
  const labels =
    action === "history"
      ? ["Ödeme Geçmişi"]
      : action === "due"
        ? ["Vade", "Ödeme Al"]
        : ["Ödeme Al"];
  const quickAction = Array.from(
    document.querySelectorAll<HTMLElement>(
      ".fileCommandActions button, .fileCommandActions a",
    ),
  ).find((item) =>
    labels.some((label) => (item.textContent || "").includes(label)),
  );

  if (quickAction) {
    quickAction.click();
    return;
  }

  const url = new URL(window.location.href);
  url.searchParams.set("payment", action);
  url.hash = "";
  window.location.assign(url.toString());
}

function bindFinanceActions(target: HTMLElement) {
  target
    .querySelectorAll<HTMLButtonElement>("[data-finance-action]")
    .forEach((button) => {
      button.addEventListener("click", () => {
        openFinanceCenter(
          (button.dataset.financeAction || "collect") as
            | "collect"
            | "history"
            | "due",
        );
      });
    });
}

function syncAlertCount() {
  const head = document.querySelector<HTMLElement>(".smartAlertHead > strong");
  if (!head) return;
  const count = document.querySelectorAll(".smartAlertGrid > a").length;
  head.textContent = count ? `${count} işlem bekliyor` : "✓ Her şey yolunda";
}

function normalizePaymentAlert({
  remaining,
  overdue,
  statusMessage,
}: {
  remaining: number;
  overdue: boolean;
  statusMessage: string;
}) {
  const grid = document.querySelector<HTMLElement>(".smartAlertGrid");
  if (!grid) return;

  const paymentAlerts = Array.from(grid.querySelectorAll<HTMLAnchorElement>("a")).filter(
    (item) => {
      const text = (item.textContent || "").toLocaleLowerCase("tr-TR");
      return item.getAttribute("href") === "#odeme" || text.includes("ödeme");
    },
  );

  if (remaining <= 0) {
    paymentAlerts.forEach((item) => item.remove());
    syncAlertCount();
    return;
  }

  const primary = paymentAlerts[0];
  if (!primary) return;

  primary.classList.remove("danger", "warning", "financeCriticalAlert");
  primary.classList.add(overdue ? "danger" : "warning");
  if (overdue) primary.classList.add("financeCriticalAlert");

  const icon = primary.querySelector("i");
  const title = primary.querySelector("b");
  const description = primary.querySelector("small");
  if (icon) icon.textContent = overdue ? "!" : "•";
  if (title) title.textContent = overdue ? "Ödeme vadesi geçti" : "Ödeme bekliyor";
  if (description) description.textContent = statusMessage;

  paymentAlerts.slice(1).forEach((item) => item.remove());
  syncAlertCount();
}

export default function GeneralInfoSummary() {
  useEffect(() => {
    const panel = document.querySelector<HTMLElement>("#duzenle.panel");
    const form = panel?.querySelector<HTMLFormElement>("form.formGrid");
    const adultCourse = isAdultCourse();

    adaptAdultLabels(adultCourse);
    const adultLabelTimer = window.setTimeout(() => adaptAdultLabels(adultCourse), 300);

    if (panel && form && panel.dataset.professionalSummary !== "1") {
      const rows = [
        ["Telefon", valueOf(form, "phone")],
        ["E-posta", valueOf(form, "email")],
        [adultCourse ? "Yakını Adı Soyadı" : "Veli Adı Soyadı", valueOf(form, "guardian_name")],
        [adultCourse ? "Yakını Telefonu" : "Veli Telefonu", valueOf(form, "guardian_phone")],
        [adultCourse ? "Yakını E-postası" : "Veli E-postası", valueOf(form, "guardian_email")],
        ["Acil Durum Kişisi", valueOf(form, "emergency_contact_name")],
        ["Acil Durum Telefonu", valueOf(form, "emergency_contact_phone")],
      ];

      const summary = document.createElement("div");
      summary.className = "professionalGeneralSummary";
      summary.innerHTML = `<div class="professionalSummaryHead"><div><span>KURSİYER PROFİLİ</span><strong>${adultCourse ? "İletişim ve yakın özeti" : "İletişim ve veli özeti"}</strong><small>Bilgileri değiştirmek için “Bilgileri Düzenle” işlemini kullanın.</small></div><button type="button" data-open-profile-center="1">✎ Bilgileri Düzenle</button></div><div class="professionalSummaryGrid">${rows.map(([label, value]) => `<div><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`).join("")}</div><div class="professionalSummaryNote"><span>Genel Yönetim Notu</span><p>${escapeHtml(valueOf(form, "general_note"))}</p></div>`;
      form.hidden = true;
      form.setAttribute("aria-hidden", "true");
      panel.appendChild(summary);
      panel.dataset.professionalSummary = "1";
      summary
        .querySelector<HTMLButtonElement>("[data-open-profile-center='1']")
        ?.addEventListener("click", () => {
          window.setTimeout(() => adaptAdultLabels(adultCourse), 50);
        });
    }

    if (!document.getElementById("student-finance-status-style")) {
      const style = document.createElement("style");
      style.id = "student-finance-status-style";
      style.textContent = `
        .studentFinanceStatusCard{border:1px solid #d9e5f3;border-radius:20px;padding:18px;background:#f8fbff;display:grid;gap:13px}
        .studentFinanceStatusHead{display:flex;align-items:flex-start;justify-content:space-between;gap:14px}.studentFinanceStatusHead span{display:block;color:#6c7f98;font-size:12px;font-weight:900;letter-spacing:1.4px}.studentFinanceStatusHead strong{display:block;color:#132f52;font-size:20px;margin-top:5px}
        .studentFinanceStatusBadge{border-radius:999px;padding:8px 11px;font-size:12px;font-weight:900;white-space:nowrap}.studentFinanceStatusMeta{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}.studentFinanceStatusMeta>div{background:#fff;border:1px solid #e2ebf6;border-radius:14px;padding:12px;min-width:0}.studentFinanceStatusMeta span{display:block;color:#75879d;font-size:11px;font-weight:800;text-transform:uppercase}.studentFinanceStatusMeta b{display:block;color:#183655;margin-top:5px;font-size:14px;overflow-wrap:anywhere}
        .studentFinanceStatusMessage{border-radius:14px;padding:13px 14px;font-weight:800;line-height:1.45}.studentFinanceStatusActions{display:flex;gap:9px;flex-wrap:wrap}.studentFinanceStatusActions button{border:0;border-radius:13px;padding:11px 14px;font-weight:900;cursor:pointer}.studentFinanceStatusActions .primary{background:#176fe8;color:#fff}.studentFinanceStatusActions .secondary{background:#eaf1fa;color:#294b71}
        .studentFinanceStatusCard.paid{border-color:#bce3ca;background:#f1fbf5}.studentFinanceStatusCard.paid .studentFinanceStatusBadge,.studentFinanceStatusCard.paid .studentFinanceStatusMessage{background:#daf3e4;color:#176c42}.studentFinanceStatusCard.unpaid{border-color:#f2d593;background:#fffaf0}.studentFinanceStatusCard.unpaid .studentFinanceStatusBadge,.studentFinanceStatusCard.unpaid .studentFinanceStatusMessage{background:#fff0c8;color:#8a5d00}.studentFinanceStatusCard.overdue{border-color:#ef9c9c;background:#fff4f4}.studentFinanceStatusCard.overdue .studentFinanceStatusBadge,.studentFinanceStatusCard.overdue .studentFinanceStatusMessage{background:#ffe0e0;color:#a82935}
        .studentFinanceLiveTarget{margin-top:18px}.studentFinanceLegacyHidden{display:none!important}.financeCriticalAlert{border-color:#e56565!important;box-shadow:0 0 0 3px rgba(229,101,101,.12)!important}
        @media(max-width:720px){.studentFinanceStatusMeta{grid-template-columns:1fr 1fr}.studentFinanceStatusHead{flex-direction:column}.studentFinanceStatusActions button{flex:1 1 130px}}
      `;
      document.head.appendChild(style);
    }

    const studentId =
      window.location.pathname.match(/\/ogrenciler\/([^/]+)/)?.[1] || "";
    let cancelled = false;

    async function loadFinanceSummary() {
      if (!studentId) return;
      try {
        const response = await fetch(
          `/api/student-payment-center?studentId=${encodeURIComponent(studentId)}`,
          { cache: "no-store" },
        );
        if (!response.ok) return;
        const payload = await response.json();
        if (cancelled || !payload?.ok || !payload?.enrollment) return;

        const enrollment = payload.enrollment;
        const total = Number(enrollment.totalAmount || 0);
        const paid = Number(enrollment.totalReceived || 0);
        const remaining = Math.max(0, Number(enrollment.remainingPayment || 0));
        const due = enrollment.paymentDueDate || null;
        const dueTimestamp = due
          ? new Date(`${String(due).slice(0, 10)}T23:59:59+03:00`).getTime()
          : Number.NaN;
        const overdue =
          remaining > 0 &&
          Number.isFinite(dueTimestamp) &&
          dueTimestamp < Date.now();
        const lessonCount = Number(enrollment.lessonCount || 0);
        const packageName = enrollment.packageName || "Aktif kurs paketi";
        const periodText = `${dateText(enrollment.startDate)} - ${dateText(enrollment.plannedEndDate)}`;
        const packageText =
          lessonCount > 0 ? `${lessonCount} derslik ${packageName}` : packageName;
        const statusClass = remaining <= 0 ? "paid" : overdue ? "overdue" : "unpaid";
        const statusLabel =
          remaining <= 0 ? "ÖDENDİ" : overdue ? "VADESİ GEÇTİ" : "ÖDEME BEKLİYOR";
        const statusMessage =
          remaining <= 0
            ? `${periodText} tarihleri arasındaki ${packageText} ücreti ödendi.`
            : `${periodText} tarihleri arasındaki ${packageText} ücreti ödenmedi. Açık borç ${money(remaining)}${due ? ` · Vade ${dateText(due)}` : ""}.`;

        const cardHtml = `<section class="studentFinanceStatusCard ${statusClass}"><div class="studentFinanceStatusHead"><div><span>AKTİF PAKET</span><strong>${escapeHtml(packageText)}</strong></div><div class="studentFinanceStatusBadge">${escapeHtml(statusLabel)}</div></div><div class="studentFinanceStatusMeta"><div><span>Dönem</span><b>${escapeHtml(periodText)}</b></div><div><span>Paket Ücreti</span><b>${escapeHtml(money(total))}</b></div><div><span>Ödenen</span><b>${escapeHtml(money(paid))}</b></div><div><span>Kalan Borç</span><b>${escapeHtml(money(remaining))}</b></div></div><div class="studentFinanceStatusMessage">${escapeHtml(statusMessage)}</div><div class="studentFinanceStatusActions">${remaining > 0 ? '<button type="button" class="primary" data-finance-action="collect">Ödeme Al</button><button type="button" class="secondary" data-finance-action="due">Vade Belirle</button>' : ""}<button type="button" class="secondary" data-finance-action="history">Ödeme Geçmişi</button></div></section>`;

        const financePanel = document.querySelector<HTMLElement>("#odeme");
        if (financePanel) {
          let liveTarget =
            financePanel.querySelector<HTMLElement>("[data-student-finance-live]");
          if (!liveTarget) {
            liveTarget = document.createElement("div");
            liveTarget.className = "studentFinanceLiveTarget";
            liveTarget.dataset.studentFinanceLive = "1";
            financePanel
              .querySelector(".panelHead")
              ?.insertAdjacentElement("afterend", liveTarget);
          }
          liveTarget.innerHTML = cardHtml;
          bindFinanceActions(liveTarget);

          Array.from(financePanel.children).forEach((child) => {
            if (!(child instanceof HTMLElement)) return;
            if (child === liveTarget || child.classList.contains("panelHead")) return;
            child.classList.add("studentFinanceLegacyHidden");
          });
          const totalLabel =
            financePanel.querySelector<HTMLElement>(".panelHead > strong");
          if (totalLabel) totalLabel.textContent = `Toplam Tahsilat: ${money(paid)}`;
        }

        normalizePaymentAlert({ remaining, overdue, statusMessage });
      } catch {
        // Ana kursiyer dosyası finans servisi geçici hata verse bile kullanılabilir kalır.
      }
    }

    void loadFinanceSummary();

    const openProfileForMissingPhone = (event: MouseEvent) => {
      const link = (event.target as Element | null)?.closest<HTMLAnchorElement>(
        ".smartAlertGrid a[href='#genel-bilgiler']",
      );
      if (
        !link ||
        !(link.querySelector("b")?.textContent || "").includes(
          "Telefon bilgisi eksik",
        )
      )
        return;
      event.preventDefault();
      event.stopImmediatePropagation();
      Array.from(
        document.querySelectorAll<HTMLButtonElement>(".fileCommandActions button"),
      )
        .find((item) =>
          (item.textContent || "").includes("Bilgileri Düzenle"),
        )
        ?.click();
    };

    document.addEventListener("click", openProfileForMissingPhone, true);
    return () => {
      cancelled = true;
      window.clearTimeout(adultLabelTimer);
      document.removeEventListener("click", openProfileForMissingPhone, true);
    };
  }, []);

  return null;
}
