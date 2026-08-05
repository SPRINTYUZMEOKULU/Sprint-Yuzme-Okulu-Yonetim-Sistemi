import Link from "next/link";
import { requireProfile } from "@/lib/auth/profile";
import { formatDate, formatMoney, getGuardianContext, weekdayLabel } from "@/lib/guardian/data";
import { EmptyGuardian, GuardianHeader, StatusPill } from "./guardian-ui";
import "./veli.css";

export const dynamic = "force-dynamic";

export default async function GuardianPortal({ searchParams }: { searchParams: Promise<{ child?: string }> }) {
  const profile = await requireProfile(["guardian"]);
  const { child } = await searchParams;
  const data = await getGuardianContext(profile.id, child);

  if (!data.selected) {
    return <main className="guardianShell"><GuardianHeader name={profile.full_name || "Değerli Velimiz"} students={[]} /><div className="guardianContent"><EmptyGuardian title="Bağlı öğrenci bulunamadı" text="Yönetim öğrencinizi veli hesabınıza bağladığında ders, ödeme ve gelişim bilgileri burada görüntülenecek." /></div></main>;
  }

  const remaining = Math.max(0, Number(data.enrollment?.total_lessons || data.coursePackage?.lesson_count || 0) - Number(data.enrollment?.used_lessons || 0));
  const total = Number(data.enrollment?.total_lessons || data.coursePackage?.lesson_count || 0);
  const used = Number(data.enrollment?.used_lessons || 0);
  const attendanceTotal = data.attendance.length;
  const presentCount = data.attendance.filter((item: any) => item.status === "present").length;
  const attendanceRate = attendanceTotal ? Math.round((presentCount / attendanceTotal) * 100) : 0;
  const paidTotal = data.payments.filter((item: any) => item.payment_status === "recorded").reduce((sum: number, item: any) => sum + Number(item.amount || 0), 0);
  const packagePrice = Number(data.coursePackage?.price || 0);
  const debt = Math.max(0, packagePrice - paidTotal);
  const selectedId = data.selected.id;

  return <main className="guardianShell">
    <GuardianHeader name={profile.full_name || "Değerli Velimiz"} students={data.students} selectedId={selectedId} />
    <div className="guardianContent">
      <section className="guardianHero">
        <div className="guardianHeroMain"><small>ÖĞRENCİ PANELİ</small><h1>{data.selected.first_name} {data.selected.last_name}</h1><p>{data.branch?.name || "Şube belirlenmedi"} · {data.group?.name || "Grup belirlenmedi"}</p></div>
        <div className="lessonRing"><b>{remaining}</b><span>Kalan ders</span></div>
      </section>

      <section className="guardianStats">
        <article className="guardianStat"><span>Mevcut Seviye</span><strong>{data.selected.swimming_level || "Belirlenmedi"}</strong></article>
        <article className="guardianStat"><span>Planlanan Bitiş</span><strong>{formatDate(data.enrollment?.planned_end_date)}</strong></article>
        <article className="guardianStat"><span>Devam Oranı</span><strong>%{attendanceRate}</strong></article>
        <article className="guardianStat"><span>Ödeme Durumu</span><strong>{debt > 0 ? formatMoney(debt) : "Tamamlandı"}</strong></article>
      </section>

      <section className="guardianGrid">
        <article className="guardianCard">
          <div className="guardianCardHeader"><h2>Kurs Bilgileri</h2><Link href={`/veli-devam?child=${selectedId}`}>Takvimi aç</Link></div>
          <div className="infoList">
            <div className="infoRow"><span>Şube</span><strong>{data.branch?.name || "—"}</strong></div>
            <div className="infoRow"><span>Grup</span><strong>{data.group?.name || "—"}</strong></div>
            <div className="infoRow"><span>Eğitmen</span><strong>{data.coach?.full_name || "Atanmadı"}</strong></div>
            <div className="infoRow"><span>Paket</span><strong>{data.coursePackage?.name || `${total || 0} Ders`}</strong></div>
            <div className="infoRow"><span>Başlangıç</span><strong>{formatDate(data.enrollment?.start_date)}</strong></div>
            <div className="infoRow"><span>Kullanılan / Toplam</span><strong>{used} / {total}</strong></div>
          </div>
          {data.schedules.length ? <><div className="scheduleChips">{data.schedules.map((schedule: any) => <span className="scheduleChip" key={schedule.id}>{weekdayLabel(Number(schedule.weekday))} · {String(schedule.start_time).slice(0,5)}</span>)}</div></> : null}
        </article>

        <article className="guardianCard">
          <div className="guardianCardHeader"><h2>Son Yoklamalar</h2><Link href={`/veli-devam?child=${selectedId}`}>Tümünü gör</Link></div>
          <div className="timeline">{data.attendance.slice(0,5).map((item: any) => <div className="timelineItem" key={item.id}><time>{formatDate(item.lesson_date)}</time><strong>{item.coach_note || "Ders kaydı"}</strong><StatusPill tone={item.status === "present" ? "green" : item.status === "excused" ? "orange" : "red"}>{item.status === "present" ? "Katıldı" : item.status === "excused" ? "Mazeretli" : "Katılmadı"}</StatusPill></div>)}</div>
          {!data.attendance.length ? <p className="guardianSectionLead">Henüz yoklama kaydı bulunmuyor.</p> : null}
        </article>
      </section>

      <section className="guardianActions">
        <Link className="guardianAction" href={`/veli-gelisim?child=${selectedId}`}><span>📈</span>Gelişim Notları</Link>
        <Link className="guardianAction" href={`/veli-mesajlar?child=${selectedId}`}><span>💬</span>Mesaj Merkezi</Link>
        <Link className="guardianAction" href={`/veli-belgeler?child=${selectedId}`}><span>📄</span>Kurallar & Belgeler</Link>
        {data.branch?.location_url ? <a className="guardianAction" href={data.branch.location_url} target="_blank" rel="noreferrer"><span>📍</span>Havuz Konumu</a> : null}
        <Link className="guardianAction" href={`/veli-odemeler?child=${selectedId}`}><span>💳</span>Ödeme Geçmişi</Link>
        <Link className="guardianAction" href={`/veli-duyurular?child=${selectedId}`}><span>📣</span>Duyurular</Link>
      </section>
      <p className="guardianFooterNote">Grup, yoklama, ödeme ve bitiş tarihi değişiklikleri yalnızca yetkili yönetici tarafından yapılabilir. Veli paneli bilgilendirme ve onay amaçlıdır.</p>
    </div>
  </main>;
}
