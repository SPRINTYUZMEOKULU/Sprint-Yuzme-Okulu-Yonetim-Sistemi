"use client";

import { useEffect, useState } from "react";

const labels: Record<string, string> = {
  "/ogrenciler": "Öğrenci Merkezi",
  "/kayit-tamamlama": "Kesin Kayıt",
  "/kesin-kayit-merkezi": "Kesin Kayıt Merkezi",
  "/kayit-yenilemeleri": "Kayıt Yenileme Merkezi",
  "/on-kayitlar": "Ön Kayıt Merkezi",
  "/on-kayit": "Yeni Ön Kayıt",
  "/veliler": "Veli Merkezi",
  "/veli-talepleri": "Veli Talepleri",
  "/subeler": "Şubeler ve Havuzlar",
  "/gruplar": "Gruplar",
  "/ders-programi": "Ders Programı",
  "/operasyon-plani": "Operasyon Planı",
  "/ders-operasyonlari": "Ders İptali / Telafi",
  "/yoklama": "Yoklama",
  "/paketler": "Paketler",
  "/odemeler": "Ödemeler",
  "/kasa": "Günlük Kasa",
  "/hazir-mesajlar": "Mesaj Merkezi",
  "/bildirimler": "Bildirimler",
  "/uyarilar": "Akıllı Uyarılar",
  "/onay-merkezi": "Onay Merkezi",
  "/denetim-merkezi": "Değişiklik ve Denetim Merkezi",
  "/kullanicilar-ve-yetkiler": "Kullanıcılar ve Yetkiler",
  "/raporlar": "Raporlar",
  "/ayarlar": "Ayarlar",
};

function submitText(button: HTMLElement) {
  const raw = (button.textContent || "").replace(/\s+/g, " ").trim().toLocaleLowerCase("tr-TR");
  if (raw.includes("kaydet")) return "Kaydediliyor…";
  if (raw.includes("tamamla") || raw.includes("onayla")) return "İşlem tamamlanıyor…";
  if (raw.includes("ödeme")) return "Ödeme işleniyor…";
  if (raw.includes("gönder")) return "Gönderiliyor…";
  if (raw.includes("sil")) return "Siliniyor…";
  if (raw.includes("aktar")) return "Aktarılıyor…";
  if (raw.includes("yenile")) return "Yenileniyor…";
  if (raw.includes("ara")) return "Aranıyor…";
  return "İşleniyor…";
}

export default function ModuleNavigationFeedback() {
  const [label, setLabel] = useState("");

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;

    const show = (message: string, duration = 1800) => {
      setLabel(message);
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => setLabel(""), duration);
    };

    const press = (element: HTMLElement) => {
      element.classList.add("sprintActionPressed");
      window.setTimeout(() => element.classList.remove("sprintActionPressed"), 260);
    };

    const clickHandler = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;

      const control = target.closest<HTMLElement>("button, a[href], [role='button']");
      if (control && !control.closest(".sidebarBranchToggle")) press(control);

      const anchor = target.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor) return;
      if (
        anchor.target === "_blank" ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) return;

      let url: URL;
      try {
        url = new URL(anchor.href, window.location.href);
      } catch {
        return;
      }

      if (url.origin !== window.location.origin) return;
      const match = Object.entries(labels).find(
        ([path]) => url.pathname === path || url.pathname.startsWith(`${path}/`),
      );
      if (!match) return;

      show(`${match[1]} açılıyor…`);
    };

    const submitHandler = (event: SubmitEvent) => {
      const form = event.target as HTMLFormElement | null;
      if (!form) return;
      const submitter = event.submitter as HTMLElement | null;
      if (submitter) press(submitter);
      show(submitter ? submitText(submitter) : "İşleniyor…", 2200);
    };

    document.addEventListener("click", clickHandler, true);
    document.addEventListener("submit", submitHandler, true);
    return () => {
      document.removeEventListener("click", clickHandler, true);
      document.removeEventListener("submit", submitHandler, true);
      if (timer) clearTimeout(timer);
    };
  }, []);

  return (
    <>
      {label ? (
        <div className="moduleNavFeedback" role="status" aria-live="polite">
          <span className="moduleNavSpinner" aria-hidden="true" />
          <strong>{label}</strong>
        </div>
      ) : null}
      <style>{`
        button,a[href],[role='button']{transition:transform .14s ease,filter .14s ease,box-shadow .14s ease,opacity .14s ease}
        .sprintActionPressed{transform:scale(.97)!important;filter:brightness(.96);opacity:.9}
        .moduleNavFeedback{position:fixed;left:50%;bottom:max(22px,env(safe-area-inset-bottom));transform:translateX(-50%);z-index:1000000;display:flex;align-items:center;gap:10px;max-width:calc(100vw - 32px);padding:12px 16px;border:1px solid rgba(37,99,235,.18);border-radius:16px;background:rgba(255,255,255,.96);box-shadow:0 14px 40px rgba(15,23,42,.18);backdrop-filter:blur(14px);color:#0f2340;font-size:14px;white-space:nowrap}
        .moduleNavSpinner{width:18px;height:18px;border-radius:999px;border:2px solid #dbeafe;border-top-color:#2563eb;animation:moduleNavSpin .7s linear infinite;flex:none}
        @keyframes moduleNavSpin{to{transform:rotate(360deg)}}
        @media(max-width:640px){.moduleNavFeedback{bottom:max(16px,env(safe-area-inset-bottom));font-size:13px;padding:11px 14px;border-radius:14px}.sprintActionPressed{transform:scale(.965)!important}}
        @media(prefers-reduced-motion:reduce){button,a[href],[role='button'],.sprintActionPressed{transition:none}.moduleNavSpinner{animation:none}}
      `}</style>
    </>
  );
}
