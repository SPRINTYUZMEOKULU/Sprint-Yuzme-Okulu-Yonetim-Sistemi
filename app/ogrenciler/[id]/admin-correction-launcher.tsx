"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter } from "next/navigation";

export default function AdminCorrectionLauncher({ studentId }: { studentId: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [host, setHost] = useState<Element | null>(null);

  useEffect(() => {
    // [id] layout alt rotalarda kalıcıdır. Düzeltme ekranına gidip geri
    // dönüldüğünde eski/detached .fileCommandActions referansını kullanma.
    setHost(document.querySelector(".studentFilePage .fileCommandActions"));
  }, [pathname]);

  if (!host) return null;

  return createPortal(
    <>
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
