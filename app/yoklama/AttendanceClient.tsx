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

type AttendanceStatus =
  | "present"
  | "absent"
  | "excused"
  | "compensation";

type Group = {
  id: string;
  organization_id?: string | null;
  branch_id?: string | null;
  name?: string | null;
  course_type?: string | null;
  capacity?: number | null;
  primary_coach_id?: string | null;
};

type Schedule = {
  id: string;
  organization_id?: string | null;
  branch_id?: string | null;
  group_id?: string | null;
  coach_id?: string | null;
  weekday?: number | null;
  start_time?: string | null;
  end_time?: string | null;
  is_active?: boolean | null;
};

type Membership = {
  id: string;
  student_id?: string | null;
  group_id?: string | null;
  level_id?: string | null;
  started_at?: string | null;
  ended_at?: string | null;
  is_active?: boolean | null;
};

type Student = {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  student_number?: string | null;

  phone?: string | null;
  email?: string | null;

  guardian_name?: string | null;
  guardian_phone?: string | null;
  guardian_email?: string | null;

  swimming_level?: string | null;
  medical_note?: string | null;
  general_note?: string | null;

  preferred_days?: string | null;
  preferred_time?: string | null;
};

type Enrollment = {
  id: string;
  student_id?: string | null;
  group_id?: string | null;
  start_date?: string | null;
  planned_end_date?: string | null;
  total_lessons?: number | null;
  used_lessons?: number | null;
  status?: string | null;
};

type AttendanceRecord = {
  id?: string;
  student_id: string;
  enrollment_id?: string | null;
  group_id?: string | null;
  schedule_id?: string | null;
  coach_id?: string | null;
  lesson_date: string;
  status: AttendanceStatus;
  coach_note?: string | null;
};

type CompensationLesson = {
  id: string;
  organization_id?: string | null;
  student_id: string;
  enrollment_id?: string | null;
  source_request_id?: string | null;
  target_group_id: string;
  target_schedule_id?: string | null;
  lesson_date: string;
  status: "planned" | "completed" | "cancelled" | string;
  note?: string | null;
  created_by?: string | null;
  completed_by?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  completed_at?: string | null;
};

type Props = {
  groups: Group[];
  schedules: Schedule[];
  memberships: Membership[];
  students: Student[];
  enrollments: Enrollment[];
  compensationLessons: CompensationLesson[];
};

type ViewMode =
  | "daily"
  | "monthly"
  | "history";

type RenewalFilter =
  | "all"
  | "expired"
  | "last"
  | "two"
  | "three";

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
    background: string;
    color: string;
    border: string;
  }
> = {
  present: {
    label: "✓ Geldi",
    short: "✓",
    background: "#ecfdf3",
    color: "#15803d",
    border: "#86efac",
  },

  absent: {
    label: "✕ Gelmedi",
    short: "✕",
    background: "#fff1f2",
    color: "#be123c",
    border: "#fda4af",
  },

  excused: {
    label: "○ İzinli",
    short: "İ",
    background: "#fffbeb",
    color: "#a16207",
    border: "#fde68a",
  },

  compensation: {
    label: "+ Telafi",
    short: "T",
    background: "#eef2ff",
    color: "#4338ca",
    border: "#c7d2fe",
  },
};

function todayTR() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function shiftDate(
  value: string,
  amount: number
) {
  const date = new Date(
    `${value}T12:00:00`
  );

  date.setDate(
    date.getDate() + amount
  );

  const year = date.getFullYear();

  const month = String(
    date.getMonth() + 1
  ).padStart(2, "0");

  const day = String(
    date.getDate()
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function dateWeekday(value: string) {
  const date = new Date(
    `${value}T12:00:00`
  );

  const day = date.getDay();

  return day === 0 ? 7 : day;
}

function time(value?: string | null) {
  return value
    ? value.slice(0, 5)
    : "—";
}

function formatDate(value?: string | null) {
  if (!value) return "—";

  try {
    return new Intl.DateTimeFormat(
      "tr-TR",
      {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }
    ).format(
      new Date(`${value}T12:00:00`)
    );
  } catch {
    return value;
  }
}

function shortDate(value: string) {
  try {
    return new Intl.DateTimeFormat(
      "tr-TR",
      {
        day: "2-digit",
        month: "2-digit",
      }
    ).format(
      new Date(`${value}T12:00:00`)
    );
  } catch {
    return value;
  }
}

function cleanPhone(
  value?: string | null
) {
  return (value || "").replace(
    /\D/g,
    ""
  );
}

function isAdultCourse(
  group?: Group | null
) {
  const value = `${group?.course_type || ""} ${group?.name || ""}`
    .toLocaleLowerCase("tr-TR")
    .trim();

  return (
    value.includes("yetişkin") ||
    value.includes("yetiskin") ||
    value.includes("adult") ||
    value.includes("master")
  );
}

function studentPhone(
  student: Student,
  adultCourse = false
) {
  const guardian = cleanPhone(
    student.guardian_phone
  );

  const own = cleanPhone(
    student.phone
  );

  // Yetişkin grubunda önce kursiyerin kendi numarası,
  // çocuk grubunda önce veli numarası kullanılır.
  if (adultCourse) {
    if (own.length >= 10) return own;
    if (guardian.length >= 10) return guardian;
  } else {
    if (guardian.length >= 10) return guardian;
    if (own.length >= 10) return own;
  }

  return "";
}

function whatsappButtonLabel(
  status?: AttendanceStatus
) {
  if (status === "absent") return "💬 Gelmedi Mesajı";
  if (status === "excused") return "💬 İzin Bilgisi";
  if (status === "compensation") return "💬 Telafi Bilgisi";
  if (status === "present") return "💬 Katılım Bilgisi";
  return "💬 WhatsApp";
}

function whatsappPhone(
  value: string
) {
  let phone =
    cleanPhone(value);

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

function remaining(
  enrollment?: Enrollment
) {
  if (!enrollment) {
    return 0;
  }

  return Math.max(
    0,
    Number(
      enrollment.total_lessons || 0
    ) -
      Number(
        enrollment.used_lessons || 0
      )
  );
}

function lessonUsage(
  enrollment?: Enrollment
) {
  return {
    total: Number(
      enrollment?.total_lessons || 0
    ),
    used: Number(
      enrollment?.used_lessons || 0
    ),
    remaining: remaining(enrollment),
  };
}

function renewalInfo(
  enrollment?: Enrollment
) {
  if (!enrollment) {
    return {
      level: "none" as const,
      label: "PAKET BİLGİSİ YOK",
      background: "#f1f5f9",
      color: "#64748b",
      border: "#cbd5e1",
    };
  }

  const left = remaining(enrollment);

  if (left <= 0) {
    return {
      level: "expired" as const,
      label: "PAKET BİTTİ · KAYIT YENİLE",
      background: "#7f1d1d",
      color: "#ffffff",
      border: "#7f1d1d",
    };
  }

  if (left === 1) {
    return {
      level: "last" as const,
      label: "SON DERS",
      background: "#fee2e2",
      color: "#991b1b",
      border: "#fecaca",
    };
  }

  if (left === 2) {
    return {
      level: "two" as const,
      label: "2 DERS KALDI",
      background: "#ffedd5",
      color: "#9a3412",
      border: "#fed7aa",
    };
  }

  if (left === 3) {
    return {
      level: "three" as const,
      label: "3 DERS KALDI · YENİLEME YAKLAŞIYOR",
      background: "#fef9c3",
      color: "#854d0e",
      border: "#fde68a",
    };
  }

  return {
    level: "active" as const,
    label: "AKTİF",
    background: "#ecfdf3",
    color: "#15803d",
    border: "#bbf7d0",
  };
}

function monthLessonDates(
  month: string,
  schedules: Schedule[]
) {
  if (!month) return [];

  const [yearText, monthText] =
    month.split("-");

  const year = Number(yearText);
  const monthNumber =
    Number(monthText);

  if (
    !year ||
    !monthNumber
  ) {
    return [];
  }

  const weekdays = new Set(
    schedules
      .map(
        (schedule) =>
          Number(schedule.weekday)
      )
      .filter(
        (weekday) =>
          weekday >= 1 &&
          weekday <= 7
      )
  );

  const lastDay = new Date(
    year,
    monthNumber,
    0
  ).getDate();

  const result: string[] = [];

  for (
    let day = 1;
    day <= lastDay;
    day++
  ) {
    const mm = String(
      monthNumber
    ).padStart(2, "0");

    const dd = String(
      day
    ).padStart(2, "0");

    const value =
      `${year}-${mm}-${dd}`;

    if (
      weekdays.has(
        dateWeekday(value)
      )
    ) {
      result.push(value);
    }
  }

  return result;
}

export default function AttendanceClient({
  groups,
  schedules,
  memberships,
  students,
  enrollments,
  compensationLessons,
}: Props) {
  const [view, setView] =
    useState<ViewMode>("daily");

  const [lessonDate, setLessonDate] =
    useState(todayTR());

  const [month, setMonth] =
    useState(todayTR().slice(0, 7));

  const [
    selectedGroupId,
    setSelectedGroupId,
  ] = useState(
    groups[0]?.id || ""
  );

  const [
    selectedScheduleId,
    setSelectedScheduleId,
  ] = useState("");

  const [
    renewalFilter,
    setRenewalFilter,
  ] = useState<RenewalFilter>("all");

  const [statuses, setStatuses] =
    useState<
      Record<
        string,
        AttendanceStatus
      >
    >({});

  const [notes, setNotes] =
    useState<
      Record<string, string>
    >({});

  const [
    monthlyRecords,
    setMonthlyRecords,
  ] = useState<
    AttendanceRecord[]
  >([]);

  const [
    contactStudent,
    setContactStudent,
  ] = useState<string | null>(
    null
  );

  const [message, setMessage] =
    useState("");

  const [hasSaved, setHasSaved] =
    useState(false);

  const [
    isPending,
    startTransition,
  ] = useTransition();

  const selectedGroup =
    useMemo(
      () =>
        groups.find(
          (group) =>
            group.id ===
            selectedGroupId
        ) || null,
      [groups, selectedGroupId]
    );

  const groupSchedules =
    useMemo(
      () =>
        schedules.filter(
          (schedule) =>
            schedule.group_id ===
              selectedGroupId &&
            schedule.is_active !==
              false
        ),
      [
        schedules,
        selectedGroupId,
      ]
    );

  const selectedSchedule =
    groupSchedules.find(
      (schedule) =>
        schedule.id ===
        selectedScheduleId
    ) || null;

  const studentIds =
    useMemo(() => {
      return new Set(
        memberships
          .filter(
            (membership) =>
              membership.group_id ===
                selectedGroupId &&
              membership.is_active !==
                false &&
              !!membership.student_id
          )
          .map(
            (membership) =>
              membership.student_id as string
          )
      );
    }, [
      memberships,
      selectedGroupId,
    ]);

  const activeCompensationLessons =
    useMemo(() => {
      return compensationLessons.filter(
        (lesson) =>
          lesson.status === "planned" &&
          lesson.target_group_id === selectedGroupId &&
          lesson.lesson_date === lessonDate &&
          (!lesson.target_schedule_id ||
            lesson.target_schedule_id === selectedScheduleId)
      );
    }, [
      compensationLessons,
      selectedGroupId,
      selectedScheduleId,
      lessonDate,
    ]);

  const compensationStudentIds =
    useMemo(() => {
      return new Set(
        activeCompensationLessons.map(
          (lesson) => lesson.student_id
        )
      );
    }, [activeCompensationLessons]);

  const groupStudents =
    useMemo(() => {
      return students
        .filter((student) =>
          studentIds.has(student.id)
        )
        .sort((a, b) =>
          `${a.first_name || ""} ${
            a.last_name || ""
          }`.localeCompare(
            `${b.first_name || ""} ${
              b.last_name || ""
            }`,
            "tr"
          )
        );
    }, [students, studentIds]);

  const attendanceStudents =
    useMemo(() => {
      const includedIds = new Set<string>([
        ...Array.from(studentIds),
        ...Array.from(compensationStudentIds),
      ]);

      return students
        .filter((student) => includedIds.has(student.id))
        .sort((a, b) =>
          `${a.first_name || ""} ${a.last_name || ""}`.localeCompare(
            `${b.first_name || ""} ${b.last_name || ""}`,
            "tr"
          )
        );
    }, [students, studentIds, compensationStudentIds]);

  const enrollmentMap =
    useMemo(() => {
      const map =
        new Map<
          string,
          Enrollment
        >();

      enrollments.forEach(
        (enrollment) => {
          if (
            enrollment.student_id &&
            enrollment.group_id ===
              selectedGroupId
          ) {
            map.set(
              enrollment.student_id,
              enrollment
            );
          }
        }
      );

      activeCompensationLessons.forEach((lesson) => {
        if (!lesson.enrollment_id) return;

        const enrollment = enrollments.find(
          (item) => item.id === lesson.enrollment_id
        );

        if (enrollment?.student_id) {
          map.set(enrollment.student_id, enrollment);
        }
      });

      return map;
    }, [
      enrollments,
      selectedGroupId,
      activeCompensationLessons,
    ]);

  const renewalCounts =
    useMemo(() => {
      let expired = 0;
      let last = 0;
      let two = 0;
      let three = 0;

      attendanceStudents.forEach(
        (student) => {
          const enrollment =
            enrollmentMap.get(
              student.id
            );

          if (!enrollment) return;

          const left =
            remaining(enrollment);

          if (left <= 0) {
            expired++;
          } else if (left === 1) {
            last++;
          } else if (left === 2) {
            two++;
          } else if (left === 3) {
            three++;
          }
        }
      );

      return {
        expired,
        last,
        two,
        three,
        total:
          expired +
          last +
          two +
          three,
      };
    }, [
      attendanceStudents,
      enrollmentMap,
    ]);

  const filteredStudents =
    useMemo(() => {
      if (
        renewalFilter === "all"
      ) {
        return attendanceStudents;
      }

      return attendanceStudents.filter(
        (student) => {
          const enrollment =
            enrollmentMap.get(
              student.id
            );

          if (!enrollment) {
            return false;
          }

          const left =
            remaining(enrollment);

          if (
            renewalFilter ===
            "expired"
          ) {
            return left <= 0;
          }

          if (
            renewalFilter === "last"
          ) {
            return left === 1;
          }

          if (
            renewalFilter === "two"
          ) {
            return left === 2;
          }

          if (
            renewalFilter === "three"
          ) {
            return left === 3;
          }

          return true;
        }
      );
    }, [
      attendanceStudents,
      enrollmentMap,
      renewalFilter,
    ]);

  const totals = useMemo(() => {
    let present = 0;
    let absent = 0;
    let excused = 0;
    let compensation = 0;

    attendanceStudents.forEach(
      (student) => {
        const status =
          statuses[student.id];

        if (status === "present") {
          present++;
        }

        if (status === "absent") {
          absent++;
        }

        if (status === "excused") {
          excused++;
        }

        if (
          status ===
          "compensation"
        ) {
          compensation++;
        }
      }
    );

    return {
      present,
      absent,
      excused,
      compensation,
      missing:
        attendanceStudents.length -
        present -
        absent -
        excused -
        compensation,
    };
  }, [
    statuses,
    attendanceStudents,
  ]);

  const lessonDates =
    useMemo(
      () =>
        monthLessonDates(
          month,
          groupSchedules
        ),
      [month, groupSchedules]
    );

  const monthlyMap =
    useMemo(() => {
      const map =
        new Map<
          string,
          AttendanceRecord
        >();

      monthlyRecords.forEach(
        (record) => {
          map.set(
            `${record.student_id}_${record.lesson_date}`,
            record
          );
        }
      );

      return map;
    }, [monthlyRecords]);

  const monthlyByDate =
    useMemo(() => {
      const map = new Map<
        string,
        AttendanceRecord[]
      >();

      monthlyRecords.forEach(
        (record) => {
          const current =
            map.get(
              record.lesson_date
            ) || [];

          current.push(record);

          map.set(
            record.lesson_date,
            current
          );
        }
      );

      return Array.from(
        map.entries()
      ).sort((a, b) =>
        b[0].localeCompare(a[0])
      );
    }, [monthlyRecords]);

  useEffect(() => {
    if (
      !groupSchedules.length
    ) {
      setSelectedScheduleId(
        ""
      );

      return;
    }

    const weekday =
      dateWeekday(lessonDate);

    const matching =
      groupSchedules.find(
        (schedule) =>
          Number(
            schedule.weekday
          ) === weekday
      );

    setSelectedScheduleId(
      matching?.id ||
        groupSchedules[0].id
    );
  }, [
    groupSchedules,
    lessonDate,
  ]);

  useEffect(() => {
    if (
      !selectedGroupId ||
      !selectedScheduleId ||
      !lessonDate
    ) {
      return;
    }

    let active = true;

    startTransition(async () => {
      const result =
        await getAttendanceForDate({
          groupId:
            selectedGroupId,
          scheduleId:
            selectedScheduleId,
          lessonDate,
        });

      if (!active) return;

      if (!result.ok) {
        setStatuses({});
        setNotes({});
        setHasSaved(false);
        setMessage(
          result.message
        );

        return;
      }

      const statusMap: Record<
        string,
        AttendanceStatus
      > = {};

      const noteMap: Record<
        string,
        string
      > = {};

      for (const raw of
        result.records || []) {
        const record =
          raw as unknown as AttendanceRecord;

        if (
          record.status ===
            "present" ||
          record.status ===
            "absent" ||
          record.status ===
            "excused" ||
          record.status ===
            "compensation"
        ) {
          statusMap[
            record.student_id
          ] = record.status;
        }

        noteMap[
          record.student_id
        ] =
          record.coach_note || "";
      }

      setStatuses(statusMap);
      setNotes(noteMap);

      setHasSaved(
        (result.records || [])
          .length > 0
      );

      setMessage(
        result.message
      );
    });

    return () => {
      active = false;
    };
  }, [
    selectedGroupId,
    selectedScheduleId,
    lessonDate,
  ]);

  useEffect(() => {
    if (
      view === "daily" ||
      !selectedGroupId ||
      !month
    ) {
      return;
    }

    let active = true;

    startTransition(async () => {
      const result =
        await getMonthlyAttendance({
          groupId:
            selectedGroupId,
          month,
        });

      if (!active) return;

      if (!result.ok) {
        setMonthlyRecords([]);
        setMessage(
          result.message
        );

        return;
      }

      setMonthlyRecords(
        (result.records ||
          []) as unknown as AttendanceRecord[]
      );
    });

    return () => {
      active = false;
    };
  }, [
    view,
    selectedGroupId,
    month,
  ]);

  function selectGroup(
    value: string
  ) {
    setSelectedGroupId(value);
    setStatuses({});
    setNotes({});
    setMonthlyRecords([]);
    setHasSaved(false);
    setContactStudent(null);
    setRenewalFilter("all");
  }

  function markAllPresent() {
    const value: Record<
      string,
      AttendanceStatus
    > = {};

    attendanceStudents.forEach(
      (student) => {
        value[student.id] =
          compensationStudentIds.has(student.id)
            ? "compensation"
            : "present";
      }
    );

    setStatuses(value);
  }

  function save() {
    if (
      !selectedGroupId ||
      !selectedScheduleId
    ) {
      setMessage(
        "Grup ve ders seansı seçmelisiniz."
      );

      return;
    }

    if (
      !attendanceStudents.length
    ) {
      setMessage(
        "Bu grupta öğrenci bulunamadı."
      );

      return;
    }

    const missing =
      attendanceStudents.filter(
        (student) =>
          !statuses[student.id]
      );

    if (missing.length) {
      setMessage(
        `${missing.length} öğrencinin yoklaması eksik.`
      );

      return;
    }

    const records =
      attendanceStudents.map(
        (student) => ({
          studentId:
            student.id,

          enrollmentId:
            enrollmentMap.get(
              student.id
            )?.id || null,

          status:
            statuses[
              student.id
            ],

          coachNote:
            notes[
              student.id
            ]?.trim() || null,
        })
      );

    startTransition(
      async () => {
        const result =
          await saveAttendance({
            branchId:
              selectedSchedule?.branch_id ??
              selectedGroup?.branch_id ??
              null,

            groupId:
              selectedGroupId,

            scheduleId:
              selectedScheduleId,

            coachId:
              selectedSchedule?.coach_id ??
              selectedGroup?.primary_coach_id ??
              null,

            lessonDate,

            records,
          });

        setMessage(
          result.message
        );

        if (result.ok) {
          setHasSaved(true);
        }
      }
    );
  }

  function call(
    student: Student
  ) {
    const adultCourse =
      isAdultCourse(selectedGroup);

    const phone =
      studentPhone(
        student,
        adultCourse
      );

    if (!phone) {
      setMessage(
        "Geçerli telefon numarası bulunamadı."
      );

      return;
    }

    window.location.href =
      `tel:${phone}`;
  }

  function whatsapp(
    student: Student
  ) {
    const adultCourse =
      isAdultCourse(selectedGroup);

    const phone =
      studentPhone(
        student,
        adultCourse
      );

    if (!phone) {
      setMessage(
        adultCourse
          ? "Kursiyerin WhatsApp numarası bulunamadı."
          : "Veli WhatsApp numarası bulunamadı."
      );

      return;
    }

    const firstName =
      (student.first_name || "Öğrencimiz").trim();

    const status =
      statuses[student.id];

    const weekday =
      DAY_NAMES[dateWeekday(lessonDate)] || "";

    const lessonTime =
      selectedSchedule?.start_time
        ? time(selectedSchedule.start_time)
        : "";

    const lessonLabel =
      `${formatDate(lessonDate)} ${weekday}${lessonTime ? ` · ${lessonTime}` : ""}`;

    let body = "";

    if (status === "absent") {
      body = adultCourse
        ? `${lessonLabel} tarihli yüzme dersinize katılım sağlamadığınız görülmüştür.`
        : `Çocuğumuz ${firstName}, ${lessonLabel} tarihli yüzme dersine katılım sağlamamıştır.`;
    } else if (status === "excused") {
      body = adultCourse
        ? `${lessonLabel} tarihli yüzme dersiniz izinli olarak kaydedilmiştir. Yüzme okulumuz kuralları gereği izinli dersler ders hakkından düşmektedir.`
        : `Çocuğumuz ${firstName}, ${lessonLabel} tarihli yüzme dersi için izinli olarak kaydedilmiştir. Yüzme okulumuz kuralları gereği izinli dersler ders hakkından düşmektedir.`;
    } else if (status === "compensation") {
      body = adultCourse
        ? `${lessonLabel} tarihli dersiniz telafi dersi olarak kaydedilmiştir.`
        : `Çocuğumuz ${firstName}, ${lessonLabel} tarihli ders için telafi programına kaydedilmiştir.`;
    } else if (status === "present") {
      body = adultCourse
        ? `${lessonLabel} tarihli yüzme dersine katılımınız kaydedilmiştir.`
        : `Çocuğumuz ${firstName}, ${lessonLabel} tarihli yüzme dersine katılım sağlamıştır.`;
    } else {
      body = adultCourse
        ? `${lessonLabel} tarihli yüzme dersiniz hakkında bilgilendirme için yazıyoruz.`
        : `Çocuğumuz ${firstName}'in ${lessonLabel} tarihli yüzme dersi hakkında bilgilendirme için yazıyoruz.`;
    }

    const text =
      `Merhaba, Sprint Yüzme Okulu'ndan bilgilendirme için yazıyoruz.\n\n` +
      `${body}\n\n` +
      `Bilginize sunar, iyi günler dileriz.\n` +
      `Sprint Yüzme Okulu`;

    const url =
      `https://wa.me/${whatsappPhone(phone)}?text=${encodeURIComponent(text)}`;

    window.open(
      url,
      "_blank",
      "noopener,noreferrer"
    );
  }

  async function copyPhone(
    student: Student
  ) {
    const phone =
      studentPhone(
        student,
        isAdultCourse(selectedGroup)
      );

    if (!phone) return;

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

  return (
    <div
      style={{
        display: "grid",
        gap: 18,
        width: "100%",
        minWidth: 0,
        overflowX: "hidden",
        boxSizing: "border-box",
      }}
    >
      <nav
        style={{
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
          padding: 10,
          background: "rgba(255,255,255,.96)",
          border: "1px solid #dce7f2",
          borderRadius: 18,
          boxShadow: "0 8px 24px rgba(15,42,76,.05)",
          width: "100%",
          minWidth: 0,
          boxSizing: "border-box",
        }}
      >
        <Link
          href="/"
          style={navStyle(false)}
        >
          🏠 Ana Panel
        </Link>

        <button
          type="button"
          onClick={() =>
            setView("daily")
          }
          style={navStyle(
            view === "daily"
          )}
        >
          ✓ Günlük Yoklama
        </button>

        <button
          type="button"
          onClick={() =>
            setView("monthly")
          }
          style={navStyle(
            view === "monthly"
          )}
        >
          🗓 Tüm Ayı Gör
        </button>

        <button
          type="button"
          onClick={() =>
            setView("history")
          }
          style={navStyle(
            view === "history"
          )}
        >
          ↺ Geçmiş
        </button>

        <Link
          href="/ogrenciler"
          style={navStyle(false)}
        >
          👥 Öğrenciler
        </Link>
      </nav>

      <section
        style={{
          padding: 20,
          borderRadius: 22,
          background: "#102f55",
          color: "#fff",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent:
              "space-between",
            gap: 16,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <div>
            <div
              style={{
                fontSize: 11,
                color: "#93c5fd",
                fontWeight: 900,
              }}
            >
              SPRINTOS · YOKLAMA
            </div>

            <h2
              style={{
                margin: "5px 0 0",
              }}
            >
              Yoklama & Ders Yönetimi
            </h2>
          </div>

          <div
            style={{
              display: "flex",
              gap: 7,
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
              style={darkStyle}
            >
              ←
            </button>

            <button
              type="button"
              onClick={() =>
                setLessonDate(
                  todayTR()
                )
              }
              style={{
                ...darkStyle,
                background:
                  "#0b6ff4",
              }}
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
              style={darkStyle}
            >
              →
            </button>
          </div>
        </div>
      </section>

      <section style={panelStyle}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit,minmax(220px,1fr))",
            gap: 12,
          }}
        >
          <label style={labelStyle}>
            TARİH

            <input
              type="date"
              value={lessonDate}
              onChange={(e) =>
                setLessonDate(
                  e.target.value
                )
              }
              style={inputStyle}
            />
          </label>

          <label style={labelStyle}>
            GRUP

            <select
              value={
                selectedGroupId
              }
              onChange={(e) =>
                selectGroup(
                  e.target.value
                )
              }
              style={inputStyle}
            >
              {!groups.length && (
                <option value="">
                  Grup bulunamadı
                </option>
              )}

              {groups.map(
                (group) => (
                  <option
                    key={group.id}
                    value={group.id}
                  >
                    {group.name ||
                      "İsimsiz grup"}
                    {group.course_type
                      ? ` · ${group.course_type}`
                      : ""}
                  </option>
                )
              )}
            </select>
          </label>

          <label style={labelStyle}>
            DERS / SEANS

            <select
              value={
                selectedScheduleId
              }
              onChange={(e) =>
                setSelectedScheduleId(
                  e.target.value
                )
              }
              style={inputStyle}
            >
              <option value="">
                Seans seçin
              </option>

              {groupSchedules.map(
                (schedule) => (
                  <option
                    key={
                      schedule.id
                    }
                    value={
                      schedule.id
                    }
                  >
                    {DAY_NAMES[
                      Number(
                        schedule.weekday
                      )
                    ] ||
                      "Ders"}
                    {" · "}
                    {time(
                      schedule.start_time
                    )}
                    {" - "}
                    {time(
                      schedule.end_time
                    )}
                  </option>
                )
              )}
            </select>
          </label>
        </div>
      </section>

      <section
        style={{
          ...panelStyle,
          background:
            "linear-gradient(135deg,#ffffff 0%,#f8fbff 100%)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent:
              "space-between",
            gap: 12,
            alignItems: "center",
            flexWrap: "wrap",
            marginBottom: 12,
          }}
        >
          <div>
            <strong
              style={{
                color: "#153e69",
                fontSize: 16,
              }}
            >
              🔔 Kayıt Yenileme Uyarıları
            </strong>

            <div
              style={{
                marginTop: 4,
                color: "#64748b",
                fontSize: 11,
              }}
            >
              Son dersleri kalan kursiyerleri buradan takip edebilirsiniz.
            </div>
          </div>

          <button
            type="button"
            onClick={() =>
              setRenewalFilter(
                "all"
              )
            }
            style={smallStyle}
          >
            Tüm Öğrenciler
          </button>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit,minmax(150px,1fr))",
            gap: 10,
          }}
        >
          <RenewalCard
            title="Paket Bitti"
            value={
              renewalCounts.expired
            }
            active={
              renewalFilter ===
              "expired"
            }
            background="#7f1d1d"
            color="#fff"
            onClick={() =>
              setRenewalFilter(
                "expired"
              )
            }
          />

          <RenewalCard
            title="Son Ders"
            value={
              renewalCounts.last
            }
            active={
              renewalFilter ===
              "last"
            }
            background="#fee2e2"
            color="#991b1b"
            onClick={() =>
              setRenewalFilter(
                "last"
              )
            }
          />

          <RenewalCard
            title="2 Ders Kaldı"
            value={
              renewalCounts.two
            }
            active={
              renewalFilter ===
              "two"
            }
            background="#ffedd5"
            color="#9a3412"
            onClick={() =>
              setRenewalFilter(
                "two"
              )
            }
          />

          <RenewalCard
            title="3 Ders Kaldı"
            value={
              renewalCounts.three
            }
            active={
              renewalFilter ===
              "three"
            }
            background="#fef9c3"
            color="#854d0e"
            onClick={() =>
              setRenewalFilter(
                "three"
              )
            }
          />
        </div>
      </section>

      {view === "daily" && (
        <>
          <section
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(105px, 1fr))",
              gap: 9,
            }}
          >
            <Stat
              name="Toplam"
              value={
                attendanceStudents.length
              }
            />

            <Stat
              name="Geldi"
              value={
                totals.present
              }
            />

            <Stat
              name="Gelmedi"
              value={
                totals.absent
              }
            />

            <Stat
              name="İzinli"
              value={
                totals.excused
              }
            />

            <Stat
              name="Telafi"
              value={
                totals.compensation
              }
            />

            <Stat
              name="Eksik"
              value={
                totals.missing
              }
            />
          </section>

          <section style={panelStyle}>
            <div
              style={{
                display: "flex",
                justifyContent:
                  "space-between",
                gap: 10,
                flexWrap: "wrap",
                marginBottom: 12,
              }}
            >
              <div>
                <strong>
                  {formatDate(
                    lessonDate
                  )}
                </strong>

                {selectedSchedule && (
                  <div
                    style={{
                      marginTop: 4,
                      color: "#64748b",
                      fontSize: 11,
                    }}
                  >
                    {DAY_NAMES[
                      Number(
                        selectedSchedule.weekday
                      )
                    ] || ""}
                    {" · "}
                    {time(
                      selectedSchedule.start_time
                    )}
                    {" - "}
                    {time(
                      selectedSchedule.end_time
                    )}
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={
                  markAllPresent
                }
                style={smallStyle}
              >
                ✓ Tümünü Geldi
              </button>
            </div>

            {filteredStudents.map(
              (student) => {
                const enrollment =
                  enrollmentMap.get(
                    student.id
                  );

                const phone =
                  studentPhone(
                    student,
                    isAdultCourse(selectedGroup)
                  );

                const usage =
                  lessonUsage(
                    enrollment
                  );

                const renewal =
                  renewalInfo(
                    enrollment
                  );

                const isCompensationLesson =
                  compensationStudentIds.has(student.id);

                const compensationLesson =
                  activeCompensationLessons.find(
                    (lesson) => lesson.student_id === student.id
                  );

                return (
                  <div
                    key={student.id}
                    style={{
                      padding: 16,
                      marginTop: 10,
                      border: isCompensationLesson
                        ? "1px solid #c4b5fd"
                        : "1px solid #e7edf4",
                      borderRadius: 16,
                      background: isCompensationLesson
                        ? "linear-gradient(135deg,#ffffff 0%,#faf8ff 100%)"
                        : "#ffffff",
                      boxShadow: "0 6px 18px rgba(15,42,76,.035)",
                      minWidth: 0,
                      boxSizing: "border-box",
                    }}
                  >
                    <div
                      style={{
                        display:
                          "flex",
                        justifyContent:
                          "space-between",
                        gap: 12,
                        flexWrap:
                          "wrap",
                      }}
                    >
                      <div
                        style={{
                          flex: 1,
                          minWidth: 0,
                        }}
                      >
                        <div
                          style={{
                            display:
                              "flex",
                            alignItems:
                              "center",
                            gap: 8,
                            flexWrap:
                              "wrap",
                          }}
                        >
                          <Link
                            href={`/ogrenciler/${student.id}`}
                            style={{
                              color: "#123b68",
                              fontSize: 16,
                              fontWeight: 900,
                              textDecoration: "none",
                            }}
                          >
                            {student.first_name || ""}{" "}
                            {student.last_name || ""}
                          </Link>

                          <span
                            style={{
                              display:
                                "inline-flex",
                              padding:
                                "5px 9px",
                              borderRadius:
                                999,
                              background:
                                renewal.background,
                              color:
                                renewal.color,
                              border: `1px solid ${renewal.border}`,
                              fontSize:
                                10,
                              fontWeight:
                                900,
                            }}
                          >
                            {renewal.label}
                          </span>

                          {isCompensationLesson && (
                            <span
                              style={{
                                display: "inline-flex",
                                padding: "5px 9px",
                                borderRadius: 999,
                                background: "#ede9fe",
                                color: "#6d28d9",
                                border: "1px solid #c4b5fd",
                                fontSize: 10,
                                fontWeight: 900,
                              }}
                            >
                              🟣 TELAFİ DERSİ
                            </span>
                          )}
                        </div>

                        <div
                          style={{
                            marginTop:
                              7,
                            display:
                              "flex",
                            gap: 8,
                            flexWrap:
                              "wrap",
                            color:
                              "#64748b",
                            fontSize:
                              11,
                          }}
                        >
                          <span>
                            No:{" "}
                            {student.student_number ||
                              "—"}
                          </span>

                          {student.swimming_level && (
                            <span>
                              🏊{" "}
                              {
                                student.swimming_level
                              }
                            </span>
                          )}
                        </div>

                        <div
                          style={{
                            marginTop:
                              9,
                            display:
                              "grid",
                            gridTemplateColumns:
                              "repeat(auto-fit,minmax(120px,1fr))",
                            gap: 7,
                            maxWidth:
                              760,
                          }}
                        >
                          <InfoBox
                            title="Paket"
                            value={`${usage.total} Ders`}
                          />

                          <InfoBox
                            title="Kullanılan"
                            value={`${usage.used} / ${usage.total}`}
                          />

                          <InfoBox
                            title="Kalan"
                            value={`${usage.remaining} Ders`}
                            danger={
                              usage.remaining <=
                              2
                            }
                          />

                          <InfoBox
                            title="Bitiş"
                            value={formatDate(
                              enrollment?.planned_end_date
                            )}
                            danger={
                              usage.remaining <=
                              2
                            }
                          />
                        </div>

                        <div
                          style={{
                            marginTop:
                              7,
                            color:
                              "#7c8998",
                            fontSize:
                              11,
                          }}
                        >
                          📅 Başlangıç:{" "}
                          {formatDate(
                            enrollment?.start_date
                          )}
                          {" · "}
                          📅 Planlanan Bitiş:{" "}
                          {formatDate(
                            enrollment?.planned_end_date
                          )}
                        </div>
                      </div>

                      <div
                        style={{
                          display: "flex",
                          gap: 7,
                          flexWrap: "wrap",
                          alignItems: "flex-start",
                          justifyContent: "flex-end",
                          flex: "1 1 330px",
                          minWidth: 0,
                        }}
                      >
                        <button
                          type="button"
                          onClick={() =>
                            setContactStudent(
                              contactStudent ===
                                student.id
                                ? null
                                : student.id
                            )
                          }
                          style={{
                            ...smallStyle,
                            ...contactActionStyle,
                          }}
                        >
                          📇 İletişim
                        </button>

                        <button
                          type="button"
                          disabled={!phone}
                          onClick={() =>
                            call(student)
                          }
                          style={{
                            ...smallStyle,
                            ...callActionStyle,
                            opacity: phone ? 1 : 0.45,
                            cursor: phone ? "pointer" : "not-allowed",
                          }}
                        >
                          ☎️ Ara
                        </button>

                        <button
                          type="button"
                          disabled={!phone}
                          onClick={() =>
                            whatsapp(
                              student
                            )
                          }
                          style={{
                            ...smallStyle,
                            ...whatsappActionStyle,
                            opacity: phone ? 1 : 0.45,
                            cursor: phone ? "pointer" : "not-allowed",
                          }}
                        >
                          {whatsappButtonLabel(
                            statuses[student.id]
                          )}
                        </button>

                        <Link
                          href={`/ogrenciler/${student.id}`}
                          style={{
                            ...smallStyle,
                            ...detailActionStyle,
                          }}
                        >
                          👤 Öğrenci Kartı
                        </Link>
                      </div>
                    </div>

                    {contactStudent ===
                      student.id && (
                      <div
                        style={{
                          marginTop:
                            10,
                          padding:
                            12,
                          borderRadius:
                            12,
                          background:
                            "#f6f9fc",
                        }}
                      >
                        <strong>
                          {student.guardian_name
                            ? `Veli: ${student.guardian_name}`
                            : "İletişim Bilgileri"}
                        </strong>

                        <div
                          style={{
                            marginTop: 8,
                            display: "grid",
                            gridTemplateColumns:
                              "repeat(auto-fit,minmax(180px,1fr))",
                            gap: 8,
                          }}
                        >
                          <ContactBox
                            title="Veli Telefonu"
                            value={student.guardian_phone}
                          />

                          <ContactBox
                            title="Öğrenci Telefonu"
                            value={student.phone}
                          />

                          <ContactBox
                            title="E-posta"
                            value={
                              student.guardian_email ||
                              student.email
                            }
                          />
                        </div>

                        {phone && (
                          <div
                            style={{
                              marginTop: 9,
                              display: "flex",
                              gap: 7,
                              flexWrap: "wrap",
                            }}
                          >
                            <button
                              type="button"
                              onClick={() => call(student)}
                              style={{
                                ...smallStyle,
                                ...callActionStyle,
                              }}
                            >
                              ☎️ Hemen Ara
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                whatsapp(student)
                              }
                              style={{
                                ...smallStyle,
                                ...whatsappActionStyle,
                              }}
                            >
                              {whatsappButtonLabel(
                                statuses[student.id]
                              )}
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                copyPhone(student)
                              }
                              style={smallStyle}
                            >
                              📋 Numarayı Kopyala
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {isCompensationLesson && (
                      <div
                        style={{
                          marginTop: 10,
                          padding: 12,
                          borderRadius: 12,
                          background: "#f5f3ff",
                          border: "1px solid #c4b5fd",
                          color: "#5b21b6",
                          fontSize: 11,
                          fontWeight: 900,
                        }}
                      >
                        🟣 Bu öğrenci bu seansa TELAFİ dersi olarak eklenmiştir.
                        Geldiğinde yoklama otomatik olarak Telafi şeklinde işlenecektir.
                        {compensationLesson?.note
                          ? ` · Not: ${compensationLesson.note}`
                          : ""}
                      </div>
                    )}

                    {(student.medical_note ||
                      student.general_note) && (
                      <div
                        style={{
                          marginTop:
                            9,
                          padding:
                            10,
                          borderRadius:
                            10,
                          background:
                            "#fff7ed",
                          color:
                            "#9a3412",
                          fontSize:
                            11,
                          fontWeight:
                            800,
                        }}
                      >
                        ⚠{" "}
                        {student.medical_note ||
                          student.general_note}
                      </div>
                    )}

                    <div
                      style={{
                        marginTop: 10,
                        color: "#64748b",
                        fontSize: 10,
                        lineHeight: 1.45,
                      }}
                    >
                      ℹ️ İzinli yalnızca bilgilendirme statüsüdür; ders hakkından düşer.
                      {isCompensationLesson
                        ? " Bu satır telafi programından gelmiştir."
                        : ""}
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns:
                          "repeat(auto-fit,minmax(260px,1fr))",
                        gap: 10,
                        marginTop: 10,
                        minWidth: 0,
                      }}
                    >
                      <div
                        style={{
                          display:
                            "grid",
                          gridTemplateColumns:
                            "repeat(auto-fit,minmax(120px,1fr))",
                          gap: 7,
                        }}
                      >
                        {(
                          isCompensationLesson
                            ? ([
                                "compensation",
                                "absent",
                                "excused",
                              ] as AttendanceStatus[])
                            : (Object.keys(
                                STATUS_META
                              ) as AttendanceStatus[])
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
                                  setStatuses(
                                    (
                                      old
                                    ) => ({
                                      ...old,
                                      [student.id]:
                                        status,
                                    })
                                  )
                                }
                                style={{
                                  minHeight: 48,
                                  padding: "8px 10px",
                                  borderRadius: 12,
                                  border:
                                    active
                                      ? `2px solid ${meta.border}`
                                      : "1px solid #dbe5ef",
                                  background:
                                    active
                                      ? meta.background
                                      : "#fff",
                                  color:
                                    active
                                      ? meta.color
                                      : "#53677f",
                                  fontWeight: 900,
                                  fontSize: 12,
                                  lineHeight: 1.2,
                                  whiteSpace: "normal",
                                  cursor: "pointer",
                                }}
                              >
                                {isCompensationLesson &&
                                status === "compensation"
                                  ? "✓ Geldi · TELAFİ"
                                  : meta.label}
                              </button>
                            );
                          }
                        )}
                      </div>

                      <input
                        value={
                          notes[
                            student.id
                          ] || ""
                        }
                        onChange={(
                          e
                        ) =>
                          setNotes(
                            (
                              old
                            ) => ({
                              ...old,
                              [student.id]:
                                e.target
                                  .value,
                            })
                          )
                        }
                        placeholder="Antrenör notu..."
                        style={inputStyle}
                      />
                    </div>
                  </div>
                );
              }
            )}

            {!filteredStudents.length && (
              <div
                style={{
                  padding: 30,
                  textAlign:
                    "center",
                  color:
                    "#7c8998",
                }}
              >
                Bu filtreye uygun öğrenci bulunamadı.
              </div>
            )}
          </section>

          <section
            style={{
              ...panelStyle,
              position: "sticky",
              bottom: 10,
              display: "flex",
              justifyContent:
                "space-between",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
              boxShadow:
                "0 15px 40px rgba(16,47,85,.14)",
            }}
          >
            <div>
              <strong>
                {message ||
                  "Yoklama hazır."}
              </strong>

              <div
                style={{
                  marginTop: 4,
                  fontSize: 11,
                  color:
                    "#7c8998",
                }}
              >
                Eksik işaretleme:{" "}
                {totals.missing}
                {" · "}
                Yenileme uyarısı:{" "}
                {renewalCounts.total}
              </div>
            </div>

            <button
              type="button"
              disabled={isPending}
              onClick={save}
              style={{
                minHeight: 50,
                minWidth: 0,
                width: "min(100%, 260px)",
                border: 0,
                borderRadius: 13,
                background:
                  hasSaved
                    ? "#0f766e"
                    : "#0b6ff4",
                color: "#fff",
                fontWeight: 900,
                cursor:
                  isPending
                    ? "wait"
                    : "pointer",
              }}
            >
              {isPending
                ? "KAYDEDİLİYOR..."
                : hasSaved
                ? "YOKLAMAYI GÜNCELLE"
                : "YOKLAMAYI KAYDET"}
            </button>
          </section>
        </>
      )}

      {view === "monthly" && (
        <section style={panelStyle}>
          <div
            style={{
              display: "flex",
              justifyContent:
                "space-between",
              gap: 10,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <div>
              <strong
                style={{
                  fontSize: 16,
                  color: "#153e69",
                }}
              >
                Aylık Yoklama Görünümü
              </strong>

              <div
                style={{
                  marginTop: 4,
                  color: "#64748b",
                  fontSize: 11,
                }}
              >
                Ders tarihlerine tıklayarak geçmiş yoklamaları düzenleyebilirsiniz.
              </div>
            </div>

            <input
              type="month"
              value={month}
              onChange={(e) =>
                setMonth(
                  e.target.value
                )
              }
              style={{
                ...inputStyle,
                width: 180,
              }}
            />
          </div>

          <div
            style={{
              overflowX: "auto",
              marginTop: 15,
            }}
          >
            <table
              style={{
                borderCollapse:
                  "collapse",
                width: "100%",
                minWidth:
                  Math.max(
                    1100,
                    540 +
                      lessonDates.length *
                        58
                  ),
              }}
            >
              <thead>
                <tr>
                  <th
                    style={{
                      ...thStyle,
                      minWidth: 220,
                      textAlign:
                        "left",
                    }}
                  >
                    Öğrenci
                  </th>

                  {lessonDates.map(
                    (date) => (
                      <th
                        key={date}
                        style={thStyle}
                      >
                        <div>
                          {shortDate(
                            date
                          )}
                        </div>
                        <div
                          style={{
                            marginTop:
                              3,
                            fontSize:
                              8,
                          }}
                        >
                          {DAY_NAMES[
                            dateWeekday(
                              date
                            )
                          ]}
                        </div>
                      </th>
                    )
                  )}

                  <th style={thStyle}>
                    Kullanılan
                  </th>

                  <th style={thStyle}>
                    Kalan
                  </th>

                  <th
                    style={{
                      ...thStyle,
                      minWidth: 100,
                    }}
                  >
                    Bitiş
                  </th>

                  <th
                    style={{
                      ...thStyle,
                      minWidth: 120,
                    }}
                  >
                    Durum
                  </th>
                </tr>
              </thead>

              <tbody>
                {groupStudents.map(
                  (student) => {
                    const enrollment =
                      enrollmentMap.get(
                        student.id
                      );

                    const usage =
                      lessonUsage(
                        enrollment
                      );

                    const renewal =
                      renewalInfo(
                        enrollment
                      );

                    return (
                      <tr
                        key={
                          student.id
                        }
                      >
                        <td
                          style={{
                            ...tdStyle,
                            textAlign:
                              "left",
                            fontWeight:
                              800,
                            color:
                              "#153e69",
                          }}
                        >
                          <div>
                            {student.first_name ||
                              ""}{" "}
                            {student.last_name ||
                              ""}
                          </div>

                          <div
                            style={{
                              marginTop:
                                3,
                              color:
                                "#94a3b8",
                              fontSize:
                                9,
                            }}
                          >
                            {student.student_number ||
                              ""}
                          </div>
                        </td>

                        {lessonDates.map(
                          (date) => {
                            const record =
                              monthlyMap.get(
                                `${student.id}_${date}`
                              );

                            return (
                              <td
                                key={
                                  date
                                }
                                style={
                                  tdStyle
                                }
                              >
                                <button
                                  type="button"
                                  onClick={() => {
                                    setLessonDate(
                                      date
                                    );

                                    setView(
                                      "daily"
                                    );
                                  }}
                                  style={{
                                    width:
                                      36,
                                    height:
                                      36,
                                    borderRadius:
                                      9,
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
                                          ]
                                            .background
                                        : "#f8fafc",
                                    color:
                                      record
                                        ? STATUS_META[
                                            record
                                              .status
                                          ]
                                            .color
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
                                      ]
                                        .short
                                    : "·"}
                                </button>
                              </td>
                            );
                          }
                        )}

                        <td
                          style={
                            tdStyle
                          }
                        >
                          {usage.used} /{" "}
                          {usage.total}
                        </td>

                        <td
                          style={
                            tdStyle
                          }
                        >
                          <strong
                            style={{
                              color:
                                usage.remaining <=
                                1
                                  ? "#b91c1c"
                                  : usage.remaining <=
                                    3
                                  ? "#c2410c"
                                  : "#15803d",
                            }}
                          >
                            {
                              usage.remaining
                            }
                          </strong>
                        </td>

                        <td
                          style={
                            tdStyle
                          }
                        >
                          {formatDate(
                            enrollment?.planned_end_date
                          )}
                        </td>

                        <td
                          style={
                            tdStyle
                          }
                        >
                          <span
                            style={{
                              display:
                                "inline-flex",
                              padding:
                                "5px 7px",
                              borderRadius:
                                999,
                              background:
                                renewal.background,
                              color:
                                renewal.color,
                              border: `1px solid ${renewal.border}`,
                              fontSize:
                                8,
                              fontWeight:
                                900,
                              whiteSpace:
                                "nowrap",
                            }}
                          >
                            {
                              renewal.label
                            }
                          </span>
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

      {view === "history" && (
        <section style={panelStyle}>
          <div
            style={{
              display: "flex",
              justifyContent:
                "space-between",
              gap: 10,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <strong>
              Geçmiş Yoklamalar
            </strong>

            <input
              type="month"
              value={month}
              onChange={(e) =>
                setMonth(
                  e.target.value
                )
              }
              style={{
                ...inputStyle,
                width: 180,
              }}
            />
          </div>

          <div
            style={{
              marginTop: 15,
            }}
          >
            {!monthlyByDate.length && (
              <div
                style={{
                  padding: 30,
                  textAlign:
                    "center",
                  color:
                    "#7c8998",
                }}
              >
                Bu ay için kayıt bulunamadı.
              </div>
            )}

            {monthlyByDate.map(
              ([date, records]) => {
                const present =
                  records.filter(
                    (record) =>
                      record.status ===
                      "present"
                  ).length;

                const absent =
                  records.filter(
                    (record) =>
                      record.status ===
                      "absent"
                  ).length;

                const excused =
                  records.filter(
                    (record) =>
                      record.status ===
                      "excused"
                  ).length;

                const compensation =
                  records.filter(
                    (record) =>
                      record.status ===
                      "compensation"
                  ).length;

                return (
                  <button
                    type="button"
                    key={date}
                    onClick={() => {
                      setLessonDate(
                        date
                      );

                      setView(
                        "daily"
                      );
                    }}
                    style={{
                      width: "100%",
                      padding: 14,
                      marginBottom:
                        8,
                      border:
                        "1px solid #e2e8f0",
                      borderRadius:
                        12,
                      background:
                        "#f8fafc",
                      display:
                        "flex",
                      justifyContent:
                        "space-between",
                      gap: 12,
                      cursor:
                        "pointer",
                    }}
                  >
                    <strong>
                      {formatDate(
                        date
                      )}
                    </strong>

                    <span>
                      ✓ {present}
                      {" · "}✕{" "}
                      {absent}
                      {" · "}İ{" "}
                      {excused}
                      {" · "}T{" "}
                      {compensation}
                    </span>
                  </button>
                );
              }
            )}
          </div>
        </section>
      )}
    </div>
  );
}

function Stat({
  name,
  value,
}: {
  name: string;
  value: number;
}) {
  return (
    <div
      style={{
        padding: 13,
        borderRadius: 14,
        background: "#fff",
        border:
          "1px solid #dce7f2",
      }}
    >
      <span
        style={{
          fontSize: 10,
          color: "#64748b",
          fontWeight: 900,
        }}
      >
        {name}
      </span>

      <strong
        style={{
          display: "block",
          marginTop: 4,
          color: "#153e69",
          fontSize: 22,
        }}
      >
        {value}
      </strong>
    </div>
  );
}

function RenewalCard({
  title,
  value,
  active,
  background,
  color,
  onClick,
}: {
  title: string;
  value: number;
  active: boolean;
  background: string;
  color: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        textAlign: "left",
        padding: 14,
        borderRadius: 15,
        border: active
          ? "2px solid #0b6ff4"
          : "1px solid rgba(148,163,184,.24)",
        background,
        color,
        cursor: "pointer",
      }}
    >
      <span
        style={{
          display: "block",
          fontSize: 10,
          fontWeight: 900,
        }}
      >
        {title}
      </span>

      <strong
        style={{
          display: "block",
          marginTop: 5,
          fontSize: 24,
        }}
      >
        {value}
      </strong>
    </button>
  );
}

function InfoBox({
  title,
  value,
  danger = false,
}: {
  title: string;
  value: string;
  danger?: boolean;
}) {
  return (
    <div
      style={{
        padding: "8px 9px",
        borderRadius: 10,
        background: danger
          ? "#fff7ed"
          : "#f8fafc",
        border: danger
          ? "1px solid #fed7aa"
          : "1px solid #e2e8f0",
      }}
    >
      <span
        style={{
          display: "block",
          fontSize: 8,
          fontWeight: 900,
          color: "#94a3b8",
          textTransform:
            "uppercase",
        }}
      >
        {title}
      </span>

      <strong
        style={{
          display: "block",
          marginTop: 3,
          fontSize: 11,
          color: danger
            ? "#c2410c"
            : "#334155",
        }}
      >
        {value}
      </strong>
    </div>
  );
}


function ContactBox({
  title,
  value,
}: {
  title: string;
  value?: string | null;
}) {
  return (
    <div
      style={{
        padding: "9px 10px",
        borderRadius: 10,
        background: "#fff",
        border: "1px solid #e2e8f0",
        minWidth: 0,
      }}
    >
      <span
        style={{
          display: "block",
          color: "#94a3b8",
          fontSize: 8,
          fontWeight: 900,
          textTransform: "uppercase",
        }}
      >
        {title}
      </span>

      <strong
        style={{
          display: "block",
          marginTop: 3,
          color: "#334155",
          fontSize: 11,
          overflowWrap: "anywhere",
        }}
      >
        {value || "—"}
      </strong>
    </div>
  );
}

const contactActionStyle = {
  background: "#eff6ff",
  color: "#1d4ed8",
  border: "1px solid #bfdbfe",
} as const;

const callActionStyle = {
  background: "#ecfdf3",
  color: "#166534",
  border: "1px solid #bbf7d0",
} as const;

const whatsappActionStyle = {
  background: "#f0fdf4",
  color: "#15803d",
  border: "1px solid #86efac",
} as const;

const detailActionStyle = {
  background: "#f8fafc",
  color: "#0f3a63",
  border: "1px solid #cbd5e1",
} as const;

const panelStyle = {
  padding: 18,
  width: "100%",
  minWidth: 0,
  boxSizing: "border-box",
  background: "#fff",
  border:
    "1px solid #dce7f2",
  borderRadius: 20,
} as const;

const labelStyle = {
  display: "grid",
  gap: 6,
  fontSize: 10,
  color: "#64748b",
  fontWeight: 900,
} as const;

const inputStyle = {
  width: "100%",
  minWidth: 0,
  minHeight: 44,
  boxSizing: "border-box",
  border:
    "1px solid #d8e2ec",
  borderRadius: 11,
  background: "#fff",
  padding: "0 11px",
  color: "#183b61",
  fontWeight: 800,
} as const;

const smallStyle = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 4,
  minHeight: 38,
  padding: "8px 11px",
  border:
    "1px solid #dce7f2",
  borderRadius: 10,
  background: "#f8fafc",
  color: "#315577",
  textDecoration: "none",
  cursor: "pointer",
  fontSize: 10,
  fontWeight: 900,
} as const;

const darkStyle = {
  border:
    "1px solid rgba(255,255,255,.2)",
  borderRadius: 10,
  padding: "8px 11px",
  background:
    "rgba(255,255,255,.08)",
  color: "#fff",
  cursor: "pointer",
  fontWeight: 900,
} as const;

const thStyle = {
  padding: "10px 7px",
  borderBottom:
    "1px solid #e2e8f0",
  background: "#f8fafc",
  color: "#64748b",
  fontSize: 10,
  fontWeight: 900,
  textAlign: "center",
} as const;

const tdStyle = {
  padding: "8px 7px",
  borderBottom:
    "1px solid #edf2f7",
  textAlign: "center",
} as const;

function navStyle(
  active: boolean
) {
  return {
    border: 0,
    borderRadius: 11,
    padding: "10px 12px",
    background: active
      ? "#0b6ff4"
      : "#f6f9fc",
    color: active
      ? "#fff"
      : "#315577",
    cursor: "pointer",
    textDecoration: "none",
    fontSize: 11,
    fontWeight: 900,
    flex: "1 1 135px",
    minHeight: 40,
    textAlign: "center",
    boxSizing: "border-box",
  } as const;
}
