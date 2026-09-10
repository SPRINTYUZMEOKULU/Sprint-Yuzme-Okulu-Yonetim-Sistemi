"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

function isoDate(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function addDays(days: number) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return isoDate(date);
}

export default function FirstLessonStartEnhancer() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname !== "/baslayacak-kursiyerler") return;

    const controller = new AbortController();
    const { signal } = controller;

    function closeModal() {
      document.querySelector(".firstLessonRescheduleModal")?.remove();
    }

    function openReschedule(studentId: string, studentName: string) {
      closeModal();
      const overlay = document.createElement("div");
      overlay.className = "firstLessonRescheduleModal";
      overlay.innerHTML = `
        <div class="flrCard" role="dialog" aria-modal="true" aria-label="Başlangıç tarihini değiştir">
          <div class="flrHead">
            <div><small>İLK DERS PLANI</small><h3>Başlangıç Tarihini Değiştir</h3><p>${studentName}</p></div>
            <button type="button" class="flrClose" aria-label="Kapat">×</button>
          </div>
          <div class="flrQuick">
            <button type="button" data-days="1">Yarın</button>
            <button type="button" data-days="7">+1 Hafta</button>
          </div>
          <label class="flrLabel">Yeni başlangıç tarihi<input class="flrDate" type="date" min="${addDays(0)}" value="${addDays(1)}"></label>
          <label class="flrLabel">Not <input class="flrReason" type="text" maxlength="500" value="Kursiyer talebiyle başlangıç tarihi değiştirildi."></label>
          <div class="flrInfo">Kaydedildiğinde ilk ders listesi ve planlanan bitiş tarihi yeni başlangıca göre yeniden hesaplanır.</div>
          <div class="flrActions"><button type="button" class="flrCancel">Vazgeç</button><button type="button" class="flrSave">Tarihi Güncelle</button></div>
          <div class="flrStatus" aria-live="polite"></div>
        </div>`;
      document.body.appendChild(overlay);

      const dateInput = overlay.querySelector<HTMLInputElement>(".flrDate")!;
      const reasonInput = overlay.querySelector<HTMLInputElement>(".flrReason")!;
      const save = overlay.querySelector<HTMLButtonElement>(".flrSave")!;
      const status = overlay.querySelector<HTMLElement>(".flrStatus")!;

      overlay.querySelector(".flrClose")?.addEventListener("click", closeModal, { signal });
      overlay.querySelector(".flrCancel")?.addEventListener("click", closeModal, { signal });
      overlay.addEventListener("click", (event) => { if (event.target === overlay) closeModal(); }, { signal });
      overlay.querySelectorAll<HTMLButtonElement>("[data-days]").forEach((button) => {
        button.addEventListener("click", () => { dateInput.value = addDays(Number(button.dataset.days || 1)); }, { signal });
      });

      save.addEventListener("click", async () => {
        if (!dateInput.value || save.dataset.busy === "1") return;
        save.dataset.busy = "1";
        save.textContent = "Güncelleniyor…";
        status.textContent = "";
        try {
          const response = await fetch("/api/starting-students/reschedule", {
            method: "POST",
            credentials: "same-origin",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ studentId, startDate: dateInput.value, reason: reasonInput.value }),
          });
          const result = await response.json().catch(() => ({}));
          if (!response.ok || !result?.ok) {
            status.textContent = result?.error || "Başlangıç tarihi güncellenemedi.";
            status.className = "flrStatus error";
            save.dataset.busy = "0";
            save.textContent = "Tarihi Güncelle";
            return;
          }
          status.textContent = "✓ Başlangıç tarihi güncellendi";
          status.className = "flrStatus success";
          window.setTimeout(() => window.location.reload(), 550);
        } catch {
          status.textContent = "Bağlantı hatası oluştu.";
          status.className = "flrStatus error";
          save.dataset.busy = "0";
          save.textContent = "Tarihi Güncelle";
        }
      }, { signal });
    }

    function enhance() {
      const groups = Array.from(document.querySelectorAll<HTMLElement>(".startingGroup"));

      for (const group of groups) {
        const title = group.querySelector("h2")?.textContent?.trim() || "";
        const isTodayGroup = title.includes("Bugün");
        const cards = Array.from(group.querySelectorAll<HTMLElement>(".startingStudentCard"));

        for (const card of cards) {
          const fileLink = card.querySelector<HTMLAnchorElement>('a[href^="/ogrenciler/"]');
          const studentId = fileLink?.getAttribute("href")?.split("/").filter(Boolean).pop() || "";
          const studentName = card.querySelector("h3")?.textContent?.trim() || "Kursiyer";
          const actions = card.querySelector<HTMLElement>(".startingStudentActions");
          if (!actions || !studentId) continue;

          if (!card.querySelector(".firstLessonRescheduleAction")) {
            const reschedule = document.createElement("button");
            reschedule.type = "button";
            reschedule.className = "firstLessonRescheduleAction";
            reschedule.textContent = "Başlangıcı Değiştir";
            reschedule.addEventListener("click", () => openReschedule(studentId, studentName), { signal });
            actions.appendChild(reschedule);
          }

          if (!isTodayGroup || card.dataset.firstLessonEnhanced === "1") continue;

          const actionLinks = Array.from(actions.querySelectorAll<HTMLAnchorElement>("a"));
          const actionLink = actionLinks.find((link) => link !== fileLink);
          if (!actionLink) continue;

          card.dataset.firstLessonEnhanced = "1";
          actionLink.textContent = "İlk Derse Başlat";
          actionLink.classList.add("firstLessonStartAction");
          actionLink.setAttribute("href", "#");
          actionLink.setAttribute("role", "button");

          actionLink.addEventListener("click", async (event) => {
            event.preventDefault();
            if (actionLink.dataset.busy === "1") return;
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
                actionLink.textContent = "İlk Derse Başlat";
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
              actionLink.textContent = "İlk Derse Başlat";
              actionLink.dataset.busy = "0";
              actionLink.removeAttribute("aria-disabled");
            }
          }, { signal });
        }
      }
    }

    enhance();
    const observer = new MutationObserver(enhance);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      closeModal();
      controller.abort();
      observer.disconnect();
    };
  }, [pathname]);

  if (pathname !== "/baslayacak-kursiyerler") return null;

  return (
    <style jsx global>{`
      .startingStudentActions{flex-wrap:wrap!important}
      .startingStudentActions a.firstLessonStartAction{background:linear-gradient(135deg,#1674ed,#0f62d7)!important;border-color:#0f62d7!important;color:#fff!important;box-shadow:0 7px 18px rgba(22,116,237,.2);text-align:center;justify-content:center}
      .startingStudentActions a.firstLessonStartAction[aria-disabled="true"]{opacity:.72;cursor:wait}
      .firstLessonRescheduleAction{min-height:40px;padding:0 13px;border:1px solid #d5e1ef;border-radius:11px;background:#fff;color:#385574;font:800 12px system-ui;cursor:pointer}
      .firstLessonRescheduleAction:hover{background:#f6f9fd;border-color:#a9c8ef}
      .firstLessonRescheduleModal{position:fixed;z-index:5000;inset:0;display:grid;place-items:center;padding:18px;background:rgba(7,24,48,.52);backdrop-filter:blur(4px)}
      .flrCard{width:min(94vw,520px);padding:22px;border:1px solid #d7e4f2;border-radius:22px;background:#fff;box-shadow:0 28px 80px rgba(7,24,48,.28);font-family:system-ui;color:#10284d}
      .flrHead{display:flex;justify-content:space-between;gap:16px}.flrHead small{display:block;color:#1674ed;font-size:10px;font-weight:950;letter-spacing:.12em}.flrHead h3{margin:4px 0 3px;font-size:22px}.flrHead p{margin:0;color:#6f829a;font-size:13px}.flrClose{width:38px;height:38px;border:1px solid #dce6f1;border-radius:12px;background:#fff;color:#4b617c;font-size:24px;cursor:pointer}.flrQuick{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin:18px 0 12px}.flrQuick button{min-height:44px;border:1px solid #cfe0f5;border-radius:12px;background:#f6faff;color:#1769d9;font-weight:900;cursor:pointer}.flrLabel{display:grid;gap:6px;margin-top:10px;color:#536a85;font-size:11px;font-weight:850}.flrLabel input{height:44px;padding:0 12px;border:1px solid #d4e0ec;border-radius:11px;background:#fff;color:#10284d;font:700 13px system-ui}.flrInfo{margin-top:12px;padding:11px 12px;border-radius:12px;background:#f5f8fc;color:#6d8097;font-size:11px;line-height:1.45}.flrActions{display:grid;grid-template-columns:1fr 1.4fr;gap:9px;margin-top:16px}.flrActions button{min-height:46px;border-radius:12px;font-weight:900;cursor:pointer}.flrCancel{border:1px solid #d7e1ec;background:#fff;color:#52677f}.flrSave{border:1px solid #1266d8;background:#1674ed;color:#fff}.flrStatus{min-height:18px;margin-top:10px;text-align:center;font-size:12px;font-weight:800}.flrStatus.error{color:#b42318}.flrStatus.success{color:#168254}
      @media(max-width:640px){.flrCard{padding:17px;border-radius:18px}.flrActions{grid-template-columns:1fr}.firstLessonRescheduleAction{width:100%}}
    `}</style>
  );
}
