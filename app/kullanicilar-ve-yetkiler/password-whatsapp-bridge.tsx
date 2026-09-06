"use client";

import { useEffect } from "react";

type ProfileLite = {
  id: string;
  full_name: string | null;
  phone: string | null;
};

type PendingSend = {
  password: string;
  fullName: string;
  phone: string;
  popup: Window | null;
  startedAt: number;
};

function cleanPhone(value?: string | null) {
  let digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("90")) return digits;
  if (digits.startsWith("0")) digits = digits.slice(1);
  if (digits.length === 10) return `90${digits}`;
  return digits;
}

function normalizeText(value?: string | null) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function buildMessage(options: {
  fullName: string;
  password: string;
  origin: string;
}) {
  const name = options.fullName || "Değerli Kullanıcımız";

  return [
    `Merhaba ${name},`,
    "",
    "SPRİNT YÜZME OKULU · SprintOS hesabınız için geçici giriş şifreniz oluşturulmuştur.",
    "",
    `Geçici Şifre: ${options.password}`,
    `Giriş Adresi: ${options.origin}/login`,
    "",
    "Güvenliğiniz için ilk girişinizde şifrenizi değiştirmenizi rica ederiz. Bu şifreyi kimseyle paylaşmayınız.",
    "",
    "SPRİNT YÜZME OKULU",
    "Bilgilendirme Hattı: 0551 896 83 19",
  ].join("\n");
}

export default function PasswordWhatsAppBridge({
  profiles,
}: {
  profiles: ProfileLite[];
}) {
  useEffect(() => {
    let pending: PendingSend | null = null;
    let timer: number | null = null;

    const clearPending = (closePopup = false) => {
      if (timer) window.clearTimeout(timer);
      timer = null;
      if (closePopup && pending?.popup && !pending.popup.closed) {
        pending.popup.close();
      }
      pending = null;
    };

    const findSelectedProfile = () => {
      const header = document.querySelector(".personnelHeader");
      const heading = header?.querySelector("h2");
      const selectedName = normalizeText(heading?.textContent);
      if (!selectedName) return null;

      const headerText = normalizeText(header?.textContent);
      const sameName = profiles.filter(
        (profile) => normalizeText(profile.full_name) === selectedName
      );

      if (sameName.length === 1) return sameName[0];

      return (
        sameName.find((profile) => {
          const digits = String(profile.phone || "").replace(/\D/g, "");
          const last10 = digits.slice(-10);
          const headerDigits = headerText.replace(/\D/g, "");
          return Boolean(last10 && headerDigits.includes(last10));
        }) || sameName[0] || null
      );
    };

    const onClick = (event: MouseEvent) => {
      const button = (event.target as Element | null)?.closest("button");
      if (!button) return;
      if (normalizeText(button.textContent) !== "Şifreyi Değiştir") return;

      const panel = button.closest("[data-password-panel]");
      const input = panel?.querySelector<HTMLInputElement>(
        'input[autocomplete="new-password"], input[type="password"]'
      );
      const password = input?.value || "";
      if (password.length < 8) return;

      const profile = findSelectedProfile();
      const phone = cleanPhone(profile?.phone);
      if (!profile || !phone) return;

      clearPending(true);

      // Mobil tarayıcıların gecikmeli window.open çağrılarını engellememesi için
      // sekmeyi doğrudan kullanıcı tıklaması sırasında açıyoruz; şifre işlemi
      // başarıyla tamamlanınca bu sekmeyi WhatsApp taslağına yönlendiriyoruz.
      const popup = window.open("about:blank", "_blank");
      if (popup) {
        try {
          popup.document.title = "WhatsApp hazırlanıyor…";
          popup.document.body.innerHTML =
            '<div style="font-family:system-ui;padding:24px;color:#0f172a">Şifre kaydediliyor, WhatsApp mesajı hazırlanıyor…</div>';
        } catch {}
      }

      pending = {
        password,
        fullName: normalizeText(profile.full_name),
        phone,
        popup,
        startedAt: Date.now(),
      };

      timer = window.setTimeout(() => clearPending(true), 15000);
    };

    const observer = new MutationObserver(() => {
      if (!pending) return;
      if (Date.now() - pending.startedAt > 15000) {
        clearPending(true);
        return;
      }

      const pageText = document.body.innerText;
      const success =
        pageText.includes("✓ Yeni şifre başarıyla tanımlandı.") ||
        pageText.includes("Yeni şifre başarıyla tanımlandı.");
      const failed =
        pageText.includes("⚠ Şifre") ||
        pageText.includes("Şifre değiştirilemedi") ||
        pageText.includes("Şifre en az 8 karakter olmalıdır");

      if (failed && !success) {
        clearPending(true);
        return;
      }

      if (!success) return;

      const message = buildMessage({
        fullName: pending.fullName,
        password: pending.password,
        origin: window.location.origin,
      });
      const url = `https://wa.me/${pending.phone}?text=${encodeURIComponent(message)}`;

      if (pending.popup && !pending.popup.closed) {
        pending.popup.location.href = url;
      } else {
        window.location.href = url;
      }

      clearPending(false);
    });

    document.addEventListener("click", onClick, true);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    return () => {
      document.removeEventListener("click", onClick, true);
      observer.disconnect();
      clearPending(true);
    };
  }, [profiles]);

  return null;
}
