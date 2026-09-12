"use client";

import { useEffect } from "react";

function textOf(element: Element | null) {
  return (element?.textContent || "").replace(/\s+/g, " ").trim();
}

export default function OperationProfessionalEnhancer() {
  useEffect(() => {
    const root = document.querySelector("main");
    if (!root) return;

    const enhance = () => {
      const articles = Array.from(root.querySelectorAll("article"));

      for (const article of articles) {
        if (article.classList.contains("sprintSessionCard")) continue;
        article.classList.add("sprintSessionCard");

        const header = article.querySelector("header");
        if (header instanceof HTMLElement) {
          header.classList.add("sprintSessionHeader");
        }

        const sections = Array.from(article.querySelectorAll("section"));
        let staffSection: HTMLElement | null = null;
        let coachSection: HTMLElement | null = null;
        let studentSection: HTMLElement | null = null;
        let footerSection: HTMLElement | null = null;

        for (const section of sections) {
          if (!(section instanceof HTMLElement)) continue;
          const text = textOf(section);
          if (text.startsWith("Personel Ataması")) staffSection = section;
          if (text.startsWith("Eğitmen Dağılımı")) coachSection = section;
          if (text.startsWith("Öğrenciler")) studentSection = section;
          if (text.includes("Grup Ata / Değiştir") && text.includes("Yoklama Al")) footerSection = section;
        }

        staffSection?.classList.add("sprintStaffAssignment");
        coachSection?.classList.add("sprintCoachDistribution");
        studentSection?.classList.add("sprintStudentSection");
        footerSection?.classList.add("sprintSessionFooter");

        const headerText = textOf(header);
        const articleText = textOf(article);
        const hasCoach = !headerText.includes("0 Eğitmen") && !articleText.includes("Bu seansa henüz eğitmen atanmadı.");
        const hasStudents = !headerText.includes("0 Öğrenci");

        if (header instanceof HTMLElement) {
          const status = document.createElement("div");
          status.className = "sprintSessionStatus";

          const heading = document.createElement("div");
          heading.className = "sprintStatusHeading";
          const title = document.createElement("span");
          title.textContent = "Seans Kontrol Merkezi";
          const subtitle = document.createElement("small");
          subtitle.textContent = "Atama, dağılım ve yoklama tek alanda";
          heading.append(title, subtitle);

          const badges = document.createElement("div");
          badges.className = "sprintStatusBadges";

          const coachBadge = document.createElement("span");
          coachBadge.className = `sprintStatusBadge ${hasCoach ? "ok" : "danger"}`;
          coachBadge.textContent = hasCoach ? "✓ Eğitmen Atandı" : "! Eğitmen Atanmadı";

          const studentBadge = document.createElement("span");
          studentBadge.className = `sprintStatusBadge ${hasStudents ? "ok" : "warn"}`;
          studentBadge.textContent = hasStudents ? "✓ Öğrenciler Hazır" : "! Öğrenci Yok";

          const attendanceBadge = document.createElement("span");
          attendanceBadge.className = "sprintStatusBadge neutral";
          attendanceBadge.textContent = "Yoklama Bekleniyor";

          badges.append(coachBadge, studentBadge, attendanceBadge);
          status.append(heading, badges);
          header.insertAdjacentElement("afterend", status);
        }

        if (staffSection && hasCoach) {
          staffSection.classList.add("isCollapsed");
          const titleRow = staffSection.querySelector("div");
          if (titleRow instanceof HTMLElement) {
            const toggle = document.createElement("button");
            toggle.type = "button";
            toggle.className = "sprintInlineToggle";
            toggle.textContent = "Eğitmeni Değiştir";
            toggle.addEventListener("click", () => {
              staffSection?.classList.toggle("isCollapsed");
              toggle.textContent = staffSection?.classList.contains("isCollapsed") ? "Eğitmeni Değiştir" : "Kapat";
            });
            titleRow.appendChild(toggle);
          }
        }

        if (studentSection) {
          const grid = studentSection.lastElementChild;
          if (grid instanceof HTMLElement) {
            grid.classList.add("sprintStudentGrid");
            const cards = Array.from(grid.children);
            for (const item of cards) {
              if (!(item instanceof HTMLElement)) continue;
              item.classList.add("sprintStudentCard");
              const form = item.querySelector("form");
              if (!(form instanceof HTMLFormElement)) continue;
              form.classList.add("sprintStudentAssignForm");
              const actions = form.parentElement;
              if (!actions) continue;

              const toggle = document.createElement("button");
              toggle.type = "button";
              toggle.className = "sprintStudentEditToggle";
              toggle.textContent = "Atamayı Düzenle";
              toggle.addEventListener("click", () => {
                item.classList.toggle("isEditing");
                toggle.textContent = item.classList.contains("isEditing") ? "Düzenlemeyi Kapat" : "Atamayı Düzenle";
              });
              actions.appendChild(toggle);
            }
          }
        }
      }
    };

    enhance();
    const observer = new MutationObserver(enhance);
    observer.observe(root, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return null;
}
