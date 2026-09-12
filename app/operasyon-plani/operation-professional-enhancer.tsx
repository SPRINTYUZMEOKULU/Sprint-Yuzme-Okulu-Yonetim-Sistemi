"use client";

import { useEffect } from "react";

type Checkin = {
  id?: string;
  checked_in_at?: string;
  attendance_status?: string;
  approval_status?: string;
  location_verified?: boolean;
};

type PersonnelRow = {
  scheduleId: string;
  staffId: string;
  staffName: string;
  branchName: string;
  groupName: string;
  startTime: string;
  endTime: string;
  checkin: Checkin | null;
  isMine: boolean;
};

type PersonnelDashboard = {
  date: string;
  today: PersonnelRow[];
};

function normalize(value?: string | null) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function nowIstanbulMinutes() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Istanbul",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const h = Number(parts.find((item) => item.type === "hour")?.value || 0);
  const m = Number(parts.find((item) => item.type === "minute")?.value || 0);
  return h * 60 + m;
}

function timeToMinutes(value?: string | null) {
  const [h, m] = String(value || "00:00").slice(0, 5).split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function formatCheckinTime(value?: string | null) {
  if (!value) return "";
  try {
    return new Intl.DateTimeFormat("tr-TR", {
      timeZone: "Europe/Istanbul",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date(value));
  } catch {
    return "";
  }
}

function scheduleIdFromArticle(article: Element) {
  const links = Array.from(article.querySelectorAll("a[href*='/yoklama']"));
  for (const link of links) {
    const href = link.getAttribute("href");
    if (!href) continue;
    try {
      const url = new URL(href, window.location.origin);
      const id = url.searchParams.get("seans");
      if (id) return id;
    } catch {
      // Geçersiz href ise diğer bağlantıya bak.
    }
  }
  return "";
}

function selectedDateFromPage() {
  const input = document.querySelector<HTMLInputElement>('input[name="tarih"]');
  return input?.value || "";
}

function attendanceText(checkin: Checkin) {
  const time = formatCheckinTime(checkin.checked_in_at);
  const status = String(checkin.attendance_status || "");
  if (status === "late") return `Geç geldi${time ? ` · ${time}` : ""}`;
  if (status === "on_time") return `Zamanında${time ? ` · ${time}` : ""}`;
  if (status === "outside_geofence") return `Konum dışı giriş${time ? ` · ${time}` : ""}`;
  if (status === "location_unconfigured") return `Giriş alındı${time ? ` · ${time}` : ""}`;
  return `Giriş yapıldı${time ? ` · ${time}` : ""}`;
}

export default function OperationProfessionalEnhancer() {
  useEffect(() => {
    const root = document.querySelector("main");
    if (!root) return;

    let personnelData: PersonnelDashboard | null = null;
    let disposed = false;

    const refreshPersonnel = async () => {
      try {
        const response = await fetch("/api/personel-puantaj", { cache: "no-store" });
        if (!response.ok) return;
        personnelData = (await response.json()) as PersonnelDashboard;
        enhance(true);

        if (selectedDateFromPage() === personnelData?.date) {
          void fetch("/api/personel-puantaj/alerts", { method: "POST" }).catch(() => undefined);
        }
      } catch {
        // Operasyon ekranı personel API'si geçici olarak erişilemese de çalışmaya devam eder.
      }
    };

    const checkIn = (button: HTMLButtonElement, row: PersonnelRow) => {
      if (!navigator.geolocation) {
        button.textContent = "Konum desteklenmiyor";
        button.disabled = true;
        return;
      }

      const original = button.textContent || "Derse Geldim";
      button.disabled = true;
      button.textContent = "Konum alınıyor…";

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
            button.textContent = "Giriş kaydediliyor…";
            const response = await fetch("/api/personel-puantaj", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                action: "checkin",
                scheduleId: row.scheduleId,
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                accuracy: position.coords.accuracy,
              }),
            });
            const payload = await response.json();
            if (!response.ok) throw new Error(payload?.error || "Giriş kaydedilemedi.");
            button.textContent = "✓ Giriş yapıldı";
            await refreshPersonnel();
          } catch (error) {
            button.disabled = false;
            button.textContent = original;
            window.alert(error instanceof Error ? error.message : "Giriş kaydedilemedi.");
          }
        },
        (error) => {
          button.disabled = false;
          button.textContent = original;
          const message = error.code === 1
            ? "Derse giriş yapabilmek için konum izni vermelisiniz."
            : "Konumunuz alınamadı. Lütfen tekrar deneyin.";
          window.alert(message);
        },
        { enableHighAccuracy: true, timeout: 12000, maximumAge: 15000 }
      );
    };

    const renderLiveStatus = (article: Element, status: HTMLElement, scheduleId: string) => {
      if (!personnelData || !scheduleId) return;
      const selectedDate = selectedDateFromPage();
      const badgeWrap = status.querySelector<HTMLElement>(".sprintStatusBadges");
      if (!badgeWrap) return;

      badgeWrap.querySelectorAll(".sprintLiveStaffBadge,.sprintCheckinButton").forEach((node) => node.remove());

      if (selectedDate && selectedDate !== personnelData.date) {
        const badge = document.createElement("span");
        badge.className = "sprintStatusBadge neutral sprintLiveStaffBadge";
        badge.textContent = "Geçmiş/ileri tarih · canlı giriş yalnız bugün";
        badgeWrap.appendChild(badge);
        return;
      }

      const rows = (personnelData.today || []).filter((row) => String(row.scheduleId) === scheduleId);
      if (!rows.length) return;

      const checked = rows.filter((row) => Boolean(row.checkin));
      const missing = rows.filter((row) => !row.checkin);

      checked.forEach((row) => {
        const badge = document.createElement("span");
        const late = row.checkin?.attendance_status === "late";
        const pending = row.checkin?.approval_status === "pending";
        badge.className = `sprintStatusBadge ${late || pending ? "warn" : "ok"} sprintLiveStaffBadge`;
        badge.textContent = `${row.staffName}: ${attendanceText(row.checkin || {})}${pending ? " · Onay bekliyor" : ""}`;
        badgeWrap.appendChild(badge);
      });

      const now = nowIstanbulMinutes();
      missing.forEach((row) => {
        const diff = timeToMinutes(row.startTime) - now;
        const badge = document.createElement("span");
        let cls = "neutral";
        let text = `${row.staffName}: giriş bekleniyor`;

        if (diff <= 30 && diff > 0) {
          cls = "warn";
          text = `${row.staffName}: ${diff} dk kaldı · giriş yok`;
        } else if (diff <= 0) {
          cls = "danger";
          text = `${row.staffName}: seans başladı · giriş yok`;
        }

        badge.className = `sprintStatusBadge ${cls} sprintLiveStaffBadge`;
        badge.textContent = text;
        badgeWrap.appendChild(badge);

        if (row.isMine) {
          const button = document.createElement("button");
          button.type = "button";
          button.className = "sprintCheckinButton";
          button.textContent = "Derse Geldim";
          button.addEventListener("click", () => checkIn(button, row));
          badgeWrap.appendChild(button);
        }
      });

      if (rows.length > 1 && checked.length > 0 && missing.length > 0) {
        const summary = document.createElement("span");
        summary.className = "sprintStatusBadge warn sprintLiveStaffBadge";
        summary.textContent = `${checked.length}/${rows.length} eğitmen giriş yaptı`;
        badgeWrap.appendChild(summary);
      }
    };

    const enhance = (forceLive = false) => {
      if (disposed) return;
      const articles = Array.from(root.querySelectorAll("article"));

      articles.forEach((article) => {
        const alreadyEnhanced = article.classList.contains("sprintSessionCard");
        if (!alreadyEnhanced) article.classList.add("sprintSessionCard");

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

        const headerText = normalize(header?.textContent);
        const hasCoach = !headerText.includes("0 Eğitmen") && !normalize(article.textContent).includes("Bu seansa henüz eğitmen atanmadı.");
        const hasStudents = !headerText.includes("0 Öğrenci");

        let status = article.querySelector<HTMLElement>(":scope > .sprintSessionStatus");
        if (!status) {
          status = document.createElement("div");
          status.className = "sprintSessionStatus";
          status.innerHTML = `
            <div class="sprintStatusHeading">
              <span>Seans Kontrol Merkezi</span>
              <small>Atama, personel girişi ve yoklama tek alanda</small>
            </div>
            <div class="sprintStatusBadges">
              <span class="sprintStatusBadge ${hasCoach ? "ok" : "danger"}">${hasCoach ? "✓ Eğitmen Atandı" : "! Eğitmen Atanmadı"}</span>
              <span class="sprintStatusBadge ${hasStudents ? "ok" : "warn"}">${hasStudents ? "✓ Öğrenciler Hazır" : "! Öğrenci Yok"}</span>
              <span class="sprintStatusBadge neutral">Yoklama Bekleniyor</span>
            </div>
          `;
          if (header) header.insertAdjacentElement("afterend", status);
        }

        const scheduleId = scheduleIdFromArticle(article);
        if (status && (forceLive || personnelData)) renderLiveStatus(article, status, scheduleId);

        if (!alreadyEnhanced && staffAssignSection && hasCoach) {
          staffAssignSection.classList.add("isCollapsed");
          const title = staffAssignSection.querySelector("div");
          if (title && !title.querySelector(".sprintInlineToggle")) {
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
    void refreshPersonnel();

    const interval = window.setInterval(() => void refreshPersonnel(), 60_000);
    const observer = new MutationObserver(() => enhance());
    observer.observe(root, { childList: true, subtree: true });

    return () => {
      disposed = true;
      window.clearInterval(interval);
      observer.disconnect();
    };
  }, []);

  return null;
}
