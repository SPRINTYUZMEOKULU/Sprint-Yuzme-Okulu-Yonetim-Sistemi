import Link from "next/link";
import { requireProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import "../dashboard.css";

export const dynamic = "force-dynamic";

type StudentRow = {
  id: string;
  student_number: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  guardian_name: string | null;
  guardian_phone: string | null;
};
type EnrollmentRow = { student_id: string; group_id: string | null; branch_id: string | null; start_date: string | null; created_at: string | null };
type BranchRow = { id: string; name: string | null };
type GroupRow = { id: string; name: string | null; branch_id: string | null };
type ScheduleRow = { id: string; group_id: string | null; weekday: number | null; start_time: string | null; end_time: string | null };
type StartingStudent = {
  student: StudentRow;
  enrollment: EnrollmentRow;
  group: GroupRow | null;
  branchName: string;
  nextLesson: { date: string; startTime: string; endTime: string; scheduleId: string } | null;
};

function trToday() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const get = (type: string) => parts.find((p) => p.type === type)?.value || "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}
function addDays(date: string, days: number) {
  const d = new Date(`${date}T12:00:00+03:00`);
  d.setDate(d.getDate() + days);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}
function isoWeekday(date: string) {
  const n = new Date(`${date}T12:00:00+03:00`).getDay();
  return n === 0 ? 7 : n;
}
function formatDate(date: string) {
  return new Intl.DateTimeFormat("tr-TR", { timeZone: "Europe/Istanbul", day: "2-digit", month: "long", weekday: "long" }).format(new Date(`${date}T12:00:00+03:00`));
}

export default async function StartingStudentsPage() {
  const profile = await requireProfile(["owner", "admin", "branch_manager", "registration_staff", "accounting", "coach"]);
  const supabase = await createClient();
  const organizationId = profile.organization_id;
  const today = trToday();
  const tomorrow = addDays(today, 1);
  const weekEnd = addDays(today, 7);

  const [studentsResult, enrollmentsResult, attendanceResult, branchesResult, groupsResult, schedulesResult] = await Promise.all([
    supabase.from("students").select("id,student_number,first_name,last_name,phone,guardian_name,guardian_phone").eq("organization_id", organizationId).eq("status", "active").eq("is_deleted", false),
    supabase.from("student_enrollments").select("student_id,group_id,branch_id,start_date,created_at").eq("organization_id", organizationId).eq("status", "active").order("created_at", { ascending: false }),
    supabase.from("attendance_records").select("student_id").eq("organization_id", organizationId),
    supabase.from("branches").select("id,name").eq("organization_id", organizationId),
    supabase.from("training_groups").select("id,name,branch_id").eq("organization_id", organizationId),
    supabase.from("lesson_schedules").select("id,group_id,weekday,start_time,end_time").eq("organization_id", organizationId).eq("is_active", true),
  ]);

  const attended = new Set((attendanceResult.data || []).map((r: any) => String(r.student_id)));
  const enrollmentMap = new Map<string, EnrollmentRow>();
  for (const enrollment of (enrollmentsResult.data || []) as EnrollmentRow[]) {
    if (enrollment.student_id && !enrollmentMap.has(String(enrollment.student_id))) enrollmentMap.set(String(enrollment.student_id), enrollment);
  }
  const branchMap = new Map<string, string>(((branchesResult.data || []) as BranchRow[]).map((b) => [String(b.id), b.name || "Şube"]));
  const groupMap = new Map<string, GroupRow>(((groupsResult.data || []) as GroupRow[]).map((g) => [String(g.id), g]));
  const schedulesByGroup = new Map<string, ScheduleRow[]>();
  for (const schedule of (schedulesResult.data || []) as ScheduleRow[]) {
    const groupId = String(schedule.group_id || "");
    if (!groupId) continue;
    const rows = schedulesByGroup.get(groupId) || [];
    rows.push(schedule);
    schedulesByGroup.set(groupId, rows);
  }

  function nextLesson(groupId: string, startDate: string | null) {
    const schedules = schedulesByGroup.get(groupId) || [];
    if (!schedules.length) return null;
    const base = startDate && startDate > today ? startDate : today;
    for (let offset = 0; offset < 60; offset++) {
      const date = addDays(base, offset);
      const weekday = isoWeekday(date);
      const matches = schedules
        .filter((s) => Number(s.weekday) === weekday)
        .sort((a, b) => String(a.start_time || "").localeCompare(String(b.start_time || "")));
      if (matches.length) {
        const schedule = matches[0];
        return {
          date,
          startTime: String(schedule.start_time || "").slice(0, 5),
          endTime: String(schedule.end_time || "").slice(0, 5),
          scheduleId: schedule.id,
        };
      }
    }
    return null;
  }

  const starting: StartingStudent[] = ((studentsResult.data || []) as StudentRow[])
    .flatMap((student) => {
      if (attended.has(String(student.id))) return [];
      const enrollment = enrollmentMap.get(String(student.id));
      if (!enrollment) return [];
      const group = groupMap.get(String(enrollment.group_id || "")) || null;
      const branchName = branchMap.get(String(group?.branch_id || enrollment.branch_id || "")) || "Şube belirtilmemiş";
      return [{ student, enrollment, group, branchName, nextLesson: nextLesson(String(enrollment.group_id || ""), enrollment.start_date) }];
    })
    .sort((a, b) => {
      const ad = a.nextLesson?.date || "9999-12-31";
      const bd = b.nextLesson?.date || "9999-12-31";
      if (ad !== bd) return ad.localeCompare(bd);
      return String(a.nextLesson?.startTime || "").localeCompare(String(b.nextLesson?.startTime || ""));
    });

  const todayStudents = starting.filter((x) => x.nextLesson?.date === today);
  const tomorrowStudents = starting.filter((x) => x.nextLesson?.date === tomorrow);
  const comingStudents = starting.filter((x) => x.nextLesson && x.nextLesson.date > tomorrow && x.nextLesson.date <= weekEnd);
  const laterStudents = starting.filter((x) => x.nextLesson && x.nextLesson.date > weekEnd);
  const unscheduledStudents = starting.filter((x) => !x.nextLesson);

  const todaySlots = new Map<string, number>();
  for (const item of todayStudents) {
    const time = item.nextLesson?.startTime || "Saat yok";
    todaySlots.set(time, (todaySlots.get(time) || 0) + 1);
  }

  function StudentCard({ item }: { item: StartingStudent }) {
    const s = item.student;
    return (
      <article className="startingStudentCard">
        <div className="startingStudentMain">
          <div className="studentTopLine">
            <small>{s.student_number || "Kursiyer"}</small>
            {item.nextLesson ? <span className="lessonBadge">{item.nextLesson.startTime}</span> : <span className="lessonBadge warningBadge">Program yok</span>}
          </div>
          <h3>{s.first_name} {s.last_name}</h3>
          <p className="studentProgram">{item.branchName} · {item.group?.name || "Grup belirtilmemiş"}</p>
          {item.nextLesson ? <p className="lessonDate">İlk ders: <b>{formatDate(item.nextLesson.date)}</b> · {item.nextLesson.startTime}{item.nextLesson.endTime ? `–${item.nextLesson.endTime}` : ""}</p> : null}
          <p className="guardianLine">Veli: {s.guardian_name || "—"} · Tel: {s.guardian_phone || s.phone || "—"}</p>
        </div>
        <div className="startingStudentActions">
          <Link className="primaryAction" href={`/ogrenciler/${s.id}`}>Öğrenci Dosyası</Link>
          <Link href="/yoklama">Yoklamaya Git</Link>
        </div>
      </article>
    );
  }

  function StudentSection({ title, subtitle, items, accent = false }: { title: string; subtitle: string; items: StartingStudent[]; accent?: boolean }) {
    return (
      <section className={`startingGroup ${accent ? "startingGroupToday" : ""}`}>
        <div className="startingGroupHead">
          <div>
            <p>{subtitle}</p>
            <h2>{title}</h2>
          </div>
          <strong>{items.length}</strong>
        </div>
        {items.length ? <div className="startingStudentGrid">{items.map((item) => <StudentCard key={item.student.id} item={item} />)}</div> : <div className="tableEmpty">Bu bölümde kursiyer bulunmuyor.</div>}
      </section>
    );
  }

  return (
    <main className="operationPage startingPage">
      <header className="operationHeader">
        <div>
          <p>SPRİNTOS · ÖĞRENCİ YÖNETİMİ</p>
          <h1>Başlayacak Kursiyerler</h1>
          <span>İlk dersini bekleyen kursiyerleri tarih ve seans saatine göre takip edin.</span>
        </div>
        <div className="operationActions">
          <Link href="/ogrenciler">Öğrenci Merkezi</Link>
          <Link href="/yoklama">Yoklama</Link>
        </div>
      </header>

      <section className="startingOverview">
        <div className="overviewPrimary">
          <span>BUGÜN</span>
          <strong>{todayStudents.length}</strong>
          <p>kursiyer ilk dersine başlayacak</p>
        </div>
        <div className="overviewCard"><span>YARIN</span><strong>{tomorrowStudents.length}</strong><p>kursiyer</p></div>
        <div className="overviewCard"><span>7 GÜN İÇİNDE</span><strong>{comingStudents.length}</strong><p>kursiyer</p></div>
        <div className="overviewCard"><span>TOPLAM BEKLEYEN</span><strong>{starting.length}</strong><p>kursiyer</p></div>
      </section>

      {todayStudents.length ? (
        <section className="todayAlertCard">
          <div>
            <span className="todayAlertIcon">↗</span>
            <div><b>Bugünün başlangıç planı hazır</b><p>Her seans için dersten 1 saat önce SprintOS bildirim merkezine otomatik uyarı düşer.</p></div>
          </div>
          <div className="slotPills">{[...todaySlots.entries()].map(([time, count]) => <span key={time}>{time} · {count} kursiyer</span>)}</div>
        </section>
      ) : null}

      <div className="startingSections">
        <StudentSection title="Bugün Başlayacaklar" subtitle="ÖNCELİKLİ TAKİP" items={todayStudents} accent />
        <StudentSection title="Yarın Başlayacaklar" subtitle="YARIN" items={tomorrowStudents} />
        <StudentSection title="Önümüzdeki 7 Gün" subtitle="YAKLAŞAN BAŞLANGIÇLAR" items={comingStudents} />
        {(laterStudents.length > 0 || unscheduledStudents.length > 0) ? (
          <details className="laterDetails">
            <summary>Diğer Zamanlar <span>{laterStudents.length + unscheduledStudents.length}</span></summary>
            <div className="laterContent">
              {laterStudents.length ? <StudentSection title="Daha Sonra Başlayacaklar" subtitle="İLERİ TARİH" items={laterStudents} /> : null}
              {unscheduledStudents.length ? <StudentSection title="Programı Eksik Kursiyerler" subtitle="KONTROL GEREKİYOR" items={unscheduledStudents} /> : null}
            </div>
          </details>
        ) : null}
      </div>

      <style>{`
        .startingPage{padding-bottom:44px}.startingOverview{display:grid;grid-template-columns:1.4fr repeat(3,1fr);gap:12px;margin:18px 0}.overviewPrimary,.overviewCard{border:1px solid #dce6f2;border-radius:18px;background:#fff;padding:18px 20px;box-shadow:0 8px 24px rgba(15,50,90,.04)}.overviewPrimary{background:linear-gradient(135deg,#1674ed,#0f62d7);color:#fff;border-color:transparent}.overviewPrimary span,.overviewCard span{font-size:11px;font-weight:900;letter-spacing:.08em}.overviewPrimary strong,.overviewCard strong{display:block;font-size:34px;line-height:1.05;margin:8px 0 2px}.overviewCard strong{color:#10284d}.overviewPrimary p,.overviewCard p{margin:0;font-size:13px}.overviewCard p{color:#7789a3}.todayAlertCard{display:flex;align-items:center;justify-content:space-between;gap:18px;margin-bottom:16px;padding:16px 18px;border:1px solid #bcd8ff;border-radius:18px;background:#f4f9ff}.todayAlertCard>div:first-child{display:flex;align-items:center;gap:12px}.todayAlertIcon{display:grid;place-items:center;width:38px;height:38px;border-radius:12px;background:#1674ed;color:#fff;font-weight:900}.todayAlertCard b{color:#10284d}.todayAlertCard p{margin:3px 0 0;color:#617690;font-size:13px}.slotPills{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}.slotPills span{padding:8px 10px;border-radius:999px;background:#fff;border:1px solid #cfe0f7;color:#15375f;font-size:12px;font-weight:850}.startingSections{display:grid;gap:16px}.startingGroup{padding:20px;border:1px solid #dce6f2;border-radius:22px;background:#fff}.startingGroupToday{border-color:#b7d5ff;box-shadow:0 10px 30px rgba(22,116,237,.07)}.startingGroupHead{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:15px}.startingGroupHead p{margin:0 0 3px;color:#1674ed;font-size:11px;font-weight:900;letter-spacing:.08em}.startingGroupHead h2{margin:0;color:#10284d;font-size:24px}.startingGroupHead strong{min-width:42px;height:42px;display:grid;place-items:center;border-radius:13px;background:#edf5ff;color:#1674ed;font-size:18px}.startingStudentGrid{display:grid;gap:12px}.startingStudentCard{display:flex;justify-content:space-between;gap:18px;padding:17px 18px;border:1px solid #dce6f2;border-radius:17px;background:#fff}.studentTopLine{display:flex;align-items:center;gap:8px}.startingStudentCard small{font-weight:900;color:#1474e8}.lessonBadge{display:inline-flex;padding:4px 8px;border-radius:999px;background:#edf5ff;color:#1268d8;font-size:11px;font-weight:900}.warningBadge{background:#fff4df;color:#a96500}.startingStudentCard h3{margin:6px 0 6px;font-size:20px;color:#10284d}.startingStudentCard p{margin:4px 0}.studentProgram,.guardianLine{color:#71839c}.lessonDate{color:#344e70;font-size:13px}.startingStudentActions{display:flex;align-items:center;gap:8px}.startingStudentActions a{padding:11px 14px;border:1px solid #d6e2f0;border-radius:12px;color:#15375f;text-decoration:none;font-weight:850;white-space:nowrap}.startingStudentActions .primaryAction{background:#1674ed;color:#fff;border-color:#1674ed}.laterDetails{border:1px solid #dce6f2;border-radius:18px;background:#fff;overflow:hidden}.laterDetails summary{display:flex;align-items:center;justify-content:space-between;padding:17px 20px;color:#17365d;font-weight:900;cursor:pointer;list-style:none}.laterDetails summary::-webkit-details-marker{display:none}.laterDetails summary span{display:grid;place-items:center;min-width:32px;height:32px;padding:0 8px;border-radius:10px;background:#f0f5fb;color:#56708f}.laterContent{display:grid;gap:14px;padding:0 14px 14px}.laterContent .startingGroup{box-shadow:none}
        @media(max-width:900px){.startingOverview{grid-template-columns:1fr 1fr}.todayAlertCard{align-items:flex-start;flex-direction:column}.slotPills{justify-content:flex-start}}
        @media(max-width:700px){.startingOverview{grid-template-columns:1fr 1fr;gap:9px}.overviewPrimary,.overviewCard{padding:14px}.overviewPrimary strong,.overviewCard strong{font-size:29px}.overviewPrimary p,.overviewCard p{font-size:12px}.startingGroup{padding:15px}.startingGroupHead h2{font-size:20px}.startingStudentCard{display:block;padding:16px}.startingStudentActions{margin-top:14px}.startingStudentActions a{flex:1;text-align:center;padding:11px 8px}.todayAlertCard{padding:14px}.slotPills span{font-size:11px}}
      `}</style>
    </main>
  );
}
