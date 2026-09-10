"use client";

import { useEffect } from "react";

type StudentLite = {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
  guardian_name?: string | null;
  guardian_phone?: string | null;
};

type Props = { students: StudentLite[] };

const cleanPhone = (value?: string | null) => (value || "").replace(/\D/g, "");
const waPhone = (value: string) => {
  if (value.startsWith("90")) return value;
  if (value.startsWith("0")) return `90${value.slice(1)}`;
  return value.length === 10 ? `90${value}` : value;
};
const fullName = (s?: StudentLite) =>
  s ? `${s.first_name || ""} ${s.last_name || ""}`.trim() || "Kursiyer" : "Kursiyer";

export default function AttendanceRenewalEnhancer({ students }: Props) {
  useEffect(() => {
    const map = new Map(students.map((s) => [s.id, s]));
    let working = false;

    const enhance = () => {
      if (working) return;
      working = true;
      try {
        document.querySelectorAll<HTMLTableRowElement>(".saTableWrap tbody tr").forEach((row) => {
          const studentLink = row.querySelector<HTMLAnchorElement>("a.saStudent[href*='/ogrenciler/']");
          const enrollment = row.querySelector<HTMLElement>(".saEnrollment");
          const actions = row.querySelector<HTMLElement>(".saActions");
          if (!studentLink || !enrollment || !actions) return;

          const match = studentLink.getAttribute("href")?.match(/\/ogrenciler\/([^/?#]+)/);
          const studentId = match?.[1] || "";
          if (!studentId) return;
          const student = map.get(studentId);

          const enrollmentText = enrollment.textContent || "";
          const remainingMatch = enrollmentText.match(/(\d+)\s*ders\s*kaldı/i);
          const remaining = remainingMatch ? Number(remainingMatch[1]) : null;
          const isCompensation = /telafi dersi/i.test(enrollmentText);
          if (isCompensation || remaining === null) return;

          const present = !!row.querySelector(".saStatus button.active.present, .saStatus button.active.compensation");
          const renewalNeeded = remaining <= 0 || (remaining === 1 && present);
          const lastLesson = remaining === 1;

          row.classList.toggle("saRenewalLastLesson", lastLesson && !renewalNeeded);
          row.classList.toggle("saRenewalNeeded", renewalNeeded);

          let badge = row.querySelector<HTMLElement>("[data-renewal-attendance-badge]");
          if (lastLesson || renewalNeeded) {
            if (!badge) {
              badge = document.createElement("div");
              badge.dataset.renewalAttendanceBadge = "1";
              enrollment.prepend(badge);
            }
            badge.className = `saRenewalBadge ${renewalNeeded ? "needed" : "last"}`;
            badge.textContent = renewalNeeded ? "↻ KAYIT YENİLEME GEREKLİ" : "● SON DERS";
          } else badge?.remove();

          let panel = row.querySelector<HTMLElement>("[data-renewal-attendance-panel]");
          if (!renewalNeeded) {
            panel?.remove();
            return;
          }

          if (!panel) {
            panel = document.createElement("div");
            panel.dataset.renewalAttendancePanel = "1";
            panel.className = "saRenewalPanel";
            panel.innerHTML = `
              <div class="saRenewalPanelText">
                <strong>Kayıt yenilenmesi gerekiyor</strong>
                <span>Son ders tamamlandı. Yeni dönem kaydını açın ve veliye bilgi verin.</span>
              </div>
              <div class="saRenewalPanelActions">
                <button type="button" data-renewal-message>Veliye Mesaj</button>
                <a data-renewal-open href="/ogrenciler/${studentId}?renewalOpen=1">↻ Kaydı Yenile</a>
              </div>`;
            const target = row.querySelector<HTMLElement>("td[data-label='Kayıt']") || actions.parentElement;
            target?.appendChild(panel);

            panel.querySelector<HTMLButtonElement>("[data-renewal-message]")?.addEventListener("click", () => {
              const raw = cleanPhone(student?.guardian_phone || student?.phone);
              if (!raw) {
                window.alert("Veli/öğrenci telefon numarası bulunamadı.");
                return;
              }
              const name = fullName(student);
              const text = `Değerli velimiz,\n\n${name} isimli kursiyerimizin mevcut ders paketindeki son dersi tamamlanmıştır. Öğrencimiz bugün dersimize katılım sağlamıştır. Eğitimine ara vermeden devam edebilmesi için kayıt yenileme zamanı gelmiştir. Kaydınızı henüz yenilemediyseniz yenileme işleminizi gerçekleştirmenizi rica ederiz.\n\nSprint Yüzme Okulu\nBilgilendirme Hattı: 0551 896 83 19`;
              window.open(`https://wa.me/${waPhone(raw)}?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
            });
          }
        });
      } finally {
        working = false;
      }
    };

    enhance();
    const observer = new MutationObserver(() => window.requestAnimationFrame(enhance));
    observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, [students]);

  return (
    <style jsx global>{`
      .saTableWrap tr.saRenewalLastLesson{border-color:#f2cf7d!important;background:linear-gradient(135deg,#fffdf7,#fff9e8)!important}
      .saTableWrap tr.saRenewalNeeded{border-color:#f0b1b9!important;background:linear-gradient(135deg,#fffafa,#fff1f3)!important;box-shadow:0 8px 22px rgba(180,35,51,.08)!important}
      .saRenewalBadge{display:inline-flex;width:max-content;align-items:center;gap:5px;margin:0 0 6px;padding:5px 8px;border-radius:999px;font-size:8px;font-weight:950;letter-spacing:.04em}
      .saRenewalBadge.last{background:#fff0c2;color:#966000;border:1px solid #f1d17a}
      .saRenewalBadge.needed{background:#ffe2e6;color:#b42333;border:1px solid #f2bcc4}
      .saRenewalPanel{grid-column:1/-1;margin-top:8px;padding:11px;border:1px solid #f0bcc4;border-radius:12px;background:#fff;box-shadow:0 5px 14px rgba(132,32,45,.07)}
      .saRenewalPanelText{display:grid;gap:3px}.saRenewalPanelText strong{font-size:11px;color:#9d2030}.saRenewalPanelText span{font-size:9px;line-height:1.4;color:#7e5660}
      .saRenewalPanelActions{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:9px}
      .saRenewalPanelActions button,.saRenewalPanelActions a{min-height:36px;border-radius:9px;border:1px solid #e4b8bf;display:flex;align-items:center;justify-content:center;text-decoration:none;font-size:9px;font-weight:950;cursor:pointer}
      .saRenewalPanelActions button{background:#fff;color:#a12636}.saRenewalPanelActions a{background:#b42333;color:#fff;border-color:#b42333;box-shadow:0 6px 14px rgba(180,35,51,.16)}
      .saRenewalPanelActions button:active,.saRenewalPanelActions a:active{transform:scale(.98)}
      @media(min-width:601px){.saRenewalPanel{min-width:270px}.saRenewalBadge{font-size:9px}}
    `}</style>
  );
}
