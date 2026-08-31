import Link from "next/link";

import {
  requireProfile,
} from "@/lib/auth/profile";

import {
  createClient,
} from "@/lib/supabase/server";

import {
  createGroup,
  deleteGroup,
  toggleGroup,
} from "./actions";

import GroupActionButton from "./group-action-button";
import GroupEditor from "./group-editor";

import "./groups.css";

export const dynamic = "force-dynamic";

const dayNames = [
  "Pazar",
  "Pazartesi",
  "Salı",
  "Çarşamba",
  "Perşembe",
  "Cuma",
  "Cumartesi",
];

type ScheduleItem = {
  group_id: string;
  weekday: number;
  start_time: string;
  end_time: string;
};

type GroupItem = {
  id: string;
  branch_id: string;
  level_id: string | null;
  name: string;
  capacity: number;
  course_type: string;
  description: string | null;
  is_active: boolean;
  public_registration: boolean;
  primary_coach_id: string | null;
};

type SessionItem = {
  key: string;
  branchName: string;
  schedules: ScheduleItem[];
  groups: GroupItem[];
};

function getScheduleSignature(
  schedules: ScheduleItem[]
) {
  return [...schedules]
    .sort((a, b) => {
      if (a.weekday !== b.weekday) {
        return a.weekday - b.weekday;
      }

      return String(
        a.start_time
      ).localeCompare(
        String(b.start_time)
      );
    })
    .map(
      (schedule) =>
        `${schedule.weekday}-${String(
          schedule.start_time
        ).slice(0, 5)}-${String(
          schedule.end_time
        ).slice(0, 5)}`
    )
    .join("|");
}

function courseTypeLabel(
  courseType: string
) {
  if (
    courseType === "Çocuk Yüzme Kursu"
  ) {
    return "Çocuk Grubu";
  }

  if (
    courseType === "Yetişkin Yüzme Kursu"
  ) {
    return "Yetişkin Grubu";
  }

  if (courseType === "Özel Ders") {
    return "Özel Ders";
  }

  if (
    courseType === "Takım / Performans"
  ) {
    return "Takım / Performans";
  }

  return courseType;
}

export default async function GroupsPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    success?: string;
  }>;
}) {
  const pageMessages =
    await searchParams;

  const profile =
    await requireProfile([
      "owner",
      "admin",
      "branch_manager",
    ]);

  const organizationId =
    profile.organization_id || "";

  const supabase =
    await createClient();

  const [
    branchesResult,
    levelsResult,
    groupsResult,
    schedulesResult,
    coachesResult,
    membershipsResult,
  ] = await Promise.all([
    supabase
      .from("branches")
      .select("id,name")
      .eq(
        "organization_id",
        organizationId
      )
      .eq("is_active", true)
      .order("name"),

    supabase
      .from("swimming_levels")
      .select("id,name")
      .eq(
        "organization_id",
        organizationId
      )
      .eq("is_active", true)
      .order("sort_order"),

    supabase
      .from("training_groups")
      .select(
        "id,branch_id,level_id,name,capacity,course_type,description,is_active,public_registration,primary_coach_id"
      )
      .eq(
        "organization_id",
        organizationId
      )
      .order("created_at", {
        ascending: false,
      }),

    supabase
      .from("lesson_schedules")
      .select(
        "group_id,weekday,start_time,end_time"
      )
      .eq(
        "organization_id",
        organizationId
      )
      .order("weekday")
      .order("start_time"),

    supabase
      .from("profiles")
      .select("id,full_name")
      .eq(
        "organization_id",
        organizationId
      )
      .eq("role", "coach")
      .eq("is_active", true)
      .order("full_name"),

    supabase
      .from(
        "student_group_memberships"
      )
      .select("group_id,student_id")
      .eq(
        "organization_id",
        organizationId
      )
      .eq("is_active", true),
  ]);

  const branches =
    branchesResult.data || [];

  const levels =
    levelsResult.data || [];

  const groups =
    (groupsResult.data ||
      []) as GroupItem[];

  const schedules =
    (schedulesResult.data ||
      []) as ScheduleItem[];

  const coaches =
    coachesResult.data || [];

  const memberships =
    membershipsResult.data || [];

  const branchMap = new Map(
    branches.map((branch) => [
      branch.id,
      branch.name,
    ])
  );

  const levelMap = new Map(
    levels.map((level) => [
      level.id,
      level.name,
    ])
  );

  const coachMap = new Map(
    coaches.map((coach) => [
      coach.id,
      coach.full_name ||
        "İsimsiz eğitmen",
    ])
  );

  const studentCountMap =
    new Map<string, number>();

  for (const membership of memberships) {
    studentCountMap.set(
      membership.group_id,
      (studentCountMap.get(
        membership.group_id
      ) || 0) + 1
    );
  }

  const scheduleMap = new Map<
    string,
    ScheduleItem[]
  >();

  for (const schedule of schedules) {
    const current =
      scheduleMap.get(
        schedule.group_id
      ) || [];

    current.push(schedule);

    scheduleMap.set(
      schedule.group_id,
      current
    );
  }

  function createSessions(
    selectedGroups: GroupItem[]
  ) {
    const sessionMap = new Map<
      string,
      SessionItem
    >();

    for (const group of selectedGroups) {
      const groupSchedules =
        scheduleMap.get(group.id) || [];

      const signature =
        getScheduleSignature(
          groupSchedules
        );

      const sessionKey = [
        group.branch_id,
        signature || group.id,
      ].join("::");

      const current =
        sessionMap.get(sessionKey);

      if (current) {
        current.groups.push(group);
        continue;
      }

      sessionMap.set(sessionKey, {
        key: sessionKey,
        branchName:
          branchMap.get(
            group.branch_id
          ) || "Şube",
        schedules: groupSchedules,
        groups: [group],
      });
    }

    return Array.from(
      sessionMap.values()
    );
  }

  const activeGroups = groups.filter(
    (group) => group.is_active
  );

  const passiveGroups = groups.filter(
    (group) => !group.is_active
  );

  const activeSessions =
    createSessions(activeGroups);

  const passiveSessions =
    createSessions(passiveGroups);

  function renderSession(
    session: SessionItem,
    archived = false
  ) {
    const firstSchedule =
      session.schedules[0];

    return (
      <article
        className={
          archived
            ? "sessionCard archivedSession"
            : "sessionCard"
        }
        key={session.key}
      >
        <div className="sessionHeader">
          <div>
            <span className="sessionLabel">
              {archived
                ? "PASİF SEANS"
                : "AKTİF SEANS"}
            </span>

            <h3>
              {session.branchName}
            </h3>

            <p>
              {firstSchedule
                ? `${String(
                    firstSchedule.start_time
                  ).slice(
                    0,
                    5
                  )}–${String(
                    firstSchedule.end_time
                  ).slice(0, 5)}`
                : "Saat tanımlanmamış"}
            </p>
          </div>

          <strong>
            {session.groups.length}{" "}
            eğitim grubu
          </strong>
        </div>

        <div className="scheduleTags">
          {session.schedules.map(
            (schedule, index) => (
              <span
                key={`${schedule.weekday}-${index}`}
              >
                <b>
                  {
                    dayNames[
                      schedule.weekday
                    ]
                  }
                </b>

                {String(
                  schedule.start_time
                ).slice(0, 5)}
                –
                {String(
                  schedule.end_time
                ).slice(0, 5)}
              </span>
            )
          )}
        </div>

        <div className="sessionGroups">
          {session.groups.map(
            (group) => {
              const studentCount =
                studentCountMap.get(
                  group.id
                ) || 0;

              const coachName =
                group.primary_coach_id
                  ? coachMap.get(
                      group.primary_coach_id
                    ) ||
                    "Eğitmen bulunamadı"
                  : "Henüz atanmadı";

              return (
                <section
                  className={
                    archived
                      ? "sessionGroup passive"
                      : "sessionGroup"
                  }
                  key={group.id}
                >
                  <div className="groupTop">
                    <div>
                      <span className="coursePill">
                        {courseTypeLabel(
                          group.course_type
                        )}
                      </span>

                      <h4>{group.name}</h4>

                      <p>
                        Seviye:{" "}
                        {group.level_id
                          ? levelMap.get(
                              group.level_id
                            ) ||
                            "Belirtilmedi"
                          : "Tüm seviyeler"}
                      </p>

                      <p
                        style={{
                          marginTop: 5,
                          color:
                            group.primary_coach_id
                              ? "#1769e8"
                              : "#b26a13",
                          fontWeight: 850,
                        }}
                      >
                        Eğitmen:{" "}
                        {coachName}
                      </p>
                    </div>

                    <div
                      style={{
                        display: "grid",
                        justifyItems: "end",
                        gap: 5,
                      }}
                    >
                      <strong
                        style={{
                          color: "#1769e8",
                          fontSize: 12,
                        }}
                      >
                        {studentCount}/
                        {group.capacity}{" "}
                        öğrenci
                      </strong>

                      <small
                        style={{
                          color:
                            studentCount >=
                            group.capacity
                              ? "#c52c36"
                              : "#17865b",
                          fontWeight: 850,
                        }}
                      >
                        {studentCount >=
                        group.capacity
                          ? "Kontenjan dolu"
                          : `${
                              group.capacity -
                              studentCount
                            } kişilik boş yer`}
                      </small>
                    </div>
                  </div>

                  {group.description ? (
                    <p className="groupDesc">
                      {group.description}
                    </p>
                  ) : null}

                  <div className="groupActions">
                    <GroupEditor
                      group={group}
                      schedules={
                        scheduleMap.get(
                          group.id
                        ) || []
                      }
                      branches={branches}
                      levels={levels}
                      coaches={coaches}
                    />

                    <Link
                      href={`/ogrenciler?grup=${group.id}`}
                      className="groupStudentsButton"
                    >
                      Öğrencileri Gör
                    </Link>

                    <Link
                      href={`/yoklama?grup=${group.id}`}
                      className="groupAttendanceButton"
                    >
                      Yoklamayı Aç
                    </Link>

                    <form
                      action={toggleGroup}
                    >
                      <input
                        type="hidden"
                        name="id"
                        value={group.id}
                      />

                      <input
                        type="hidden"
                        name="field"
                        value="public_registration"
                      />

                      <input
                        type="hidden"
                        name="value"
                        value={String(
                          !group.public_registration
                        )}
                      />

                      <GroupActionButton
                        className={
                          group.public_registration
                            ? "publicOn"
                            : "publicOff"
                        }
                        idleText={
                          group.public_registration
                            ? "Formda Görünüyor"
                            : "Formda Gizli"
                        }
                        pendingText="Güncelleniyor..."
                      />
                    </form>

                    <form
                      action={toggleGroup}
                    >
                      <input
                        type="hidden"
                        name="id"
                        value={group.id}
                      />

                      <input
                        type="hidden"
                        name="field"
                        value="is_active"
                      />

                      <input
                        type="hidden"
                        name="value"
                        value={String(
                          !group.is_active
                        )}
                      />

                      <GroupActionButton
                        idleText={
                          group.is_active
                            ? "Arşivle"
                            : "Aktifleştir"
                        }
                        pendingText={
                          group.is_active
                            ? "Arşivleniyor..."
                            : "Aktifleştiriliyor..."
                        }
                        confirmText={
                          group.is_active
                            ? "Bu eğitim grubunu pasife alıp arşivlemek istediğinize emin misiniz?"
                            : undefined
                        }
                      />
                    </form>

                    <form
                      action={deleteGroup}
                    >
                      <input
                        type="hidden"
                        name="id"
                        value={group.id}
                      />

                      <GroupActionButton
                        className="deleteGroupButton"
                        idleText="Grubu Sil"
                        pendingText="Kontrol ediliyor..."
                        confirmText={
                          studentCount > 0
                            ? `Bu grupta ${studentCount} aktif öğrenci bulunuyor. Sistem öğrenciler aktarılmadan grubu silmeyecektir. Kontrol etmek istiyor musunuz?`
                            : "Bu grubu kalıcı olarak silmek istediğinize emin misiniz?"
                        }
                      />
                    </form>
                  </div>
                </section>
              );
            }
          )}
        </div>
      </article>
    );
  }

  return (
    <main className="groupsPage">
      <header className="groupsHeader">
        <div>
          <p>
            SPRİNTOS · EĞİTİM YAPISI
          </p>

          <h1>
            Seanslar ve Eğitim Grupları
          </h1>

          <span>
            Seans, kurs programı,
            eğitim grubu, seviye ve
            eğitmenleri tek merkezden
            yönetin.
          </span>
        </div>

        <div>
          <Link href="/">
            Ana Sayfa
          </Link>

          <Link href="/kullanicilar-ve-yetkiler">
            Eğitmen Ekle / Yönet
          </Link>

          <Link
            href="/on-kayit"
            target="_blank"
          >
            Ön Kayıt Formunu Aç
          </Link>
        </div>
      </header>

      {pageMessages.error ? (
        <div
          role="alert"
          style={{
            maxWidth: 1440,
            margin: "0 auto 18px",
            padding: "15px 18px",
            border:
              "1px solid #f1c4c8",
            borderRadius: 14,
            background: "#fff1f2",
            color: "#b4232c",
            fontSize: 13,
            fontWeight: 800,
            lineHeight: 1.5,
          }}
        >
          ⛔ {pageMessages.error}
        </div>
      ) : null}

      {pageMessages.success ? (
        <div
          role="status"
          style={{
            maxWidth: 1440,
            margin: "0 auto 18px",
            padding: "15px 18px",
            border:
              "1px solid #bfe8d5",
            borderRadius: 14,
            background: "#effbf5",
            color: "#08764e",
            fontSize: 13,
            fontWeight: 800,
            lineHeight: 1.5,
          }}
        >
          ✅ {pageMessages.success}
        </div>
      ) : null}

      <section className="groupLayout">
        <form
          action={createGroup}
          className="groupForm"
        >
          <div className="sectionHead">
            <p>YENİ SEANS</p>

            <h2>Seans Oluştur</h2>

            <span>
              Şube, gün ve saati bir kez
              girin. Seçilen programlar
              ayrı eğitim grupları olarak
              oluşsun.
            </span>
          </div>

          <div className="courseTypeBox">
            <strong>
              Bu seansta hangi programlar
              var?
            </strong>

            <span>
              Aynı saatte bulunan
              programların tamamını seçin.
            </span>

            <div className="courseTypeChoices">
              <label>
                <input
                  type="checkbox"
                  name="course_types"
                  value="Çocuk Yüzme Kursu"
                  defaultChecked
                />

                <span>
                  <b>
                    Çocuk Yüzme Kursu
                  </b>

                  <small>
                    12 yaş ve altı
                  </small>
                </span>
              </label>

              <label>
                <input
                  type="checkbox"
                  name="course_types"
                  value="Yetişkin Yüzme Kursu"
                  defaultChecked
                />

                <span>
                  <b>
                    Yetişkin Yüzme Kursu
                  </b>

                  <small>
                    12 yaşından büyük
                  </small>
                </span>
              </label>

              <label>
                <input
                  type="checkbox"
                  name="course_types"
                  value="Özel Ders"
                />

                <span>
                  <b>Özel Ders</b>

                  <small>
                    Birebir eğitim
                  </small>
                </span>
              </label>

              <label>
                <input
                  type="checkbox"
                  name="course_types"
                  value="Takım / Performans"
                />

                <span>
                  <b>
                    Takım / Performans
                  </b>

                  <small>
                    Antrenman grubu
                  </small>
                </span>
              </label>
            </div>
          </div>

          <div className="formGrid">
            <label>
              Şube

              <select
                name="branch_id"
                required
                defaultValue=""
              >
                <option
                  value=""
                  disabled
                >
                  Şube seçin
                </option>

                {branches.map(
                  (branch) => (
                    <option
                      value={branch.id}
                      key={branch.id}
                    >
                      {branch.name}
                    </option>
                  )
                )}
              </select>
            </label>

            <label>
              Başlangıç seviyesi

              <select
                name="level_id"
                defaultValue=""
              >
                <option value="">
                  Sonra düzenle
                </option>

                {levels.map(
                  (level) => (
                    <option
                      value={level.id}
                      key={level.id}
                    >
                      {level.name}
                    </option>
                  )
                )}
              </select>
            </label>

            <label>
              Başlangıç saati

              <input
                type="time"
                name="start_time"
                required
              />
            </label>

            <label>
              Bitiş saati

              <input
                type="time"
                name="end_time"
                required
              />
            </label>

            <label>
              Her grup için kontenjan

              <input
                type="number"
                name="capacity"
                min="1"
                max="50"
                defaultValue="6"
                required
              />
            </label>

            <label className="wide">
              Açıklama

              <input
                name="description"
                placeholder="Örn. 6 kişilik VIP yüzme grubu"
              />
            </label>
          </div>

          <fieldset className="weekdayField">
            <legend>Ders günleri</legend>

            {dayNames.map(
              (day, index) => (
                <label key={day}>
                  <input
                    type="checkbox"
                    name="weekdays"
                    value={index}
                  />

                  <span>{day}</span>
                </label>
              )
            )}
          </fieldset>

          <label className="publishToggle">
            <input
              type="checkbox"
              name="public_registration"
              defaultChecked
            />

            <span>
              <strong>
                Ön kayıt formunda göster
              </strong>

              <small>
                Uygun yaş grubundaki
                kursiyerler bu seansı
                görebilir.
              </small>
            </span>
          </label>

          <GroupActionButton
            className="primaryButton"
            idleText="Seansı ve Grupları Oluştur"
            pendingText="Gruplar oluşturuluyor..."
          />
        </form>

        <section className="groupListCard">
          <div className="sectionHead">
            <p>AKTİF EĞİTİM YAPISI</p>

            <h2>Aktif Seanslar</h2>

            <span>
              {activeSessions.length} seans
              ve {activeGroups.length} aktif
              eğitim grubu bulunuyor.
            </span>
          </div>

          <div className="groupCards">
            {activeSessions.map(
              (session) =>
                renderSession(session)
            )}

            {!activeSessions.length ? (
              <div className="emptyGroups">
                <strong>
                  Henüz aktif seans yok.
                </strong>

                <span>
                  Soldaki formdan ilk
                  seansı oluşturun.
                </span>
              </div>
            ) : null}
          </div>

          {passiveGroups.length ? (
            <details
              style={{
                marginTop: 22,
                border:
                  "1px solid #dfe6f0",
                borderRadius: 16,
                background: "#f7f8fa",
              }}
            >
              <summary
                style={{
                  padding: "16px 18px",
                  cursor: "pointer",
                  color: "#65758e",
                  fontSize: 13,
                  fontWeight: 900,
                  listStyle: "none",
                }}
              >
                Arşivlenmiş/Pasif Gruplar
                ({passiveGroups.length})
              </summary>

              <div
                className="groupCards"
                style={{
                  padding: "0 14px 14px",
                  marginTop: 0,
                }}
              >
                {passiveSessions.map(
                  (session) =>
                    renderSession(
                      session,
                      true
                    )
                )}
              </div>
            </details>
          ) : null}
        </section>
      </section>
    </main>
  );
}
