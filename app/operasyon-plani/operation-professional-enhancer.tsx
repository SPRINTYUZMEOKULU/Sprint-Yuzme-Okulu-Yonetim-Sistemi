"use client";

import { useEffect } from "react";

function normalize(value?: string | null) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

export default function OperationProfessionalEnhancer() {
  useEffect(() => {
    const root = document.querySelector("main");
    if (!root) return;

    const enhance = () => {
      const articles = Array.from(root.querySelectorAll("article"));

      articles.forEach((article) => {
        if (article.classList.contains("sprintSessionCard")) return;
        article.classList.add("sprintSessionCard");

        const header = article.querySelector(":scope > header") as HTMLElement | null;
        if (header) header.classList.add("sprintSessionHeader");

        const sections = Array.from(article.querySelectorAll("section"));
        let coachSection: HTMLElement | null = null;
        let studentSection: HTMLElement | null = null;
        let staffAssignSection: HTMLElement | null = null;
        let footerSection: HTMLElement | null = null;

        sections.forEach((section) => {
          const text = normalize(section.textContent);
          if (text.startsWith("Personel Ataması")) staffAssignSection = section as HTMLElement;
          if (text.startsWith("Eğitmen Dağılımı")) coachSection = section as HTMLElement;
          if (text.startsWith("Öğrenciler")) studentSection = section as HTMLElement;
          if (text.includes("Grup Ata / Değiştir") && text.includes("Yoklama Al")) footerSection = section as HTMLElement;
        });

        staffAssignSection?.classList.add("sprintStaffAssignment");
        coachSection?.classList.add("sprintCoachDistribution");
        studentSection?.classList.add("sprintStudentSection");
        footerSection?.classList.add("sprintSessionFooter");

        const stats = header ? Array.from(header.querySelectorAll("strong")) : [];
        const headerText = normalize(header?.textContent);
        const hasCoach = !headerText.includes("0 Eğitmen") && !normalize(article.textContent).includes("Bu seansa henüz eğitmen atanmadı.");
        const hasStudents = !headerText.includes("0 Öğrenci");

        const status = document.createElement("div");
        status.className = "sprintSessionStatus";
        status.innerHTML = `
          <div class="sprintStatusHeading">
            <span>Seans Kontrol Merkezi</span>
            <small>Atama, dağılım ve yoklama tek alanda</small>
          </div>
          <div class="sprintStatusBadges">
            <span class="sprintStatusBadge ${hasCoach ? "ok" : "danger"}">${hasCoach ? "✓ Eğitmen Atandı" : "! Eğitmen Atanmadı"}</span>
            <span class="sprintStatusBadge ${hasStudents ? "ok" : "warn"}">${hasStudents ? "✓ Öğrenciler Hazır" : "! Öğrenci Yok"}</span>
            <span class="sprintStatusBadge neutral">Yoklama Bekleniyor</span>
          </div>
        `;
        if (header) header.insertAdjacentElement("afterend", status);

        if (staffAssignSection && hasCoach) {
          staffAssignSection.classList.add("isCollapsed");
          const title = staffAssignSection.querySelector("div");
          if (title) {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "sprintInlineToggle";
            button.textContent = "Eğitmeni Değiştir";
            button.addEventListener("click", () => {
              staffAssignSection?.classList.toggle("isCollapsed");
              button.textContent = staffAssignSection?.classList.contains("isCollapsed") ? "Eğitmeni Değiştir" : "Kapat";
            });
            title.appendChild(button);
          }
        }

        if (studentSection) {
          const grid = studentSection.querySelector(":scope > div:last-child") as HTMLElement | null;
          if (grid) grid.classList.add("sprintStudentGrid");

          const cards = grid ? Array.from(grid.children) as HTMLElement[] : [];
          cards.forEach((card) => {
            card.classList.add("sprintStudentCard");
            const forms = Array.from(card.querySelectorAll("form"));
            forms.forEach((form) => form.classList.add("sprintStudentAssignForm"));

            if (forms.length > 0 && !card.querySelector(".sprintStudentEditToggle")) {
              const actions = forms[0].parentElement;
              if (actions) {
                const toggle = document.createElement("button");
                toggle.type = "button";
                toggle.className = "sprintStudentEditToggle";
                toggle.textContent = "Atamayı Düzenle";
                toggle.addEventListener("click", () => {
                  card.classList.toggle("isEditing");
                  toggle.textContent = card.classList.contains("isEditing") ? "Düzenlemeyi Kapat" : "Atamayı Düzenle";
                });
                actions.appendChild(toggle);
              }
            }
          });
        }
      });
    };

    enhance();
    const observer = new MutationObserver(() => enhance());
    observer.observe(root, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return null;
}
