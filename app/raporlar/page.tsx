import { formatDisplayDate } from "@/lib/dates/display";
import { readSettings } from "@/lib/settings/server";
import { loadLessonRightsContext, rightsForEnrollment } from "@/lib/students/lesson-rights-context";
import Link from "next/link";
import { startsAfterToday } from "@/lib/students/start-status";
import ReportExports from "./report-exports";
import { normalizeWeekday } from "@/lib/schedules/weekday";
import { filterEffectivelyActiveSchedules } from "@/lib/schedules/effective";
import { requireProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import "./reports.css";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | undefined>;

type Branch = { id: string; name: string; is_active: boolean };
type Group = { id: string; branch_id: string | null; name: string; primary_coach_id: string | null; is_active: boolean };
type Student = { id: string; first_name: string | null; last_name: string | null; status: string | null; branch_id: string | null; created_at: string };
type Enrollment = { id: string; student_id: string; branch_id: string | null; group_id: string | null; start_date: string | null; planned_end_date: string | null; total_lessons: number | null; used_lessons: number | null; status: string | null; created_at: string; lesson_weekdays: number[] | null; package_id: string | null; payment_due_date: string | null; start_confirmation_required?: boolean; actual_started_at?: string | null };
type Attendance = { id: string; enrollment_id?: string | null; student_id: string; group_id: string | null; schedule_id: string | null; coach_id: string | null; lesson_date: string; status: string | null; branch_id: string | null; coach_note: string | null };
type Payment = { id: string; student_id: string | null; enrollment_id: string | null; amount: number | string | null; payment_status: string | null; payment_method: string | null; received_at: string | null; cancelled_at: string | null; cash_handover_status: string | null };
type Profile = { id: string; full_name: string | null; role: string | null };
type Schedule = { id: string; branch_id: string | null; group_id: string | null; coach_id: string | null; weekday: number; start_time: string; is_active: boolean };

function isoToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function isIsoDate(value?: string) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0,10) === value;
}

function money(value: number) {
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 }).format(value || 0);
}

function pct(value: number) {
  return `${Math.round(value)}%`;
}

function statusIsPresent(status?: string | null) {
  const s = String(status || "").toLocaleLowerCase("tr-TR");
  return ["present", "attended", "geldi", "katildi", "katıldı", "completed", "tamamlandi", "tamamlandı"].includes(s);
}

function statusIsAbsent(status?: string | null) {
  const s = String(status || "").toLocaleLowerCase("tr-TR");
  return ["absent", "gelmedi", "missed", "no_show", "katilmadi", "katılmadı"].includes(s);
}

export default async function ReportsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const profile = await requireProfile(["owner", "admin", "branch_manager"]);
  const organizationId = profile.organization_id;
  const settingsDb = await createClient();
  const [brandSettings, reportSettings] = organizationId ? await Promise.all([readSettings(settingsDb, organizationId, "kurum"), readSettings(settingsDb, organizationId, "sistem")]) : [null, null];
  const params = await searchParams;
  const today = isoToday();
  const monthStart = `${today.slice(0, 7)}-01`;
  const from = isIsoDate(params.from) ? params.from! : monthStart;
  const to = isIsoDate(params.to) ? params.to! : today;
  const requestedBranch = params.branch || "all";
  if (from > to) return <main className="reportsShell"><div className="reportsError">Başlangıç tarihi bitişten sonra olamaz.<Link href="/raporlar">Tarihleri yeniden seç</Link></div></main>;

  if (!organizationId) {
    return <main className="reportsShell"><div className="reportsError">Kurum bilgisi bulunamadı.</div></main>;
  }

  const supabase = await createClient();
  const {error:lessonSyncError}=await supabase.rpc("sync_scheduled_used_lessons",{p_organization_id:organizationId});
  if(lessonSyncError)return <main className="reportsShell"><div className="reportsError">Ders bakiyesi doğrulanamadı.</div></main>;

  // Read every page rather than silently accepting the Data API row limit.
  async function readAll(query: any) {
    const data: any[] = [];
    for (let offset = 0; ; offset += 500) {
      const result = await query.order("id").range(offset, offset + 499);
      if (result.error) return { data: null, error: result.error };
      data.push(...(result.data || []));
      if ((result.data || []).length < 500) return { data, error: null };
    }
  }

  const [branchesResult, groupsResult, studentsResult, enrollmentsResult, attendanceResult, paymentsResult, profilesResult, schedulesResult, staffResult, assignmentsResult, packagesResult, plansResult, installmentsResult] = await Promise.all([
    readAll(supabase.from("branches").select("id,name,is_active").eq("organization_id", organizationId).order("name")),
    readAll(supabase.from("training_groups").select("id,branch_id,name,is_active,primary_coach_id").eq("organization_id", organizationId).order("name")),
    readAll(supabase.from("students").select("id,first_name,last_name,status,branch_id,created_at").eq("organization_id", organizationId).eq("is_deleted", false)),
    readAll(supabase.from("student_enrollments").select("id,student_id,branch_id,group_id,start_date,planned_end_date,total_lessons,used_lessons,status,created_at,lesson_weekdays,package_id,payment_due_date,start_confirmation_required,actual_started_at").eq("organization_id", organizationId)),
    readAll(supabase.from("attendance_records").select("id,enrollment_id,student_id,group_id,schedule_id,coach_id,lesson_date,status,branch_id,coach_note").eq("organization_id", organizationId).gte("lesson_date", from).lte("lesson_date", to)),
    readAll(supabase.from("student_payments").select("id,student_id,enrollment_id,amount,payment_status,payment_method,received_at,cancelled_at,cash_handover_status").eq("organization_id", organizationId)),
    readAll(supabase.from("profiles").select("id,full_name,role").eq("organization_id", organizationId)),
    readAll(supabase.from("lesson_schedules").select("id,branch_id,group_id,coach_id,weekday,start_time,is_active").eq("organization_id", organizationId).eq("is_active", true)),
    readAll(supabase.from("lesson_staff_assignments").select("id,schedule_id,coach_id,assignment_role").eq("organization_id", organizationId).eq("is_active", true)),
    readAll(supabase.from("lesson_student_assignments").select("id,schedule_id,student_id,coach_id").eq("organization_id", organizationId).eq("is_active", true)),
    readAll(supabase.from("course_packages").select("id,name,price").eq("organization_id", organizationId)),
    readAll(supabase.from("student_payment_plans").select("id,enrollment_id,total_amount,status").eq("organization_id", organizationId)),
    readAll(supabase.from("student_payment_installments").select("id,plan_id,enrollment_id,due_date,amount,paid_amount,status").eq("organization_id", organizationId)),
  ]);

  const loadError = branchesResult.error || groupsResult.error || studentsResult.error || enrollmentsResult.error || attendanceResult.error || paymentsResult.error || profilesResult.error || schedulesResult.error || staffResult.error || assignmentsResult.error || packagesResult.error || plansResult.error || installmentsResult.error;
  if (loadError) {
    return <main className="reportsShell"><div className="reportsError"><strong>Rapor verileri yüklenemedi.</strong><span>{loadError.message}</span><Link href="/">Yönetim paneline dön</Link></div></main>;
  }

  const branches = (branchesResult.data || []) as Branch[];
  const groups = (groupsResult.data || []) as Group[];
  const students = (studentsResult.data || []) as Student[];
  const enrollments = (enrollmentsResult.data || []) as Enrollment[];
  const attendance = (attendanceResult.data || []) as Attendance[];
  const payments = (paymentsResult.data || []) as Payment[];
  const coaches = (profilesResult.data || []) as Profile[];
  const schedules = (schedulesResult.data || []) as Schedule[];

  const staff = staffResult.data || [];
  const assignments = assignmentsResult.data || [];
  const packages = packagesResult.data || [];
  const plans = plansResult.data || [];
  const installments = installmentsResult.data || [];
  const received = (p: Payment) => !p.cancelled_at && ["received", "paid", "completed"].includes(String(p.payment_status).toLowerCase());
  const paymentDate = (p: Payment) => p.received_at ? new Intl.DateTimeFormat("en-CA", {timeZone:"Europe/Istanbul"}).format(new Date(p.received_at)) : "";
  const inPeriod = (p: Payment) => Boolean(paymentDate(p) && paymentDate(p) >= from && paymentDate(p) <= to);
  const dateLabel = (value?: string | null) => value ? formatDisplayDate(value) : "—";
  const dayNames = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];
  const branchId = requestedBranch !== "all" && branches.some((b) => b.id === requestedBranch) ? requestedBranch : "all";
  const branchMap = new Map(branches.map((b) => [b.id, b.name]));
  const groupMap = new Map(groups.map((g) => [g.id, g]));
  const studentMap = new Map(students.map((s) => [s.id, s]));
  const enrollmentMap = new Map(enrollments.map((e) => [e.id, e]));
  const coachMap = new Map(coaches.map((c) => [c.id, c.full_name || "İsimsiz antrenör"]));
  const scheduleMap = new Map(schedules.map((s) => [s.id, s]));

  const enrollmentBranch = (e: Enrollment) => e.branch_id || groupMap.get(e.group_id || "")?.branch_id || studentMap.get(e.student_id)?.branch_id || null;
  const filteredEnrollments = enrollments.filter((e) => branchId === "all" || enrollmentBranch(e) === branchId);
  const filteredAttendance = attendance.filter((a) => {
    if (branchId === "all") return true;
    const schedule = a.schedule_id ? scheduleMap.get(a.schedule_id) : null;
    const group = a.group_id ? groupMap.get(a.group_id) : null;
    return (a.branch_id || schedule?.branch_id || group?.branch_id || studentMap.get(a.student_id)?.branch_id) === branchId;
  });
  const filteredPayments = payments.filter((p) => {
    if (!inPeriod(p)) return false;
    if (branchId === "all") return true;
    const paymentEnrollment = p.enrollment_id ? enrollmentMap.get(p.enrollment_id) : null;
    const paymentStudent = p.student_id ? studentMap.get(p.student_id) : null;
    return (paymentEnrollment?.branch_id || groupMap.get(paymentEnrollment?.group_id || "")?.branch_id || paymentStudent?.branch_id) === branchId;
  });

  // "Aktif öğrenci" raporu, yalnızca öğrenci kartı ve kayıt dönemi birlikte aktifse sayılır.
  // Böylece pasife alınmış kursiyerin eski aktif enrollment kaydı raporu şişirmez.
  const hasActiveStudent = (e: Enrollment) => studentMap.get(e.student_id)?.status === "active";
  const isWaiting = (e: Enrollment) => hasActiveStudent(e) && (e.status === "scheduled" || (e.status === "active" && startsAfterToday(e, today)));
  const activeEnrollments = filteredEnrollments.filter((e) => e.status === "active" && hasActiveStudent(e) && !isWaiting(e));
  const activeEnrollmentIds = new Set(activeEnrollments.map(e => e.id));
  const inconsistentActiveEnrollmentCount = filteredEnrollments.filter((e) => e.status === "active" && studentMap.get(e.student_id)?.status !== "active").length;
  const activeStudentIds = new Set(activeEnrollments.map((e) => e.student_id));
  const reportStatus = ["all","passive","pending"].includes(params.status || "") ? params.status! : "active";
  const reportEnrollments = filteredEnrollments.filter(e => studentMap.has(e.student_id) && (reportStatus === "all" || (reportStatus === "active" ? activeEnrollmentIds.has(e.id) : reportStatus === "pending" ? isWaiting(e) : !hasActiveStudent(e) || !["active", "scheduled"].includes(e.status || ""))));
  const enrollmentScope = (e: Enrollment) => !hasActiveStudent(e) ? "passive" : isWaiting(e) ? "pending" : e.status === "active" ? "active" : "closed";
  const scopeLabels = {active:"Aktif kayıt",pending:"Henüz başlamamış",passive:"Pasif kursiyer kaydı",closed:"Kapanmış dönem"};
  const scopeLabel = (e?: Enrollment) => e ? scopeLabels[enrollmentScope(e)] : "Dönem bağlantısı yok";
  const scopeRows = (["active","pending","passive","closed"] as const).map(scope => {
    const records = filteredEnrollments.filter(e => studentMap.has(e.student_id) && enrollmentScope(e) === scope);
    return {scope,label:scopeLabels[scope],records:records.length,students:new Set(records.map(e=>e.student_id)).size};
  });
  const presentCount = filteredAttendance.filter((a) => statusIsPresent(a.status)).length;
  const absentCount = filteredAttendance.filter((a) => statusIsAbsent(a.status)).length;
  const attendanceBase = presentCount + absentCount;
  const attendanceRate = attendanceBase ? (presentCount / attendanceBase) * 100 : 0;
  const validPayments = filteredPayments.filter(received);
  const collectionTotal = validPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const rightsContext=await loadLessonRightsContext(supabase,organizationId,students.map(s=>s.id));
  const remainingLessons=activeEnrollments.reduce((sum,e)=>sum+rightsForEnrollment(rightsContext,e).total,0);

  const reportBranches = [...branches, ...(activeEnrollments.some(e => !branchMap.has(enrollmentBranch(e) || "")) ? [{id:"unassigned",name:"Şubesi belirlenemeyen",is_active:false}] : [])];
  const branchRows = reportBranches
    .filter((b) => branchId === "all" || b.id === branchId)
    .map((branch) => {
      const branchEnrollments = activeEnrollments.filter((e) => (branchMap.has(enrollmentBranch(e) || "") ? enrollmentBranch(e) : "unassigned") === branch.id);
      const studentIds = new Set(branchEnrollments.map((e) => e.student_id));
      const branchAttendance = attendance.filter((a) => {
        const schedule = a.schedule_id ? scheduleMap.get(a.schedule_id) : null;
        const group = a.group_id ? groupMap.get(a.group_id) : null;
        return (a.branch_id || schedule?.branch_id || group?.branch_id || studentMap.get(a.student_id)?.branch_id) === branch.id;
      });
      const p = branchAttendance.filter((a) => statusIsPresent(a.status)).length;
      const a = branchAttendance.filter((row) => statusIsAbsent(row.status)).length;
      const branchPayments = payments.filter((payment) => {
        const paymentEnrollment = payment.enrollment_id ? enrollmentMap.get(payment.enrollment_id) : null;
        const paymentStudent = payment.student_id ? studentMap.get(payment.student_id) : null;
        const belongsToBranch = (paymentEnrollment?.branch_id || groupMap.get(paymentEnrollment?.group_id || "")?.branch_id || paymentStudent?.branch_id) === branch.id;
        return belongsToBranch && received(payment) && inPeriod(payment);
      });
      return {
        id: branch.id,
        name: branch.name,
        students: studentIds.size,
        groups: groups.filter((g) => g.branch_id === branch.id && g.is_active).length,
        attendance: p + a ? (p / (p + a)) * 100 : 0,
        collection: branchPayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0),
      };
    })
    .sort((a, b) => b.students - a.students);

  const coachRows = coaches.filter(c => ["coach","admin","branch_manager","owner"].includes(c.role || "")).map((coach) => {
    const coachAttendance = filteredAttendance.filter((a) => a.coach_id === coach.id);
    const uniqueLessons = new Set(coachAttendance.map((a) => `${a.lesson_date}:${a.schedule_id || a.group_id || "lesson"}`));
    const p = coachAttendance.filter((a) => statusIsPresent(a.status)).length;
    const a = coachAttendance.filter((row) => statusIsAbsent(row.status)).length;
    const assignedGroups = new Set(groups.filter((g) => g.is_active && g.primary_coach_id === coach.id && (branchId === "all" || g.branch_id === branchId)).map((g) => g.id));
    return { id: coach.id, name: coach.full_name || "İsimsiz antrenör", lessons: uniqueLessons.size, students: p + a, attendance: p + a ? (p / (p + a)) * 100 : 0, groups: assignedGroups.size };
  }).filter((row) => row.lessons > 0 || row.groups > 0).sort((a, b) => b.lessons - a.lessons || a.name.localeCompare(b.name, "tr"));

  const studentRows = reportEnrollments.map((enrollment) => {
    const student = studentMap.get(enrollment.student_id)!;
    const records = filteredAttendance.filter((a) => a.student_id === student.id);
    const p = records.filter((a) => statusIsPresent(a.status)).length;
    const a = records.filter((row) => statusIsAbsent(row.status)).length;
    return {
      id: student.id,
      enrollmentId: enrollment.id,
      registered: dateLabel(enrollment.created_at),
      start: dateLabel(enrollment.start_date),
      end: dateLabel(enrollment.planned_end_date),
      days: (enrollment.lesson_weekdays || []).map(d => dayNames[normalizeWeekday(d)]).join(", ") || "Belirtilmedi",
      name: `${student.first_name || ""} ${student.last_name || ""}`.trim(),
      branch: branchMap.get(enrollmentBranch(enrollment) || "") || "—",
      group: groupMap.get(enrollment?.group_id || "")?.name || "—",
      used: rightsForEnrollment(rightsContext,enrollment).used,
      normalRemaining: rightsForEnrollment(rightsContext,enrollment).normal,
      compensation: rightsForEnrollment(rightsContext,enrollment).compensation,
      remaining: rightsForEnrollment(rightsContext,enrollment).total,
      total: Number(enrollment?.total_lessons || 0),
      attendance: p + a ? (p / (p + a)) * 100 : 0,
    };
  }).sort((a, b) => a.name.localeCompare(b.name, "tr"));

  const methodRows = Array.from(validPayments.reduce((map, payment) => {
    const method = String(payment.payment_method || "Belirtilmedi");
    map.set(method, (map.get(method) || 0) + Number(payment.amount || 0));
    return map;
  }, new Map<string, number>()).entries()).sort((a, b) => b[1] - a[1]);

  type Note = { subject: string; detail: string; href: string };
  const notes: Note[] = [];
  const addNote = (subject: string, detail: string, href = "/operasyon-plani") => notes.push({subject, detail, href});
  const currentSchedules = filterEffectivelyActiveSchedules(schedules, branches, groups).filter(sc => branchId === "all" || sc.branch_id === branchId);
  // Calculate against all history before applying branch/status report filters.
  const periodNumbers = new Map<string, number>();
  const histories = new Map<string, Enrollment[]>();
  for (const e of enrollments) histories.set(e.student_id, [...(histories.get(e.student_id) || []), e]);
  for (const history of Array.from(histories.values())) history
    .sort((a,b) => String(a.start_date || a.created_at).localeCompare(String(b.start_date || b.created_at)) || a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id))
    .forEach((e,i) => periodNumbers.set(e.id, i + 1));
  const financeRows = reportEnrollments.map(e => {
    const student = studentMap.get(e.student_id)!;
    const name = `${student.first_name || ""} ${student.last_name || ""}`.trim();
    const rights = rightsForEnrollment(rightsContext, e);
    const hasRenewal = enrollments.some(next => next.student_id === e.student_id && next.id !== e.id && ["active", "scheduled"].includes(next.status || "") && String(next.start_date || "") > String(e.start_date || ""));
    const paid = payments.filter(p => p.enrollment_id === e.id && received(p)).reduce((sum,p) => sum + Number(p.amount || 0), 0);
    const activePlans = plans.filter(p => p.enrollment_id === e.id && !["cancelled","canceled"].includes(p.status));
    const rawPrice = activePlans.length === 1 ? (activePlans[0].total_amount == null ? NaN : Number(activePlans[0].total_amount)) : null;
    // Same package source as the Payment Center, scoped to this enrollment.
    // Keep the source visible: catalog prices are not historical agreed prices.
    const packagePrice = packages.find(p => p.id === e.package_id)?.price;
    const catalogPrice = packagePrice == null || packagePrice === "" ? null : Number(packagePrice);
    const price = activePlans.length === 1 ? (rawPrice !== null && Number.isFinite(rawPrice) && rawPrice >= 0 ? rawPrice : null)
      : activePlans.length === 0 && catalogPrice !== null && Number.isFinite(catalogPrice) && catalogPrice >= 0 ? catalogPrice : null;
    const priceSource = activePlans.length === 1 ? "Kayıt dönemi ödeme planı" : price !== null ? "Ödeme Merkezi · güncel paket ücreti" : "Ücret kaydı eksik / çelişkili";
    const periodNumber = periodNumbers.get(e.id)!;
    const balance = price !== null && Number.isFinite(price) ? Math.max(0, price - paid) : null;
    const planIds = new Set(activePlans.map(p => p.id));
    const overdue = installments.filter(i => i.enrollment_id === e.id && planIds.has(i.plan_id) && i.due_date < today && !["cancelled","paid"].includes(i.status)).reduce((sum,i) => sum + Math.max(0, Number(i.amount)-Number(i.paid_amount)), 0);
    const status = balance === null ? "Ücret kontrolü gerekli" : balance === 0 ? "Borcu yok" : overdue > 0 || (e.payment_due_date && e.payment_due_date < today) ? "Gecikmiş" : paid > 0 ? "Kısmi ödeme" : "Ödeme yapılmadı";
    if (balance === null) addNote(name,"Kayıt ücreti belirlenemedi veya birden fazla ödeme planı var.",`/ogrenciler/${student.id}`);
    if (!e.start_date || !e.planned_end_date || (e.start_date && e.planned_end_date && e.start_date > e.planned_end_date)) addNote(name,"Başlangıç/bitiş tarihi eksik veya sırası hatalı.",`/ogrenciler/${student.id}`);
    if (Number(e.used_lessons) > Number(e.total_lessons)) addNote(name,"Kullanılan ders paket hakkını aşıyor.",`/ogrenciler/${student.id}`);
    if (!hasRenewal && !isWaiting(e) && e.status === "active" && student.status === "active" && ((rightsForEnrollment(rightsContext,e).compensation<=0 && e.planned_end_date && e.planned_end_date < today) || rightsForEnrollment(rightsContext,e).total <= 0)) addNote(name,"Aktif kayıt için yenileme veya pasife alma kontrolü gerekli.",`/ogrenciler/${student.id}`);
    if (!e.lesson_weekdays?.length) addNote(name,"Kayıtta seçili ders günleri eksik.",`/ogrenciler/${student.id}`);
    return {id:e.id, studentId:student.id,name,periodNumber,priceSource,scope:scopeLabel(e), debtStatus:balance === null ? "Belirlenemedi" : balance > 0 ? "Borcu var" : "Borcu yok", periodInfo: [hasRenewal ? "Yeni kayıt mevcut" : "", rights.compensation > 0 ? `${rights.compensation} telafi hakkı var` : ""].filter(Boolean).join(" · ") || "—", recordStatus: (() => { const days = e.planned_end_date && isIsoDate(e.planned_end_date) ? Math.round((Date.parse(e.planned_end_date) - Date.parse(today)) / 86400000) : null; return isWaiting(e) ? "Henüz başlamadı" : days === null ? "Bitiş tarihi eksik" : days < 0 ? "Süresi doldu" : days === 0 ? "Bugün bitiyor" : days <= 7 ? `Bitişi yaklaşıyor (${days} gün)` : `${days} gün kaldı`; })(), endIso:e.planned_end_date || "9999-12-31", registered:dateLabel(e.created_at),start:dateLabel(e.start_date),end:dateLabel(e.planned_end_date),price,paid,balance,overdue,status};
  });
  financeRows.sort((a,b) => a.endIso.localeCompare(b.endIso) || a.name.localeCompare(b.name,"tr") || a.id.localeCompare(b.id));
  const financeSheet = (name: string, rows: typeof financeRows) => ({name,rows:[["Sıra","Öğrenci","Kayıt uyarısı","Kayıt tarihi","Başlangıç","Bitiş","Ücret","Ödenen","Kalan","Gecikmiş taksit","Ödeme durumu","Ek dönem bilgisi","Kayıt dönemi","Borç durumu","Ücret kaynağı","Kayıt durumu"],...rows.map((r,i)=>[i+1,r.name,r.recordStatus,r.registered,r.start,r.end,r.price,r.paid,r.balance,r.overdue,r.paid === 0 && (r.balance || 0)>0 ? `Ödeme yapılmadı${r.status === "Gecikmiş" ? " · Gecikmiş" : ""}` : r.status,r.periodInfo,`${r.periodNumber}. kayıt dönemi`,r.debtStatus,r.priceSource,r.scope])]});
  const assignmentRows = activeEnrollments.flatMap(e => {
    const student = studentMap.get(e.student_id)!;
    const name = `${student.first_name || ""} ${student.last_name || ""}`.trim();
    const days = new Set((e.lesson_weekdays || []).map(normalizeWeekday));
    const studentAssignments = assignments.filter(a => a.student_id === e.student_id);
    const sessions = currentSchedules.filter(sc => days.has(normalizeWeekday(sc.weekday)) && (sc.group_id === e.group_id || studentAssignments.some(a => a.schedule_id === sc.id)));
    for (const day of days) if (!sessions.some(sc => normalizeWeekday(sc.weekday) === day)) addNote(name,`${dayNames[day]} günü için eşleşen aktif seans yok.`, `/ogrenciler/${student.id}`);
    if (!sessions.length) addNote(name,"Seçili kayıt günleriyle eşleşen aktif seans bulunamadı.",`/ogrenciler/${student.id}`);
    return sessions.map(sc => {
      const assigned = studentAssignments.filter(a => a.schedule_id === sc.id && a.coach_id);
      const names = [...new Set(assigned.map(a => coachMap.get(a.coach_id) || "Bilinmeyen eğitmen"))];
      const plannedIds = [...new Set([sc.coach_id, groupMap.get(sc.group_id || "")?.primary_coach_id, ...staff.filter(a => a.schedule_id === sc.id).map(a => a.coach_id)].filter(Boolean))];
      assigned.filter(a => !plannedIds.includes(a.coach_id)).forEach(a => addNote(name,`${sc.start_time.slice(0,5)}: öğrenci eğitmeni seans eğitmen listesinde yok.`));
      const planned = plannedIds.map(id => coachMap.get(String(id)) || "Bilinmeyen eğitmen");
      if (!names.length) addNote(name,`${dayNames[normalizeWeekday(sc.weekday)]} ${sc.start_time.slice(0,5)}: öğrenciye özel eğitmen ataması eksik.`);
      if (!planned.length) addNote(name,`${sc.start_time.slice(0,5)} seansında eğitmen ataması eksik.`);
      return {id:`${e.id}:${sc.id}`,name,branch:branchMap.get(sc.branch_id || "") || "—",group:groupMap.get(sc.group_id || "")?.name || "—",session:`${dayNames[normalizeWeekday(sc.weekday)]} ${sc.start_time.slice(0,5)}`,planned:planned.join(", ") || "Atama yok",assigned:names.join(", ") || "Öğrenci ataması eksik"};
    });
  });
  const lessonRows = filteredAttendance.map(a => {
    const sc = scheduleMap.get(a.schedule_id || "");
    const student = studentMap.get(a.student_id);
    const name = student ? `${student.first_name || ""} ${student.last_name || ""}`.trim() : "Silinmiş/bulunamayan öğrenci";
    if (!a.coach_id) addNote(name,`${dateLabel(a.lesson_date)} yoklamasında dersi veren eğitmen kaydı yok.`,"/yoklama");
    return {id:a.id,name,scope:scopeLabel(enrollmentMap.get(a.enrollment_id || "")),date:dateLabel(a.lesson_date),group:groupMap.get(a.group_id || sc?.group_id || "")?.name || "—",time:sc?.start_time?.slice(0,5) || "—",planned:coachMap.get(sc?.coach_id || "") || "Belirtilmedi",actual:coachMap.get(a.coach_id || "") || "Kaydedilmedi",status:statusIsPresent(a.status) ? "Katıldı" : statusIsAbsent(a.status) ? "Gelmedi" : a.status || "Belirtilmedi",note:a.coach_note || "—"};
  });
  const paymentRows = filteredPayments.map(p => ({id:p.id,name:studentMap.has(p.student_id || "") ? `${studentMap.get(p.student_id!)!.first_name || ""} ${studentMap.get(p.student_id!)!.last_name || ""}`.trim() : "Öğrenci bulunamadı",scope:scopeLabel(enrollmentMap.get(p.enrollment_id || "")),date:dateLabel(p.received_at),amount:Number(p.amount || 0),status:received(p) ? "Tahsil edildi" : p.cancelled_at ? "İptal" : p.payment_status || "Belirtilmedi",method:p.payment_method || "—",handover:p.cash_handover_status || "—"}));
  if (inconsistentActiveEnrollmentCount) addNote("Kayıt tutarlılığı",`${inconsistentActiveEnrollmentCount} pasif/silinmiş öğrencinin aktif kayıt dönemi var. Aktif toplamlarına dahil edilmedi.`,"/ogrenciler?status=passive");
  const duplicateIds = activeEnrollments.filter((e,i,arr) => arr.findIndex(other => other.student_id === e.student_id) !== i);
  duplicateIds.forEach(e => addNote(studentMap.get(e.student_id)?.first_name || "Öğrenci","Birden fazla aktif kayıt dönemi var; toplam ders hakkı kontrol edilmeli.",`/ogrenciler/${e.student_id}`));
  financeRows.forEach(r => {
    if (r.recordStatus === "Süresi doldu" || r.recordStatus === "Bugün bitiyor" || r.recordStatus.startsWith("Bitişi yaklaşıyor")) addNote(r.name,`${r.recordStatus}: kayıt yenilemesini görüşün veya dönem durumunu kontrol edin.`,`/ogrenciler/${r.studentId}`);
    if ((r.balance || 0) > 0) addNote(r.name,`${r.paid === 0 ? "Ödeme yapılmadı" : "Kısmi ödeme"}: kalan ${money(r.balance!)} için ödeme kaydını ve tahsilat durumunu kontrol edin.`,`/ogrenciler/${r.studentId}`);
  });
  const noteGroups = Array.from(notes.reduce((map, n) => {
    const key = n.detail;
    const existing = map.get(key);
    if (existing) { existing.count++; existing.subjects.add(n.subject); }
    else map.set(key, {detail:key,count:1,subjects:new Set([n.subject])});
    return map;
  }, new Map<string,{detail:string;count:number;subjects:Set<string>}>()).values()).sort((a,b)=>b.count-a.count);
  const uniqueNotes = Array.from(new Map(notes.map(n=>[`${n.subject}:${n.detail}`,n])).values());
  const requiredActions = uniqueNotes.map(n => {
    const financial = /ücret|ödeme|tahsilat/i.test(n.detail);
    const renewal = /yenileme|Süresi doldu|Bugün bitiyor|Bitişi yaklaşıyor/.test(n.detail);
    const assignment = /atama|eğitmen|seans/i.test(n.detail);
    const action = financial ? "Ödeme ve ücret kaydını kontrol et" : renewal ? "Kaydı yenile veya dönem durumunu değerlendir" : /yoklama/i.test(n.detail) ? "İlgili yoklama kaydını kontrol et" : assignment ? "Seans ve eğitmen atamasını tamamla" : /gün/.test(n.detail) ? "Kayıt günlerini kontrol et" : "Öğrenci kayıt bilgilerini kontrol et";
    const priority = /Ödeme yapılmadı|Süresi doldu|aşıyor|birden fazla|Birden fazla|sırası hatalı/.test(n.detail) ? "Yüksek" : "Normal";
    return {...n,action,priority,category:financial ? "Finans" : renewal ? "Kayıt yenileme" : assignment ? "Seans / eğitmen" : "Kayıt bilgileri"};
  }).sort((a,b)=>(a.priority === "Yüksek" ? 0 : 1)-(b.priority === "Yüksek" ? 0 : 1) || a.subject.localeCompare(b.subject,"tr"));
  const debtTotal = financeRows.reduce((sum,r)=>sum+(r.balance || 0),0);
  const overdueTotal = financeRows.reduce((sum,r)=>sum+r.overdue,0);
  const exportSheets = [
    {name:"Yönetici özeti",rows:[
      ["Rapor aralığı",`${dateLabel(from)} – ${dateLabel(to)}`],
      ["Şube",branchId === "all" ? "Tüm şubeler" : branchMap.get(branchId) || ""],
      ["Kayıt kapsamı",reportStatus === "all" ? "Tüm kayıt geçmişi" : reportStatus === "passive" ? "Pasif / kapanmış kayıtlar" : reportStatus === "pending" ? "Henüz başlamamış kayıtlar" : "Aktif kayıtlar"],
      ["Aktif öğrenci",activeStudentIds.size],
      ["Henüz başlamamış öğrenci",new Set(filteredEnrollments.filter(isWaiting).map(e=>e.student_id)).size],
      ["Tahsilat",collectionTotal],["Tahsilat açıklaması",`${validPayments.length} alınmış ödeme · ${money(collectionTotal)} · aktif/pasif tüm geçmiş; durum ayrımı Kayıt durumları raporunda.`],
      ["Doğrulanmış kayıt borcu",money(debtTotal)],["Gecikmiş taksit",money(overdueTotal)],
      ["Kalan ders",remainingLessons],["Katılım",`${presentCount} katıldı · ${absentCount} gelmedi · ${pct(attendanceRate)}`],
      ["Eğitmeni eksik yoklama",lessonRows.filter(r=>r.actual === "Kaydedilmedi").length],
      ["Öğrenci ataması eksik seans",assignmentRows.filter(r=>r.assigned === "Öğrenci ataması eksik").length],
      ["Borçlu kayıt sayısı",financeRows.filter(r=>(r.balance || 0)>0).length],
      ["Ücreti bilinmeyen kayıt",financeRows.filter(r=>r.balance === null).length],
      ["Borç toplamının kapsamı",financeRows.some(r=>r.balance === null) ? "Eksik toplam: ücreti bilinmeyen kayıtlar hariçtir; borçsuz oldukları anlamına gelmez." : "Seçilen kayıtların doğrulanmış borç toplamı."],
      ["Ücret açıklaması","Önce kayıt döneminin ödeme planı, yoksa Ödeme Merkezi ile aynı paket ücreti kullanılır. Güncel paket ücreti geçmişte anlaşılan ücretten farklı olabilir; kaynak her satırda gösterilir. Kaynağı olmayan veya çelişkili ücretler borç toplamına dahil edilmez."],
      ...branchRows.map(r=>[`Şube: ${r.name}`,`${r.students} aktif öğrenci · ${money(r.collection)} tahsilat · %${Math.round(r.attendance)} katılım`]),
      ["Öncelikli kontrol özeti",`${uniqueNotes.length} farklı kayıt uyarısı; ayrıntılar Kontrol notları raporunda.`],
      ...noteGroups.slice(0,5).map(r=>[`${r.count} kayıt`,r.detail]),
    ]},
    {name:"Kayıt durumları",rows:[["Kayıt durumu","Kayıt dönemi sayısı","Kursiyer sayısı","Tarih aralığı tahsilatı"],
      ...scopeRows.map(r=>[r.label,r.records,r.students,validPayments.filter(p=>{const e=enrollmentMap.get(p.enrollment_id || "");return e && studentMap.has(e.student_id) && enrollmentScope(e)===r.scope;}).reduce((sum,p)=>sum+Number(p.amount || 0),0)]),
      ["Dönem / öğrenci bağlantısı bulunamayan",0,0,validPayments.filter(p=>{const e=enrollmentMap.get(p.enrollment_id || "");return !e || !studentMap.has(e.student_id);}).reduce((sum,p)=>sum+Number(p.amount || 0),0)],
    ]},
    financeSheet("Kayıt ve ödeme",financeRows),
    financeSheet("Bitişi yaklaşanlar",financeRows.filter(r=>r.recordStatus.startsWith("Bitişi yaklaşıyor") || r.recordStatus === "Bugün bitiyor")),
    financeSheet("Süresi dolanlar",financeRows.filter(r=>r.recordStatus === "Süresi doldu")),
    financeSheet("Ödeme yapılmayanlar",financeRows.filter(r=>r.paid === 0 && (r.balance || 0)>0)),
    financeSheet("Kısmi ödeme yapanlar",financeRows.filter(r=>r.paid > 0 && (r.balance || 0)>0)),
    {name:"Öğrenciler",rows:[["Öğrenci","Şube","Grup","Günler","Kullanılan ders","Paket ders","Normal kalan","Telafi","Toplam kalan","Katılım %"],...studentRows.map(r=>[r.name,r.branch,r.group,r.days,r.used,r.total,r.normalRemaining,r.compensation,r.remaining,Math.round(r.attendance)])]},
    {name:"Atamalar",rows:[["Öğrenci","Şube","Grup","Seans","Seans eğitmenleri","Öğrenci eğitmeni"],...assignmentRows.map(r=>[r.name,r.branch,r.group,r.session,r.planned,r.assigned])]},
    {name:"Gerçekleşen dersler",rows:[["Tarih","Saat","Öğrenci","Grup","Mevcut plan eğitmeni","Yoklamadaki eğitmen","Durum","Ders notu","Kayıt durumu"],...lessonRows.map(r=>[r.date,r.time,r.name,r.group,r.planned,r.actual,r.status,r.note,r.scope])]},
    {name:"Tahsilat hareketleri",rows:[["Öğrenci","Tarih","Tutar","Durum","Yöntem","Kasa teslimi","Kayıt durumu"],...paymentRows.map(r=>[r.name,r.date,r.amount,r.status,r.method,r.handover,r.scope])]},
    {name:"Yapılacak işlemler",rows:[["Sıra","Öncelik","Kategori","İlgili kayıt","Eksik / kontrol konusu","Yapılması gereken"],...requiredActions.map((r,i)=>[i+1,r.priority,r.category,r.subject,r.detail,r.action])]},
    {name:"Kontrol notları",rows:[["İlgili","Kontrol notu"],...uniqueNotes.map(r=>[r.subject,r.detail])]},
    {name:"Şubeler",rows:[["Şube","Aktif öğrenci","Grup","Katılım %","Tahsilat"],...branchRows.map(r=>[r.name,r.students,r.groups,Math.round(r.attendance),r.collection])]},
    {name:"Eğitmenler",rows:[["Eğitmen","Grup","Yoklamaya işlenen ders","Katılım %"],...coachRows.map(r=>[r.name,r.groups,r.lessons,Math.round(r.attendance)])]},
  ];

  return (
    <main className="reportsShell">
      <div className="reportsWrap">
        <header className="reportsHeader">
          <div className="reportsHeaderCopy">
            <div className="reportsTitleLine"><p className="reportsEyebrow">{String(brandSettings?.values.display_name || "Sprint Yüzme Okulu")} · YÖNETİM RAPORLARI</p><span className="liveBadge"><i /> Canlı veri</span></div>
            <h1>{String(reportSettings?.values.report_title || "Rapor Merkezi")}</h1>
            <p>Öğrenci, şube, yoklama, tahsilat ve antrenör performansını tek ekrandan izleyin.</p>
          </div>
          <div className="reportsHeaderActions"><Link href="/" className="reportSecondary">← Yönetim paneli</Link><Link href="/odemeler" className="reportPrimary">Ödeme merkezini aç</Link></div>
        </header>

        <ReportExports sheets={exportSheets} filename={`Sprint-Yonetim-Raporu-${from}-${to}`} />
        <p className="reportScope">Tahsilat ve yoklama: seçilen tarih aralığındaki tüm hareketler; pasife alınanların geçmişi korunur. Kayıt kapsamı filtresi kayıt ve borç listelerini belirler. Aktif öğrenci ve atamalar: başlamış güncel kayıtlar. Tarihler Türkiye saatine göredir.</p>
        <form className="reportFilters" method="get">
          <label><span>Başlangıç</span><input type="date" name="from" defaultValue={from} /></label>
          <label><span>Bitiş</span><input type="date" name="to" defaultValue={to} /></label>
          <label><span>Kayıt kapsamı</span><select name="status" defaultValue={reportStatus}><option value="active">Aktif kayıtlar</option><option value="all">Tüm kayıt geçmişi</option><option value="pending">Henüz başlamamış kayıtlar</option><option value="passive">Pasif / kapanmış kayıtlar</option></select></label>
          <label><span>Şube</span><select name="branch" defaultValue={branchId}><option value="all">Tüm şubeler</option>{branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
          <button type="submit">Raporu getir</button>
        </form>

        {inconsistentActiveEnrollmentCount > 0 ? (
          <div className="dataNotice">
            <div><strong>Veri tutarlılığı kontrolü</strong><span>{inconsistentActiveEnrollmentCount} pasif kursiyerde eski “aktif kayıt dönemi” bulundu. Aktif öğrenci ve kalan ders hesaplarına dahil edilmedi.</span></div>
            <Link href="/ogrenciler?status=passive">Pasif kursiyerleri kontrol et →</Link>
          </div>
        ) : null}

        <div className="dataNotice"><div><strong>Kayıt durumları · seçilen şube</strong><span>{scopeRows.map(r=>`${r.label}: ${r.students} kursiyer / ${r.records} dönem`).join(" · ")}</span><small>Bir kursiyerin aktif ve kapanmış dönemleri olabilir; durum satırlarındaki kursiyer sayıları toplanmaz. Kayıt ve borç listeleri seçilen kapsamı kullanır. Tahsilat ve yoklama geçmişi tüm durumları korur.</small></div></div>
        <section className="kpiGrid">
          <article className="kpiCard kpiBlue"><div className="kpiTop"><span>Aktif öğrenci</span><b>01</b></div><strong>{activeStudentIds.size}</strong><small>{activeEnrollments.length} aktif kayıt dönemi</small></article>
          <article className="kpiCard kpiGreen"><div className="kpiTop"><span>Dönem tahsilatı</span><b>₺</b></div><strong>{money(collectionTotal)}</strong><small>{validPayments.length} geçerli ödeme kaydı</small></article>
          <article className="kpiCard kpiAmber"><div className="kpiTop"><span>Katılım oranı</span><b>%</b></div><strong>{pct(attendanceRate)}</strong><small>{presentCount} katıldı · {absentCount} gelmedi</small></article>
          <article className="kpiCard kpiViolet"><div className="kpiTop"><span>Kalan ders</span><b>∑</b></div><strong>{remainingLessons}</strong><small>Aktif kursiyer paketlerinin toplamı</small></article>
        </section>

        <article className="reportPanel reportTasks">
          <div className="panelHead"><div><span className="panelKicker">YAPILMASI GEREKENLER</span><h2>Eksik işlemler ve kontrol listesi</h2></div><strong>{requiredActions.length} işlem</strong></div>
          <p className="reportScope">Seçilen şube ve kayıt kapsamındaki tespitler. Yüksek öncelikli işlemler önce gösterilir. Uyarılar kontrol gerektirir; kayıtlar düzeltildiğinde rapor yenilenerek güncel durum alınır. PDF için “Yapılacak işlemler” raporunu seçin.</p>
          <div className="tableScroll"><table><thead><tr><th>Sıra</th><th>Öncelik</th><th>İlgili kayıt</th><th>Eksik / kontrol konusu</th><th>Yapılması gereken</th></tr></thead><tbody>{requiredActions.map((r,i)=><tr key={`${r.subject}:${r.detail}`}><td>{i+1}</td><td><span className={r.priority === "Yüksek" ? "reportTag reportDanger" : "reportTag reportWarning"}>{r.priority}</span></td><td><strong>{r.subject}</strong><br/><small>{r.category}</small></td><td>{r.detail}</td><td><Link className="detailLink" href={r.href}>{r.action} →</Link></td></tr>)}{!requiredActions.length && <tr><td colSpan={5}>Seçilen kapsamda eksik işlem tespit edilmedi.</td></tr>}</tbody></table></div>
        </article>
        <section className="reportsGrid">
          <article className="reportPanel reportPanelWide">
            <div className="panelHead"><div><span className="panelKicker">KAYIT VE FİNANS</span><h2>Kayıt tarihleri ve ödeme durumu</h2></div></div>
            <p className="reportScope">Sıralama: bitiş tarihi en yakın olan önce, aynı tarihte ad-soyad A–Z. Bitişe 7 gün kalanlar ayrıca işaretlenir. Her kayıt dönemi ayrı satırdır; kayıt kapsamı filtresi geçmiş kayıtları da gösterir. Ödenen ve kalan tutarlar kayıt döneminin tüm geçmişini kapsar. Ödeme planı yoksa Ödeme Merkezi ile aynı paket ücreti kullanılır; güncel paket ücreti geçmiş anlaşmadan farklı olabilir. Ücret kaynağı satırda belirtilir.</p>
            <div className="tableScroll"><table><thead><tr><th>Sıra</th><th>Öğrenci</th><th>Kayıt dönemi</th><th>Kayıt uyarısı</th><th>Kayıt tarihi</th><th>Başlangıç</th><th>Bitiş</th><th>Ücret</th><th>Ödenen</th><th>Kalan</th><th>Gecikmiş taksit</th><th>Durum</th></tr></thead><tbody>{financeRows.map((r,i)=><tr key={r.id}><td>{i+1}</td><td><Link href={`/ogrenciler/${r.studentId}`}>{r.name}</Link></td><td>{r.periodNumber}. kayıt dönemi<br/><small>{r.scope}</small></td><td><span className={r.recordStatus === "Süresi doldu" ? "reportTag reportDanger" : /yaklaşıyor|Bugün/.test(r.recordStatus) ? "reportTag reportWarning" : "reportTag"}>{r.recordStatus}</span>{r.periodInfo !== "—" && <><br/><small>{r.periodInfo}</small></>}</td><td>{r.registered}</td><td>{r.start}</td><td>{r.end}</td><td>{r.price === null || !Number.isFinite(r.price) ? "Kontrol gerekli" : money(r.price)}<br/><small>{r.priceSource}</small></td><td>{money(r.paid)}</td><td>{r.balance === null ? "Bilinmiyor" : money(r.balance)}<br/><small>{r.debtStatus}</small></td><td>{money(r.overdue)}</td><td><span className={r.balance === 0 ? "reportTag reportGood" : "reportTag reportDanger"}>{r.paid === 0 && (r.balance || 0)>0 ? `Ödeme yapılmadı${r.status === "Gecikmiş" ? " · Gecikmiş" : ""}` : r.status}</span></td></tr>)}</tbody></table></div>
          </article>
          <article className="reportPanel reportPanelWide">
            <div className="panelHead"><div><span className="panelKicker">GÜNCEL OPERASYON PLANI</span><h2>Öğrenci ve eğitmen atamaları</h2></div><Link href="/operasyon-plani">Atamaları düzenle →</Link></div>
            <div className="tableScroll"><table><thead><tr><th>Öğrenci</th><th>Şube / grup</th><th>Seçili seans</th><th>Seans eğitmenleri</th><th>Öğrenci eğitmeni</th></tr></thead><tbody>{assignmentRows.map(r=><tr key={r.id}><td>{r.name}</td><td>{r.branch}<br/>{r.group}</td><td>{r.session}</td><td>{r.planned}</td><td>{r.assigned}</td></tr>)}</tbody></table></div>
          </article>
          <article className="reportPanel reportPanelWide">
            <div className="panelHead"><div><span className="panelKicker">DERS GEÇMİŞİ</span><h2>Hangi öğrencinin dersine kim girdi?</h2></div></div>
            <p className="reportScope">Gerçekleşen eğitmen yoklama kaydından okunur. Plan eğitmeni güncel atamadır; geçmiş atamayı kanıtlamaz.</p>
            <div className="tableScroll"><table><thead><tr><th>Tarih / saat</th><th>Öğrenci / grup</th><th>Mevcut plan eğitmeni</th><th>Yoklamadaki eğitmen</th><th>Yoklama</th><th>Ders notu</th></tr></thead><tbody>{lessonRows.map(r=><tr key={r.id}><td>{r.date}<br/>{r.time}</td><td>{r.name}<br/>{r.group}<br/><small>{r.scope}</small></td><td>{r.planned}</td><td>{r.actual}</td><td>{r.status}</td><td>{r.note}</td></tr>)}</tbody></table></div>
          </article>
          <article className="reportPanel reportPanelWide">
            <div className="panelHead"><div><span className="panelKicker">FİNANS HAREKETLERİ</span><h2>Tahsilat ve kasa teslimi</h2></div></div>
            <div className="tableScroll"><table><thead><tr><th>Öğrenci</th><th>Tarih</th><th>Tutar</th><th>Ödeme durumu</th><th>Yöntem</th><th>Kasa teslimi</th></tr></thead><tbody>{paymentRows.map(r=><tr key={r.id}><td>{r.name}</td><td>{r.date}</td><td>{money(r.amount)}</td><td>{r.status}<br/><small>{r.scope}</small></td><td>{r.method}</td><td>{r.handover}</td></tr>)}</tbody></table></div>
          </article>
          <article className="reportPanel reportPanelWide">
            <div className="panelHead"><div><span className="panelKicker">ŞUBE PERFORMANSI</span><h2>Şube karşılaştırması</h2></div><Link href="/gruplar">Gruplara git →</Link></div>
            <div className="tableScroll"><table><thead><tr><th>Şube</th><th>Aktif öğrenci</th><th>Grup</th><th>Katılım</th><th>Tahsilat</th></tr></thead><tbody>{branchRows.length ? branchRows.map((row) => <tr key={row.id}><td><strong>{row.name}</strong></td><td>{row.students}</td><td>{row.groups}</td><td><span className={row.attendance >= 80 ? "metricGood" : row.attendance > 0 ? "metricWarn" : "metricMuted"}>{pct(row.attendance)}</span></td><td>{money(row.collection)}</td></tr>) : <tr><td colSpan={5} className="emptyCell">Şube verisi bulunamadı.</td></tr>}</tbody></table></div>
          </article>

          <article className="reportPanel">
            <div className="panelHead"><div><span className="panelKicker">TAHSİLAT DAĞILIMI</span><h2>Ödeme yöntemleri</h2></div><Link href="/odemeler">Detay →</Link></div>
            <div className="methodList">{methodRows.length ? methodRows.map(([method, total]) => <div key={method} className="methodRow"><span>{method}</span><strong>{money(total)}</strong></div>) : <div className="emptyBox">Bu tarih aralığında tahsilat yok.</div>}</div>
          </article>

          <article className="reportPanel">
            <div className="panelHead"><div><span className="panelKicker">ANTRENÖR RAPORU</span><h2>Ders ve katılım</h2></div><Link href="/yoklama">Yoklamaya git →</Link></div>
            <div className="coachList">{coachRows.length ? coachRows.map((row) => <div className="coachRow" key={row.id}><div><strong>{row.name}</strong><span>{row.groups} grup · {row.lessons} ders</span></div><b>{pct(row.attendance)}</b></div>) : <div className="emptyBox">Seçilen dönemde antrenör ders verisi yok.</div>}</div>
          </article>

          <article className="reportPanel reportPanelWide">
            <div className="panelHead"><div><span className="panelKicker">ÖĞRENCİ RAPORU</span><h2>Kursiyer ve kayıt özeti</h2></div><Link href="/ogrenciler">Öğrenci merkezini aç →</Link></div>
            <div className="tableScroll"><table><thead><tr><th>Öğrenci</th><th>Şube</th><th>Grup</th><th>Seçili günler</th><th>Ders kullanımı</th><th>Normal kalan</th><th>Telafi</th><th>Toplam kalan</th><th>Dönem katılımı</th><th></th></tr></thead><tbody>{studentRows.length ? studentRows.map((row) => <tr key={row.enrollmentId}><td><strong>{row.name || "İsimsiz öğrenci"}</strong></td><td>{row.branch}</td><td>{row.group}</td><td>{row.days}</td><td>{row.used}/{row.total || "—"}</td><td>{row.normalRemaining}</td><td>+{row.compensation}</td><td>{row.remaining}</td><td>{pct(row.attendance)}</td><td><Link className="detailLink" href={`/ogrenciler/${row.id}`}>Dosya →</Link></td></tr>) : <tr><td colSpan={10} className="emptyCell">Aktif öğrenci bulunamadı.</td></tr>}</tbody></table></div>
          </article>
          <article className="reportPanel reportPanelWide">
            <div className="panelHead"><div><span className="panelKicker">YÖNETİCİ KONTROLÜ</span><h2>Eksik ve kontrol özeti</h2></div></div>
            <div className="tableScroll"><table><thead><tr><th>Kayıt sayısı</th><th>Kontrol konusu</th></tr></thead><tbody>{noteGroups.slice(0,8).map((n,i)=><tr key={i}><td>{n.count}</td><td>{n.detail}</td></tr>)}</tbody></table></div>
            <details className="reportNotesDetails"><summary>Tüm kontrol notlarını aç ({uniqueNotes.length})</summary><div className="tableScroll"><table><thead><tr><th>İlgili kayıt</th><th>Kontrol notu</th><th>İşlem</th></tr></thead><tbody>{uniqueNotes.map((n,i)=><tr key={i}><td>{n.subject}</td><td>{n.detail}</td><td><Link href={n.href}>Kontrol et →</Link></td></tr>)}{!uniqueNotes.length && <tr><td colSpan={3}>Eksik bulunmadı.</td></tr>}</tbody></table></div></details>
          </article>
        </section>

        {reportSettings?.values.report_footer ? <div className="reportFootnote">{String(reportSettings.values.report_footer)}</div> : null}
        <div className="reportFootnote">Rapor aralığı: <strong>{dateLabel(from)}</strong> – <strong>{dateLabel(to)}</strong>. Veriler doğrudan SprintOS modüllerinde kullanılan kayıtlardan okunur; rapor açılırken ders bakiyesi ortak senkronizasyonla doğrulanır. Eğitmen ders sayısı yalnızca eğitmeni kaydedilmiş yoklamaları kapsar.</div>
      </div>
    </main>
  );
}
