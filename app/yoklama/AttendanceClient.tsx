"use client";

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";

import {
  getAttendanceForDate,
  getMonthlyAttendance,
  saveAttendance,
} from "./actions";

type Group = {
  id: string;
  organization_id: string;
  branch_id: string | null;
  name: string;
  course_type: string | null;
  capacity: number | null;
  primary_coach_id: string | null;
};

type Schedule = {
  id: string;
  organization_id: string;
  branch_id: string | null;
  group_id: string;
  coach_id: string | null;
  weekday: number;
  start_time: string | null;
  end_time: string | null;
  is_active: boolean;
};

type Membership = {
  id: string;
  student_id: string;
  group_id: string;
  level_id: string | null;
  started_at: string | null;
  ended_at: string | null;
  is_active: boolean;
};

type Student = {
  id: string;
  first_name: string;
  last_name: string;
  student_number: string | null;

  phone: string | null;
  email: string | null;

  guardian_name: string | null;
  guardian_phone: string | null;
  guardian_email: string | null;

  swimming_level: string | null;
  medical_note: string | null;
  general_note: string | null;

  preferred_days: string | null;
  preferred_time: string | null;
};

type Enrollment = {
  id: string;
  student_id: string;
  group_id: string | null;
  start_date: string | null;
  planned_end_date: string | null;
  total_lessons: number | null;
  used_lessons: number | null;
  status: string | null;
};

type AttendanceStatus =
  | "present"
  | "absent"
  | "excused"
  | "compensation";

type AttendanceRecord = {
  id?: string;
  student_id: string;
  enrollment_id?: string | null;
  group_id: string;
  schedule_id: string;
  coach_id?: string | null;
  lesson_date: string;
  status: AttendanceStatus;
  coach_note?: string | null;
  recorded_by?: string | null;
  updated_by?: string | null;
  edited_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type Props = {
  organizationId: string;
  currentProfileId: string;
  groups: Group[];
  schedules: Schedule[];
  memberships: Membership[];
  students: Student[];
  enrollments: Enrollment[];
};

type ViewMode = "daily" | "monthly" | "history";

const DAY_NAMES: Record<number, string> = {
  1: "Pazartesi",
  2: "Salı",
  3: "Çarşamba",
  4: "Perşembe",
  5: "Cuma",
  6: "Cumartesi",
  7: "Pazar",
};

const STATUS_META: Record<
  AttendanceStatus,
  {
    label: string;
    short: string;
    icon: string;
    bg: string;
    color: string;
    border: string;
  }
> = {
  present: {
    label: "Geldi",
    short: "✓",
    icon: "✓",
    bg: "#ecfdf3",
    color: "#15803d",
    border: "#86efac",
  },

  absent: {
    label: "Gelmedi",
    short: "✕",
    icon: "✕",
    bg: "#fff1f2",
    color: "#be123c",
    border: "#fda4af",
  },

  excused: {
    label: "İzinli",
    short: "İ",
    icon: "○",
    bg: "#fffbeb",
    color: "#a16207",
    border: "#fde68a",
  },

  compensation: {
    label: "Telafi",
    short: "T",
    icon: "+",
    bg: "#eef2ff",
    color: "#4338ca",
    border: "#c7d2fe",
  },
};

function todayInTurkey() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function currentMonthInTurkey() {
  return todayInTurkey().slice(0, 7);
}

function shortTime(value?: string | null) {
  if (!value) return "—";

  return value.slice(0, 5);
}

function formatDateTR(value: string) {
  if (!value) return "—";

  try {
    return new Intl.DateTimeFormat("tr-TR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(new Date(`${value}T12:00:00`));
  } catch {
    return value;
  }
}

function formatShortDate(value: string) {
  try {
    return new Intl.DateTimeFormat("tr-TR", {
      day: "2-digit",
      month: "2-digit",
    }).format(new Date(`${value}T12:00:00`));
  } catch {
    return value;
  }
}

function weekdayFromDate(value: string) {
  const date = new Date(`${value}T12:00:00`);

  const jsDay = date.getDay();

  return jsDay === 0 ? 7 : jsDay;
}

function shiftDate(value: string, amount: number) {
  const date = new Date(`${value}T12:00:00`);

  date.setDate(date.getDate() + amount);

  const year = date.getFullYear();

  const month = String(date.getMonth() + 1).padStart(
    2,
    "0"
  );

  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function remainingLessons(enrollment?: Enrollment | null) {
  if (!enrollment) return 0;

  const total = Number(enrollment.total_lessons || 0);

  const used = Number(enrollment.used_lessons || 0);

  return Math.max(0, total - used);
}

function cleanPhone(value?: string | null) {
  if (!value) return "";

  return value.replace(/\D/g, "");
}

function getCallPhone(student: Student) {
  const guardian = cleanPhone(student.guardian_phone);

  if (guardian.length >= 10) {
    return guardian;
  }

  const studentPhone = cleanPhone(student.phone);

  if (studentPhone.length >= 10) {
    return studentPhone;
  }

  return "";
}

function toInternationalPhone(value: string) {
  let phone = cleanPhone(value);

  if (!phone) return "";

  if (phone.startsWith("00")) {
    phone = phone.slice(2);
  }

  if (phone.startsWith("90")) {
    return phone;
  }

  if (phone.startsWith("0")) {
    return `90${phone.slice(1)}`;
  }

  if (phone.length === 10) {
    return `90${phone}`;
  }

  return phone;
}

function monthLessonDates(
  month: string,
  schedules: Schedule[]
) {
  if (!month || !schedules.length) return [];

  const [yearText, monthText] = month.split("-");

  const year = Number(yearText);

  const monthIndex = Number(monthText) - 1;

  const daysInMonth = new Date(
    year,
    monthIndex + 1,
    0
  ).getDate();

  const activeWeekdays = new Set(
    schedules.map((schedule) => schedule.weekday)
  );

  const dates: string[] = [];

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(year, monthIndex, day, 12);

    const jsDay = date.getDay();

    const weekday = jsDay === 0 ? 7 : jsDay;

    if (!activeWeekdays.has(weekday)) {
      continue;
    }

    const monthValue = String(monthIndex + 1).padStart(
      2,
      "0"
    );

    const dayValue = String(day).padStart(2, "0");

    dates.push(`${year}-${monthValue}-${dayValue}`);
  }

  return dates;
}

export default function AttendanceClient({
  organizationId,
  currentProfileId,
  groups,
  schedules,
  memberships,
  students,
  enrollments,
}: Props) {
  const [viewMode, setViewMode] =
    useState<ViewMode>("daily");

  const [lessonDate, setLessonDate] = useState(
    todayInTurkey()
  );

  const [selectedGroupId, setSelectedGroupId] =
    useState(groups[0]?.id || "");

  const [selectedScheduleId, setSelectedScheduleId] =
    useState("");

  const [month, setMonth] = useState(
    currentMonthInTurkey()
  );

  const [statuses, setStatuses] = useState<
    Record<string, AttendanceStatus>
  >({});

  const [notes, setNotes] = useState<
    Record<string, string>
  >({});

  const [monthlyRecords, setMonthlyRecords] = useState<
    AttendanceRecord[]
  >([]);

  const [message, setMessage] = useState("");

  const [dailyLoaded, setDailyLoaded] =
    useState(false);

  const [contactStudentId, setContactStudentId] =
    useState<string | null>(null);

  const [isPending, startTransition] =
    useTransition();

  const selectedGroup = useMemo(
    () =>
      groups.find(
        (group) => group.id === selectedGroupId
      ) || null,
    [groups, selectedGroupId]
  );

  const groupSchedules = useMemo(
    () =>
      schedules.filter(
        (schedule) =>
          schedule.group_id === selectedGroupId &&
          schedule.is_active
      ),
    [schedules, selectedGroupId]
  );

  const selectedSchedule =
    groupSchedules.find(
      (schedule) =>
        schedule.id === selectedScheduleId
    ) || null;

  const groupStudentIds = useMemo(() => {
    return new Set(
      memberships
        .filter(
          (membership) =>
            membership.group_id ===
              selectedGroupId &&
            membership.is_active
        )
        .map(
          (membership) =>
            membership.student_id
        )
    );
  }, [memberships, selectedGroupId]);

  const groupStudents = useMemo(() => {
    return students
      .filter((student) =>
        groupStudentIds.has(student.id)
      )
      .sort((a, b) =>
        `${a.first_name} ${a.last_name}`.localeCompare(
          `${b.first_name} ${b.last_name}`,
          "tr"
        )
      );
  }, [students, groupStudentIds]);

  const enrollmentByStudent = useMemo(() => {
    const map = new Map<string, Enrollment>();

    enrollments.forEach((enrollment) => {
      if (
        enrollment.group_id === selectedGroupId
      ) {
        map.set(
          enrollment.student_id,
          enrollment
        );
      }
    });

    return map;
  }, [enrollments, selectedGroupId]);

  const counts = useMemo(() => {
    let present = 0;
    let absent = 0;
    let excused = 0;
    let compensation = 0;

    groupStudents.forEach((student) => {
      const status = statuses[student.id];

      if (status === "present") present += 1;

      if (status === "absent") absent += 1;

      if (status === "excused") excused += 1;

      if (status === "compensation")
        compensation += 1;
    });

    return {
      present,
      absent,
      excused,
      compensation,

      missing:
        groupStudents.length -
        present -
        absent -
        excused -
        compensation,
    };
  }, [statuses, groupStudents]);

  const lessonDates = useMemo(
    () =>
      monthLessonDates(month, groupSchedules),
    [month, groupSchedules]
  );

  const monthlyRecordMap = useMemo(() => {
    const map = new Map<
      string,
      AttendanceRecord
    >();

    monthlyRecords.forEach((record) => {
      map.set(
        `${record.student_id}_${record.lesson_date}`,
        record
      );
    });

    return map;
  }, [monthlyRecords]);

  const historyRows = useMemo(() => {
    return [...monthlyRecords].sort((a, b) =>
      b.lesson_date.localeCompare(a.lesson_date)
    );
  }, [monthlyRecords]);

  useEffect(() => {
    if (!selectedGroupId) return;

    if (!groupSchedules.length) {
      setSelectedScheduleId("");

      return;
    }

    const selectedWeekday =
      weekdayFromDate(lessonDate);

    const sameDaySchedule =
      groupSchedules.find(
        (schedule) =>
          schedule.weekday === selectedWeekday
      );

    setSelectedScheduleId(
      sameDaySchedule?.id ||
        groupSchedules[0].id
    );
  }, [
    selectedGroupId,
    lessonDate,
    groupSchedules,
  ]);

  useEffect(() => {
    if (
      !selectedGroupId ||
      !selectedScheduleId ||
      !lessonDate
    ) {
      return;
    }

    let cancelled = false;

    startTransition(async () => {
      const result =
        await getAttendanceForDate({
          groupId: selectedGroupId,
          scheduleId: selectedScheduleId,
          lessonDate,
        });

      if (cancelled) return;

      if (!result.ok) {
        setStatuses({});
        setNotes({});
        setDailyLoaded(false);
        setMessage(result.message);

        return;
      }

      const nextStatuses: Record<
        string,
        AttendanceStatus
      > = {};

      const nextNotes: Record<
        string,
        string
      > = {};

      (result.records || []).forEach(
        (record: any) => {
          if (
            record.status === "present" ||
            record.status === "absent" ||
            record.status === "excused" ||
            record.status === "compensation"
          ) {
            nextStatuses[record.student_id] =
              record.status;
          }

          nextNotes[record.student_id] =
            record.coach_note || "";
        }
      );

      setStatuses(nextStatuses);

      setNotes(nextNotes);

      setDailyLoaded(
        (result.records || []).length > 0
      );

      setMessage(result.message);
    });

    return () => {
      cancelled = true;
    };
  }, [
    selectedGroupId,
    selectedScheduleId,
    lessonDate,
  ]);

  useEffect(() => {
    if (
      viewMode !== "monthly" &&
      viewMode !== "history"
    ) {
      return;
    }

    if (!selectedGroupId || !month) {
      return;
    }

    let cancelled = false;

    startTransition(async () => {
      const result =
        await getMonthlyAttendance({
          groupId: selectedGroupId,
          month,
        });

      if (cancelled) return;

      if (!result.ok) {
        setMonthlyRecords([]);
        setMessage(result.message);

        return;
      }

      setMonthlyRecords(
        (result.records || []) as AttendanceRecord[]
      );

      setMessage(result.message);
    });

    return () => {
      cancelled = true;
    };
  }, [viewMode, selectedGroupId, month]);

  function selectGroup(groupId: string) {
    setSelectedGroupId(groupId);

    setStatuses({});

    setNotes({});

    setMonthlyRecords([]);

    setDailyLoaded(false);

    setContactStudentId(null);

    setMessage("");
  }

  function selectStatus(
    studentId: string,
    status: AttendanceStatus
  ) {
    setStatuses((current) => ({
      ...current,
      [studentId]: status,
    }));
  }

  function markAllPresent() {
    const next: Record<
      string,
      AttendanceStatus
    > = {};

    groupStudents.forEach((student) => {
      next[student.id] = "present";
    });

    setStatuses(next);
  }

  function clearAll() {
    setStatuses({});
    setNotes({});
    setMessage("Yoklama seçimleri temizlendi.");
  }

  function handleSave() {
    setMessage("");

    if (!selectedGroupId) {
      setMessage("Önce grup seçmelisiniz.");
      return;
    }

    if (!selectedScheduleId) {
      setMessage(
        "Bu grup için ders seansı bulunamadı."
      );
      return;
    }

    if (!groupStudents.length) {
      setMessage(
        "Bu grupta aktif öğrenci bulunmuyor."
      );
      return;
    }

    const missing = groupStudents.filter(
      (student) => !statuses[student.id]
    );

    if (missing.length) {
      setMessage(
        `${missing.length} öğrenci için yoklama durumu seçilmedi.`
      );

      return;
    }

    const records = groupStudents.map(
      (student) => {
        const enrollment =
          enrollmentByStudent.get(
            student.id
          ) ||
          enrollments.find(
            (item) =>
              item.student_id === student.id
          ) ||
          null;

        return {
          studentId: student.id,
          enrollmentId:
            enrollment?.id || null,
          status: statuses[student.id],
          coachNote:
            notes[student.id]?.trim() ||
            null,
        };
      }
    );

    startTransition(async () => {
      const result = await saveAttendance({
        organizationId,
        currentProfileId,

        branchId:
          selectedSchedule?.branch_id ||
          selectedGroup?.branch_id ||
          null,

        groupId: selectedGroupId,

        scheduleId:
          selectedScheduleId,

        coachId:
          selectedSchedule?.coach_id ||
          selectedGroup?.primary_coach_id ||
          null,

        lessonDate,

        records,
      });

      setMessage(result.message);

      if (result.ok) {
        setDailyLoaded(true);

        if (
          viewMode === "monthly" ||
          viewMode === "history"
        ) {
          const monthly =
            await getMonthlyAttendance({
              groupId:
                selectedGroupId,
              month,
            });

          if (monthly.ok) {
            setMonthlyRecords(
              (monthly.records ||
                []) as AttendanceRecord[]
            );
          }
        }
      }
    });
  }

  function openDayFromMonthly(date: string) {
    setLessonDate(date);

    setViewMode("daily");

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  function callStudent(student: Student) {
    const phone = getCallPhone(student);

    if (!phone) {
      setMessage(
        `${student.first_name} ${student.last_name} için geçerli telefon bilgisi bulunamadı.`
      );

      return;
    }

    window.location.href = `tel:${phone}`;
  }

  function whatsappStudent(
    student: Student
  ) {
    const phone = getCallPhone(student);

    if (!phone) {
      setMessage(
        `${student.first_name} ${student.last_name} için WhatsApp telefonu bulunamadı.`
      );

      return;
    }

    const international =
      toInternationalPhone(phone);

    window.open(
      `https://wa.me/${international}`,
      "_blank",
      "noopener,noreferrer"
    );
  }

  async function copyStudentPhone(
    student: Student
  ) {
    const phone = getCallPhone(student);

    if (!phone) {
      setMessage(
        "Kopyalanacak telefon bilgisi yok."
      );

      return;
    }

    try {
      await navigator.clipboard.writeText(
        phone
      );

      setMessage(
        "Telefon numarası kopyalandı."
      );
    } catch {
      setMessage(
        `Telefon: ${phone}`
      );
    }
  }

  const selectedDateWeekday =
    weekdayFromDate(lessonDate);

  const scheduleMatchesDate =
    !!selectedSchedule &&
    selectedSchedule.weekday ===
      selectedDateWeekday;

  return (
    <div
      style={{
        display: "grid",
        gap: 20,
      }}
    >
      <section
        style={{
          display: "flex",
          gap: 10,
          flexWrap: "wrap",
          padding: 10,
          background: "#ffffff",
          border:
            "1px solid #dce7f2",
          borderRadius: 18,
          boxShadow:
            "0 12px 35px rgba(16,47,85,.06)",
        }}
      >
        <Link
          href="/"
          style={navButton(false)}
        >
          🏠 Ana Panel
        </Link>

        <button
          type="button"
          onClick={() =>
            setViewMode("daily")
          }
          style={navButton(
            viewMode === "daily"
          )}
        >
          ✓ Günlük Yoklama
        </button>

        <button
          type="button"
          onClick={() =>
            setViewMode("monthly")
          }
          style={navButton(
            viewMode === "monthly"
          )}
        >
          🗓️ Tüm Ayı Gör
        </button>

        <button
          type="button"
          onClick={() =>
            setViewMode("history")
          }
          style={navButton(
            viewMode === "history"
          )}
        >
          ↺ Geçmiş
        </button>

        <Link
          href="/ogrenciler"
          style={navButton(false)}
        >
          👥 Öğrenciler
        </Link>
      </section>

      <section
        style={{
          background: "#102f55",
          borderRadius: 22,
          padding: 22,
          color: "#fff",
          boxShadow:
            "0 20px 50px rgba(16,47,85,.16)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent:
              "space-between",
            alignItems: "center",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <div>
            <div
              style={{
                fontSize: 12,
                fontWeight: 900,
                letterSpacing: ".12em",
                color: "#93c5fd",
              }}
            >
              SPRINTOS · YOKLAMA
            </div>

            <h2
              style={{
                margin: "5px 0 0",
                fontSize: 28,
              }}
            >
              Yoklama & Ders Yönetimi
            </h2>

            <p
              style={{
                margin: "7px 0 0",
                color: "#cbd9e8",
                fontSize: 13,
              }}
            >
              Günlük yoklama,
              geçmiş düzenleme,
              aylık takip ve öğrenci
              iletişimi tek ekranda.
            </p>
          </div>

          <div
            style={{
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            <button
              type="button"
              onClick={() =>
                setLessonDate(
                  shiftDate(
                    lessonDate,
                    -1
                  )
                )
              }
              style={darkButton()}
            >
              ← Önceki
            </button>

            <button
              type="button"
              onClick={() =>
                setLessonDate(
                  todayInTurkey()
                )
              }
              style={darkButton(true)}
            >
              Bugün
            </button>

            <button
              type="button"
              onClick={() =>
                setLessonDate(
                  shiftDate(
                    lessonDate,
                    1
                  )
                )
              }
              style={darkButton()}
            >
              Sonraki →
            </button>
          </div>
        </div>
      </section>

      <section
        style={{
          background: "#fff",
          border:
            "1px solid #dce7f2",
          borderRadius: 22,
          padding: 20,
          boxShadow:
            "0 14px 36px rgba(15,42,76,.07)",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "minmax(180px,1fr) minmax(260px,2fr) minmax(250px,1.5fr)",
            gap: 14,
          }}
        >
          <label
            style={labelStyle}
          >
            TARİH

            <input
              type="date"
              value={lessonDate}
              onChange={(event) =>
                setLessonDate(
                  event.target.value
                )
              }
              style={fieldStyle}
            />
          </label>

          <label
            style={labelStyle}
          >
            GRUP

            <select
              value={selectedGroupId}
              onChange={(event) =>
                selectGroup(
                  event.target.value
                )
              }
              style={fieldStyle}
            >
              {!groups.length && (
                <option value="">
                  Grup bulunamadı
                </option>
              )}

              {groups.map((group) => (
                <option
                  key={group.id}
                  value={group.id}
                >
                  {group.name}
                  {group.course_type
                    ? ` · ${group.course_type}`
                    : ""}
                </option>
              ))}
            </select>
          </label>

          <label
            style={labelStyle}
          >
            DERS / SEANS

            <select
              value={selectedScheduleId}
              onChange={(event) =>
                setSelectedScheduleId(
                  event.target.value
                )
              }
              style={fieldStyle}
            >
              <option value="">
                Seans seçin
              </option>

              {groupSchedules.map(
                (schedule) => (
                  <option
                    key={schedule.id}
                    value={schedule.id}
                  >
                    {DAY_NAMES[
                      schedule.weekday
                    ] ||
                      `Gün ${schedule.weekday}`}
                    {" · "}
                    {shortTime(
                      schedule.start_time
                    )}
                    {" - "}
                    {shortTime(
                      schedule.end_time
                    )}
                  </option>
                )
              )}
            </select>
          </label>
        </div>

        <div
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            marginTop: 16,
          }}
        >
          {groupSchedules.map(
            (schedule) => (
              <span
                key={schedule.id}
                style={{
                  padding:
                    "8px 11px",
                  borderRadius: 999,
                  background:
                    "#f0f6fc",
                  color: "#315577",
                  fontSize: 12,
                  fontWeight: 800,
                }}
              >
                {
                  DAY_NAMES[
                    schedule.weekday
                  ]
                }
                {" · "}
                {shortTime(
                  schedule.start_time
                )}
              </span>
            )
          )}
        </div>

        {!scheduleMatchesDate &&
          selectedSchedule && (
            <div
              style={{
                marginTop: 14,
                padding: 12,
                borderRadius: 12,
                background:
                  "#fff7ed",
                border:
                  "1px solid #fed7aa",
                color: "#9a3412",
                fontWeight: 800,
                fontSize: 12,
              }}
            >
              ⚠️ Seçili tarih,
              seçilen seansın normal
              ders günü ile
              eşleşmiyor. Geriye
              dönük düzenleme veya
              özel ders kaydı için
              yine de kullanabilirsiniz.
            </div>
          )}
      </section>

      {viewMode === "daily" && (
        <>
          <section
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(6,minmax(120px,1fr))",
              gap: 10,
            }}
          >
            <StatCard
              title="Toplam"
              value={
                groupStudents.length
              }
              tone="blue"
            />

            <StatCard
              title="Geldi"
              value={counts.present}
              tone="green"
            />

            <StatCard
              title="Gelmedi"
              value={counts.absent}
              tone="red"
            />

            <StatCard
              title="İzinli"
              value={counts.excused}
              tone="yellow"
            />

            <StatCard
              title="Telafi"
              value={
                counts.compensation
              }
              tone="purple"
            />

            <StatCard
              title="Eksik"
              value={counts.missing}
              tone="gray"
            />
          </section>

          <section
            style={{
              background: "#fff",
              border:
                "1px solid #dce7f2",
              borderRadius: 22,
              overflow: "hidden",
              boxShadow:
                "0 14px 36px rgba(15,42,76,.07)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent:
                  "space-between",
                alignItems:
                  "center",
                gap: 12,
                padding:
                  "16px 18px",
                background:
                  "#edf4fb",
                flexWrap: "wrap",
              }}
            >
              <div>
                <strong
                  style={{
                    color:
                      "#143b65",
                  }}
                >
                  {formatDateTR(
                    lessonDate
                  )}
                  {" · "}
                  {selectedSchedule
                    ? DAY_NAMES[
                        selectedSchedule
                          .weekday
                      ]
                    : ""}
                </strong>

                <div
                  style={{
                    marginTop: 4,
                    fontSize: 11,
                    color:
                      "#738297",
                  }}
                >
                  {dailyLoaded
                    ? "Kayıtlı yoklama açıldı. Değişiklik yapıp tekrar kaydedebilirsiniz."
                    : "Yeni yoklama kaydı."}
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  gap: 8,
                }}
              >
                <button
                  type="button"
                  onClick={
                    markAllPresent
                  }
                  style={actionButton(
                    "#ecfdf3",
                    "#15803d"
                  )}
                >
                  ✓ Tümünü Geldi
                </button>

                <button
                  type="button"
                  onClick={clearAll}
                  style={actionButton(
                    "#f8fafc",
                    "#64748b"
                  )}
                >
                  Temizle
                </button>
              </div>
            </div>

            {groupStudents.map(
              (student) => {
                const enrollment =
                  enrollmentByStudent.get(
                    student.id
                  ) || null;

                const remaining =
                  remainingLessons(
                    enrollment
                  );

                const phone =
                  getCallPhone(student);

                const hasWarning =
                  !!student.medical_note ||
                  !!student.general_note ||
                  remaining <= 2;

                const contactOpen =
                  contactStudentId ===
                  student.id;

                return (
                  <div
                    key={student.id}
                    style={{
                      padding: 18,
                      borderTop:
                        "1px solid #edf2f7",
                      display:
                        "grid",
                      gap: 14,
                    }}
                  >
                    <div
                      style={{
                        display:
                          "flex",
                        justifyContent:
                          "space-between",
                        gap: 16,
                        flexWrap:
                          "wrap",
                      }}
                    >
                      <div
                        style={{
                          minWidth:
                            240,
                          flex: 1,
                        }}
                      >
                        <div
                          style={{
                            display:
                              "flex",
                            gap: 8,
                            alignItems:
                              "center",
                            flexWrap:
                              "wrap",
                          }}
                        >
                          <strong
                            style={{
                              fontSize:
                                16,
                              color:
                                "#123b68",
                            }}
                          >
                            {
                              student.first_name
                            }{" "}
                            {
                              student.last_name
                            }
                          </strong>

                          {hasWarning && (
                            <span
                              style={{
                                padding:
                                  "4px 8px",
                                borderRadius:
                                  999,
                                background:
                                  "#fff7ed",
                                color:
                                  "#c2410c",
                                fontSize:
                                  10,
                                fontWeight:
                                  900,
                              }}
                            >
                              ⚠ İKAZ
                            </span>
                          )}
                        </div>

                        <div
                          style={{
                            marginTop:
                              5,
                            display:
                              "flex",
                            gap: 7,
                            flexWrap:
                              "wrap",
                            fontSize:
                              11,
                            color:
                              "#7b899b",
                          }}
                        >
                          <span>
                            {student.student_number ||
                              "Öğrenci no yok"}
                          </span>

                          {student.swimming_level && (
                            <span>
                              🏊{" "}
                              {
                                student.swimming_level
                              }
                            </span>
                          )}

                          <span>
                            📚{" "}
                            {remaining}{" "}
                            ders kaldı
                          </span>

                          {enrollment?.planned_end_date && (
                            <span>
                              📅 Bitiş:{" "}
                              {formatDateTR(
                                enrollment.planned_end_date
                              )}
                            </span>
                          )}
                        </div>
                      </div>

                      <div
                        style={{
                          display:
                            "flex",
                          gap: 7,
                          flexWrap:
                            "wrap",
                        }}
                      >
                        <button
                          type="button"
                          onClick={() =>
                            setContactStudentId(
                              contactOpen
                                ? null
                                : student.id
                            )
                          }
                          style={miniButton(
                            "#eff6ff",
                            "#1d4ed8"
                          )}
                        >
                          📞 İletişim
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            callStudent(
                              student
                            )
                          }
                          disabled={
                            !phone
                          }
                          style={miniButton(
                            phone
                              ? "#ecfdf3"
                              : "#f1f5f9",
                            phone
                              ? "#15803d"
                              : "#94a3b8"
                          )}
                        >
                          ☎ Ara
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            whatsappStudent(
                              student
                            )
                          }
                          disabled={
                            !phone
                          }
                          style={miniButton(
                            phone
                              ? "#ecfdf5"
                              : "#f1f5f9",
                            phone
                              ? "#047857"
                              : "#94a3b8"
                          )}
                        >
                          💬 WhatsApp
                        </button>

                        <Link
                          href={`/ogrenciler/${student.id}`}
                          style={miniButton(
                            "#f8fafc",
                            "#475569"
                          )}
                        >
                          👤 Detay
                        </Link>
                      </div>
                    </div>

                    {contactOpen && (
                      <div
                        style={{
                          padding: 14,
                          borderRadius:
                            14,
                          background:
                            "#f8fbff",
                          border:
                            "1px solid #dbeafe",
                          display:
                            "flex",
                          justifyContent:
                            "space-between",
                          gap: 12,
                          flexWrap:
                            "wrap",
                        }}
                      >
                        <div>
                          <strong
                            style={{
                              display:
                                "block",
                              color:
                                "#173f69",
                            }}
                          >
                            {student.guardian_name
                              ? `Veli: ${student.guardian_name}`
                              : "İletişim Bilgileri"}
                          </strong>

                          <span
                            style={{
                              display:
                                "block",
                              marginTop:
                                5,
                              color:
                                "#64748b",
                              fontSize:
                                12,
                            }}
                          >
                            Veli Tel:{" "}
                            {student.guardian_phone ||
                              "—"}
                            {" · "}
                            Öğrenci Tel:{" "}
                            {student.phone ||
                              "—"}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            copyStudentPhone(
                              student
                            )
                          }
                          style={miniButton(
                            "#fff",
                            "#315577"
                          )}
                        >
                          📋 Numarayı Kopyala
                        </button>
                      </div>
                    )}

                    {(student.medical_note ||
                      student.general_note) && (
                      <div
                        style={{
                          display:
                            "flex",
                          gap: 8,
                          flexWrap:
                            "wrap",
                        }}
                      >
                        {student.medical_note && (
                          <span
                            style={warningBadge}
                          >
                            🩺{" "}
                            {
                              student.medical_note
                            }
                          </span>
                        )}

                        {student.general_note && (
                          <span
                            style={{
                              ...warningBadge,
                              background:
                                "#eff6ff",
                              color:
                                "#1d4ed8",
                              borderColor:
                                "#bfdbfe",
                            }}
                          >
                            📝{" "}
                            {
                              student.general_note
                            }
                          </span>
                        )}
                      </div>
                    )}

                    <div
                      style={{
                        display:
                          "grid",
                        gridTemplateColumns:
                          "minmax(520px,2fr) minmax(220px,1fr)",
                        gap: 12,
                      }}
                    >
                      <div
                        style={{
                          display:
                            "grid",
                          gridTemplateColumns:
                            "repeat(4,1fr)",
                          gap: 8,
                        }}
                      >
                        {(
                          Object.keys(
                            STATUS_META
                          ) as AttendanceStatus[]
                        ).map(
                          (status) => {
                            const meta =
                              STATUS_META[
                                status
                              ];

                            const active =
                              statuses[
                                student.id
                              ] ===
                              status;

                            return (
                              <button
                                key={
                                  status
                                }
                                type="button"
                                onClick={() =>
                                  selectStatus(
                                    student.id,
                                    status
                                  )
                                }
                                style={{
                                  minHeight:
                                    48,
                                  borderRadius:
                                    13,
                                  border:
                                    active
                                      ? `2px solid ${meta.border}`
                                      : "1px solid #dbe5ef",
                                  background:
                                    active
                                      ? meta.bg
                                      : "#fff",
                                  color:
                                    active
                                      ? meta.color
                                      : "#53677f",
                                  fontWeight:
                                    900,
                                  cursor:
                                    "pointer",
                                  fontSize:
                                    13,
                                }}
                              >
                                {
                                  meta.icon
                                }{" "}
                                {
                                  meta.label
                                }
                              </button>
                            );
                          }
                        )}
                      </div>

                      <input
                        type="text"
                        placeholder="Antrenör notu..."
                        value={
                          notes[
                            student.id
                          ] || ""
                        }
                        onChange={(
                          event
                        ) =>
                          setNotes(
                            (
                              current
                            ) => ({
                              ...current,
                              [student.id]:
                                event
                                  .target
                                  .value,
                            })
                          )
                        }
                        style={{
                          width:
                            "100%",
                          minHeight:
                            48,
                          padding:
                            "0 12px",
                          border:
                            "1px solid #dbe5ef",
                          borderRadius:
                            13,
                          color:
                            "#183b61",
                        }}
                      />
                    </div>
                  </div>
                );
              }
            )}

            {!groupStudents.length && (
              <div
                style={{
                  padding: 40,
                  textAlign:
                    "center",
                  color:
                    "#7b899a",
                }}
              >
                Bu grupta aktif
                öğrenci bulunamadı.
              </div>
            )}
          </section>

          <section
            style={{
              position: "sticky",
              bottom: 12,
              zIndex: 20,
              display: "flex",
              justifyContent:
                "space-between",
              alignItems: "center",
              gap: 16,
              flexWrap: "wrap",
              padding: 18,
              background:
                "rgba(255,255,255,.96)",
              backdropFilter:
                "blur(12px)",
              border:
                "1px solid #dce7f2",
              borderRadius: 18,
              boxShadow:
                "0 16px 45px rgba(16,47,85,.14)",
            }}
          >
            <div>
              <strong
                style={{
                  display: "block",
                  color:
                    message.includes(
                      "başarı"
                    ) ||
                    message.includes(
                      "yüklendi"
                    )
                      ? "#15803d"
                      : "#8a5a00",
                }}
              >
                {message ||
                  "Yoklama kaydedilmeye hazır."}
              </strong>

              <span
                style={{
                  display: "block",
                  marginTop: 4,
                  fontSize: 11,
                  color: "#7d8998",
                }}
              >
                Eksik işaretleme:{" "}
                {counts.missing}
              </span>
            </div>

            <button
              type="button"
              disabled={isPending}
              onClick={handleSave}
              style={{
                minWidth: 255,
                minHeight: 54,
                border: 0,
                borderRadius: 14,
                background:
                  isPending
                    ? "#94a3b8"
                    : dailyLoaded
                    ? "#0f766e"
                    : "#0b6ff4",
                color: "#fff",
                cursor:
                  isPending
                    ? "wait"
                    : "pointer",
                fontWeight: 900,
                fontSize: 14,
                boxShadow:
                  "0 9px 25px rgba(11,111,244,.22)",
              }}
            >
              {isPending
                ? "KAYDEDİLİYOR..."
                : dailyLoaded
                ? "YOKLAMAYI GÜNCELLE"
                : "YOKLAMAYI KAYDET"}
            </button>
          </section>
        </>
      )}

      {viewMode === "monthly" && (
        <section
          style={{
            background: "#fff",
            border:
              "1px solid #dce7f2",
            borderRadius: 22,
            overflow: "hidden",
            boxShadow:
              "0 14px 36px rgba(15,42,76,.07)",
          }}
        >
          <div
            style={{
              padding: 18,
              background:
                "#edf4fb",
              display: "flex",
              justifyContent:
                "space-between",
              gap: 14,
              alignItems:
                "center",
              flexWrap: "wrap",
            }}
          >
            <div>
              <strong
                style={{
                  color:
                    "#153e69",
                  fontSize: 17,
                }}
              >
                Aylık Yoklama
              </strong>

              <div
                style={{
                  marginTop: 4,
                  fontSize: 11,
                  color:
                    "#738297",
                }}
              >
                Hücreye tıklayarak
                ilgili günün
                yoklamasını
                açabilirsiniz.
              </div>
            </div>

            <input
              type="month"
              value={month}
              onChange={(event) =>
                setMonth(
                  event.target.value
                )
              }
              style={{
                ...fieldStyle,
                width: 190,
              }}
            />
          </div>

          <div
            style={{
              overflowX: "auto",
            }}
          >
            <table
              style={{
                width: "100%",
                borderCollapse:
                  "collapse",
                minWidth:
                  Math.max(
                    850,
                    300 +
                      lessonDates.length *
                        58
                  ),
              }}
            >
              <thead>
                <tr>
                  <th
                    style={{
                      ...tableHeader,
                      textAlign:
                        "left",
                      position:
                        "sticky",
                      left: 0,
                      zIndex: 2,
                      background:
                        "#f7fafe",
                      minWidth:
                        250,
                    }}
                  >
                    Öğrenci
                  </th>

                  {lessonDates.map(
                    (date) => (
                      <th
                        key={date}
                        style={
                          tableHeader
                        }
                      >
                        {formatShortDate(
                          date
                        )}
                      </th>
                    )
                  )}

                  <th
                    style={
                      tableHeader
                    }
                  >
                    %
                  </th>
                </tr>
              </thead>

              <tbody>
                {groupStudents.map(
                  (student) => {
                    let attended = 0;

                    let totalMarked = 0;

                    lessonDates.forEach(
                      (date) => {
                        const record =
                          monthlyRecordMap.get(
                            `${student.id}_${date}`
                          );

                        if (record) {
                          totalMarked += 1;

                          if (
                            record.status ===
                            "present"
                          ) {
                            attended += 1;
                          }
                        }
                      }
                    );

                    const percent =
                      totalMarked
                        ? Math.round(
                            (attended /
                              totalMarked) *
                              100
                          )
                        : 0;

                    return (
                      <tr
                        key={
                          student.id
                        }
                      >
                        <td
                          style={{
                            ...tableCell,
                            position:
                              "sticky",
                            left: 0,
                            zIndex:
                              1,
                            background:
                              "#fff",
                            minWidth:
                              250,
                          }}
                        >
                          <strong
                            style={{
                              color:
                                "#143b65",
                            }}
                          >
                            {
                              student.first_name
                            }{" "}
                            {
                              student.last_name
                            }
                          </strong>
                        </td>

                        {lessonDates.map(
                          (date) => {
                            const record =
                              monthlyRecordMap.get(
                                `${student.id}_${date}`
                              );

                            return (
                              <td
                                key={
                                  date
                                }
                                style={
                                  tableCell
                                }
                              >
                                <button
                                  type="button"
                                  onClick={() =>
                                    openDayFromMonthly(
                                      date
                                    )
                                  }
                                  style={{
                                    width:
                                      38,
                                    height:
                                      38,
                                    borderRadius:
                                      10,
                                    border:
                                      record
                                        ? `1px solid ${
                                            STATUS_META[
                                              record
                                                .status
                                            ]
                                              .border
                                          }`
                                        : "1px solid #e2e8f0",
                                    background:
                                      record
                                        ? STATUS_META[
                                            record
                                              .status
                                          ].bg
                                        : "#f8fafc",
                                    color:
                                      record
                                        ? STATUS_META[
                                            record
                                              .status
                                          ].color
                                        : "#cbd5e1",
                                    fontWeight:
                                      900,
                                    cursor:
                                      "pointer",
                                  }}
                                >
                                  {record
                                    ? STATUS_META[
                                        record
                                          .status
                                      ].short
                                    : "·"}
                                </button>
                              </td>
                            );
                          }
                        )}

                        <td
                          style={
                            tableCell
                          }
                        >
                          <strong
                            style={{
                              color:
                                percent >=
                                80
                                  ? "#15803d"
                                  : percent >=
                                    60
                                  ? "#a16207"
                                  : "#be123c",
                            }}
                          >
                            {percent}%
                          </strong>
                        </td>
                      </tr>
                    );
                  }
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {viewMode === "history" && (
        <section
          style={{
            background: "#fff",
            border:
              "1px solid #dce7f2",
            borderRadius: 22,
            overflow: "hidden",
            boxShadow:
              "0 14px 36px rgba(15,42,76,.07)",
          }}
        >
          <div
            style={{
              padding: 18,
              background:
                "#edf4fb",
              display: "flex",
              justifyContent:
                "space-between",
              alignItems:
                "center",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <div>
              <strong
                style={{
                  color:
                    "#153e69",
                  fontSize: 17,
                }}
              >
                Geçmiş Yoklamalar
              </strong>

              <div
                style={{
                  marginTop: 4,
                  fontSize: 11,
                  color:
                    "#738297",
                }}
              >
                Herhangi bir kaydı
                açıp geriye dönük
                düzenleyebilirsiniz.
              </div>
            </div>

            <input
              type="month"
              value={month}
              onChange={(event) =>
                setMonth(
                  event.target.value
                )
              }
              style={{
                ...fieldStyle,
                width: 190,
              }}
            />
          </div>

          {!historyRows.length && (
            <div
              style={{
                padding: 36,
                textAlign:
                  "center",
                color:
                  "#7b899a",
              }}
            >
              Bu ay için kayıtlı
              yoklama bulunamadı.
            </div>
          )}

          {historyRows.map(
            (record) => {
              const student =
                students.find(
                  (item) =>
                    item.id ===
                    record.student_id
                );

              const meta =
                STATUS_META[
                  record.status
                ];

              return (
                <button
                  key={
                    record.id ||
                    `${record.student_id}_${record.lesson_date}`
                  }
                  type="button"
                  onClick={() =>
                    openDayFromMonthly(
                      record.lesson_date
                    )
                  }
                  style={{
                    width: "100%",
                    border: 0,
                    borderTop:
                      "1px solid #edf2f7",
                    background:
                      "#fff",
                    padding:
                      "14px 18px",
                    display:
                      "grid",
                    gridTemplateColumns:
                      "150px minmax(220px,1fr) 130px minmax(200px,1fr)",
                    gap: 12,
                    alignItems:
                      "center",
                    textAlign:
                      "left",
                    cursor:
                      "pointer",
                  }}
                >
                  <strong
                    style={{
                      color:
                        "#153e69",
                    }}
                  >
                    {formatDateTR(
                      record.lesson_date
                    )}
                  </strong>

                  <span
                    style={{
                      fontWeight:
                        800,
                      color:
                        "#334155",
                    }}
                  >
                    {student
                      ? `${student.first_name} ${student.last_name}`
                      : "Öğrenci"}
                  </span>

                  <span
                    style={{
                      display:
                        "inline-flex",
                      justifyContent:
                        "center",
                      padding:
                        "7px 9px",
                      borderRadius:
                        999,
                      background:
                        meta.bg,
                      color:
                        meta.color,
                      fontWeight:
                        900,
                      fontSize:
                        11,
                    }}
                  >
                    {meta.icon}{" "}
                    {meta.label}
                  </span>

                  <span
                    style={{
                      color:
                        "#7b899a",
                      fontSize: 12,
                    }}
                  >
                    {record.coach_note ||
                      "Not yok"}
                  </span>
                </button>
              );
            }
          )}
        </section>
      )}
    </div>
  );
}

function StatCard({
  title,
  value,
  tone,
}: {
  title: string;
  value: number;
  tone:
    | "blue"
    | "green"
    | "red"
    | "yellow"
    | "purple"
    | "gray";
}) {
  const map = {
    blue: {
      bg: "#eff6ff",
      color: "#1d4ed8",
    },
    green: {
      bg: "#ecfdf3",
      color: "#15803d",
    },
    red: {
      bg: "#fff1f2",
      color: "#be123c",
    },
    yellow: {
      bg: "#fffbeb",
      color: "#a16207",
    },
    purple: {
      bg: "#eef2ff",
      color: "#4338ca",
    },
    gray: {
      bg: "#f8fafc",
      color: "#475569",
    },
  };

  const toneStyle = map[tone];

  return (
    <div
      style={{
        padding: 15,
        borderRadius: 16,
        background:
          toneStyle.bg,
        color:
          toneStyle.color,
        border:
          "1px solid rgba(148,163,184,.18)",
      }}
    >
      <span
        style={{
          display: "block",
          fontSize: 11,
          fontWeight: 900,
        }}
      >
        {title}
      </span>

      <strong
        style={{
          display: "block",
          marginTop: 4,
          fontSize: 24,
        }}
      >
        {value}
      </strong>
    </div>
  );
}

const labelStyle = {
  display: "grid",
  gap: 7,
  fontSize: 11,
  fontWeight: 900,
  color: "#52667e",
} as const;

const fieldStyle = {
  width: "100%",
  minHeight: 46,
  padding: "0 12px",
  border:
    "1px solid #d8e2ec",
  borderRadius: 12,
  background: "#fff",
  color: "#183b61",
  fontWeight: 800,
} as const;

const warningBadge = {
  display: "inline-flex",
  padding: "8px 10px",
  borderRadius: 10,
  background: "#fff7ed",
  color: "#c2410c",
  border:
    "1px solid #fed7aa",
  fontSize: 11,
  fontWeight: 800,
} as const;

const tableHeader = {
  padding: "12px 8px",
  borderBottom:
    "1px solid #e2e8f0",
  color: "#64748b",
  fontSize: 10,
  fontWeight: 900,
  textAlign: "center",
  background: "#f7fafe",
} as const;

const tableCell = {
  padding: "9px 8px",
  borderBottom:
    "1px solid #edf2f7",
  textAlign: "center",
} as const;

function navButton(
  active: boolean
) {
  return {
    border: 0,
    textDecoration: "none",
    padding: "11px 14px",
    borderRadius: 12,
    cursor: "pointer",
    background: active
      ? "#0b6ff4"
      : "#f6f9fc",
    color: active
      ? "#fff"
      : "#315577",
    fontWeight: 900,
    fontSize: 12,
  } as const;
}

function darkButton(
  active = false
) {
  return {
    border: active
      ? "1px solid #60a5fa"
      : "1px solid rgba(255,255,255,.18)",
    borderRadius: 11,
    padding: "9px 12px",
    cursor: "pointer",
    background: active
      ? "#0b6ff4"
      : "rgba(255,255,255,.08)",
    color: "#fff",
    fontWeight: 900,
    fontSize: 11,
  } as const;
}

function actionButton(
  background: string,
  color: string
) {
  return {
    border: 0,
    borderRadius: 11,
    padding: "10px 13px",
    background,
    color,
    cursor: "pointer",
    fontWeight: 900,
    fontSize: 11,
  } as const;
}

function miniButton(
  background: string,
  color: string
) {
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    border:
      "1px solid #dce7f2",
    borderRadius: 10,
    padding: "8px 10px",
    background,
    color,
    cursor: "pointer",
    fontWeight: 900,
    fontSize: 10,
    textDecoration: "none",
  } as const;
}
