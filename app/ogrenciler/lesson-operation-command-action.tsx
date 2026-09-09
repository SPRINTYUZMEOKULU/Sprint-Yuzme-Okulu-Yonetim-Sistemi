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
      aria-label="Ders İptali / Telafi"
    >
      <span className="lessonOperationIcon" aria-hidden="true">↻</span>
      <span className="lessonOperationLabel">Ders İptali / Telafi</span>
    </button>,
    host
  );
}
