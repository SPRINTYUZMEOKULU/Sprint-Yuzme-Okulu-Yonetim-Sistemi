"use client";

import { useEffect } from "react";

function fieldValue(form: HTMLFormElement, name: string) {
  const field = form.elements.namedItem(name) as HTMLInputElement | HTMLTextAreaElement | null;
  return field?.value?.trim() || "";
}

function displayValue(value: string) {
  return value || "—";
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
  const rows = Array.from(document.querySelectorAll<HTMLElement>("#kurs-kaydi .infoRows > div"));
  const courseRow = rows.find((row) =>
    (row.querySelector("span")?.textContent || "")
      .toLocaleLowerCase("tr-TR")
      .includes("kurs türü"),
  );

  const explicitType = courseRow?.querySelector("strong")?.textContent?.trim() || "";
  if (explicitType) return explicitType;

  return document.querySelector<HTMLElement>("#kurs-kaydi")?.textContent?.trim() || "";
}

function isAdultCourse() {
  const courseType = getCourseType().toLocaleLowerCase("tr-TR");
  return courseType.includes("yetişkin") || courseType.includes("adult");
}

function markAdultCourseCard(adult: boolean) {
  if (!adult) return;
  const card = document.querySelector<HTMLElement>("#kurs-kaydi");
  if (!card) return;
  card.dataset.adultCourse = "1";

  const head = card.querySelector<HTMLElement>(".panelHead");
  const title = head?.querySelector<HTMLElement>("h2");
  if (title) title.textContent = "Yetişkin Kursu · Aktif Kayıt";

  if (head && !head.querySelector(".adultCourseBadge")) {
    const badge = document.createElement("span");
    badge.className = "adultCourseBadge";
    badge.textContent = "YETİŞKİN KURSU";
    head.appendChild(badge);
  }
}

function openFinanceCenter(action: "collect" | "history" | "due" = "collect") {
  const labels =
    action === "history"
      ? ["Ödeme Geçmişi"]
      : action === "due"
        ? ["Vade", "Ödeme Al"]
        : ["Ödeme Al"];

  const quickAction = Array.from(
    document.querySelectorAll<HTMLElement>(".fileCommandActions button, .fileCommandActions a"),
  ).find((item) => labels.some((label) => (item.textContent || "").includes(label)));

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
  target.querySelectorAll<HTMLButtonElement>("[data-finance-action]").forEach((button) => {
    button.addEventListener("click", () => {
      openFinanceCenter(
        (button.dataset.financeAction || "collect") as "collect" | "history" | "due",
      );
    });
  });
}

function syncSmartAlertCount() {
  const headCount = document.querySelector<HTMLElement>(".smartAlertHead > strong");
  const alerts = Array.from(document.querySelectorAll<HTMLElement>(".smartAlertGrid > a"));
  if (!headCount) return;

  headCount.textContent = alerts.length
    ? `${alerts.length} işlem bekliyor`
    : "✓ Her şey yolunda";
  headCount.classList.toggle("smartAlertCountPulse", alerts.length > 0);
}

function ensureSinglePaymentAlert({
  remaining,
  overdue,
  statusMessage,
}: {
  remaining: number;
  overdue: boolean;
  statusMessage: string;
}) {
  const panel = document.querySelector<HTMLElement>(".smartAlertPanel");
  if (!panel) return;

  let grid = panel.querySelector<HTMLElement>(".smartAlertGrid");
  const paymentAlerts = Array.from(
    panel.querySelectorAll<HTMLAnchorElement>(".smartAlertGrid a[href='#odeme']"),
  );

  if (remaining <= 0) {
    paymentAlerts.forEach((item) => item.remove());
    syncSmartAlertCount();
    return;
  }

  if (!grid) {
    grid = document.createElement("div");
    grid.className = "smartAlertGrid";
    panel.querySelector(".smartAlertEmpty")?.remove();
    panel.appendChild(grid);
  }

  let primary = paymentAlerts[0];
  if (!primary) {
    primary = document.createElement("a");
    primary.href = "#odeme";
    primary.dataset.openFileTab = "lessons";
    primary.dataset.targetId = "odeme";
    primary.innerHTML = "<i>•</i><span><b></b><small></small></span><em>İşlemi Aç →</em>";
    grid.prepend(primary);
  }

  primary.classList.remove("danger", "warning", "financeCriticalAlert");
  primary.classList.add(overdue ? "danger" : "warning");
  primary.classList.toggle("financeCriticalAlert", overdue);

  const icon = primary.querySelector("i");
  const title = primary.querySelector("b");
  const description = primary.querySelector("small");
  if (icon) icon.textContent = overdue ? "!" : "•";
  if (title) title.textContent = overdue ? "Ödeme vadesi geçti" : "Ödeme bekliyor";
  if (description) description.textContent = statusMessage;

  paymentAlerts.slice(1).forEach((item) => item.remove());
  syncSmartAlertCount();
}

function adaptProfileCenterForAdultCourse(adult: boolean) {
  if (!adult) return;
  const panel = document.querySelector<HTMLElement>(".profileCenterPanel");
  if (!panel) return;

  const title = panel.querySelector<HTMLElement>("header h2");
  const intro = panel.querySelector<HTMLElement>("header p");
  if (title) title.textContent = "Kursiyer Bilgi Merkezi";
  if (intro) intro.textContent = "Kursiyer, yakını, acil durum ve portal erişimini tek merkezden yönetin.";

  panel.querySelectorAll<HTMLElement>(".sectionTitle strong").forEach((item) => {
    if (item.textContent?.trim() === "Veli Bilgileri") item.textContent = "Yakın Bilgileri";
  });
  panel.querySelectorAll<HTMLElement>(".sectionTitle small").forEach((item) => {
    if ((item.textContent || "").includes("ana veli")) {
      item.textContent = "İsteğe bağlıdır. Yalnızca gerektiğinde yakın iletişim bilgisi ekleyin.";
    }
  });

  panel.querySelectorAll<HTMLElement>("label > span").forEach((item) => {
    const text = item.textContent?.trim();
    if (text === "Veli Adı Soyadı") item.textContent = "Yakını Adı Soyadı (isteğe bağlı)";
    if (text === "Veli Telefonu") item.textContent = "Yakını Telefonu (isteğe bağlı)";
    if (text === "Veli E-postası") item.textContent = "Yakını E-postası (isteğe bağlı)";
    if (text === "Yakınlık") item.textContent = "Yakınlık Derecesi";
  });

  const relativeTitle = Array.from(panel.querySelectorAll<HTMLElement>(".sectionTitle strong"))
    .find((item) => item.textContent?.trim() === "Yakın Bilgileri");
  const section = relativeTitle?.closest<HTMLElement>("section");
  if (section && section.dataset.adultRelativeReady !== "1") {
    section.dataset.adultRelativeReady = "1";
    section.dataset.open = "0";
    const titleRow = section.querySelector<HTMLElement>(".sectionTitle");
    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "adultRelativeToggle";
    toggle.textContent = "Yakın bilgilerini aç";
    toggle.addEventListener("click", () => {
      const nextOpen = section.dataset.open !== "1";
      section.dataset.open = nextOpen ? "1" : "0";
      toggle.textContent = nextOpen ? "Yakın bilgilerini kapat" : "Yakın bilgilerini aç";
    });
    titleRow?.appendChild(toggle);
  }
}

export default function GeneralInfoSummary() {
  useEffect(() => {
    const panel = document.querySelector<HTMLElement>("#duzenle.panel");
    const form = panel?.querySelector<HTMLFormElement>("form.formGrid");
    const adultCourse = isAdultCourse();
    const studentId = window.location.pathname.match(/\/ogrenciler\/([^/]+)/)?.[1] || "";
    let relationship = "";

    if (panel && form && panel.dataset.professionalSummary !== "1") {
      const directRows = [
        ["Telefon", fieldValue(form, "phone")],
        ["E-posta", fieldValue(form, "email")],
        ["Acil Durum Kişisi", fieldValue(form, "emergency_contact_name")],
        ["Acil Durum Telefonu", fieldValue(form, "emergency_contact_phone")],
      ] as Array<[string, string]>;

      const relativeRows = [
        [adultCourse ? "Yakını Adı Soyadı" : "Veli Adı Soyadı", fieldValue(form, "guardian_name")],
        [adultCourse ? "Yakını Telefonu" : "Veli Telefonu", fieldValue(form, "guardian_phone")],
        [adultCourse ? "Yakını E-postası" : "Veli E-postası", fieldValue(form, "guardian_email")],
      ] as Array<[string, string]>;

      const generalNote = fieldValue(form, "general_note");
      const summary = document.createElement("div");
      summary.className = "professionalGeneralSummary";
      summary.dataset.showAll = "0";

      const rowHtml = ([label, value]: [string, string]) =>
        `<div class="${value ? "" : "isEmpty"}"><span>${escapeHtml(label)}</span><strong>${escapeHtml(displayValue(value))}</strong></div>`;

      const renderSummary = () => {
        const showAll = summary.dataset.showAll === "1";
        const visibleDirect = directRows.filter(([label, value]) => showAll || Boolean(value) || label === "Telefon");
        const relativeHasValue = relativeRows.some(([, value]) => Boolean(value)) || Boolean(relationship);

        const relationRow = adultCourse
          ? `<div class="${relationship ? "" : "isEmpty"}"><span>Yakınlık Derecesi</span><strong>${escapeHtml(displayValue(relationship))}</strong></div>`
          : "";

        const relativeContent = `${relativeRows
          .filter(([, value]) => showAll || Boolean(value))
          .map(rowHtml)
          .join("")}${showAll || relationship ? relationRow : ""}`;

        summary.innerHTML = `
          <div class="professionalSummaryHead">
            <div>
              <span>KURSİYER PROFİLİ</span>
              <strong>${adultCourse ? "Yetişkin kursiyer iletişim özeti" : "İletişim ve veli özeti"}</strong>
              <small>Boş ve gereksiz alanlar kapalı tutulur; ihtiyaç olduğunda açabilirsiniz.</small>
            </div>
            <div class="professionalSummaryActions">
              <button type="button" data-toggle-empty-fields>${showAll ? "Gereksiz alanları gizle" : "Tüm alanları göster"}</button>
              <button type="button" data-open-profile-center>✎ Bilgileri Düzenle</button>
            </div>
          </div>
          <div class="professionalSummaryGrid">${visibleDirect.map(rowHtml).join("")}</div>
          ${adultCourse
            ? `<details class="adultRelativeDetails" ${relativeHasValue && !showAll ? "" : ""}>
                <summary><span>YAKIN BİLGİLERİ</span><strong>${relativeHasValue ? "Kayıtlı bilgi var" : "İsteğe bağlı"}</strong></summary>
                <div class="professionalSummaryGrid adultRelativeGrid">${relativeContent || '<div class="professionalSummaryEmpty">Yakın bilgisi girilmemiş.</div>'}</div>
              </details>`
            : `<div class="professionalSummaryGrid relativeGrid">${relativeRows.filter(([, value]) => showAll || Boolean(value)).map(rowHtml).join("")}</div>`}
          ${generalNote
            ? `<div class="professionalSummaryNote hasNote"><span>GENEL NOT</span><p>${escapeHtml(generalNote)}</p></div>`
            : showAll
              ? '<div class="professionalSummaryNote"><span>GENEL NOT</span><p>Henüz genel not eklenmemiş.</p></div>'
              : ""}
        `;

        summary
          .querySelector<HTMLButtonElement>("[data-open-profile-center]")
          ?.addEventListener("click", () => {
            Array.from(document.querySelectorAll<HTMLButtonElement>(".fileCommandActions button"))
              .find((item) => (item.textContent || "").includes("Bilgileri Düzenle"))
              ?.click();
          });

        summary
          .querySelector<HTMLButtonElement>("[data-toggle-empty-fields]")
          ?.addEventListener("click", () => {
            summary.dataset.showAll = showAll ? "0" : "1";
            renderSummary();
          });
      };

      renderSummary();
      form.hidden = true;
      form.setAttribute("aria-hidden", "true");
      panel.appendChild(summary);
      panel.dataset.professionalSummary = "1";

      if (adultCourse && studentId) {
        void fetch(`/api/student-relative-summary?studentId=${encodeURIComponent(studentId)}`, { cache: "no-store" })
          .then((response) => (response.ok ? response.json() : null))
          .then((payload) => {
            if (payload?.ok) {
              relationship = String(payload.relationship || "").trim();
              renderSummary();
            }
          })
          .catch(() => undefined);
      }
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
        .professionalSummaryActions{display:flex;gap:8px;flex-wrap:wrap}.professionalSummaryActions button{border:1px solid #cfe0f2;border-radius:12px;background:#fff;color:#175a97;padding:9px 12px;font-weight:800;cursor:pointer}.professionalSummaryGrid .isEmpty{opacity:.56}.professionalSummaryNote.hasNote{border-color:#b9d7f6;background:#f5faff}.professionalSummaryEmpty{grid-column:1/-1;padding:16px;border:1px dashed #d5e1ef;border-radius:14px;color:#71839a;text-align:center}
        .adultRelativeDetails{margin-top:14px;border:1px solid #dce8f5;border-radius:16px;background:#f8fbff;overflow:hidden}.adultRelativeDetails summary{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 16px;cursor:pointer;list-style:none}.adultRelativeDetails summary::-webkit-details-marker{display:none}.adultRelativeDetails summary span{color:#1769e8;font-size:11px;font-weight:900;letter-spacing:.1em}.adultRelativeDetails summary strong{color:#526981;font-size:12px}.adultRelativeGrid{padding:0 14px 14px}.adultCourseBadge{align-self:flex-start;margin-left:auto;border:1px solid #b9d7f6;border-radius:999px;background:#edf6ff;color:#0d63b8;padding:7px 10px;font-size:10px;font-weight:900;letter-spacing:.08em;white-space:nowrap}
        .profileCenterPanel section[data-adult-relative-ready="1"] .profileGrid{display:none}.profileCenterPanel section[data-adult-relative-ready="1"][data-open="1"] .profileGrid{display:grid}.adultRelativeToggle{margin-left:auto;border:1px solid #cfe0f2;border-radius:10px;background:#f7fbff;color:#175a97;padding:8px 10px;font-size:11px;font-weight:900;cursor:pointer}
        .smartAlertHead>strong.smartAlertCountPulse{animation:smartAlertCountPulse 1.25s ease-in-out infinite;box-shadow:0 0 0 0 rgba(21,112,232,.28)}
        @keyframes smartAlertCountPulse{0%,100%{transform:scale(1);box-shadow:0 0 0 0 rgba(21,112,232,.28)}50%{transform:scale(1.035);box-shadow:0 0 0 9px rgba(21,112,232,0)}}
        @media(prefers-reduced-motion:reduce){.smartAlertHead>strong.smartAlertCountPulse{animation:none}}
        @media(max-width:720px){.studentFinanceStatusMeta{grid-template-columns:1fr 1fr}.studentFinanceStatusHead{flex-direction:column}.studentFinanceStatusActions button{flex:1 1 130px}.professionalSummaryActions{width:100%}.professionalSummaryActions button{flex:1 1 150px}.adultCourseBadge{margin-left:0}.adultRelativeToggle{margin-left:0;width:100%}}
      `;
      document.head.appendChild(style);
    }

    syncSmartAlertCount();
    markAdultCourseCard(adultCourse);
    adaptProfileCenterForAdultCourse(adultCourse);

    const profileObserver = new MutationObserver(() => {
      markAdultCourseCard(adultCourse);
      adaptProfileCenterForAdultCourse(adultCourse);
    });
    profileObserver.observe(document.body, { childList: true, subtree: true });

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
          remaining > 0 && Number.isFinite(dueTimestamp) && dueTimestamp < Date.now();
        const lessonCount = Number(enrollment.lessonCount || 0);
        const packageName = enrollment.packageName || "Aktif kurs paketi";
        const periodText = `${dateText(enrollment.startDate)} - ${dateText(enrollment.plannedEndDate)}`;
        const packageText = lessonCount > 0 ? `${lessonCount} derslik ${packageName}` : packageName;
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
          let liveTarget = financePanel.querySelector<HTMLElement>("[data-student-finance-live]");
          if (!liveTarget) {
            liveTarget = document.createElement("div");
            liveTarget.className = "studentFinanceLiveTarget";
            liveTarget.dataset.studentFinanceLive = "1";
            financePanel.querySelector(".panelHead")?.insertAdjacentElement("afterend", liveTarget);
          }
          liveTarget.innerHTML = cardHtml;
          bindFinanceActions(liveTarget);

          Array.from(financePanel.children).forEach((child) => {
            if (!(child instanceof HTMLElement)) return;
            if (child === liveTarget || child.classList.contains("panelHead")) return;
            child.classList.add("studentFinanceLegacyHidden");
          });

          const totalLabel = financePanel.querySelector<HTMLElement>(".panelHead > strong");
          if (totalLabel) totalLabel.textContent = `Toplam Tahsilat: ${money(paid)}`;
        }

        ensureSinglePaymentAlert({ remaining, overdue, statusMessage });
      } catch {
        // Ana kursiyer dosyası finans servisi geçici hata verse bile kullanılabilir kalır.
      }
    }

    void loadFinanceSummary();

    const openProfileForMissingPhone = (event: MouseEvent) => {
      const link = (event.target as Element | null)?.closest<HTMLAnchorElement>(
        ".smartAlertGrid a[href='#genel-bilgiler']",
      );
      if (!link || !(link.querySelector("b")?.textContent || "").includes("Telefon bilgisi eksik")) {
        return;
      }
      event.preventDefault();
      event.stopImmediatePropagation();
      Array.from(document.querySelectorAll<HTMLButtonElement>(".fileCommandActions button"))
        .find((item) => (item.textContent || "").includes("Bilgileri Düzenle"))
        ?.click();
    };

    document.addEventListener("click", openProfileForMissingPhone, true);
    return () => {
      cancelled = true;
      profileObserver.disconnect();
      document.removeEventListener("click", openProfileForMissingPhone, true);
    };
  }, []);

  return null;
}
