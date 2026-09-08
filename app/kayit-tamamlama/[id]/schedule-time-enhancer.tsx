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

function localDateValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function parseLocalDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? null : date;
}

function nextEligibleDate(weekdays: number[], from = startOfToday()) {
  if (!weekdays.length) return "";
  const allowed = new Set(weekdays);
  const cursor = new Date(from.getFullYear(), from.getMonth(), from.getDate());

  for (let offset = 0; offset < 14; offset += 1) {
    if (allowed.has(cursor.getDay())) return localDateValue(cursor);
    cursor.setDate(cursor.getDate() + 1);
  }

  return "";
}

function setReactInputValue(input: HTMLInputElement, value: string) {
  if (input.value === value) return;

  const setter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value"
  )?.set;

  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

export default function ScheduleTimeEnhancer() {
  useEffect(() => {
    const form = document.querySelector<HTMLFormElement>("form.registrationShell");
    const groupSelect = form?.querySelector<HTMLSelectElement>('select[name="group_id"]');
    const startDateInput = form?.querySelector<HTMLInputElement>('input[name="start_date"]');
    const activeEnrollmentInput = form?.querySelector<HTMLInputElement>('input[name="active_enrollment_id"]');
    const dayPicker = form?.querySelector<HTMLElement>(".dayPicker");

    if (!form || !groupSelect || !startDateInput || !dayPicker) return;

    let schedules: ScheduleItem[] = [];
    let requestId = 0;
    const listeners: Array<() => void> = [];

    const getCheckboxes = () =>
      Array.from(
        form.querySelectorAll<HTMLInputElement>('input[name="lesson_weekdays"][type="checkbox"]')
      );

    const getCheckedWeekdays = () =>
      getCheckboxes()
        .filter((input) => input.checked)
        .map((input) => Number(input.value))
        .filter((day) => Number.isInteger(day));

    function scheduleTextForDay(day: number) {
      const items = schedules.filter((item) => item.weekday === day);
      if (!items.length) return "Program saati yok";
      return items
        .map((item) => `${hhmm(item.start_time)}–${hhmm(item.end_time)}`)
        .join(" / ");
    }

    function renderScheduleSummary() {
      let summary = dayPicker.querySelector<HTMLElement>(".scheduleTransferSummary");
      if (!summary) {
        summary = document.createElement("div");
        summary.className = "scheduleTransferSummary";
        dayPicker.appendChild(summary);
      }

      const selectedDays = getCheckedWeekdays();
      if (!selectedDays.length) {
        summary.innerHTML = "<strong>Aktarılacak seans:</strong> Katılım günü seçiniz.";
        return;
      }

      summary.innerHTML = `
        <strong>Otomatik aktarılacak program</strong>
        <span>${selectedDays
          .map((day) => `${dayNames[day] || day}: ${scheduleTextForDay(day)}`)
          .join(" · ")}</span>
        <small>Kesin kayıtta öğrenci seçilen gruba ve grubun bu saatlerdeki seanslarına bağlanır.</small>
      `;
    }

    function decorateDayTimes() {
      const heading = dayPicker.querySelector<HTMLElement>(":scope > span");
      if (heading) heading.textContent = "Öğrencinin gerçekten katılacağı gün ve saatler";

      getCheckboxes().forEach((input) => {
        const label = input.closest("label");
        if (!label) return;

        label.querySelector(".scheduleTimeBadge")?.remove();

        const badge = document.createElement("span");
        badge.className = "scheduleTimeBadge";
        badge.textContent = scheduleTextForDay(Number(input.value));
        label.appendChild(badge);
      });

      renderScheduleSummary();
    }

    function alignStartDate(weekdays: number[], force = false) {
      if (!weekdays.length) return;

      const today = startOfToday();
      const current = parseLocalDate(startDateInput.value);
      const currentIsUsable =
        current &&
        current.getTime() >= today.getTime() &&
        weekdays.includes(current.getDay());

      if (!force && currentIsUsable) return;

      const next = nextEligibleDate(weekdays, today);
      if (next) setReactInputValue(startDateInput, next);
    }

    async function refresh(groupId: string, forceAlign: boolean) {
      const currentRequest = ++requestId;

      if (!groupId) {
        schedules = [];
        decorateDayTimes();
        return;
      }

      try {
        const response = await fetch(
          `/api/registration-group-schedule?group_id=${encodeURIComponent(groupId)}`,
          { cache: "no-store" }
        );
        const payload = (await response.json()) as {
          ok?: boolean;
          schedules?: ScheduleItem[];
        };

        if (currentRequest !== requestId) return;
        schedules = Array.isArray(payload.schedules) ? payload.schedules : [];

        window.setTimeout(() => {
          decorateDayTimes();
          const selected = getCheckedWeekdays();
          const scheduleDays = [
            ...new Set(schedules.map((item) => Number(item.weekday))),
          ].filter((day) => Number.isInteger(day));

          alignStartDate(selected.length ? selected : scheduleDays, forceAlign);
        }, 0);
      } catch {
        if (currentRequest !== requestId) return;
        schedules = [];
        decorateDayTimes();
      }
    }

    const onGroupChange = () => {
      void refresh(groupSelect.value, true);
    };
    groupSelect.addEventListener("change", onGroupChange);
    listeners.push(() => groupSelect.removeEventListener("change", onGroupChange));

    getCheckboxes().forEach((input) => {
      const onDayChange = () => {
        window.setTimeout(() => {
          renderScheduleSummary();
          alignStartDate(getCheckedWeekdays(), false);
        }, 0);
      };
      input.addEventListener("change", onDayChange);
      listeners.push(() => input.removeEventListener("change", onDayChange));
    });

    const hasActiveEnrollment = Boolean(activeEnrollmentInput?.value);
    void refresh(groupSelect.value, !hasActiveEnrollment);

    return () => {
      requestId += 1;
      listeners.forEach((remove) => remove());
    };
  }, []);

  return (
    <style jsx global>{`
      .dayPicker label .scheduleTimeBadge {
        display: block;
        margin-top: 4px;
        font-size: 11px;
        font-weight: 800;
        line-height: 1.15;
        color: #176fe8;
        white-space: nowrap;
      }

      .dayPicker label.selected .scheduleTimeBadge {
        color: inherit;
      }

      .scheduleTransferSummary {
        display: grid;
        gap: 5px;
        margin-top: 14px;
        padding: 12px 14px;
        border: 1px solid #cfe0f7;
        border-radius: 14px;
        background: #f7fbff;
        color: #17365d;
      }

      .scheduleTransferSummary strong {
        font-size: 13px;
        font-weight: 900;
      }

      .scheduleTransferSummary span {
        font-size: 13px;
        font-weight: 800;
      }

      .scheduleTransferSummary small {
        color: #5d7390;
        font-size: 11px;
        line-height: 1.45;
      }
    `}</style>
  );
}
