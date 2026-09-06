"use client";

import { useEffect } from "react";

function calculateAgeFromIso(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const birth = new Date(year, month - 1, day);
  if (Number.isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const birthday = new Date(today.getFullYear(), birth.getMonth(), birth.getDate());
  if (today < birthday) age -= 1;
  return age >= 0 ? age : null;
}

function calculateAgeFromDisplay(value: string) {
  const match = value.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (!match) return null;
  return calculateAgeFromIso(`${match[3]}-${match[2]}-${match[1]}`);
}

export default function RegistrationMobileCohesion() {
  useEffect(() => {
    const labels = Array.from(document.querySelectorAll<HTMLElement>(".formGrid label"));
    const birthLabel = labels.find((label) =>
      (label.querySelector(":scope > span")?.textContent || "").trim() === "Doğum Tarihi",
    );
    if (!birthLabel || birthLabel.querySelector(".birthAgeInlineBadge")) return;

    const input = birthLabel.querySelector<HTMLInputElement>("input");
    const title = birthLabel.querySelector<HTMLElement>(":scope > span");
    if (!input || !title) return;

    const age = calculateAgeFromDisplay(input.value.trim());
    if (age === null) return;

    const badge = document.createElement("strong");
    badge.className = "birthAgeInlineBadge";
    badge.textContent = `${age} yaş`;
    badge.setAttribute("aria-label", `Öğrencinin yaşı ${age}`);
    title.append(" ", badge);
  }, []);

  return (
    <style jsx global>{`
      .birthAgeInlineBadge{display:inline-flex;align-items:center;margin-left:7px;padding:3px 8px;border:1px solid #a9cdfc;border-radius:999px;background:#edf6ff;color:#1769e8;font-size:11px;font-weight:900;line-height:1.25;vertical-align:middle}
      @media(max-width:820px){
        .completionPage{width:100%;max-width:100vw;box-sizing:border-box;overflow-x:hidden;padding-left:16px!important;padding-right:16px!important}
        .completionHeader,.registrationShell,.wizardCard,.stickyCommandBar{width:100%;max-width:100%;min-width:0;box-sizing:border-box}
        .registrationShell{grid-template-columns:minmax(0,1fr)!important}
        .wizardCard{grid-column:1/-1!important;padding:18px!important;overflow:hidden}
        .formGrid{grid-template-columns:minmax(0,1fr)!important;width:100%;min-width:0}
        .formGrid label,.formGrid select,.formGrid input{min-width:0;max-width:100%}
        .formGrid select{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding-right:38px}
        .stickyCommandBar{overflow:hidden}
        .commandTabs{width:100%;max-width:100%;overflow-x:auto;flex-wrap:nowrap!important;-webkit-overflow-scrolling:touch;scrollbar-width:none}
        .commandTabs::-webkit-scrollbar{display:none}
        .commandTabs button{flex:0 0 auto}
      }
    `}</style>
  );
}
