"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";

function findStudentId(input: HTMLInputElement) {
  let node: HTMLElement | null = input;

  for (let depth = 0; depth < 9 && node; depth += 1) {
    const directId = node.getAttribute("data-student-id");
    if (directId) return directId;

    const link = node.querySelector<HTMLAnchorElement>('a[href^="/ogrenciler/"]');
    const href = link?.getAttribute("href") || "";
    const match = href.match(/^\/ogrenciler\/([0-9a-f-]{36})(?:[?#]|$)/i);
    if (match?.[1]) return match[1];

    node = node.parentElement;
  }

  return "";
}

function selectedStudentIdsFromPage() {
  const checked = Array.from(
    document.querySelectorAll<HTMLInputElement>('input[type="checkbox"]:checked[aria-label$=" seç"]')
  );

  return Array.from(new Set(checked.map(findStudentId).filter(Boolean)));
}

export default function LessonOperationCommandAction() {
  const router = useRouter();
  const [host, setHost] = useState<Element | null>(null);

  useEffect(() => {
    // Öğrenci Merkezi kendi React ağacını yönetsin; mevcut düğümleri taşımıyoruz.
    // Sadece mevcut aksiyon grubuna güvenli bir React portalı açıyoruz.
    setHost(document.querySelector(".studentCommandHeader .commandActions"));
  }, []);

  if (!host) return null;

  function openOperations() {
    const selectedIds = selectedStudentIdsFromPage();

    if (selectedIds.length) {
      document.cookie = `sprintos-lesson-operation-students=${encodeURIComponent(selectedIds.join(","))}; path=/; max-age=1800; samesite=lax`;
    } else {
      document.cookie = "sprintos-lesson-operation-students=; path=/; max-age=0; samesite=lax";
    }

    const query = selectedIds.length
      ? `?studentIds=${encodeURIComponent(selectedIds.join(","))}`
      : "";

    router.push(`/ders-operasyonlari${query}`);
  }

  return createPortal(
    <button
      type="button"
      className="commandButton lessonOperationCommandButton"
      onClick={openOperations}
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
