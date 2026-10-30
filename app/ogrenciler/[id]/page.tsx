import { attendanceSummary, loadStudentAttendance } from "@/lib/students/attendance-summary";
import PassiveStudentGuard from "@/app/components/passive-student-guard";
import {StudentNoteFollowUps,StudentNoteFollowUp} from "@/app/components/student-note-follow-up";
import { compensationEndDate as plannedCompensationEndDate } from "@/lib/students/compensation-message";
import CompensationPlanEditor from "./compensation-plan-editor";
import CommunicationSummary from "./communication-summary";
import { formatDisplayDateTime, formatDisplayDate } from "@/lib/dates/display";
import { studentLessonRights } from "@/lib/students/lesson-rights";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import {
  addStudentNote,
  deleteStudentNote,
  deleteRegistrationNote,
  updateRegistrationNote,
  updateStudentNote,
  updateStudentHealthAndConsents,
  updateStudentProfile,
} from "./actions";
import StudentFileOperations from "./student-file-operations";
import StudentStatusButton from "./student-status-button";
import PendingSubmitButton from "./pending-submit-button";
import "./student-detail.css";
import "./compensation-plan.css";

export const dynamic = "force-dynamic";

function MessageBody({ body }: { body?: string | null }) {
  const text = body || "Mesaj metni kaydedilmemiş.";
  if (text.length <= 180) return <p className="contactMessageText">{text}</p>;
  return (
    <details className="contactMessageDetails">
      <summary>
        <p className="contactMessagePreview">{text.slice(0, 180)}…</p>
        <b className="contactMessageExpand">Tamamını gör</b>
        <b className="contactMessageCollapse">Daralt</b>
      </summary>
      <p className="contactMessageText">{text}</p>
    </details>
  );
}

const fmt = (value?: string | null) => {
  if (!value) return "—";

  try {
    return formatDisplayDateTime(new Date(value));
  } catch {
    return value;
  }
};

const fmtDate = (value?: string | null) => {
  if (!value) return "—";

  try {
    return formatDisplayDate(new Date(value));
  } catch {
    return value;
  }
};

/*
 * PostgreSQL tarafında yeni student_attendance_plans tablosunda
 * 1=Pazartesi ... 7=Pazar kullanıyoruz.
 *
 * Eski enrollment.lesson_weekdays alanında ise
 * 0=Pazar ... 6=Cumartesi kullanılmış olabilir.
 */
const isoDays: Record<number, string> = {
  1: "Pazartesi",
  2: "Salı",
  3: "Çarşamba",
  4: "Perşembe",
  5: "Cuma",
  6: "Cumartesi",
  7: "Pazar",
};

const oldDays: Record<number, string> = {
  0: "Pazar",
  1: "Pazartesi",
  2: "Salı",
  3: "Çarşamba",
  4: "Perşembe",
  5: "Cuma",
  6: "Cumartesi",
};

function money(value: unknown) {
  const amount = Number(value ?? 0);

  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
  }).format(Number.isFinite(amount) ? amount : 0);
}

function ageFromBirthDate(value?: string | null) {
  if (!value) return null;
  const [year, month, day] = String(value).slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return null;

  const today = new Date();
  let age = today.getFullYear() - year;
  const birthdayPassed =
    today.getMonth() + 1 > month ||
    (today.getMonth() + 1 === month && today.getDate() >= day);

  if (!birthdayPassed) age -= 1;
  return age >= 0 && age <= 120 ? age : null;
}

export default async function StudentFile({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const profile = await requireProfile([
    "owner",
    "admin",
    "branch_manager",
    "registration_staff",
    "accounting",
    "coach",
  ]);

  const { id } = await params;
  const query = await searchParams;

  const supabase = await createClient();

  const canManageDestructiveActions = ["owner", "admin"].includes(
    String((profile as any).role || ""),
  );

  /*
   * =========================================================
   * ANA ÖĞRENCİ VERİLERİ
   * =========================================================
   */

  const [
    studentResult,
    enrollmentResult,
    membershipResult,
    attendancePlanResult,
    lessonBalanceResult,
    notesResult,
    oldTimelineResult,
    activityResult,
    messagesResult,
    contactLogsResult,
    lessonLedgerResult,
    paymentSummaryResult,
    paymentsResult,
    coachReportsResult,
    enrollmentHistoryResult,
    attendanceResult,
    consentResult,
  ] = await Promise.all([
    supabase.from("students").select("*").eq("id", id).single(),

    supabase
      .from("student_enrollments")
      .select("*")
      .eq("student_id", id)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),

    supabase
      .from("student_group_memberships")
      .select("*")
      .eq("student_id", id)
      .eq("is_active", true)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle(),

    supabase
      .from("student_attendance_plans")
      .select("*")
      .eq("student_id", id)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),

    supabase
      .from("student_lesson_balance")
      .select("*")
      .eq("student_id", id)
      .maybeSingle(),

    supabase
      .from("student_notes")
      .select("id,note_type,body,is_guardian_visible,created_at,author_id")
      .eq("student_id", id)
      .order("created_at", { ascending: false })
      .limit(20),

    supabase
      .from("student_timeline_events")
      .select("id,event_type,title,description,event_date")
      .eq("student_id", id)
      .order("event_date", { ascending: false })
      .limit(30),

    supabase
      .from("student_activity_logs")
      .select("*")
      .eq("student_id", id)
      .order("performed_at", { ascending: false })
      .limit(50),

    supabase
      .from("message_logs")
      .select("id,template_key,channel,status,message_body,prepared_at,sent_at,recipient,metadata")
      .eq("student_id", id)
      .order("prepared_at", { ascending: false })
      .limit(20),

    supabase
      .from("student_contact_logs")
      .select("*")
      .eq("student_id", id)
      .order("created_at", { ascending: false })
      .limit(30),

    supabase
      .from("student_lesson_ledger")
      .select("*")
      .eq("student_id", id)
      .order("created_at", { ascending: false })
      .limit(50),

    supabase
      .from("student_payment_summary")
      .select("*")
      .eq("student_id", id)
      .maybeSingle(),

    supabase
      .from("student_payments")
      .select("*")
      .eq("student_id", id)
      .order("received_at", { ascending: false })
      .limit(30),

    supabase
      .from("student_coach_reports")
      .select("*")
      .eq("student_id", id)
      .order("submitted_at", { ascending: false })
      .limit(30),

    supabase
      .from("student_enrollments")
      .select("*")
      .eq("organization_id", profile.organization_id)
      .eq("student_id", id)
      .order("created_at", { ascending: false })
      .limit(100),

    loadStudentAttendance(supabase, profile.organization_id, [id], "id,organization_id,branch_id,student_id,enrollment_id,group_id,schedule_id,coach_id,lesson_date,status,coach_note,recorded_by,updated_by,edited_at,created_at,updated_at"),

    supabase
      .from("registration_consents")
      .select(
        "student_id,health_declaration,health_note,rules_accepted,whatsapp_permission,accepted_at,form_snapshot",
      )
      .eq("student_id", id)
      .maybeSingle(),
  ]);

  const student = studentResult.data;


  if (!student) {
    notFound();
  }

  const studentAge = ageFromBirthDate(student.birth_date);
  const canManageCompensation = ["owner", "admin", "branch_manager"].includes(String(profile.role));
  const enrollment = enrollmentResult.data;
  const membership = membershipResult.data;
  const attendancePlan = attendancePlanResult.data?.enrollment_id === enrollment?.id ? attendancePlanResult.data : null;
  const nextEnrollment = (enrollmentHistoryResult.data || []).find((row: any) => row.status === "scheduled");
  const lessonBalance = lessonBalanceResult.data;

  const notes = notesResult.data ?? [];
  const oldTimeline = oldTimelineResult.data ?? [];
  const activityLogs = activityResult.data ?? [];
  const registrationNotes = activityLogs.filter(
    (item: any) => item.activity_type === "registration_note",
  );
  const operationalActivityLogs = activityLogs.filter(
    (item: any) => !["registration_note", "student_note_reminder"].includes(item.activity_type),
  );
  const messages = messagesResult.data ?? [];
  const contactLogs = contactLogsResult.data ?? [];
  const lessonLedger = lessonLedgerResult.data ?? [];
  const paymentSummary = paymentSummaryResult.data;
  const payments = paymentsResult.data ?? [];
  const coachReports = coachReportsResult.data ?? [];
  const enrollmentHistory = enrollmentHistoryResult.data ?? [];
  const attendanceRecords = attendanceResult.data ?? [];
  const currentAttendanceSummary = attendanceResult.error ? null : attendanceSummary(attendanceRecords, enrollment);
  const consent = consentResult.data;

  const [
    operationBranchesResult,
    operationGroupsResult,
    operationSchedulesResult,
  ] = await Promise.all([
    supabase
      .from("branches")
      .select("id,name")
      .eq("organization_id", profile.organization_id)
      .eq("is_active", true)
      .order("name"),

    supabase
      .from("training_groups")
      .select("id,branch_id,name,course_type")
      .eq("organization_id", profile.organization_id)
      .eq("is_active", true)
      .order("name"),

    supabase
      .from("lesson_schedules")
      .select("id,group_id,weekday,start_time,end_time")
      .eq("organization_id", profile.organization_id)
      .eq("is_active", true)
      .order("weekday")
      .order("start_time"),
  ]);

  const operationBranches = operationBranchesResult.data ?? [];
  const operationGroups = operationGroupsResult.data ?? [];
  const operationSchedules = operationSchedulesResult.data ?? [];

  /*
   * =========================================================
   * GEÇMİŞ KAYIT / YOKLAMA REFERANSLARI
   * =========================================================
   *
   * İlişkisel select isimlerine güvenmek yerine ID'leri ayrı
   * sorguluyoruz. Böylece mevcut veritabanı yapısını bozmadan
   * geçmiş kayıtlar için grup, şube, paket ve eğitmen adlarını
   * ekranda gösterebiliyoruz.
   */

  const historyGroupIds = Array.from(
    new Set(
      [
        ...enrollmentHistory.map((item: any) => item.group_id),
        ...attendanceRecords.map((item: any) => item.group_id),
      ].filter(Boolean),
    ),
  ) as string[];

  const historyBranchIds = Array.from(
    new Set(
      [
        ...enrollmentHistory.map((item: any) => item.branch_id),
        ...attendanceRecords.map((item: any) => item.branch_id),
      ].filter(Boolean),
    ),
  ) as string[];

  const historyPackageIds = Array.from(
    new Set(
      enrollmentHistory.map((item: any) => item.package_id).filter(Boolean),
    ),
  ) as string[];

  const historyCoachIds = Array.from(
    new Set(
      [
        ...enrollmentHistory.map((item: any) => item.coach_id),
        ...attendanceRecords.map((item: any) => item.coach_id),
      ].filter(Boolean),
    ),
  ) as string[];

  const [
    historyGroupsResult,
    historyBranchesResult,
    historyPackagesResult,
    historyCoachesResult,
  ] = await Promise.all([
    historyGroupIds.length
      ? supabase
          .from("training_groups")
          .select("id,name,course_type,branch_id")
          .in("id", historyGroupIds)
      : Promise.resolve({ data: [] as any[] }),

    historyBranchIds.length
      ? supabase.from("branches").select("id,name").in("id", historyBranchIds)
      : Promise.resolve({ data: [] as any[] }),

    historyPackageIds.length
      ? supabase
          .from("course_packages")
          .select("id,name,lesson_count")
          .in("id", historyPackageIds)
      : Promise.resolve({ data: [] as any[] }),

    historyCoachIds.length
      ? supabase
          .from("profiles")
          .select("id,full_name")
          .in("id", historyCoachIds)
      : Promise.resolve({ data: [] as any[] }),
  ]);

  const historyGroupMap = new Map(
    (historyGroupsResult.data ?? []).map((item: any) => [item.id, item]),
  );

  const allBranchIds = Array.from(
    new Set([
      ...historyBranchIds,
      ...(historyGroupsResult.data ?? [])
        .map((item: any) => item.branch_id)
        .filter(Boolean),
    ]),
  ) as string[];

  let allHistoryBranches = historyBranchesResult.data ?? [];

  if (allBranchIds.length > historyBranchIds.length) {
    const { data } = await supabase
      .from("branches")
      .select("id,name")
      .in("id", allBranchIds);

    allHistoryBranches = data ?? allHistoryBranches;
  }

  const historyBranchMap = new Map(
    allHistoryBranches.map((item: any) => [item.id, item]),
  );

  const historyPackageMap = new Map(
    (historyPackagesResult.data ?? []).map((item: any) => [item.id, item]),
  );

  const historyCoachMap = new Map(
    (historyCoachesResult.data ?? []).map((item: any) => [item.id, item]),
  );

  /*
   * =========================================================
   * GRUP
   * Öncelik:
   * enrollment.group_id
   * membership.group_id
   * attendancePlan.group_id
   * =========================================================
   */

  const groupId =
    enrollment?.group_id ??
    membership?.group_id ??
    attendancePlan?.group_id ??
    null;

  let groupInfo: any = null;

  if (groupId) {
    const { data } = await supabase
      .from("training_groups")
      .select("*")
      .eq("id", groupId)
      .maybeSingle();

    groupInfo = data;
  }

  /*
   * =========================================================
   * ŞUBE
   *
   * ARTIK .limit(1) YOK.
   *
   * Öncelik:
   * grubun branch_id
   * öğrencinin branch_id
   * kayıt branch_id
   * =========================================================
   */

  const branchId =
    groupInfo?.branch_id ?? student.branch_id ?? enrollment?.branch_id ?? null;

  let branchInfo: any = null;

  if (branchId) {
    const { data } = await supabase
      .from("branches")
      .select("*")
      .eq("id", branchId)
      .maybeSingle();

    branchInfo = data;
  }

  /*
   * =========================================================
   * PAKET
   * =========================================================
   */

  let packageInfo: any = null;

  if (enrollment?.package_id) {
    const { data } = await supabase
      .from("course_packages")
      .select("*")
      .eq("id", enrollment.package_id)
      .maybeSingle();

    packageInfo = data;
  }

  /*
   * =========================================================
   * EĞİTMEN
   * =========================================================
   */

  const coachId = groupInfo?.primary_coach_id ?? enrollment?.coach_id ?? null;

  let coachName = "—";

  if (coachId) {
    const { data } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", coachId)
      .maybeSingle();

    coachName = data?.full_name || "—";
  }

  /*
   * =========================================================
   * DERS HESAPLARI
   * =========================================================
   */

  const [compensationsResult,cancellationsResult,cancellationSchedulesResult,scheduledUsageResult]=await Promise.all([
    supabase.from("student_compensation_lessons").select("id,enrollment_id,lesson_date,status,note,target_schedule_id,target_group_id")
      .eq("organization_id",profile.organization_id).eq("student_id",id).order("lesson_date"),
    supabase.from("student_activity_logs").select("source_id,old_value,new_value")
      .eq("organization_id",profile.organization_id).eq("student_id",id).eq("activity_type","lesson_cancellation_compensation"),
    supabase.from("lesson_schedules").select("id,group_id,start_time,end_time").eq("organization_id",profile.organization_id),
    enrollment?.id ? supabase.rpc("scheduled_used_lessons",{p_enrollment_id:enrollment.id}) : Promise.resolve({data:0,error:null})
  ]);
  const plannedCompensations=compensationsResult.data||[];
  const rightsAvailable=!compensationsResult.error&&!cancellationsResult.error&&!cancellationSchedulesResult.error&&!scheduledUsageResult.error;
  const clock=new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Istanbul",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(new Date());
  const part=(type:string)=>clock.find(p=>p.type===type)?.value||"";
  const normalTotal = Number(
    enrollment?.total_lessons ?? packageInfo?.lesson_count ?? 0,
  );

  const rights=studentLessonRights({total:normalTotal,
    scheduledUsed:Number(rightsAvailable?scheduledUsageResult.data:enrollment?.used_lessons||0),
    legacyCompensation:Number(lessonBalance?.compensation_lesson_balance||0),enrollment,
    compensations:rightsAvailable?plannedCompensations:[],cancellations:rightsAvailable?cancellationsResult.data||[]:[],
    schedules:cancellationSchedulesResult.data||[],today:`${part("year")}-${part("month")}-${part("day")}`,time:`${part("hour")}:${part("minute")}`});
  const usedLessons=rights.used;
  const normalRemaining=rights.normal;
  const compensationBalance=rights.compensation;
  const totalRights=rights.total;

  const packagePrice = Number(
    packageInfo?.price ??
      packageInfo?.amount ??
      packageInfo?.package_price ??
      packageInfo?.sale_price ??
      enrollment?.package_price ??
      0,
  );

  const activeEnrollmentPayments = payments.filter(
    (payment: any) =>
      (!enrollment?.id || payment.enrollment_id === enrollment.id) &&
      payment.payment_status !== "cancelled",
  );

  const activeEnrollmentTotalReceived = activeEnrollmentPayments.reduce(
    (sum: number, payment: any) => sum + Number(payment.amount || 0),
    0,
  );

  const activeEnrollmentRemainingPayment = Math.max(
    0,
    packagePrice - activeEnrollmentTotalReceived,
  );

  /*
   * =========================================================
   * TARİHLER
   * =========================================================
   */

  const startDate =
    attendancePlan?.start_date ?? enrollment?.start_date ?? null;

  const normalEndDate =
    attendancePlan?.normal_planned_end_date ??
    enrollment?.planned_end_date ??
    null;

  const compensationEndDate = rightsAvailable ? plannedCompensationEndDate(normalEndDate, plannedCompensations.filter((row:any)=>enrollment?.status!=="completed"||row.enrollment_id===enrollment?.id)) : attendancePlan?.compensation_planned_end_date ?? normalEndDate;

  /*
   * =========================================================
   * KATILIM GÜNLERİ
   * =========================================================
   */

  let attendanceDays = "—";

  if (
    Array.isArray(attendancePlan?.selected_weekdays) &&
    attendancePlan.selected_weekdays.length > 0
  ) {
    attendanceDays = attendancePlan.selected_weekdays
      .map((day: number) => isoDays[day] ?? String(day))
      .join(" • ");
  } else if (
    Array.isArray(enrollment?.lesson_weekdays) &&
    enrollment.lesson_weekdays.length > 0
  ) {
    attendanceDays = enrollment.lesson_weekdays
      .map((day: number) => oldDays[day] ?? String(day))
      .join(" • ");
  }

  const weeklyFrequency =
    attendancePlan?.weekly_frequency ??
    (Array.isArray(enrollment?.lesson_weekdays)
      ? enrollment.lesson_weekdays.length
      : null);

  const activeGroupName = String(groupInfo?.name || "");
  const groupWords = new Set(
    (activeGroupName.match(/[A-Za-zÇĞİÖŞÜçğıöşü]+/g) || [])
      .map((word) => word.toLocaleLowerCase("tr-TR")),
  );
  const groupDays = Object.entries(isoDays)
    .filter(([, day]) => groupWords.has(day.toLocaleLowerCase("tr-TR")))
    .map(([day]) => Number(day)).sort();
  const planDays = Array.isArray(attendancePlan?.selected_weekdays)
    ? attendancePlan.selected_weekdays.map(Number).sort()
    : Array.isArray(enrollment?.lesson_weekdays)
      ? enrollment.lesson_weekdays.map((day: number) => day === 0 ? 7 : day).sort()
      : [];
  const programMismatch = Boolean(groupDays.length && planDays.length &&
    groupDays.join(",") !== planDays.join(","));

  /*
   * =========================================================
   * UYARI
   * =========================================================
   */

  const warningClass =
    totalRights <= 0 ? "danger" : normalRemaining <= 2 ? "warning" : "success";

  const paymentDueDate =
    enrollment?.payment_due_date ?? enrollment?.start_date ?? null;
  const paymentDueTimestamp = paymentDueDate
    ? new Date(paymentDueDate).getTime()
    : Number.NaN;
  const paymentOverdue = Boolean(
    Number.isFinite(paymentDueTimestamp) &&
    activeEnrollmentRemainingPayment > 0 &&
    paymentDueTimestamp < Date.now(),
  );

  const smartAlerts = [
    paymentOverdue
      ? {
          tone: "danger",
          title: "Ödeme vadesi geçti",
          description: `${activeEnrollmentRemainingPayment.toLocaleString("tr-TR")} TL tahsilat bekliyor.`,
          target: "odeme",
        }
      : null,
    !activeEnrollmentPayments.length && packagePrice > 0
      ? {
          tone: "warning",
          title: "Henüz ödeme kaydı yok",
          description:
            "Bu aktif kayıt dönemi için ödeme hareketi oluşturulmamış.",
          target: "odeme",
        }
      : null,
    normalRemaining <= 3
      ? {
          tone: normalRemaining <= 0 ? "danger" : "warning",
          title:
            normalRemaining <= 0
              ? "Ders hakkı bitti"
              : `${normalRemaining} ders kaldı`,
          description:
            "Kayıt yenileme ve veli bilgilendirmesi kontrol edilmelidir.",
          target: "ders-hareketleri",
        }
      : null,
    !groupInfo?.id
      ? {
          tone: "warning",
          title: "Grup ataması eksik",
          description:
            "Öğrencinin aktif grubu ve ders programı belirlenmelidir.",
          target: "kurs-kaydi",
        }
      : null,
    !student.guardian_phone && !student.phone
      ? {
          tone: "danger",
          title: "Telefon bilgisi eksik",
          description: "Veli iletişimi ve bildirim gönderimi yapılamaz.",
          target: "genel-bilgiler",
        }
      : null,
  ].filter(Boolean) as Array<{
    tone: string;
    title: string;
    description: string;
    target: string;
  }>;

  return (
    <PassiveStudentGuard status={student.status} name={`${student.first_name} ${student.last_name}`}><main className="studentFilePage" data-active-file-tab="general">
      {/* =====================================================
          ÜST KART
          ===================================================== */}

      <header className="studentHero">
        <div className="avatar">
          {student.first_name?.[0]}
          {student.last_name?.[0]}
        </div>

        <div className="heroText">
          <p>DİJİTAL KURSİYER DOSYASI</p>

          <h1>
            {student.first_name} {student.last_name}
          </h1>

          <div className="heroBadges">
            <StudentStatusButton key={`${student.id}:${student.status}`} studentId={student.id}
              name={`${student.first_name} ${student.last_name}`} status={student.status}
              canApprove={canManageDestructiveActions} />

            <span className="ageBadge">
              {studentAge != null ? `${studentAge} yaş` : "Yaş bilgisi yok"}
            </span>

            <span>{branchInfo?.name || "Şube atanmadı"}</span>

            <span>{activeGroupName || "Grup atanmadı"}</span>
            {programMismatch ? <span>Katılım: {attendanceDays}</span> : null}
          </div>
        </div>

        <Link className="backButton" href="/ogrenciler">
          ← Öğrencilere Dön
        </Link>
      </header>

      <StudentFileOperations
        student={{
          id: student.id,
          first_name: student.first_name,
          last_name: student.last_name,
          phone: student.phone,
          guardian_phone: student.guardian_phone,
          email: student.email,
          guardian_name: student.guardian_name,
          guardian_email: student.guardian_email,
          general_note: student.general_note,
          status: student.status,
          branch_id: branchInfo?.id ?? student.branch_id ?? null,
          branch_name: branchInfo?.name ?? null,
          group_id: groupInfo?.id ?? null,
          group_name: activeGroupName || null,
        }}
        enrollmentId={enrollment?.id ?? null}
        activeWeekdays={planDays}
        totalReceived={activeEnrollmentTotalReceived}
        remainingPayment={activeEnrollmentRemainingPayment}
        paymentDueDate={fmtDate(
          enrollment?.payment_due_date ?? enrollment?.start_date,
        )}
        branches={operationBranches}
        groups={operationGroups}
        schedules={operationSchedules}
      />

      {programMismatch ? (
        <div className="notice errorNotice" role="status">
          Grup adı ile aktif katılım günleri farklı. Grup / Şube Değiştir bölümünde uygun grubu kontrol edip kaydedin.
        </div>
      ) : null}

      {query.saved === "registration" ? (
        <div className="notice successNotice" role="status" aria-live="polite">
          <strong>✓ Kayıt kesinleşti.</strong> {student.first_name}{" "}
          {student.last_name} aktif öğrenci kaydına alındı
          {activeGroupName ? ` ve ${activeGroupName} grubuna aktarıldı` : ""}.
          Ders planı ve kayıt bilgileri başarıyla oluşturuldu.
        </div>
      ) : query.saved ? (
        <div className="notice successNotice">İşlem başarıyla kaydedildi.</div>
      ) : null}

      {query.error && <div className="notice errorNotice">{query.error}</div>}

      <section
        className="smartAlertPanel"
        aria-label="Akıllı öğrenci uyarıları"
      >
        <div className="smartAlertHead">
          <div>
            <p>AKILLI DOSYA KONTROLÜ</p>
            <h2>Bildirimler ve yapılacak işlemler</h2>
          </div>
          <strong>
            {smartAlerts.length
              ? `${smartAlerts.length} işlem bekliyor`
              : "✓ Her şey yolunda"}
          </strong>
        </div>

        {smartAlerts.length ? (
          <div className="smartAlertGrid">
            {smartAlerts.map((alert) => (
              <a
                key={`${alert.title}-${alert.target}`}
                href={`#${alert.target}`}
                className={alert.tone}
                data-open-file-tab={
                  alert.target === "genel-bilgiler"
                    ? "general"
                    : alert.target === "kurs-kaydi"
                      ? "registration"
                      : "lessons"
                }
                data-target-id={alert.target}
              >
                <i>{alert.tone === "danger" ? "!" : "•"}</i>
                <span>
                  <b>{alert.title}</b>
                  <small>{alert.description}</small>
                </span>
                <em>İşlemi Aç →</em>
              </a>
            ))}
          </div>
        ) : (
          <div className="smartAlertEmpty">
            Bu öğrenci için açık ödeme, program veya iletişim uyarısı
            bulunmuyor.
          </div>
        )}
      </section>

      {/* =====================================================
          DERS ÖZETİ
          ===================================================== */}

      <section className="panel" data-file-panel="registration" aria-label="Bu kayıt döneminin yoklaması">
        {currentAttendanceSummary ? <p>Yoklama · Bu dönem: <b>Geldi: {currentAttendanceSummary.present}</b> · <b>Gelmedi: {currentAttendanceSummary.absent}</b> · <b>İzinli: {currentAttendanceSummary.excused}</b></p> : <p>Yoklama özeti yüklenemedi.</p>}
      </section>

      <section className="metricGrid" data-file-panel="registration">
        <article>
          <span>Normal Ders</span>
          <strong>{normalTotal}</strong>
        </article>

        <article>
          <span title="Katılım durumundan bağımsız hesaplanır">Tamamlanan Ders</span>
          <strong>{usedLessons}</strong>
        </article>

        <article>
          <span>Normal Kalan</span>
          <strong>{normalRemaining}</strong>
        </article>

        <article>
          <span>Telafi</span>
          <strong>+{compensationBalance}</strong>
        </article>

        <article>
          <span>Toplam Kalan</span>
          <strong>{totalRights}</strong>
        </article>

        <article>
          <span>Normal Bitiş</span>
          <strong>{fmtDate(normalEndDate)}</strong>
        </article>

        <article>
          <span>Telafili Bitiş</span>
          <strong>{fmtDate(compensationEndDate)}</strong>
        </article>
      </section>

      {/* =====================================================
          GENEL BİLGİLER + KURS ÖZETİ
          ===================================================== */}

      <div className="twoColumn" id="genel-bilgiler">
        <section className="panel" id="duzenle" data-file-panel="general">
          <div className="panelHead">
            <div>
              <p>GENEL BİLGİLER</p>
              <h2>Öğrenci ve veli bilgileri</h2>
            </div>
          </div>

          <form action={updateStudentProfile} className="formGrid">
            {["first_name","last_name","birth_date","email","guardian_email"].map(name=><input key={name} type="hidden" name={name} value={student[name] || ""} />)}
            <input type="hidden" name="student_id" value={student.id} />

            <label>
              Telefon
              <input name="phone" defaultValue={student.phone || ""} />
            </label>

            <label>
              Veli Adı Soyadı
              <input
                name="guardian_name"
                defaultValue={student.guardian_name || ""}
              />
            </label>

            <label>
              Veli Telefonu
              <input
                name="guardian_phone"
                defaultValue={student.guardian_phone || ""}
              />
            </label>

            <label>
              Acil Durum Kişisi
              <input
                name="emergency_contact_name"
                defaultValue={student.emergency_contact_name || ""}
              />
            </label>

            <label>
              Acil Durum Telefonu
              <input
                name="emergency_contact_phone"
                defaultValue={student.emergency_contact_phone || ""}
              />
            </label>

            <label className="full">
              Genel Not
              <textarea
                name="general_note"
                rows={3}
                defaultValue={student.general_note || ""}
              />
            </label>

            <label className="full reminderField">
              Genel Not Hatırlatma Tarihi / Saati (isteğe bağlı)
              <input name="general_note_reminder_at" type="datetime-local" />
              <small>Tarih seçmezseniz genel not yalnızca öğrenci dosyasında saklanır.</small>
            </label>

            <PendingSubmitButton
              className="primaryButton"
              pendingText="Bilgiler kaydediliyor…"
            >
              Bilgileri Kaydet
            </PendingSubmitButton>
          </form>
        </section>

        <aside className="panel courseCard" id="kurs-kaydi" data-file-panel="registration">
          <div className="panelHead">
            <div>
              <p>KURS ÖZETİ</p>
              <h2>Aktif kayıt</h2>
            {nextEnrollment ? <p role="status">Sonraki dönem hazır: {fmtDate(nextEnrollment.start_date)} – {fmtDate(nextEnrollment.planned_end_date)}. Başlangıç tarihinde otomatik olarak bu özete alınacak.</p> : null}
            </div>
          </div>

          <div className="infoRows">
            <div>
              <span>Yaş</span>
              <strong>{studentAge != null ? `${studentAge} yaş` : "—"}</strong>
            </div>

            <div>
              <span>Şube</span>
              <strong>{branchInfo?.name || "—"}</strong>
            </div>

            <div>
              <span>Grup</span>
              <strong>{activeGroupName || "—"}</strong>
            </div>

            <div>
              <span>Kurs Türü</span>
              <strong>{groupInfo?.course_type || "—"}</strong>
            </div>

            <div>
              <span>Paket</span>
              <strong>
                {packageInfo?.name ||
                  (normalTotal ? `${normalTotal} Ders` : "—")}
              </strong>
            </div>

            <div>
              <span>Eğitmen</span>
              <strong>{coachName}</strong>
            </div>

            <div>
              <span>Haftalık Katılım</span>
              <strong>
                {weeklyFrequency ? `${weeklyFrequency} gün` : "—"}
              </strong>
            </div>

            <div>
              <span>Katılım Günleri</span>
              <strong>{attendanceDays}</strong>
            </div>

            <div>
              <span>Başlangıç</span>
              <strong>{fmtDate(startDate)}</strong>
            </div>

            <div>
              <span>Normal Bitiş</span>
              <strong>{fmtDate(normalEndDate)}</strong>
            </div>

            <div>
              <span>Telafili Bitiş</span>
              <strong>{fmtDate(compensationEndDate)}</strong>
            </div>
          </div>
        </aside>
      </div>

      {/* =====================================================
          SAĞLIK
          ===================================================== */}

      <section className="panel" id="saglik" data-file-panel="health">
        <div className="panelHead">
          <div>
            <p>SAĞLIK BİLGİLERİ</p>
            <h2>Güvenlik ve sağlık notları</h2>
          </div>
        </div>

        <form
          action={updateStudentHealthAndConsents}
          className="formGrid healthGrid"
        >
          <input type="hidden" name="student_id" value={student.id} />

          <label>
            Alerji
            <textarea
              name="allergy_note"
              rows={3}
              defaultValue={student.allergy_note || ""}
            />
          </label>

          <label>
            Kronik Rahatsızlık
            <textarea
              name="chronic_condition_note"
              rows={3}
              defaultValue={student.chronic_condition_note || ""}
            />
          </label>

          <label>
            Kullanılan İlaçlar
            <textarea
              name="medication_note"
              rows={3}
              defaultValue={student.medication_note || ""}
            />
          </label>

          <label>
            Acil Müdahale Notu
            <textarea
              name="emergency_medical_note"
              rows={3}
              defaultValue={student.emergency_medical_note || ""}
            />
          </label>

          <label className="full">
            Ön kayıt sağlık açıklaması
            <textarea
              name="health_note"
              rows={3}
              defaultValue={consent?.health_note || ""}
              placeholder="Veli/kursiyer tarafından bildirilen sağlık açıklaması"
            />
          </label>

          <div className="full healthConsentBox">
            <strong>Sağlık ve kayıt beyanları</strong>
            <label className="checkbox">
              <input
                type="checkbox"
                name="health_declaration"
                defaultChecked={Boolean(consent?.health_declaration)}
              />
              Sağlık beyanı alındı
            </label>
            <label className="checkbox">
              <input
                type="checkbox"
                name="rules_accepted"
                defaultChecked={Boolean(consent?.rules_accepted)}
              />
              Kurallar okundu ve kabul edildi
            </label>
            <label className="checkbox">
              <input
                type="checkbox"
                name="whatsapp_permission"
                defaultChecked={Boolean(consent?.whatsapp_permission)}
              />
              WhatsApp bilgilendirme izni alındı
            </label>
            <label className="checkbox managementConfirmation">
              <input type="checkbox" name="management_confirmed" required />
              Veli/kursiyer beyanını yönetim olarak teyit ediyorum
            </label>
            <small>
              {consent?.accepted_at
                ? `Son beyan kaydı: ${fmt(consent.accepted_at)}`
                : "Bu öğrenci için henüz beyan kaydı bulunmuyor."}
            </small>
          </div>

          <PendingSubmitButton
            className="primaryButton"
            pendingText="Sağlık ve beyanlar kaydediliyor…"
          >
            Sağlık ve Beyanları Kaydet
          </PendingSubmitButton>
        </form>
      </section>

      {/* =====================================================
          ÖDEME
          ===================================================== */}

      <section className="panel" id="odeme" data-file-panel="finance">
        <div className="panelHead">
          <div>
            <p>FİNANS</p>
            <h2>Ödeme durumu</h2>
          </div>

          <strong>
            Toplam Tahsilat: {money(paymentSummary?.total_received)}
          </strong>
        </div>

        <div className="list">
          {payments.map((payment: any) => (
            <article key={payment.id}>
              <div>
                <strong>{money(payment.amount)}</strong>

                <p>
                  {payment.payment_method || "Ödeme"}
                  {payment.description ? ` • ${payment.description}` : ""}
                </p>
              </div>

              <span>
                {payment.payment_status} • {fmt(payment.received_at)}
              </span>
            </article>
          ))}

          {!payments.length && <p className="empty">Henüz ödeme kaydı yok.</p>}
        </div>
      </section>

      {/* =====================================================
          YOKLAMA / KATILDIĞI DERSLER
          ===================================================== */}

      <section className="panel" id="yoklama" data-file-panel="attendance">
        <div className="panelHead">
          <div>
            <p>YOKLAMA GEÇMİŞİ</p>
            <h2>Katıldığı ve işlenen dersler</h2>
          </div>

          <strong>Toplam Kayıt: {attendanceRecords.length}</strong>
        </div>

        <div className="list">
          {attendanceRecords.map((record: any) => {
            const statusLabel =
              record.status === "present"
                ? "✓ Geldi"
                : record.status === "absent"
                  ? "✕ Gelmedi"
                  : record.status === "excused"
                    ? "○ İzinli"
                    : record.status === "compensation"
                      ? "+ Telafi"
                      : record.status || "—";

            const group = record.group_id
              ? historyGroupMap.get(record.group_id)
              : null;

            const branchIdForRecord =
              record.branch_id ?? group?.branch_id ?? null;

            const branch = branchIdForRecord
              ? historyBranchMap.get(branchIdForRecord)
              : null;

            const coach = record.coach_id
              ? historyCoachMap.get(record.coach_id)
              : null;

            const consumesPackage =
              record.status === "present" ||
              record.status === "absent" ||
              record.status === "excused";

            return (
              <article key={record.id}>
                <div>
                  <strong>{statusLabel}</strong>

                  <p>
                    {fmtDate(record.lesson_date)}
                    {branch?.name ? ` • ${branch.name}` : ""}
                    {group?.name ? ` • ${group.name}` : ""}
                    {coach?.full_name ? ` • ${coach.full_name}` : ""}
                    {record.coach_note ? ` • Not: ${record.coach_note}` : ""}
                  </p>
                </div>

                <span>
                  {consumesPackage
                    ? "Paket ders hakkından düşer"
                    : record.status === "compensation"
                      ? "Normal paket hakkından düşmez"
                      : "—"}
                </span>
              </article>
            );
          })}

          {!attendanceRecords.length && (
            <p className="empty">Henüz yoklama kaydı bulunmuyor.</p>
          )}
        </div>
      </section>

      {/* =====================================================
          TELAFİ / DERS HAREKETLERİ
          ===================================================== */}

      <section className="panel" id="ders-hareketleri" data-file-panel="lessons">
        <div className="panelHead">
          <div>
            <p>DERS HAREKETLERİ</p>
            <h2>Normal ders ve telafi geçmişi</h2>
          </div>
        </div>

        <div className="list">
          {!rightsAvailable && <p className="empty">Telafi bilgileri doğrulanamadı. Sayfayı yenileyip kontrol edin.</p>}
          {plannedCompensations.map((item:any)=>{
            const schedule=cancellationSchedulesResult.data?.find((row:any)=>row.id===item.target_schedule_id);
            const targetGroup=operationGroups.find((row:any)=>row.id===(schedule?.group_id||item.target_group_id));
            const targetBranch=operationBranches.find((row:any)=>row.id===targetGroup?.branch_id);
            const notice=messages.find((row:any)=>row.template_key==="compensation_plan_change"&&row.metadata?.compensation_id===item.id&&row.status!=="cancelled"&&row.metadata?.current_plan?.date===item.lesson_date&&row.metadata?.current_plan?.schedule_id===item.target_schedule_id&&Boolean(row.metadata?.current_plan?.cancelled)===(item.status==="cancelled"));
            return <article key={`planned-${item.id}`} className="compensationCard">
              <div className="compensationCardHead"><div><small>TELAFİ DERSİ</small><h3>{fmtDate(item.lesson_date)}{schedule?.start_time?` · ${String(schedule.start_time).slice(0,5)}–${String(schedule.end_time).slice(0,5)}`:""}</h3></div><span className={`compensationStatus ${item.status}`}>{item.status==="planned"?"Planlandı":item.status==="completed"?"Tamamlandı":"İptal edildi"}</span></div>
              <div className="compensationLocation">{[targetBranch?.name,targetGroup?.name].filter(Boolean).join(" · ")||"Seans bilgisi"}</div>
              {item.note&&<details className="compensationSource"><summary>Kaynak ders ve açıklama</summary><p>{item.note}</p></details>}
              {canManageCompensation&&<CompensationPlanEditor studentId={student.id} id={item.id} date={item.lesson_date} status={item.status} canPrepare={activityLogs.some((row:any)=>row.source_id===item.id&&["compensation_cancelled","compensation_rescheduled"].includes(row.activity_type))} notification={notice?{id:notice.id,body:notice.message_body,recipient:notice.recipient||"",status:notice.status}:null} schedules={operationSchedules} groups={operationGroups} branches={operationBranches}/>}
            </article>;
          })}
          {lessonLedger.map((item: any) => (
            <article key={item.id}>
              <div>
                <strong>
                  {item.lesson_type === "compensation"
                    ? "TELAFİ"
                    : "NORMAL DERS"}{" "}
                  {item.direction === "credit" ? "+" : "-"}
                  {item.lesson_count}
                </strong>

                <p>{item.reason || item.description || "Ders hareketi"}</p>
              </div>

              <span>
                {item.approval_status} •{" "}
                {fmt(item.approved_at ?? item.created_at)}
              </span>
            </article>
          ))}

          {!lessonLedger.length && !plannedCompensations.length && (
            <p className="empty">Henüz ders hareketi yok.</p>
          )}
        </div>
      </section>

      {/* =====================================================
          ANTRENÖR RAPORLARI
          ===================================================== */}

      <section className="panel" data-file-panel="lessons">
        <div className="panelHead">
          <div>
            <p>ANTRENÖR RAPORLARI</p>
            <h2>Gelişim, seviye ve grup uyumu</h2>
          </div>
        </div>

        <div className="list">
          {coachReports.map((report: any) => (
            <article key={report.id}>
              <div>
                <strong>{report.title}</strong>

                <p>{report.description}</p>
              </div>

              <span>
                {report.severity} • {report.management_status} •{" "}
                {fmt(report.submitted_at)}
              </span>
            </article>
          ))}

          {!coachReports.length && (
            <p className="empty">Henüz antrenör raporu yok.</p>
          )}
        </div>
      </section>

      {/* =====================================================
          KAYIT / YENİLEME GEÇMİŞİ
          ===================================================== */}

      <section className="panel" data-file-panel="registration">
        <div className="panelHead">
          <div>
            <p>KAYIT GEÇMİŞİ</p>
            <h2>Paketler ve kayıt yenilemeleri</h2>
          </div>

          <strong>Toplam Kayıt: {enrollmentHistory.length}</strong>
        </div>

        <div className="list">
          {enrollmentHistory.map((item: any) => {
            const group = item.group_id
              ? historyGroupMap.get(item.group_id)
              : null;

            const branchIdForEnrollment =
              item.branch_id ?? group?.branch_id ?? null;

            const branch = branchIdForEnrollment
              ? historyBranchMap.get(branchIdForEnrollment)
              : null;

            const packageItem = item.package_id
              ? historyPackageMap.get(item.package_id)
              : null;

            const coach = item.coach_id
              ? historyCoachMap.get(item.coach_id)
              : null;

            const total = Number(
              item.total_lessons ?? packageItem?.lesson_count ?? 0,
            );

            const used = Number(item.used_lessons ?? 0);
            const remaining = Math.max(0, total - used);

            const statusLabel =
              item.status === "active"
                ? "AKTİF"
                : item.status === "scheduled"
                  ? "SONRAKİ DÖNEM · OTOMATİK BAŞLAYACAK"
                : item.status === "completed"
                  ? "TAMAMLANDI"
                  : item.status === "cancelled"
                    ? "İPTAL"
                    : item.status
                      ? String(item.status).toUpperCase()
                      : "—";

            return (
              <article key={item.id}>
                <div>
                  <strong>
                    {packageItem?.name ||
                      (total ? `${total} Derslik Paket` : "Kayıt")}
                    {" • "}
                    {statusLabel}
                  </strong>

                  <p>
                    {branch?.name || "Şube bilgisi yok"}
                    {" • "}
                    {group?.name || "Grup bilgisi yok"}
                    {coach?.full_name ? ` • ${coach.full_name}` : ""}
                  </p>

                  <p>
                    Başlangıç: {fmtDate(item.start_date)}
                    {" • "}
                    Planlanan Bitiş: {fmtDate(item.planned_end_date)}
                  </p>
                </div>

                <span>
                  {used} kullanıldı • {remaining} kaldı
                </span>
              </article>
            );
          })}

          {!enrollmentHistory.length && (
            <p className="empty">Henüz kayıt geçmişi bulunmuyor.</p>
          )}
        </div>
      </section>

      {/* =====================================================
          NOTLAR + İŞLEM GEÇMİŞİ
          ===================================================== */}

      <div className="twoColumn">
        <section className="panel" id="notlar" data-file-panel="notes">
          <div className="panelHead">
            <div>
              <p>NOTLAR</p>
              <h2>Antrenör ve yönetim notları</h2>
            </div>
          </div>

          <CommunicationSummary studentId={student.id} organizationId={profile.organization_id!}/>
          <form action={addStudentNote} className="noteForm">
            <input type="hidden" name="student_id" value={student.id} />

            <select name="note_type">
              <option value="general">Genel</option>

              <option value="coach">Antrenör</option>

              <option value="health">Sağlık</option>

              <option value="finance">Finans</option>

              <option value="crm">CRM</option>
            </select>

            <textarea
              name="body"
              rows={4}
              placeholder="Yeni not yazın..."
              required
            />

            <label className="reminderField">
              Hatırlatma Tarihi / Saati (isteğe bağlı)
              <input name="reminder_at" type="datetime-local" />
              <small>Boş bırakırsanız yalnızca normal öğrenci notu olarak kaydedilir.</small>
            </label>

            <label className="checkbox">
              <input type="checkbox" name="is_guardian_visible" /> Veli
              panelinde paylaş ve bildirim oluştur
            </label>

            <PendingSubmitButton
              className="primaryButton"
              pendingText="Not ekleniyor…"
            >
              Notu Ekle
            </PendingSubmitButton>
          </form>

          <StudentNoteFollowUps studentId={student.id}><div className="list">
            {notes.map((note: any) => (
              <article key={note.id} className="managedNote">
                <div>
                  <strong>{String(note.note_type).toUpperCase()}</strong><small style={{display:"block",marginTop:6,color:note.is_guardian_visible?"#087443":"#66758a"}}>{note.is_guardian_visible?"Alıcı: bağlı portal velileri · Mesajlar ekranında görünür":"Kurum içi · Yalnızca yetkili personel görür"}</small>

                  <p>{note.body}</p>
                  <StudentNoteFollowUp noteId={note.id}/>
                </div>

                <div style={{ display: "grid", gap: 8, justifyItems: "end" }}>
                  <span>{fmt(note.created_at)}</span>

                  <details className="noteEdit">
                    <summary>Düzenle</summary>
                    <form action={updateStudentNote}>
                      <input type="hidden" name="student_id" value={student.id} />
                      <input type="hidden" name="note_id" value={note.id} />
                      <textarea name="body" rows={3} defaultValue={note.body} required />
                      <PendingSubmitButton pendingText="Not güncelleniyor…">Değişikliği Kaydet</PendingSubmitButton>
                    </form>
                  </details>

                  {canManageDestructiveActions && (
                    <form action={deleteStudentNote}>
                      <input
                        type="hidden"
                        name="student_id"
                        value={student.id}
                      />
                      <input type="hidden" name="note_id" value={note.id} />
                      <button
                        type="submit"
                        style={{
                          border: "1px solid #efcaca",
                          borderRadius: 8,
                          padding: "6px 8px",
                          background: "#fff3f3",
                          color: "#a52c2c",
                          fontSize: 11,
                          fontWeight: 800,
                          cursor: "pointer",
                        }}
                      >
                        Notu Sil
                      </button>
                    </form>
                  )}
                </div>
              </article>
            ))}

            {!notes.length && <p className="empty">Henüz not yok.</p>}
          </div></StudentNoteFollowUps>

          <div className="registrationNotesBlock">
            <div className="panelHead compact">
              <div>
                <p>KAYIT AŞAMASINDAKİ NOTLAR</p>
                <h3>Ön kayıt ve kesin kayıt notları</h3>
              </div>
            </div>

            <div className="list">
              {registrationNotes.map((note: any) => (
                <article key={note.id} className="managedNote">
                  <div>
                    <strong>{note.title || "Kayıt Notu"}</strong>
                    <p>{note.description || "—"}</p>
                    {note.reminder_at ? <small>Hatırlatma: {fmt(note.reminder_at)}</small> : null}
                  </div>
                  <div className="noteControls">
                    <span>{fmt(note.performed_at)}</span>
                    <details className="noteEdit">
                      <summary>Düzenle</summary>
                      <form action={updateRegistrationNote}>
                        <input type="hidden" name="student_id" value={student.id} />
                        <input type="hidden" name="note_id" value={note.id} />
                        <textarea name="body" rows={3} defaultValue={note.description || ""} required />
                        <PendingSubmitButton pendingText="Not güncelleniyor…">Değişikliği Kaydet</PendingSubmitButton>
                      </form>
                    </details>
                    {canManageDestructiveActions ? (
                      <form action={deleteRegistrationNote}>
                        <input type="hidden" name="student_id" value={student.id} />
                        <input type="hidden" name="note_id" value={note.id} />
                        <button type="submit" className="deleteNoteButton">Notu Sil</button>
                      </form>
                    ) : null}
                  </div>
                </article>
              ))}
              {!registrationNotes.length ? <p className="empty">Kayıt aşamasından aktarılan not bulunmuyor.</p> : null}
            </div>
          </div>
        </section>

        <section className="panel" id="islem-gecmisi" data-file-panel="history">
          <div className="panelHead">
            <div>
              <p>İŞLEM GEÇMİŞİ</p>
              <h2>Öğrenci hareketleri</h2>
            </div>
          </div>

          <div className="timeline">
            {operationalActivityLogs.map((event: any) => (
              <article key={event.id}>
                <i />

                <div>
                  <strong>{event.title}</strong>

                  <p>{event.description || event.activity_type}</p>

                  <span>{fmt(event.performed_at ?? event.created_at)}</span>
                </div>
              </article>
            ))}

            {!operationalActivityLogs.length &&
              oldTimeline.map((event: any) => (
                <article key={event.id}>
                  <i />

                  <div>
                    <strong>{event.title}</strong>

                    <p>{event.description || event.event_type}</p>

                    <span>{fmt(event.event_date)}</span>
                  </div>
                </article>
              ))}

            {!operationalActivityLogs.length && !oldTimeline.length && (
              <p className="empty">Henüz işlem geçmişi yok.</p>
            )}
          </div>
        </section>
      </div>

      {/* =====================================================
          MESAJLAR
          ===================================================== */}

      <div className="twoColumn">
        <section className="panel" id="mesajlar" data-file-panel="messages">
          <div className="panelHead">
            <div>
              <p>MESAJ GEÇMİŞİ</p>
              <h2>Veli iletişimi</h2>
            </div>
          </div>

          <div className="list">
            {contactLogs.map((message: any) => (
              <article key={message.id}>
                <div>
                  <strong>{message.contact_type || "Bilgilendirme"}</strong>

                  <MessageBody body={message.message_text} />
                </div>

                <span>
                  {({prepared:"Hazır · Gönderilmedi",sent:"Gönderildi",cancelled:"Geçersiz / Önceki plan"} as Record<string,string>)[message.status] || message.status} •{" "}
                  {fmt(
                    message.sent_at ??
                      message.prepared_at ??
                      message.created_at,
                  )}
                </span>
              </article>
            ))}

            {messages.map((message: any) => (
                <article key={message.id}>
                  <div>
                    <strong>{message.template_key==="compensation_plan_change"?"Telafi Planı Değişikliği":message.template_key || "Mesaj"}</strong>

                    <MessageBody body={message.message_body} />
                  </div>

                  <span>
                    {({prepared:"Hazır · Gönderilmedi",sent:"Gönderildi",cancelled:"Geçersiz / Önceki plan"} as Record<string,string>)[message.status] || message.status} •{" "}
                    {fmt(message.sent_at ?? message.prepared_at)}
                  </span>
                </article>
              ))}

            {!contactLogs.length && !messages.length && (
              <p className="empty">Henüz mesaj kaydı yok.</p>
            )}
          </div>
        </section>

        <section className="panel" data-file-panel="registration">
          <div className="panelHead">
            <div>
              <p>KAYIT DURUMU</p>
              <h2>Ders ve yenileme özeti</h2>
            </div>
          </div>

          <div className="infoRows">
            <div>
              <span>Normal Paket</span>
              <strong>{normalTotal} ders</strong>
            </div>

            <div>
              <span title="Katılım durumundan bağımsız hesaplanır">Tamamlanan Ders</span>
              <strong>{usedLessons} ders</strong>
            </div>

            <div>
              <span>Normal Kalan</span>
              <strong>{normalRemaining} ders</strong>
            </div>

            <div>
              <span>Telafi Hakkı</span>
              <strong>{compensationBalance} ders</strong>
            </div>

            <div>
              <span>Toplam Kullanılabilir</span>
              <strong>{totalRights} ders</strong>
            </div>

            <div>
              <span>Son Ödeme</span>
              <strong>{fmt(paymentSummary?.last_payment_at)}</strong>
            </div>
          </div>
        </section>
      </div>
    </main></PassiveStudentGuard>
  );
}
