import Link from "next/link";
import { requireProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import "./reports.css";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | undefined>;

type Branch = { id: string; name: string };
type Group = { id: string; branch_id: string | null; name: string; primary_coach_id: string | null };
type Student = { id: string; first_name: string | null; last_name: string | null; status: string | null; branch_id: string | null };
type Enrollment = { id: string; student_id: string; branch_id: string | null; group_id: string | null; start_date: string | null; planned_end_date: string | null; total_lessons: number | null; used_lessons: number | null; status: string | null };
type Attendance = { id: string; student_id: string; group_id: string | null; schedule_id: string | null; coach_id: string | null; lesson_date: string; status: string | null };
type Payment = { id: string; student_id: string | null; amount: number | string | null; payment_status: string | null; payment_method: string | null; received_at: string | null; cancelled_at: string | null };
type Profile = { id: string; full_name: string | null; role: string | null };
type Schedule = { id: string; branch_id: string | null; group_id: string | null; coach_id: string | null };

function isoToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function isIsoDate(value?: string) {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
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
  const params = await searchParams;
  const today = isoToday();
  const monthStart = `${today.slice(0, 7)}-01`;
  const from = isIsoDate(params.from) ? params.from! : monthStart;
  const to = isIsoDate(params.to) ? params.to! : today;
  const requestedBranch = params.branch || "all";

  if (!organizationId) {
    return <main className="reportsShell"><div className="reportsError">Kurum bilgisi bulunamadı.</div></main>;
  }

  const supabase = await createClient();

  const [branchesResult, groupsResult, studentsResult, enrollmentsResult, attendanceResult, paymentsResult, profilesResult, schedulesResult] = await Promise.all([
    supabase.from("branches").select("id,name").eq("organization_id", organizationId).order("name"),
    supabase.from("training_groups").select("id,branch_id,name,primary_coach_id").eq("organization_id", organizationId).order("name"),
    supabase.from("students").select("id,first_name,last_name,status,branch_id").eq("organization_id", organizationId).eq("is_deleted", false),
    supabase.from("student_enrollments").select("id,student_id,branch_id,group_id,start_date,planned_end_date,total_lessons,used_lessons,status").eq("organization_id", organizationId),
    supabase.from("attendance_records").select("id,student_id,group_id,schedule_id,coach_id,lesson_date,status").eq("organization_id", organizationId).gte("lesson_date", from).lte("lesson_date", to),
    supabase.from("student_payments").select("id,student_id,amount,payment_status,payment_method,received_at,cancelled_at").eq("organization_id", organizationId).gte("received_at", `${from}T00:00:00`).lte("received_at", `${to}T23:59:59`),
    supabase.from("profiles").select("id,full_name,role").eq("organization_id", organizationId).eq("role", "coach"),
    supabase.from("lesson_schedules").select("id,branch_id,group_id,coach_id").eq("organization_id", organizationId).eq("is_active", true),
  ]);

  const loadError = branchesResult.error || groupsResult.error || studentsResult.error || enrollmentsResult.error || attendanceResult.error || paymentsResult.error || profilesResult.error || schedulesResult.error;
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

  const branchId = requestedBranch !== "all" && branches.some((b) => b.id === requestedBranch) ? requestedBranch : "all";
  const branchMap = new Map(branches.map((b) => [b.id, b.name]));
  const groupMap = new Map(groups.map((g) => [g.id, g]));
  const studentMap = new Map(students.map((s) => [s.id, s]));
  const coachMap = new Map(coaches.map((c) => [c.id, c.full_name || "İsimsiz antrenör"]));
  const scheduleMap = new Map(schedules.map((s) => [s.id, s]));

  const filteredEnrollments = enrollments.filter((e) => branchId === "all" || e.branch_id === branchId);
  const relevantStudentIds = new Set(filteredEnrollments.map((e) => e.student_id));
  const filteredAttendance = attendance.filter((a) => {
    if (branchId === "all") return true;
    const schedule = a.schedule_id ? scheduleMap.get(a.schedule_id) : null;
    const group = a.group_id ? groupMap.get(a.group_id) : null;
    return schedule?.branch_id === branchId || group?.branch_id === branchId || relevantStudentIds.has(a.student_id);
  });
  const filteredPayments = payments.filter((p) => branchId === "all" || (p.student_id ? relevantStudentIds.has(p.student_id) : false));

  const activeEnrollments = filteredEnrollments.filter((e) => e.status === "active");
  const activeStudentIds = new Set(activeEnrollments.map((e) => e.student_id));
  const activeStudents = students.filter((s) => activeStudentIds.has(s.id));
  const presentCount = filteredAttendance.filter((a) => statusIsPresent(a.status)).length;
  const absentCount = filteredAttendance.filter((a) => statusIsAbsent(a.status)).length;
  const attendanceBase = presentCount + absentCount;
  const attendanceRate = attendanceBase ? (presentCount / attendanceBase) * 100 : 0;
  const validPayments = filteredPayments.filter((p) => !p.cancelled_at && !["cancelled", "canceled", "void"].includes(String(p.payment_status || "").toLowerCase()));
  const collectionTotal = validPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const remainingLessons = activeEnrollments.reduce((sum, e) => sum + Math.max(0, Number(e.total_lessons || 0) - Number(e.used_lessons || 0)), 0);

  const branchRows = branches
    .filter((b) => branchId === "all" || b.id === branchId)
    .map((branch) => {
      const branchEnrollments = enrollments.filter((e) => e.branch_id === branch.id && e.status === "active");
      const studentIds = new Set(branchEnrollments.map((e) => e.student_id));
      const branchAttendance = attendance.filter((a) => {
        const schedule = a.schedule_id ? scheduleMap.get(a.schedule_id) : null;
        const group = a.group_id ? groupMap.get(a.group_id) : null;
        return schedule?.branch_id === branch.id || group?.branch_id === branch.id || studentIds.has(a.student_id);
      });
      const p = branchAttendance.filter((a) => statusIsPresent(a.status)).length;
      const a = branchAttendance.filter((row) => statusIsAbsent(row.status)).length;
      const branchPayments = payments.filter((payment) => payment.student_id && studentIds.has(payment.student_id) && !payment.cancelled_at && !["cancelled", "canceled", "void"].includes(String(payment.payment_status || "").toLowerCase()));
      return {
        id: branch.id,
        name: branch.name,
        students: studentIds.size,
        groups: groups.filter((g) => g.branch_id === branch.id).length,
        attendance: p + a ? (p / (p + a)) * 100 : 0,
        collection: branchPayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0),
      };
    })
    .sort((a, b) => b.students - a.students);

  const coachRows = coaches.map((coach) => {
    const coachAttendance = filteredAttendance.filter((a) => a.coach_id === coach.id || (a.schedule_id && scheduleMap.get(a.schedule_id)?.coach_id === coach.id));
    const uniqueLessons = new Set(coachAttendance.map((a) => `${a.lesson_date}:${a.schedule_id || a.group_id || "lesson"}`));
    const p = coachAttendance.filter((a) => statusIsPresent(a.status)).length;
    const a = coachAttendance.filter((row) => statusIsAbsent(row.status)).length;
    const assignedGroups = new Set(groups.filter((g) => g.primary_coach_id === coach.id && (branchId === "all" || g.branch_id === branchId)).map((g) => g.id));
    return { id: coach.id, name: coach.full_name || "İsimsiz antrenör", lessons: uniqueLessons.size, students: p + a, attendance: p + a ? (p / (p + a)) * 100 : 0, groups: assignedGroups.size };
  }).filter((row) => row.lessons > 0 || row.groups > 0).sort((a, b) => b.lessons - a.lessons || a.name.localeCompare(b.name, "tr"));

  const studentRows = activeStudents.map((student) => {
    const enrollment = activeEnrollments.find((e) => e.student_id === student.id);
    const records = filteredAttendance.filter((a) => a.student_id === student.id);
    const p = records.filter((a) => statusIsPresent(a.status)).length;
    const a = records.filter((row) => statusIsAbsent(row.status)).length;
    return {
      id: student.id,
      name: `${student.first_name || ""} ${student.last_name || ""}`.trim(),
      branch: branchMap.get(enrollment?.branch_id || student.branch_id || "") || "—",
      group: groupMap.get(enrollment?.group_id || "")?.name || "—",
      used: Number(enrollment?.used_lessons || 0),
      total: Number(enrollment?.total_lessons || 0),
      attendance: p + a ? (p / (p + a)) * 100 : 0,
    };
  }).sort((a, b) => a.name.localeCompare(b.name, "tr"));

  const methodRows = Array.from(validPayments.reduce((map, payment) => {
    const method = String(payment.payment_method || "Belirtilmedi");
    map.set(method, (map.get(method) || 0) + Number(payment.amount || 0));
    return map;
  }, new Map<string, number>()).entries()).sort((a, b) => b[1] - a[1]);

  return (
    <main className="reportsShell">
      <div className="reportsWrap">
        <header className="reportsHeader">
          <div><p className="reportsEyebrow">SPRİNT YÜZME OKULU · CANLI RAPORLAR</p><h1>Raporlar</h1><p>Öğrenci, şube, yoklama, tahsilat ve antrenör verileri tek merkezde.</p></div>
          <div className="reportsHeaderActions"><Link href="/" className="reportSecondary">← Yönetim paneli</Link><Link href="/odemeler" className="reportPrimary">Ödeme merkezini aç</Link></div>
        </header>

        <form className="reportFilters" method="get">
          <label><span>Başlangıç</span><input type="date" name="from" defaultValue={from} /></label>
          <label><span>Bitiş</span><input type="date" name="to" defaultValue={to} /></label>
          <label><span>Şube</span><select name="branch" defaultValue={branchId}><option value="all">Tüm şubeler</option>{branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
          <button type="submit">Raporu getir</button>
        </form>

        <section className="kpiGrid">
          <article className="kpiCard"><span>Aktif öğrenci</span><strong>{activeStudentIds.size}</strong><small>{activeEnrollments.length} aktif kayıt</small></article>
          <article className="kpiCard"><span>Dönem tahsilatı</span><strong>{money(collectionTotal)}</strong><small>{validPayments.length} ödeme kaydı</small></article>
          <article className="kpiCard"><span>Katılım oranı</span><strong>{pct(attendanceRate)}</strong><small>{presentCount} katıldı · {absentCount} gelmedi</small></article>
          <article className="kpiCard"><span>Kalan ders</span><strong>{remainingLessons}</strong><small>Aktif paketlerin toplamı</small></article>
        </section>

        <section className="reportsGrid">
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
            <div className="coachList">{coachRows.length ? coachRows.slice(0, 10).map((row) => <div className="coachRow" key={row.id}><div><strong>{row.name}</strong><span>{row.groups} grup · {row.lessons} ders</span></div><b>{pct(row.attendance)}</b></div>) : <div className="emptyBox">Seçilen dönemde antrenör ders verisi yok.</div>}</div>
          </article>

          <article className="reportPanel reportPanelWide">
            <div className="panelHead"><div><span className="panelKicker">ÖĞRENCİ RAPORU</span><h2>Aktif kursiyer özeti</h2></div><Link href="/ogrenciler">Öğrenci merkezini aç →</Link></div>
            <div className="tableScroll"><table><thead><tr><th>Öğrenci</th><th>Şube</th><th>Grup</th><th>Ders kullanımı</th><th>Dönem katılımı</th><th></th></tr></thead><tbody>{studentRows.length ? studentRows.slice(0, 100).map((row) => <tr key={row.id}><td><strong>{row.name || "İsimsiz öğrenci"}</strong></td><td>{row.branch}</td><td>{row.group}</td><td>{row.used}/{row.total || "—"}</td><td>{pct(row.attendance)}</td><td><Link className="detailLink" href={`/ogrenciler/${row.id}`}>Dosya →</Link></td></tr>) : <tr><td colSpan={6} className="emptyCell">Aktif öğrenci bulunamadı.</td></tr>}</tbody></table></div>
          </article>
        </section>

        <div className="reportFootnote">Rapor aralığı: <strong>{from}</strong> – <strong>{to}</strong>. Veriler doğrudan SprintOS modüllerinde kullanılan Supabase tablolarından okunur; rapor ekranı kayıt değiştirmez.</div>
      </div>
    </main>
  );
}
