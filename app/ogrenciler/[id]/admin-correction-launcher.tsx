"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";

export default function AdminCorrectionLauncher({ studentId }: { studentId: string }) {
  const router = useRouter();
  const [host, setHost] = useState<Element | null>(null);

  useEffect(() => {
    setHost(document.querySelector(".fileCommandActions"));
  }, []);

  if (!host) return null;

  return createPortal(
    <>
      <button
        type="button"
        className="securePaymentButton"
        onClick={() => router.push(`/odeme-bilgileri?studentId=${encodeURIComponent(studentId)}&mode=secure`)}
        title="Belge bilgisi ve güvenli ödeme bağlantısı oluştur"
      >
        <span className="securePaymentIcon" aria-hidden="true">✓</span>
        <span className="securePaymentText">
          <b>Güvenli Ödeme</b>
          <small>Belge bilgisi + ödeme linki</small>
        </span>
      </button>

      <button
        type="button"
        className="adminCorrectionButton"
        onClick={() => router.push(`/ogrenciler/${studentId}/duzeltme`)}
        title="Kesinleşmiş kayıt verilerini yönetici yetkisiyle düzelt"
      >
        <span aria-hidden="true">🔒</span>
        Yönetici Düzeltme
      </button>

      <style jsx>{`
        .securePaymentButton {
          background: #eefaf4 !important;
          border-color: #9ed9ba !important;
          color: #087443 !important;
          font-weight: 900 !important;
          min-height: 54px !important;
        }
        .securePaymentButton:hover {
          background: #e2f7ec !important;
          border-color: #70c899 !important;
        }
        .securePaymentIcon {
          display: grid;
          place-items: center;
          width: 28px;
          height: 28px;
          flex: 0 0 28px;
          border-radius: 9px;
          background: #0a9b53;
          color: #fff;
          font-size: 15px;
          font-weight: 900;
        }
        .securePaymentText {
          display: grid;
          gap: 2px;
          text-align: left;
          line-height: 1.08;
        }
        .securePaymentText b {
          font-size: 12px;
        }
        .securePaymentText small {
          color: #56856c;
          font-size: 9px;
          font-weight: 700;
        }
        .adminCorrectionButton {
          background: #fff7e8 !important;
          border-color: #e8bb69 !important;
          color: #7a4a00 !important;
          font-weight: 900 !important;
        }
        .adminCorrectionButton:hover {
          background: #ffefcf !important;
        }
      `}</style>
    </>,
    host
  );
}
