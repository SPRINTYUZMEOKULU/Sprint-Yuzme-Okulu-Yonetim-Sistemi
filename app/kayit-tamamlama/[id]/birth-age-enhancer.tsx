"use client";

import { useEffect } from "react";

function calculateAge(dateText: string) {
  const match = dateText.match(/(\d{2})\.(\d{2})\.(\d{4})/);
  if (!match) return null;

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  if (!day || !month || !year) return null;

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const birth = new Date(year, month - 1, day);
  if (Number.isNaN(birth.getTime()) || birth > today) return null;

  let age = today.getFullYear() - birth.getFullYear();
  const birthdayThisYear = new Date(today.getFullYear(), birth.getMonth(), birth.getDate());
  if (today < birthdayThisYear) age -= 1;

  return age >= 0 ? age : null;
}

export default function BirthAgeEnhancer() {
  useEffect(() => {
    const header = document.querySelector<HTMLElement>(".completionHeader .headerIdentity p");
    if (!header || header.querySelector(".studentAgeBadge")) return;

    const text = header.textContent || "";
    const birthMatch = text.match(/Doğum Tarihi:\s*(\d{2}\.\d{2}\.\d{4})/i);
    if (!birthMatch) return;

    const age = calculateAge(birthMatch[1]);
    if (age === null) return;

    const badge = document.createElement("span");
    badge.className = "studentAgeBadge";
    badge.textContent = `(${age} yaşında)`;
    badge.setAttribute("aria-label", `Öğrenci yaşı: ${age}`);
    header.append(" ", badge);
  }, []);

  return (
    <style jsx global>{`
      .studentAgeBadge {
        display: inline-flex;
        align-items: center;
        margin-left: 6px;
        padding: 4px 9px;
        border-radius: 999px;
        background: #e8f3ff;
        border: 1px solid #b8d7fb;
        color: #1267c8;
        font-size: 0.9em;
        font-weight: 800;
        line-height: 1.2;
        white-space: nowrap;
        vertical-align: middle;
      }
    `}</style>
  );
}
