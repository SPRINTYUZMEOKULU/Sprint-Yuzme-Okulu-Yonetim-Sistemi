"use client";

import { useEffect } from "react";
import { sendGuardianActivation } from "@/app/ogrenciler/[id]/guardian-activation-actions";

function cleanPhone(value: string) {
  let digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("90")) return digits;
  if (digits.startsWith("0")) digits = digits.slice(1);
  return digits.length === 10 ? `90${digits}` : digits;
}

function buildMessage(name: string, email: string) {
  return [
    `Merhaba ${name || "Değerli Velimiz"},`,
    "",
    "SPRİNT YÜZME OKULU veli portalı hesabınız hazırdır.",
    "Öğrencinizin ders programı, yoklama, ödeme durumu ve bilgilendirmelerini portal üzerinden takip edebilirsiniz.",
    "",
    `Güvenli şifre belirleme bağlantısı ${email} adresinize gönderildi.`,
    `Portal giriş adresi: ${window.location.origin}/login`,
    "",
    "E-postadaki bağlantıyı kullanarak kendi şifrenizi belirleyebilirsiniz.",
    "",
    "SPRİNT YÜZME OKULU",
    "Bilgilendirme Hattı: 0551 896 83 19",
  ].join("\n");
}

export default function GuardianCenterEnhancer() {
  useEffect(() => {
    document.querySelectorAll<HTMLElement>("[data-guardian-card]").forEach((card) => {
      if (card.dataset.enhanced === "1") return;
      card.dataset.enhanced = "1";
      const studentId = card.dataset.studentId || "";
      const active = card.dataset.active === "1";
      const lastSignIn = card.dataset.lastSignIn === "1";
      const status = card.querySelector<HTMLElement>("[data-portal-status]");
      if (status) {
        status.textContent = !active ? "Portal Pasif" : lastSignIn ? "Portal Aktif" : "Aktivasyon Bekliyor";
        if (active && !lastSignIn) status.classList.add("waiting");
      }
      if (!studentId) return;
      const actions = card.querySelector<HTMLElement>(".guardianCardActions");
      if (!actions) return;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "guardianActivationButton";
      button.textContent = lastSignIn ? "Aktivasyonu Yeniden Gönder" : "WhatsApp’tan Giriş Bilgisi Gönder";
      button.onclick = async () => {
        button.disabled = true;
        const old = button.textContent;
        button.textContent = "Hazırlanıyor…";
        const result = await sendGuardianActivation(studentId);
        if (!result.ok) {
          window.alert(result.message || "Aktivasyon hazırlanamadı.");
          button.disabled = false;
          button.textContent = old;
          return;
        }
        const phone = cleanPhone(result.guardian.phone);
        if (!phone) window.alert("Aktivasyon e-postası gönderildi; WhatsApp için veli telefonu bulunamadı.");
        else window.open(`https://wa.me/${phone}?text=${encodeURIComponent(buildMessage(result.guardian.fullName, result.guardian.email))}`, "_blank", "noopener,noreferrer");
        button.disabled = false;
        button.textContent = "Aktivasyonu Yeniden Gönder";
      };
      actions.appendChild(button);
    });
  }, []);
  return null;
}
