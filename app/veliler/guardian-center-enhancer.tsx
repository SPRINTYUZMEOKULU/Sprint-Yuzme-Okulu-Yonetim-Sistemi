"use client";

import { useEffect } from "react";

function cleanPhone(value: string) {
  let digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("90")) return digits;
  if (digits.startsWith("0")) digits = digits.slice(1);
  return digits.length === 10 ? `90${digits}` : digits;
}

function buildMessage(name: string, phone: string) {
  const displayPhone = phone.startsWith("90") ? `+${phone}` : phone;
  return [
    "*SPRİNT YÜZME OKULU*",
    "",
    `Merhaba ${name || "Değerli Velimiz"},`,
    "",
    "SprintOS Veli / Kursiyer Portalı hesabınız hazırdır.",
    "",
    `📱 Kayıtlı telefon: ${displayPhone}`,
    `🔗 Portal giriş adresi: ${window.location.origin}/login`,
    "",
    "Portal girişinde *Veli / Kursiyer Girişi* bölümünü seçerek kayıtlı telefon/e-posta adresiniz ve size tanımlanan portal şifreniz ile giriş yapabilirsiniz.",
    "",
    "Şifreniz henüz size iletilmediyse veya yeni şifre gerekiyorsa Sprint Yüzme Okulu ile iletişime geçebilirsiniz.",
    "",
    "☎️ *SPRİNT BİLGİLENDİRME HATTI*",
    "+90 (551) 896 83 19",
    "",
    "Bilginize sunar, iyi günler dileriz.",
    "*SPRİNT YÜZME OKULU*",
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
        status.textContent = !active ? "Portal Pasif" : lastSignIn ? "Portal Aktif" : "İlk Giriş Bekleniyor";
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
      button.textContent = lastSignIn ? "Portal Giriş Bilgisini WhatsApp’tan Gönder" : "Portal Giriş Bilgisini WhatsApp’tan Gönder";
      button.onclick = () => {
        window.open(`https://wa.me/${phone}?text=${encodeURIComponent(buildMessage(name, phone))}`, "_blank", "noopener,noreferrer");
        button.textContent = "✓ WhatsApp Mesajını Tekrar Aç";
      };
      actions.appendChild(button);
    });
  }, []);
  return null;
}
