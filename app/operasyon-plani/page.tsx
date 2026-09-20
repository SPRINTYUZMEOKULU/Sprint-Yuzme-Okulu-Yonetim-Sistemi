import Link from "next/link";
import { revalidatePath } from "next/cache";

import { requireProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import { filterEffectivelyActiveSchedules } from "@/lib/schedules/effective";

import { Icons } from "@/app/components/dashboard-icons";
import UstGezinme from "@/app/components/UstGezinme";
import OperationStudentManager, {
  type OperationStudentRow,
} from "./operation-student-manager";

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
  yas?: string;
  gorunum?: string;
  kapsam?: string;
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

function enrollmentWeekday(value: number) {
  // student_enrollments.lesson_weekdays Postgres DOW kullanır: Pazar=0.
  // Operasyon ekranında Pazar 7 olarak gösterildiği için yalnız bu noktada normalize edilir.
  return Number(value) === 7 ? 0 : Number(value);
}

function enrollmentIncludesScheduleDay(enrollment: any, scheduleWeekday: number) {
  const days = Array.isArray(enrollment?.lesson_weekdays)
    ? enrollment.lesson_weekdays.map(Number)
    : [];

  // Eski kayıtlarda lesson_weekdays boş olabilir. Geriye dönük uyumluluk için
  // bu kayıtlar grup programını kullanmaya devam eder.
  if (!days.length) return true;

  return days.includes(enrollmentWeekday(scheduleWeekday));
}

function enrollmentDaysText(enrollment: any) {
  const rawDays: number[] = Array.isArray(enrollment?.lesson_weekdays)
    ? enrollment.lesson_weekdays.map((day: unknown) => Number(day))
    : [];
  const days: number[] = Array.from(new Set<number>(rawDays));

  if (!days.length) return "Grup programı";

  const uiDays: number[] = days
    .map((day) => (day === 0 ? 7 : day))
    .sort((a, b) => a - b);

  return `${uiDays.length} gün · ${uiDays
    .map((day) => GUNLER[day] || "Ders")
    .join(" + ")}`;
}

function ageOnDate(birthDate?: string | null, referenceDate?: string | null) {
  if (!birthDate) return null;

  const birth = new Date(`${birthDate.slice(0, 10)}T12:00:00+03:00`);
  const ref = referenceDate
    ? new Date(`${referenceDate.slice(0, 10)}T12:00:00+03:00`)
    : new Date();

  if (Number.isNaN(birth.getTime()) || Number.isNaN(ref.getTime())) return null;

  let age = ref.getFullYear() - birth.getFullYear();
  const monthDiff = ref.getMonth() - birth.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && ref.getDate() < birth.getDate())) {
    age -= 1;
  }

  return age >= 0 ? age : null;
}

function ageMatchesFilter(age: number | null, filter?: string) {
  if (!filter) return true;
  if (age === null) return false;

  if (filter === "3-5") return age >= 3 && age <= 5;
  if (filter === "6-8") return age >= 6 && age <= 8;
  if (filter === "9-11") return age >= 9 && age <= 11;
  if (filter === "12-14") return age >= 12 && age <= 14;
  if (filter === "15+") return age >= 15;

  return true;
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
   ORTAK SEANS / AYRI TUT TERCİHİ
========================================================= */

async function ortakSeansModuAyarla(formData: FormData) {
  "use server";

  const profile = await requireProfile(["owner", "admin", "branch_manager"]);
  const organizationId = profile.organization_id;

  if (!organizationId) {
    throw new Error("Organizasyon bilgisi bulunamadı.");
  }

  const scheduleId = String(formData.get("schedule_id") || "");
  const mode = String(formData.get("mode") || "auto");

  if (!scheduleId || !["auto", "shared", "separate"].includes(mode)) {
    throw new Error("Ortak seans tercihi geçersiz.");
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from("lesson_shared_session_preferences")
    .upsert(
      {
        organization_id: organizationId,
        schedule_id: scheduleId,
        mode,
        created_by: profile.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "organization_id,schedule_id" }
    );

  if (error) {
    throw new Error(`Ortak seans tercihi kaydedilemedi: ${error.message}`);
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
    enrollmentsResult,
    staffAssignmentsResult,
    studentAssignmentsResult,
    sharedPreferencesResult,
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
      .order("weekday")
      .order("start_time"),

    supabase
      .from("profiles")
      .select(
        "id,organization_id,branch_id,full_name,email,phone,role,is_active"
      )
      .eq("organization_id", organizationId)
      // Eğitmen kaynağı merkezi profiles tablosudur. Bazı eğitmen hesapları
      // yönetici yetkisi de taşıyabildiği için yalnızca role=coach filtresi
      // operasyon ekranında eksik liste üretiyordu.
      .in("role", ["coach", "admin", "branch_manager"])
      .eq("is_active", true)
      .order("full_name"),

    supabase
      .from("students")
      .select(
        "id,first_name,last_name,student_number,birth_date,swimming_level,medical_note,general_note,guardian_name,guardian_phone,phone,status"
      )
      .eq("organization_id", organizationId)
      .eq("is_deleted", false)
      .eq("status", "active")
      .order("first_name"),

    supabase
      .from("student_group_memberships")
      .select(
        "id,organization_id,student_id,group_id,level_id,started_at,ended_at,is_active"
      )
      .eq("organization_id", organizationId)
      .eq("is_active", true),

    supabase
      .from("student_enrollments")
      .select(
        "id,organization_id,student_id,group_id,lesson_weekdays,total_lessons,used_lessons,start_date,planned_end_date,status"
      )
      .eq("organization_id", organizationId)
      .eq("status", "active"),

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

    supabase
      .from("lesson_shared_session_preferences")
      .select("schedule_id,mode,lane_label")
      .eq("organization_id", organizationId),
  ]);

  const criticalError =
    branchesResult.error ||
    groupsResult.error ||
    schedulesResult.error ||
    coachesResult.error ||
    studentsResult.error ||
    membershipsResult.error ||
    enrollmentsResult.error;

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

  const rawSchedules = schedulesResult.data || [];

  const coaches =
    coachesResult.data || [];

  const students =
    studentsResult.data || [];

  const memberships =
    membershipsResult.data || [];

  const enrollments =
    enrollmentsResult.data || [];

  const staffAssignments =
    staffAssignmentsResult.data || [];

  const studentAssignments =
    studentAssignmentsResult.data || [];

  const sharedPreferences =
    sharedPreferencesResult.data || [];

  const sharedPreferenceMap = new Map(
    sharedPreferences.map((item: any) => [item.schedule_id, item])
  );

  const sharedModeOf = (scheduleId?: string | null) =>
    String(sharedPreferenceMap.get(scheduleId || "")?.mode || "auto");

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

  // Operasyonun tek doğruluk kuralı:
  // aktif şube + aktif grup + aktif seans.
  const allSchedules = filterEffectivelyActiveSchedules(
    rawSchedules,
    branches,
    groups
  );

  const planScope = params.kapsam || "hafta";

  const schedules =
    planScope === "hafta"
      ? allSchedules
      : allSchedules.filter(
          (schedule: any) =>
            Number(schedule.weekday) === selectedWeekday
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
    new Set([
      "Başlangıç",
      "2. Seviye",
      "Orta",
      "İleri",
      "Takım Alt Yapı",
      ...students
        .map(
          (student: any) =>
            student.swimming_level
        )
        .filter(Boolean),
    ])
  ).sort((a, b) =>
    String(a).localeCompare(String(b), "tr")
  );

  /* =======================================================
     SEANS FİLTRELEME
  ======================================================= */

  const scheduleHasAgeMatch = (schedule: any) =>
    memberships
      .filter((membership: any) => membership.group_id === schedule.group_id)
      .some((membership: any) => {
        const enrollment = enrollments.find(
          (item: any) =>
            item.student_id === membership.student_id &&
            item.group_id === schedule.group_id
        );

        if (
          !enrollmentIncludesScheduleDay(
            enrollment,
            Number(schedule.weekday)
          )
        ) {
          return false;
        }

        const student = studentMap.get(membership.student_id);
        return ageMatchesFilter(
          ageOnDate(student?.birth_date, selectedDate),
          params.yas
        );
      });

  const isSharedScheduleCandidate = (schedule: any, source: any[]) => {
    if (sharedModeOf(schedule.id) === "separate") return false;

    const scheduleBranchId =
      schedule.branch_id || groupMap.get(schedule.group_id)?.branch_id || "";

    return source.some((item: any) => {
      if (item.id === schedule.id) return false;
      if (sharedModeOf(item.id) === "separate") return false;

      const itemBranchId =
        item.branch_id || groupMap.get(item.group_id)?.branch_id || "";

      return (
        Number(item.weekday) === Number(schedule.weekday) &&
        String(item.start_time || "").slice(0, 5) ===
          String(schedule.start_time || "").slice(0, 5) &&
        itemBranchId === scheduleBranchId
      );
    });
  };

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

      if (params.yas && !scheduleHasAgeMatch(schedule)) {
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

  const currentView = params.gorunum || "seans";

  if (currentView === "ortak") {
    filteredSchedules = filteredSchedules.filter((schedule: any) =>
      isSharedScheduleCandidate(schedule, filteredSchedules)
    );
  }

  // Görünüm düğmeleri yalnızca aktif renk değiştirmesin; seçilen görünüme
  // göre seansları gerçekten yeniden sırala. Bu sayede mobilde de tıklama
  // sonucunun ekranda net bir karşılığı olur.
  const scheduleCoachName = (schedule: any) => {
    const explicit = staffAssignments.find(
      (assignment: any) =>
        assignment.schedule_id === schedule.id &&
        assignment.coach_id
    );
    const group = groupMap.get(schedule.group_id);
    const coachId =
      explicit?.coach_id ||
      schedule.coach_id ||
      group?.primary_coach_id ||
      "";
    const coach = coachId ? coachMap.get(coachId) : null;
    return String(coach?.full_name || coach?.email || "ZZZ");
  };

  const scheduleFirstLevel = (schedule: any) => {
    const level = memberships
      .filter((item: any) => item.group_id === schedule.group_id)
      .map((item: any) => studentMap.get(item.student_id)?.swimming_level)
      .find(Boolean);
    return String(level || "ZZZ");
  };

  filteredSchedules = [...filteredSchedules].sort((a: any, b: any) => {
    const byDayTime = () => {
      const dayDiff = Number(a.weekday || 0) - Number(b.weekday || 0);
      if (dayDiff !== 0) return dayDiff;
      return String(a.start_time || "").localeCompare(String(b.start_time || ""));
    };

    if (currentView === "egitmen") {
      return (
        scheduleCoachName(a).localeCompare(scheduleCoachName(b), "tr") ||
        byDayTime()
      );
    }

    if (currentView === "grup") {
      return (
        String(groupMap.get(a.group_id)?.name || "").localeCompare(
          String(groupMap.get(b.group_id)?.name || ""),
          "tr"
        ) || byDayTime()
      );
    }

    if (currentView === "seviye") {
      return (
        scheduleFirstLevel(a).localeCompare(scheduleFirstLevel(b), "tr") ||
        byDayTime()
      );
    }

    if (currentView === "yas") {
      const firstAge = (schedule: any) => {
        const ages = memberships
          .filter((item: any) => item.group_id === schedule.group_id)
          .map((item: any) =>
            ageOnDate(studentMap.get(item.student_id)?.birth_date, selectedDate)
          )
          .filter((value: any) => value !== null) as number[];

        return ages.length ? Math.min(...ages) : 999;
      };

      return firstAge(a) - firstAge(b) || byDayTime();
    }

    if (currentView === "havuz") {
      return (
        String(branchMap.get(a.branch_id || groupMap.get(a.group_id)?.branch_id)?.name || "").localeCompare(
          String(branchMap.get(b.branch_id || groupMap.get(b.group_id)?.branch_id)?.name || ""),
          "tr"
        ) || byDayTime()
      );
    }

    if (currentView === "saat") {
      return (
        String(a.start_time || "").localeCompare(String(b.start_time || "")) ||
        Number(a.weekday || 0) - Number(b.weekday || 0)
      );
    }

    return byDayTime();
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

  const shownStudentIds = new Set<string>();

  filteredSchedules.forEach((schedule: any) => {
    memberships
      .filter((membership: any) => membership.group_id === schedule.group_id)
      .forEach((membership: any) => {
        const enrollment = enrollments.find(
          (item: any) =>
            item.student_id === membership.student_id &&
            item.group_id === schedule.group_id
        );

        if (enrollmentIncludesScheduleDay(enrollment, Number(schedule.weekday))) {
          shownStudentIds.add(membership.student_id);
        }
      });
  });

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

  const activeStudentPlans: OperationStudentRow[] = students.map(
    (student: any) => {
      const membership = memberships.find(
        (item: any) => item.student_id === student.id
      );
      const group = membership?.group_id
        ? groupMap.get(membership.group_id)
        : null;
      const branch = group?.branch_id
        ? branchMap.get(group.branch_id)
        : null;
      const activeEnrollment = enrollments.find(
        (item: any) =>
          item.student_id === student.id &&
          item.group_id === membership?.group_id
      );

      const groupSchedules = allSchedules
        .filter(
          (schedule: any) =>
            schedule.group_id === membership?.group_id &&
            enrollmentIncludesScheduleDay(
              activeEnrollment,
              Number(schedule.weekday)
            )
        )
        .sort((a: any, b: any) => {
          const dayDiff =
            Number(a.weekday || 0) -
            Number(b.weekday || 0);
          if (dayDiff !== 0) return dayDiff;
          return String(a.start_time || "").localeCompare(
            String(b.start_time || "")
          );
        });

      const groupScheduleIds = new Set(
        groupSchedules.map((schedule: any) => schedule.id)
      );
      const studentAssignment = studentAssignments.find(
        (assignment: any) =>
          assignment.student_id === student.id &&
          groupScheduleIds.has(assignment.schedule_id) &&
          assignment.coach_id
      );

      const fallbackCoachId =
        group?.primary_coach_id ||
        groupSchedules.find((schedule: any) => schedule.coach_id)
          ?.coach_id ||
        null;

      const coachId =
        studentAssignment?.coach_id ||
        fallbackCoachId ||
        null;
      const coach = coachId
        ? coachMap.get(coachId)
        : null;

      const scheduleText = groupSchedules
        .map((schedule: any) => {
          const day =
            GUNLER[Number(schedule.weekday)] || "Ders";
          const start =
            saatGoster(schedule.start_time);
          const end =
            saatGoster(schedule.end_time);
          return `${day} · ${start}${end !== "—" ? `–${end}` : ""}`;
        })
        .join("\n");

      return {
        id: student.id,
        name: adSoyad(student),
        student_number: student.student_number || null,
        level: student.swimming_level || null,
        group_id: membership?.group_id || null,
        group_name: group?.name || null,
        branch_name: branch?.name || null,
        coach_id: coachId,
        coach_name:
          coach?.full_name ||
          coach?.email ||
          null,
        schedule_text: scheduleText || null,
        guardian_name: student.guardian_name || null,
        guardian_phone: student.guardian_phone || null,
        phone: student.phone || null,
      };
    }
  );

  /* =======================================================
     SEÇİLİ GÜNÜN ORTAK SEANSLARI
  ======================================================= */

  const selectedDaySchedules = allSchedules.filter((schedule: any) => {
    if (sharedModeOf(schedule.id) === "separate") return false;
    if (Number(schedule.weekday) !== selectedWeekday) return false;

    const scheduleBranchId =
      schedule.branch_id || groupMap.get(schedule.group_id)?.branch_id || "";

    if (params.sube && scheduleBranchId !== params.sube) return false;

    if (
      params.saat &&
      String(schedule.start_time || "").slice(0, 5) !== params.saat
    ) {
      return false;
    }

    return true;
  });

  const selectedDaySharedSlotsMap = new Map<string, any[]>();

  selectedDaySchedules.forEach((schedule: any) => {
    const scheduleBranchId =
      schedule.branch_id || groupMap.get(schedule.group_id)?.branch_id || "";
    const key = [
      scheduleBranchId,
      String(schedule.start_time || "").slice(0, 5),
      String(schedule.end_time || "").slice(0, 5),
    ].join("|");

    const rows = selectedDaySharedSlotsMap.get(key) || [];
    rows.push(schedule);
    selectedDaySharedSlotsMap.set(key, rows);
  });

  const selectedDaySharedSlots = Array.from(selectedDaySharedSlotsMap.entries())
    .map(([key, slotSchedules]) => {
      const uniqueGroupSchedules = Array.from(
        new Map(
          slotSchedules
            .filter((schedule: any) => schedule.group_id)
            .map((schedule: any) => [schedule.group_id, schedule])
        ).values()
      );

      if (uniqueGroupSchedules.length < 2) return null;

      const firstSchedule: any = uniqueGroupSchedules[0];
      const branchId =
        firstSchedule.branch_id ||
        groupMap.get(firstSchedule.group_id)?.branch_id ||
        "";
      const branch = branchMap.get(branchId);

      const groupRows = uniqueGroupSchedules.map((slotSchedule: any) => {
        const slotGroup = groupMap.get(slotSchedule.group_id);
        const slotMemberships = memberships.filter(
          (membership: any) =>
            membership.group_id === slotSchedule.group_id
        );

        const dayStudents = slotMemberships
          .map((membership: any) => {
            const enrollment = enrollments.find(
              (item: any) =>
                item.student_id === membership.student_id &&
                item.group_id === slotSchedule.group_id
            );

            if (
              !enrollmentIncludesScheduleDay(
                enrollment,
                Number(slotSchedule.weekday)
              )
            ) {
              return null;
            }

            const student = studentMap.get(membership.student_id);
            if (!student) return null;

            return {
              ...student,
              enrollment,
              age: ageOnDate(student.birth_date, selectedDate),
            };
          })
          .filter(Boolean)
          .sort((a: any, b: any) =>
            adSoyad(a).localeCompare(adSoyad(b), "tr")
          );

        return {
          scheduleId: slotSchedule.id,
          groupId: slotSchedule.group_id,
          groupName: slotGroup?.name || "Grup Atanmamış",
          courseType: slotGroup?.course_type || null,
          capacity: Number(slotGroup?.capacity || 0),
          students: dayStudents,
          sharedMode: sharedModeOf(slotSchedule.id),
        };
      });

      return {
        key,
        branchName: branch?.name || "Şube / havuz",
        startTime: saatGoster(firstSchedule.start_time),
        endTime: saatGoster(firstSchedule.end_time),
        groups: groupRows,
        totalStudents: groupRows.reduce(
          (sum: number, row: any) => sum + row.students.length,
          0
        ),
      };
    })
    .filter(Boolean) as any[];

  function gorunumHref(gorunum: string) {
    const qp = new URLSearchParams();

    qp.set("tarih", selectedDate);
    qp.set("gorunum", gorunum);

    if (params.sube) qp.set("sube", params.sube);
    if (params.saat) qp.set("saat", params.saat);
    if (params.egitmen) qp.set("egitmen", params.egitmen);
    if (params.grup) qp.set("grup", params.grup);
    if (params.seviye) qp.set("seviye", params.seviye);
    if (params.yas) qp.set("yas", params.yas);
    if (params.kapsam) qp.set("kapsam", params.kapsam);

    return `/operasyon-plani?${qp.toString()}`;
  }

  return (
    <>
      <UstGezinme />
      <main style={pageStyle}>
      <div style={containerStyle}>
        {selectedDaySharedSlots.length > 0 ? (
          <section style={dailySharedSectionStyle}>
            <div style={dailySharedHeaderStyle}>
              <div>
                <div style={dailySharedEyebrowStyle}>SEÇİLİ GÜN · ORTAK SEANSLAR</div>
                <strong style={dailySharedTitleStyle}>
                  {GUNLER[selectedWeekday]} günü birlikte çalışan gruplar
                </strong>
                <p style={dailySharedTextStyle}>
                  Yalnız bu günü kayıt sırasında seçmiş öğrenciler gösterilir. İki/üç günlük kayıt ayrımı, seviye ve yaş bilgisi öğrenci satırında görünür.
                </p>
              </div>
              <span style={dailySharedCountStyle}>
                {selectedDaySharedSlots.length} ortak saat
              </span>
            </div>

            <div style={dailySharedGridStyle}>
              {selectedDaySharedSlots.map((slot: any) => (
                <details key={slot.key} style={dailySharedCardStyle}>
                  <summary style={dailySharedSummaryStyle}>
                    <span>
                      <strong style={dailySharedTimeStyle}>
                        {slot.startTime} – {slot.endTime}
                      </strong>
                      <small style={dailySharedPoolStyle}>{slot.branchName}</small>
                    </span>
                    <span style={dailySharedSummaryRightStyle}>
                      <b>{slot.groups.length} grup</b>
                      <small>{slot.totalStudents} öğrenci</small>
                    </span>
                  </summary>

                  <div style={dailySharedBodyStyle}>
                    {allSchedules
                      .filter(
                        (candidate: any) =>
                          sharedModeOf(candidate.id) === "separate" &&
                          Number(candidate.weekday) === selectedWeekday &&
                          String(candidate.start_time || "").slice(0, 5) === slot.startTime &&
                          (candidate.branch_id || groupMap.get(candidate.group_id)?.branch_id) ===
                            allSchedules.find((s: any) => s.id === slot.groups[0]?.scheduleId)?.branch_id
                      )
                      .map((candidate: any) => {
                        const candidateGroup = groupMap.get(candidate.group_id);
                        return (
                          <div key={candidate.id} style={dailySharedSeparatedRowStyle}>
                            <span>
                              <strong>{candidateGroup?.name || "Grup"}</strong>
                              <small>Ayrı tutuluyor · ortak seansa dahil değil</small>
                            </span>
                            {canEdit ? (
                              <form action={ortakSeansModuAyarla}>
                                <input type="hidden" name="schedule_id" value={candidate.id} />
                                <input type="hidden" name="mode" value="shared" />
                                <button type="submit" style={dailySharedJoinButtonStyle}>
                                  Ortak Seansa Al
                                </button>
                              </form>
                            ) : null}
                          </div>
                        );
                      })}

                    {slot.groups.map((groupRow: any) => (
                      <details key={groupRow.scheduleId} style={dailySharedGroupStyle}>
                        <summary style={dailySharedGroupSummaryStyle}>
                          <span>
                            <strong>{groupRow.groupName}</strong>
                            <small>
                              {groupRow.courseType || "Kurs"} · {groupRow.students.length}
                              {groupRow.capacity ? ` / ${groupRow.capacity}` : ""} öğrenci
                            </small>
                          </span>
                          <span style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
                            {canEdit ? (
                              <form action={ortakSeansModuAyarla}>
                                <input type="hidden" name="schedule_id" value={groupRow.scheduleId} />
                                <input type="hidden" name="mode" value="separate" />
                                <button
                                  type="submit"
                                  style={dailySharedSeparateButtonStyle}
                                  title="Bu grubu bu ortak seansın dışında tut"
                                >
                                  Ayrı Tut
                                </button>
                              </form>
                            ) : null}
                            <span style={dailySharedOpenStyle}>Öğrencileri Aç</span>
                          </span>
                        </summary>

                        <div style={dailySharedStudentListStyle}>
                          {groupRow.students.length ? (
                            groupRow.students.map((student: any) => (
                              <div key={student.id} style={dailySharedStudentRowStyle}>
                                <span style={{ minWidth: 0 }}>
                                  <strong style={dailySharedStudentNameStyle}>
                                    {adSoyad(student)}
                                  </strong>
                                  <small style={dailySharedStudentMetaStyle}>
                                    {student.swimming_level || "Seviye yok"}
                                    {" · "}
                                    {student.age !== null ? `${student.age} yaş` : "Yaş bilgisi yok"}
                                    {" · "}
                                    {enrollmentDaysText(student.enrollment)}
                                  </small>
                                </span>
                                <Link
                                  href={`/ogrenciler/${student.id}`}
                                  style={dailySharedStudentLinkStyle}
                                >
                                  Kartı Aç
                                </Link>
                              </div>
                            ))
                          ) : (
                            <div style={smallEmptyStyle}>
                              Bu gün için seçili öğrenci yok.
                            </div>
                          )}
                        </div>
                      </details>
                    ))}
                  </div>
                </details>
              ))}
            </div>
          </section>
        ) : null}

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
            {canEdit ? (
              <Link
                href="/ders-programi"
                style={primaryButtonStyle}
              >
                + Yeni Seans / Program
              </Link>
            ) : null}

            <Link
              href="/yoklama"
              style={secondaryButtonStyle}
            >
              Yoklama
            </Link>

            <Link
              href="/"
              style={secondaryButtonStyle}
            >
              Ana Sayfa
            </Link>
          </div>
        </section>

        <section style={operationCenterStyle}>
          <div style={operationCenterHeaderStyle}>
            <div>
              <div style={operationCenterEyebrowStyle}>HIZLI OPERASYON MERKEZİ</div>
              <strong style={operationCenterTitleStyle}>Bugünün ders ve tesis işlemleri</strong>
              <p style={operationCenterTextStyle}>Havuz kapanışı, yapılmayan ders, telafi ve yeniden başlangıç işlemlerini buradan yönetin. Yapılan işlemler merkezi ders bakiyesine otomatik yansır.</p>
            </div>
            <span style={liveBadgeStyle}>● CANLI</span>
          </div>
          <div style={operationActionGridStyle}>
            <Link href="/tesis-sezon-yonetimi" style={operationActionPrimaryStyle}>
              <span style={operationIconStyle}><Icons.branch /></span>
              <span style={operationActionTextStyle}><b>Havuz / Tesis İşlemleri</b><small>Kapat · hakkı dondur · yeniden başlat · aktar</small></span>
              <span style={operationArrowStyle}>→</span>
            </Link>
            <Link href="/ders-operasyonlari" style={operationActionStyle}>
              <span style={operationIconStyle}><Icons.calendar /></span>
              <span style={operationActionTextStyle}><b>Ders Yapılmadı / Telafi</b><small>Seans iptali · hak düşme · telafi planla</small></span>
              <span style={operationArrowStyle}>→</span>
            </Link>
            <Link href="/yoklama" style={operationActionStyle}>
              <span style={operationIconStyle}><Icons.check /></span>
              <span style={operationActionTextStyle}><b>Yoklama</b><small>Katılımı kaydet · merkezi bakiyeyi güncelle</small></span>
              <span style={operationArrowStyle}>→</span>
            </Link>
          </div>
        </section>

        {/* =================================================
            GÖRÜNÜM / FİLTRE KONTROLÜ
        ================================================= */}

        <section className="opControlPanel" style={controlPanelStyle}>
          <div style={scopeSwitchStyle}>
            <Link
              href={`/operasyon-plani?tarih=${selectedDate}&kapsam=hafta`}
              style={
                planScope === "hafta"
                  ? scopeButtonActiveStyle
                  : scopeButtonStyle
              }
            >
              <span>🗓️</span>
              <span style={scopeTextStyle}>
                <b>Haftalık Planlama</b>
                <small>Tüm aktif seanslar · grup · eğitmen · öğrenci</small>
              </span>
            </Link>

            <Link
              href={`/operasyon-plani?tarih=${selectedDate}&kapsam=gun`}
              style={
                planScope === "gun"
                  ? scopeButtonActiveStyle
                  : scopeButtonStyle
              }
            >
              <span>📅</span>
              <span style={scopeTextStyle}>
                <b>Günlük Seans</b>
                <small>Seçili günün havuz ve yoklama akışı</small>
              </span>
            </Link>

            <Link
              href={`/operasyon-plani?tarih=${selectedDate}&gorunum=ogrenci&kapsam=tumu`}
              style={
                planScope === "tumu"
                  ? scopeButtonActiveStyle
                  : scopeButtonStyle
              }
            >
              <span>👥</span>
              <span style={scopeTextStyle}>
                <b>Tüm Aktif Kursiyerler</b>
                <small>Kalıcı grup · seviye · eğitmen planı</small>
              </span>
            </Link>
          </div>

          <div className="opControlHeader" style={controlPanelHeaderStyle}>
            <div>
              <strong style={controlPanelTitleStyle}>Planı görüntüle</strong>
              <p style={controlPanelTextStyle}>Seansları ihtiyacınıza göre tek dokunuşla gruplayın ve filtreleyin.</p>
            </div>
            <span style={controlDateBadgeStyle}>
              {planScope === "hafta"
                ? "Haftalık aktif plan"
                : `${GUNLER[selectedWeekday]} · ${selectedDate.split("-").reverse().join(".")}`}
            </span>
          </div>
          <div className="opViewBar" style={viewBarStyle}>
          {[
            ["seans", "Seans"],
            ["egitmen", "Eğitmen"],
            ["ogrenci", "Öğrenci"],
            ["grup", "Grup"],
            ["seviye", "Seviye"],
            ["yas", "Yaş / Seviye"],
            ["ortak", "Ortak Gruplar"],
            ["havuz", "Havuz"],
            ["saat", "Saat"],
          ].map(([key, label]) => {
            const active = currentView === key;

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

            if (params.yas)
              qp.set(
                "yas",
                params.yas
              );

            if (params.kapsam)
              qp.set(
                "kapsam",
                params.kapsam
              );

            if (key === "ogrenci") {
              qp.set("kapsam", "tumu");
            } else if (qp.get("kapsam") === "tumu") {
              qp.set("kapsam", planScope === "gun" ? "gun" : "hafta");
            }

            return (
              <Link
                key={key}
                className={active ? "opViewButton isActive" : "opViewButton"}
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
          </div>

          {(currentView === "yas" || currentView === "ortak") ? (
            <details open style={quickViewDetailsStyle}>
              <summary style={quickViewSummaryStyle}>
                <span>
                  <b>
                    {currentView === "ortak"
                      ? "Ortak grup seçimi"
                      : "Yaş / seviye seçimi"}
                  </b>
                  <small style={filterSummaryTextStyle}>
                    {currentView === "ortak"
                      ? " Aynı havuz ve aynı saatte birlikte çalışan grupları açın."
                      : " Yaş aralığı ve seviyeye göre planı daraltın."}
                  </small>
                </span>
                <span style={filterSummaryBadgeStyle}>Seç / Filtrele</span>
              </summary>

              <form method="get" style={quickViewFormStyle}>
                <input type="hidden" name="tarih" value={selectedDate} />
                <input type="hidden" name="gorunum" value={currentView} />
                {params.kapsam ? (
                  <input type="hidden" name="kapsam" value={params.kapsam} />
                ) : null}
                {params.sube ? (
                  <input type="hidden" name="sube" value={params.sube} />
                ) : null}
                {params.saat ? (
                  <input type="hidden" name="saat" value={params.saat} />
                ) : null}

                {currentView === "yas" ? (
                  <>
                    <div style={filterFieldStyle}>
                      <label style={labelStyle}>Yaş Aralığı</label>
                      <select name="yas" defaultValue={params.yas || ""} style={inputStyle}>
                        <option value="">Tüm Yaşlar</option>
                        <option value="3-5">3–5 Yaş</option>
                        <option value="6-8">6–8 Yaş</option>
                        <option value="9-11">9–11 Yaş</option>
                        <option value="12-14">12–14 Yaş</option>
                        <option value="15+">15+ / Yetişkin</option>
                      </select>
                    </div>

                    <div style={filterFieldStyle}>
                      <label style={labelStyle}>Seviye</label>
                      <select name="seviye" defaultValue={params.seviye || ""} style={inputStyle}>
                        <option value="">Tüm Seviyeler</option>
                        {levels.map((level: any) => (
                          <option key={level} value={level}>{level}</option>
                        ))}
                      </select>
                    </div>
                  </>
                ) : (
                  <div style={quickInfoStyle}>
                    <strong>{selectedDaySharedSlots.length} ortak saat</strong>
                    <span>
                      Kartı açtığınızda grupları ve yalnız o güne seçili öğrencileri birlikte görebilirsiniz.
                    </span>
                  </div>
                )}

                <button type="submit" style={filterButtonStyle}>
                  Uygula
                </button>

                <Link
                  href={`/operasyon-plani?tarih=${selectedDate}&gorunum=${currentView}&kapsam=${planScope}`}
                  style={clearButtonStyle}
                >
                  Temizle
                </Link>
              </form>
            </details>
          ) : null}
        </section>

        {/* =================================================
            FİLTRELER
        ================================================= */}

        <details className="opFilterDetails" style={filterDetailsStyle}>
          <summary className="opFilterSummary" style={filterSummaryStyle}>
            <span><b>Filtreler</b><small style={filterSummaryTextStyle}> Tarih · havuz · saat · eğitmen · grup · seviye · yaş</small></span>
            <span style={filterSummaryBadgeStyle}>Aç / Kapat</span>
          </summary>
        <form
          method="get"
          style={filterPanelCompactStyle}
        >
          <input
            type="hidden"
            name="gorunum"
            value={
              params.gorunum ||
              "seans"
            }
          />

          {params.kapsam && (
            <input
              type="hidden"
              name="kapsam"
              value={params.kapsam}
            />
          )}

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

          <div style={filterFieldStyle}>
            <label style={labelStyle}>
              Yaş
            </label>
            <select
              name="yas"
              defaultValue={params.yas || ""}
              style={inputStyle}
            >
              <option value="">Tüm Yaşlar</option>
              <option value="3-5">3–5 Yaş</option>
              <option value="6-8">6–8 Yaş</option>
              <option value="9-11">9–11 Yaş</option>
              <option value="12-14">12–14 Yaş</option>
              <option value="15+">15+ / Yetişkin</option>
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
        </details>

        {params.kapsam === "tumu" && (
          <OperationStudentManager
            students={activeStudentPlans}
            coaches={coaches}
            levels={levels as string[]}
          />
        )}

        {/* =================================================
            ÖZET KARTLARI
        ================================================= */}

        {params.kapsam !== "tumu" && (
        <section className="opCompactSummary" style={compactSummaryStyle}>
          <Link href={gorunumHref("seans")} style={compactStatStyle}><b>{filteredSchedules.length}</b><span>Seans</span></Link>
          <Link href={gorunumHref("egitmen")} style={compactStatStyle}><b>{shownCoachIds.size}</b><span>Eğitmen</span></Link>
          <Link href={gorunumHref("ogrenci")} style={compactStatStyle}><b>{shownStudentIds.size}</b><span>Öğrenci</span></Link>
          <Link href={gorunumHref("grup")} style={compactStatStyle}><b>{shownGroupIds.size}</b><span>Grup</span></Link>
        </section>
        )}

        {/* =================================================
            TARİH BAŞLIĞI
        ================================================= */}

        {params.kapsam !== "tumu" && (
        <section className="opDayTitle" style={dayTitleStyle}>
          <div>
            <span style={dayBadgeStyle}>
              {planScope === "hafta"
                ? "Haftalık"
                : GUNLER[selectedWeekday]}
            </span>

            <strong
              style={{
                marginLeft: 10,
              }}
            >
              {planScope === "hafta"
                ? currentView === "seans"
                  ? "Tüm aktif seans planı"
                  : currentView === "egitmen"
                  ? "Eğitmene göre aktif seans planı"
                  : currentView === "grup"
                  ? "Gruba göre aktif seans planı"
                  : currentView === "seviye"
                  ? "Seviyeye göre aktif seans planı"
                  : currentView === "yas"
                  ? "Yaş ve seviyeye göre aktif seans planı"
                  : currentView === "ortak"
                  ? "Ortak çalışan grup ve seanslar"
                  : currentView === "havuz"
                  ? "Havuza göre aktif seans planı"
                  : currentView === "saat"
                  ? "Saate göre aktif seans planı"
                  : "Tüm aktif seans planı"
                : new Intl.DateTimeFormat(
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
            {filteredSchedules.length} aktif seans
          </span>
        </section>
        )}

        {/* =================================================
            SEANSLAR
        ================================================= */}

        {params.kapsam !== "tumu" && (filteredSchedules.length ===
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
          <section className="opScheduleGrid" style={scheduleGridStyle}>
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
                    .filter((membership: any) => {
                      const enrollment = enrollments.find(
                        (item: any) =>
                          item.student_id === membership.student_id &&
                          item.group_id === schedule.group_id
                      );

                      return enrollmentIncludesScheduleDay(
                        enrollment,
                        Number(schedule.weekday)
                      );
                    })
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

                if (params.yas) {
                  groupStudents = groupStudents.filter((student: any) =>
                    ageMatchesFilter(
                      ageOnDate(student.birth_date, selectedDate),
                      params.yas
                    )
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

                const currentSharedMode = sharedModeOf(schedule.id);
                const sharedSlotSchedules =
                  currentSharedMode === "separate"
                    ? []
                    : filteredSchedules.filter(
                        (item: any) =>
                          item.id !== schedule.id &&
                          sharedModeOf(item.id) !== "separate" &&
                          Number(item.weekday) === Number(schedule.weekday) &&
                          String(item.start_time || "").slice(0, 5) ===
                            String(schedule.start_time || "").slice(0, 5) &&
                          (item.branch_id || groupMap.get(item.group_id)?.branch_id) ===
                            (schedule.branch_id || group?.branch_id)
                      );

                const sharedSlotRows = [schedule, ...sharedSlotSchedules].map(
                  (slotSchedule: any) => {
                    const slotGroup = groupMap.get(slotSchedule.group_id);
                    const slotMemberships = memberships.filter(
                      (membership: any) =>
                        membership.group_id === slotSchedule.group_id
                    );

                    const slotStudents = slotMemberships
                      .filter((membership: any) => {
                        const enrollment = enrollments.find(
                          (item: any) =>
                            item.student_id === membership.student_id &&
                            item.group_id === slotSchedule.group_id
                        );

                        return enrollmentIncludesScheduleDay(
                          enrollment,
                          Number(slotSchedule.weekday)
                        );
                      })
                      .map((membership: any) => studentMap.get(membership.student_id))
                      .filter(Boolean)
                      .sort((a: any, b: any) =>
                        adSoyad(a).localeCompare(adSoyad(b), "tr")
                      );

                    const slotLevels = Array.from(
                      new Set(
                        slotStudents
                          .map((student: any) => student.swimming_level)
                          .filter(Boolean)
                      )
                    );

                    return {
                      scheduleId: slotSchedule.id,
                      groupName: slotGroup?.name || "Grup Atanmamış",
                      courseType: slotGroup?.course_type || null,
                      students: slotStudents,
                      levels: slotLevels,
                      studentCount: slotStudents.length,
                      capacity: Number(slotGroup?.capacity || 0),
                    };
                  }
                );

                const sharedSlotTotalStudents = sharedSlotRows.reduce(
                  (total: number, item: any) => total + item.studentCount,
                  0
                );

                const sharedSlotTotalCapacity = sharedSlotRows.reduce(
                  (total: number, item: any) => total + item.capacity,
                  0
                );

                return (
                  <details
                    key={schedule.id}
                    style={sessionCardStyle}
                    open={filteredSchedules.length === 1}
                  >
                    {/* =====================================
                        SEANS BAŞLIĞI
                    ===================================== */}

                    <summary
                      className="opSessionSummary"
                      style={{
                        ...sessionHeaderStyle,
                        ...sessionSummaryStyle,
                      }}
                    >
                      <div className="opSessionTime" style={sessionTimeBlockStyle}>
                        <strong style={sessionTimeTextStyle}>
                          {saatGoster(schedule.start_time)} – {saatGoster(schedule.end_time)}
                        </strong>
                        <span style={sessionDayTextStyle}>
                          {GUNLER[Number(schedule.weekday)] || "Ders"}
                        </span>
                      </div>

                      <div className="opSessionMeta" style={sessionSummaryItemStyle}>
                        <span style={sessionSummaryLabelStyle}>HAVUZ</span>
                        <strong>{branch?.name || "Şube Belirtilmemiş"}</strong>
                      </div>

                      <div className="opSessionMeta" style={sessionSummaryItemStyle}>
                        <span style={sessionSummaryLabelStyle}>GRUP</span>
                        <strong>{group?.name || "Grup Atanmamış"}</strong>
                        {group?.course_type ? (
                          <small style={sessionSummarySubStyle}>{group.course_type}</small>
                        ) : null}
                      </div>

                      <div className="opSessionMeta" style={sessionSummaryItemStyle}>
                        <span style={sessionSummaryLabelStyle}>EĞİTMEN</span>
                        <strong style={{ color: sessionCoaches.length ? "#13233f" : "#dc2626" }}>
                          {sessionCoaches.length
                            ? sessionCoaches
                                .map((coach: any) => coach.full_name || coach.email || "Eğitmen")
                                .join(", ")
                            : "Eğitmen atanmamış"}
                        </strong>
                      </div>

                      <div className="opSessionMeta" style={sessionSummaryItemStyle}>
                        <span style={sessionSummaryLabelStyle}>ÖĞRENCİ</span>
                        <strong>{groupStudents.length}{capacity ? ` / ${capacity}` : ""}</strong>
                      </div>

                      <div className="opSessionLevels" style={sessionLevelWrapStyle}>
                        {sharedSlotSchedules.length > 0 ? (
                          <span
                            style={{
                              ...levelBadgeStyle,
                              background: "#f3e8ff",
                              borderColor: "#e9d5ff",
                              color: "#7e22ce",
                            }}
                          >
                            Ortak seans · aynı havuz + aynı saat
                          </span>
                        ) : null}
                        {levelsInSession.length ? (
                          levelsInSession.slice(0, 2).map((level: any) => (
                            <span key={level} style={levelBadgeStyle}>{level}</span>
                          ))
                        ) : (
                          <span style={mutedTextStyle}>Seviye yok</span>
                        )}
                      </div>

                      <span className="opSessionChevron" style={sessionChevronStyle}>⌄</span>
                    </summary>

                    {sharedSlotSchedules.length > 0 ? (
                      <section
                        style={{
                          margin: "0 16px 14px",
                          padding: "14px",
                          borderRadius: 14,
                          border: "1px solid #e9d5ff",
                          background: "linear-gradient(135deg,#faf5ff 0%,#ffffff 100%)",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 12,
                            flexWrap: "wrap",
                            marginBottom: 10,
                          }}
                        >
                          <div>
                            <span
                              style={{
                                display: "block",
                                color: "#7e22ce",
                                fontSize: 11,
                                fontWeight: 900,
                                letterSpacing: ".05em",
                              }}
                            >
                              ORTAK SEANS
                            </span>
                            <strong
                              style={{
                                display: "block",
                                marginTop: 2,
                                color: "#2e1065",
                                fontSize: 15,
                              }}
                            >
                              {GUNLER[Number(schedule.weekday)] || "Ders"} · {saatGoster(schedule.start_time)} · {branch?.name || "Havuz"}
                            </strong>
                            <span
                              style={{
                                display: "block",
                                marginTop: 5,
                                color: "#6b7280",
                                fontSize: 12,
                                lineHeight: 1.45,
                              }}
                            >
                              {sharedSlotRows.map((item: any) => item.groupName).join(" + ")} grupları bu saatte birlikte çalışıyor.
                            </span>
                          </div>

                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                              flexWrap: "wrap",
                            }}
                          >
                            <span
                              style={{
                                padding: "6px 9px",
                                borderRadius: 999,
                                background: "#ede9fe",
                                color: "#6d28d9",
                                fontSize: 11,
                                fontWeight: 900,
                              }}
                            >
                              {sharedSlotRows.length} grup
                            </span>
                            <span
                              style={{
                                padding: "6px 9px",
                                borderRadius: 999,
                                background: "#eff6ff",
                                color: "#1d4ed8",
                                fontSize: 11,
                                fontWeight: 900,
                              }}
                            >
                              Toplam {sharedSlotTotalStudents} öğrenci
                            </span>
                          </div>
                        </div>

                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))",
                            gap: 8,
                          }}
                        >
                          {sharedSlotRows.map((item: any) => (
                            <details
                              key={item.scheduleId}
                              style={{
                                borderRadius: 11,
                                border: "1px solid #e5e7eb",
                                background: "#fff",
                                minWidth: 0,
                                overflow: "hidden",
                              }}
                            >
                              <summary
                                style={{
                                  padding: "10px 12px",
                                  cursor: "pointer",
                                  listStyle: "none",
                                  display: "grid",
                                  gridTemplateColumns: "minmax(0,1fr) auto",
                                  gap: 10,
                                  alignItems: "center",
                                }}
                              >
                                <span style={{ minWidth: 0 }}>
                                  <strong
                                    style={{
                                      display: "block",
                                      color: "#1f2937",
                                      fontSize: 13,
                                      lineHeight: 1.35,
                                      overflowWrap: "anywhere",
                                    }}
                                  >
                                    {item.groupName}
                                  </strong>
                                  <span
                                    style={{
                                      display: "block",
                                      marginTop: 4,
                                      color: "#64748b",
                                      fontSize: 11,
                                      fontWeight: 800,
                                    }}
                                  >
                                    {item.studentCount} öğrenci
                                    {item.capacity ? ` · kapasite ${item.capacity}` : ""}
                                    {item.courseType ? ` · ${item.courseType}` : ""}
                                  </span>
                                  <span
                                    style={{
                                      display: "flex",
                                      gap: 5,
                                      flexWrap: "wrap",
                                      marginTop: 7,
                                    }}
                                  >
                                    {item.levels.length ? item.levels.map((level: string) => (
                                      <span
                                        key={level}
                                        style={{
                                          padding: "3px 7px",
                                          borderRadius: 999,
                                          background: "#f8fafc",
                                          border: "1px solid #e2e8f0",
                                          color: "#475569",
                                          fontSize: 10,
                                          fontWeight: 800,
                                        }}
                                      >
                                        {level}
                                      </span>
                                    )) : (
                                      <span style={{ color: "#94a3b8", fontSize: 10 }}>
                                        Seviye bilgisi yok
                                      </span>
                                    )}
                                  </span>
                                </span>
                                <span
                                  style={{
                                    padding: "7px 9px",
                                    borderRadius: 9,
                                    background: "#eef2ff",
                                    color: "#4338ca",
                                    fontSize: 10,
                                    fontWeight: 900,
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  Öğrencileri Aç
                                </span>
                              </summary>

                              <div
                                style={{
                                  padding: "0 12px 12px",
                                  borderTop: "1px solid #f1f5f9",
                                }}
                              >
                                {item.students.length ? (
                                  <div
                                    style={{
                                      display: "grid",
                                      gap: 6,
                                      paddingTop: 10,
                                    }}
                                  >
                                    {item.students.map((student: any) => (
                                      <div
                                        key={student.id}
                                        style={{
                                          display: "flex",
                                          alignItems: "center",
                                          justifyContent: "space-between",
                                          gap: 10,
                                          padding: "8px 9px",
                                          borderRadius: 9,
                                          background: "#f8fafc",
                                        }}
                                      >
                                        <span style={{ minWidth: 0 }}>
                                          <strong
                                            style={{
                                              display: "block",
                                              color: "#1e293b",
                                              fontSize: 12,
                                              overflowWrap: "anywhere",
                                            }}
                                          >
                                            {adSoyad(student)}
                                          </strong>
                                          <small
                                            style={{
                                              display: "block",
                                              marginTop: 2,
                                              color: "#64748b",
                                              fontSize: 10,
                                            }}
                                          >
                                            {student.swimming_level || "Seviye yok"}
                                            {student.student_number ? ` · ${student.student_number}` : ""}
                                          </small>
                                        </span>
                                        <Link
                                          href={`/ogrenciler/${student.id}`}
                                          style={{
                                            padding: "6px 8px",
                                            borderRadius: 8,
                                            border: "1px solid #dbeafe",
                                            background: "#fff",
                                            color: "#1d4ed8",
                                            fontSize: 10,
                                            fontWeight: 900,
                                            textDecoration: "none",
                                            whiteSpace: "nowrap",
                                          }}
                                        >
                                          Kartı Aç
                                        </Link>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <div
                                    style={{
                                      paddingTop: 10,
                                      color: "#94a3b8",
                                      fontSize: 11,
                                    }}
                                  >
                                    Bu gün için seçili öğrenci yok.
                                  </div>
                                )}
                              </div>
                            </details>
                          ))}
                        </div>

                        <div
                          style={{
                            marginTop: 10,
                            paddingTop: 10,
                            borderTop: "1px dashed #d8b4fe",
                            display: "flex",
                            justifyContent: "space-between",
                            gap: 10,
                            flexWrap: "wrap",
                            color: "#5b21b6",
                            fontSize: 12,
                            fontWeight: 900,
                          }}
                        >
                          <span>Birlikte çalışacak öğrenci: {sharedSlotTotalStudents}</span>
                          {sharedSlotTotalCapacity > 0 ? (
                            <span>Toplam kapasite: {sharedSlotTotalCapacity}</span>
                          ) : null}
                        </div>
                      </section>
                    ) : null}

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

                    {canEdit && (
                      <section style={sessionOperationBarStyle}>
                        <div style={sessionOperationHeadStyle}>
                          <div>
                            <strong>Seans İşlemleri</strong>
                            <span>Bu seans için yapılacak işlem tüm bağlı ekranlara merkezi olarak yansır.</span>
                          </div>
                          <span style={sessionReadyBadgeStyle}>Planlı Seans</span>
                        </div>
                        <div style={sessionOperationButtonsStyle}>
                          <Link
                            href={`/ders-operasyonlari?groupId=${schedule.group_id}&scheduleId=${schedule.id}&date=${selectedDate}&mode=cancel`}
                            style={sessionDangerButtonStyle}
                          >
                            <span>×</span>
                            <span><b>Ders Yapılmadı</b><small>Normal hak düşmesin</small></span>
                          </Link>
                          <Link
                            href={`/ders-operasyonlari?groupId=${schedule.group_id}&scheduleId=${schedule.id}&date=${selectedDate}&mode=compensation`}
                            style={sessionPurpleButtonStyle}
                          >
                            <span>↻</span>
                            <span><b>Telafi Planla</b><small>Telafi hakkı / seansı oluştur</small></span>
                          </Link>
                          <Link
                            href={`/yoklama?tarih=${selectedDate}&schedule_id=${schedule.id}`}
                            style={sessionNeutralButtonStyle}
                          >
                            <span>✓</span>
                            <span><b>Yoklamaya Git</b><small>Katılım durumunu kaydet</small></span>
                          </Link>
                        </div>
                      </section>
                    )}

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
                          Eğitmen Ataması
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
                            + Eğitmen Ata
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
                                          Eğitmen seç / kaldır
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
                  </details>
                );
              }
            )}
          </section>
        ))}
        </div>
      </main>
    </>
  );
}

/* =========================================================
   KÜÇÜK BİLEŞENLER
========================================================= */

function SummaryCard({
  label,
  value,
  icon,
  href,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  href: string;
}) {
  return (
    <Link
      href={href}
      style={summaryCardLinkStyle}
      title={`${label} görünümünü aç`}
    >
      <div style={summaryIconStyle}>
        {icon}
      </div>

      <div style={{ flex: 1 }}>
        <span style={summaryLabelStyle}>
          {label}
        </span>

        <strong style={summaryValueStyle}>
          {value}
        </strong>
      </div>

      <span style={summaryArrowStyle}>→</span>
    </Link>
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

const compactSummaryStyle = { display:"grid", gridTemplateColumns:"repeat(4,minmax(0,1fr))", gap:7, margin:"10px 0 12px" } as const;
const compactStatStyle = { display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:2, minHeight:54, background:"#fff", border:"1px solid #dce7f5", borderRadius:13, textDecoration:"none", color:"#13233f" } as const;

const sessionOperationBarStyle = { margin:"14px 0", padding:13, border:"1px solid #dce7f5", borderRadius:15, background:"#f8fbff" } as const;
const sessionOperationHeadStyle = { display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:10, marginBottom:10 } as const;
const sessionReadyBadgeStyle = { fontSize:10, fontWeight:850, color:"#1769e8", background:"#eaf3ff", border:"1px solid #cfe1fb", padding:"6px 8px", borderRadius:999, whiteSpace:"nowrap" } as const;
const sessionOperationButtonsStyle = { display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(170px,1fr))", gap:8 } as const;
const sessionBaseButtonStyle = { display:"flex", alignItems:"center", gap:9, minHeight:54, padding:"9px 11px", borderRadius:12, textDecoration:"none", border:"1px solid #dce7f5", fontSize:12 } as const;
const sessionDangerButtonStyle = { ...sessionBaseButtonStyle, color:"#a43a22", background:"#fff7f3", borderColor:"#ffd5c7" } as const;
const sessionPurpleButtonStyle = { ...sessionBaseButtonStyle, color:"#6d36c9", background:"#f8f4ff", borderColor:"#e2d5ff" } as const;
const sessionNeutralButtonStyle = { ...sessionBaseButtonStyle, color:"#174a87", background:"#fff", borderColor:"#cfe0f5" } as const;

const scopeSwitchStyle = { display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(210px,1fr))", gap:8, marginBottom:12 } as const;
const scopeButtonStyle = { display:"flex", alignItems:"center", gap:10, minHeight:68, padding:"11px 12px", border:"1px solid #dce7f5", borderRadius:13, background:"#f8fbff", color:"#38516f", textDecoration:"none", minWidth:0 } as const;
const scopeTextStyle = { display:"flex", minWidth:0, flexDirection:"column", gap:3, lineHeight:1.25 } as const;
const scopeButtonActiveStyle = { ...scopeButtonStyle, borderColor:"#1769e8", background:"#1769e8", color:"#fff", boxShadow:"0 8px 18px rgba(23,105,232,.18)" } as const;

const controlPanelStyle = { background:"#fff", border:"1px solid #d9e4f2", borderRadius:18, padding:14, marginBottom:12 } as const;
const controlPanelHeaderStyle = { display:"flex", justifyContent:"space-between", alignItems:"center", gap:10, marginBottom:10, flexWrap:"wrap" } as const;
const controlPanelTitleStyle = { fontSize:15, color:"#13233f" } as const;
const controlPanelTextStyle = { margin:"3px 0 0", color:"#718096", fontSize:11 } as const;
const controlDateBadgeStyle = { fontSize:11, fontWeight:800, color:"#1769e8", background:"#eef5ff", padding:"7px 9px", borderRadius:10 } as const;
const filterDetailsStyle = { background:"#fff", border:"1px solid #d9e4f2", borderRadius:18, marginBottom:14, overflow:"hidden" } as const;
const filterSummaryStyle = { display:"flex", justifyContent:"space-between", alignItems:"center", gap:10, padding:"14px 16px", cursor:"pointer", color:"#13233f", fontSize:13 } as const;
const filterSummaryTextStyle = { color:"#7a899f", fontWeight:500 } as const;
const filterSummaryBadgeStyle = { fontSize:10, fontWeight:800, color:"#1769e8", background:"#eef5ff", padding:"6px 8px", borderRadius:9 } as const;
const filterPanelCompactStyle: React.CSSProperties = { display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(155px,1fr))", gap:10, alignItems:"end", background:"#fff", padding:16, border:0, borderTop:"1px solid #edf2f8", borderRadius:0, margin:0, boxShadow:"none" };

const operationCenterStyle = { background: "#fff", border: "1px solid #d9e4f2", borderRadius: 20, padding: 18, marginBottom: 18, boxShadow: "0 8px 28px rgba(31,76,135,.06)" } as const;
const operationCenterHeaderStyle = { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 14 } as const;
const operationCenterEyebrowStyle = { fontSize: 10, fontWeight: 900, letterSpacing: ".12em", color: "#1769e8", marginBottom: 5 } as const;
const operationCenterTitleStyle = { display: "block", fontSize: 18, color: "#13233f" } as const;
const operationCenterTextStyle = { margin: "6px 0 0", color: "#65758d", fontSize: 12, lineHeight: 1.45, maxWidth: 720 } as const;
const liveBadgeStyle = { flexShrink: 0, fontSize: 10, fontWeight: 900, color: "#16824b", background: "#eaf8f0", border: "1px solid #ccebd9", padding: "7px 9px", borderRadius: 999 } as const;
const operationActionGridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 10 } as const;
const operationActionStyle = { minHeight: 72, display: "flex", alignItems: "center", gap: 11, textDecoration: "none", background: "#f8fbff", border: "1px solid #dce7f5", borderRadius: 15, padding: "12px 13px", color: "#13233f" } as const;
const operationActionPrimaryStyle = { ...operationActionStyle, background: "#1769e8", borderColor: "#1769e8", color: "#fff" } as const;
const operationIconStyle = { width: 38, height: 38, borderRadius: 11, display: "grid", placeItems: "center", background: "rgba(255,255,255,.18)", flexShrink: 0 } as const;
const operationActionTextStyle = { display:"flex", minWidth:0, flexDirection:"column", gap:3, lineHeight:1.25 } as const;
const operationArrowStyle = { marginLeft: "auto", fontSize: 20, fontWeight: 800 } as const;

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

const summaryCardLinkStyle: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #e1e8f2",
  borderRadius: 16,
  padding: 16,
  display: "flex",
  alignItems: "center",
  gap: 12,
  textDecoration: "none",
  color: "inherit",
  cursor: "pointer",
  boxShadow: "0 6px 18px rgba(15,23,42,0.035)",
};

const summaryArrowStyle: React.CSSProperties = {
  marginLeft: "auto",
  color: "#1769e8",
  fontSize: 18,
  fontWeight: 900,
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
  // Tek/az seans olduğunda kartın masaüstünde gereksiz dar kalmasını önle.
  // Mobilde min() sayesinde viewport taşması oluşmaz.
  gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,680px),1fr))",
  gap: 18,
};

const sessionCardStyle: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #dfe7f1",
  borderRadius: 16,
  padding: 0,
  overflow: "hidden",
  boxShadow: "0 5px 18px rgba(15,23,42,0.035)",
};

const sessionHeaderStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(120px,.8fr) minmax(170px,1.2fr) minmax(170px,1.2fr) minmax(180px,1.3fr) minmax(100px,.7fr) auto auto",
  alignItems: "center",
  gap: 14,
  padding: "14px 16px",
  borderBottom: "1px solid #edf1f6",
  background: "#fff",
};

const sessionSummaryStyle: React.CSSProperties = {
  cursor: "pointer",
  listStyle: "none",
  WebkitTapHighlightColor: "transparent",
};

const sessionTimeBlockStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 2,
  minWidth: 0,
};

const sessionTimeTextStyle: React.CSSProperties = {
  fontSize: 16,
  color: "#13233f",
  whiteSpace: "nowrap",
};

const sessionDayTextStyle: React.CSSProperties = {
  fontSize: 10,
  color: "#7a899f",
};

const sessionSummaryItemStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 2,
  minWidth: 0,
  fontSize: 12,
};

const sessionSummaryLabelStyle: React.CSSProperties = {
  fontSize: 9,
  fontWeight: 900,
  letterSpacing: ".08em",
  color: "#94a3b8",
};

const sessionSummarySubStyle: React.CSSProperties = {
  fontSize: 10,
  color: "#7a899f",
};

const sessionLevelWrapStyle: React.CSSProperties = {
  display: "flex",
  gap: 5,
  flexWrap: "wrap",
  justifyContent: "flex-end",
};

const sessionChevronStyle: React.CSSProperties = {
  fontSize: 20,
  color: "#1769e8",
  fontWeight: 900,
  lineHeight: 1,
};

const sessionCoachLineStyle: React.CSSProperties = {
  display: "none",
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
  display: "grid",
  gridTemplateColumns: "minmax(min(100%,280px),1fr) auto",
  gap: 10,
  alignItems: "stretch",
};

const compactInputStyle: React.CSSProperties = {
  width: "100%",
  minWidth: 0,
  minHeight: 44,
  border: "1px solid #dce5f2",
  borderRadius: 9,
  padding: "0 10px",
  background: "#fff",
  fontSize: 12,
  flex: 1,
};

const compactPrimaryButtonStyle: React.CSSProperties = {
  minHeight: 44,
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


const dailySharedSectionStyle: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #d9e4f2",
  borderRadius: 20,
  padding: 16,
  marginBottom: 16,
  boxShadow: "0 8px 24px rgba(31,76,135,.05)",
};
const dailySharedHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 12,
  flexWrap: "wrap",
  marginBottom: 12,
};
const dailySharedEyebrowStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 900,
  letterSpacing: ".11em",
  color: "#7e22ce",
  marginBottom: 4,
};
const dailySharedTitleStyle: React.CSSProperties = {
  display: "block",
  color: "#172554",
  fontSize: 16,
};
const dailySharedTextStyle: React.CSSProperties = {
  margin: "4px 0 0",
  color: "#64748b",
  fontSize: 11,
  lineHeight: 1.45,
};
const dailySharedCountStyle: React.CSSProperties = {
  padding: "7px 10px",
  borderRadius: 999,
  background: "#f3e8ff",
  color: "#7e22ce",
  fontSize: 10,
  fontWeight: 900,
  whiteSpace: "nowrap",
};
const dailySharedGridStyle: React.CSSProperties = {
  display: "grid",
  gap: 10,
};
const dailySharedCardStyle: React.CSSProperties = {
  border: "1px solid #e9d5ff",
  borderRadius: 14,
  overflow: "hidden",
  background: "#fcfaff",
};
const dailySharedSummaryStyle: React.CSSProperties = {
  listStyle: "none",
  cursor: "pointer",
  padding: "12px 13px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
};
const dailySharedTimeStyle: React.CSSProperties = {
  display: "block",
  color: "#2e1065",
  fontSize: 15,
};
const dailySharedPoolStyle: React.CSSProperties = {
  display: "block",
  marginTop: 3,
  color: "#64748b",
  fontSize: 10,
};
const dailySharedSummaryRightStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-end",
  gap: 2,
  color: "#6d28d9",
  fontSize: 11,
};
const dailySharedBodyStyle: React.CSSProperties = {
  padding: "0 12px 12px",
  display: "grid",
  gap: 8,
};
const dailySharedGroupStyle: React.CSSProperties = {
  border: "1px solid #e2e8f0",
  borderRadius: 11,
  background: "#fff",
  overflow: "hidden",
};
const dailySharedGroupSummaryStyle: React.CSSProperties = {
  listStyle: "none",
  cursor: "pointer",
  padding: "10px 11px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 10,
};
const dailySharedOpenStyle: React.CSSProperties = {
  padding: "6px 8px",
  borderRadius: 8,
  background: "#eef2ff",
  color: "#4338ca",
  fontSize: 9,
  fontWeight: 900,
  whiteSpace: "nowrap",
};
const dailySharedStudentListStyle: React.CSSProperties = {
  borderTop: "1px solid #f1f5f9",
  padding: 9,
  display: "grid",
  gap: 6,
};
const dailySharedStudentRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 10,
  padding: "8px 9px",
  borderRadius: 9,
  background: "#f8fafc",
};
const dailySharedStudentNameStyle: React.CSSProperties = {
  display: "block",
  color: "#1e293b",
  fontSize: 12,
};
const dailySharedStudentMetaStyle: React.CSSProperties = {
  display: "block",
  marginTop: 2,
  color: "#64748b",
  fontSize: 10,
  lineHeight: 1.35,
};
const dailySharedStudentLinkStyle: React.CSSProperties = {
  padding: "6px 8px",
  borderRadius: 8,
  border: "1px solid #dbeafe",
  background: "#fff",
  color: "#1d4ed8",
  fontSize: 9,
  fontWeight: 900,
  textDecoration: "none",
  whiteSpace: "nowrap",
};


const dailySharedSeparateButtonStyle: React.CSSProperties = {
  border: "1px solid #fecaca",
  background: "#fff7f7",
  color: "#b42318",
  borderRadius: 8,
  padding: "6px 8px",
  fontSize: 9,
  fontWeight: 900,
  cursor: "pointer",
  whiteSpace: "nowrap",
};
const dailySharedJoinButtonStyle: React.CSSProperties = {
  border: "1px solid #bbf7d0",
  background: "#f0fdf4",
  color: "#15803d",
  borderRadius: 8,
  padding: "6px 8px",
  fontSize: 9,
  fontWeight: 900,
  cursor: "pointer",
  whiteSpace: "nowrap",
};
const dailySharedSeparatedRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
  padding: "9px 10px",
  borderRadius: 10,
  border: "1px dashed #fecaca",
  background: "#fffafa",
  color: "#7f1d1d",
  fontSize: 10,
};


const quickViewDetailsStyle: React.CSSProperties = {
  marginTop: 10,
  border: "1px solid #dce7f5",
  borderRadius: 14,
  background: "#f8fbff",
  overflow: "hidden",
};
const quickViewSummaryStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 10,
  padding: "11px 12px",
  cursor: "pointer",
  color: "#13233f",
};
const quickViewFormStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))",
  gap: 9,
  padding: 12,
  borderTop: "1px solid #e7eef7",
  background: "#fff",
  alignItems: "end",
};
const quickInfoStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 3,
  justifyContent: "center",
  minHeight: 40,
  color: "#475569",
  fontSize: 11,
};
