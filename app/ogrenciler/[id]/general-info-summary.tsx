"use client";

import { useEffect } from "react";

function valueOf(form: HTMLFormElement, name: string) {
  const field = form.elements.namedItem(name) as HTMLInputElement | HTMLTextAreaElement | null;
  return field?.value?.trim() || "—";
}

export default function GeneralInfoSummary() {
  useEffect(() => {
    const panel = document.querySelector<HTMLElement>("#duzenle.panel");
    const form = panel?.querySelector<HTMLFormElement>("form.formGrid");
    if (panel && form && panel.dataset.professionalSummary !== "1") {
      const rows = [
        ["Telefon", valueOf(form, "phone")], ["E-posta", valueOf(form, "email")],
        ["Veli Adı Soyadı", valueOf(form, "guardian_name")], ["Veli Telefonu", valueOf(form, "guardian_phone")],
        ["Veli E-postası", valueOf(form, "guardian_email")], ["Acil Durum Kişisi", valueOf(form, "emergency_contact_name")],
        ["Acil Durum Telefonu", valueOf(form, "emergency_contact_phone")],
      ];
      const summary = document.createElement("div");
      summary.className = "professionalGeneralSummary";
      summary.innerHTML = `<div class="professionalSummaryHead"><div><span>KURSİYER PROFİLİ</span><strong>İletişim ve veli özeti</strong><small>Bilgileri değiştirmek için “Bilgileri Düzenle” işlemini kullanın.</small></div><button type="button" data-open-profile-center>✎ Bilgileri Düzenle</button></div><div class="professionalSummaryGrid">${rows.map(([label,value])=>`<div><span>${label}</span><strong>${value}</strong></div>`).join("")}</div><div class="professionalSummaryNote"><span>Genel Yönetim Notu</span><p>${valueOf(form,"general_note")}</p></div>`;
      form.hidden = true;
      form.setAttribute("aria-hidden", "true");
      panel.appendChild(summary);
      panel.dataset.professionalSummary = "1";
      summary.querySelector<HTMLButtonElement>("[data-open-profile-center]")?.addEventListener("click", () => {
        Array.from(document.querySelectorAll<HTMLButtonElement>(".fileCommandActions button")).find((item) =>
          (item.textContent || "").includes("Bilgileri Düzenle"),
        )?.click();
      });
    }

    const openProfileForMissingPhone = (event: MouseEvent) => {
      const link = (event.target as Element | null)?.closest<HTMLAnchorElement>(".smartAlertGrid a[href='#genel-bilgiler']");
      if (!link || !(link.querySelector("b")?.textContent || "").includes("Telefon bilgisi eksik")) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      Array.from(document.querySelectorAll<HTMLButtonElement>(".fileCommandActions button")).find((item) =>
        (item.textContent || "").includes("Bilgileri Düzenle"),
      )?.click();
    };

    document.addEventListener("click", openProfileForMissingPhone, true);
    return () => document.removeEventListener("click", openProfileForMissingPhone, true);
  }, []);

  return null;
}
