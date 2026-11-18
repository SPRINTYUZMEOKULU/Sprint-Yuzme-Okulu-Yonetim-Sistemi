"use client";

import { useState } from "react";
import { openCurrentWhatsapp } from "@/lib/messaging/current-recipient";

type Props = {
  studentName: string;
  studentId: string;
  branchName?: string | null;
  groupName?: string | null;
  packageName?: string | null;
  totalLessons?: number | null;
  startDate?: string | null;
  plannedEndDate?: string | null;
  paymentDueDate?: string | null;
  sessions?: string[];
};

function dateTR(value?: string | null) {
  if (!value) return "—";
  const [y, m, d] = value.slice(0, 10).split("-");
  return y && m && d ? `${d}.${m}.${y}` : value;
}

export default function CorrectionWhatsapp(props: Props) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const message = [
    "*SPRİNT YÜZME OKULU - KAYIT BİLGİLENDİRMESİ*",
    "",
    "Merhaba,",
    `${props.studentName} için güncel yüzme kursu kayıt bilgilerini paylaşıyoruz.`,
    "",
    `• *Şube:* ${props.branchName || "—"}`,
    `• *Grup:* ${props.groupName || "—"}`,
    `• *Paket:* ${props.packageName || "—"}`,
    `• *Toplam Ders:* ${props.totalLessons ?? "—"}`,
    ...(props.sessions?.length ? [`• *Ders Gün / Saatleri:* ${props.sessions.join(" • ")}`] : []),
    `• *Başlangıç Tarihi:* ${dateTR(props.startDate)}`,
    `• *Planlanan Bitiş:* ${dateTR(props.plannedEndDate)}`,
    ...(props.paymentDueDate ? [`• *Ödeme Vadesi:* ${dateTR(props.paymentDueDate)}`] : []),
    "",
    "Lütfen yukarıdaki güncel bilgileri kontrol ediniz. Herhangi bir farklılık olması halinde bizimle iletişime geçebilirsiniz.",
    "",
    "*SPRİNT YÜZME OKULU*",
    "Bilgilendirme Hattı: 0551 896 83 19",
    "https://sprintyuzmekursu.com",
  ].join("\n");

  async function openWhatsapp() {
    setPending(true);
    setError("");
    try {
      await openCurrentWhatsapp(props.studentId, null, message);
    } catch (error) {
      setError(error instanceof Error ? error.message : "WhatsApp açılamadı. Tekrar deneyin.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="correctionWhatsapp">
      <div>
        <strong>Kayıt güncellemesini paylaş</strong>
        <span>Göndermek isterseniz hazır mesajı WhatsApp’ta açın.</span>
        <details>
          <summary>Mesajı önizle</summary>
          <p className="correctionWhatsappPreview">{message}</p>
        </details>
        {error && <p role="alert">{error}</p>}
      </div>
      <button type="button" onClick={openWhatsapp} disabled={pending} aria-busy={pending}>
        {pending ? "Alıcı doğrulanıyor…" : "WhatsApp’ta Aç"}
      </button>
    </div>
  );
}
