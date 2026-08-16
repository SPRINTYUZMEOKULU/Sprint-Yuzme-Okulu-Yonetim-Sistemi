"use client";

import { useMemo, useState, useTransition } from "react";
import { saveAttendance } from "./actions";

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

type Props = {
  organizationId: string;
  currentProfileId: string;
  groups: Group[];
  schedules: Schedule[];
  memberships: Membership[];
  students: Student[];
  enrollments: Enrollment[];
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

const STATUS_OPTIONS: {
  value: AttendanceStatus;
  label: string;
  icon: string;
}[] = [
  {
    value: "present",
    label: "Geldi",
    icon: "✓",
  },
  {
    value: "absent",
    label: "Gelmedi",
    icon: "✕",
  },
  {
    value: "excused",
    label: "İzinli",
    icon: "○",
  },
  {
    value: "compensation",
    label: "Telafi",
    icon: "+",
  },
];

function todayInTurkey() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function shortTime(value?: string | null) {
  if (!value) return "—";
  return value.slice(0, 5);
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
  const [lessonDate, setLessonDate] = useState(todayInTurkey());
  const [selectedGroupId, setSelectedGroupId] = useState(
    groups[0]?.id || ""
  );

  const [selectedScheduleId, setSelectedScheduleId] = useState("");

  const [statuses, setStatuses] = useState<
    Record<string, AttendanceStatus>
  >({});

  const [notes, setNotes] = useState<Record<string, string>>({});

  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  const selectedGroup = useMemo(
    () => groups.find((group) => group.id === selectedGroupId),
    [groups, selectedGroupId]
  );

  const groupSchedules = useMemo(
    () =>
      schedules.filter(
        (schedule) => schedule.group_id === selectedGroupId
      ),
    [schedules, selectedGroupId]
  );

  const selectedSchedule =
    groupSchedules.find(
      (schedule) => schedule.id === selectedScheduleId
    ) || null;

  const groupStudentIds = useMemo(() => {
    return new Set(
      memberships
        .filter(
          (membership) =>
            membership.group_id === selectedGroupId &&
            membership.is_active
        )
        .map((membership) => membership.student_id)
    );
  }, [memberships, selectedGroupId]);

  const groupStudents = useMemo(() => {
    return students
      .filter((student) => groupStudentIds.has(student.id))
      .sort((a, b) =>
        `${a.first_name} ${a.last_name}`.localeCompare(
          `${b.first_name} ${b.last_name}`,
          "tr"
        )
      );
  }, [students, groupStudentIds]);

  const counts = useMemo(() => {
    let present = 0;
    let absent = 0;
    let excused = 0;
    let compensation = 0;

    Object.values(statuses).forEach((status) => {
      if (status === "present") present += 1;
      if (status === "absent") absent += 1;
      if (status === "excused") excused += 1;
      if (status === "compensation") compensation += 1;
    });

    return {
      present,
      absent,
      excused,
      compensation,
    };
  }, [statuses]);

  function selectGroup(groupId: string) {
    setSelectedGroupId(groupId);
    setSelectedScheduleId("");
    setStatuses({});
    setNotes({});
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
    const next: Record<string, AttendanceStatus> = {};

    groupStudents.forEach((student) => {
      next[student.id] = "present";
    });

    setStatuses(next);
  }

  function handleSave() {
    setMessage("");

    if (!selectedGroupId) {
      setMessage("Önce grup seçmelisiniz.");
      return;
    }

    if (!selectedScheduleId) {
      setMessage("Önce ders günü ve seans seçmelisiniz.");
      return;
    }

    if (!groupStudents.length) {
      setMessage("Bu grupta aktif öğrenci bulunmuyor.");
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

    const records = groupStudents.map((student) => {
      const enrollment =
        enrollments.find(
          (item) =>
            item.student_id === student.id &&
            item.group_id === selectedGroupId
        ) ||
        enrollments.find(
          (item) => item.student_id === student.id
        ) ||
        null;

      return {
        studentId: student.id,
        enrollmentId: enrollment?.id || null,
        status: statuses[student.id],
        coachNote: notes[student.id]?.trim() || null,
      };
    });

    startTransition(async () => {
      const result = await saveAttendance({
        organizationId,
        currentProfileId,
        branchId: selectedGroup?.branch_id || null,
        groupId: selectedGroupId,
        scheduleId: selectedScheduleId,
        coachId:
          selectedSchedule?.coach_id ||
          selectedGroup?.primary_coach_id ||
          null,
        lessonDate,
        records,
      });

      if (!result.ok) {
        setMessage(result.message);
        return;
      }

      setMessage(
        `${result.count} öğrencinin yoklaması başarıyla kaydedildi.`
      );
    });
  }

  return (
    <div style={{ display: "grid", gap: 22 }}>
      <section
        style={{
          background: "#fff",
          border: "1px solid #dfe8f2",
          borderRadius: 20,
          padding: 20,
          boxShadow: "0 14px 36px rgba(15,42,76,.07)",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "minmax(170px,1fr) minmax(240px,2fr) minmax(220px,2fr)",
            gap: 14,
          }}
        >
          <label
            style={{
              display: "grid",
              gap: 7,
              fontSize: 12,
              fontWeight: 900,
              color: "#52667e",
            }}
          >
            TARİH

            <input
              type="date"
              value={lessonDate}
              onChange={(event) =>
                setLessonDate(event.target.value)
              }
              style={{
                width: "100%",
                minHeight: 46,
                padding: "0 12px",
                border: "1px solid #d8e2ec",
                borderRadius: 12,
                background: "#fff",
                color: "#183b61",
                fontWeight: 800,
              }}
            />
          </label>

          <label
            style={{
              display: "grid",
              gap: 7,
              fontSize: 12,
              fontWeight: 900,
              color: "#52667e",
            }}
          >
            GRUP

            <select
              value={selectedGroupId}
              onChange={(event) =>
                selectGroup(event.target.value)
              }
              style={{
                width: "100%",
                minHeight: 46,
                padding: "0 12px",
                border: "1px solid #d8e2ec",
                borderRadius: 12,
                background: "#fff",
                color: "#183b61",
                fontWeight: 800,
              }}
            >
              {!groups.length && (
                <option value="">Grup bulunamadı</option>
              )}

              {groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                  {group.course_type
                    ? ` · ${group.course_type}`
                    : ""}
                </option>
              ))}
            </select>
          </label>

          <label
            style={{
              display: "grid",
              gap: 7,
              fontSize: 12,
              fontWeight: 900,
              color: "#52667e",
            }}
          >
            DERS / SEANS

            <select
              value={selectedScheduleId}
              onChange={(event) =>
                setSelectedScheduleId(event.target.value)
              }
              style={{
                width: "100%",
                minHeight: 46,
                padding: "0 12px",
                border: "1px solid #d8e2ec",
                borderRadius: 12,
                background: "#fff",
                color: "#183b61",
                fontWeight: 800,
              }}
            >
              <option value="">Seans seçin</option>

              {groupSchedules.map((schedule) => (
                <option
                  key={schedule.id}
                  value={schedule.id}
                >
                  {DAY_NAMES[schedule.weekday] ||
                    `Gün ${schedule.weekday}`}{" "}
                  · {shortTime(schedule.start_time)} -{" "}
                  {shortTime(schedule.end_time)}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div
          style={{
            marginTop: 18,
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <div
            style={{
              padding: "9px 12px",
              borderRadius: 999,
              background: "#eff6ff",
              color: "#1d4ed8",
              fontSize: 12,
              fontWeight: 900,
            }}
          >
            Toplam: {groupStudents.length}
          </div>

          <div
            style={{
              padding: "9px 12px",
              borderRadius: 999,
              background: "#ecfdf5",
              color: "#15803d",
              fontSize: 12,
              fontWeight: 900,
            }}
          >
            Geldi: {counts.present}
          </div>

          <div
            style={{
              padding: "9px 12px",
              borderRadius: 999,
              background: "#fef2f2",
              color: "#b91c1c",
              fontSize: 12,
              fontWeight: 900,
            }}
          >
            Gelmedi: {counts.absent}
          </div>

          <div
            style={{
              padding: "9px 12px",
              borderRadius: 999,
              background: "#fffbeb",
              color: "#a16207",
              fontSize: 12,
              fontWeight: 900,
            }}
          >
            İzinli: {counts.excused}
          </div>

          <div
            style={{
              padding: "9px 12px",
              borderRadius: 999,
              background: "#eef2ff",
              color: "#4338ca",
              fontSize: 12,
              fontWeight: 900,
            }}
          >
            Telafi: {counts.compensation}
          </div>

          {!!groupStudents.length && (
            <button
              type="button"
              onClick={markAllPresent}
              style={{
                marginLeft: "auto",
                border: 0,
                borderRadius: 11,
                padding: "10px 14px",
                background: "#e8f7ee",
                color: "#137a3d",
                cursor: "pointer",
                fontWeight: 900,
              }}
            >
              ✓ Tümünü Geldi Yap
            </button>
          )}
        </div>
      </section>

      <section
        style={{
          background: "#fff",
          border: "1px solid #dfe8f2",
          borderRadius: 20,
          overflow: "hidden",
          boxShadow: "0 14px 36px rgba(15,42,76,.07)",
        }}
      >
        <div
          style={{
            padding: "16px 20px",
            background: "#edf4fb",
            color: "#53677f",
            fontSize: 12,
            fontWeight: 900,
            display: "grid",
            gridTemplateColumns:
              "minmax(220px,1.5fr) minmax(390px,2fr) minmax(220px,1fr)",
            gap: 16,
          }}
        >
          <span>ÖĞRENCİ</span>
          <span>YOKLAMA</span>
          <span>ANTRENÖR NOTU</span>
        </div>

        {groupStudents.map((student) => (
          <div
            key={student.id}
            style={{
              padding: "16px 20px",
              borderTop: "1px solid #edf2f7",
              display: "grid",
              gridTemplateColumns:
                "minmax(220px,1.5fr) minmax(390px,2fr) minmax(220px,1fr)",
              gap: 16,
              alignItems: "center",
            }}
          >
            <div>
              <strong
                style={{
                  display: "block",
                  fontSize: 15,
                  color: "#123b68",
                }}
              >
                {student.first_name} {student.last_name}
              </strong>

              <span
                style={{
                  display: "block",
                  marginTop: 4,
                  color: "#8491a0",
                  fontSize: 11,
                }}
              >
                {student.student_number ||
                  "Öğrenci numarası yok"}
              </span>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4,1fr)",
                gap: 8,
              }}
            >
              {STATUS_OPTIONS.map((option) => {
                const active =
                  statuses[student.id] === option.value;

                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() =>
                      selectStatus(
                        student.id,
                        option.value
                      )
                    }
                    style={{
                      minHeight: 42,
                      borderRadius: 11,
                      border: active
                        ? "2px solid #0b6ff4"
                        : "1px solid #dbe5ef",
                      background: active
                        ? "#eff6ff"
                        : "#fff",
                      color: active
                        ? "#0b6ff4"
                        : "#53677f",
                      cursor: "pointer",
                      fontWeight: 900,
                    }}
                  >
                    {option.icon} {option.label}
                  </button>
                );
              })}
            </div>

            <input
              type="text"
              placeholder="Not ekle..."
              value={notes[student.id] || ""}
              onChange={(event) =>
                setNotes((current) => ({
                  ...current,
                  [student.id]: event.target.value,
                }))
              }
              style={{
                width: "100%",
                minHeight: 42,
                padding: "0 11px",
                border: "1px solid #dbe5ef",
                borderRadius: 11,
                color: "#183b61",
              }}
            />
          </div>
        ))}

        {!groupStudents.length && (
          <div
            style={{
              padding: 38,
              textAlign: "center",
              color: "#7b899a",
            }}
          >
            Bu grupta aktif öğrenci bulunamadı.
          </div>
        )}
      </section>

      <section
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
          background: "#fff",
          border: "1px solid #dfe8f2",
          borderRadius: 18,
          padding: 18,
        }}
      >
        <div>
          <strong
            style={{
              display: "block",
              color: message.includes("başarıyla")
                ? "#15803d"
                : "#b45309",
            }}
          >
            {message || "Yoklama kaydedilmeye hazır."}
          </strong>

          <span
            style={{
              display: "block",
              marginTop: 4,
              fontSize: 12,
              color: "#7c8998",
            }}
          >
            Kaydetmeden önce tüm öğrencilerin durumunu
            işaretleyin.
          </span>
        </div>

        <button
          type="button"
          disabled={isPending}
          onClick={handleSave}
          style={{
            minWidth: 220,
            minHeight: 50,
            border: 0,
            borderRadius: 13,
            background: isPending ? "#94a3b8" : "#0b6ff4",
            color: "#fff",
            cursor: isPending ? "wait" : "pointer",
            fontWeight: 900,
            fontSize: 14,
            boxShadow: "0 8px 20px rgba(11,111,244,.22)",
          }}
        >
          {isPending
            ? "KAYDEDİLİYOR..."
            : "YOKLAMAYI KAYDET"}
        </button>
      </section>
    </div>
  );
}
