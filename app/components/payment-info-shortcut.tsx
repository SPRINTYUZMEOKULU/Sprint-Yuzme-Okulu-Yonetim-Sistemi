"use client";

import { usePathname } from "next/navigation";

export default function PaymentInfoShortcut() {
  const pathname = usePathname();
  const match = pathname.match(/^\/ogrenciler\/([^/]+)$/);

  if (!match) return null;

  const studentId = encodeURIComponent(match[1]);

  return (
    <a
      href={`/odeme-bilgileri?studentId=${studentId}`}
      className="paymentInfoShortcut"
      aria-label="IBAN ve QR ödeme bilgilerini aç"
    >
      <span className="paymentInfoShortcutIcon">₺</span>
      <span>
        <b>IBAN / QR</b>
        <small>Ödeme bilgisi gönder</small>
      </span>
      <style jsx>{`
        .paymentInfoShortcut {
          position: fixed;
          right: 18px;
          bottom: calc(18px + env(safe-area-inset-bottom));
          z-index: 90;
          display: inline-flex;
          align-items: center;
          gap: 10px;
          padding: 11px 14px;
          border: 1px solid rgba(255,255,255,.28);
          border-radius: 16px;
          background: linear-gradient(135deg,#0b3158,#0a5da8);
          box-shadow: 0 14px 34px rgba(4,36,72,.28);
          color: #fff;
          text-decoration: none;
          -webkit-tap-highlight-color: transparent;
        }
        .paymentInfoShortcutIcon {
          display: grid;
          place-items: center;
          width: 34px;
          height: 34px;
          border-radius: 11px;
          background: rgba(255,255,255,.14);
          font-size: 19px;
          font-weight: 900;
        }
        .paymentInfoShortcut span:last-child { display:flex; flex-direction:column; line-height:1.08; }
        .paymentInfoShortcut b { font-size: 13px; }
        .paymentInfoShortcut small { margin-top:4px; color:#d8ebff; font-size:10px; }
        @media (max-width:720px) {
          .paymentInfoShortcut { right:12px; bottom:calc(12px + env(safe-area-inset-bottom)); padding:10px 12px; }
        }
      `}</style>
    </a>
  );
}
