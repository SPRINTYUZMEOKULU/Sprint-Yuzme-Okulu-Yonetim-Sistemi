import { requireProfile } from "@/lib/auth/profile";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import StudentsClient, {
  type StudentListItem,
} from "./students-client";
import "../dashboard.css";

export const dynamic = "force-dynamic";

function createFinanceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Supabase finans bağlantısı yapılandırılmamış.");
  }

  return createAdminClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

type BranchRow = {
  id: string;
  name: string;
};

type GroupRow = {
  id: string;
  branch_id: string | null;
  name: string;
  course_type: string | null;
};

type PackageRow = {
  id: string;
  name: string;
  lesson_count: number | null;
};

export type ScheduleRow = {
  id: string;
  group_id: string | null;
  weekday: number | null;
  start_time: string | null;
  end_time: string | null;
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

function timeText(value?: string | null) {
  return value ? value.slice(0, 5) : "";
}

function toNumber(value: unknown) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}


function elapsedScheduledLessonCount(
  startDate: string | null,
  schedules: ScheduleRow[],
  excludedSessionKeys: Set<string>,
  now = new Date()
) {
  if (!startDate || schedules.length === 0) return 0;
  const start = new Date(startDate + "T00:00:00+03:00");
  if (Number.isNaN(start.getTime()) || start > now) return 0;
  let count = 0;
  const cursor = new Date(start);
  for (let guard = 0; guard < 730 && cursor <= now; guard += 1) {
    const jsWeekday = cursor.getDay();
    const isoWeekday = jsWeekday === 0 ? 7 : jsWeekday;
    const ymd = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit", day: "2-digit" }).format(cursor);
    for (const schedule of schedules) {
      const scheduleWeekday = Number(schedule.weekday);
      // Veritabanındaki mevcut lesson_schedules JS gün numarası kullanıyor:
      // Pazar=0, Pazartesi=1 ... Cumartesi=6. Eski ISO kayıtlarını da tolere et.
      if (scheduleWeekday !== jsWeekday && scheduleWeekday !== isoWeekday) continue;
      const lessonAt = new Date(ymd + "T" + String(schedule.start_time || "00:00").slice(0, 5) + ":00+03:00");
      const sessionKey = ymd + ":" + schedule.id;
      const groupKey = ymd + ":group:" + String(schedule.group_id || "");
      if (lessonAt <= now && !excludedSessionKeys.has(sessionKey) && !excludedSessionKeys.has(groupKey)) count += 1;
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return count;
}

function projectedRemainingEndDate(
  startDate: string | null,
  schedules: ScheduleRow[],
  totalLessons: number
) {
  if (!startDate || totalLessons <= 0 || schedules.length === 0) return null;
  const weekdays = new Set(
    schedules.map((schedule) => Number(schedule.weekday)).filter((day) => day >= 1 && day <= 7)
  );
  if (!weekdays.size) return null;

  const cursor = new Date(startDate + "T12:00:00+03:00");
  if (Number.isNaN(cursor.getTime())) return null;

  let counted = 0;
  for (let guard = 0; guard < 730; guard += 1) {
    const jsWeekday = cursor.getDay();
    const isoWeekday = jsWeekday === 0 ? 7 : jsWeekday;
    if (weekdays.has(jsWeekday) || weekdays.has(isoWeekday)) {
      counted += 1;
      if (counted >= totalLessons) {
        return new Intl.DateTimeFormat("en-CA", {
          timeZone: "Europe/Istanbul",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(cursor);
      }
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return null;
}

function latestByStudent<T extends { student_id?: string | null }>(
  rows: T[]
) {
  const map = new Map<string, T>();

  for (const row of rows) {
    if (!row.student_id || map.has(row.student_id)) continue;
    map.set(row.student_id, row);
  }

  return map;
}

export default async function StudentsPage() {
  const profile = await requireProfile([
    "owner",
    "admin",
    "branch_manager",
    "registration_staff",
    "accounting",
    "coach",
  ]);

  const supabase = await createClient();
  const financeSupabase = createFinanceClient();
  const organizationId = profile.organization_id;

  if (!organizationId) {
    return (
      <main className="operationPage">
        <section className="operationCard">
          <div className="tableEmpty">
            Kullanıcının organizasyon bilgisi bulunamadı.
          </div>
        </section>
      </main>
    );
  }

  const [
    studentsResult,
    branchesResult,
    groupsResult,
    packagesResult,
    schedulesResult,
  ] = await Promise.all([
    supabase
      .from("students")
      .select(
        `
        id,
        first_name,
        last_name,
        student_number,
        status,
        swimming_level,
        branch_id,
        phone,
        guardian_phone,
        guardian_name,
        email,
        guardian_email,
        preferred_group_id,
        preferred_package_id,
        created_at,
        is_deleted
        `
      )
      .eq("organization_id", organizationId)
      .eq("is_deleted", false)
      .order("created_at", { ascending: false })
      .limit(2000),

    supabase
      .from("branches")
      .select("id,name")
      .eq("organization_id", organizationId)
      .eq("is_active", true)
      .order("name"),

    supabase
      .from("training_groups")
      .select("id,branch_id,name,course_type")
      .eq("organization_id", organizationId)
      .eq("is_active", true)
      .order("name"),

    supabase
      .from("course_packages")
      .select("id,name,lesson_count")
      .eq("organization_id", organizationId)
      .eq("is_active", true)
      .order("lesson_count"),

    supabase
      .from("lesson_schedules")
      .select("id,group_id,weekday,start_time,end_time")
      .eq("organization_id", organizationId)
      .eq("is_active", true),
  ]);

  if (studentsResult.error) {
    console.error(
      "Öğrenci listesi yüklenemedi:",
      studentsResult.error
    );
  }

  const students = studentsResult.data || [];
  const studentIds = students.map((student) => student.id);

  const [
    enrollmentsResult,
    membershipsResult,
    attendancePlansResult,
    lessonBalancesResult,
    paymentSummariesResult,
    compensationPlansResult,
    lastAttendanceResult,
    lessonExceptionsResult,
  ] = studentIds.length
    ? await Promise.all([
        supabase
          .from("student_enrollments")
          .select("*")
          .in("student_id", studentIds)
          .eq("status", "active")
          .order("created_at", { ascending: false }),

        supabase
          .from("student_group_memberships")
          .select("*")
          .in("student_id", studentIds)
          .eq("is_active", true)
          .order("started_at", { ascending: false }),

        supabase
          .from("student_attendance_plans")
          .select("*")
          .in("student_id", studentIds)
          .eq("is_active", true)
          .order("created_at", { ascending: false }),

        supabase
          .from("student_lesson_balance")
          .select("*")
          .in("student_id", studentIds),

        financeSupabase
          .from("student_payment_summary")
          .select("*")
          .eq("organization_id", organizationId)
          .in("student_id", studentIds),

        supabase
          .from("student_compensation_lessons")
          .select(
            "id,student_id,status,lesson_date,target_group_id,target_schedule_id"
          )
          .in("student_id", studentIds)
          .eq("status", "planned")
          .order("lesson_date", { ascending: true }),

        supabase
          .from("attendance_records")
          .select("student_id,enrollment_id,schedule_id,lesson_date,status,updated_at")
          .in("student_id", studentIds)
          .order("lesson_date", { ascending: false })
          .order("updated_at", { ascending: false }),

        supabase
          .from("lesson_session_exceptions")
          .select("lesson_date,group_id,schedule_id,exception_type")
          .eq("organization_id", organizationId),
      ])
    : [
        { data: [], error: null },
        { data: [], error: null },
        { data: [], error: null },
        { data: [], error: null },
        { data: [], error: null },
        { data: [], error: null },
        { data: [], error: null },
        { data: [], error: null },
      ];

  const secondaryErrors = [
    enrollmentsResult.error,
    membershipsResult.error,
    attendancePlansResult.error,
    lessonBalancesResult.error,
    paymentSummariesResult.error,
    compensationPlansResult.error,
    lastAttendanceResult.error,
    lessonExceptionsResult.error,
  ].filter(Boolean);

  if (secondaryErrors.length) {
    console.error(
      "Öğrenci Merkezi ek verileri kısmen yüklenemedi:",
      secondaryErrors
    );
  }

  const branches = (branchesResult.data || []) as BranchRow[];
  const groups = (groupsResult.data || []) as GroupRow[];
  const packages = (packagesResult.data || []) as PackageRow[];
  const schedules = (schedulesResult.data || []) as ScheduleRow[];

  const branchMap = new Map(
    branches.map((branch) => [branch.id, branch.name])
  );

  const groupMap = new Map(
    groups.map((group) => [group.id, group])
  );

  const packageMap = new Map(
    packages.map((coursePackage) => [
      coursePackage.id,
      coursePackage,
    ])
  );

  const scheduleMap = new Map(
    schedules.map((schedule) => [schedule.id, schedule])
  );

  const schedulesByGroup = new Map<string, ScheduleRow[]>();

  for (const schedule of schedules) {
    if (!schedule.group_id) continue;

    const current = schedulesByGroup.get(schedule.group_id) || [];
    current.push(schedule);
    schedulesByGroup.set(schedule.group_id, current);
  }

  const enrollmentMap = latestByStudent(
    (enrollmentsResult.data || []) as any[]
  );

  const membershipMap = latestByStudent(
    (membershipsResult.data || []) as any[]
  );

  const attendancePlanMap = latestByStudent(
    (attendancePlansResult.data || []) as any[]
  );

  const lessonBalanceMap = latestByStudent(
    (lessonBalancesResult.data || []) as any[]
  );

  const paymentSummaryMap = latestByStudent(
    (paymentSummariesResult.data || []) as any[]
  );

  const plannedCompensationCount = new Map<string, number>();
  const nextCompensationMap = new Map<string, any>();

  for (const row of (compensationPlansResult.data || []) as any[]) {
    if (!row.student_id) continue;

    plannedCompensationCount.set(
      row.student_id,
      (plannedCompensationCount.get(row.student_id) || 0) + 1
    );

    if (!nextCompensationMap.has(row.student_id)) {
      nextCompensationMap.set(row.student_id, row);
    }
  }

  const lastAttendanceMap = new Map<string, any>();
  const lastAbsentMap = new Map<string, any>();
  const attendanceUsedCountMap = new Map<string, number>();

  for (const row of (lastAttendanceResult.data || []) as any[]) {
    if (!row.student_id) continue;

    if (
      row.enrollment_id &&
      row.status !== "compensation"
    ) {
      const key = String(row.enrollment_id);
      attendanceUsedCountMap.set(key, (attendanceUsedCountMap.get(key) || 0) + 1);
    }

    if (!lastAttendanceMap.has(row.student_id)) {
      lastAttendanceMap.set(row.student_id, row);
    }

    if (row.status === "absent" && !lastAbsentMap.has(row.student_id)) {
      lastAbsentMap.set(row.student_id, row);
    }
  }

  const preparedStudents: StudentListItem[] = students.map(
    (student) => {
      const enrollment = enrollmentMap.get(student.id) as any;
      const membership = membershipMap.get(student.id) as any;
      const attendancePlan = attendancePlanMap.get(student.id) as any;
      const lessonBalance = lessonBalanceMap.get(student.id) as any;
      const paymentSummary = paymentSummaryMap.get(student.id) as any;
      const lastAttendance = lastAttendanceMap.get(student.id) as any;
      const lastAbsent = lastAbsentMap.get(student.id) as any;
      const nextCompensation = nextCompensationMap.get(student.id) as any;
      const nextCompensationSchedule = nextCompensation?.target_schedule_id
        ? scheduleMap.get(nextCompensation.target_schedule_id)
        : undefined;
      const nextCompensationGroup = nextCompensation?.target_group_id
        ? groupMap.get(nextCompensation.target_group_id)
        : undefined;

      // Aktif enrollment kalan ders hesabının sahibi ve authoritative grup kaynağıdır.
      // Eski membership kaydı öne alınırsa öğrenci kartı güncel olmayan grubun seanslarını
      // kullanıp kalan hakkı sabit gösterebiliyordu.
      const groupId =
        enrollment?.group_id ??
        attendancePlan?.group_id ??
        membership?.group_id ??
        student.preferred_group_id ??
        null;

      const selectedGroup = groupId
        ? groupMap.get(groupId)
        : undefined;

      const branchId =
        selectedGroup?.branch_id ??
        student.branch_id ??
        enrollment?.branch_id ??
        null;

      const packageId =
        enrollment?.package_id ??
        student.preferred_package_id ??
        null;

      const selectedPackage = packageId
        ? packageMap.get(packageId)
        : undefined;

      const normalTotal = toNumber(
        enrollment?.total_lessons ??
          selectedPackage?.lesson_count ??
          0
      );

      const storedUsedLessons = toNumber(enrollment?.used_lessons ?? 0);
      const attendanceUsedLessons = enrollment?.id
        ? attendanceUsedCountMap.get(String(enrollment.id)) || 0
        : 0;

      const compensationBalance = Math.max(
        toNumber(
          lessonBalance?.compensation_lesson_balance ??
            plannedCompensationCount.get(student.id) ??
            0
        ),
        0
      );

      const regularSchedules = groupId
        ? schedulesByGroup.get(groupId) || []
        : [];

      const enrollmentWeekdays = Array.isArray(enrollment?.lesson_weekdays)
        ? enrollment.lesson_weekdays.map((day: unknown) => Number(day)).filter(
            (day: number) => Number.isInteger(day) && day >= 1 && day <= 7
          )
        : [];
      const planWeekdays = Array.isArray(attendancePlan?.selected_weekdays)
        ? attendancePlan.selected_weekdays.map((day: unknown) => Number(day)).filter(
            (day: number) => Number.isInteger(day) && day >= 1 && day <= 7
          )
        : [];
      // Kayıt üzerindeki günler, tarih bazlı hak hesabında birincil kaynaktır.
      // Attendance plan yalnız kayıt günleri yoksa fallback olur.
      // lesson_schedules.weekday ISO gün numarası (Pzt=1 ... Paz=7) kullanır.
      // Eski enrollment.lesson_weekdays kayıtlarının bir kısmı JS gün numarasıyla
      // tutulduğu için burada filtrelemek aktif seansları tamamen silebiliyordu.
      // Kalan ders hesabının authoritative kaynağı mevcut grubun aktif seanslarıdır.
      const selectedWeekdays = planWeekdays.length > 0 ? planWeekdays : enrollmentWeekdays;
      const studentSchedules = regularSchedules;

      // Tarih bazlı normal hak: zamanı geçmiş planlı seanslar tüketir.
      // Yoklama, aynı seansı ikinci kez tüketmez; yalnız geçmiş veri için güvenli alt sınırdır.
      // Bu hesap salt-okunurdur ve enrollment başlangıç/bitiş tarihlerini değiştirmez.
      const excludedSessionKeys = new Set<string>();
      for (const exception of lessonExceptionsResult.data || []) {
        const date = String(exception.lesson_date || "");
        if (exception.schedule_id) excludedSessionKeys.add(date + ":" + String(exception.schedule_id));
        if (exception.group_id) excludedSessionKeys.add(date + ":group:" + String(exception.group_id));
      }
      const elapsedScheduledLessons = elapsedScheduledLessonCount(
        enrollment?.start_date ?? attendancePlan?.start_date ?? null,
        studentSchedules,
        excludedSessionKeys
      );
      const usedLessons = Math.min(
        normalTotal,
        Math.max(storedUsedLessons, attendanceUsedLessons, elapsedScheduledLessons)
      );
      // Kayıtlı normal bitiş tarihi authoritative kalır. Tarih geçtiyse normal paket
      // artık aktif hak değildir; kartta kalan hak 0 görünmelidir. Bu yalnız görüntü/
      // hesap katmanıdır, kayıtlı tarih veya used_lessons alanına yazmaz.
      const authoritativeEndDate = attendancePlan?.normal_planned_end_date ?? enrollment?.planned_end_date ?? null;
      const endOfEnrollment = authoritativeEndDate ? new Date(authoritativeEndDate + "T23:59:59+03:00") : null;
      const enrollmentEnded = Boolean(endOfEnrollment && !Number.isNaN(endOfEnrollment.getTime()) && new Date() > endOfEnrollment);
      const normalRemaining = enrollmentEnded ? 0 : Math.max(normalTotal - usedLessons, 0);
      const totalRemaining = normalRemaining + compensationBalance;

      const scheduleText = studentSchedules
        .slice()
        .sort((a, b) => {
          const dayA = Number(a.weekday || 0);
          const dayB = Number(b.weekday || 0);

          if (dayA !== dayB) return dayA - dayB;

          return String(a.start_time || "").localeCompare(
            String(b.start_time || "")
          );
        })
        .map((schedule) => {
          const day =
            DAY_NAMES[Number(schedule.weekday)] || "Ders";
          const start = timeText(schedule.start_time);
          const end = timeText(schedule.end_time);

          return `• ${day} — ${start}${
            end ? `–${end}` : ""
          }`.trim();
        })
        .join("\n");

      const startDate =
        attendancePlan?.start_date ??
        enrollment?.start_date ??
        null;

      const normalEndDate =
        attendancePlan?.normal_planned_end_date ??
        enrollment?.planned_end_date ??
        null;

      const compensationEndDate =
        attendancePlan?.compensation_planned_end_date ??
        normalEndDate;

      // Kalan ders bitişi, kayıt başlangıcını değiştirmeden yoklama + kayıt
      // verilerinden bulunan gerçek kullanılan hakkı düşer ve bugünden sonraki
      // aktif seanslarda yalnızca kalan normal dersleri projekte eder.
      const remainingLessonEndDate = projectedRemainingEndDate(
        new Intl.DateTimeFormat("en-CA", {
          timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit", day: "2-digit",
        }).format(new Date()),
        studentSchedules,
        normalRemaining
      );

      const paymentStatus =
        paymentSummary?.payment_status ??
        paymentSummary?.status ??
        null;

      const outstandingBalance = toNumber(
        paymentSummary?.outstanding_balance ??
          paymentSummary?.remaining_amount ??
          paymentSummary?.balance_due ??
          0
      );

      return {
        id: student.id,
        student_number: student.student_number || null,

        first_name: student.first_name || "",
        last_name: student.last_name || "",

        status: student.status || null,
        swimming_level: student.swimming_level || null,

        branch_id: branchId,
        branch_name: branchId
          ? branchMap.get(branchId) || null
          : null,

        group_id: groupId,
        group_name: selectedGroup?.name || null,
        course_type: selectedGroup?.course_type || null,

        package_name: selectedPackage?.name || null,
        package_lesson_count: normalTotal,

        compensation_lessons: compensationBalance,
        planned_compensation_lessons:
          plannedCompensationCount.get(student.id) || 0,

        used_lessons: usedLessons,
        normal_remaining_lessons: normalRemaining,
        total_remaining_lessons: totalRemaining,
        remaining_lessons: totalRemaining,

        schedule_text: scheduleText || null,
        schedule_weekdays: studentSchedules
          .map((schedule) => Number(schedule.weekday))
          .filter((day) => Number.isInteger(day)),
        schedule_slots: studentSchedules.map((schedule) => ({
          id: schedule.id,
          weekday: Number(schedule.weekday),
          start_time: schedule.start_time || null,
          end_time: schedule.end_time || null,
        })),

        start_date: startDate,
        normal_end_date: normalEndDate,
        compensation_end_date: compensationEndDate,
        end_date: compensationEndDate,
        remaining_lesson_end_date: remainingLessonEndDate,

        phone: student.phone || null,
        guardian_phone: student.guardian_phone || null,
        guardian_name: student.guardian_name || null,
        email: student.email || null,
        guardian_email: student.guardian_email || null,

        payment_status: paymentStatus,
        payment_total_received: toNumber(
          paymentSummary?.total_received ?? 0
        ),
        payment_outstanding: outstandingBalance,
        last_payment_at:
          paymentSummary?.last_payment_at ?? null,

        last_attendance_date:
          lastAttendance?.lesson_date ?? null,
        last_attendance_status:
          lastAttendance?.status ?? null,
        last_absent_date:
          lastAbsent?.lesson_date ?? null,

        next_compensation_date:
          nextCompensation?.lesson_date ?? null,
        next_compensation_group:
          nextCompensationGroup?.name ?? null,
        next_compensation_start_time:
          nextCompensationSchedule?.start_time ?? null,
        next_compensation_end_time:
          nextCompensationSchedule?.end_time ?? null,

        created_at: student.created_at || null,
      };
    }
  );

  return (
    <main className="operationPage">
      <header className="operationHeader">
        <div>
          <p>SPRİNTOS · ÖĞRENCİ YÖNETİMİ</p>

          <h1>Öğrenci Merkezi</h1>

          <span>
            Öğrenci, iletişim, ders hakkı, telafi, kayıt yenileme
            ve ödeme takibini tek merkezden yönetin.
          </span>
        </div>
      </header>

      {studentsResult.error ? (
        <section className="operationCard">
          <div className="tableEmpty">
            Öğrenci listesi şu anda yüklenemedi.
          </div>
        </section>
      ) : (
        <StudentsClient
          students={preparedStudents}
          branches={branches}
          groups={groups}
          schedules={schedules}
        />
      )}
    </main>
  );
}
