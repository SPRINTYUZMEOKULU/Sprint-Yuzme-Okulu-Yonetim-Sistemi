import Link from "next/link";
import { requireProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import { reopenAlert, resolveAlert } from "./actions";
import "./uyarilar.css";

export const dynamic = "force-dynamic";

type AlertRow = Record<string, unknown> & { id: string; status?: string | null; created_at?: string | null };
const roles = ["owner", "admin", "branch_manager", "registration_staff", "accounting", "coach"] as const;

function text(row: AlertRow, keys: string[], fallback = "—") {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return fallback;
}

function severity(row: AlertRow) {
  const value = text(row, ["severity", "priority", "level", "alert_type", "type"], "info").toLowerCase();
  if (value.includes("critical") || value.includes("urgent") || value.includes("error")) return "critical";
  if (value.includes("warn") || value.includes("payment") || value.includes("renew")) return "warning";
  return "info";
}

function formatAlertDate(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  try {
    return new Intl.DateTimeFormat("tr-TR", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Istanbul" }).format(date);
  } catch {
    return null;
  }
}

function turkeyToday() {
  const formatter = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit", day: "2-digit" });
  const parts = Object.fromEntries(formatter.formatToParts(new Date()).map((part) => [part.type, part.value]));
  const iso = `${parts.year}-${parts.month}-${parts.day}`;
  const day = new Date(`${iso}T12:00:00+03:00`).getDay();
  return { iso, weekday: day === 0 ? 7 : day };
}

export default async function AlertsPage() {
  const profile = await requireProfile([...roles]);
  const supabase = await createClient();
  const today = turkeyToday();

  const [alertsResult, schedulesResult, enrollmentsResult, attendanceResult, approvalsResult, cashResult, preregResult] = await Promise.all([
    supabase.from("alerts").select("*").eq("organization_id", profile.organization_id).order("created_at", { ascending: false }).limit(100),
    supabase.from("lesson_schedules").select("id,group_id").eq("organization_id", profile.organization_id).eq("weekday", today.weekday).eq("is_active", true),
    supabase.from("student_enrollments").select("student_id,group_id").eq("organization_id", profile.organization_id).eq("status", "active"),
    supabase.from("attendance_records").select("student_id,group_id,schedule_id").eq("organization_id", profile.organization_id).eq("lesson_date", today.iso),
    supabase.from("approval_requests").select("id", { count: "exact", head: true }).eq("organization_id", profile.organization_id).eq("status", "pending"),
    supabase.from("payments").select("id", { count: "exact", head: true }).eq("organization_id", profile.organization_id).eq("cash_status", "handoff_pending"),
    supabase.from("students").select("id", { count: "exact", head: true }).eq("organization_id", profile.organization_id).eq("status", "pre_registration"),
  ]);

  const alerts = ((alertsResult.data || []) as AlertRow[]);
  const open = alerts.filter((item) => ["open", "in_progress"].includes(item.status || "open"));
  const resolved = alerts.filter((item) => (item.status || "open") !== "open");
  const schedules = schedulesResult.data || [];
  const enrollments = enrollmentsResult.data || [];
  const attendance = attendanceResult.data || [];

  const enrolledByGroup = new Map<string, Set<string>>();
  for (const enrollment of enrollments) {
    if (!enrollment.group_id) continue;
    if (!enrolledByGroup.has(enrollment.group_id)) enrolledByGroup.set(enrollment.group_id, new Set());
    enrolledByGroup.get(enrollment.group_id)?.add(enrollment.student_id);
  }

  const pendingAttendance = schedules.filter((schedule) => {
    const enrolled = enrolledByGroup.get(schedule.group_id || "") || new Set<string>();
    const recorded = new Set(attendance.filter((row) => row.schedule_id === schedule.id || (!row.schedule_id && row.group_id === schedule.group_id)).map((row) => row.student_id));
    return !(enrolled.size > 0 && recorded.size >= enrolled.size);
  }).length;

  const pendingApprovals = approvalsResult.count || 0;
  const pendingCash = cashResult.count || 0;
  const preRegistrations = preregResult.count || 0;
  const actionCount = pendingAttendance + pendingApprovals + pendingCash + open.length;

  const operations = [
    { label: "Yoklama Bekleyen", value: pendingAttendance, note: pendingAttendance ? "Bugünkü seanslarda yoklama tamamlanmalı" : "Bugünkü yoklamalar tamamlandı", href: "/yoklama", tone: "orange", action: "Yoklamaya Git" },
    { label: "Yönetici Onayı", value: pendingApprovals, note: pendingApprovals ? "Onay bekleyen talepler bulunuyor" : "Bekleyen yönetici onayı yok", href: "/onay-merkezi", tone: "blue", action: "Onaylara Git" },
    { label: "Kasa Onayı", value: pendingCash, note: pendingCash ? "Kasa teslim onayı bekliyor" : "Bekleyen kasa teslimi yok", href: "/kasa", tone: "purple", action: "Kasaya Git" },
    { label: "Açık Uyarı", value: open.length, note: open.length ? "Sistem uyarıları işlem bekliyor" : "Açık sistem uyarısı yok", href: "#acik-uyarilar", tone: "red", action: "Uyarıları Gör" },
  ];

  return (
    <main className="alertsPage">
      <header className="alertsHero">
        <div>
          <p>SPRİNTOS · CANLI OPERASYON</p>
          <h1>Yapılacak İşlemler</h1>
          <span>Bugün dikkat gerektiren yoklama, yönetici onayı, kasa ve sistem uyarılarını tek merkezden takip edin.</span>
        </div>
        <div className="alertsHeroActions"><Link href="/">Ana Sayfa</Link><Link className="primary" href="/bildirimler">Bildirimleri Aç</Link></div>
      </header>

      <section className="operationSummary">
        <div><span>BUGÜN</span><strong>{actionCount ? `${actionCount} işlem bekliyor` : "Her şey yolunda"}</strong><small>{actionCount ? "Öncelikli işlemleri aşağıdan tamamlayın." : "Şu anda kritik bekleyen işlem bulunmuyor."}</small></div>
        <b className={actionCount ? "operationBadge active" : "operationBadge"}>{actionCount}</b>
      </section>

      <section className="operationGrid">
        {operations.map((item) => <Link href={item.href} className={`operationCard ${item.tone} ${item.value ? "hasWork" : ""}`} key={item.label}>
          <div className="operationTop"><span>{item.label}</span><strong>{item.value}</strong></div>
          <p>{item.note}</p><b>{item.action} →</b>
        </Link>)}
      </section>

      {preRegistrations > 0 ? <Link href="/on-kayitlar" className="preRegStrip"><div><strong>{preRegistrations} ön kayıt takipte</strong><span>Geri dönüş bekleyen ön kayıtları kontrol edin.</span></div><b>Ön Kayıtlara Git →</b></Link> : null}

      {alertsResult.error ? <section className="alertsCard errorCard"><strong>Uyarılar yüklenemedi</strong><span>{alertsResult.error.message}</span></section> : null}

      <section className="alertsCard" id="acik-uyarilar">
        <div className="alertsTitle"><div><p>SİSTEM UYARILARI</p><h2>Açık Uyarılar</h2></div><span>{open.length} işlem</span></div>
        <div className="alertsList">
          {open.map((item) => {
            const title = text(item, ["title", "subject", "alert_title", "type"], "İşlem uyarısı");
            const body = text(item, ["message", "body", "description", "detail", "reason"], "Bu kayıt için işlem gerekiyor.");
            const studentId = text(item, ["student_id"], "");
            const target = text(item, ["target_path", "action_path", "href"], studentId ? `/ogrenciler/${studentId}` : "/uyarilar");
            return <article className={`alertRow ${severity(item)}`} key={item.id}>
              <div className="alertPulse" aria-hidden="true" />
              <div className="alertBody"><div className="alertMeta"><span>{text(item,["category","alert_type","type"],"Sistem")}</span>{formatAlertDate(item.created_at) ? <small>{formatAlertDate(item.created_at)}</small> : null}</div><h3>{title}</h3><p>{body}</p></div>
              <div className="alertActions">{target !== "/uyarilar" ? <Link href={target}>İşleme Git</Link> : null}<form action={resolveAlert}><input type="hidden" name="id" value={item.id}/><button>Tamamla</button></form></div>
            </article>;
          })}
          {!open.length ? <div className="alertsEmpty"><div>✓</div><strong>Şu anda açık sistem uyarısı yok</strong><span>Yoklama ve diğer operasyonlar yukarıdaki kartlarda ayrıca canlı takip edilir.</span></div> : null}
        </div>
      </section>

      {resolved.length ? <section className="alertsCard compact"><div className="alertsTitle"><div><p>GEÇMİŞ</p><h2>Sonuçlanan Uyarılar</h2></div></div><div className="resolvedList">{resolved.slice(0,20).map((item)=><article key={item.id}><div><strong>{text(item,["title","subject","alert_title","type"],"Uyarı")}</strong><span>{text(item,["message","body","description"],"İşlem sonuçlandı.")}</span></div><form action={reopenAlert}><input type="hidden" name="id" value={item.id}/><button>Tekrar Aç</button></form></article>)}</div></section> : null}
    </main>
  );
}
