"use client";

import { useEffect } from "react";
import { getGuardianPhoneContact } from "./guardian-phone-actions";
import { resetGuardianPortalPassword } from "./profile-center-actions";

function cleanPhone(value?: string | null) {
  let digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("90")) return digits;
  if (digits.startsWith("0")) digits = digits.slice(1);
  return digits.length === 10 ? `90${digits}` : digits;
}

function buildMessage(name: string, phone: string, password: string, origin: string) {
  return [
    `Merhaba ${name || "Değerli Velimiz"},`,
    "",
    "SPRİNT YÜZME OKULU Veli / Kursiyer Portalı hesabınız oluşturulmuştur.",
    "",
    `Giriş adresi: ${origin}/login`,
    `Kullanıcı telefonu: ${phone}`,
    `Geçici giriş şifresi: ${password}`,
    "",
    "Giriş ekranında Veli Girişi bölümünü seçerek telefon numaranız ve şifreniz ile giriş yapabilirsiniz.",
    "",
    "Güvenliğiniz için giriş yaptıktan sonra şifrenizi değiştirmenizi öneririz.",
    "",
    "SPRİNT YÜZME OKULU",
    "Bilgilendirme Hattı: 0551 896 83 19",
  ].join("\n");
}

export default function GuardianActivationWhatsAppBridge({ studentId }: { studentId: string }) {
  useEffect(() => {
    const render = () => {
      const connected = document.querySelector<HTMLElement>(".profileCenterPanel .portalConnected");
      if (!connected || connected.querySelector("[data-guardian-activation]")) return;

      const box = document.createElement("div");
      box.dataset.guardianActivation = "1";
      box.style.cssText = "display:grid;gap:10px;padding:14px;border:1px solid #bbf7d0;border-radius:13px;background:#f0fdf4";

      const title = document.createElement("strong");
      title.textContent = "Portal şifresi ve WhatsApp giriş bilgisi";
      title.style.cssText = "color:#166534;font-size:13px";

      const note = document.createElement("small");
      note.textContent = "Veli veya kursiyer için en az 8 karakterlik bir şifre belirleyin. Şifre kaydedildikten sonra giriş bilgileri WhatsApp mesajı olarak hazırlanır.";
      note.style.cssText = "color:#4b6b58;line-height:1.45";

      const controls = document.createElement("div");
      controls.style.cssText = "display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px";

      const inputWrap = document.createElement("div");
      inputWrap.style.cssText = "position:relative";

      const input = document.createElement("input");
      input.type = "password";
      input.autocomplete = "new-password";
      input.placeholder = "Yeni portal şifresi";
      input.style.cssText = "width:100%;min-height:46px;border:1px solid #bbd7c4;border-radius:10px;background:#fff;padding:0 72px 0 12px;font-size:14px;outline:none";

      const showButton = document.createElement("button");
      showButton.type = "button";
      showButton.textContent = "Göster";
      showButton.style.cssText = "position:absolute;right:7px;top:7px;height:32px;border:0;border-radius:8px;background:#eef7f1;color:#166534;font-weight:800;cursor:pointer;padding:0 10px";
      showButton.onclick = () => {
        const visible = input.type === "text";
        input.type = visible ? "password" : "text";
        showButton.textContent = visible ? "Göster" : "Gizle";
      };

      const button = document.createElement("button");
      button.type = "button";
      button.textContent = "Kaydet + WhatsApp";
      button.style.cssText = "min-height:46px;border:0;border-radius:10px;background:#16a34a;color:white;font-weight:900;font-size:13px;cursor:pointer;padding:10px 14px;white-space:nowrap";

      const status = document.createElement("small");
      status.style.cssText = "display:none;padding:9px 10px;border-radius:9px;font-weight:750;line-height:1.4";

      button.onclick = async () => {
        if (button.disabled) return;
        const password = input.value.trim();
        if (password.length < 8) {
          status.style.display = "block";
          status.style.background = "#fff1f2";
          status.style.color = "#a33b41";
          status.textContent = "Şifre en az 8 karakter olmalıdır.";
          input.focus();
          return;
        }

        button.disabled = true;
        input.disabled = true;
        showButton.disabled = true;
        button.textContent = "Kaydediliyor…";
        status.style.display = "none";

        const saved = await resetGuardianPortalPassword(studentId, password);
        if (!saved.ok) {
          status.style.display = "block";
          status.style.background = "#fff1f2";
          status.style.color = "#a33b41";
          status.textContent = saved.message || "Portal şifresi kaydedilemedi.";
          button.disabled = false;
          input.disabled = false;
          showButton.disabled = false;
          button.textContent = "Kaydet + WhatsApp";
          return;
        }

        const result = await getGuardianPhoneContact(studentId);
        if (!result.ok) {
          status.style.display = "block";
          status.style.background = "#fff7ed";
          status.style.color = "#9a5a13";
          status.textContent = `${saved.message} Ancak WhatsApp iletişim bilgisi hazırlanamadı.`;
          button.disabled = false;
          input.disabled = false;
          showButton.disabled = false;
          button.textContent = "Tekrar Dene";
          return;
        }

        const phone = cleanPhone(result.guardian.phone);
        if (!phone) {
          status.style.display = "block";
          status.style.background = "#fff7ed";
          status.style.color = "#9a5a13";
          status.textContent = "Şifre kaydedildi. WhatsApp göndermek için veli/kursiyer telefon numarası eklenmelidir.";
          button.disabled = false;
          input.disabled = false;
          showButton.disabled = false;
          button.textContent = "Tekrar Dene";
          return;
        }

        const displayPhone = String(result.guardian.phone || "");
        const message = buildMessage(result.guardian.fullName, displayPhone, password, window.location.origin);
        window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");

        input.value = "";
        input.type = "password";
        showButton.textContent = "Göster";
        status.style.display = "block";
        status.style.background = "#dcfce7";
        status.style.color = "#166534";
        status.textContent = "✓ Portal şifresi kaydedildi. WhatsApp giriş mesajı hazırlandı.";
        button.disabled = false;
        input.disabled = false;
        showButton.disabled = false;
        button.textContent = "Yeni Şifre + WhatsApp";
      };

      inputWrap.append(input, showButton);
      controls.append(inputWrap, button);
      box.append(title, note, controls, status);
      connected.appendChild(box);
    };

    const observer = new MutationObserver(render);
    observer.observe(document.body, { childList: true, subtree: true });
    render();
    return () => {
      observer.disconnect();
      document.querySelector("[data-guardian-activation]")?.remove();
    };
  }, [studentId]);

  return null;
}
