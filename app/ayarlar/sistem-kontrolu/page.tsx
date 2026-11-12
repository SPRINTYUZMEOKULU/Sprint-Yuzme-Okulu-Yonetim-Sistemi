import Link from "next/link";
import { requireProfile } from "@/lib/auth/profile";
import { attendanceOperationsDb } from "@/lib/attendance/operations-db";
import { formatDisplayDateTime } from "@/lib/dates/display";
import { integrationHealthRows, schedulerHealth } from "@/lib/system/integration-health";
import "./system-health.css";
export const dynamic="force-dynamic";
export default async function SystemHealthPage(){
 const profile=await requireProfile(["owner","admin"]);
 const {data,error}=await attendanceOperationsDb().rpc("sprint_system_integration_health",{p_actor:profile.id});
 const rows=data?integrationHealthRows(data.checks):[];
 const scheduler=schedulerHealth(data?.scheduler);
 return <main className="systemHealth"><header><div><small>SPRINTOS · YÖNETİM KONTROLÜ</small><h1>Sistem Kontrolü</h1><p>Kayıt, ders, ödeme, veli ve bildirim bağlantılarının güncel durumu.</p></div><nav><Link href="/ayarlar">Ayarlara Dön</Link><Link href="/ayarlar/sistem-kontrolu">Kontrolü Yenile</Link></nav></header>
 {error||!data?<div className="healthError" role="alert">Kontrol tamamlanamadı. Sonuçlar sağlıklı olarak işaretlenmedi; yeniden deneyin.</div>:<>
 <div className="healthSummary"><strong>{data.checks.active_periods} aktif kayıt dönemi kontrol edildi</strong><span>Son kontrol: {formatDisplayDateTime(data.checked_at)}</span><p>Bu ekran yalnızca kontrol yapar. Onay, ödeme veya geçmiş kayıt düzeltmesi uygulamaz.</p></div>
 <section className="healthGrid" aria-label="Entegrasyon kontrolleri">{rows.map(row=><article className={`healthCard ${row.state}`} key={row.key}><div className="healthCardTop"><h2>{row.title}</h2><span>{row.state==="ok"?"Tutarlı":row.state==="pending"?"İşlem bekliyor":"Kontrol gerekli"}</span></div><strong className="healthValue">{row.count??"—"}</strong><p>{row.description}</p>{row.href&&<Link href={row.href}>{row.action||"İlgili Ekranı Aç"} →</Link>}</article>)}</section>
 <section className={`healthScheduler ${scheduler.state}`}><div><h2>Zamanlı Arka Plan Kontrolleri</h2><strong>{scheduler.title}</strong><p>{scheduler.description}</p><small>Son başarılı çalışma: {data.scheduler?.last_success_at?formatDisplayDateTime(data.scheduler.last_success_at):"Henüz doğrulanmadı"}</small></div><Link href="/ayarlar?bolum=bildirimler">Cihaz Bildirimleri →</Link></section>
 <p className="healthFootnote">Telefon bildiriminin ekranda görünmesi ayrıca cihaz iznine, bağlantıya ve iPhone bildirim tercihlerine bağlıdır. WhatsApp mesajları gönderim onayı; eski telafi kayıtları tarih kontrolü gerektirir.</p>
 </>}
 </main>;
}
