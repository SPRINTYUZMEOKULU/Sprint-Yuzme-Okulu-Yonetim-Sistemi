import Link from "next/link";
import UstGezinme from "@/app/components/UstGezinme";
import { requireProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type PendingItem = {
  studentId: string;
  studentNumber: string | null;
  name: string;
  plannedEndDate: string | null;
  remainingLessons: number;
  reason: string;
  passiveRequestPending: boolean;
};

type CompletedItem = {
  id: string;
  studentId: string | null;
  studentName: string;
  action: "renewed" | "passive";
  actionLabel: string;
  completedAt: string | null;
  completedBy: string;
  description: string;
};

function todayIstanbul() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function fmt(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value.length === 10 ? `${value}T12:00:00+03:00` : value);
  return Number.isNaN(d.getTime())
    ? value
    : new Intl.DateTimeFormat("tr-TR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: value.length > 10 ? "2-digit" : undefined,
        minute: value.length > 10 ? "2-digit" : undefined,
      }).format(d);
}

export default async function RegistrationDecisionTrackingPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const profile = await requireProfile([
    "owner",
    "admin",
    "branch_manager",
    "registration_staff",
    "accounting",
  ]);

  const params = await searchParams;
  const activeTab = params.tab === "completed" ? "completed" : "pending";
  const supabase = await createClient();
  const organizationId = profile.organization_id;

  if (!organizationId) {
    return (
      <>
        <UstGezinme />
        <main className="decisionPage"><div className="empty">Organizasyon bilgisi bulunamadı.</div></main>
      </>
    );
  }

  const [studentsRes, enrollmentsRes, balancesRes, statusRequestsRes, renewalLogsRes] =
    await Promise.all([
      supabase
        .from("students")
        .select("id,first_name,last_name,student_number,status,is_deleted")
        .eq("organization_id", organizationId)
        .eq("is_deleted", false),
      supabase
        .from("student_enrollments")
        .select("id,student_id,total_lessons,used_lessons,planned_end_date,status,created_at")
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false }),
      supabase
        .from("student_lesson_balance")
        .select("student_id,compensation_lesson_balance"),
      supabase
        .from("student_status_change_requests")
        .select("*")
        .eq("organization_id", organizationId)
        .eq("request_type", "deactivate")
        .order("created_at", { ascending: false })
        .limit(300),
      supabase
        .from("student_activity_logs")
        .select("id,student_id,title,description,new_value,performed_at,performed_by")
        .eq("organization_id", organizationId)
        .eq("activity_type", "registration_renewed")
        .order("performed_at", { ascending: false })
        .limit(300),
    ]);

  const students = (studentsRes.data || []) as any[];
  const studentMap = new Map(
    students.map((s) => [
      s.id,
      {
        name: `${s.first_name || ""} ${s.last_name || ""}`.trim() || "Kursiyer",
        number: s.student_number || null,
        status: s.status,
      },
    ]),
  );

  const latestEnrollment = new Map<string, any>();
  for (const row of (enrollmentsRes.data || []) as any[]) {
    if (!latestEnrollment.has(row.student_id)) latestEnrollment.set(row.student_id, row);
  }

  const balanceMap = new Map(
    ((balancesRes.data || []) as any[]).map((row) => [
      row.student_id,
      Number(row.compensation_lesson_balance || 0),
    ]),
  );

  const statusRequests = (statusRequestsRes.data || []) as any[];
  const pendingPassive = new Set(
    statusRequests.filter((r) => r.status === "pending").map((r) => r.student_id),
  );

  const today = todayIstanbul();
  const pending: PendingItem[] = students
    .filter((student) => student.status === "active")
    .flatMap((student) => {
      const enrollment = latestEnrollment.get(student.id);
      if (!enrollment || enrollment.status !== "active") return [];
      const total = Number(enrollment.total_lessons || 0);
      const used = Number(enrollment.used_lessons || 0);
      const compensation = Number(balanceMap.get(student.id) || 0);
      const remaining = Math.max(total - used, 0) + Math.max(compensation, 0);
      const endDate = enrollment.planned_end_date || null;
      const endedByRights = total > 0 && remaining <= 0;
      const endedByDate = Boolean(endDate && endDate <= today);
      if (!endedByRights && !endedByDate) return [];

      return [
        {
          studentId: student.id,
          studentNumber: student.student_number || null,
          name: `${student.first_name || ""} ${student.last_name || ""}`.trim() || "Kursiyer",
          plannedEndDate: endDate,
          remainingLessons: remaining,
          reason: endedByRights ? "Ders hakkı tamamlandı" : "Kayıt dönemi sona erdi",
          passiveRequestPending: pendingPassive.has(student.id),
        },
      ];
    })
    .sort((a, b) =>
      String(a.plannedEndDate || "9999-12-31").localeCompare(
        String(b.plannedEndDate || "9999-12-31"),
      ),
    );

  const renewalLogs = (renewalLogsRes.data || []) as any[];
  const actorIds = Array.from(
    new Set(renewalLogs.map((row) => row.performed_by).filter(Boolean)),
  );
  const actorMap = new Map<string, string>();
  if (actorIds.length) {
    const { data: actors } = await supabase
      .from("profiles")
      .select("id,full_name")
      .in("id", actorIds);
    for (const actor of (actors || []) as any[]) {
      actorMap.set(actor.id, actor.full_name || "Kullanıcı");
    }
  }

  const completedRenewals: CompletedItem[] = renewalLogs.map((row) => ({
    id: `renewed-${row.id}`,
    studentId: row.student_id || null,
    studentName: studentMap.get(row.student_id)?.name || "Kursiyer",
    action: "renewed",
    actionLabel: "Kayıt yenilendi",
    completedAt: row.performed_at || null,
    completedBy: actorMap.get(row.performed_by) || "Sistem / kullanıcı",
    description: row.description || row.title || "Yeni kayıt dönemi oluşturuldu.",
  }));

  const completedPassives: CompletedItem[] = statusRequests
    .filter((row) => ["approved", "completed", "applied"].includes(String(row.status || "")))
    .map((row) => ({
      id: `passive-${row.id || `${row.student_id}-${row.created_at}`}`,
      studentId: row.student_id || null,
      studentName: studentMap.get(row.student_id)?.name || "Kursiyer",
      action: "passive" as const,
      actionLabel: "Pasife alındı",
      completedAt: row.applied_at || row.reviewed_at || row.updated_at || row.created_at || null,
      completedBy: row.reviewed_by_name || row.approved_by_name || "Yönetici",
      description: row.reason || row.description || "Kayıt yenilenmediği için pasife alındı.",
    }));

  const completed = [...completedRenewals, ...completedPassives].sort((a, b) =>
    String(b.completedAt || "").localeCompare(String(a.completedAt || "")),
  );

  const renewedCount = completed.filter((x) => x.action === "renewed").length;
  const passiveCount = completed.filter((x) => x.action === "passive").length;
  const totalTracked = pending.length + completed.length;
  const completionRate = totalTracked ? Math.round((completed.length / totalTracked) * 100) : 100;

  return (
    <>
      <UstGezinme />
      <main className="decisionPage">
        <section className="hero">
          <div>
            <span>SPRİNTOS · İŞLEM TAKİP MERKEZİ</span>
            <h1>Kayıt Kararları</h1>
            <p>Kayıt yenileme veya pasife alma kararı gereken kursiyerleri ve tamamlanan işlemleri tek ekrandan takip edin.</p>
          </div>
          <Link href="/kayit-yenilemeleri">Kayıt Yenileme Merkezi →</Link>
        </section>

        <section className="stats">
          <Link className={activeTab === "pending" ? "on" : ""} href="/kayit-kararlari?tab=pending">
            <span>Bekleyen</span><strong>{pending.length}</strong><small>Karar / işlem gerekiyor</small>
          </Link>
          <Link className={activeTab === "completed" ? "on" : ""} href="/kayit-kararlari?tab=completed">
            <span>Tamamlanan</span><strong>{completed.length}</strong><small>İşlem sonucu kayıtlı</small>
          </Link>
          <div><span>Yenilenen</span><strong>{renewedCount}</strong><small>Yeni dönem açıldı</small></div>
          <div><span>Pasife Alınan</span><strong>{passiveCount}</strong><small>Devam etmiyor</small></div>
        </section>

        <section className="progressCard">
          <div><span>İŞLEM İLERLEMESİ</span><strong>{completionRate}% tamamlandı</strong></div>
          <div className="progressTrack"><i style={{ width: `${completionRate}%` }} /></div>
          <small>{totalTracked} takip kaydının {completed.length} tanesi tamamlandı, {pending.length} tanesi bekliyor.</small>
        </section>

        {activeTab === "pending" ? (
          <section className="panel">
            <header><div><span>BEKLEYEN KARARLAR</span><h2>İşlem gerektiren kursiyerler</h2></div><b>{pending.length} açık işlem</b></header>
            <div className="cards">
              {pending.map((item) => (
                <article key={item.studentId}>
                  <div className="cardTop"><div><small>{item.studentNumber || "ÖĞRENCİ NO YOK"}</small><h3>{item.name}</h3></div><em>BEKLİYOR</em></div>
                  <p>{item.reason}. Devam edecekse kayıt yenilenmeli; devam etmeyecekse pasife alınmalıdır.</p>
                  <small className="meta">Bitiş: {fmt(item.plannedEndDate)} · Kalan ders: {item.remainingLessons}</small>
                  <footer>
                    <Link className="renew" href={`/ogrenciler/${item.studentId}?renewal=1`}>↻ Kayıt Yenile</Link>
                    <Link className="passive" href={`/ogrenciler/pasif-merkezi?studentId=${item.studentId}`}>{item.passiveRequestPending ? "Pasife Alma Onay Bekliyor" : "Pasife Al"}</Link>
                    <Link href={`/ogrenciler/${item.studentId}`}>Dosyayı Aç</Link>
                  </footer>
                </article>
              ))}
            </div>
            {!pending.length ? <div className="empty">Bekleyen kayıt kararı bulunmuyor. Tüm işlemler tamamlanmış görünüyor.</div> : null}
          </section>
        ) : (
          <section className="panel">
            <header><div><span>TAMAMLANAN İŞLEMLER</span><h2>Kayıt karar geçmişi</h2></div><b>{completed.length} tamamlandı</b></header>
            <div className="completedList">
              {completed.map((item) => (
                <article key={item.id}>
                  <div className={`doneIcon ${item.action}`}>{item.action === "renewed" ? "↻" : "✓"}</div>
                  <div className="doneBody">
                    <div className="doneTop"><h3>{item.studentName}</h3><em className={item.action}>{item.actionLabel}</em></div>
                    <p>{item.description}</p>
                    <small>{fmt(item.completedAt)} · İşlemi yapan: {item.completedBy}</small>
                  </div>
                  {item.studentId ? <Link href={`/ogrenciler/${item.studentId}`}>Dosya →</Link> : null}
                </article>
              ))}
            </div>
            {!completed.length ? <div className="empty">Henüz tamamlanan kayıt kararı bulunmuyor.</div> : null}
          </section>
        )}

        <style jsx>{`
          .decisionPage{min-height:100vh;padding:24px 28px 70px;background:linear-gradient(#f4f7fb,#edf3f9);color:#10284d;font-family:system-ui,-apple-system,"Segoe UI",sans-serif}.hero{max-width:1450px;margin:0 auto 16px;padding:24px 26px;border-radius:24px;background:linear-gradient(135deg,#082f59,#0c5f9f);color:#fff;display:flex;align-items:center;justify-content:space-between;gap:20px;box-shadow:0 16px 38px rgba(12,62,107,.18)}.hero span,.panel header span,.progressCard span{font-size:10px;font-weight:900;letter-spacing:.12em;color:#ffb43b}.hero h1{margin:6px 0 5px;font-size:30px}.hero p{margin:0;max-width:760px;color:#dceafb;line-height:1.5}.hero>a{min-height:44px;padding:0 16px;border:1px solid rgba(255,255,255,.3);border-radius:12px;color:#fff;text-decoration:none;font-weight:850;display:flex;align-items:center;background:rgba(255,255,255,.08)}.stats{max-width:1450px;margin:0 auto 16px;display:grid;grid-template-columns:repeat(4,1fr);gap:12px}.stats>a,.stats>div{padding:17px 18px;border:1px solid #d9e4ef;border-radius:18px;background:#fff;text-decoration:none;color:#17395f;box-shadow:0 8px 24px rgba(24,57,92,.05)}.stats .on{border-color:#2580d0;box-shadow:0 0 0 3px rgba(37,128,208,.1)}.stats span,.stats strong,.stats small{display:block}.stats span{font-size:11px;font-weight:850;color:#70839a}.stats strong{margin-top:4px;font-size:28px;color:#102e52}.stats small{margin-top:4px;color:#8798aa}.progressCard{max-width:1450px;margin:0 auto 16px;padding:18px 20px;border:1px solid #d8e5f1;border-radius:18px;background:#fff}.progressCard>div:first-child{display:flex;justify-content:space-between;align-items:center}.progressCard>div:first-child strong{color:#173d63}.progressTrack{height:10px;margin:12px 0 8px;border-radius:999px;background:#e7eef6;overflow:hidden}.progressTrack i{display:block;height:100%;border-radius:999px;background:linear-gradient(90deg,#168452,#1eae6b)}.progressCard small{color:#708398}.panel{max-width:1450px;margin:0 auto;padding:20px;border:1px solid #d9e4ef;border-radius:22px;background:#fff;box-shadow:0 10px 30px rgba(25,58,92,.06)}.panel>header{display:flex;align-items:center;justify-content:space-between;gap:14px;margin-bottom:16px}.panel header span{color:#1670c6}.panel h2{margin:4px 0 0;font-size:22px}.panel>header>b{padding:8px 11px;border-radius:999px;background:#edf6ff;color:#1768ad;font-size:12px}.cards{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.cards article{padding:17px;border:1px solid #e0e8f1;border-radius:17px;background:#fbfdff}.cardTop{display:flex;justify-content:space-between;gap:12px}.cardTop small{font-size:10px;font-weight:900;color:#1a73c8;letter-spacing:.08em}.cardTop h3{margin:4px 0 0}.cardTop em{height:max-content;padding:6px 9px;border-radius:999px;background:#fff1cc;color:#946000;font-size:9px;font-style:normal;font-weight:950}.cards p{color:#586d83;line-height:1.45}.meta{color:#8392a4}.cards footer{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}.cards footer a{min-height:38px;padding:0 12px;border:1px solid #d4e0ec;border-radius:10px;display:inline-flex;align-items:center;justify-content:center;text-decoration:none;color:#315a7e;font-weight:850;font-size:12px}.cards footer .renew{background:#176be2;border-color:#176be2;color:#fff}.cards footer .passive{background:#fff1f0;border-color:#efc4c0;color:#b42318}.completedList{display:grid;gap:10px}.completedList article{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:13px;padding:15px;border:1px solid #e0e8f1;border-radius:15px;background:#fbfdff}.doneIcon{width:42px;height:42px;border-radius:12px;display:grid;place-items:center;font-size:19px;font-weight:950}.doneIcon.renewed{background:#e8f2ff;color:#176bd0}.doneIcon.passive{background:#eaf8ef;color:#197547}.doneTop{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.doneTop h3{margin:0}.doneTop em{padding:5px 8px;border-radius:999px;font-style:normal;font-size:9px;font-weight:950}.doneTop em.renewed{background:#e8f2ff;color:#176bd0}.doneTop em.passive{background:#e8f7ee;color:#187347}.doneBody p{margin:5px 0;color:#5c7085}.doneBody small{color:#8292a4}.completedList article>a{color:#1768ad;text-decoration:none;font-weight:850}.empty{padding:28px;text-align:center;color:#71839a}.decisionPage :global(a){-webkit-tap-highlight-color:transparent}@media(max-width:900px){.stats{grid-template-columns:1fr 1fr}.cards{grid-template-columns:1fr}}@media(max-width:640px){.decisionPage{padding:14px 12px 60px}.hero{align-items:flex-start;flex-direction:column;padding:20px}.hero h1{font-size:25px}.hero>a{width:100%;box-sizing:border-box;justify-content:center}.stats{gap:8px}.stats>a,.stats>div{padding:14px}.stats strong{font-size:24px}.panel{padding:14px}.panel>header{align-items:flex-start;flex-direction:column}.completedList article{grid-template-columns:auto minmax(0,1fr)}.completedList article>a{grid-column:2}.cards footer a{flex:1 1 calc(50% - 5px)}}
        `}</style>
      </main>
    </>
  );
}
