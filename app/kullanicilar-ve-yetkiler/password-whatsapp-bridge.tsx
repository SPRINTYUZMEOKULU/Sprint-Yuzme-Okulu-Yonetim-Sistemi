"use client";

import { useEffect } from "react";

type ProfileLite = {
  id: string;
  full_name: string | null;
  phone: string | null;
};

type SavedPassword = {
  profileId: string;
  password: string;
  fullName: string;
  phone: string;
};

type PendingSave = SavedPassword & {
  startedAt: number;
};

const STORAGE_KEY = "sprintos:last-created-password-whatsapp";

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
    "SPRİNT YÜZME OKULU · SprintOS kullanıcı hesabınız hazırlandı.",
    "",
    "🔐 GİRİŞ BİLGİLERİNİZ",
    `Kullanıcı: ${name}`,
    `Geçici Şifre: ${options.password}`,
    `Giriş Adresi: ${options.origin}/login`,
    "",
    "İlk girişinizde güvenliğiniz için şifrenizi değiştirmeniz istenecektir.",
    "Lütfen giriş bilgilerinizi üçüncü kişilerle paylaşmayınız.",
    "",
    "SPRİNT YÜZME OKULU",
    "Bilgilendirme Hattı: 0551 896 83 19",
  ].join("\n");
}

export default function PasswordWhatsAppBridge({ profiles }: { profiles: ProfileLite[] }) {
  useEffect(() => {
    let pending: PendingSave | null = null;
    let saved: SavedPassword | null = null;
    let timer: number | null = null;

    const findPanel = () => document.querySelector<HTMLElement>("[data-password-panel]");

    const removeExtras = () => {
      document.querySelector("[data-password-whatsapp-actions]")?.remove();
    };

    const findSelectedProfile = () => {
      const header = document.querySelector(".personnelHeader");
      const heading = header?.querySelector("h2");
      const selectedName = normalizeText(heading?.textContent);
      const headerText = normalizeText(header?.textContent);

      if (selectedName) {
        const sameName = profiles.filter((profile) => normalizeText(profile.full_name) === selectedName);
        if (sameName.length === 1) return sameName[0];
        const byPhone = sameName.find((profile) => {
          const digits = String(profile.phone || "").replace(/\D/g, "");
          const last10 = digits.slice(-10);
          return Boolean(last10 && headerText.replace(/\D/g, "").includes(last10));
        });
        if (byPhone) return byPhone;
      }

      const pageDigits = document.body.innerText.replace(/\D/g, "");
      return profiles.find((profile) => {
        const digits = String(profile.phone || "").replace(/\D/g, "").slice(-10);
        return Boolean(digits && pageDigits.includes(digits));
      }) || null;
    };

    const isSavedProfileSelected = () => {
      if (!saved) return false;
      const selected = findSelectedProfile();
      return Boolean(selected && selected.id === saved.profileId);
    };

    const persistSaved = () => {
      if (!saved) return;
      try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
      } catch {}
    };

    const restoreSaved = () => {
      try {
        const raw = sessionStorage.getItem(STORAGE_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw) as SavedPassword;
        if (parsed?.profileId && parsed?.password) saved = parsed;
      } catch {}
    };

    const renderActions = (state: "created" | "sent" | "no-phone") => {
      removeExtras();
      const panel = findPanel();
      if (!panel || !saved || !isSavedProfileSelected()) return;

      const wrap = document.createElement("div");
      wrap.dataset.passwordWhatsappActions = "true";
      wrap.style.cssText = "display:grid;gap:10px;grid-column:1/-1;width:100%;margin-top:10px";

      const status = document.createElement("div");
      status.style.cssText = `padding:13px 14px;border-radius:14px;font-weight:800;font-size:13px;border:1px solid ${state === "no-phone" ? "#fed7aa" : "#bbf7d0"};background:${state === "no-phone" ? "#fff7ed" : "#f0fdf4"};color:${state === "no-phone" ? "#9a3412" : "#166534"}`;
      status.textContent = state === "sent"
        ? "✓ Kullanıcı bilgileri hazır · WhatsApp mesajı açıldı"
        : state === "no-phone"
          ? "✓ Şifre oluşturuldu · Kullanıcının kayıtlı telefonu bulunmuyor"
          : "✓ Şifre oluşturuldu · Kullanıcı bilgileri WhatsApp gönderimine hazır";
      wrap.appendChild(status);

      if (state !== "no-phone") {
        const button = document.createElement("button");
        button.type = "button";
        button.dataset.sendPasswordWhatsapp = "true";
        button.textContent = state === "sent" ? "📲 WhatsApp Mesajını Tekrar Aç" : "📲 Kullanıcı Bilgileri ve Şifreyi WhatsApp’tan Gönder";
        button.style.cssText = "width:100%;min-height:54px;border:0;border-radius:14px;background:#16a34a;color:#fff;font-weight:900;font-size:15px;box-shadow:0 8px 20px rgba(22,163,74,.18);cursor:pointer;padding:12px 14px";
        wrap.appendChild(button);
      }
      panel.appendChild(wrap);
    };

    const clearPending = () => {
      if (timer) window.clearTimeout(timer);
      timer = null;
      pending = null;
    };

    const onClick = (event: MouseEvent) => {
      const button = (event.target as Element | null)?.closest<HTMLButtonElement>("button");
      if (!button) return;

      if (button.dataset.sendPasswordWhatsapp === "true") {
        if (!saved?.phone) return;
        const message = buildMessage({ fullName: saved.fullName, password: saved.password, origin: window.location.origin });
        const url = `https://wa.me/${saved.phone}?text=${encodeURIComponent(message)}`;
        window.open(url, "_blank", "noopener,noreferrer");
        renderActions("sent");
        return;
      }

      if (normalizeText(button.textContent) !== "Şifreyi Değiştir") return;
      const panel = button.closest("[data-password-panel]");
      const input = panel?.querySelector<HTMLInputElement>('input[autocomplete="new-password"], input[type="password"]');
      const password = input?.value || "";
      if (password.length < 8) return;

      const profile = findSelectedProfile();
      if (!profile) return;
      removeExtras();
      saved = null;
      try { sessionStorage.removeItem(STORAGE_KEY); } catch {}
      pending = {
        profileId: profile.id,
        password,
        fullName: normalizeText(profile.full_name),
        phone: cleanPhone(profile.phone),
        startedAt: Date.now(),
      };
      timer = window.setTimeout(clearPending, 15000);
    };

    const observer = new MutationObserver(() => {
      if (pending) {
        if (Date.now() - pending.startedAt > 15000) {
          clearPending();
        } else {
          const pageText = document.body.innerText;
          const success = pageText.includes("Yeni şifre başarıyla tanımlandı.");
          const failed = pageText.includes("Şifre değiştirilemedi") || pageText.includes("Şifre en az 8 karakter olmalıdır");
          if (failed && !success) {
            clearPending();
          } else if (success) {
            saved = {
              profileId: pending.profileId,
              password: pending.password,
              fullName: pending.fullName,
              phone: pending.phone,
            };
            persistSaved();
            clearPending();
            renderActions(saved.phone ? "created" : "no-phone");
            return;
          }
        }
      }

      if (saved && !document.querySelector("[data-password-whatsapp-actions]") && isSavedProfileSelected()) {
        renderActions(saved.phone ? "created" : "no-phone");
      }
    });

    restoreSaved();
    window.setTimeout(() => {
      if (saved && isSavedProfileSelected()) renderActions(saved.phone ? "created" : "no-phone");
    }, 0);

    document.addEventListener("click", onClick, true);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    return () => {
      document.removeEventListener("click", onClick, true);
      observer.disconnect();
      clearPending();
      removeExtras();
    };
  }, [profiles]);

  return null;
}
