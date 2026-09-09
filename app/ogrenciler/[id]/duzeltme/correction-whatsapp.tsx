"use client";

type Props = {
  studentName: string;
  phone?: string | null;
  guardianPhone?: string | null;
  branchName?: string | null;
  groupName?: string | null;
  packageName?: string | null;
  totalLessons?: number | null;
  startDate?: string | null;
  plannedEndDate?: string | null;
  paymentDueDate?: string | null;
  sessions?: string[];
};

function whatsappPhone(value?: string | null) {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("90")) return digits;
  if (digits.startsWith("0")) return `90${digits.slice(1)}`;
  if (digits.length === 10) return `90${digits}`;
  return digits;
}

function dateTR(value?: string | null) {
  if (!value) return "—";
  const [y, m, d] = value.slice(0, 10).split("-");
  return y && m && d ? `${d}.${m}.${y}` : value;
}

export default function CorrectionWhatsapp(props: Props) {
  const recipient = whatsappPhone(props.guardianPhone || props.phone);
  const message = [
    "🏊 *SPRİNT YÜZME OKULU – KAYIT BİLGİLENDİRMESİ*",
    "",
    `Sayın ${props.studentName},`,
    "Kursiyer kaydınızda yapılan güncelleme tamamlanmıştır. Güncel kayıt bilgileriniz aşağıdaki gibidir:",
    "",
    `📍 *Şube:* ${props.branchName || "—"}`,
    `👥 *Grup:* ${props.groupName || "—"}`,
    `🎫 *Paket:* ${props.packageName || "—"}`,
    `🏊 *Toplam Ders:* ${props.totalLessons ?? "—"}`,
    ...(props.sessions?.length ? [`🗓️ *Ders Gün / Saatleri:* ${props.sessions.join(" • ")}`] : []),
    `📅 *Başlangıç Tarihi:* ${dateTR(props.startDate)}`,
    `🏁 *Planlanan Bitiş:* ${dateTR(props.plannedEndDate)}`,
    ...(props.paymentDueDate ? [`💳 *Ödeme Vadesi:* ${dateTR(props.paymentDueDate)}`] : []),
    "",
    "Lütfen yukarıdaki güncel bilgileri kontrol ediniz. Herhangi bir farklılık olması halinde bizimle iletişime geçebilirsiniz.",
    "",
    "*SPRİNT Yüzme Okulu*",
    "Bilgilendirme Hattı: 0551 896 83 19",
  ].join("\n");

  function send() {
    if (!recipient) {
      window.alert("Kursiyer veya veli için WhatsApp numarası bulunamadı.");
      return;
    }
    window.open(
      `https://wa.me/${recipient}?text=${encodeURIComponent(message)}`,
      "_blank",
      "noopener,noreferrer",
    );
  }

  return (
    <div className="correctionWhatsapp">
      <div>
        <strong>📲 Güncel bilgileri kursiyere gönder</strong>
        <span>Düzeltme sonrası kesinleşen son kayıt bilgilerini WhatsApp mesajı olarak hazırlar.</span>
      </div>
      <button type="button" onClick={send} disabled={!recipient}>
        {recipient ? "WhatsApp’tan Gönder" : "Telefon Numarası Yok"}
      </button>
    </div>
  );
}
