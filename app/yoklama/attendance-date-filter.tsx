"use client";

import { useEffect, useMemo, useState } from "react";

type Group = {
  id: string;
  branch_id?: string | null;
  name?: string | null;
};

type Schedule = {
  id: string;
  group_id?: string | null;
  weekday?: number | null;
  start_time?: string | null;
  end_time?: string | null;
  is_active?: boolean | null;
};

const DAY_NAMES: Record<number, string> = {
  1: "Pazartesi",
  2: "Salı",
  3: "Çarşamba",
  4: "Perşembe",
  5: "Cuma",
  6: "Cumartesi",
  7: "Pazar",
};

function weekdayFromDate(value: string) {
  if (!value) return 0;
  const date = new Date(`${value}T12:00:00`);
  const day = date.getDay();
  return day === 0 ? 7 : day;
}

function todayTR() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export default function AttendanceDateFilter({
  groups,
  schedules,
}: {
  groups: Group[];
  schedules: Schedule[];
}) {
  const [date, setDate] = useState(todayTR());

  const weekday = weekdayFromDate(date);

  const eligibleGroupIds = useMemo(() => {
    return new Set(
      schedules
        .filter(
          (schedule) =>
            schedule.is_active !== false &&
            Number(schedule.weekday) === weekday &&
            !!schedule.group_id
        )
        .map((schedule) => schedule.group_id as string)
    );
  }, [schedules, weekday]);

  const eligibleCount = groups.filter((group) =>
    eligibleGroupIds.has(group.id)
  ).length;

  useEffect(() => {
    const root = document.querySelector<HTMLElement>("[data-attendance-client]");
    if (!root) return;

    // TypeScript, iç içe callback'lerde null kontrolünü korumayabildiği için
    // null olmadığı kesinleşmiş DOM referansını ayrı sabit olarak kullanıyoruz.
    const attendanceRoot: HTMLElement = root;
    let disposed = false;

    function sync() {
      if (disposed) return;

      const dateInput = attendanceRoot.querySelector<HTMLInputElement>('input[type="date"]');
      const selects = Array.from(attendanceRoot.querySelectorAll<HTMLSelectElement>("select"));
      const groupSelect = selects[0];

      if (!dateInput || !groupSelect) return;

      const currentDate = dateInput.value || todayTR();
      if (currentDate !== date) setDate(currentDate);

      const currentWeekday = weekdayFromDate(currentDate);
      const validGroups = new Set(
        schedules
          .filter(
            (schedule) =>
              schedule.is_active !== false &&
              Number(schedule.weekday) === currentWeekday &&
              !!schedule.group_id
          )
          .map((schedule) => schedule.group_id as string)
      );

      const groupOptions = Array.from(groupSelect.options);
      groupOptions.forEach((option) => {
        if (!option.value) return;
        option.hidden = !validGroups.has(option.value);
        option.disabled = !validGroups.has(option.value);
      });

      if (groupSelect.value && !validGroups.has(groupSelect.value)) {
        const firstValid = groupOptions.find(
          (option) => option.value && validGroups.has(option.value)
        );

        if (firstValid) {
          groupSelect.value = firstValid.value;
          groupSelect.dispatchEvent(new Event("change", { bubbles: true }));
        }
      }

      window.setTimeout(() => {
        const currentSelects = Array.from(
          attendanceRoot.querySelectorAll<HTMLSelectElement>("select")
        );
        const currentScheduleSelect = currentSelects[1];
        if (!currentScheduleSelect) return;

        const groupId = groupSelect.value;
        const validScheduleIds = new Set(
          schedules
            .filter(
              (schedule) =>
                schedule.is_active !== false &&
                schedule.group_id === groupId &&
                Number(schedule.weekday) === currentWeekday
            )
            .map((schedule) => schedule.id)
        );

        const scheduleOptions = Array.from(currentScheduleSelect.options);
        scheduleOptions.forEach((option) => {
          if (!option.value) return;
          option.hidden = !validScheduleIds.has(option.value);
          option.disabled = !validScheduleIds.has(option.value);
        });

        if (
          currentScheduleSelect.value &&
          !validScheduleIds.has(currentScheduleSelect.value)
        ) {
          const firstValidSchedule = scheduleOptions.find(
            (option) => option.value && validScheduleIds.has(option.value)
          );

          if (firstValidSchedule) {
            currentScheduleSelect.value = firstValidSchedule.value;
            currentScheduleSelect.dispatchEvent(new Event("change", { bubbles: true }));
          }
        }
      }, 0);
    }

    const dateInput = attendanceRoot.querySelector<HTMLInputElement>('input[type="date"]');
    const selects = Array.from(attendanceRoot.querySelectorAll<HTMLSelectElement>("select"));
    const groupSelect = selects[0];

    const onDateChange = () => window.setTimeout(sync, 0);
    const onGroupChange = () => window.setTimeout(sync, 0);
    const onClick = () => window.setTimeout(sync, 0);

    dateInput?.addEventListener("change", onDateChange);
    groupSelect?.addEventListener("change", onGroupChange);
    attendanceRoot.addEventListener("click", onClick);

    const observer = new MutationObserver(() => window.setTimeout(sync, 0));
    observer.observe(attendanceRoot, { childList: true, subtree: true });

    sync();

    return () => {
      disposed = true;
      dateInput?.removeEventListener("change", onDateChange);
      groupSelect?.removeEventListener("change", onGroupChange);
      attendanceRoot.removeEventListener("click", onClick);
      observer.disconnect();
    };
  }, [date, schedules]);

  return (
    <div className="attendanceDateFilterNote" aria-live="polite">
      <span className="attendanceDateFilterDay">
        {DAY_NAMES[weekday] || "Seçilen gün"}
      </span>
      <span>
        Bu güne ait {eligibleCount} grup gösteriliyor. Tarihi değiştirince uygun grup ve seanslar otomatik süzülür.
      </span>
    </div>
  );
}
