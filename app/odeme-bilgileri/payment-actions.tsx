"use client";

import { useMemo, useState } from "react";

type PhoneCandidate = { phone: string; label: string; source: string };

type Props = {
  message: string;
  qrUrl: string;
  studentId?: string | null;
  phoneCandidates?: PhoneCandidate[];
  studentName?: string | null;
  initialLastSentAt?: string | null;
};

function normalizePhone(value?: string | null) {
  let digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("0090")) digits = digits.slice(2);
  if (digits.startsWith("90") && digits.length === 12) return digits;
  if (digits.startsWith("0") && digits.length === 11) return `90${digits.slice(1)}`;
  if (digits.length === 10) return `90${digits}`;
  return digits;
}

function displayPhone(value?: string | null) {
  const normalized = normalizePhone(value);
  if (normalized.startsWith("90") && normalized.length === 12) {
    const local = `0${normalized.slice(2)}`;
    return `${local.slice(0, 4)} ${local.slice(4, 7)} ${local.slice(7, 9)} ${local.slice(9, 11)}`;
  }
  return value || "";
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
  phoneCandidates = [],
  studentName,
  initialLastSentAt,
}: Props) {
  const uniqueCandidates = useMemo(() => {
    const seen = new Set<string>();
    return phoneCandidates.filter((item) => {
      const key = normalizePhone(item.phone);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [phoneCandidates]);

  const [selectedPhone, setSelectedPhone] = useState(() => normalizePhone(uniqueCandidates[0]?.phone));
  const [status, setStatus] = useState("");
  const [lastSentAt, setLastSentAt] = useState(initialLastSentAt || "");
  const [savingSend, setSavingSend] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);

  const iban = useMemo(() => {
    const match = message.match(/TR(?:\s*\d){24}/i);
    return match?.[0]?.replace(/\s+/g, "").toUpperCase() || "";
  }, [message]);

  const selectedCandidate = uniqueCandidates.find((item) => normalizePhone(item.phone) === selectedPhone) || uniqueCandidates[0];
  const whatsappPhone = normalizePhone(selectedCandidate?.phone || selectedPhone);

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
    if (!whatsappPhone) {
      setStatus("Bu kursiyer için sistemde kullanılabilir telefon numarası bulunamadı.");
      return;
    }
    const popup = window.open(`https://wa.me/${whatsappPhone}?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
    if (!popup) {
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
        await navigator.share({ title: "SPRİNT YÜZME OKULU | QR Ödeme Bilgisi", text: "VakıfBank QR ödeme bilgisi", files: [file] });
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
    <section className="paymentActions">
      {studentName ? (
        <div className="recipientCard">
          <div>
            <span>KURSİYER</span>
            <strong>{studentName}</strong>
          </div>
          <div className={uniqueCandidates.length ? "ready" : "missing"}>
            {uniqueCandidates.length ? `${uniqueCandidates.length} telefon bulundu` : "Kayıtlı telefon bulunamadı"}
          </div>
        </div>
      ) : null}

      {uniqueCandidates.length > 0 ? (
        <div className="phonePicker">
          <div className="pickerHead">
            <div><span>WHATSAPP ALICISI</span><strong>{uniqueCandidates.length > 1 ? "Gönderilecek numarayı seçin" : "Numara otomatik bulundu"}</strong></div>
            {uniqueCandidates.length > 1 ? <em>{uniqueCandidates.length} seçenek</em> : <em className="auto">Otomatik</em>}
          </div>
          <div className="phoneOptions">
            {uniqueCandidates.map((item) => {
              const key = normalizePhone(item.phone);
              const active = key === whatsappPhone;
              return (
                <button key={`${key}-${item.source}`} type="button" className={active ? "phoneOption active" : "phoneOption"} onClick={() => setSelectedPhone(key)}>
                  <span className="radio">{active ? "✓" : ""}</span>
                  <span className="phoneText"><b>{displayPhone(item.phone)}</b><small>{item.label} · {item.source}</small></span>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="missingPhone"><b>Telefon bilgisi bulunamadı</b><span>Öğrenci, veli merkezi, ön kayıt ve diğer kursiyer kayıtları kontrol edildi.</span></div>
      )}

      {lastSentAt ? (
        <div className="sentHistory"><b>Ödeme bilgilendirmesi gönderildi</b><span>{formatSentAt(lastSentAt)}</span><small>Mesajlar ve İşlem Geçmişi kayıtlarına işlendi.</small></div>
      ) : null}

      <div className="actionGrid">
        <button type="button" onClick={() => iban && copyText(iban, "IBAN kopyalandı.")} disabled={!iban}><span className="icon">⧉</span><b>IBAN Kopyala</b><small>Tek dokunuşla panoya al</small></button>
        <button type="button" onClick={() => copyText(message, "Ödeme mesajı kopyalandı.")}><span className="icon">▤</span><b>Mesajı Kopyala</b><small>Hazır ödeme metnini al</small></button>
        <button type="button" onClick={openWhatsApp} className="primary" disabled={savingSend || !whatsappPhone}><span className="icon">◉</span><b>{savingSend ? "Kaydediliyor…" : "WhatsApp'ta Gönder"}</b><small>{whatsappPhone ? `${displayPhone(whatsappPhone)} numarasını aç` : "Telefon bilgisi gerekli"}</small></button>
        <button type="button" onClick={shareQr} disabled={savingSend}><span className="icon">⇧</span><b>QR Görselini Gönder</b><small>Telefon paylaşım ekranını aç</small></button>
        <button type="button" onClick={() => setQrOpen(true)}><span className="icon">▦</span><b>QR Görselini Aç</b><small>Uygulama içinde büyüt</small></button>
      </div>

      {status ? <div className="status">{status}</div> : null}

      {qrOpen ? (
        <div className="qrOverlay" onClick={() => setQrOpen(false)}>
          <div className="qrModal" onClick={(event) => event.stopPropagation()}>
            <div className="qrModalHeader"><div><span>VAKIFBANK</span><strong>QR Ödeme Bilgisi</strong></div><button type="button" onClick={() => setQrOpen(false)}>×</button></div>
            <div className="qrCanvas"><img src={qrUrl} alt="VakıfBank QR ödeme görseli" /></div>
            <button type="button" className="modalCloseAction" onClick={() => setQrOpen(false)}>Kapat</button>
          </div>
        </div>
      ) : null}

      <style jsx>{`
        .paymentActions{margin-top:18px}.recipientCard,.pickerHead{display:flex;align-items:center;justify-content:space-between;gap:12px}.recipientCard{padding:14px 15px;border:1px solid #d8e5ef;border-radius:15px;background:#f8fbfd}.recipientCard div:first-child{display:grid;gap:3px}.recipientCard span,.pickerHead span{font-size:10px;font-weight:900;letter-spacing:.08em;color:#71869a}.recipientCard strong,.pickerHead strong{font-size:14px;color:#173a59}.ready,.missing{padding:7px 10px;border-radius:999px;font-size:11px;font-weight:900}.ready{background:#eaf7ee;color:#257241}.missing{background:#fff0f0;color:#aa3434}.phonePicker{margin-top:12px;padding:14px;border:1px solid #d8e5ef;border-radius:15px;background:#fff}.pickerHead div{display:grid;gap:3px}.pickerHead em{font-style:normal;padding:6px 9px;border-radius:999px;background:#fff4df;color:#9a6500;font-size:10px;font-weight:900}.pickerHead em.auto{background:#eaf7ee;color:#257241}.phoneOptions{display:grid;gap:8px;margin-top:12px}.phoneOption{display:flex;align-items:center;gap:10px;width:100%;padding:11px 12px;border:1px solid #d9e4ee;border-radius:12px;background:#fff;text-align:left;cursor:pointer}.phoneOption.active{border-color:#0a5da8;background:#eef7ff;box-shadow:0 0 0 2px rgba(10,93,168,.08)}.radio{display:grid;place-items:center;width:24px;height:24px;border:2px solid #b7c9d8;border-radius:50%;font-size:12px;color:#fff}.phoneOption.active .radio{border-color:#0a5da8;background:#0a5da8}.phoneText{display:grid;gap:2px}.phoneText b{font-size:13px;color:#173a59}.phoneText small{font-size:10px;color:#70859a}.missingPhone{display:grid;gap:4px;margin-top:12px;padding:13px 14px;border:1px solid #efc4c4;border-radius:13px;background:#fff7f7;color:#943737}.missingPhone span{font-size:11px}.sentHistory{display:grid;gap:3px;margin-top:12px;padding:13px 15px;border:1px solid #b9dfc4;border-radius:14px;background:#eff9f2;color:#205f35}.sentHistory b{font-size:13px}.sentHistory span{font-size:12px;font-weight:900}.sentHistory small{font-size:10px}.actionGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:14px}.actionGrid button{min-height:80px;display:grid;grid-template-columns:40px 1fr;grid-template-rows:auto auto;align-items:center;column-gap:10px;padding:13px;border:1px solid #d6e3ee;border-radius:15px;background:#fff;color:#123a5d;text-align:left;cursor:pointer}.actionGrid button:disabled{opacity:.5;cursor:not-allowed}.actionGrid .icon{grid-row:1/span 2;display:grid;place-items:center;width:40px;height:40px;border-radius:11px;background:#edf5fb;color:#0a5da8;font-weight:900}.actionGrid b{font-size:13px}.actionGrid small{font-size:10px;color:#70859a}.actionGrid .primary{background:linear-gradient(135deg,#0b3158,#0a5da8);color:#fff}.actionGrid .primary .icon{background:rgba(255,255,255,.14);color:#fff}.actionGrid .primary small{color:#d9ebfb}.status{margin-top:11px;padding:10px 12px;border-radius:11px;background:#eef7f1;color:#22613a;font-size:12px;font-weight:700}.qrOverlay{position:fixed;inset:0;z-index:3000;display:grid;place-items:center;padding:16px;background:rgba(2,18,38,.76);backdrop-filter:blur(5px)}.qrModal{width:min(560px,100%);border-radius:22px;background:#fff;overflow:hidden;box-shadow:0 28px 80px rgba(0,0,0,.35)}.qrModalHeader{display:flex;justify-content:space-between;align-items:center;padding:15px 16px;border-bottom:1px solid #e4ebf1}.qrModalHeader div{display:grid;gap:2px}.qrModalHeader span{font-size:10px;color:#70859a;font-weight:900}.qrModalHeader strong{color:#173a59}.qrModalHeader button{width:38px;height:38px;border:0;border-radius:10px;background:#eef3f7;font-size:22px;cursor:pointer}.qrCanvas{padding:18px;text-align:center}.qrCanvas img{max-width:100%;height:auto;border-radius:12px}.modalCloseAction{display:block;width:calc(100% - 32px);margin:0 16px 16px;padding:12px;border:0;border-radius:12px;background:#0a5da8;color:#fff;font-weight:900;cursor:pointer}@media(max-width:640px){.actionGrid{grid-template-columns:1fr}.recipientCard{align-items:flex-start;flex-direction:column}.ready,.missing{align-self:flex-start}}
      `}</style>
    </section>
  );
}
