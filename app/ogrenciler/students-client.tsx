"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

export type StudentListItem = {
  id: string;
  first_name: string;
  last_name: string;

  status?: string | null;
  swimming_level?: string | null;

  branch_id?: string | null;
  branch_name?: string | null;

  group_id?: string | null;
  group_name?: string | null;

  course_type?: string | null;

  package_name?: string | null;
  package_lesson_count?: number | null;

  compensation_lessons?: number | null;
  used_lessons?: number | null;
  remaining_lessons?: number | null;

  start_date?: string | null;
  end_date?: string | null;

  phone?: string | null;
  guardian_phone?: string | null;

  created_at?: string | null;
};

type Props = {
  students: StudentListItem[];
};

type StatusFilter =
  | "all"
  | "active"
  | "passive"
  | "pre_registration"
  | "ending_soon";

type SortType =
  | "name_asc"
  | "name_desc"
  | "start_new"
  | "start_old"
  | "end_near"
  | "remaining_desc"
  | "remaining_asc";

const statusLabels: Record<string, string> = {
  active: "Aktif",
  passive: "Pasif",
  pre_registration: "Ön Kayıt",
  waiting_contact: "İletişim Bekliyor",
  trial_lesson: "Deneme Dersi",
  waiting_payment: "Ödeme Bekliyor",
  waiting_approval: "Onay Bekliyor",
  frozen: "Dondurulmuş",
  cancelled: "İptal",
};

function formatDate(value?: string | null) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function normalizeText(value?: string | null) {
  return (value || "").toLocaleLowerCase("tr-TR").trim();
}

function isEndingSoon(dateValue?: string | null) {
  if (!dateValue) return false;

  const end = new Date(dateValue);
  if (Number.isNaN(end.getTime())) return false;

  const today = new Date();

  today.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);

  const difference = end.getTime() - today.getTime();
  const days = Math.ceil(difference / (1000 * 60 * 60 * 24));

  return days >= 0 && days <= 7;
}

function numberValue(value?: number | null) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export default function StudentsClient({ students }: Props) {
  const router = useRouter();

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [branch, setBranch] = useState("all");
  const [group, setGroup] = useState("all");
  const [level, setLevel] = useState("all");
  const [sort, setSort] = useState<SortType>("name_asc");

  const branches = useMemo(() => {
    return Array.from(
      new Set(
        students
          .map((student) => student.branch_name)
          .filter((value): value is string => Boolean(value))
      )
    ).sort((a, b) => a.localeCompare(b, "tr"));
  }, [students]);

  const groups = useMemo(() => {
    return Array.from(
      new Set(
        students
          .filter(
            (student) =>
              branch === "all" || student.branch_name === branch
          )
          .map((student) => student.group_name)
          .filter((value): value is string => Boolean(value))
      )
    ).sort((a, b) => a.localeCompare(b, "tr"));
  }, [students, branch]);

  const levels = useMemo(() => {
    return Array.from(
      new Set(
        students
          .map((student) => student.swimming_level)
          .filter((value): value is string => Boolean(value))
      )
    ).sort((a, b) => a.localeCompare(b, "tr"));
  }, [students]);

  const counts = useMemo(() => {
    return {
      total: students.length,
      active: students.filter((student) => student.status === "active").length,
      passive: students.filter((student) => student.status === "passive").length,
      preRegistration: students.filter(
        (student) => student.status === "pre_registration"
      ).length,
      endingSoon: students.filter(
        (student) =>
          student.status === "active" && isEndingSoon(student.end_date)
      ).length,
    };
  }, [students]);

  const filteredStudents = useMemo(() => {
    const query = normalizeText(search);

    const result = students.filter((student) => {
      const fullName = `${student.first_name || ""} ${
        student.last_name || ""
      }`.trim();

      const searchMatch =
        !query ||
        normalizeText(fullName).includes(query) ||
        normalizeText(student.branch_name).includes(query) ||
        normalizeText(student.group_name).includes(query) ||
        normalizeText(student.phone).includes(query) ||
        normalizeText(student.guardian_phone).includes(query);

      const branchMatch =
        branch === "all" || student.branch_name === branch;

      const groupMatch =
        group === "all" || student.group_name === group;

      const levelMatch =
        level === "all" || student.swimming_level === level;

      let statusMatch = true;

      if (status === "active") {
        statusMatch = student.status === "active";
      }

      if (status === "passive") {
        statusMatch = student.status === "passive";
      }

      if (status === "pre_registration") {
        statusMatch = student.status === "pre_registration";
      }

      if (status === "ending_soon") {
        statusMatch =
          student.status === "active" && isEndingSoon(student.end_date);
      }

      return (
        searchMatch &&
        branchMatch &&
        groupMatch &&
        levelMatch &&
        statusMatch
      );
    });

    return [...result].sort((a, b) => {
      const nameA = `${a.first_name} ${a.last_name}`;
      const nameB = `${b.first_name} ${b.last_name}`;

      if (sort === "name_asc") {
        return nameA.localeCompare(nameB, "tr");
      }

      if (sort === "name_desc") {
        return nameB.localeCompare(nameA, "tr");
      }

      if (sort === "start_new") {
        return (
          new Date(b.start_date || 0).getTime() -
          new Date(a.start_date || 0).getTime()
        );
      }

      if (sort === "start_old") {
        return (
          new Date(a.start_date || 0).getTime() -
          new Date(b.start_date || 0).getTime()
        );
      }

      if (sort === "end_near") {
        const timeA = a.end_date
          ? new Date(a.end_date).getTime()
          : Number.MAX_SAFE_INTEGER;

        const timeB = b.end_date
          ? new Date(b.end_date).getTime()
          : Number.MAX_SAFE_INTEGER;

        return timeA - timeB;
      }

      if (sort === "remaining_desc") {
        return (
          numberValue(b.remaining_lessons) -
          numberValue(a.remaining_lessons)
        );
      }

      if (sort === "remaining_asc") {
        return (
          numberValue(a.remaining_lessons) -
          numberValue(b.remaining_lessons)
        );
      }

      return 0;
    });
  }, [students, search, status, branch, group, level, sort]);

  function exportCSV() {
    const headers = [
      "Öğrenci",
      "Durum",
      "Şube",
      "Grup",
      "Seviye",
      "Paket",
      "Normal Ders",
      "Telafi",
      "Toplam Hak",
      "Kullanılan",
      "Kalan",
      "Başlangıç",
      "Bitiş",
      "Telefon",
    ];

    const rows = filteredStudents.map((student) => {
      const normalLessons = numberValue(student.package_lesson_count);
      const compensation = numberValue(student.compensation_lessons);
      const totalRights = normalLessons + compensation;

      return [
        `${student.first_name} ${student.last_name}`,
        statusLabels[student.status || ""] || student.status || "",
        student.branch_name || "",
        student.group_name || "",
        student.swimming_level || "",
        student.package_name || "",
        normalLessons,
        compensation,
        totalRights,
        numberValue(student.used_lessons),
        numberValue(student.remaining_lessons),
        formatDate(student.start_date),
        formatDate(student.end_date),
        student.phone || student.guardian_phone || "",
      ];
    });

    const csv = [headers, ...rows]
      .map((row) =>
        row
          .map((cell) => `"${String(cell).replaceAll('"', '""')}"`)
          .join(";")
      )
      .join("\n");

    const blob = new Blob(["\uFEFF" + csv], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    anchor.href = url;
    anchor.download = `SprintOS-Ogrenciler-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;

    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();

    URL.revokeObjectURL(url);
  }

  return (
    <div className="studentCenter">
      <section className="summaryGrid">
        <button
          className={`summaryCard ${status === "all" ? "selected" : ""}`}
          onClick={() => setStatus("all")}
        >
          <span>Toplam Öğrenci</span>
          <strong>{counts.total}</strong>
        </button>

        <button
          className={`summaryCard ${status === "active" ? "selected" : ""}`}
          onClick={() => setStatus("active")}
        >
          <span>Aktif Öğrenci</span>
          <strong>{counts.active}</strong>
        </button>

        <button
          className={`summaryCard ${
            status === "pre_registration" ? "selected" : ""
          }`}
          onClick={() => setStatus("pre_registration")}
        >
          <span>Ön Kayıt</span>
          <strong>{counts.preRegistration}</strong>
        </button>

        <button
          className={`summaryCard ${status === "passive" ? "selected" : ""}`}
          onClick={() => setStatus("passive")}
        >
          <span>Pasif</span>
          <strong>{counts.passive}</strong>
        </button>

        <button
          className={`summaryCard ${
            status === "ending_soon" ? "selected" : ""
          }`}
          onClick={() => setStatus("ending_soon")}
        >
          <span>Bitişi Yaklaşan</span>
          <strong>{counts.endingSoon}</strong>
        </button>
      </section>

      <section className="toolbar">
        <div className="searchBox">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Öğrenci, telefon, şube veya grup ara..."
          />
        </div>

        <select
          value={branch}
          onChange={(event) => {
            setBranch(event.target.value);
            setGroup("all");
          }}
        >
          <option value="all">Tüm Şubeler</option>

          {branches.map((branchName) => (
            <option key={branchName} value={branchName}>
              {branchName}
            </option>
          ))}
        </select>

        <select
          value={group}
          onChange={(event) => setGroup(event.target.value)}
        >
          <option value="all">Tüm Gruplar</option>

          {groups.map((groupName) => (
            <option key={groupName} value={groupName}>
              {groupName}
            </option>
          ))}
        </select>

        <select
          value={level}
          onChange={(event) => setLevel(event.target.value)}
        >
          <option value="all">Tüm Seviyeler</option>

          {levels.map((levelName) => (
            <option key={levelName} value={levelName}>
              {levelName}
            </option>
          ))}
        </select>

        <select
          value={sort}
          onChange={(event) => setSort(event.target.value as SortType)}
        >
          <option value="name_asc">Ad Soyad A-Z</option>
          <option value="name_desc">Ad Soyad Z-A</option>
          <option value="start_new">Yeni Başlayanlar</option>
          <option value="start_old">Eski Başlayanlar</option>
          <option value="end_near">Bitiş Tarihi Yakın</option>
          <option value="remaining_desc">Kalan Ders Çoktan Aza</option>
          <option value="remaining_asc">Kalan Ders Azdan Çoğa</option>
        </select>

        <button className="exportButton" onClick={exportCSV}>
          Excel&apos;e Aktar
        </button>
      </section>

      <div className="resultInfo">
        <strong>{filteredStudents.length}</strong> öğrenci gösteriliyor
      </div>

      <section className="studentGrid">
        {filteredStudents.map((student) => {
          const normalLessons = numberValue(student.package_lesson_count);
          const compensation = numberValue(student.compensation_lessons);
          const used = numberValue(student.used_lessons);

          const totalRights = normalLessons + compensation;

          const remaining =
            student.remaining_lessons != null
              ? numberValue(student.remaining_lessons)
              : Math.max(totalRights - used, 0);

          return (
            <article
              key={student.id}
              className="studentCard"
              role="button"
              tabIndex={0}
              onClick={() => router.push(`/ogrenciler/${student.id}`)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  router.push(`/ogrenciler/${student.id}`);
                }
              }}
            >
              <header className="cardHeader">
                <div>
                  <span className="eyebrow">ÖĞRENCİ</span>

                  <h3>
                    {student.first_name} {student.last_name}
                  </h3>
                </div>

                <span
                  className={`statusBadge ${
                    student.status === "active"
                      ? "green"
                      : student.status === "passive"
                      ? "red"
                      : "orange"
                  }`}
                >
                  {statusLabels[student.status || ""] ||
                    student.status ||
                    "Durum Yok"}
                </span>
              </header>

              <div className="mainDetails">
                <div>
                  <span>Şube</span>
                  <strong>{student.branch_name || "—"}</strong>
                </div>

                <div>
                  <span>Grup</span>
                  <strong>{student.group_name || "—"}</strong>
                </div>

                <div>
                  <span>Seviye</span>
                  <strong>{student.swimming_level || "—"}</strong>
                </div>

                <div>
                  <span>Paket</span>
                  <strong>
                    {student.package_name ||
                      (normalLessons > 0
                        ? `${normalLessons} Ders`
                        : "—")}
                  </strong>
                </div>
              </div>

              <div className="lessonStrip">
                <div>
                  <span>Normal</span>
                  <strong>{normalLessons}</strong>
                </div>

                <div className="compensation">
                  <span>Telafi</span>
                  <strong>+{compensation}</strong>
                </div>

                <div>
                  <span>Toplam Hak</span>
                  <strong>{totalRights}</strong>
                </div>

                <div>
                  <span>Kullanılan</span>
                  <strong>{used}</strong>
                </div>

                <div className="remaining">
                  <span>Kalan</span>
                  <strong>{remaining}</strong>
                </div>
              </div>

              <div className="dateRow">
                <div>
                  <span>Başlangıç</span>
                  <strong>{formatDate(student.start_date)}</strong>
                </div>

                <div>
                  <span>Bitiş</span>
                  <strong>{formatDate(student.end_date)}</strong>
                </div>
              </div>

              <footer className="cardFooter">
                <span>
                  {student.phone ||
                    student.guardian_phone ||
                    "Telefon bilgisi yok"}
                </span>

                <strong>Öğrenci Dosyasını Aç →</strong>
              </footer>
            </article>
          );
        })}

        {filteredStudents.length === 0 && (
          <div className="emptyState">
            Seçtiğiniz filtrelere uygun öğrenci bulunamadı.
          </div>
        )}
      </section>

      <style jsx>{`
        .studentCenter {
          width: 100%;
        }

        .summaryGrid {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 12px;
          margin-bottom: 18px;
        }

        .summaryCard {
          appearance: none;
          border: 1px solid #dbe4f0;
          background: #ffffff;
          border-radius: 16px;
          padding: 16px;
          text-align: left;
          cursor: pointer;
          transition: 0.2s ease;
        }

        .summaryCard:hover,
        .summaryCard.selected {
          border-color: #1671e8;
          box-shadow: 0 8px 24px rgba(22, 113, 232, 0.12);
          transform: translateY(-1px);
        }

        .summaryCard span {
          display: block;
          font-size: 12px;
          color: #64748b;
          margin-bottom: 8px;
        }

        .summaryCard strong {
          display: block;
          font-size: 26px;
          color: #10233f;
        }

        .toolbar {
          display: grid;
          grid-template-columns:
            minmax(220px, 1.5fr)
            repeat(4, minmax(135px, 1fr))
            auto;
          gap: 10px;
          margin-bottom: 14px;
        }

        .toolbar input,
        .toolbar select {
          width: 100%;
          min-height: 44px;
          border: 1px solid #d8e1ed;
          border-radius: 12px;
          background: #ffffff;
          padding: 0 12px;
          color: #16233d;
          outline: none;
        }

        .toolbar input:focus,
        .toolbar select:focus {
          border-color: #1671e8;
          box-shadow: 0 0 0 3px rgba(22, 113, 232, 0.1);
        }

        .exportButton {
          border: 0;
          border-radius: 12px;
          padding: 0 18px;
          min-height: 44px;
          background: #1671e8;
          color: #ffffff;
          font-weight: 700;
          cursor: pointer;
          white-space: nowrap;
        }

        .resultInfo {
          color: #64748b;
          font-size: 13px;
          margin-bottom: 12px;
        }

        .studentGrid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
        }

        .studentCard {
          background: #ffffff;
          border: 1px solid #dfe7f1;
          border-radius: 18px;
          padding: 18px;
          cursor: pointer;
          transition: 0.2s ease;
          outline: none;
        }

        .studentCard:hover,
        .studentCard:focus {
          border-color: #1671e8;
          box-shadow: 0 12px 30px rgba(16, 35, 63, 0.1);
          transform: translateY(-2px);
        }

        .cardHeader {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 14px;
          margin-bottom: 16px;
        }

        .eyebrow {
          display: block;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.12em;
          color: #1671e8;
          margin-bottom: 5px;
        }

        .cardHeader h3 {
          margin: 0;
          color: #10233f;
          font-size: 19px;
        }

        .statusBadge {
          border-radius: 999px;
          padding: 7px 10px;
          font-size: 11px;
          font-weight: 800;
          white-space: nowrap;
        }

        .statusBadge.green {
          color: #087443;
          background: #e7f8ef;
        }

        .statusBadge.red {
          color: #b42318;
          background: #feeceb;
        }

        .statusBadge.orange {
          color: #9a5b00;
          background: #fff4dc;
        }

        .mainDetails {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
          margin-bottom: 14px;
        }

        .mainDetails div,
        .dateRow div {
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 10px 12px;
        }

        .mainDetails span,
        .dateRow span,
        .lessonStrip span {
          display: block;
          color: #7a889d;
          font-size: 10px;
          margin-bottom: 4px;
        }

        .mainDetails strong,
        .dateRow strong {
          color: #17233c;
          font-size: 13px;
        }

        .lessonStrip {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 8px;
          background: #f7f9fc;
          padding: 10px;
          border-radius: 14px;
          margin-bottom: 14px;
        }

        .lessonStrip div {
          text-align: center;
          border-right: 1px solid #e3e8f0;
        }

        .lessonStrip div:last-child {
          border-right: 0;
        }

        .lessonStrip strong {
          font-size: 16px;
          color: #10233f;
        }

        .lessonStrip .compensation strong {
          color: #1671e8;
        }

        .lessonStrip .remaining strong {
          color: #087443;
        }

        .dateRow {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
        }

        .cardFooter {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-top: 14px;
          padding-top: 14px;
          border-top: 1px solid #edf0f4;
          font-size: 12px;
          color: #64748b;
        }

        .cardFooter strong {
          color: #1671e8;
        }

        .emptyState {
          grid-column: 1 / -1;
          border: 1px dashed #cfd9e6;
          border-radius: 16px;
          padding: 40px 20px;
          text-align: center;
          color: #64748b;
        }

        @media (max-width: 1050px) {
          .summaryGrid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }

          .toolbar {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 760px) {
          .summaryGrid {
            display: flex;
            overflow-x: auto;
            padding-bottom: 5px;
          }

          .summaryCard {
            min-width: 145px;
          }

          .toolbar {
            grid-template-columns: 1fr 1fr;
          }

          .searchBox,
          .exportButton {
            grid-column: 1 / -1;
          }

          .studentGrid {
            grid-template-columns: 1fr;
          }

          .studentCard {
            padding: 14px;
            border-radius: 16px;
          }

          .lessonStrip {
            grid-template-columns: repeat(5, minmax(58px, 1fr));
            overflow-x: auto;
          }

          .cardFooter {
            align-items: flex-start;
            flex-direction: column;
          }
        }

        @media (max-width: 480px) {
          .toolbar {
            grid-template-columns: 1fr;
          }

          .toolbar > * {
            grid-column: 1;
          }

          .mainDetails {
            grid-template-columns: 1fr 1fr;
          }

          .dateRow {
            grid-template-columns: 1fr 1fr;
          }

          .cardHeader h3 {
            font-size: 17px;
          }
        }
      `}</style>
    </div>
  );
}
