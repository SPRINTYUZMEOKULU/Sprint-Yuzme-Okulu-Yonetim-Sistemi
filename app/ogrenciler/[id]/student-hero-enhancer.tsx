"use client";

import { useEffect } from "react";

const STATUS_LABELS: Record<string, string> = {
  active: "Aktif",
  passive: "Pasif",
  pre_registration: "Ön Kayıt",
  pending: "Beklemede",
  completed: "Tamamlandı",
  archived: "Arşivli",
  frozen: "Donduruldu",
  cancelled: "İptal",
};

const HERO_LINKS = [
  { href: "/", label: "Ana Panel", icon: "⌂" },
  { href: "/on-kayitlar", label: "Ön Kayıtlar", icon: "＋" },
  { href: "/gruplar", label: "Gruplar", icon: "▣" },
  { href: "/yoklama", label: "Yoklama", icon: "✓" },
  { href: "/odemeler", label: "Ödemeler", icon: "₺" },
  { href: "/kayit-yenilemeleri", label: "Yenilemeler", icon: "↻" },
  { href: "/onay-merkezi", label: "Onay Merkezi", icon: "◆" },
] as const;

function formatRegistrationDate(value?: string | null) {
  if (!value) return "";

  try {
    return new Intl.DateTimeFormat("tr-TR", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Europe/Istanbul",
    }).format(new Date(value));
  } catch {
    return "";
  }
}

function registrationSourceLabel(source?: string | null) {
  if (source === "web_form") return "Ön kayıt formu";
  if (source === "excel_import") return "Excel aktarımı";
  if (source === "manual") return "Personel girişi";
  return "Ön kayıt kaydı";
}

export default function StudentHeroEnhancer() {
  useEffect(() => {
    const hero = document.querySelector<HTMLElement>(".studentFilePage .studentHero");

    if (hero) {
      const status = hero.querySelector<HTMLElement>(".heroBadges .status");
      if (status) {
        const raw = (status.textContent || "").trim();
        const key = raw.toLocaleLowerCase("tr-TR").replace(/\s+/g, "_");
        const translated = STATUS_LABELS[key] || raw || "Aktif";
        if (raw !== translated) status.textContent = translated;
      }

      if (!hero.querySelector("[data-hero-actions='1']")) {
        const backButton = hero.querySelector<HTMLAnchorElement>(".backButton");

        if (backButton) {
          const actions = document.createElement("nav");
          actions.className = "heroTopActions";
          actions.dataset.heroActions = "1";
          actions.setAttribute("aria-label", "SprintOS hızlı modül bağlantıları");

          for (const item of HERO_LINKS) {
            const link = document.createElement("a");
            link.href = item.href;
            link.className = "heroTopAction";
            link.innerHTML = `<span aria-hidden="true">${item.icon}</span><b>${item.label}</b>`;
            actions.appendChild(link);
          }

          backButton.textContent = "← Öğrenciler";
          backButton.classList.add("heroTopBack");
          actions.appendChild(backButton);
          hero.appendChild(actions);
        }
      }
    }

    const registrationBlock = document.querySelector<HTMLElement>(
      ".studentFilePage #notlar .registrationNotesBlock",
    );

    if (!registrationBlock) return;

    const registrationEyebrow = registrationBlock.querySelector<HTMLElement>(
      ".panelHead.compact p",
    );
    const registrationTitle = registrationBlock.querySelector<HTMLElement>(
      ".panelHead.compact h3",
    );
    const registrationEmpty = registrationBlock.querySelector<HTMLElement>(".empty");

    if (registrationEyebrow) registrationEyebrow.textContent = "KAYIT AŞAMASI NOTLARI";
    if (registrationTitle) registrationTitle.textContent = "Kesin kayıt ve personel notları";
    if (registrationEmpty) {
      registrationEmpty.textContent = "Kesin kayıt sırasında personel tarafından eklenmiş not bulunmuyor.";
    }

    if (registrationBlock.parentElement?.querySelector("[data-pre-registration-note='1']")) {
      return;
    }

    const pathMatch = window.location.pathname.match(/^\/ogrenciler\/([^/]+)/);
    const studentId = pathMatch?.[1];
    if (!studentId) return;

    let cancelled = false;

    void fetch(`/api/students/${encodeURIComponent(studentId)}/registration-note`, {
      cache: "no-store",
      credentials: "same-origin",
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("registration-note-request-failed");
        return response.json() as Promise<{
          ok: boolean;
          note?: string | null;
          source?: string | null;
          createdAt?: string | null;
        }>;
      })
      .then((payload) => {
        if (cancelled) return;

        const block = document.createElement("section");
        block.className = "preRegistrationNoteBlock";
        block.dataset.preRegistrationNote = "1";

        const head = document.createElement("div");
        head.className = "preRegistrationNoteHead";

        const headText = document.createElement("div");
        const eyebrow = document.createElement("p");
        eyebrow.textContent = "ÖN KAYIT FORMUNDAKİ ÖĞRENCİ NOTU";
        const title = document.createElement("h3");
        title.textContent = "Kursiyer / veli tarafından iletilen not";
        headText.append(eyebrow, title);

        const badge = document.createElement("span");
        badge.className = "preRegistrationSource";
        badge.textContent = registrationSourceLabel(payload.source);
        head.append(headText, badge);

        const content = document.createElement("div");
        content.className = "preRegistrationNoteContent";

        if (payload.note?.trim()) {
          const note = document.createElement("p");
          note.textContent = payload.note.trim();
          content.appendChild(note);

          const meta = document.createElement("small");
          const date = formatRegistrationDate(payload.createdAt);
          meta.textContent = date
            ? `${registrationSourceLabel(payload.source)} • ${date}`
            : registrationSourceLabel(payload.source);
          content.appendChild(meta);
        } else {
          const empty = document.createElement("p");
          empty.className = "preRegistrationNoteEmpty";
          empty.textContent = "Ön kayıt formunda kursiyer/veli tarafından yazılmış bir not bulunmuyor.";
          content.appendChild(empty);
        }

        block.append(head, content);
        registrationBlock.parentElement?.insertBefore(block, registrationBlock);
      })
      .catch(() => {
        if (cancelled) return;

        const block = document.createElement("section");
        block.className = "preRegistrationNoteBlock";
        block.dataset.preRegistrationNote = "1";

        const eyebrow = document.createElement("p");
        eyebrow.className = "preRegistrationErrorEyebrow";
        eyebrow.textContent = "ÖN KAYIT FORMUNDAKİ ÖĞRENCİ NOTU";

        const error = document.createElement("p");
        error.className = "preRegistrationNoteEmpty";
        error.textContent = "Ön kayıt notu şu anda okunamadı.";

        block.append(eyebrow, error);
        registrationBlock.parentElement?.insertBefore(block, registrationBlock);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <style jsx global>{`
      .studentHero .heroTopActions{display:flex;align-items:center;justify-content:flex-end;gap:7px;flex-wrap:wrap;max-width:760px;margin-left:auto}
      .studentHero .heroTopAction,.studentHero .heroTopBack{min-height:39px;display:inline-flex;align-items:center;justify-content:center;gap:7px;padding:9px 11px;border:1px solid rgba(255,255,255,.22);border-radius:12px;color:#fff;background:rgba(255,255,255,.09);text-decoration:none;font-size:11.5px;font-weight:850;white-space:nowrap;touch-action:manipulation;-webkit-tap-highlight-color:transparent}
      .studentHero .heroTopAction span{font-size:14px;font-weight:900;color:#ffd27a}.studentHero .heroTopBack{background:rgba(4,24,48,.3)}
      .studentFilePage #notlar .preRegistrationNoteBlock{margin-top:26px;padding:22px 0 4px;border-top:1px solid #e4eaf2}
      .studentFilePage #notlar .preRegistrationNoteHead{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;margin-bottom:14px}
      .studentFilePage #notlar .preRegistrationNoteHead p,.studentFilePage #notlar .preRegistrationErrorEyebrow{margin:0 0 5px;color:#ff8a00;font-size:12px;font-weight:900;letter-spacing:.14em}
      .studentFilePage #notlar .preRegistrationNoteHead h3{margin:0;color:#102f55;font-size:20px;line-height:1.2}
      .studentFilePage #notlar .preRegistrationSource{flex:0 0 auto;padding:7px 10px;border-radius:999px;background:#fff4df;color:#9a5b00;font-size:11px;font-weight:850}
      .studentFilePage #notlar .preRegistrationNoteContent{padding:16px 18px;border:1px solid #f1d4a9;border-radius:16px;background:linear-gradient(180deg,#fffaf2 0%,#fff 100%)}
      .studentFilePage #notlar .preRegistrationNoteContent>p:not(.preRegistrationNoteEmpty){margin:0;color:#17385f;font-size:15px;line-height:1.65;white-space:pre-wrap}
      .studentFilePage #notlar .preRegistrationNoteContent small{display:block;margin-top:10px;color:#7d8da2;font-size:11.5px;font-weight:700}
      .studentFilePage #notlar .preRegistrationNoteEmpty{margin:0;color:#8a99ad;font-size:14px;line-height:1.55}
      @media(max-width:1180px){.studentHero{align-items:flex-start;flex-wrap:wrap}.studentHero .heroTopActions{width:100%;max-width:none;margin-left:98px;justify-content:flex-start}}
      @media(max-width:680px){.studentHero{padding:20px 16px;gap:14px}.studentHero .heroTopActions{margin-left:0;width:100%;overflow-x:auto;overscroll-behavior-x:contain;flex-wrap:nowrap;justify-content:flex-start;padding:2px 0 7px;-webkit-overflow-scrolling:touch}.studentHero .heroTopAction,.studentHero .heroTopBack{flex:0 0 auto;min-height:46px}.studentFilePage #notlar .preRegistrationNoteHead{display:grid}.studentFilePage #notlar .preRegistrationSource{justify-self:start}.studentFilePage #notlar .preRegistrationNoteContent{padding:14px}}
    `}</style>
  );
}
