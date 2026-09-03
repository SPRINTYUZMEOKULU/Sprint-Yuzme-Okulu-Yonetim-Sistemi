"use client";

import { useEffect } from "react";

function valueOf(form: HTMLFormElement, name: string) {
  const field = form.elements.namedItem(name) as HTMLInputElement | HTMLTextAreaElement | null;
  return field?.value?.trim() || "—";
}

export default function GeneralInfoSummary() {
  useEffect(() => {
    const render = () => {
      const panel = document.querySelector<HTMLElement>("#duzenle.panel");
      const form = panel?.querySelector<HTMLFormElement>("form.formGrid");
      if (!panel || !form || panel.dataset.professionalSummary === "1") return;

      const rows = [
        ["Telefon", valueOf(form, "phone")],
        ["E-posta", valueOf(form, "email")],
        ["Veli Adı Soyadı", valueOf(form, "guardian_name")],
        ["Veli Telefonu", valueOf(form, "guardian_phone")],
        ["Veli E-postası", valueOf(form, "guardian_email")],
        ["Acil Durum Kişisi", valueOf(form, "emergency_contact_name")],
        ["Acil Durum Telefonu", valueOf(form, "emergency_contact_phone")],
      ];
      const note = valueOf(form, "general_note");

      const summary = document.createElement("div");
      summary.className = "professionalGeneralSummary";
      summary.innerHTML = `
        <div class="professionalSummaryHead">
          <div><span>KURSİYER PROFİLİ</span><strong>İletişim ve veli özeti</strong><small>Bilgileri değiştirmek için üstteki “Bilgileri Düzenle” işlemini kullanın.</small></div>
          <button type="button" data-open-profile-center>✎ Bilgileri Düzenle</button>
        </div>
        <div class="professionalSummaryGrid">
          ${rows.map(([label, value]) => `<div><span>${label}</span><strong>${value}</strong></div>`).join("")}
        </div>
        <div class="professionalSummaryNote"><span>Genel Yönetim Notu</span><p>${note}</p></div>
      `;

      form.hidden = true;
      form.setAttribute("aria-hidden", "true");
      panel.appendChild(summary);
      panel.dataset.professionalSummary = "1";

      summary.querySelector<HTMLButtonElement>("[data-open-profile-center]")?.addEventListener("click", () => {
        const action = Array.from(document.querySelectorAll<HTMLButtonElement>(".fileCommandActions button")).find((item) =>
          (item.textContent || "").replace(/\s+/g, " ").includes("Bilgileri Düzenle"),
        );
        action?.click();
      });
    };

    const openProfileForMissingPhone = (event: MouseEvent) => {
      const link = (event.target as Element | null)?.closest<HTMLAnchorElement>(".smartAlertGrid a[href='#genel-bilgiler']");
      if (!link) return;
      const title = link.querySelector("b")?.textContent || "";
      if (!title.includes("Telefon bilgisi eksik")) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      const action = Array.from(document.querySelectorAll<HTMLButtonElement>(".fileCommandActions button")).find((item) =>
        (item.textContent || "").replace(/\s+/g, " ").includes("Bilgileri Düzenle"),
      );
      action?.click();
    };

    render();
    const observer = new MutationObserver(render);
    observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener("click", openProfileForMissingPhone, true);
    return () => {
      observer.disconnect();
      document.removeEventListener("click", openProfileForMissingPhone, true);
    };
  }, []);

  return null;
}
