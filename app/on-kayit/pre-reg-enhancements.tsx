"use client";

import { useEffect } from "react";

const peopleIcon = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>`;
const medalIcon = `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="15" r="5"/><path d="M8.5 2 12 7l3.5-5M7 2l5 7 5-7"/><path d="m12 12 1 2 2 .3-1.5 1.5.4 2.2-1.9-1-1.9 1 .4-2.2L9 14.3l2-.3 1-2Z"/></svg>`;
const chartIcon = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 20h18M6 17v-4M12 17V9M18 17V5"/><path d="m5 9 5-4 4 2 5-5"/></svg>`;
const mailIcon = `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="m4 7 8 6 8-6"/></svg>`;
const plusIcon = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6M12 12v6M9 15h6"/></svg>`;
const heartHandIcon = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.9-8.6a5.5 5.5 0 0 0-.1-7.8Z"/></svg>`;

export default function PreRegEnhancements() {
  useEffect(() => {
    const enhance = () => {
      const rulesContent = document.querySelector(".rulesContent");
      if (rulesContent && !rulesContent.querySelector("[data-refund-rule]")) {
        const rule = document.createElement("p");
        rule.setAttribute("data-refund-rule", "true");
        rule.className = "criticalCourseRule";
        rule.innerHTML = "<strong>7. İptal ve ücret iadesi:</strong> Kesin kaydı tamamlanarak kursa başlayan öğrenci / katılımcı için kurs iptali ve ücret iadesi yapılmaz. Başlanan kurs paketi başka bir döneme devredilemez ve kullanılmayan dersler için ücret iadesi talep edilemez.";
        rulesContent.appendChild(rule);
      }

      const successRoot = Array.from(document.querySelectorAll("div")).find((el) =>
        el.textContent?.includes("Ön Kaydınız Başarıyla Alındı!") && el.querySelector("aside")
      );
      if (!successRoot || successRoot.getAttribute("data-success-enhanced") === "true") return;
      successRoot.setAttribute("data-success-enhanced", "true");

      const aside = successRoot.querySelector("aside");
      if (!aside) return;

      const logoBox = Array.from(aside.querySelectorAll("div")).find((el) =>
        el.textContent?.trim().startsWith("SPRINT") && el.textContent?.includes("YÜZME OKULU") && el.children.length <= 2
      );
      if (logoBox) {
        logoBox.innerHTML = `<img src="/sprint-logo.png" alt="Sprint Yüzme Okulu" class="successBrandLogo" />`;
        logoBox.classList.add("successLogoBox");
      }

      const benefitTitles = ["Butik gruplar", "Uzman antrenörler", "Hızlı dönüş"];
      const benefitIcons = [peopleIcon, medalIcon, chartIcon];
      benefitTitles.forEach((title, index) => {
        const titleEl = Array.from(aside.querySelectorAll("strong")).find((el) => el.textContent?.trim() === title);
        const card = titleEl?.closest("div[style*='grid-template-columns']");
        if (!card) return;
        const icon = card.firstElementChild as HTMLElement | null;
        if (icon) {
          icon.innerHTML = benefitIcons[index];
          icon.classList.add("successProIcon");
        }
        if (title === "Butik gruplar") {
          if (titleEl) titleEl.textContent = "Başlangıç gruplarında butik eğitim";
          const desc = titleEl?.parentElement?.querySelector("span");
          if (desc) desc.textContent = "En fazla 6 kişilik sınıflarda kişiye özel ilgi";
        }
        if (title === "Hızlı dönüş") {
          if (titleEl) titleEl.textContent = "Hızlı gelişim";
          const desc = titleEl?.parentElement?.querySelector("span");
          if (desc) desc.textContent = "Doğru teknik, güvenli ortam, kalıcı başarı";
        }
      });

      const successTitle = Array.from(successRoot.querySelectorAll("h1")).find((el) => el.textContent?.includes("Ön Kaydınız Alındı"));
      if (successTitle) successTitle.textContent = "Ön Kaydınız Alındı!";

      const allParagraphs = Array.from(successRoot.querySelectorAll("p"));
      const systemMessage = allParagraphs.find((el) => el.textContent?.includes("Sprint Yüzme Okulu") && el.textContent?.includes("kayıt sistemine"));
      if (systemMessage) {
        systemMessage.innerHTML = `Başvurunuz başarıyla <strong>Sprint Yüzme Okulu</strong> kayıt sistemine işlenmiştir.`;
        systemMessage.classList.add("successSystemPulse");
      }

      const closing = Array.from(successRoot.querySelectorAll("div")).find((el) => el.textContent?.includes("Sizi en kısa sürede aramızda görmek") && el.children.length < 6);
      if (closing) {
        closing.innerHTML = `<span class="successClosingIcon">${heartHandIcon}</span><strong>Sizi en kısa sürede aramızda görmek amacıyla sabırsızlanıyoruz!</strong>`;
        closing.classList.add("successClosingCard");
      }

      Array.from(successRoot.querySelectorAll("button")).forEach((button) => {
        if (button.textContent?.includes("Yeni Kayıt Oluştur")) {
          button.innerHTML = `<span class="successButtonIcon">${plusIcon}</span><span>Yeni Kayıt Oluştur</span><span class="successArrow">→</span>`;
        }
      });

      const clockEmoji = Array.from(successRoot.querySelectorAll("div")).find((el) => el.textContent?.trim() === "🕒");
      if (clockEmoji) {
        clockEmoji.innerHTML = mailIcon;
        clockEmoji.classList.add("successProIcon", "successInfoIcon");
      }
    };

    enhance();
    const observer = new MutationObserver(enhance);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return (
    <style jsx global>{`
      .selectedGroupCard{position:relative;overflow:hidden;border:2px solid #176de9!important;background:linear-gradient(135deg,#eef6ff 0%,#fff 72%)!important;box-shadow:0 12px 30px rgba(23,109,233,.16),0 0 0 4px rgba(23,109,233,.07);animation:selectedGroupGlow 2.1s ease-in-out infinite}.selectedGroupCard::before{content:"✓ SEÇİMİNİZ";position:absolute;top:0;right:0;padding:7px 11px;border-radius:0 13px 0 12px;background:#176de9;color:#fff;font-size:9px;font-weight:900;letter-spacing:.08em}.selectedGroupCard>div:first-child>span{font-size:11px!important;color:#075fd7!important}.selectedGroupCard>div:first-child>strong{font-size:21px!important;color:#0b2b59!important}.selectedSchedule span{border-color:#bcd5fa!important;box-shadow:0 3px 10px rgba(23,109,233,.06)}.criticalCourseRule{margin:12px 0 0!important;padding:12px 13px;border:1px solid #fecaca;border-radius:11px;background:#fff7f7;color:#7f1d1d!important}.criticalCourseRule strong{color:#b91c1c}
      .successLogoBox{width:154px!important;height:154px!important;padding:8px!important;background:#fff!important}.successBrandLogo{width:100%;height:100%;object-fit:contain;display:block}.successProIcon{color:#fff!important;background:linear-gradient(145deg,#0879ff,#0457c7)!important}.successProIcon svg,.successButtonIcon svg,.successClosingIcon svg{width:25px;height:25px;fill:none;stroke:currentColor;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round}.successSystemPulse{padding:14px 18px;border:1px solid #86bfff;border-radius:18px;background:#f5faff;box-shadow:0 0 0 0 rgba(25,118,255,.35);animation:systemPulse 1.8s ease-in-out infinite}.successSystemPulse strong{color:#0871ee}.successClosingCard{display:flex!important;align-items:center!important;justify-content:center!important;gap:14px!important}.successClosingIcon{width:48px;height:48px;display:grid;place-items:center;border-radius:14px;background:#eef6ff;color:#0759c7;flex:0 0 auto}.successClosingIcon svg{width:29px;height:29px}.successButtonIcon{display:inline-grid;place-items:center}.successButtonIcon svg{width:24px;height:24px}.successArrow{font-size:26px;margin-left:6px}.successInfoIcon svg{width:24px;height:24px}
      @keyframes selectedGroupGlow{0%,100%{box-shadow:0 12px 30px rgba(23,109,233,.14),0 0 0 3px rgba(23,109,233,.06)}50%{box-shadow:0 15px 36px rgba(23,109,233,.22),0 0 0 7px rgba(23,109,233,.11)}}@keyframes systemPulse{0%,100%{box-shadow:0 0 0 0 rgba(25,118,255,.20)}50%{box-shadow:0 0 0 8px rgba(25,118,255,.10),0 8px 24px rgba(25,118,255,.14)}}@media(prefers-reduced-motion:reduce){.selectedGroupCard,.successSystemPulse{animation:none!important}}
    `}</style>
  );
}
