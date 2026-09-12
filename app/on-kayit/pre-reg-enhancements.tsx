"use client";

import { useEffect } from "react";

export default function PreRegEnhancements() {
  useEffect(() => {
    const rulesContent = document.querySelector(".rulesContent");
    if (!rulesContent || rulesContent.querySelector("[data-refund-rule]")) return;

    const rule = document.createElement("p");
    rule.setAttribute("data-refund-rule", "true");
    rule.className = "criticalCourseRule";
    rule.innerHTML = "<strong>7. İptal ve ücret iadesi:</strong> Kesin kaydı tamamlanarak kursa başlayan öğrenci / katılımcı için kurs iptali ve ücret iadesi yapılmaz. Başlanan kurs paketi başka bir döneme devredilemez ve kullanılmayan dersler için ücret iadesi talep edilemez.";
    rulesContent.appendChild(rule);
  }, []);

  return (
    <style jsx global>{`
      .selectedGroupCard {
        position: relative;
        overflow: hidden;
        border: 2px solid #176de9 !important;
        background: linear-gradient(135deg, #eef6ff 0%, #ffffff 72%) !important;
        box-shadow: 0 12px 30px rgba(23, 109, 233, .16), 0 0 0 4px rgba(23, 109, 233, .07);
        animation: selectedGroupGlow 2.1s ease-in-out infinite;
      }

      .selectedGroupCard::before {
        content: "✓ SEÇİMİNİZ";
        position: absolute;
        top: 0;
        right: 0;
        padding: 7px 11px;
        border-radius: 0 13px 0 12px;
        background: #176de9;
        color: #fff;
        font-size: 9px;
        font-weight: 900;
        letter-spacing: .08em;
      }

      .selectedGroupCard > div:first-child > span {
        font-size: 11px !important;
        color: #075fd7 !important;
      }

      .selectedGroupCard > div:first-child > strong {
        font-size: 21px !important;
        color: #0b2b59 !important;
      }

      .selectedSchedule span {
        border-color: #bcd5fa !important;
        box-shadow: 0 3px 10px rgba(23, 109, 233, .06);
      }

      .criticalCourseRule {
        margin: 12px 0 0 !important;
        padding: 12px 13px;
        border: 1px solid #fecaca;
        border-radius: 11px;
        background: #fff7f7;
        color: #7f1d1d !important;
      }

      .criticalCourseRule strong {
        color: #b91c1c;
      }

      @keyframes selectedGroupGlow {
        0%, 100% {
          box-shadow: 0 12px 30px rgba(23, 109, 233, .14), 0 0 0 3px rgba(23, 109, 233, .06);
        }
        50% {
          box-shadow: 0 15px 36px rgba(23, 109, 233, .22), 0 0 0 7px rgba(23, 109, 233, .11);
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .selectedGroupCard { animation: none !important; }
      }
    `}</style>
  );
}
