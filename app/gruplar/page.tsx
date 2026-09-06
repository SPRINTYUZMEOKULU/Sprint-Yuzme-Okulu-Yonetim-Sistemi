import Link from "next/link";

import { requireProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";

import {
  createGroup,
  deleteGroup,
  toggleGroup,
} from "./actions";

import GroupActionButton from "./group-action-button";
import GroupEditor from "./group-editor";

import "./groups.css";
import "./groups-integrated.css";

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
  id: string;
  branch_id: string | null;
  group_id: string;
  coach_id: string | null;
  weekday: number;
  start_time: string;
  end_time: string;
  is_active: boolean;
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

type MembershipItem = {
  group_id: string;
  student_id: string;
  level_id: string | null;
};

type StudentItem = {
  id: string;
  first_name: string;
  last_name: string;
  swimming_level: string | null;
  preferred_group_id: string | null;
  status: string | null;
};

type StudentAssignmentItem = {
  schedule_id: string;
  group_id: string | null;
  student_id: string;
  coach_id: string | null;
};

type StaffAssignmentItem = {
  schedule_id: string;
  group_id: string | null;
  coach_id: string;
};

type SessionItem = {
  key: string;
  branchName: string;
  schedules: ScheduleItem[];
  groups: GroupItem[];
};

type RosterStudent = {
  id: string;
  name: string;
  level: string;
};

type CoachBucket = {
  key: string;
  coachId: string | null;
  name: string;
  weekdays: Set<number>;
  students: Map<string, RosterStudent>;
};

function cleanTime(value?: string | null) {
  return value ? String(value).slice(0, 5) : "—";
}

function getScheduleSignature(schedules: ScheduleItem[]) {
  return [...schedules]
    .sort((a, b) => {
      if (a.weekday !== b.weekday) {
        return a.weekday - b.weekday;
      }

      return String(a.start_time).localeCompare(String(b.start_time));
    })
    .map(
      (schedule) =>
        `${schedule.weekday}-${cleanTime(schedule.start_time)}-${cleanTime(
          schedule.end_time
        )}`
    )
    .join("|");
}

function courseTypeLabel(courseType: string) {
  if (courseType === "Çocuk Yüzme Kursu") {
    return "Çocuk Grubu";
  }

  if (courseType === "Yetişkin Yüzme Kursu") {
    return "Yetişkin Grubu";
  }

  if (courseType === "Özel Ders") {
    return "Özel Ders";
  }

  if (courseType === "Takım / Performans") {
    return "Takım / Performans";
  }

  return courseType;
}

function studentName(student?: StudentItem) {
  if (!student) {
    return "Öğrenci kaydı bulunamadı";
  }

  return `${student.first_name || ""} ${student.last_name || ""}`.trim();
}

function uniqueMemberships(items: MembershipItem[]) {
  const map = new Map<string, MembershipItem>();

  for (const item of items) {
    if (!map.has(item.student_id)) {
      map.set(item.student_id, item);
    }
  }

  return Array.from(map.values());
}

export default async function GroupsPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    success?: string;
  }>;
}) {
  const pageMessages = await searchParams;

  const profile = await requireProfile([
    "owner",
    "admin",
    "branch_manager",
  ]);

  const organizationId = profile.organization_id || "";
  const supabase = await createClient();

  const [
    branchesResult,
    levelsResult,
    groupsResult,
    schedulesResult,
    coachesResult,
    membershipsResult,
    studentsResult,
    staffAssignmentsResult,
    studentAssignmentsResult,
  ] = await Promise.all([
    supabase
      .from("branches")
      .select("id,name")
      .eq("organization_id", organizationId)
      .eq("is_active", true)
      .order("name"),

    supabase
      .from("swimming_levels")
      .select("id,name")
      .eq("organization_id", organizationId)
      .eq("is_active", true)
      .order("sort_order"),

    supabase
      .from("training_groups")
      .select(
        "id,branch_id,level_id,name,capacity,course_type,description,is_active,public_registration,primary_coach_id"
      )
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false }),

    supabase
      .from("lesson_schedules")
      .select(
        "id,branch_id,group_id,coach_id,weekday,start_time,end_time,is_active"
      )
      .eq("organization_id", organizationId)
      .order("weekday")
      .order("start_time"),

    supabase
      .from("profiles")
      .select("id,full_name")
      .eq("organization_id", organizationId)
      .eq("role", "coach")
      .eq("is_active", true)
      .order("full_name"),

    supabase
      .from("student_group_memberships")
      .select("group_id,student_id,level_id")
      .eq("organization_id", organizationId)
      .eq("is_active", true),

    supabase
      .from("students")
      .select(
        "id,first_name,last_name,swimming_level,preferred_group_id,status"
      )
      .eq("organization_id", organizationId)
      .eq("is_deleted", false)
      .order("first_name"),

    supabase
      .from("lesson_staff_assignments")
      .select("schedule_id,group_id,coach_id")
      .eq("organization_id", organizationId)
      .eq("is_active", true),

    supabase
      .from("lesson_student_assignments")
      .select("schedule_id,group_id,student_id,coach_id")
      .eq("organization_id", organizationId)
      .eq("is_active", true),
  ]);

  const queryError =
    branchesResult.error ||
    levelsResult.error ||
    groupsResult.error ||
    schedulesResult.error ||
    coachesResult.error ||
    membershipsResult.error ||
    studentsResult.error;

  const branches = branchesResult.data || [];
  const levels = levelsResult.data || [];
  const groups = (groupsResult.data || []) as GroupItem[];
  const schedules = (schedulesResult.data || []) as ScheduleItem[];
  const coaches = coachesResult.data || [];
  const memberships = (membershipsResult.data || []) as MembershipItem[];
  const students = (studentsResult.data || []) as StudentItem[];
  const staffAssignments =
    (staffAssignmentsResult.data || []) as StaffAssignmentItem[];
  const studentAssignments =
    (studentAssignmentsResult.data || []) as StudentAssignmentItem[];

  const branchMap = new Map(
    branches.map((branch) => [branch.id, branch.name])
  );

  const levelMap = new Map(
    levels.map((level) => [level.id, level.name])
  );

  const coachMap = new Map(
    coaches.map((coach) => [
      coach.id,
      coach.full_name || "İsimsiz eğitmen",
    ])
  );

  const studentMap = new Map(
    students.map((student) => [student.id, student])
  );

  const scheduleById = new Map(
    schedules.map((schedule) => [schedule.id, schedule])
  );

  const scheduleMap = new Map<string, ScheduleItem[]>();

  for (const schedule of schedules) {
    const current = scheduleMap.get(schedule.group_id) || [];
    current.push(schedule);
    scheduleMap.set(schedule.group_id, current);
  }

  const membershipsMap = new Map<string, MembershipItem[]>();

  for (const membership of memberships) {
    const current = membershipsMap.get(membership.group_id) || [];
    current.push(membership);
    membershipsMap.set(membership.group_id, current);
  }

  const preRegistrationCountMap = new Map<string, number>();

  for (const student of students) {
    if (
      student.status === "pre_registration" &&
      student.preferred_group_id
    ) {
      preRegistrationCountMap.set(
        student.preferred_group_id,
        (preRegistrationCountMap.get(student.preferred_group_id) || 0) + 1
      );
    }
  }

  function createSessions(selectedGroups: GroupItem[]) {
    const sessionMap = new Map<string, SessionItem>();

    for (const group of selectedGroups) {
      const groupSchedules = scheduleMap.get(group.id) || [];
      const signature = getScheduleSignature(groupSchedules);
      const sessionKey = [
        group.branch_id,
        signature || group.id,
      ].join("::");

      const current = sessionMap.get(sessionKey);

      if (current) {
        current.groups.push(group);
        continue;
      }

      sessionMap.set(sessionKey, {
        key: sessionKey,
        branchName: branchMap.get(group.branch_id) || "Şube",
        schedules: groupSchedules,
        groups: [group],
      });
    }

    return Array.from(sessionMap.values()).sort((a, b) => {
      const aTime = a.schedules[0]?.start_time || "99:99";
      const bTime = b.schedules[0]?.start_time || "99:99";
      return aTime.localeCompare(bTime);
    });
  }

  function buildCoachBuckets(group: GroupItem) {
    const groupSchedules = scheduleMap.get(group.id) || [];
    const scheduleIds = new Set(groupSchedules.map((item) => item.id));
    const sessionWeekdays = new Set(
      groupSchedules.map((item) => item.weekday)
    );

    const members = uniqueMemberships(
      membershipsMap.get(group.id) || []
    );

    const groupStudentAssignments = studentAssignments.filter(
      (item) =>
        scheduleIds.has(item.schedule_id) &&
        (!item.group_id || item.group_id === group.id)
    );

    const groupStaffAssignments = staffAssignments.filter(
      (item) =>
        scheduleIds.has(item.schedule_id) &&
        (!item.group_id || item.group_id === group.id)
    );

    const explicitCoachMap = new Map<string, Set<string>>();

    for (const assignment of groupStudentAssignments) {
      if (!assignment.coach_id) {
        continue;
      }

      const current =
        explicitCoachMap.get(assignment.student_id) || new Set<string>();
      current.add(assignment.coach_id);
      explicitCoachMap.set(assignment.student_id, current);
    }

    const staffCoachIds = Array.from(
      new Set(groupStaffAssignments.map((item) => item.coach_id))
    );

    const fallbackCoachId =
      group.primary_coach_id ||
      (staffCoachIds.length === 1 ? staffCoachIds[0] : null);

    const buckets = new Map<string, CoachBucket>();

    function ensureBucket(coachId: string | null) {
      const key = coachId || "__unassigned";
      const existing = buckets.get(key);

      if (existing) {
        return existing;
      }

      const bucket: CoachBucket = {
        key,
        coachId,
        name: coachId
          ? coachMap.get(coachId) || "Eğitmen kaydı bulunamadı"
          : "Eğitmen atanmamış öğrenciler",
        weekdays: new Set<number>(),
        students: new Map<string, RosterStudent>(),
      };

      buckets.set(key, bucket);
      return bucket;
    }

    for (const assignment of groupStaffAssignments) {
      const bucket = ensureBucket(assignment.coach_id);
      const schedule = scheduleById.get(assignment.schedule_id);

      if (schedule) {
        bucket.weekdays.add(schedule.weekday);
      }
    }

    if (group.primary_coach_id) {
      const bucket = ensureBucket(group.primary_coach_id);

      if (!bucket.weekdays.size) {
        for (const weekday of sessionWeekdays) {
          bucket.weekdays.add(weekday);
        }
      }
    }

    for (const membership of members) {
      const student = studentMap.get(membership.student_id);
      const explicitCoachIds = explicitCoachMap.get(membership.student_id);
      const targetCoachIds = explicitCoachIds?.size
        ? Array.from(explicitCoachIds)
        : [fallbackCoachId];

      const level =
        (membership.level_id
          ? levelMap.get(membership.level_id)
          : null) ||
        student?.swimming_level ||
        (group.level_id ? levelMap.get(group.level_id) : null) ||
        "Seviye belirtilmedi";

      for (const coachId of targetCoachIds) {
        const bucket = ensureBucket(coachId || null);

        bucket.students.set(membership.student_id, {
          id: membership.student_id,
          name: studentName(student),
          level,
        });

        const matchingAssignments = groupStudentAssignments.filter(
          (item) =>
            item.student_id === membership.student_id &&
            item.coach_id === coachId
        );

        if (matchingAssignments.length) {
          for (const assignment of matchingAssignments) {
            const schedule = scheduleById.get(assignment.schedule_id);

            if (schedule) {
              bucket.weekdays.add(schedule.weekday);
            }
          }
        } else if (!bucket.weekdays.size) {
          for (const weekday of sessionWeekdays) {
            bucket.weekdays.add(weekday);
          }
        }
      }
    }

    return Array.from(buckets.values()).sort((a, b) => {
      if (!a.coachId && b.coachId) return 1;
      if (a.coachId && !b.coachId) return -1;
      return a.name.localeCompare(b.name, "tr");
    });
  }

  function renderSession(session: SessionItem, archived = false) {
    const firstSchedule = session.schedules[0];
    const sessionDays = Array.from(
      new Set(session.schedules.map((item) => item.weekday))
    )
      .sort((a, b) => a - b)
      .map((weekday) => dayNames[weekday] || "")
      .filter(Boolean);

    const sessionStudentIds = new Set<string>();
    let sessionPreRegistrationCount = 0;
    const sessionCoachIds = new Set<string>();

    for (const group of session.groups) {
      for (const membership of uniqueMemberships(
        membershipsMap.get(group.id) || []
      )) {
        sessionStudentIds.add(membership.student_id);
      }

      sessionPreRegistrationCount +=
        preRegistrationCountMap.get(group.id) || 0;

      for (const bucket of buildCoachBuckets(group)) {
        if (bucket.coachId) {
          sessionCoachIds.add(bucket.coachId);
        }
      }
    }

    return (
      <article
        className={
          archived
            ? "sessionCard integratedSession archivedSession"
            : "sessionCard integratedSession"
        }
        key={session.key}
      >
        <div className="sessionHeader integratedSessionHeader">
          <div>
            <span className="sessionLabel">
              {archived ? "PASİF SEANS" : "AKTİF SEANS"}
            </span>

            <h3>{session.branchName}</h3>

            <p className="sessionPrimaryLine">
              {sessionDays.length
                ? sessionDays.join(" • ")
                : "Gün tanımlanmamış"}
              {" · "}
              {firstSchedule
                ? `${cleanTime(firstSchedule.start_time)}–${cleanTime(
                    firstSchedule.end_time
                  )}`
                : "Saat tanımlanmamış"}
            </p>
          </div>

          <div className="sessionSummaryBadges">
            <span>
              <strong>{session.groups.length}</strong>
              eğitim grubu
            </span>
            <span>
              <strong>{sessionCoachIds.size}</strong>
              eğitmen
            </span>
            <span>
              <strong>{sessionStudentIds.size}</strong>
              öğrenci
            </span>
            <span className="preBadge">
              <strong>{sessionPreRegistrationCount}</strong>
              ön kayıt
            </span>
          </div>
        </div>

        <div className="sessionGroups integratedSessionGroups">
          {session.groups.map((group) => {
            const groupMemberships = uniqueMemberships(
              membershipsMap.get(group.id) || []
            );
            const studentCount = groupMemberships.length;
            const preRegistrationCount =
              preRegistrationCountMap.get(group.id) || 0;
            const groupLevel = group.level_id
              ? levelMap.get(group.level_id) || "Belirtilmedi"
              : "Tüm seviyeler";
            const coachBuckets = buildCoachBuckets(group);
            const remaining = Math.max(group.capacity - studentCount, 0);

            return (
              <section
                className={
                  archived
                    ? "sessionGroup integratedGroup passive"
                    : "sessionGroup integratedGroup"
                }
                key={group.id}
              >
                <div className="integratedGroupHead">
                  <div>
                    <span className="coursePill">
                      {courseTypeLabel(group.course_type)}
                    </span>

                    <h4>{groupLevel}</h4>

                    <p>
                      Bu seans içindeki eğitim grubu · eğitmen ve öğrenci
                      dağılımı Operasyon Planı ile aynıdır.
                    </p>
                  </div>

                  <div className="groupCapacityBox">
                    <strong>
                      {studentCount}/{group.capacity}
                    </strong>
                    <span>aktif öğrenci</span>
                    <small>
                      {remaining > 0 ? `${remaining} boş yer` : "Kontenjan dolu"}
                    </small>
                  </div>
                </div>

                <div className="groupMetricStrip">
                  <div>
                    <span>Aktif öğrenci</span>
                    <strong>{studentCount}</strong>
                  </div>
                  <div>
                    <span>Ön kayıt</span>
                    <strong>{preRegistrationCount}</strong>
                  </div>
                  <div>
                    <span>Eğitmen</span>
                    <strong>
                      {coachBuckets.filter((item) => item.coachId).length}
                    </strong>
                  </div>
                  <div>
                    <span>Seviye</span>
                    <strong className="textMetric">{groupLevel}</strong>
                  </div>
                </div>

                <div className="coachRosterList">
                  <div className="coachRosterTitle">
                    <strong>Eğitmen / öğrenci dağılımı</strong>
                    <span>
                      Eğitmene dokununca öğrencilerin isimleri ve seviyeleri
                      açılır.
                    </span>
                  </div>

                  {coachBuckets.length ? (
                    coachBuckets.map((bucket) => {
                      const bucketStudents = Array.from(
                        bucket.students.values()
                      ).sort((a, b) => a.name.localeCompare(b.name, "tr"));
                      const bucketDays = Array.from(bucket.weekdays)
                        .sort((a, b) => a - b)
                        .map((weekday) => dayNames[weekday] || "")
                        .filter(Boolean);

                      return (
                        <details className="coachRoster" key={bucket.key}>
                          <summary>
                            <div className="coachIdentity">
                              <span className="coachAvatar" aria-hidden="true">
                                {bucket.coachId ? "E" : "!"}
                              </span>
                              <div>
                                <strong>{bucket.name}</strong>
                                <small>
                                  {bucketDays.length
                                    ? bucketDays.join(" • ")
                                    : sessionDays.join(" • ") || "Seans günleri"}
                                  {firstSchedule
                                    ? ` · ${cleanTime(
                                        firstSchedule.start_time
                                      )}–${cleanTime(firstSchedule.end_time)}`
                                    : ""}
                                </small>
                              </div>
                            </div>

                            <span className="coachStudentCount">
                              {bucketStudents.length} öğrenci
                            </span>
                          </summary>

                          <div className="coachRosterBody">
                            {bucketStudents.length ? (
                              bucketStudents.map((student) => (
                                <Link
                                  key={student.id}
                                  href={`/ogrenciler/${student.id}`}
                                  className="rosterStudentRow"
                                >
                                  <span>{student.name}</span>
                                  <small>{student.level}</small>
                                </Link>
                              ))
                            ) : (
                              <p className="emptyRosterText">
                                Bu eğitmene henüz öğrenci dağıtılmadı.
                              </p>
                            )}
                          </div>
                        </details>
                      );
                    })
                  ) : (
                    <div className="emptyCoachState">
                      Henüz eğitmen ataması yapılmadı. Operasyon Planı üzerinden
                      eğitmen ve öğrenci dağılımı yapabilirsiniz.
                    </div>
                  )}
                </div>

                {group.description ? (
                  <p className="groupDesc">{group.description}</p>
                ) : null}

                <div className="groupPrimaryActions">
                  <Link href={`/ogrenciler?grup=${group.id}`}>
                    Öğrenciler <b>{studentCount}</b>
                  </Link>

                  <Link
                    href={`/on-kayitlar?group=${group.id}#pre-registration-center`}
                    className="preRegistrationAction"
                  >
                    Ön Kayıt <b>{preRegistrationCount}</b>
                  </Link>

                  <Link href={`/yoklama?grup=${group.id}`}>Yoklama</Link>
                </div>

                <div className="groupManagementRow">
                  <GroupEditor
                    group={group}
                    schedules={scheduleMap.get(group.id) || []}
                    branches={branches}
                    levels={levels}
                    coaches={coaches}
                  />

                  <form action={toggleGroup}>
                    <input type="hidden" name="id" value={group.id} />
                    <input
                      type="hidden"
                      name="field"
                      value="public_registration"
                    />
                    <input
                      type="hidden"
                      name="value"
                      value={String(!group.public_registration)}
                    />

                    <GroupActionButton
                      className={
                        group.public_registration ? "publicOn" : "publicOff"
                      }
                      idleText={
                        group.public_registration
                          ? "Ön kayıtta açık"
                          : "Ön kayıtta kapalı"
                      }
                      pendingText="Güncelleniyor..."
                    />
                  </form>

                  <details className="groupMoreActions">
                    <summary>Diğer işlemler</summary>
                    <div>
                      <form action={toggleGroup}>
                        <input type="hidden" name="id" value={group.id} />
                        <input type="hidden" name="field" value="is_active" />
                        <input
                          type="hidden"
                          name="value"
                          value={String(!group.is_active)}
                        />

                        <GroupActionButton
                          idleText={
                            group.is_active ? "Arşivle" : "Aktifleştir"
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

                      <form action={deleteGroup}>
                        <input type="hidden" name="id" value={group.id} />

                        <GroupActionButton
                          className="deleteGroupButton"
                          idleText="Grubu Sil"
                          pendingText="Kontrol ediliyor..."
                          confirmText={
                            studentCount > 0
                              ? `Bu grupta ${studentCount} aktif öğrenci bulunuyor. Sistem ilişkili kayıtlar varken grubu silmeyecektir. Kontrol etmek istiyor musunuz?`
                              : "Bu grubu kalıcı olarak silmek istediğinize emin misiniz?"
                          }
                        />
                      </form>
                    </div>
                  </details>
                </div>
              </section>
            );
          })}
        </div>
      </article>
    );
  }

  const activeGroups = groups.filter((group) => group.is_active);
  const passiveGroups = groups.filter((group) => !group.is_active);
  const activeSessions = createSessions(activeGroups);
  const passiveSessions = createSessions(passiveGroups);

  return (
    <main className="groupsPage integratedGroupsPage">
      <header className="groupsHeader">
        <div>
          <p>SPRİNTOS · EĞİTİM YAPISI</p>
          <h1>Seanslar ve Eğitim Grupları</h1>
          <span>
            Şube, seans, eğitim grubu, eğitmen, öğrenci ve ön kayıt bilgisini
            tek operasyon yapısında yönetin.
          </span>
        </div>

        <div>
          <Link href="/operasyon-plani">Operasyon Planı</Link>
          <Link href="/on-kayitlar">Ön Kayıt Merkezi</Link>
          <Link href="/ders-programi">Ders Programı</Link>
          <Link href="/">Ana Sayfa</Link>
        </div>
      </header>

      {queryError ? (
        <div className="groupsSystemMessage error">
          Verilerin bir bölümü yüklenemedi: {queryError.message}
        </div>
      ) : null}

      {pageMessages.error ? (
        <div className="groupsSystemMessage error">{pageMessages.error}</div>
      ) : null}

      {pageMessages.success ? (
        <div className="groupsSystemMessage success">
          {pageMessages.success}
        </div>
      ) : null}

      <section className="groupLayout">
        <form action={createGroup} className="groupForm">
          <div className="sectionHead">
            <p>YENİ EĞİTİM YAPISI</p>
            <h2>Seans / Grup Oluştur</h2>
            <span>
              Gün ve saat seans bilgisidir. Kurs türü ve seviye ise o seansın
              eğitim grubunu oluşturur.
            </span>
          </div>

          <div className="courseTypeBox">
            <strong>Kurs türü</strong>
            <span>
              Aynı seans içinde ihtiyaç duyduğunuz eğitim gruplarını seçin.
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
                  <b>Çocuk</b>
                  <small>Çocuk yüzme grubu</small>
                </span>
              </label>

              <label>
                <input
                  type="checkbox"
                  name="course_types"
                  value="Yetişkin Yüzme Kursu"
                />
                <span>
                  <b>Yetişkin</b>
                  <small>Yetişkin yüzme grubu</small>
                </span>
              </label>

              <label>
                <input type="checkbox" name="course_types" value="Özel Ders" />
                <span>
                  <b>Özel Ders</b>
                  <small>Birebir eğitim</small>
                </span>
              </label>

              <label>
                <input
                  type="checkbox"
                  name="course_types"
                  value="Takım / Performans"
                />
                <span>
                  <b>Takım / Performans</b>
                  <small>Takım ve altyapı</small>
                </span>
              </label>
            </div>
          </div>

          <div className="formGrid">
            <label>
              Şube
              <select name="branch_id" required defaultValue="">
                <option value="" disabled>
                  Şube seçin
                </option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Seviye
              <select name="level_id" defaultValue="">
                <option value="">Tüm seviyeler</option>
                {levels.map((level) => (
                  <option key={level.id} value={level.id}>
                    {level.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Kapasite
              <input
                name="capacity"
                type="number"
                min={1}
                max={50}
                defaultValue={6}
                required
              />
            </label>

            <label>
              Başlangıç saati
              <input name="start_time" type="time" required />
            </label>

            <label>
              Bitiş saati
              <input name="end_time" type="time" required />
            </label>

            <label className="wide">
              Açıklama
              <input
                name="description"
                placeholder="İsteğe bağlı operasyon notu"
              />
            </label>
          </div>

          <fieldset className="weekdayField">
            <legend>Seans günleri</legend>
            {[1, 2, 3, 4, 5, 6, 0].map((weekday) => (
              <label key={weekday}>
                <input type="checkbox" name="weekdays" value={weekday} />
                <span>{dayNames[weekday]}</span>
              </label>
            ))}
          </fieldset>

          <label className="publishToggle">
            <input type="checkbox" name="public_registration" defaultChecked />
            <span>
              <strong>Ön kayıt formunda göster</strong>
              <small>
                Açık olduğunda bu grup aynı grup kimliğiyle online ön kayıt
                formuna otomatik gelir.
              </small>
            </span>
          </label>

          <button type="submit" className="primaryButton">
            Seansı / Eğitim Grubunu Oluştur
          </button>
        </form>

        <section className="groupListCard">
          <div className="sectionHead integratedListHead">
            <div>
              <p>CANLI OPERASYON YAPISI</p>
              <h2>Aktif Seanslar</h2>
              <span>
                Saat ve gün seans başlığında bir kez gösterilir. Altında eğitim
                grupları, eğitmenler ve öğrenciler ayrıştırılır.
              </span>
            </div>

            <div className="listStats">
              <span>
                <strong>{activeSessions.length}</strong> seans
              </span>
              <span>
                <strong>{activeGroups.length}</strong> eğitim grubu
              </span>
            </div>
          </div>

          <div className="groupCards">
            {activeSessions.length ? (
              activeSessions.map((session) => renderSession(session))
            ) : (
              <div className="emptyCoachState">Aktif seans bulunamadı.</div>
            )}
          </div>

          {passiveSessions.length ? (
            <details className="archivedSessionsBlock">
              <summary>
                Arşivlenmiş seanslar ({passiveSessions.length})
              </summary>
              <div className="groupCards">
                {passiveSessions.map((session) => renderSession(session, true))}
              </div>
            </details>
          ) : null}
        </section>
      </section>
    </main>
  );
}
