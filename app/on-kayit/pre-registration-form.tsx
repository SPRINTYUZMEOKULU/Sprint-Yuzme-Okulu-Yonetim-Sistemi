"use client";

import { FormEvent, useState } from "react";

const branches = ["Lara Life City", "Konyaaltı Öğretmenevi", "Meltem Yüzme Havuzu", "Süleyman Erol Olimpik Yüzme Havuzu"];

export default function PreRegistrationForm() {
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setStatus("sending"); setMessage("");
    const formElement = event.currentTarget;
    const payload = Object.fromEntries(new FormData(formElement).entries());
    try {
      const response = await fetch("/api/pre-registrations", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(payload) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Kayıt oluşturulamadı.");
      setStatus("success"); setMessage("Ön kaydınız başarıyla alınmıştır. Kayıt ekibimiz en kısa sürede sizinle iletişime geçecektir."); formElement.reset();
    } catch (error) { setStatus("error"); setMessage(error instanceof Error ? error.message : "Bir hata oluştu."); }
  }

  return (
    <form className="registrationForm" onSubmit={handleSubmit}>
      <input className="hiddenField" type="text" name="website" tabIndex={-1} autoComplete="off" />
      <section className="formSection">
        <div className="formSectionTitle"><b>1</b><div><strong>Öğrenci ve veli bilgileri</strong><span>İletişim kurabilmemiz için temel bilgiler</span></div></div>
        <div className="formGrid">
          <label>Öğrenci adı<input name="firstName" required maxLength={60} placeholder="Adı" /></label>
          <label>Öğrenci soyadı<input name="lastName" required maxLength={60} placeholder="Soyadı" /></label>
          <label>Doğum tarihi<input name="birthDate" type="date" /></label>
          <label>Veli adı soyadı<input name="guardianName" required maxLength={120} placeholder="Veli adı soyadı" /></label>
          <label>Telefon<input name="phone" type="tel" required placeholder="05xx xxx xx xx" maxLength={20} /></label>
          <label>E-posta<input name="email" type="email" maxLength={160} placeholder="ornek@email.com" /></label>
        </div>
      </section>
      <section className="formSection">
        <div className="formSectionTitle"><b>2</b><div><strong>Kurs tercihi</strong><span>Size en uygun programa yönlendirelim</span></div></div>
        <div className="formGrid">
          <label>Kurs türü<select name="courseType" required defaultValue=""><option value="" disabled>Seçiniz</option><option>Çocuk Yüzme Kursu</option><option>Yetişkin Yüzme Kursu</option><option>Özel Ders</option></select></label>
          <label>Şube tercihi<select name="branchName" required defaultValue=""><option value="" disabled>Şube seçin</option>{branches.map(branch=><option key={branch}>{branch}</option>)}</select></label>
          <label>Tercih edilen günler<input name="preferredDays" placeholder="Örn. Cumartesi - Pazar" maxLength={100} /></label>
          <label>Tercih edilen saat<input name="preferredTime" placeholder="Örn. 10.00 - 11.00" maxLength={100} /></label>
          <label>Yüzme seviyesi<select name="swimmingLevel" defaultValue=""><option value="">Seçiniz</option><option>Suya Uyum</option><option>Başlangıç</option><option>Orta</option><option>İleri</option><option>Bilmiyorum</option></select></label>
          <label>Paket tercihi<select name="packagePreference" defaultValue="8 Ders"><option>8 Ders</option><option>12 Ders</option><option>24 Ders</option><option>Kararsızım</option></select></label>
        </div>
      </section>
      <section className="formSection">
        <div className="formSectionTitle"><b>3</b><div><strong>Ek bilgiler</strong><span>Özel durum ve beklentilerinizi paylaşabilirsiniz</span></div></div>
        <label className="fullWidth">Açıklama / özel durum<textarea name="note" rows={4} maxLength={1000} placeholder="Su korkusu, sağlık bilgisi veya eklemek istediğiniz not..." /></label>
      </section>
      <label className="consent"><input type="checkbox" name="whatsappPermission" value="true" required /><span>İletişim ve kayıt bilgilendirmelerinin WhatsApp üzerinden gönderilmesini ve başvuru bilgilerimin kayıt süreci kapsamında işlenmesini kabul ediyorum.</span></label>
      <div className="submitRow"><button className="submitButton" disabled={status==="sending"} type="submit">{status==="sending"?"Başvurunuz gönderiliyor...":"Ön Kaydı Tamamla"}</button></div>
      {message && <p className={status==="success"?"formMessage success":"formMessage error"}>{message}</p>}
    </form>
  );
}
