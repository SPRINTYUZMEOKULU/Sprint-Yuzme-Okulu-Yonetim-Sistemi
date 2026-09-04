"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";

export default function LessonOperationCommandAction() {
  const router = useRouter();
  const [host, setHost] = useState<Element | null>(null);

  useEffect(() => {
    // Öğrenci Merkezi kendi React ağacını yönetsin; mevcut düğümleri taşımıyoruz.
    // Sadece mevcut aksiyon grubuna güvenli bir React portalı açıyoruz.
    setHost(document.querySelector(".studentCommandHeader .commandActions"));
  }, []);

  if (!host) return null;

  return createPortal(
    <button
      type="button"
      className="commandButton lessonOperationCommandButton"
      onClick={() => router.push("/ders-operasyonlari")}
      title="Havuz kapanışı, ders iptali ve toplu telafi işlemleri"
    >
      <span className="lessonOperationIcon" aria-hidden="true">↻</span>
      <span>Ders İptali / Telafi</span>
      <style jsx>{`
        .lessonOperationCommandButton {
          background: rgba(255,255,255,.12) !important;
          border-color: rgba(255,255,255,.30) !important;
          color: #fff !important;
        }
        .lessonOperationCommandButton:hover {
          background: rgba(255,255,255,.20) !important;
          border-color: rgba(255,255,255,.46) !important;
        }
        .lessonOperationIcon {
          width: 21px;
          height: 21px;
          display: inline-grid;
          place-items: center;
          border: 1px solid rgba(255,255,255,.38);
          border-radius: 7px;
          font-size: 16px;
          line-height: 1;
          font-weight: 900;
        }
        @media (max-width: 720px) {
          .lessonOperationCommandButton { min-width: 0; }
        }
      `}</style>
    </button>,
    host
  );
}
