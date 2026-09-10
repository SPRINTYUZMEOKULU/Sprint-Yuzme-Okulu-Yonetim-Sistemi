"use client";

import { useMemo, useState, type ReactNode } from "react";

type Props = {
  message: string;
  qrUrl: string;
  studentId?: string | null;
  recipientPhone?: string | null;
  studentName?: string | null;
  initialLastSentAt?: string | null;
};

type IconName = "copy" | "message" | "whatsapp" | "share" | "qr" | "close";

function Icon({ name }: { name: IconName }) {
  const base = {
    width: 22,
    height: 22,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.9,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  const paths: Record<IconName, ReactNode> = {
    copy: <><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></>,
    message: <><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/><path d="M8 9h8M8 13h5"/></>,
    whatsapp: <><path d="M20.5 11.6a8.5 8.5 0 0 1-12.6 7.5L3 20.5l1.4-4.7A8.5 8.5 0 1 1 20.5 11.6z"/><path d="M8.4 8.1c.2-.5.5-.5.8-.5h.4c.2 0 .4.1.5.4l.8 1.8c.1.3.1.5-.1.7l-.6.8c-.2.2-.1.5 0 .7.6 1.1 1.6 2.1 2.8 2.7.2.1.5.2.7 0l.9-1.1c.2-.2.5-.3.8-.1l1.7.8c.3.1.5.3.5.5 0 .5-.2 1.4-.8 2-.6.6-1.5.9-2.4.7-1.2-.2-2.8-.8-4.5-2.3-1.4-1.2-2.4-2.7-2.9-3.9-.5-1.1-.5-2.1-.1-2.9l.5-1.3z"/></>,
    share: <><path d="M12 16V4"/><path d="m8 8 4-4 4 4"/><rect x="4" y="12" width="16" height="8" rx="2"/></>,
    qr: <><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><path d="M14 14h3v3h-3zM18 18h3v3h-3zM18 14h3M14 19v2"/></>,
    close: <><path d="M6 6l12 12M18 6 6 18"/></>,
  };

  return <svg {...base}>{paths[name]}</svg>;
}

function normalizePhone(value?: string | null) {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("90") && digits.length >= 12) return digits;
  if (digits.startsWith("0") && digits.length === 11) return `90${digits.slice(1)}`;
  if (digits.length === 10) return `90${digits}`;
  return digits;
}

function formatSentAt(value?: string | null) {
  if (!value) return "";
  try {
    return new Intl.DateTimeFormat("tr-TR", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Europe/Istanbul",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

export default function PaymentActions({
  message,
  qrUrl,
  studentId,
  recipientPhone,
  studentName,
  initialLastSentAt,
}: Props) {
  const [status, setStatus] = useState("");
  const [qrOpen, setQrOpen] = useState(false);
  const [lastSentAt, setLastSentAt] = useState(initialLastSentAt || "");
  const [savingSend, setSavingSend] = useState(false);

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

  async function recordSend(method: "whatsapp" | "qr_share") {
    if (!studentId) return null;
    setSavingSend(true);
    try {
      const response = await fetch("/api/payment-info-sent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId,
          recipient: whatsappPhone || null,
          message,
          method,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.message || "Gönderim kaydı oluşturulamadı.");
      const sentAt = String(data?.sentAt || new Date().toISOString());
      setLastSentAt(sentAt);
      return sentAt;
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Gönderim kaydı oluşturulamadı.");
      return null;
    } finally {
      setSavingSend(false);
    }
  }

  async function openWhatsApp() {
    const base = whatsappPhone ? `https://wa.me/${whatsappPhone}` : "https://wa.me/";
    const popup = window.open(`${base}?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
    if (!popup && whatsappPhone) {
      setStatus("WhatsApp penceresi açılamadı. Tarayıcı açılır pencereyi engelliyor olabilir.");
      return;
    }
    const sentAt = await recordSend("whatsapp");
    if (sentAt) setStatus(`Ödeme bilgilendirmesi ${formatSentAt(sentAt)} tarihinde gönderim kaydına işlendi.`);
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
        const sentAt = await recordSend("qr_share");
        setStatus(sentAt ? `QR ödeme bilgilendirmesi ${formatSentAt(sentAt)} tarihinde işlem geçmişine işlendi.` : "QR paylaşım ekranı açıldı.");
        return;
      }

      setQrOpen(true);
      setStatus("Cihaz dosya paylaşımını desteklemediği için QR önizlemesi açıldı.");
    } catch {
      setQrOpen(true);
      setStatus("QR önizlemesi açıldı.");
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

      {lastSentAt ? (
        <div className="sentHistory" role="status">
          <b>Ödeme bilgilendirmesi gönderildi</b>
          <span>{formatSentAt(lastSentAt)}</span>
          <small>IBAN / QR bilgilendirmesi Mesajlar ve İşlem Geçmişi kayıtlarına işlendi.</small>
        </div>
      ) : null}

      <div className="actionGrid">
        <button type="button" onClick={() => iban && copyText(iban, "IBAN kopyalandı.")} disabled={!iban}>
          <span className="icon"><Icon name="copy" /></span><b>IBAN Kopyala</b><small>Tek dokunuşla panoya al</small>
        </button>

        <button type="button" onClick={() => copyText(message, "Ödeme mesajı kopyalandı.")}>
          <span className="icon"><Icon name="message" /></span><b>Mesajı Kopyala</b><small>Hazır ödeme metnini al</small>
        </button>

        <button type="button" onClick={openWhatsApp} className="primary" disabled={savingSend}>
          <span className="icon"><Icon name="whatsapp" /></span><b>{savingSend ? "Kaydediliyor…" : "WhatsApp'ta Gönder"}</b><small>{lastSentAt ? `Son gönderim: ${formatSentAt(lastSentAt)}` : whatsappPhone ? "Kursiyer / veli numarasını aç" : "WhatsApp alıcısını seç"}</small>
        </button>

        <button type="button" onClick={shareQr} disabled={savingSend}>
          <span className="icon"><Icon name="share" /></span><b>QR Görselini Gönder</b><small>{lastSentAt ? `Son bilgilendirme: ${formatSentAt(lastSentAt)}` : "Telefon paylaşım ekranını aç"}</small>
        </button>

        <button type="button" onClick={() => setQrOpen(true)}>
          <span className="icon"><Icon name="qr" /></span><b>QR Görselini Aç</b><small>Uygulama içinde büyüt ve görüntüle</small>
        </button>
      </div>

      {status ? <div className="status" role="status">{status}</div> : null}

      {qrOpen ? (
        <div className="qrOverlay" role="dialog" aria-modal="true" aria-label="VakıfBank QR ödeme görseli" onClick={() => setQrOpen(false)}>
          <div className="qrModal" onClick={(event) => event.stopPropagation()}>
            <div className="qrModalHeader">
              <div><span>VAKIFBANK</span><strong>QR Ödeme Bilgisi</strong></div>
              <button type="button" className="closeButton" onClick={() => setQrOpen(false)} aria-label="QR görselini kapat"><Icon name="close" /></button>
            </div>
            <div className="qrCanvas">
              <img src={qrUrl} alt="VakıfBank QR ödeme görseli" />
            </div>
            <button type="button" className="modalCloseAction" onClick={() => setQrOpen(false)}>Kapat</button>
          </div>
        </div>
      ) : null}

      <style jsx>{`
        .paymentActions { margin-top: 18px; }
        .recipientCard { display:flex; align-items:center; gap:10px; flex-wrap:wrap; margin-bottom:14px; padding:13px 15px; border:1px solid #d8e5ef; border-radius:14px; background:#f8fbfd; color:#193b59; }
        .recipientCard span { font-size:11px; font-weight:900; letter-spacing:.06em; text-transform:uppercase; color:#6b8195; }
        .recipientCard strong { font-size:14px; }
        .recipientCard small { margin-left:auto; color:#60758a; font-size:11px; }
        .sentHistory { display:grid; gap:3px; margin-bottom:14px; padding:13px 15px; border:1px solid #b9dfc4; border-radius:14px; background:#eff9f2; color:#205f35; }
        .sentHistory b { font-size:13px; }
        .sentHistory span { font-size:12px; font-weight:900; }
        .sentHistory small { color:#4f765d; font-size:10px; }
        .actionGrid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; }
        .actionGrid button { min-height:82px; display:grid; grid-template-columns:42px 1fr; grid-template-rows:auto auto; align-items:center; column-gap:11px; padding:13px 14px; border-radius:15px; border:1px solid #d6e3ee; background:#fff; color:#123a5d; cursor:pointer; text-align:left; font:inherit; box-shadow:0 5px 16px rgba(12,49,89,.05); transition:.16s ease; }
        .actionGrid button:hover { transform:translateY(-1px); border-color:#b8cedf; }
        .actionGrid button:disabled { opacity:.55; cursor:not-allowed; transform:none; }
        .icon { grid-row:1 / span 2; display:grid; place-items:center; width:42px; height:42px; border-radius:12px; background:#edf5fb; color:#0a5da8; }
        .actionGrid b { font-size:13px; line-height:1.2; }
        .actionGrid small { margin-top:3px; font-size:10px; line-height:1.25; color:#70859a; }
        .actionGrid .primary { background:linear-gradient(135deg,#0b3158,#0a5da8); color:#fff; border-color:#0a5da8; }
        .actionGrid .primary .icon { background:rgba(255,255,255,.13); color:#fff; }
        .actionGrid .primary small { color:#d9ebfb; }
        .status { margin-top:11px; padding:10px 12px; border-radius:11px; background:#eef7f1; color:#22613a; font-size:12px; font-weight:700; }
        .qrOverlay { position:fixed; inset:0; z-index:3000; display:grid; place-items:center; padding:16px; background:rgba(2,18,38,.76); backdrop-filter:blur(5px); }
        .qrModal { width:min(560px,100%); max-height:calc(100dvh - 32px); overflow:auto; border-radius:22px; background:#fff; box-shadow:0 28px 80px rgba(0,0,0,.35); }
        .qrModalHeader { position:sticky; top:0; z-index:2; display:flex; align-items:center; justify-content:space-between; gap:12px; padding:15px 16px; border-bottom:1px solid #e0e9f1; background:rgba(255,255,255,.97); }
        .qrModalHeader div { display:flex; flex-direction:column; gap:2px; }
        .qrModalHeader span { font-size:10px; font-weight:900; letter-spacing:.1em; color:#70859a; }
        .qrModalHeader strong { color:#0c3159; font-size:16px; }
        .closeButton { display:grid; place-items:center; width:44px; height:44px; flex:0 0 auto; border:1px solid #d7e3ed; border-radius:13px; background:#f6f9fc; color:#123a5d; cursor:pointer; }
        .qrCanvas { padding:16px; background:#f6f9fc; }
        .qrCanvas img { display:block; width:100%; height:auto; max-height:72dvh; object-fit:contain; border-radius:14px; background:#fff; }
        .modalCloseAction { width:calc(100% - 32px); margin:0 16px 16px; min-height:48px; border:0; border-radius:13px; background:#0a5da8; color:#fff; font:inherit; font-weight:900; cursor:pointer; }
        @media (max-width:640px) { .actionGrid { grid-template-columns:1fr; } .recipientCard small { width:100%; margin-left:0; } .qrOverlay { padding:0; align-items:stretch; } .qrModal { width:100%; max-height:100dvh; border-radius:0; } .qrCanvas img { max-height:calc(100dvh - 150px); } }
      `}</style>
    </section>
  );
}
