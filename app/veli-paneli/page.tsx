import Link from "next/link";
import { requireProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import "./veli.css";

export const dynamic = "force-dynamic";

async function getGuardianData(userId: string) {
  const supabase = await createClient();
  const { data: links } = await supabase.from("guardian_students").select("student_id").eq("guardian_id", userId);
  const ids = (links || []).map((x: { student_id: string }) => x.student_id);
  if (!ids.length) return { students: [], announcements: [], attendance: [] };
  const [{ data: students }, { data: announcements }, { data: attendance }] = await Promise.all([
    supabase.from("students").select("id, first_name, last_name, status, level, remaining_lessons").in("id", ids),
    supabase.from("announcements").select("id,title,body,published_at").eq("is_published", true).order("published_at", { ascending: false }).limit(5),
    supabase.from("attendance_records").select("id,student_id,lesson_date,status,coach_note").in("student_id", ids).order("lesson_date", { ascending: false }).limit(8)
  ]);
  return { students: students || [], announcements: announcements || [], attendance: attendance || [] };
}

export default async function GuardianPortal() {
  const profile = await requireProfile(["guardian"]);
  const data = await getGuardianData(profile.id);
  const student = data.students[0];
  return <main className="guardianShell">
    <header><div><span>SPRİNT YÜZME OKULU</span><h1>Veli Paneli</h1><p>Hoş geldiniz, {profile.full_name || "Değerli Velimiz"}</p></div><Link href="/auth/signout">Çıkış</Link></header>
    <section className="guardianHero"><div><small>ÖĞRENCİ</small><h2>{student ? `${student.first_name} ${student.last_name}` : "Bağlı öğrenci bulunamadı"}</h2><p>{student ? `Seviye: ${student.level || "Belirlenmedi"}` : "Yönetim öğrenciyi veli hesabınıza bağladığında bilgiler burada görünecek."}</p></div><div className="lessonBadge"><b>{student?.remaining_lessons ?? 0}</b><span>Kalan ders</span></div></section>
    <nav className="guardianActions">
      <Link href="/devam"><b>Devam Durumu</b><span>Katıldığı ve kaçırdığı dersler</span></Link>
      <Link href="/gelisim"><b>Gelişim Notları</b><span>Antrenör değerlendirmeleri</span></Link>
      <Link href="/duyurular"><b>Duyurular</b><span>Okul yazıları ve bilgilendirmeler</span></Link>
      <Link href="/odemeler"><b>Ödemeler</b><span>Paket ve ödeme geçmişi</span></Link>
    </nav>
    <section className="guardianGrid"><article><h3>Son Yoklamalar</h3>{data.attendance.length ? data.attendance.map((a: any) => <div className="row" key={a.id}><span>{new Date(a.lesson_date).toLocaleDateString("tr-TR")}</span><b>{a.status === "present" ? "Katıldı" : a.status === "excused" ? "Mazeretli" : "Katılmadı"}</b></div>) : <p className="empty">Henüz yoklama kaydı yok.</p>}</article><article><h3>Son Duyurular</h3>{data.announcements.length ? data.announcements.map((a: any) => <div className="notice" key={a.id}><b>{a.title}</b><p>{a.body}</p></div>) : <p className="empty">Henüz yayınlanmış duyuru yok.</p>}</article></section>
  </main>;
}
