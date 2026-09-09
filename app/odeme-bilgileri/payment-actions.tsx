"use client";

import { useMemo, useState } from "react";

type Props = {
  message: string;
  qrUrl: string;
  recipientPhone?: string | null;
  studentName?: string | null;
};

function normalizePhone(value?: string | null) {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("90") && digits.length >= 12) return digits;
  if (digits.startsWith("0") && digits.length === 11) return `90${digits.slice(1)}`;
  if (digits.length === 10) return `90${digits}`;
  return digits;
}

export default function PaymentActions({ message, qrUrl, recipientPhone, studentName }: Props) {
  const [status, setStatus] = useState("");

  const iban = useMemo(() => {
    const match = message.match(/TR(?:\s*\d){24}/i);
    return match?.[0]?.replace(/\s+/g, "").toUpperCase() || "";
  }, [message]);

  const whatsappPhone = useMemo(() => normalizePhone(recipientPhone), [recipientPhone]);

  async function copyText(value: string, success: string) {
    try {
      await navigator.clipboard.writeText(value);
      setStatus(success);
    } catch {
      setStatus("Kopyalama yapılamadı. Metni seçerek kopyalayabilirsiniz.");
    }
  }

  function openWhatsApp() {
    const base = whatsappPhone ? `https://wa.me/${whatsappPhone}` : "https://wa.me/";
    window.open(`${base}?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
  }

  async function shareQr() {
    try {
      const response = await fetch(qrUrl);
      if (!response.ok) throw new Error("QR yüklenemedi");
      const blob = await response.blob();
      const file = new File([blob], "vakifbank-qr.jpg", { type: blob.type || "image/jpeg" });

      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          title: "SPRİNT YÜZME OKULU | QR Ödeme Bilgisi",
          text: "VakıfBank QR ödeme bilgisi",
          files: [file],
        });
        setStatus("QR paylaşım ekranı açıldı.");
        return;
      }

      window.open(qrUrl, "_blank", "noopener,noreferrer");
      setStatus("Cihazınız dosya paylaşımını desteklemediği için QR görseli açıldı.");
    } catch {
      window.open(qrUrl, "_blank", "noopener,noreferrer");
      setStatus("QR görseli yeni sekmede açıldı.");
    }
  }

  return (
    <section className="paymentActions" aria-label="Ödeme bilgisi işlemleri">
      {studentName ? (
        <div className="recipientCard">
          <span>Kursiyer</span>
          <strong>{studentName}</strong>
          <small>{whatsappPhone ? "WhatsApp numarası hazır" : "Kayıtlı WhatsApp numarası bulunamadı"}</small>
        </div>
      ) : null}

      <div className="actionGrid">
        <button type="button" onClick={() => iban && copyText(iban, "IBAN kopyalandı.")} disabled={!iban}>
          <span>📋</span><b>IBAN Kopyala</b><small>Tek dokunuşla panoya al</small>
        </button>

        <button type="button" onClick={() => copyText(message, "Ödeme mesajı kopyalandı.")}>
          <span>🧾</span><b>Mesajı Kopyala</b><small>Hazır ödeme metnini al</small>
        </button>

        <button type="button" onClick={openWhatsApp} className="primary">
          <span>💬</span><b>WhatsApp'ta Gönder</b><small>{whatsappPhone ? "Kursiyer / veli numarasını aç" : "WhatsApp alıcısını seç"}</small>
        </button>

        <button type="button" onClick={shareQr}>
          <span>▦</span><b>QR Görselini Gönder</b><small>Telefon paylaşım ekranını aç</small>
        </button>

        <a href={qrUrl} target="_blank" rel="noreferrer">
          <span>🔎</span><b>QR Görselini Aç</b><small>Orijinal banka görselini göster</small>
        </a>
      </div>

      {status ? <div className="status" role="status">{status}</div> : null}

      <style jsx>{`
        .paymentActions { margin-top: 18px; }
        .recipientCard {
          display:flex; align-items:center; gap:10px; flex-wrap:wrap;
          margin-bottom:14px; padding:13px 15px; border:1px solid #d8e5ef;
          border-radius:14px; background:#f8fbfd; color:#193b59;
        }
        .recipientCard span { font-size:11px; font-weight:900; letter-spacing:.06em; text-transform:uppercase; color:#6b8195; }
        .recipientCard strong { font-size:14px; }
        .recipientCard small { margin-left:auto; color:#60758a; font-size:11px; }
        .actionGrid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; }
        .actionGrid button, .actionGrid a {
          min-height:82px; display:grid; grid-template-columns:34px 1fr; grid-template-rows:auto auto;
          align-items:center; column-gap:10px; padding:13px 14px; border-radius:15px;
          border:1px solid #d6e3ee; background:#fff; color:#123a5d; text-decoration:none;
          cursor:pointer; text-align:left; font:inherit; box-shadow:0 5px 16px rgba(12,49,89,.05);
        }
        .actionGrid button:hover, .actionGrid a:hover { transform:translateY(-1px); border-color:#b8cedf; }
        .actionGrid button:disabled { opacity:.45; cursor:not-allowed; transform:none; }
        .actionGrid span { grid-row:1 / span 2; display:grid; place-items:center; width:34px; height:34px; border-radius:10px; background:#edf5fb; font-size:17px; }
        .actionGrid b { font-size:13px; line-height:1.2; }
        .actionGrid small { margin-top:3px; font-size:10px; line-height:1.25; color:#70859a; }
        .actionGrid .primary { background:linear-gradient(135deg,#0b3158,#0a5da8); color:#fff; border-color:#0a5da8; }
        .actionGrid .primary span { background:rgba(255,255,255,.14); }
        .actionGrid .primary small { color:#d9ebfb; }
        .status { margin-top:11px; padding:10px 12px; border-radius:11px; background:#eef7f1; color:#22613a; font-size:12px; font-weight:700; }
        @media (max-width:640px) {
          .actionGrid { grid-template-columns:1fr; }
          .recipientCard small { width:100%; margin-left:0; }
        }
      `}</style>
    </section>
  );
}
