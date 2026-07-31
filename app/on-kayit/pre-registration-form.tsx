"use client";

import { FormEvent, useState } from "react";

const branches = [
  "Lara Life City",
  "Konyaaltı Öğretmenevi",
  "Meltem Yüzme Havuzu",
  "Süleyman Erol Olimpik Yüzme Havuzu"
];

export default function PreRegistrationForm() {
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("sending");
    setMessage("");

    const form = new FormData(event.currentTarget);
    const payload = Object.fromEntries(form.entries());

    try {
      const response = await fetch("/api/pre-registrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Kayıt oluşturulamadı.");

      setStatus("success");
      setMessage("Ön kaydınız alınmıştır. En kısa sürede sizinle iletişime geçeceğiz.");
      event.currentTarget.reset();
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Bir hata oluştu.");
    }
  }

  return (
    <form className="registrationForm" onSubmit={handleSubmit}>
      <input className="hiddenField" type="text" name="website" tabIndex={-1} autoComplete="off" />

      <div className="formGrid">
        <label>Öğrenci adı<input name="firstName" required maxLength={60} /></label>
        <label>Öğrenci soyadı<input name="lastName" required maxLength={60} /></label>
        <label>Doğum tarihi<input name="birthDate" type="date" /></label>
        <label>Veli adı soyadı<input name="guardianName" required maxLength={120} /></label>
        <label>Telefon<input name="phone" type="tel" required placeholder="05xx xxx xx xx" maxLength={20} /></label>
        <label>E-posta<input name="email" type="email" maxLength={160} /></label>
        <label>
          Şube tercihi
          <select name="branchName" required defaultValue="">
            <option value="" disabled>Şube seçin</option>
            {branches.map((branch) => <option key={branch}>{branch}</option>)}
          </select>
        </label>
        <label>Tercih edilen günler<input name="preferredDays" placeholder="Örn. Salı - Perşembe" maxLength={100} /></label>
        <label>Tercih edilen saat<input name="preferredTime" placeholder="Örn. 18.00 - 19.00" maxLength={100} /></label>
        <label>
          Yüzme seviyesi
          <select name="swimmingLevel" defaultValue="">
            <option value="">Seçiniz</option>
            <option>Başlangıç</option><option>Orta</option><option>İleri</option><option>Bilmiyorum</option>
          </select>
        </label>
      </div>

      <label className="fullWidth">
        Açıklama / özel durum
        <textarea name="note" rows={4} maxLength={1000} placeholder="Su korkusu, sağlık bilgisi veya eklemek istediğiniz not..." />
      </label>

      <label className="consent">
        <input type="checkbox" name="whatsappPermission" value="true" required />
        İletişim ve kayıt bilgilendirmelerinin WhatsApp üzerinden gönderilmesini kabul ediyorum.
      </label>

      <button className="submitButton" disabled={status === "sending"} type="submit">
        {status === "sending" ? "Gönderiliyor..." : "Ön Kayıt Oluştur"}
      </button>

      {message && <p className={status === "success" ? "formMessage success" : "formMessage error"}>{message}</p>}
    </form>
  );
}
