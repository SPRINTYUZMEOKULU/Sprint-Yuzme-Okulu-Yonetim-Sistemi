"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export default function FirstLessonStartEnhancer() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname !== "/baslayacak-kursiyerler") return;

    const controller = new AbortController();
    const { signal } = controller;

    function enhance() {
      const groups = Array.from(document.querySelectorAll<HTMLElement>(".startingGroup"));

      for (const group of groups) {
        const title = group.querySelector("h2")?.textContent?.trim() || "";
        const isTodayGroup = title.includes("Bugün");
        if (!isTodayGroup) continue;

        const cards = Array.from(group.querySelectorAll<HTMLElement>(".startingStudentCard"));
        for (const card of cards) {
          if (card.dataset.firstLessonEnhanced === "1") continue;

          const fileLink = card.querySelector<HTMLAnchorElement>('a[href^="/ogrenciler/"]');
          const actionLinks = Array.from(card.querySelectorAll<HTMLAnchorElement>(".startingStudentActions a"));
          const actionLink = actionLinks.find((link) => link !== fileLink);
          const studentId = fileLink?.getAttribute("href")?.split("/").filter(Boolean).pop() || "";

          if (!actionLink || !studentId) continue;

          card.dataset.firstLessonEnhanced = "1";
          actionLink.textContent = "İlk Derse Başlat";
          actionLink.classList.add("firstLessonStartAction");
          actionLink.setAttribute("href", "#");
          actionLink.setAttribute("role", "button");

          actionLink.addEventListener(
            "click",
            async (event) => {
              event.preventDefault();
              if (actionLink.dataset.busy === "1") return;

              const original = "İlk Derse Başlat";
              actionLink.dataset.busy = "1";
              actionLink.textContent = "Başlatılıyor…";
              actionLink.setAttribute("aria-disabled", "true");

              try {
                const response = await fetch("/api/first-lesson-start", {
                  method: "POST",
                  credentials: "same-origin",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ studentId }),
                });
                const result = await response.json().catch(() => ({}));

                if (!response.ok || !result?.ok) {
                  window.alert(result?.error || "İlk ders başlatılamadı.");
                  actionLink.textContent = original;
                  actionLink.dataset.busy = "0";
                  actionLink.removeAttribute("aria-disabled");
                  return;
                }

                actionLink.textContent = "✓ İlk Ders Başlatıldı";
                card.style.opacity = "0.55";
                card.style.pointerEvents = "none";
                window.setTimeout(() => window.location.reload(), 500);
              } catch {
                window.alert("İşlem sırasında bağlantı hatası oluştu.");
                actionLink.textContent = original;
                actionLink.dataset.busy = "0";
                actionLink.removeAttribute("aria-disabled");
              }
            },
            { signal },
          );
        }
      }
    }

    enhance();
    const observer = new MutationObserver(enhance);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      controller.abort();
      observer.disconnect();
    };
  }, [pathname]);

  if (pathname !== "/baslayacak-kursiyerler") return null;

  return (
    <style jsx global>{`
      .startingStudentActions a.firstLessonStartAction {
        background: linear-gradient(135deg, #1674ed, #0f62d7) !important;
        border-color: #0f62d7 !important;
        color: #fff !important;
        box-shadow: 0 7px 18px rgba(22, 116, 237, 0.2);
        text-align: center;
        justify-content: center;
      }
      .startingStudentActions a.firstLessonStartAction[aria-disabled="true"] {
        opacity: 0.72;
        cursor: wait;
      }
    `}</style>
  );
}
