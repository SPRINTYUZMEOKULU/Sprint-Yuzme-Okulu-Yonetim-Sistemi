"use client";

import { useEffect } from "react";

function cleanPhone(value: string) {
  let digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("90")) return digits;
  if (digits.startsWith("0")) digits = digits.slice(1);
  return digits.length === 10 ? `90${digits}` : digits;
}

function buildMessage(name: string) {
  return [
    `Merhaba ${name || "Değerli Velimiz"},`,
    "",
    "SPRİNT YÜZME OKULU veli portalı hesabınız hazırdır.",
    "",
    "Portal girişinde şifre kullanmanıza gerek yoktur. Kayıtlı cep telefonu numaranızı girip SMS ile gönderilen 6 haneli doğrulama kodunu kullanarak güvenli şekilde giriş yapabilirsiniz.",
    "",
    `Portal giriş adresi: ${window.location.origin}/login`,
    "",
    "Veli Girişi bölümünü seçin → telefon numaranızı yazın → SMS Doğrulama Kodu Gönder seçeneğine dokunun.",
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
      const active = card.dataset.active === "1";
      const lastSignIn = card.dataset.lastSignIn === "1";
      const status = card.querySelector<HTMLElement>("[data-portal-status]");
      if (status) {
        status.textContent = !active ? "Portal Pasif" : lastSignIn ? "Portal Aktif" : "Telefon Doğrulama Bekliyor";
        if (active && !lastSignIn) status.classList.add("waiting");
      }
      const actions = card.querySelector<HTMLElement>(".guardianCardActions");
      if (!actions) return;
      const identity = card.querySelector<HTMLElement>(".guardianIdentity");
      const name = identity?.querySelector("h2")?.textContent?.trim() || "Değerli Velimiz";
      const text = identity?.querySelector("p")?.textContent || "";
      const phone = cleanPhone(text.split("·")[0] || "");
      if (!phone) return;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "guardianActivationButton";
      button.textContent = lastSignIn ? "Veli Giriş Mesajını WhatsApp’tan Gönder" : "Telefonla Giriş Bilgisini WhatsApp’tan Gönder";
      button.onclick = () => {
        window.open(`https://wa.me/${phone}?text=${encodeURIComponent(buildMessage(name))}`, "_blank", "noopener,noreferrer");
        button.textContent = "✓ WhatsApp Mesajını Tekrar Aç";
      };
      actions.appendChild(button);
    });
  }, []);
  return null;
}
