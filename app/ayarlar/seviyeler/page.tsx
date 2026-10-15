import Link from "next/link";
import { requireProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import LevelManager, { type ManagedLevel } from "./level-manager";
import "./levels.css";
export const dynamic = "force-dynamic";
export default async function LevelsPage() {
  const profile = await requireProfile(["owner", "admin"]);
  if (!profile.organization_id) throw new Error("Kurum bulunamadı.");
  const db = await createClient();
  const { data, error } = await db.from("swimming_levels").select("id,name,description,sort_order,is_active").eq("organization_id", profile.organization_id).order("sort_order").order("name");
  if (error) throw new Error("Seviye listesi yüklenemedi.");
  const levels: ManagedLevel[] = await Promise.all((data || []).map(async (level) => {
    const counts = await Promise.all([
      db.from("students").select("id", { count: "exact", head: true }).eq("organization_id", profile.organization_id!).eq("swimming_level", level.name),
      db.from("training_groups").select("id", { count: "exact", head: true }).eq("organization_id", profile.organization_id!).eq("level_id", level.id),
      db.from("student_group_memberships").select("id", { count: "exact", head: true }).eq("organization_id", profile.organization_id!).eq("level_id", level.id),
    ]);
    if (counts.some((r) => r.error)) throw new Error("Seviye kullanım bilgisi yüklenemedi.");
    return { ...level, students: counts[0].count || 0, groups: counts[1].count || 0, memberships: counts[2].count || 0 };
  }));
  return <main className="levelsPage"><div className="levelsShell"><Link href="/ayarlar" className="levelBack">← Ayarlara dön</Link><header className="levelsHeader"><span>SPRINT · EĞİTİM YÖNETİMİ</span><h1>Yüzme Seviyeleri</h1><p>Beceri tanımlarını, sıralamayı ve yeni kayıtlarda kullanılacak seviyeleri tek yerden yönetin.</p></header>
    <section className="levelStats"><div><strong>{levels.filter((l) => l.is_active).length}</strong><span>Aktif seviye</span></div><div><strong>{levels.filter((l) => !l.is_active).length}</strong><span>Pasif seviye</span></div><div><strong>{levels.reduce((n, l) => n + l.students, 0)}</strong><span>Seviyesi kayıtlı kursiyer</span></div></section>
    <aside className="levelNotice"><b>Tek liste, entegre kullanım</b><p>Aktif seviyeler ön kayıt, grup ve seviye atama ekranlarına yansır. Pasife alma geçmiş kursiyer ve grup kayıtlarını silmez. Açık formları değişiklikten sonra yenileyin.</p></aside>
    <aside className="levelGuide"><b>Eğitim basamakları</b><p>Suya Uyum → Başlangıç → Temel Seviye → Orta Seviye → İleri Seviye</p><small>Takım Alt Yapı, Performans ve Master ayrı eğitim programlarıdır; sıradaki beceri basamağı olarak değerlendirilmez. Seviye tespitini antrenör yapar.</small></aside>
    <LevelManager levels={levels} />
  </div></main>;
}
