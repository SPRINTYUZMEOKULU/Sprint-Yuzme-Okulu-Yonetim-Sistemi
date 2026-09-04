"use client";

import { useEffect, useRef, useState } from "react";

function getActionMessage(target: Element) {
  const text = (target.textContent || "").replace(/\s+/g, " ").trim().toLocaleLowerCase("tr-TR");

  if (target.closest("[data-renewal-button='1']") || text.includes("kayıt yenile") || text.includes("onay bekliyor") || text.includes("onaylandı")) {
    return "Kayıt yenileme merkezi açılıyor…";
  }
  if (text.includes("ödeme al")) return "Ödeme alma ekranı açılıyor…";
  if (text.includes("ödeme geçmişi")) return "Ödeme geçmişi açılıyor…";
  if (text.includes("bilgileri düzenle")) return "Öğrenci ve veli bilgileri açılıyor…";
  if (text.includes("grup") || text.includes("şube değiştir")) return "Grup / şube değişikliği açılıyor…";
  if (text.includes("bireysel telafi")) return "Bireysel telafi işlemi açılıyor…";
  if (text.includes("mesaj") || text.includes("whatsapp")) return "Mesaj / WhatsApp işlemi hazırlanıyor…";
  if (text.includes("a4") || text.includes("çıktı")) return "A4 çıktı hazırlanıyor…";
  if (text.includes("sil") || text.includes("arşiv")) return "Silme / arşivleme işlemi açılıyor…";
  if (text.includes("işlemi aç")) {
    const cardText = (target.closest(".smartAlertGrid")?.textContent || target.parentElement?.textContent || "").toLocaleLowerCase("tr-TR");
    if (cardText.includes("ödeme")) return "Ödeme işlemi açılıyor…";
    if (cardText.includes("ders hakkı") || cardText.includes("yenile")) return "Kayıt yenileme işlemi açılıyor…";
    if (cardText.includes("telefon")) return "İletişim bilgileri açılıyor…";
    return "İlgili işlem açılıyor…";
  }

  return "İşlem açılıyor…";
}

export default function StudentActionFeedback() {
  const [message, setMessage] = useState("");
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    const show = (target: Element) => {
      const next = getActionMessage(target);
      setMessage(next);
      if (timerRef.current) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => setMessage(""), 1600);
    };

    const findAction = (target: EventTarget | null) => {
      if (!(target instanceof Element)) return null;
      return target.closest(
        ".fileCommandActions button, .fileCommandActions a, .smartAlertGrid a, .smartAlertGrid button, [data-renewal-button='1']",
      );
    };

    const onPointerDown = (event: PointerEvent) => {
      const action = findAction(event.target);
      if (!action) return;
      show(action);
    };

    const onTouchEnd = (event: TouchEvent) => {
      const action = findAction(event.target);
      if (!action?.closest("[data-renewal-button='1']")) return;

      event.preventDefault();
      event.stopPropagation();
      show(action);
      window.dispatchEvent(new CustomEvent("sprint:open-renewal"));
    };

    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("touchend", onTouchEnd, { capture: true, passive: false });

    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("touchend", onTouchEnd, true);
    };
  }, []);

  return (
    <>
      {message ? (
        <div className="studentActionFeedback" role="status" aria-live="polite">
          <span className="studentActionFeedbackDot" aria-hidden="true" />
          <strong>{message}</strong>
        </div>
      ) : null}

      <style jsx global>{`
        .studentFilePage .fileCommandActions button,
        .studentFilePage .fileCommandActions a,
        .studentFilePage .smartAlertGrid a,
        .studentFilePage .smartAlertGrid button {
          touch-action: manipulation;
          -webkit-tap-highlight-color: transparent;
        }

        .studentActionFeedback {
          position: fixed;
          left: 50%;
          bottom: max(20px, calc(env(safe-area-inset-bottom) + 12px));
          z-index: 2200;
          width: min(430px, calc(100vw - 28px));
          transform: translateX(-50%);
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          min-height: 50px;
          padding: 11px 16px;
          border: 1px solid rgba(255,255,255,.22);
          border-radius: 15px;
          background: rgba(7,31,63,.94);
          color: #fff;
          box-shadow: 0 18px 44px rgba(7,31,63,.28);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          font-family: system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
          font-size: 14px;
          text-align: center;
          pointer-events: none;
          animation: studentActionFeedbackIn .16s ease-out;
        }

        .studentActionFeedbackDot {
          width: 9px;
          height: 9px;
          flex: 0 0 9px;
          border-radius: 999px;
          background: #4ade80;
          box-shadow: 0 0 0 5px rgba(74,222,128,.14);
          animation: studentActionFeedbackPulse .9s ease-in-out infinite alternate;
        }

        @keyframes studentActionFeedbackIn {
          from { opacity: 0; transform: translate(-50%, 10px); }
          to { opacity: 1; transform: translate(-50%, 0); }
        }

        @keyframes studentActionFeedbackPulse {
          from { opacity: .55; }
          to { opacity: 1; }
        }

        @media (max-width: 640px) {
          .studentActionFeedback {
            min-height: 54px;
            bottom: max(16px, calc(env(safe-area-inset-bottom) + 10px));
            font-size: 13px;
            border-radius: 14px;
          }

          .studentFilePage .fileCommandActions button,
          .studentFilePage .fileCommandActions a {
            min-height: 54px !important;
            cursor: pointer !important;
            pointer-events: auto !important;
          }
        }
      `}</style>
    </>
  );
}
