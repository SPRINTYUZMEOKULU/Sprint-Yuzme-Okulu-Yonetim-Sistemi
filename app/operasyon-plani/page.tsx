import Link from "next/link";
import { revalidatePath } from "next/cache";

import { requireProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";

import { Icons } from "@/app/components/dashboard-icons";

export const dynamic = "force-dynamic";

/* =========================================================
   SABİTLER
========================================================= */

const GUNLER: Record<number, string> = {
  1: "Pazartesi",
  2: "Salı",
  3: "Çarşamba",
  4: "Perşembe",
  5: "Cuma",
  6: "Cumartesi",
  7: "Pazar",
};

type SearchParams = {
  tarih?: string;
  sube?: string;
  saat?: string;
  egitmen?: string;
  grup?: string;
  seviye?: string;
  gorunum?: string;
};

/* =========================================================
   YARDIMCI FONKSİYONLAR
========================================================= */

function bugunIstanbul() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function gunNo(tarih: string) {
  const d = new Date(`${tarih}T12:00:00+03:00`);

  const jsDay = d.getDay();

  return jsDay === 0 ? 7 : jsDay;
}

function saatGoster(value?: string | null) {
  if (!value) return "—";

  return value.slice(0, 5);
}

function adSoyad(student: any) {
  return `${student?.first_name || ""} ${student?.last_name || ""}`.trim();
}

function initials(name?: string | null) {
  const clean = (name || "Eğitmen").trim();

  const parts = clean.split(/\s+/);

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return `${parts[0][0] || ""}${parts[parts.length - 1][0] || ""}`.toUpperCase();
}

/* =========================================================
   PERSONEL ATAMA
========================================================= */

async function personelAta(formData: FormData) {
  "use server";

  const profile = await requireProfile([
    "owner",
    "admin",
    "branch_manager",
  ]);

  const organizationId = profile.organization_id;

  if (!organizationId) {
    throw new Error("Organizasyon bilgisi bulunamadı.");
  }

  const scheduleId = String(
    formData.get("schedule_id") || ""
  );

  const coachId = String(
    formData.get("coach_id") || ""
  );

  const groupId =
    String(formData.get("group_id") || "") || null;

  const branchId =
    String(formData.get("branch_id") || "") || null;

  if (!scheduleId || !coachId) {
    throw new Error(
      "Ders seansı ve eğitmen seçilmelidir."
    );
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from("lesson_staff_assignments")
    .upsert(
      {
        organization_id: organizationId,
        branch_id: branchId,
        schedule_id: scheduleId,
        group_id: groupId,
        coach_id: coachId,
        assignment_role: "coach",
        is_active: true,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "schedule_id,coach_id",
      }
    );

  if (error) {
    throw new Error(
      `Personel atanamadı: ${error.message}`
    );
  }

  revalidatePath("/operasyon-plani");
}

/* =========================================================
   PERSONELİ SEANSTAN ÇIKAR
========================================================= */

async function personelCikar(formData: FormData) {
  "use server";

  await requireProfile([
    "owner",
    "admin",
    "branch_manager",
  ]);

  const assignmentId = String(
    formData.get("assignment_id") || ""
  );

  if (!assignmentId) return;

  const supabase = await createClient();

  const { error } = await supabase
    .from("lesson_staff_assignments")
    .update({
      is_active: false,
      updated_at: new Date().toISOString(),
    })
    .eq("id", assignmentId);

  if (error) {
    throw new Error(
      `Personel çıkarılamadı: ${error.message}`
    );
  }

  revalidatePath("/operasyon-plani");
}

/* =========================================================
   GRUP ATA
========================================================= */

async function grupAta(formData: FormData) {
  "use server";

  const profile = await requireProfile([
    "owner",
    "admin",
    "branch_manager",
  ]);

  const organizationId = profile.organization_id;

  if (!organizationId) {
    throw new Error("Organizasyon bilgisi bulunamadı.");
  }

  const scheduleId = String(
    formData.get("schedule_id") || ""
  );

  const groupId = String(
    formData.get("group_id") || ""
  );

  if (!scheduleId || !groupId) {
    throw new Error("Grup seçilmelidir.");
  }

  const supabase = await createClient();

  const { data: group, error: groupError } =
    await supabase
      .from("training_groups")
      .select("id,branch_id")
      .eq("id", groupId)
      .eq("organization_id", organizationId)
      .single();

  if (groupError || !group) {
    throw new Error(
      "Seçilen grup bulunamadı."
    );
  }

  const { error } = await supabase
    .from("lesson_schedules")
    .update({
      group_id: groupId,
      branch_id: group.branch_id,
    })
    .eq("id", scheduleId)
    .eq("organization_id", organizationId);

  if (error) {
    throw new Error(
      `Grup atanamadı: ${error.message}`
    );
  }

  revalidatePath("/operasyon-plani");
}

/* =========================================================
   ÖĞRENCİ → EĞİTMEN ATAMA
========================================================= */

async function ogrenciAta(formData: FormData) {
  "use server";

  const profile = await requireProfile([
    "owner",
    "admin",
    "branch_manager",
  ]);

  const organizationId = profile.organization_id;

  if (!organizationId) {
    throw new Error("Organizasyon bilgisi bulunamadı.");
  }

  const scheduleId = String(
    formData.get("schedule_id") || ""
  );

  const studentId = String(
    formData.get("student_id") || ""
  );

  const coachId =
    String(formData.get("coach_id") || "") || null;

  const groupId =
    String(formData.get("group_id") || "") || null;

  const branchId =
    String(formData.get("branch_id") || "") || null;

  if (!scheduleId || !studentId) {
    throw new Error(
      "Seans ve öğrenci bilgisi eksik."
    );
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from("lesson_student_assignments")
    .upsert(
      {
        organization_id: organizationId,
        branch_id: branchId,
        schedule_id: scheduleId,
        group_id: groupId,
        student_id: studentId,
        coach_id: coachId,
        assignment_type: "session",
        is_active: true,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "schedule_id,student_id",
      }
    );

  if (error) {
    throw new Error(
      `Öğrenci atanamadı: ${error.message}`
    );
  }

  revalidatePath("/operasyon-plani");
}

/* =========================================================
   ANA SAYFA
========================================================= */

export default async function OperasyonPlaniPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const profile = await requireProfile([
    "owner",
    "admin",
    "branch_manager",
    "registration_staff",
    "accounting",
    "coach",
  ]);

  const organizationId =
    profile.organization_id;

  if (!organizationId) {
    return (
      <main style={pageStyle}>
        <div style={containerStyle}>
          <h1>Operasyon Planı</h1>

          <div style={errorStyle}>
            Kullanıcının organizasyon bilgisi bulunamadı.
          </div>
        </div>
      </main>
    );
  }

  const params =
    (await searchParams) || {};

  const selectedDate =
    params.tarih || bugunIstanbul();

  const selectedWeekday =
    gunNo(selectedDate);

  const supabase = await createClient();

  /* =======================================================
     GERÇEK VERİLER
  ======================================================= */

  const [
    branchesResult,
    groupsResult,
    schedulesResult,
    coachesResult,
    studentsResult,
    membershipsResult,
    staffAssignmentsResult,
    studentAssignmentsResult,
  ] = await Promise.all([
    supabase
      .from("branches")
      .select(
        "id,organization_id,name,short_name,is_active"
      )
      .eq("organization_id", organizationId)
      .eq("is_active", true)
      .order("name"),

    supabase
      .from("training_groups")
      .select(
        "id,organization_id,branch_id,level_id,name,course_type,capacity,primary_coach_id,is_active"
      )
      .eq("organization_id", organizationId)
      .eq("is_active", true)
      .order("name"),

    supabase
      .from("lesson_schedules")
      .select(
        "id,organization_id,branch_id,group_id,coach_id,weekday,start_time,end_time,is_active"
      )
      .eq("organization_id", organizationId)
      .eq("is_active", true)
      .eq("weekday", selectedWeekday)
      .order("start_time"),

    supabase
      .from("profiles")
      .select(
        "id,organization_id,branch_id,full_name,email,phone,role,is_active"
      )
      .eq("organization_id", organizationId)
      .eq("role", "coach")
      .eq("is_active", true)
      .order("full_name"),

    supabase
      .from("students")
      .select(
        "id,first_name,last_name,student_number,swimming_level,medical_note,general_note,guardian_name,guardian_phone,phone"
      )
      .eq("organization_id", organizationId)
      .eq("is_deleted", false)
      .order("first_name"),

    supabase
      .from("student_group_memberships")
      .select(
        "id,organization_id,student_id,group_id,level_id,started_at,ended_at,is_active"
      )
      .eq("organization_id", organizationId)
      .eq("is_active", true),

    supabase
      .from("lesson_staff_assignments")
      .select(
        "id,organization_id,branch_id,schedule_id,group_id,coach_id,assignment_role,lane_label,sort_order,is_active"
      )
      .eq("organization_id", organizationId)
      .eq("is_active", true),

    supabase
      .from("lesson_student_assignments")
      .select(
        "id,organization_id,branch_id,schedule_id,group_id,student_id,coach_id,assignment_type,note,is_active"
      )
      .eq("organization_id", organizationId)
      .eq("is_active", true),
  ]);

  const criticalError =
    branchesResult.error ||
    groupsResult.error ||
    schedulesResult.error ||
    coachesResult.error ||
    studentsResult.error ||
    membershipsResult.error;

  if (criticalError) {
    return (
      <main style={pageStyle}>
        <div style={containerStyle}>
          <Link href="/" style={backButtonStyle}>
            ← Ana Sayfa
          </Link>

          <h1>Operasyon Planı</h1>

          <div style={errorStyle}>
            Veriler yüklenemedi:{" "}
            {criticalError.message}
          </div>
        </div>
      </main>
    );
  }

  const branches =
    branchesResult.data || [];

  const groups =
    groupsResult.data || [];

  const schedules =
    schedulesResult.data || [];

  const coaches =
    coachesResult.data || [];

  const students =
    studentsResult.data || [];

  const memberships =
    membershipsResult.data || [];

  const staffAssignments =
    staffAssignmentsResult.data || [];

  const studentAssignments =
    studentAssignmentsResult.data || [];

  /* =======================================================
     HARİTALAR
  ======================================================= */

  const branchMap = new Map(
    branches.map((item: any) => [
      item.id,
      item,
    ])
  );

  const groupMap = new Map(
    groups.map((item: any) => [
      item.id,
      item,
    ])
  );

  const coachMap = new Map(
    coaches.map((item: any) => [
      item.id,
      item,
    ])
  );

  const studentMap = new Map(
    students.map((item: any) => [
      item.id,
      item,
    ])
  );

  /* =======================================================
     FİLTRE SEÇENEKLERİ
  ======================================================= */

  const uniqueTimes = Array.from(
    new Set(
      schedules.map(
        (item: any) =>
          item.start_time?.slice(0, 5) || ""
      )
    )
  )
    .filter(Boolean)
    .sort();

  const levels = Array.from(
    new Set(
      students
        .map(
          (student: any) =>
            student.swimming_level
        )
        .filter(Boolean)
    )
  ).sort();

  /* =======================================================
     SEANS FİLTRELEME
  ======================================================= */

  let filteredSchedules =
    schedules.filter((schedule: any) => {
      if (
        params.sube &&
        schedule.branch_id !== params.sube
      ) {
        return false;
      }

      if (
        params.saat &&
        schedule.start_time?.slice(0, 5) !==
          params.saat
      ) {
        return false;
      }

      if (
        params.grup &&
        schedule.group_id !== params.grup
      ) {
        return false;
      }

      if (params.egitmen) {
        const explicitStaff =
          staffAssignments.some(
            (assignment: any) =>
              assignment.schedule_id ===
                schedule.id &&
              assignment.coach_id ===
                params.egitmen
          );

        const directCoach =
          schedule.coach_id ===
          params.egitmen;

        const group =
          groupMap.get(
            schedule.group_id
          );

        const primaryCoach =
          group?.primary_coach_id ===
          params.egitmen;

        if (
          !explicitStaff &&
          !directCoach &&
          !primaryCoach
        ) {
          return false;
        }
      }

      return true;
    });

  /* =======================================================
     ÖZETLER
  ======================================================= */

  const shownGroupIds =
    new Set(
      filteredSchedules
        .map(
          (schedule: any) =>
            schedule.group_id
        )
        .filter(Boolean)
    );

  const shownStudentIds =
    new Set(
      memberships
        .filter(
          (membership: any) =>
            shownGroupIds.has(
              membership.group_id
            )
        )
        .map(
          (membership: any) =>
            membership.student_id
        )
        .filter(Boolean)
    );

  const shownCoachIds =
    new Set<string>();

  filteredSchedules.forEach(
    (schedule: any) => {
      if (schedule.coach_id) {
        shownCoachIds.add(
          schedule.coach_id
        );
      }

      const group =
        groupMap.get(
          schedule.group_id
        );

      if (
        group?.primary_coach_id
      ) {
        shownCoachIds.add(
          group.primary_coach_id
        );
      }

      staffAssignments
        .filter(
          (assignment: any) =>
            assignment.schedule_id ===
            schedule.id
        )
        .forEach(
          (assignment: any) =>
            shownCoachIds.add(
              assignment.coach_id
            )
        );
    }
  );

  const canEdit = [
    "owner",
    "admin",
    "branch_manager",
  ].includes(profile.role);

  return (
    <main style={pageStyle}>
      <div style={containerStyle}>
        {/* =================================================
            ÜST ALAN
        ================================================= */}

        <section style={topAreaStyle}>
          <div>
            <div style={eyebrowStyle}>
              SPRİNT YÜZME OKULU · OPERASYON
            </div>

            <h1 style={titleStyle}>
              Operasyon Planı
            </h1>

            <p style={subtitleStyle}>
              Havuz, saat, seans, grup,
              eğitmen ve öğrencilerinizi
              tek ekrandan görün ve yönetin.
            </p>
          </div>

          <div style={topButtonsStyle}>
            <Link
              href="/yoklama"
              style={secondaryButtonStyle}
            >
              <Icons.check />
              Yoklama
            </Link>

            <Link
              href="/"
              style={primaryButtonStyle}
            >
              <Icons.dashboard />
              Ana Sayfa
            </Link>
          </div>
        </section>

        {/* =================================================
            GÖRÜNÜM SEKMELERİ
        ================================================= */}

        <section style={viewBarStyle}>
          {[
            ["seans", "Seans"],
            ["egitmen", "Eğitmen"],
            ["ogrenci", "Öğrenci"],
            ["grup", "Grup"],
            ["seviye", "Seviye"],
            ["havuz", "Havuz"],
            ["saat", "Saat"],
          ].map(([key, label]) => {
            const active =
              (params.gorunum ||
                "seans") === key;

            const qp =
              new URLSearchParams();

            qp.set(
              "tarih",
              selectedDate
            );

            qp.set(
              "gorunum",
              key
            );

            if (params.sube)
              qp.set(
                "sube",
                params.sube
              );

            if (params.saat)
              qp.set(
                "saat",
                params.saat
              );

            if (params.egitmen)
              qp.set(
                "egitmen",
                params.egitmen
              );

            if (params.grup)
              qp.set(
                "grup",
                params.grup
              );

            if (params.seviye)
              qp.set(
                "seviye",
                params.seviye
              );

            return (
              <Link
                key={key}
                href={`/operasyon-plani?${qp.toString()}`}
                style={{
                  ...viewButtonStyle,
                  ...(active
                    ? viewButtonActiveStyle
                    : {}),
                }}
              >
                {label}
              </Link>
            );
          })}
        </section>

        {/* =================================================
            FİLTRELER
        ================================================= */}

        <form
          method="get"
          style={filterPanelStyle}
        >
          <input
            type="hidden"
            name="gorunum"
            value={
              params.gorunum ||
              "seans"
            }
          />

          <div style={filterFieldStyle}>
            <label style={labelStyle}>
              Tarih
            </label>

            <input
              type="date"
              name="tarih"
              defaultValue={
                selectedDate
              }
              style={inputStyle}
            />
          </div>

          <div style={filterFieldStyle}>
            <label style={labelStyle}>
              Havuz / Şube
            </label>

            <select
              name="sube"
              defaultValue={
                params.sube || ""
              }
              style={inputStyle}
            >
              <option value="">
                Tüm Havuzlar
              </option>

              {branches.map(
                (branch: any) => (
                  <option
                    key={branch.id}
                    value={branch.id}
                  >
                    {branch.name}
                  </option>
                )
              )}
            </select>
          </div>

          <div style={filterFieldStyle}>
            <label style={labelStyle}>
              Saat
            </label>

            <select
              name="saat"
              defaultValue={
                params.saat || ""
              }
              style={inputStyle}
            >
              <option value="">
                Tüm Saatler
              </option>

              {uniqueTimes.map(
                (timeValue) => (
                  <option
                    key={timeValue}
                    value={timeValue}
                  >
                    {timeValue}
                  </option>
                )
              )}
            </select>
          </div>

          <div style={filterFieldStyle}>
            <label style={labelStyle}>
              Eğitmen
            </label>

            <select
              name="egitmen"
              defaultValue={
                params.egitmen || ""
              }
              style={inputStyle}
            >
              <option value="">
                Tüm Eğitmenler
              </option>

              {coaches.map(
                (coach: any) => (
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
          </div>

          <div style={filterFieldStyle}>
            <label style={labelStyle}>
              Grup
            </label>

            <select
              name="grup"
              defaultValue={
                params.grup || ""
              }
              style={inputStyle}
            >
              <option value="">
                Tüm Gruplar
              </option>

              {groups.map(
                (group: any) => (
                  <option
                    key={group.id}
                    value={group.id}
                  >
                    {group.name}
                  </option>
                )
              )}
            </select>
          </div>

          <div style={filterFieldStyle}>
            <label style={labelStyle}>
              Seviye
            </label>

            <select
              name="seviye"
              defaultValue={
                params.seviye || ""
              }
              style={inputStyle}
            >
              <option value="">
                Tüm Seviyeler
              </option>

              {levels.map(
                (level: any) => (
                  <option
                    key={level}
                    value={level}
                  >
                    {level}
                  </option>
                )
              )}
            </select>
          </div>

          <button
            type="submit"
            style={filterButtonStyle}
          >
            Filtrele
          </button>

          <Link
            href={`/operasyon-plani?tarih=${selectedDate}`}
            style={clearButtonStyle}
          >
            Temizle
          </Link>
        </form>

        {/* =================================================
            ÖZET KARTLARI
        ================================================= */}

        <section style={summaryGridStyle}>
          <SummaryCard
            label="Bugünkü Seans"
            value={
              filteredSchedules.length
            }
            icon={<Icons.calendar />}
          />

          <SummaryCard
            label="Eğitmen"
            value={
              shownCoachIds.size
            }
            icon={<Icons.users />}
          />

          <SummaryCard
            label="Öğrenci"
            value={
              shownStudentIds.size
            }
            icon={<Icons.child />}
          />

          <SummaryCard
            label="Grup"
            value={
              shownGroupIds.size
            }
            icon={<Icons.branch />}
          />
        </section>

        {/* =================================================
            TARİH BAŞLIĞI
        ================================================= */}

        <section style={dayTitleStyle}>
          <div>
            <span style={dayBadgeStyle}>
              {GUNLER[
                selectedWeekday
              ]}
            </span>

            <strong
              style={{
                marginLeft: 10,
              }}
            >
              {new Intl.DateTimeFormat(
                "tr-TR",
                {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                }
              ).format(
                new Date(
                  `${selectedDate}T12:00:00+03:00`
                )
              )}
            </strong>
          </div>

          <span
            style={{
              color: "#64748b",
              fontSize: 13,
            }}
          >
            {
              filteredSchedules.length
            }{" "}
            aktif seans
          </span>
        </section>

        {/* =================================================
            SEANSLAR
        ================================================= */}

        {filteredSchedules.length ===
        0 ? (
          <section style={emptyStyle}>
            <div style={emptyIconStyle}>
              <Icons.calendar />
            </div>

            <h2>
              Bu filtrelerde seans
              bulunamadı
            </h2>

            <p>
              Tarih veya filtreleri
              değiştirerek tekrar
              deneyebilirsiniz.
            </p>
          </section>
        ) : (
          <section style={scheduleGridStyle}>
            {filteredSchedules.map(
              (schedule: any) => {
                const group =
                  groupMap.get(
                    schedule.group_id
                  );

                const branch =
                  branchMap.get(
                    schedule.branch_id ||
                      group?.branch_id
                  );

                const groupMemberships =
                  memberships.filter(
                    (
                      membership: any
                    ) =>
                      membership.group_id ===
                      schedule.group_id
                  );

                let groupStudents =
                  groupMemberships
                    .map(
                      (
                        membership: any
                      ) =>
                        studentMap.get(
                          membership.student_id
                        )
                    )
                    .filter(Boolean);

                if (
                  params.seviye
                ) {
                  groupStudents =
                    groupStudents.filter(
                      (
                        student: any
                      ) =>
                        student.swimming_level ===
                        params.seviye
                    );
                }

                const explicitStaff =
                  staffAssignments
                    .filter(
                      (
                        assignment: any
                      ) =>
                        assignment.schedule_id ===
                        schedule.id
                    )
                    .sort(
                      (
                        a: any,
                        b: any
                      ) =>
                        Number(
                          a.sort_order ||
                            0
                        ) -
                        Number(
                          b.sort_order ||
                            0
                        )
                    );

                const staffCoachIds =
                  new Set<string>();

                explicitStaff.forEach(
                  (
                    assignment: any
                  ) => {
                    if (
                      assignment.coach_id
                    ) {
                      staffCoachIds.add(
                        assignment.coach_id
                      );
                    }
                  }
                );

                if (
                  schedule.coach_id
                ) {
                  staffCoachIds.add(
                    schedule.coach_id
                  );
                }

                if (
                  group?.primary_coach_id
                ) {
                  staffCoachIds.add(
                    group.primary_coach_id
                  );
                }

                const sessionCoaches =
                  Array.from(
                    staffCoachIds
                  )
                    .map((id) =>
                      coachMap.get(id)
                    )
                    .filter(Boolean);

                const sessionStudentAssignments =
                  studentAssignments.filter(
                    (
                      assignment: any
                    ) =>
                      assignment.schedule_id ===
                      schedule.id
                  );

                const levelsInSession =
                  Array.from(
                    new Set(
                      groupStudents
                        .map(
                          (
                            student: any
                          ) =>
                            student.swimming_level
                        )
                        .filter(Boolean)
                    )
                  );

                const capacity =
                  Number(
                    group?.capacity ||
                      0
                  );

                const occupancy =
                  capacity > 0
                    ? Math.round(
                        (groupStudents.length /
                          capacity) *
                          100
                      )
                    : 0;

                return (
                  <article
                    key={
                      schedule.id
                    }
                    style={sessionCardStyle}
                  >
                    {/* =====================================
                        SEANS BAŞLIĞI
                    ===================================== */}

                    <header
                      style={
                        sessionHeaderStyle
                      }
                    >
                      <div>
                        <div
                          style={
                            poolLabelStyle
                          }
                        >
                          <Icons.branch />

                          {branch?.name ||
                            "Şube Belirtilmemiş"}
                        </div>

                        <h2
                          style={
                            sessionTitleStyle
                          }
                        >
                          {saatGoster(
                            schedule.start_time
                          )}
                          {" – "}
                          {saatGoster(
                            schedule.end_time
                          )}
                        </h2>

                        <p
                          style={
                            sessionSubtitleStyle
                          }
                        >
                          {group?.name ||
                            "Grup Atanmamış"}

                          {group?.course_type
                            ? ` · ${group.course_type}`
                            : ""}
                        </p>
                      </div>

                      <div
                        style={
                          sessionHeaderStatsStyle
                        }
                      >
                        <MiniStat
                          value={
                            groupStudents.length
                          }
                          label="Öğrenci"
                        />

                        <MiniStat
                          value={
                            sessionCoaches.length
                          }
                          label="Eğitmen"
                        />

                        <MiniStat
                          value={
                            levelsInSession.length
                          }
                          label="Seviye"
                        />
                      </div>
                    </header>

                    {/* =====================================
                        SEVİYE + KAPASİTE
                    ===================================== */}

                    <div
                      style={
                        sessionInfoBarStyle
                      }
                    >
                      <div>
                        <span
                          style={
                            infoTitleStyle
                          }
                        >
                          Seviyeler
                        </span>

                        <div
                          style={
                            badgeWrapStyle
                          }
                        >
                          {levelsInSession.length >
                          0 ? (
                            levelsInSession.map(
                              (
                                level: any
                              ) => (
                                <span
                                  key={
                                    level
                                  }
                                  style={
                                    levelBadgeStyle
                                  }
                                >
                                  {level}
                                </span>
                              )
                            )
                          ) : (
                            <span
                              style={
                                mutedTextStyle
                              }
                            >
                              Seviye bilgisi yok
                            </span>
                          )}
                        </div>
                      </div>

                      <div>
                        <span
                          style={
                            infoTitleStyle
                          }
                        >
                          Kapasite
                        </span>

                        <strong>
                          {
                            groupStudents.length
                          }
                          /
                          {capacity ||
                            "—"}
                        </strong>

                        {capacity >
                          0 && (
                          <span
                            style={{
                              marginLeft:
                                8,
                              color:
                                occupancy >=
                                100
                                  ? "#dc2626"
                                  : occupancy >=
                                    80
                                  ? "#d97706"
                                  : "#16a34a",
                              fontSize:
                                12,
                              fontWeight:
                                800,
                            }}
                          >
                            %{occupancy}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* =====================================
                        PERSONEL ATAMA
                    ===================================== */}

                    {canEdit && (
                      <section
                        style={
                          assignmentPanelStyle
                        }
                      >
                        <div
                          style={
                            assignmentTitleStyle
                          }
                        >
                          Personel Ataması
                        </div>

                        <form
                          action={
                            personelAta
                          }
                          style={
                            assignmentFormStyle
                          }
                        >
                          <input
                            type="hidden"
                            name="schedule_id"
                            value={
                              schedule.id
                            }
                          />

                          <input
                            type="hidden"
                            name="group_id"
                            value={
                              schedule.group_id ||
                              ""
                            }
                          />

                          <input
                            type="hidden"
                            name="branch_id"
                            value={
                              schedule.branch_id ||
                              group?.branch_id ||
                              ""
                            }
                          />

                          <select
                            name="coach_id"
                            required
                            style={
                              compactInputStyle
                            }
                            defaultValue=""
                          >
                            <option
                              value=""
                              disabled
                            >
                              Eğitmen seç
                            </option>

                            {coaches.map(
                              (
                                coach: any
                              ) => (
                                <option
                                  key={
                                    coach.id
                                  }
                                  value={
                                    coach.id
                                  }
                                >
                                  {coach.full_name ||
                                    coach.email ||
                                    "Eğitmen"}
                                </option>
                              )
                            )}
                          </select>

                          <button
                            type="submit"
                            style={
                              compactPrimaryButtonStyle
                            }
                          >
                            + Personel Ata
                          </button>
                        </form>
                      </section>
                    )}

                    {/* =====================================
                        EĞİTMEN KARTLARI
                    ===================================== */}

                    <section>
                      <div
                        style={
                          sectionTitleStyle
                        }
                      >
                        Eğitmen Dağılımı
                      </div>

                      {sessionCoaches.length ===
                      0 ? (
                        <div
                          style={
                            smallEmptyStyle
                          }
                        >
                          Bu seansa henüz
                          eğitmen atanmadı.
                        </div>
                      ) : (
                        <div
                          style={
                            coachGridStyle
                          }
                        >
                          {sessionCoaches.map(
                            (
                              coach: any
                            ) => {
                              const coachStudents =
                                groupStudents.filter(
                                  (
                                    student: any
                                  ) => {
                                    const assigned =
                                      sessionStudentAssignments.find(
                                        (
                                          assignment: any
                                        ) =>
                                          assignment.student_id ===
                                          student.id
                                      );

                                    /*
                                     * Öğrenci özel olarak
                                     * başka hocaya atanmadıysa,
                                     * varsayılan grup/seans
                                     * eğitmeninde gösterilebilir.
                                     */
                                    if (
                                      assigned?.coach_id
                                    ) {
                                      return (
                                        assigned.coach_id ===
                                        coach.id
                                      );
                                    }

                                    const defaultCoachId =
                                      schedule.coach_id ||
                                      group?.primary_coach_id;

                                    return (
                                      defaultCoachId ===
                                      coach.id
                                    );
                                  }
                                );

                              const explicitAssignment =
                                explicitStaff.find(
                                  (
                                    assignment: any
                                  ) =>
                                    assignment.coach_id ===
                                    coach.id
                                );

                              return (
                                <div
                                  key={
                                    coach.id
                                  }
                                  style={
                                    coachCardStyle
                                  }
                                >
                                  <div
                                    style={
                                      coachHeaderStyle
                                    }
                                  >
                                    <div
                                      style={
                                        coachAvatarStyle
                                      }
                                    >
                                      {initials(
                                        coach.full_name
                                      )}
                                    </div>

                                    <div
                                      style={{
                                        flex: 1,
                                      }}
                                    >
                                      <strong
                                        style={
                                          coachNameStyle
                                        }
                                      >
                                        {coach.full_name ||
                                          coach.email ||
                                          "Eğitmen"}
                                      </strong>

                                      <span
                                        style={
                                          coachMetaStyle
                                        }
                                      >
                                        {
                                          coachStudents.length
                                        }{" "}
                                        öğrenci
                                      </span>
                                    </div>

                                    {explicitAssignment &&
                                      canEdit && (
                                        <form
                                          action={
                                            personelCikar
                                          }
                                        >
                                          <input
                                            type="hidden"
                                            name="assignment_id"
                                            value={
                                              explicitAssignment.id
                                            }
                                          />

                                          <button
                                            type="submit"
                                            title="Seans atamasından çıkar"
                                            style={
                                              removeButtonStyle
                                            }
                                          >
                                            ×
                                          </button>
                                        </form>
                                      )}
                                  </div>

                                  {explicitAssignment?.lane_label && (
                                    <div
                                      style={
                                        laneStyle
                                      }
                                    >
                                      Kulvar:{" "}
                                      {
                                        explicitAssignment.lane_label
                                      }
                                    </div>
                                  )}

                                  <div
                                    style={
                                      studentMiniListStyle
                                    }
                                  >
                                    {coachStudents.length >
                                    0 ? (
                                      coachStudents
                                        .slice(
                                          0,
                                          8
                                        )
                                        .map(
                                          (
                                            student: any
                                          ) => (
                                            <div
                                              key={
                                                student.id
                                              }
                                              style={
                                                studentMiniRowStyle
                                              }
                                            >
                                              <span>
                                                {adSoyad(
                                                  student
                                                )}
                                              </span>

                                              <b>
                                                {student.swimming_level ||
                                                  "Seviye yok"}
                                              </b>
                                            </div>
                                          )
                                        )
                                    ) : (
                                      <span
                                        style={
                                          mutedTextStyle
                                        }
                                      >
                                        Henüz öğrenci
                                        atanmadı.
                                      </span>
                                    )}

                                    {coachStudents.length >
                                      8 && (
                                      <div
                                        style={
                                          moreStudentsStyle
                                        }
                                      >
                                        +
                                        {coachStudents.length -
                                          8}{" "}
                                        öğrenci daha
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            }
                          )}
                        </div>
                      )}
                    </section>

                    {/* =====================================
                        TÜM ÖĞRENCİLER
                    ===================================== */}

                    <section
                      style={{
                        marginTop: 22,
                      }}
                    >
                      <div
                        style={
                          sectionTitleStyle
                        }
                      >
                        Öğrenciler
                      </div>

                      <div
                        style={
                          studentGridStyle
                        }
                      >
                        {groupStudents.map(
                          (
                            student: any
                          ) => {
                            const studentAssignment =
                              sessionStudentAssignments.find(
                                (
                                  assignment: any
                                ) =>
                                  assignment.student_id ===
                                  student.id
                              );

                            const assignedCoach =
                              studentAssignment?.coach_id
                                ? coachMap.get(
                                    studentAssignment.coach_id
                                  )
                                : null;

                            return (
                              <div
                                key={
                                  student.id
                                }
                                style={
                                  studentCardStyle
                                }
                              >
                                <div
                                  style={
                                    studentTopStyle
                                  }
                                >
                                  <div>
                                    <strong
                                      style={
                                        studentNameStyle
                                      }
                                    >
                                      {adSoyad(
                                        student
                                      )}
                                    </strong>

                                    <span
                                      style={
                                        studentNumberStyle
                                      }
                                    >
                                      {student.student_number ||
                                        "Öğrenci No Yok"}
                                    </span>
                                  </div>

                                  <span
                                    style={
                                      levelBadgeStyle
                                    }
                                  >
                                    {student.swimming_level ||
                                      "Seviye Yok"}
                                  </span>
                                </div>

                                {assignedCoach && (
                                  <div
                                    style={
                                      assignedCoachStyle
                                    }
                                  >
                                    Eğitmen:{" "}
                                    <strong>
                                      {assignedCoach.full_name}
                                    </strong>
                                  </div>
                                )}

                                {student.medical_note && (
                                  <div
                                    style={
                                      medicalWarningStyle
                                    }
                                  >
                                    Sağlık Notu:{" "}
                                    {
                                      student.medical_note
                                    }
                                  </div>
                                )}

                                <div
                                  style={
                                    studentActionsStyle
                                  }
                                >
                                  <Link
                                    href={`/ogrenciler/${student.id}`}
                                    style={
                                      studentLinkStyle
                                    }
                                  >
                                    Öğrenci Kartı
                                  </Link>

                                  {canEdit && (
                                    <form
                                      action={
                                        ogrenciAta
                                      }
                                      style={
                                        studentAssignFormStyle
                                      }
                                    >
                                      <input
                                        type="hidden"
                                        name="schedule_id"
                                        value={
                                          schedule.id
                                        }
                                      />

                                      <input
                                        type="hidden"
                                        name="student_id"
                                        value={
                                          student.id
                                        }
                                      />

                                      <input
                                        type="hidden"
                                        name="group_id"
                                        value={
                                          schedule.group_id ||
                                          ""
                                        }
                                      />

                                      <input
                                        type="hidden"
                                        name="branch_id"
                                        value={
                                          schedule.branch_id ||
                                          group?.branch_id ||
                                          ""
                                        }
                                      />

                                      <select
                                        name="coach_id"
                                        defaultValue={
                                          studentAssignment?.coach_id ||
                                          ""
                                        }
                                        style={
                                          studentCoachSelectStyle
                                        }
                                      >
                                        <option value="">
                                          Eğitmen Ata
                                        </option>

                                        {sessionCoaches.map(
                                          (
                                            coach: any
                                          ) => (
                                            <option
                                              key={
                                                coach.id
                                              }
                                              value={
                                                coach.id
                                              }
                                            >
                                              {coach.full_name ||
                                                coach.email}
                                            </option>
                                          )
                                        )}
                                      </select>

                                      <button
                                        type="submit"
                                        style={
                                          saveSmallButtonStyle
                                        }
                                      >
                                        Kaydet
                                      </button>
                                    </form>
                                  )}
                                </div>
                              </div>
                            );
                          }
                        )}
                      </div>
                    </section>

                    {/* =====================================
                        GRUP DEĞİŞTİR
                    ===================================== */}

                    {canEdit && (
                      <section
                        style={
                          footerActionsStyle
                        }
                      >
                        <form
                          action={
                            grupAta
                          }
                          style={
                            assignmentFormStyle
                          }
                        >
                          <input
                            type="hidden"
                            name="schedule_id"
                            value={
                              schedule.id
                            }
                          />

                          <select
                            name="group_id"
                            required
                            defaultValue={
                              schedule.group_id ||
                              ""
                            }
                            style={
                              compactInputStyle
                            }
                          >
                            <option value="">
                              Grup seç
                            </option>

                            {groups
                              .filter(
                                (
                                  candidate: any
                                ) =>
                                  !schedule.branch_id ||
                                  candidate.branch_id ===
                                    schedule.branch_id
                              )
                              .map(
                                (
                                  candidate: any
                                ) => (
                                  <option
                                    key={
                                      candidate.id
                                    }
                                    value={
                                      candidate.id
                                    }
                                  >
                                    {candidate.name}
                                  </option>
                                )
                              )}
                          </select>

                          <button
                            type="submit"
                            style={
                              compactSecondaryButtonStyle
                            }
                          >
                            Grup Ata / Değiştir
                          </button>
                        </form>

                        <Link
                          href={`/yoklama?grup=${schedule.group_id || ""}&seans=${schedule.id}&tarih=${selectedDate}`}
                          style={
                            attendanceButtonStyle
                          }
                        >
                          <Icons.check />
                          Yoklama Al
                        </Link>
                      </section>
                    )}
                  </article>
                );
              }
            )}
          </section>
        )}
      </div>
    </main>
  );
}

/* =========================================================
   KÜÇÜK BİLEŞENLER
========================================================= */

function SummaryCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
}) {
  return (
    <div style={summaryCardStyle}>
      <div style={summaryIconStyle}>
        {icon}
      </div>

      <div>
        <span style={summaryLabelStyle}>
          {label}
        </span>

        <strong style={summaryValueStyle}>
          {value}
        </strong>
      </div>
    </div>
  );
}

function MiniStat({
  value,
  label,
}: {
  value: number;
  label: string;
}) {
  return (
    <div style={miniStatStyle}>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

/* =========================================================
   STİLLER
========================================================= */

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  background:
    "linear-gradient(180deg,#f5f8fd 0%,#edf3f9 100%)",
  color: "#13233f",
  padding: "28px",
};

const containerStyle: React.CSSProperties = {
  maxWidth: 1580,
  margin: "0 auto",
};

const topAreaStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 20,
  flexWrap: "wrap",
  marginBottom: 22,
};

const eyebrowStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: 1.5,
  color: "#1769e8",
  marginBottom: 7,
};

const titleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 34,
  letterSpacing: "-0.8px",
};

const subtitleStyle: React.CSSProperties = {
  margin: "7px 0 0",
  color: "#64748b",
  fontSize: 14,
};

const topButtonsStyle: React.CSSProperties = {
  display: "flex",
  gap: 9,
  flexWrap: "wrap",
};

const primaryButtonStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  padding: "11px 15px",
  background: "#1769e8",
  color: "#fff",
  borderRadius: 11,
  textDecoration: "none",
  fontWeight: 800,
  fontSize: 13,
};

const secondaryButtonStyle: React.CSSProperties = {
  ...primaryButtonStyle,
  background: "#fff",
  color: "#1769e8",
  border: "1px solid #dce5f2",
};

const backButtonStyle = secondaryButtonStyle;

const viewBarStyle: React.CSSProperties = {
  display: "flex",
  gap: 7,
  flexWrap: "wrap",
  background: "#fff",
  border: "1px solid #e1e8f2",
  borderRadius: 15,
  padding: 7,
  marginBottom: 14,
};

const viewButtonStyle: React.CSSProperties = {
  padding: "9px 14px",
  borderRadius: 10,
  color: "#64748b",
  textDecoration: "none",
  fontSize: 12,
  fontWeight: 800,
};

const viewButtonActiveStyle: React.CSSProperties = {
  background: "#1769e8",
  color: "#fff",
};

const filterPanelStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit,minmax(155px,1fr))",
  gap: 10,
  alignItems: "end",
  background: "#fff",
  border: "1px solid #e1e8f2",
  borderRadius: 18,
  padding: 16,
  marginBottom: 16,
};

const filterFieldStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
};

const labelStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 900,
  color: "#64748b",
  letterSpacing: 0.7,
  textTransform: "uppercase",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  height: 40,
  border: "1px solid #dce5f2",
  borderRadius: 10,
  padding: "0 11px",
  background: "#fff",
  color: "#13233f",
  fontSize: 12,
};

const filterButtonStyle: React.CSSProperties = {
  height: 40,
  border: 0,
  borderRadius: 10,
  background: "#1769e8",
  color: "#fff",
  fontWeight: 850,
  cursor: "pointer",
};

const clearButtonStyle: React.CSSProperties = {
  height: 40,
  borderRadius: 10,
  border: "1px solid #dce5f2",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: "#64748b",
  textDecoration: "none",
  fontSize: 12,
  fontWeight: 800,
};

const summaryGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit,minmax(190px,1fr))",
  gap: 12,
  marginBottom: 16,
};

const summaryCardStyle: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #e1e8f2",
  borderRadius: 16,
  padding: 16,
  display: "flex",
  alignItems: "center",
  gap: 12,
};

const summaryIconStyle: React.CSSProperties = {
  width: 42,
  height: 42,
  borderRadius: 12,
  background: "#edf5ff",
  color: "#1769e8",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const summaryLabelStyle: React.CSSProperties = {
  display: "block",
  color: "#64748b",
  fontSize: 11,
  fontWeight: 750,
};

const summaryValueStyle: React.CSSProperties = {
  display: "block",
  fontSize: 23,
  marginTop: 2,
};

const dayTitleStyle: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #e1e8f2",
  borderRadius: 14,
  padding: "13px 16px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  marginBottom: 14,
};

const dayBadgeStyle: React.CSSProperties = {
  padding: "6px 9px",
  background: "#edf5ff",
  color: "#1769e8",
  borderRadius: 8,
  fontSize: 11,
  fontWeight: 900,
};

const scheduleGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit,minmax(570px,1fr))",
  gap: 16,
};

const sessionCardStyle: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #dfe7f1",
  borderRadius: 20,
  padding: 20,
  boxShadow:
    "0 10px 30px rgba(15,23,42,0.05)",
};

const sessionHeaderStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 15,
  flexWrap: "wrap",
  paddingBottom: 16,
  borderBottom: "1px solid #edf1f6",
};

const poolLabelStyle: React.CSSProperties = {
  color: "#1769e8",
  display: "flex",
  alignItems: "center",
  gap: 6,
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: 0.5,
};

const sessionTitleStyle: React.CSSProperties = {
  margin: "7px 0 3px",
  fontSize: 25,
};

const sessionSubtitleStyle: React.CSSProperties = {
  margin: 0,
  color: "#64748b",
  fontSize: 13,
};

const sessionHeaderStatsStyle: React.CSSProperties = {
  display: "flex",
  gap: 7,
};

const miniStatStyle: React.CSSProperties = {
  minWidth: 62,
  background: "#f7f9fc",
  border: "1px solid #e7edf5",
  borderRadius: 11,
  padding: "8px 9px",
  textAlign: "center",
};

const sessionInfoBarStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  flexWrap: "wrap",
  padding: "13px 0",
};

const infoTitleStyle: React.CSSProperties = {
  display: "block",
  fontSize: 9,
  fontWeight: 900,
  color: "#94a3b8",
  letterSpacing: 0.7,
  marginBottom: 5,
};

const badgeWrapStyle: React.CSSProperties = {
  display: "flex",
  gap: 5,
  flexWrap: "wrap",
};

const levelBadgeStyle: React.CSSProperties = {
  display: "inline-flex",
  padding: "4px 7px",
  background: "#eef5ff",
  border: "1px solid #dbeafe",
  color: "#1769e8",
  borderRadius: 7,
  fontSize: 10,
  fontWeight: 850,
};

const assignmentPanelStyle: React.CSSProperties = {
  background: "#f8fbff",
  border: "1px solid #dfeaf9",
  borderRadius: 13,
  padding: 12,
  marginBottom: 17,
};

const assignmentTitleStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 900,
  color: "#475569",
  marginBottom: 8,
  textTransform: "uppercase",
  letterSpacing: 0.6,
};

const assignmentFormStyle: React.CSSProperties = {
  display: "flex",
  gap: 7,
  flexWrap: "wrap",
};

const compactInputStyle: React.CSSProperties = {
  minWidth: 180,
  minHeight: 38,
  border: "1px solid #dce5f2",
  borderRadius: 9,
  padding: "0 10px",
  background: "#fff",
  fontSize: 12,
  flex: 1,
};

const compactPrimaryButtonStyle: React.CSSProperties = {
  minHeight: 38,
  border: 0,
  borderRadius: 9,
  padding: "0 13px",
  background: "#1769e8",
  color: "#fff",
  fontSize: 11,
  fontWeight: 850,
  cursor: "pointer",
};

const compactSecondaryButtonStyle: React.CSSProperties = {
  ...compactPrimaryButtonStyle,
  background: "#eef5ff",
  color: "#1769e8",
  border: "1px solid #dbeafe",
};

const sectionTitleStyle: React.CSSProperties = {
  marginBottom: 9,
  color: "#334155",
  fontSize: 11,
  fontWeight: 900,
  textTransform: "uppercase",
  letterSpacing: 0.7,
};

const coachGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit,minmax(220px,1fr))",
  gap: 9,
};

const coachCardStyle: React.CSSProperties = {
  border: "1px solid #e1e8f2",
  borderRadius: 14,
  padding: 12,
  background: "#fbfcfe",
};

const coachHeaderStyle: React.CSSProperties = {
  display: "flex",
  gap: 9,
  alignItems: "center",
};

const coachAvatarStyle: React.CSSProperties = {
  width: 38,
  height: 38,
  borderRadius: 11,
  background: "#1769e8",
  color: "#fff",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 11,
  fontWeight: 900,
};

const coachNameStyle: React.CSSProperties = {
  display: "block",
  fontSize: 13,
};

const coachMetaStyle: React.CSSProperties = {
  display: "block",
  marginTop: 2,
  color: "#64748b",
  fontSize: 10,
};

const removeButtonStyle: React.CSSProperties = {
  width: 27,
  height: 27,
  border: "1px solid #fecaca",
  borderRadius: 8,
  background: "#fff1f2",
  color: "#dc2626",
  cursor: "pointer",
};

const laneStyle: React.CSSProperties = {
  marginTop: 8,
  fontSize: 10,
  fontWeight: 800,
  color: "#7c3aed",
};

const studentMiniListStyle: React.CSSProperties = {
  marginTop: 10,
  display: "flex",
  flexDirection: "column",
  gap: 5,
};

const studentMiniRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 8,
  fontSize: 10,
  padding: "6px 7px",
  background: "#fff",
  borderRadius: 7,
};

const moreStudentsStyle: React.CSSProperties = {
  fontSize: 10,
  color: "#1769e8",
  fontWeight: 800,
  paddingTop: 3,
};

const studentGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit,minmax(240px,1fr))",
  gap: 8,
};

const studentCardStyle: React.CSSProperties = {
  border: "1px solid #e3eaf3",
  borderRadius: 12,
  padding: 11,
  background: "#fff",
};

const studentTopStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 8,
  alignItems: "flex-start",
};

const studentNameStyle: React.CSSProperties = {
  display: "block",
  fontSize: 12,
};

const studentNumberStyle: React.CSSProperties = {
  display: "block",
  marginTop: 2,
  color: "#94a3b8",
  fontSize: 9,
};

const assignedCoachStyle: React.CSSProperties = {
  marginTop: 8,
  padding: "6px 7px",
  borderRadius: 7,
  background: "#f0fdf4",
  color: "#166534",
  fontSize: 10,
};

const medicalWarningStyle: React.CSSProperties = {
  marginTop: 7,
  padding: "6px 7px",
  borderRadius: 7,
  background: "#fff7ed",
  color: "#9a3412",
  fontSize: 9,
  fontWeight: 700,
};

const studentActionsStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
  marginTop: 8,
};

const studentLinkStyle: React.CSSProperties = {
  color: "#1769e8",
  fontSize: 10,
  fontWeight: 800,
  textDecoration: "none",
};

const studentAssignFormStyle: React.CSSProperties = {
  display: "flex",
  gap: 5,
};

const studentCoachSelectStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  border: "1px solid #dce5f2",
  borderRadius: 7,
  padding: "6px 7px",
  background: "#fff",
  fontSize: 9,
};

const saveSmallButtonStyle: React.CSSProperties = {
  border: 0,
  borderRadius: 7,
  background: "#1769e8",
  color: "#fff",
  padding: "0 8px",
  fontSize: 9,
  fontWeight: 800,
  cursor: "pointer",
};

const footerActionsStyle: React.CSSProperties = {
  marginTop: 17,
  paddingTop: 14,
  borderTop: "1px solid #edf1f6",
  display: "flex",
  justifyContent: "space-between",
  gap: 8,
  flexWrap: "wrap",
};

const attendanceButtonStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "9px 13px",
  borderRadius: 9,
  background: "#16a34a",
  color: "#fff",
  textDecoration: "none",
  fontSize: 11,
  fontWeight: 850,
};

const errorStyle: React.CSSProperties = {
  marginTop: 20,
  padding: 18,
  borderRadius: 14,
  background: "#fff1f2",
  border: "1px solid #fecaca",
  color: "#991b1b",
};

const emptyStyle: React.CSSProperties = {
  textAlign: "center",
  padding: 55,
  background: "#fff",
  border: "1px solid #e1e8f2",
  borderRadius: 20,
};

const smallEmptyStyle: React.CSSProperties = {
  padding: 13,
  borderRadius: 10,
  background: "#f8fafc",
  color: "#64748b",
  fontSize: 11,
};

const emptyIconStyle: React.CSSProperties = {
  width: 50,
  height: 50,
  borderRadius: 14,
  background: "#edf5ff",
  color: "#1769e8",
  margin: "0 auto 12px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const mutedTextStyle: React.CSSProperties = {
  color: "#94a3b8",
  fontSize: 10,
};
