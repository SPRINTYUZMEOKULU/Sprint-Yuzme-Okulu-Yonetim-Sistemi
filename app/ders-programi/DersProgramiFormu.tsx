"use client";

import {
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

type Branch = {
  id: string;
  name?: string | null;
};

type Group = {
  id: string;
  branch_id?: string | null;
  name?: string | null;
  course_type?: string | null;
  primary_coach_id?: string | null;
};

type Coach = {
  id: string;
  full_name?: string | null;
  email?: string | null;
};

type Student = {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  preferred_days?: string | null;
};

type Membership = {
  student_id?: string | null;
  group_id?: string | null;
  is_active?: boolean | null;
};

type Props = {
  branches: Branch[];
  groups: Group[];
  coaches: Coach[];
  students: Student[];
  memberships: Membership[];
  action: (
    formData: FormData
  ) => void | Promise<void>;
};

type DayDefinition = {
  id: number;
  ad: string;
  aliases: string[];
};

const GUNLER: DayDefinition[] = [
  {
    id: 1,
    ad: "Pazartesi",
    aliases: [
      "pazartesi",
      "pzt",
      "monday",
    ],
  },
  {
    id: 2,
    ad: "Salı",
    aliases: [
      "salı",
      "sali",
      "sal",
      "tuesday",
    ],
  },
  {
    id: 3,
    ad: "Çarşamba",
    aliases: [
      "çarşamba",
      "carsamba",
      "çar",
      "car",
      "wednesday",
    ],
  },
  {
    id: 4,
    ad: "Perşembe",
    aliases: [
      "perşembe",
      "persembe",
      "per",
      "thursday",
    ],
  },
  {
    id: 5,
    ad: "Cuma",
    aliases: [
      "cuma",
      "cum",
      "friday",
    ],
  },
  {
    id: 6,
    ad: "Cumartesi",
    aliases: [
      "cumartesi",
      "cmt",
      "saturday",
    ],
  },
  {
    id: 7,
    ad: "Pazar",
    aliases: [
      "pazar",
      "paz",
      "sunday",
    ],
  },
];

function normalize(
  value?: string | null
) {
  return (value || "")
    .toLocaleLowerCase("tr-TR")
    .replace(
      /[.,;:/|+\-_()[\]{}]/g,
      " "
    )
    .replace(/\s+/g, " ")
    .trim();
}

/*
 * Öğrencinin preferred_days alanındaki
 * günleri güvenli biçimde ayırır.
 *
 * "Pazartesi Çarşamba Cuma"
 * "Pzt, Çar, Cum"
 * gibi değerleri destekler.
 *
 * "Cumartesi" kelimesini yanlışlıkla
 * "Cuma" saymaz.
 */
function parsePreferredDays(
  value?: string | null
) {
  const clean = normalize(value);

  if (!clean) {
    return [];
  }

  const tokens =
    clean.split(" ");

  const found =
    new Set<number>();

  for (const gun of GUNLER) {
    const matched =
      gun.aliases.some((alias) =>
        tokens.includes(alias)
      );

    if (matched) {
      found.add(gun.id);
    }
  }

  return Array.from(found);
}

function calculateDayCounts(
  relatedStudents: Student[]
) {
  const counts: Record<
    number,
    number
  > = {
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
    6: 0,
    7: 0,
  };

  for (const student of
    relatedStudents) {
    const days =
      parsePreferredDays(
        student.preferred_days
      );

    for (const day of days) {
      counts[day] =
        (counts[day] || 0) + 1;
    }
  }

  return counts;
}

function suggestedDaysFromCounts(
  counts: Record<number, number>
) {
  const highest = Math.max(
    ...Object.values(counts),
    0
  );

  if (highest <= 0) {
    return [];
  }

  /*
   * En yoğun kayıt gününün
   * en az %60'ına ulaşan günleri
   * otomatik öneriyoruz.
   *
   * Örnek:
   * Pazartesi 14
   * Çarşamba 14
   * Cuma 13
   * Salı 2
   *
   * => Pzt / Çar / Cum
   */
  const threshold = Math.max(
    1,
    Math.ceil(highest * 0.6)
  );

  return GUNLER
    .filter(
      (gun) =>
        (counts[gun.id] || 0) >=
        threshold
    )
    .map((gun) => gun.id);
}

export default function DersProgramiFormu({
  branches,
  groups,
  coaches,
  students,
  memberships,
  action,
}: Props) {
  const [
    branchId,
    setBranchId,
  ] = useState("");

  const [
    groupId,
    setGroupId,
  ] = useState("");

  const [
    coachId,
    setCoachId,
  ] = useState("");

  const [
    selectedDays,
    setSelectedDays,
  ] = useState<number[]>([]);

  /*
   * Seçili şubeye ait gruplar.
   */
  const visibleGroups =
    useMemo(() => {
      if (!branchId) {
        return groups;
      }

      return groups.filter(
        (group) =>
          group.branch_id ===
          branchId
      );
    }, [groups, branchId]);

  /*
   * Seçili grubun aktif öğrenci ID'leri.
   */
  const groupStudentIds =
    useMemo(() => {
      if (!groupId) {
        return new Set<string>();
      }

      return new Set(
        memberships
          .filter(
            (membership) =>
              membership.group_id ===
                groupId &&
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
      groupId,
    ]);

  /*
   * Seçili grubun öğrencileri.
   */
  const groupStudents =
    useMemo(() => {
      if (!groupId) {
        return [];
      }

      return students.filter(
        (student) =>
          groupStudentIds.has(
            student.id
          )
      );
    }, [
      students,
      groupStudentIds,
      groupId,
    ]);

  /*
   * Her gün kaç öğrencide kayıtlı?
   */
  const dayCounts =
    useMemo(() => {
      return calculateDayCounts(
        groupStudents
      );
    }, [groupStudents]);

  const maxCount = Math.max(
    ...Object.values(dayCounts),
    0
  );

  /*
   * Grubun kayıt günlerini
   * tekrar analiz edip öner.
   */
  function suggestDays(
    nextGroupId: string
  ) {
    if (!nextGroupId) {
      setSelectedDays([]);
      return;
    }

    const ids =
      new Set(
        memberships
          .filter(
            (membership) =>
              membership.group_id ===
                nextGroupId &&
              membership.is_active !==
                false &&
              !!membership.student_id
          )
          .map(
            (membership) =>
              membership.student_id as string
          )
      );

    const relatedStudents =
      students.filter(
        (student) =>
          ids.has(student.id)
      );

    const counts =
      calculateDayCounts(
        relatedStudents
      );

    setSelectedDays(
      suggestedDaysFromCounts(
        counts
      )
    );
  }

  /*
   * Grup değiştiğinde:
   *
   * - Şubesini öner
   * - Ana eğitmeni öner
   * - Öğrenci kayıt günlerini getir
   */
  function handleGroupChange(
    nextGroupId: string
  ) {
    setGroupId(nextGroupId);

    if (!nextGroupId) {
      setSelectedDays([]);
      setCoachId("");
      return;
    }

    const selectedGroup =
      groups.find(
        (group) =>
          group.id ===
          nextGroupId
      );

    if (
      selectedGroup?.branch_id
    ) {
      setBranchId(
        selectedGroup.branch_id
      );
    }

    if (
      selectedGroup?.primary_coach_id
    ) {
      setCoachId(
        selectedGroup.primary_coach_id
      );
    } else {
      setCoachId("");
    }

    suggestDays(nextGroupId);
  }

  function handleBranchChange(
    nextBranchId: string
  ) {
    setBranchId(nextBranchId);

    /*
     * Şube değişirse eski grubun
     * yanlışlıkla kalmasını istemiyoruz.
     */
    setGroupId("");
    setCoachId("");
    setSelectedDays([]);
  }

  function toggleDay(
    dayId: number
  ) {
    setSelectedDays(
      (current) => {
        if (
          current.includes(dayId)
        ) {
          return current.filter(
            (item) =>
              item !== dayId
          );
        }

        return [
          ...current,
          dayId,
        ].sort(
          (a, b) => a - b
        );
      }
    );
  }

  return (
    <form action={action}>
      {/* =============================================
          TEMEL PROGRAM BİLGİLERİ
      ============================================= */}

      <div style={formGridStyle}>
        <Field label="Havuz / Şube">
          <select
            name="branch_id"
            value={branchId}
            onChange={(event) =>
              handleBranchChange(
                event.target.value
              )
            }
            required
            style={inputStyle}
          >
            <option value="">
              Havuz / şube seçin
            </option>

            {branches.map(
              (branch) => (
                <option
                  key={branch.id}
                  value={branch.id}
                >
                  {branch.name ||
                    "İsimsiz Şube"}
                </option>
              )
            )}
          </select>
        </Field>

        <Field label="Grup">
          <select
            name="group_id"
            value={groupId}
            onChange={(event) =>
              handleGroupChange(
                event.target.value
              )
            }
            required
            style={inputStyle}
          >
            <option value="">
              Grup seçin
            </option>

            {visibleGroups.map(
              (group) => (
                <option
                  key={group.id}
                  value={group.id}
                >
                  {group.name ||
                    "İsimsiz Grup"}

                  {group.course_type
                    ? ` · ${group.course_type}`
                    : ""}
                </option>
              )
            )}
          </select>
        </Field>

        <Field label="Ana Eğitmen">
          <select
            name="coach_id"
            value={coachId}
            onChange={(event) =>
              setCoachId(
                event.target.value
              )
            }
            style={inputStyle}
          >
            <option value="">
              Daha sonra ata
            </option>

            {coaches.map(
              (coach) => (
                <option
                  key={coach.id}
                  value={coach.id}
                >
                  {coach.full_name ||
                    coach.email ||
                    "İsimsiz Eğitmen"}
                </option>
              )
            )}
          </select>
        </Field>

        <Field label="Başlangıç Saati">
          <input
            type="time"
            name="start_time"
            required
            style={inputStyle}
          />
        </Field>

        <Field label="Bitiş Saati">
          <input
            type="time"
            name="end_time"
            required
            style={inputStyle}
          />
        </Field>
      </div>

      {/* =============================================
          AKILLI GÜN SEÇİMİ
      ============================================= */}

      <section style={daysPanelStyle}>
        <div style={daysHeaderStyle}>
          <div>
            <strong style={daysTitleStyle}>
              Ders Günleri
            </strong>

            <div
              style={
                daysDescriptionStyle
              }
            >
              {!groupId
                ? "Grup seçildiğinde öğrencilerin kayıt günleri otomatik analiz edilir."
                : groupStudents.length ===
                  0
                ? "Bu grupta aktif öğrenci bulunamadı. Günleri manuel seçebilirsiniz."
                : `${groupStudents.length} aktif öğrencinin kayıt günleri analiz edildi.`}
            </div>
          </div>

          {groupId && (
            <button
              type="button"
              onClick={() =>
                suggestDays(
                  groupId
                )
              }
              style={
                refreshDaysButtonStyle
              }
            >
              Kayıttan Günleri Getir
            </button>
          )}
        </div>

        <div style={daysGridStyle}>
          {GUNLER.map(
            (gun) => {
              const count =
                dayCounts[
                  gun.id
                ] || 0;

              const selected =
                selectedDays.includes(
                  gun.id
                );

              const ratio =
                maxCount > 0
                  ? count /
                    maxCount
                  : 0;

              let background =
                "#f8fafc";

              let border =
                "#dfe7f1";

              let color =
                "#64748b";

              /*
               * Yoğun kayıt günü.
               */
              if (
                count > 0 &&
                ratio >= 0.6
              ) {
                background =
                  "#ecfdf3";

                border =
                  "#bbf7d0";

                color =
                  "#166534";
              }

              /*
               * Bazı öğrencilerin
               * tercih ettiği gün.
               */
              if (
                count > 0 &&
                ratio < 0.6
              ) {
                background =
                  "#fff7ed";

                border =
                  "#fed7aa";

                color =
                  "#9a3412";
              }

              /*
               * Yönetici tarafından
               * seçilmiş gün.
               */
              if (selected) {
                border =
                  "#1769e8";
              }

              const boxShadow =
                selected
                  ? "0 0 0 2px rgba(23,105,232,.12)"
                  : "none";

              return (
                <label
                  key={gun.id}
                  style={{
                    ...dayOptionStyle,
                    background,
                    border: `1px solid ${border}`,
                    color,
                    boxShadow,
                  }}
                >
                  <input
                    type="checkbox"
                    name="weekday"
                    value={gun.id}
                    checked={
                      selected
                    }
                    onChange={() =>
                      toggleDay(
                        gun.id
                      )
                    }
                  />

                  <span
                    style={
                      dayTextStyle
                    }
                  >
                    <strong
                      style={{
                        fontSize:
                          11,
                      }}
                    >
                      {gun.ad}
                    </strong>

                    <small
                      style={{
                        marginTop:
                          3,
                        fontSize:
                          9,
                        opacity:
                          0.88,
                      }}
                    >
                      {!groupId
                        ? "Grup seçin"
                        : `${count} öğrenci`}
                    </small>
                  </span>
                </label>
              );
            }
          )}
        </div>

        {groupId &&
          groupStudents.length >
            0 && (
            <div
              style={
                legendStyle
              }
            >
              <span>
                🟢 Yoğun kayıt günü
              </span>

              <span>
                🟠 Bazı öğrencilerde kayıtlı
              </span>

              <span>
                ⚪ Kayıt bulunamadı
              </span>

              <span>
                🔵 Program için seçildi
              </span>
            </div>
          )}

        {groupId &&
          selectedDays.length >
            0 && (
            <div
              style={
                selectedSummaryStyle
              }
            >
              <strong>
                Seçilen program:
              </strong>{" "}
              {selectedDays
                .map(
                  (dayId) =>
                    GUNLER.find(
                      (gun) =>
                        gun.id ===
                        dayId
                    )?.ad
                )
                .filter(Boolean)
                .join(" · ")}
            </div>
          )}
      </section>

      {/* =============================================
          KAYDET
      ============================================= */}

      <button
        type="submit"
        disabled={
          !branchId ||
          !groupId ||
          selectedDays.length ===
            0
        }
        style={{
          ...submitButtonStyle,

          background:
            !branchId ||
            !groupId ||
            selectedDays.length ===
              0
              ? "#94a3b8"
              : "#1769e8",

          cursor:
            !branchId ||
            !groupId ||
            selectedDays.length ===
              0
              ? "not-allowed"
              : "pointer",
        }}
      >
        + Programı Oluştur
      </button>
    </form>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label style={fieldStyle}>
      <span style={fieldLabelStyle}>
        {label}
      </span>

      {children}
    </label>
  );
}

/* =========================================================
   STİLLER
========================================================= */

const formGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit,minmax(190px,1fr))",
  gap: 10,
};

const fieldStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
};

const fieldLabelStyle: CSSProperties = {
  fontSize: 10,
  fontWeight: 900,
  color: "#64748b",
  textTransform: "uppercase",
  letterSpacing: 0.6,
};

const inputStyle: CSSProperties = {
  width: "100%",
  height: 42,
  border:
    "1px solid #dce5f2",
  borderRadius: 10,
  padding: "0 11px",
  background: "#ffffff",
  color: "#13233f",
  boxSizing: "border-box",
};

const daysPanelStyle: CSSProperties = {
  marginTop: 18,
  border:
    "1px solid #dfe7f1",
  background:
    "linear-gradient(135deg,#f8fbff 0%,#ffffff 100%)",
  borderRadius: 15,
  padding: 15,
};

const daysHeaderStyle: CSSProperties = {
  display: "flex",
  justifyContent:
    "space-between",
  gap: 12,
  flexWrap: "wrap",
  alignItems: "center",
  marginBottom: 12,
};

const daysTitleStyle: CSSProperties = {
  fontSize: 13,
  color: "#153e69",
};

const daysDescriptionStyle: CSSProperties = {
  marginTop: 4,
  color: "#64748b",
  fontSize: 11,
  lineHeight: 1.45,
};

const refreshDaysButtonStyle: CSSProperties =
  {
    border:
      "1px solid #dbeafe",
    borderRadius: 9,
    background: "#ffffff",
    color: "#1769e8",
    padding: "8px 11px",
    fontSize: 10,
    fontWeight: 850,
    cursor: "pointer",
  };

const daysGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit,minmax(145px,1fr))",
  gap: 8,
};

const dayOptionStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  minHeight: 56,
  borderRadius: 11,
  padding: "9px 10px",
  cursor: "pointer",
  boxSizing: "border-box",
  transition:
    "border .15s ease, box-shadow .15s ease",
};

const dayTextStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  minWidth: 0,
};

const legendStyle: CSSProperties = {
  marginTop: 11,
  display: "flex",
  gap: 14,
  flexWrap: "wrap",
  color: "#64748b",
  fontSize: 9,
};

const selectedSummaryStyle: CSSProperties =
  {
    marginTop: 12,
    padding: "9px 11px",
    borderRadius: 9,
    background: "#edf5ff",
    border:
      "1px solid #dbeafe",
    color: "#1769e8",
    fontSize: 10,
  };

const submitButtonStyle: CSSProperties = {
  marginTop: 17,
  border: 0,
  borderRadius: 11,
  padding: "12px 20px",
  color: "#ffffff",
  fontWeight: 850,
};
