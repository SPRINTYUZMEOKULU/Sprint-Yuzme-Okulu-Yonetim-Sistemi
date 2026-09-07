"use client";

import { useEffect } from "react";
import { getGuardianPhoneContact } from "./guardian-phone-actions";

function cleanPhone(value?: string | null) {
  let digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("90")) return digits;
  if (digits.startsWith("0")) digits = digits.slice(1);
  return digits.length === 10 ? `90${digits}` : digits;
}

function buildMessage(name: string, origin: string) {
  return [
    `Merhaba ${name || "Değerli Velimiz"},`,
    "",
    "SPRİNT YÜZME OKULU veli portalı hesabınız hazırdır.",
    "",
    "Portal girişinde şifre kullanmanıza gerek yoktur. Kayıtlı cep telefonu numaranızı girip SMS ile gönderilen 6 haneli doğrulama kodunu kullanarak güvenli şekilde giriş yapabilirsiniz.",
    "",
    `Portal giriş adresi: ${origin}/login`,
    "",
    "Veli Girişi bölümünü seçin → telefon numaranızı yazın → SMS Doğrulama Kodu Gönder seçeneğine dokunun.",
    "",
    "SPRİNT YÜZME OKULU",
    "Bilgilendirme Hattı: 0551 896 83 19",
  ].join("\n");
}

export default function GuardianActivationWhatsAppBridge({ studentId }: { studentId: string }) {
  useEffect(() => {
    const render = () => {
      const connected = document.querySelector<HTMLElement>(".profileCenterPanel .portalConnected");
      if (!connected || connected.querySelector("[data-guardian-activation]")) return;

      const box = document.createElement("div");
      box.dataset.guardianActivation = "1";
      box.style.cssText = "display:grid;gap:9px;padding:14px;border:1px solid #bbf7d0;border-radius:13px;background:#f0fdf4";

      const title = document.createElement("strong");
      title.textContent = "Telefonla güvenli veli girişi";
      title.style.cssText = "color:#166534;font-size:13px";

      const note = document.createElement("small");
      note.textContent = "Veli şifre kullanmaz. Kayıtlı telefonuna gelen tek kullanımlık SMS koduyla giriş yapar. WhatsApp üzerinden giriş bilgisini gönderebilirsiniz.";
      note.style.cssText = "color:#4b6b58;line-height:1.45";

      const button = document.createElement("button");
      button.type = "button";
      button.textContent = "📲 Telefonla Giriş Bilgisini WhatsApp’tan Gönder";
      button.style.cssText = "min-height:48px;border:0;border-radius:11px;background:#16a34a;color:white;font-weight:900;font-size:14px;cursor:pointer;padding:10px 14px";
      button.onclick = async () => {
        if (button.disabled) return;
        button.disabled = true;
        button.textContent = "Bilgiler hazırlanıyor…";
        const result = await getGuardianPhoneContact(studentId);
        if (!result.ok) {
          window.alert(result.message || "Veli giriş bilgileri hazırlanamadı.");
          button.disabled = false;
          button.textContent = "📲 Telefonla Giriş Bilgisini WhatsApp’tan Gönder";
          return;
        }
        const phone = cleanPhone(result.guardian.phone);
        if (!phone) {
          window.alert("Telefonla giriş için veli telefon numarası eklenmelidir.");
          button.disabled = false;
          button.textContent = "📲 Telefonla Giriş Bilgisini WhatsApp’tan Gönder";
          return;
        }
        const message = buildMessage(result.guardian.fullName, window.location.origin);
        window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
        button.disabled = false;
        button.textContent = "✓ WhatsApp Mesajını Tekrar Aç";
      };

      box.append(title, note, button);
      connected.appendChild(box);
    };

    const observer = new MutationObserver(render);
    observer.observe(document.body, { childList: true, subtree: true });
    render();
    return () => {
      observer.disconnect();
      document.querySelector("[data-guardian-activation]")?.remove();
    };
  }, [studentId]);

  return null;
}
