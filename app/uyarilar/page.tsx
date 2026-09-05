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

export default async function AlertsPage() {
  const profile = await requireProfile([...roles]);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("alerts")
    .select("*")
    .eq("organization_id", profile.organization_id)
    .order("created_at", { ascending: false })
    .limit(100);

  const alerts = ((data || []) as AlertRow[]);
  const open = alerts.filter((item) => (item.status || "open") === "open");
  const resolved = alerts.filter((item) => (item.status || "open") !== "open");

  return (
    <main className="alertsPage">
      <header className="alertsHero">
        <div>
          <p>SPRİNTOS · AKILLI UYARILAR</p>
          <h1>Yapılacak İşlemler</h1>
          <span>Sistem tarafından oluşan uyarıları burada görün, ilgili öğrenci veya modüle gidin ve tamamlanan işlemleri kapatın.</span>
        </div>
        <div className="alertsHeroActions"><Link href="/">Ana Sayfa</Link><Link className="primary" href="/bildirimler">Bildirimleri Aç</Link></div>
      </header>

      <section className="alertStats">
        <article className={open.length ? "hot" : ""}><span>Açık Uyarı</span><strong>{open.length}</strong><small>{open.length ? "İşlem bekliyor" : "Her şey yolunda"}</small></article>
        <article><span>Sonuçlanan</span><strong>{resolved.length}</strong><small>Son 100 kayıt içinde</small></article>
        <article><span>Toplam</span><strong>{alerts.length}</strong><small>Görüntülenen kayıt</small></article>
      </section>

      {error ? <section className="alertsCard errorCard"><strong>Uyarılar yüklenemedi</strong><span>{error.message}</span></section> : null}

      <section className="alertsCard">
        <div className="alertsTitle"><div><p>ÖNCELİKLİ</p><h2>Açık Uyarılar</h2></div><span>{open.length} işlem</span></div>
        <div className="alertsList">
          {open.map((item) => {
            const title = text(item, ["title", "subject", "alert_title", "type"], "İşlem uyarısı");
            const body = text(item, ["message", "body", "description", "detail", "reason"], "Bu kayıt için işlem gerekiyor.");
            const studentId = text(item, ["student_id"], "");
            const target = text(item, ["target_path", "action_path", "href"], studentId ? `/ogrenciler/${studentId}` : "/uyarilar");
            return <article className={`alertRow ${severity(item)}`} key={item.id}>
              <div className="alertPulse" aria-hidden="true" />
              <div className="alertBody"><div className="alertMeta"><span>{text(item,["category","alert_type","type"],"Sistem")}</span>{item.created_at ? <small>{new Intl.DateTimeFormat("tr-TR",{dateStyle:"short",timeStyle:"short"}).format(new Date(item.created_at))}</small> : null}</div><h3>{title}</h3><p>{body}</p></div>
              <div className="alertActions">{target !== "/uyarilar" ? <Link href={target}>İşleme Git</Link> : null}<form action={resolveAlert}><input type="hidden" name="id" value={item.id}/><button>Tamamlandı</button></form></div>
            </article>;
          })}
          {!open.length ? <div className="alertsEmpty"><div>✓</div><strong>Şu anda açık uyarı yok</strong><span>Yeni bir işlem gerektiğinde burada otomatik görünecek.</span></div> : null}
        </div>
      </section>

      {resolved.length ? <section className="alertsCard compact"><div className="alertsTitle"><div><p>GEÇMİŞ</p><h2>Sonuçlanan Uyarılar</h2></div></div><div className="resolvedList">{resolved.slice(0,20).map((item)=><article key={item.id}><div><strong>{text(item,["title","subject","alert_title","type"],"Uyarı")}</strong><span>{text(item,["message","body","description"],"İşlem sonuçlandı.")}</span></div><form action={reopenAlert}><input type="hidden" name="id" value={item.id}/><button>Tekrar Aç</button></form></article>)}</div></section> : null}
    </main>
  );
}
