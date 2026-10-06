"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import GuardianIcon from "./guardian-icon";
import { prepareGuardianPortalAccess } from "./actions";

function whatsappPhone(value: string) {
  let digits = String(value || "").replace(/\D/g, "");
  if (digits.startsWith("0")) digits = digits.slice(1);
  return digits.startsWith("90") ? digits : `90${digits}`;
}

function portalMessage(input: { fullName: string; phone: string; email?: string; password: string }) {
  return [
    "*SPRİNT YÜZME OKULU*",
    "",
    `Merhaba ${input.fullName || "Değerli Velimiz"},`,
    "",
    "SprintOS Veli / Kursiyer Portalı hesabınız hazırdır.",
    "",
    `📱 Telefon: ${input.phone}`,
    input.email ? `✉️ E-posta: ${input.email}` : "",
    `🔐 Geçici şifre: ${input.password}`,
    `🔗 Giriş adresi: ${window.location.origin}/login`,
    "",
    "Giriş ekranında *Veli Girişi* bölümünü seçerek kayıtlı telefon numaranız ve geçici şifreniz ile giriş yapabilirsiniz.",
    "Güvenliğiniz için giriş yaptıktan sonra şifrenizi değiştirmenizi öneririz.",
    "",
    "☎️ Bilgilendirme Hattı: 0551 896 83 19",
    "*SPRİNT YÜZME OKULU*",
  ].filter(Boolean).join("\n");
}

export default function GuardianPortalActions({
  guardianProfileId,
  phone,
  hasGuardianRow,
  linkedCount,
}: {
  guardianProfileId: string;
  phone: string;
  hasGuardianRow: boolean;
  linkedCount: number;
}) {
  const router = useRouter();
  const [whatsappUrl, setWhatsappUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");

  async function prepareAndSend() {
    if (busy) return;
    setWhatsappUrl("");
    setBusy(true);
    setStatus("Portal erişimi hazırlanıyor…");
    try {
      const result = await prepareGuardianPortalAccess(guardianProfileId);
      if (!result.ok) {
        setStatus(result.message);
        return;
      }
      setStatus("Geçici şifre hazır. Aşağıdaki butondan WhatsApp mesajını açın.");
      setWhatsappUrl(`https://wa.me/${whatsappPhone(result.phone)}?text=${encodeURIComponent(portalMessage(result))}`);
      router.refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "İşlem tamamlanamadı.");
    } finally {
      setBusy(false);
    }
  }

  return <div className="guardianQuickActions">
    <button type="button" className="guardianActivationButton" onClick={prepareAndSend} disabled={busy || !phone}>
      <GuardianIcon name="key"/>{busy ? "Hazırlanıyor…" : "Geçici Şifre Hazırla"}
    </button>
    {whatsappUrl ? <button type="button" className="guardianActivationButton" onClick={() => window.open(whatsappUrl, "_blank", "noopener,noreferrer")}><GuardianIcon name="message"/>WhatsApp Mesajını Aç</button> : null}
    {!hasGuardianRow ? <span className="guardianHealth warning">Ana portal kaydı eksik · işlem sırasında otomatik onarılır</span> : null}
    {hasGuardianRow && linkedCount === 0 ? <span className="guardianHealth danger">Öğrenci bağlantısı eksik</span> : null}
    {!phone ? <span className="guardianHealth danger">Telefon eksik veya geçersiz</span> : null}
    {status ? <small role="status" aria-live="polite" className="guardianActionStatus">{status}</small> : null}
  </div>;
}
