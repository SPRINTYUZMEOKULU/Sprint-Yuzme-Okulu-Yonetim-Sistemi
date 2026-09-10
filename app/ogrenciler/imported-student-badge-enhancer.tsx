"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

type ImportedStudent = {
  id: string;
  studentNumber: string | null;
  status: string | null;
};

export default function ImportedStudentBadgeEnhancer() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname !== "/ogrenciler") return;

    let disposed = false;
    let observer: MutationObserver | null = null;

    async function start() {
      try {
        const response = await fetch("/api/imported-students", {
          cache: "no-store",
          credentials: "same-origin",
        });
        const result = await response.json();

        if (!response.ok || !result.ok || disposed) return;

        const imported = (result.students || []) as ImportedStudent[];
        const importedNumbers = new Set(
          imported
            .map((student) => String(student.studentNumber || "").trim())
            .filter(Boolean),
        );

        function decorate() {
          document.querySelectorAll<HTMLElement>(".studentCard").forEach((card) => {
            if (card.querySelector(".systemImportedBadge")) return;

            const eyebrow = card.querySelector<HTMLElement>(".eyebrow");
            const statusBadge = card.querySelector<HTMLElement>(".statusBadge");
            if (!eyebrow || !statusBadge) return;

            const text = eyebrow.textContent || "";
            const matchedNumber = Array.from(importedNumbers).find((number) =>
              text.includes(number),
            );
            if (!matchedNumber) return;

            const badge = document.createElement("span");
            badge.className = "systemImportedBadge";
            badge.textContent = "Sistemden Aktarılan";
            badge.title = "Bu kursiyer mevcut sistemden SprintOS'a aktarılmıştır.";
            statusBadge.insertAdjacentElement("afterend", badge);
          });
        }

        decorate();

        observer = new MutationObserver(() => decorate());
        observer.observe(document.body, { childList: true, subtree: true });
      } catch (error) {
        console.error("Aktarılan öğrenci etiketi yüklenemedi:", error);
      }
    }

    void start();

    return () => {
      disposed = true;
      observer?.disconnect();
    };
  }, [pathname]);

  if (pathname !== "/ogrenciler") return null;

  return (
    <style jsx global>{`
      .studentCard .cardHeader > .systemImportedBadge {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 30px;
        margin-left: 7px;
        padding: 6px 10px;
        border: 1px solid #bfd7f5;
        border-radius: 999px;
        background: #edf5ff;
        color: #1765c1;
        font-size: 10px;
        font-weight: 900;
        line-height: 1;
        white-space: nowrap;
        letter-spacing: .01em;
      }

      @media (max-width: 760px) {
        .studentCard .cardHeader > .systemImportedBadge {
          min-height: 28px;
          margin-left: 4px;
          padding: 5px 8px;
          font-size: 9px;
        }
      }
    `}</style>
  );
}
