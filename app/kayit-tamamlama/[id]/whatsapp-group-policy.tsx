"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

const GROUP_URL = "https://chat.whatsapp.com/EP5uzxNSRU51QWeHPAAAnQ?mode=gi_t";

const GROUP_MESSAGE = `*SPRİNT YÜZME OKULU | WHATSAPP BİLGİLENDİRME GRUBU*\n\nKurs programı, havuz kapanışı, resmî tatil, telafi ve saat değişikliği duyurularını takip edebilmeniz için resmi WhatsApp bilgilendirme grubumuza katılmanızı rica ederiz.\n\n*Gruba katıl:* ${GROUP_URL}\n\nPaylaşılan duyuruların düzenli takip edilmesi kursiyer/veli sorumluluğundadır.`;

function getRecipientFromPrimaryLink(host: Element) {
  const anchor = host.querySelector("a[href*='wa.me']") as HTMLAnchorElement | null;
  if (!anchor) return "";

  try {
    const url = new URL(anchor.href);
    return url.pathname.replace(/\D/g, "");
  } catch {
    return "";
  }
}

export default function WhatsAppGroupPolicy() {
  const [host, setHost] = useState<Element | null>(null);
  const [opened, setOpened] = useState(false);

  useEffect(() => {
    setHost(document.querySelector("#whatsapp"));
  }, []);

  function openGroupInvite() {
    if (!host) return;

    const recipient = getRecipientFromPrimaryLink(host);

    if (!recipient) {
      window.alert("Grup daveti için veli/öğrenci WhatsApp numarası bulunamadı.");
      return;
    }

    window.open(
      `https://wa.me/${recipient}?text=${encodeURIComponent(GROUP_MESSAGE)}`,
      "_blank",
      "noopener,noreferrer"
    );

    setOpened(true);
  }

  if (!host) return null;

  return createPortal(
    <div className="whatsappGroupInviteCard">
      <div>
        <strong>2. mesaj · WhatsApp grubu daveti</strong>
        <span>
          Kayıt bilgilendirme mesajı kısa kalır. Grup bağlantısı ayrı mesaj olarak gönderilir.
        </span>
      </div>
      <button type="button" onClick={openGroupInvite}>
        {opened ? "Grup Davetini Tekrar Aç" : "Grup Davetini Gönder"}
      </button>
      <style jsx>{`
        .whatsappGroupInviteCard {
          margin-top: 14px;
          padding: 14px;
          border: 1px solid #bfe0cf;
          border-radius: 14px;
          background: #f3fbf7;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
        }
        .whatsappGroupInviteCard div {
          display: grid;
          gap: 5px;
          min-width: 0;
        }
        .whatsappGroupInviteCard strong {
          color: #123b2a;
          font-size: 14px;
        }
        .whatsappGroupInviteCard span {
          color: #5b7468;
          font-size: 12px;
          line-height: 1.45;
        }
        .whatsappGroupInviteCard button {
          flex: 0 0 auto;
          min-height: 42px;
          padding: 0 15px;
          border: 0;
          border-radius: 11px;
          background: #128c5e;
          color: #fff;
          font-weight: 800;
          cursor: pointer;
        }
        @media (max-width: 680px) {
          .whatsappGroupInviteCard {
            align-items: stretch;
            flex-direction: column;
          }
          .whatsappGroupInviteCard button {
            width: 100%;
          }
        }
      `}</style>
    </div>,
    host
  );
}
