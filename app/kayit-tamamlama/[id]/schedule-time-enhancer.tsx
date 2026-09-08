"use client";

import { useEffect } from "react";

type ScheduleItem = {
  id: string;
  weekday: number;
  start_time: string;
  end_time: string;
};

const dayNames: Record<number, string> = {
  0: "Pazar",
  1: "Pazartesi",
  2: "Salı",
  3: "Çarşamba",
  4: "Perşembe",
  5: "Cuma",
  6: "Cumartesi",
};

function hhmm(value: string) {
  return value ? value.slice(0, 5) : "--:--";
}

function toLocalDateValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function todayLocal() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function parseLocalDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parts = value.split("-").map(Number);
  const date = new Date(parts[0], parts[1] - 1, parts[2]);
  return Number.isNaN(date.getTime()) ? null : date;
}

function nextEligibleDate(weekdays: number[]) {
  if (!weekdays.length) return "";

  const allowed = new Set(weekdays);
  const cursor = todayLocal();

  for (let i = 0; i < 14; i += 1) {
    if (allowed.has(cursor.getDay())) return toLocalDateValue(cursor);
    cursor.setDate(cursor.getDate() + 1);
  }

  return "";
}

function setReactInputValue(input: HTMLInputElement, value: string) {
  if (!value || input.value === value) return;

  const descriptor = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value"
  );

  if (descriptor?.set) {
    descriptor.set.call(input, value);
  } else {
    input.value = value;
  }

  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

export default function ScheduleTimeEnhancer() {
  useEffect(() => {
    const foundForm = document.querySelector<HTMLFormElement>("form.registrationShell");
    if (!foundForm) return;

    const foundGroupSelect = foundForm.querySelector<HTMLSelectElement>(
      'select[name="group_id"]'
    );
    const foundStartDateInput = foundForm.querySelector<HTMLInputElement>(
      'input[name="start_date"]'
    );
    const foundActiveEnrollmentInput = foundForm.querySelector<HTMLInputElement>(
      'input[name="active_enrollment_id"]'
    );
    const foundDayPicker = foundForm.querySelector<HTMLElement>(".dayPicker");

    if (!foundGroupSelect || !foundStartDateInput || !foundDayPicker) return;

    const form = foundForm;
    const groupSelect = foundGroupSelect;
    const startDateInput = foundStartDateInput;
    const dayPicker = foundDayPicker;
    const activeEnrollmentInput = foundActiveEnrollmentInput;

    let schedules: ScheduleItem[] = [];
    let requestToken = 0;

    const style = document.createElement("style");
    style.dataset.scheduleTimeEnhancer = "true";
    style.textContent = `
      .dayPicker label .scheduleTimeBadge{display:block;margin-top:4px;font-size:11px;font-weight:800;line-height:1.15;color:#176fe8;white-space:nowrap}
      .dayPicker label.selected .scheduleTimeBadge{color:inherit}
      .scheduleTransferSummary{display:grid;gap:5px;margin-top:14px;padding:12px 14px;border:1px solid #cfe0f7;border-radius:14px;background:#f7fbff;color:#17365d}
      .scheduleTransferSummary strong{font-size:13px;font-weight:900}
      .scheduleTransferSummary span{font-size:13px;font-weight:800}
      .scheduleTransferSummary small{color:#5d7390;font-size:11px;line-height:1.45}
    `;
    document.head.appendChild(style);

    const checkboxes = () =>
      Array.from(
        form.querySelectorAll<HTMLInputElement>(
          'input[name="lesson_weekdays"][type="checkbox"]'
        )
      );

    const checkedWeekdays = () =>
      checkboxes()
        .filter((input) => input.checked)
        .map((input) => Number(input.value))
        .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6);

    const scheduleTextForDay = (day: number) => {
      const items = schedules.filter((item) => Number(item.weekday) === day);
      if (!items.length) return "Program saati yok";

      return items
        .map((item) => `${hhmm(item.start_time)}–${hhmm(item.end_time)}`)
        .join(" / ");
    };

    const render = () => {
      const heading = dayPicker.firstElementChild;
      if (heading instanceof HTMLElement) {
        heading.textContent = "Öğrencinin gerçekten katılacağı gün ve saatler";
      }

      checkboxes().forEach((input) => {
        const label = input.closest("label");
        if (!(label instanceof HTMLLabelElement)) return;

        label.querySelector(".scheduleTimeBadge")?.remove();

        const badge = document.createElement("span");
        badge.className = "scheduleTimeBadge";
        badge.textContent = scheduleTextForDay(Number(input.value));
        label.appendChild(badge);
      });

      let summary = dayPicker.querySelector<HTMLElement>(".scheduleTransferSummary");
      if (!summary) {
        summary = document.createElement("div");
        summary.className = "scheduleTransferSummary";
        dayPicker.appendChild(summary);
      }

      const selected = checkedWeekdays();
      if (!selected.length) {
        summary.textContent = "Katılım günü seçildiğinde aktarılacak seans burada gösterilir.";
        return;
      }

      summary.replaceChildren();

      const title = document.createElement("strong");
      title.textContent = "Otomatik aktarılacak program";

      const detail = document.createElement("span");
      detail.textContent = selected
        .map((day) => `${dayNames[day]}: ${scheduleTextForDay(day)}`)
        .join(" · ");

      const note = document.createElement("small");
      note.textContent =
        "Kesin kayıtta öğrenci seçilen grubun bu gün ve saatlerindeki seanslarına bağlanır.";

      summary.append(title, detail, note);
    };

    const alignStartDate = (days: number[], force: boolean) => {
      if (!days.length) return;

      const today = todayLocal();
      const current = parseLocalDate(startDateInput.value);
      const currentValid =
        current !== null &&
        current.getTime() >= today.getTime() &&
        days.includes(current.getDay());

      if (!force && currentValid) return;

      const next = nextEligibleDate(days);
      setReactInputValue(startDateInput, next);
    };

    const refresh = async (forceAlign: boolean) => {
      const groupId = groupSelect.value;
      const token = ++requestToken;

      if (!groupId) {
        schedules = [];
        render();
        return;
      }

      try {
        const response = await fetch(
          `/api/registration-group-schedule?group_id=${encodeURIComponent(groupId)}`,
          { cache: "no-store" }
        );
        const payload = (await response.json()) as {
          schedules?: ScheduleItem[];
        };

        if (token !== requestToken) return;

        schedules = Array.isArray(payload.schedules) ? payload.schedules : [];
        render();

        const selected = checkedWeekdays();
        const scheduleDays = Array.from(
          new Set(schedules.map((item) => Number(item.weekday)))
        ).filter((day) => Number.isInteger(day) && day >= 0 && day <= 6);

        alignStartDate(selected.length ? selected : scheduleDays, forceAlign);
      } catch {
        if (token !== requestToken) return;
        schedules = [];
        render();
      }
    };

    const onGroupChange = () => {
      window.setTimeout(() => {
        void refresh(true);
      }, 0);
    };

    const onDayChange = () => {
      window.setTimeout(() => {
        render();
        alignStartDate(checkedWeekdays(), false);
      }, 0);
    };

    groupSelect.addEventListener("change", onGroupChange);
    checkboxes().forEach((input) => input.addEventListener("change", onDayChange));

    const hasActiveEnrollment = Boolean(activeEnrollmentInput?.value);
    void refresh(!hasActiveEnrollment);

    return () => {
      requestToken += 1;
      groupSelect.removeEventListener("change", onGroupChange);
      checkboxes().forEach((input) => input.removeEventListener("change", onDayChange));
      style.remove();
    };
  }, []);

  return null;
}
