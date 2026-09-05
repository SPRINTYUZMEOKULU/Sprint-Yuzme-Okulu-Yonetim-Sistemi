"use client";

import { useEffect, useState } from "react";

const labels: Record<string, string> = {
  "/ogrenciler": "Öğrenci Merkezi",
  "/veliler": "Veli Merkezi",
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
  "/kullanicilar-ve-yetkiler": "Kullanıcılar ve Yetkiler",
  "/raporlar": "Raporlar",
  "/ayarlar": "Ayarlar",
};

export default function ModuleNavigationFeedback() {
  const [label, setLabel] = useState("");

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;

    const handler = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const anchor = target?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor) return;
      if (anchor.target === "_blank" || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      let url: URL;
      try {
        url = new URL(anchor.href, window.location.href);
      } catch {
        return;
      }

      if (url.origin !== window.location.origin) return;
      const match = Object.entries(labels).find(([path]) => url.pathname === path || url.pathname.startsWith(`${path}/`));
      if (!match) return;

      setLabel(`${match[1]} açılıyor…`);
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => setLabel(""), 1800);
    };

    document.addEventListener("click", handler, true);
    return () => {
      document.removeEventListener("click", handler, true);
      if (timer) clearTimeout(timer);
    };
  }, []);

  if (!label) return null;

  return (
    <div className="moduleNavFeedback" role="status" aria-live="polite">
      <span className="moduleNavSpinner" aria-hidden="true" />
      <strong>{label}</strong>
      <style>{`
        .moduleNavFeedback{position:fixed;left:50%;bottom:max(22px,env(safe-area-inset-bottom));transform:translateX(-50%);z-index:1000000;display:flex;align-items:center;gap:10px;max-width:calc(100vw - 32px);padding:12px 16px;border:1px solid rgba(37,99,235,.18);border-radius:16px;background:rgba(255,255,255,.96);box-shadow:0 14px 40px rgba(15,23,42,.18);backdrop-filter:blur(14px);color:#0f2340;font-size:14px;white-space:nowrap}
        .moduleNavSpinner{width:18px;height:18px;border-radius:999px;border:2px solid #dbeafe;border-top-color:#2563eb;animation:moduleNavSpin .7s linear infinite;flex:none}
        @keyframes moduleNavSpin{to{transform:rotate(360deg)}}
        @media(max-width:640px){.moduleNavFeedback{bottom:max(16px,env(safe-area-inset-bottom));font-size:13px;padding:11px 14px;border-radius:14px}}
      `}</style>
    </div>
  );
}
