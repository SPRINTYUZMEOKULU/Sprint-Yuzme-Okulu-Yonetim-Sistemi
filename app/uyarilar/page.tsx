import { formatDisplayDateTime } from "@/lib/dates/display";
import Link from "next/link";
import { requireProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import { reopenAlert, resolveAlert } from "./actions";
import "./uyarilar.css";
import OperationsCenter from "./operations-center";

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
    return formatDisplayDateTime(date);
  } catch {
    return null;
  }
}

export default async function AlertsPage() {
  const profile = await requireProfile([...roles]);
  const supabase = await createClient();
  const alertsResult = await supabase.from("alerts").select("*")
    .eq("organization_id", profile.organization_id).order("created_at", { ascending: false }).limit(100);
  const alerts = (alertsResult.data || []) as AlertRow[];
  const open = alerts.filter(item => item.status === "open");
  const resolved = alerts.filter(item => ["resolved", "closed", "completed", "dismissed"].includes(item.status || "open"));

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

      <OperationsCenter />

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
