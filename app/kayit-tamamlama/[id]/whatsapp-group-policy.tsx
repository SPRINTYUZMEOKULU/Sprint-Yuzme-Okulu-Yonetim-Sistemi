"use client";

import { useEffect } from "react";

const GROUP_URL = "https://chat.whatsapp.com/EP5uzxNSRU51QWeHPAAAnQ?mode=gi_t";
const POLICY_MARKER = "SPRİNT WHATSAPP BİLGİLENDİRME GRUBU";
const GROUP_NOTICE = `\n\n*SPRİNT WHATSAPP BİLGİLENDİRME GRUBU*\nTüm kursiyerlerimizin Sprint Yüzme Okulu resmi WhatsApp bilgilendirme grubuna katılarak duyuruları düzenli takip etmesi önemlidir. Program değişiklikleri, havuz kapanışları, resmi tatiller, telafi dersleri ve diğer operasyonel duyurular bu kanal üzerinden paylaşılabilir.\n\n*Gruba Katıl:* ${GROUP_URL}\n\nGruba katılım sağlanmaması, gruptan ayrılınması veya paylaşılan duyuruların takip edilmemesi/okunmaması nedeniyle oluşabilecek bilgilendirme eksiklikleri kursiyer/veli sorumluluğundadır.`;

function withGroupNotice(message: string) {
  const clean = message.trim();
  if (!clean || clean.includes(POLICY_MARKER) || clean.includes(GROUP_URL)) {
    return clean;
  }
  return `${clean}${GROUP_NOTICE}`;
}

export default function WhatsAppGroupPolicy() {
  useEffect(() => {
    const prepareWhatsAppMessage = (event: Event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;

      const anchor = target.closest("#whatsapp a[href*='wa.me']") as HTMLAnchorElement | null;
      if (!anchor) return;

      try {
        const url = new URL(anchor.href);
        const currentMessage = url.searchParams.get("text") || "";
        const finalMessage = withGroupNotice(currentMessage);
        if (!finalMessage || finalMessage === currentMessage) return;

        url.searchParams.set("text", finalMessage);
        anchor.href = url.toString();

        const textarea = document.querySelector(
          "#whatsapp textarea.messageTextarea"
        ) as HTMLTextAreaElement | null;

        if (textarea) {
          const setter = Object.getOwnPropertyDescriptor(
            HTMLTextAreaElement.prototype,
            "value"
          )?.set;
          setter?.call(textarea, finalMessage);
          textarea.dispatchEvent(new Event("input", { bubbles: true }));
        }
      } catch (error) {
        console.error("WhatsApp grup bilgilendirmesi hazırlanamadı:", error);
      }
    };

    // pointerdown, tarayıcı yeni sekmeyi açmadan önce href'i günceller.
    document.addEventListener("pointerdown", prepareWhatsAppMessage, true);
    return () =>
      document.removeEventListener("pointerdown", prepareWhatsAppMessage, true);
  }, []);

  return null;
}
