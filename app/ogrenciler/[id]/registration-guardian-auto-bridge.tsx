"use client";

import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { autoProvisionGuardianPortal } from "./guardian-auto-provision-actions";
import { sendGuardianActivation } from "./guardian-activation-actions";

function cleanPhone(value?: string | null) {
  let digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("90")) return digits;
  if (digits.startsWith("0")) digits = digits.slice(1);
  return digits.length === 10 ? `90${digits}` : digits;
}

function buildWhatsAppMessage(name: string, email: string, origin: string) {
  return [
    `Merhaba ${name || "Değerli Velimiz"},`,
    "",
    "SPRİNT YÜZME OKULU veli portalı hesabınız hazırlandı.",
    "",
    "Öğrencinizin ders programı, yoklama, ödeme durumu ve duyurularını veli portalından takip edebilirsiniz.",
    "",
    `Güvenli şifre belirleme bağlantısı ${email} adresinize gönderildi.`,
    `Giriş adresi: ${origin}/login`,
    "",
    "E-postadaki bağlantı üzerinden kendi şifrenizi belirleyebilirsiniz.",
    "",
    "SPRİNT YÜZME OKULU",
    "Bilgilendirme Hattı: 0551 896 83 19",
  ].join("\n");
}

export default function RegistrationGuardianAutoBridge({ studentId }: { studentId: string }) {
  const searchParams = useSearchParams();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    if (searchParams.get("saved") !== "registration") return;
    ran.current = true;

    void (async () => {
      const provision = await autoProvisionGuardianPortal(studentId);

      const toast = document.createElement("div");
      toast.style.cssText = "position:fixed;right:18px;bottom:18px;z-index:2500;max-width:390px;padding:14px 16px;border-radius:14px;background:#0b2440;color:white;box-shadow:0 18px 50px rgba(0,0,0,.28);font:600 13px/1.5 system-ui";

      if (!provision.ok) {
        toast.textContent = `Kayıt tamamlandı · Veli portalı: ${provision.message}`;
        document.body.appendChild(toast);
        window.setTimeout(() => toast.remove(), 9000);
        return;
      }

      if (provision.status === "missing_contact" || provision.status === "email_required") {
        toast.textContent = provision.message;
        document.body.appendChild(toast);
        window.setTimeout(() => toast.remove(), 10000);
        return;
      }

      const activation = await sendGuardianActivation(studentId);
      if (!activation.ok) {
        toast.textContent = `${provision.message} ${activation.message}`;
        document.body.appendChild(toast);
        window.setTimeout(() => toast.remove(), 10000);
        return;
      }

      toast.textContent = `${provision.message} Aktivasyon e-postası gönderildi.`;
      document.body.appendChild(toast);
      window.setTimeout(() => toast.remove(), 10000);

      const phone = cleanPhone(activation.guardian.phone);
      if (!phone) return;

      const message = buildWhatsAppMessage(
        activation.guardian.fullName,
        activation.guardian.email,
        window.location.origin,
      );

      const action = document.createElement("button");
      action.type = "button";
      action.textContent = "WhatsApp’tan Bilgilendir";
      action.style.cssText = "display:block;margin-top:10px;width:100%;min-height:40px;border:0;border-radius:10px;background:#16a34a;color:white;font-weight:900;cursor:pointer";
      action.onclick = () => window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
      toast.appendChild(action);
    })();
  }, [searchParams, studentId]);

  return null;
}
