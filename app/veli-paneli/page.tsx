import Link from "next/link";
import { requireProfile } from "@/lib/auth/profile";
import { formatDate, formatMoney, getGuardianContext, weekdayLabel } from "@/lib/guardian/data";
import { EmptyGuardian, GuardianHeader, GuardianIcon, StatusPill } from "./guardian-ui";
import "./veli.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function GuardianPortal({ searchParams }: { searchParams: Promise<{ child?: string }> }) {
  const profile = await requireProfile(["guardian"]);
  const { child } = await searchParams;
  const data = await getGuardianContext(profile.id, child);

  if (!data.selected) {
    return <main className="guardianShell"><GuardianHeader name={profile.full_name || "Değerli Velimiz"} students={[]} /><div className="guardianContent"><EmptyGuardian title="Bağlı öğrenci bulunamadı" text="Öğrenci bağlantınız yönetim tarafından tamamlandığında ders, ödeme, yoklama ve gelişim bilgileriniz otomatik olarak burada görüntülenecektir." /></div></main>;
  }

  const total = Number(data.enrollment?.total_lessons || data.coursePackage?.lesson_count || 0);
  const used = data.lessonBalance?.usedLessons ?? Number(data.enrollment?.used_lessons || 0);
  const remaining = data.lessonBalance?.totalRemainingLessons ?? Math.max(0, total - used);
  const attendanceTotal = data.attendance.length;
  const presentCount = data.attendance.filter((item: any) => item.status === "present").length;
  const attendanceRate = attendanceTotal ? Math.round((presentCount / attendanceTotal) * 100) : 0;
  const paidTotal = data.payments.filter((item: any) => ["recorded", "paid", "completed"].includes(String(item.payment_status || ""))).reduce((sum: number, item: any) => sum + Number(item.amount || 0), 0);
  const packagePrice = Number(data.coursePackage?.price || data.enrollment?.package_price || 0);
  const debt = Math.max(0, packagePrice - paidTotal);
  const selectedId = data.selected.id;

  return <main className="guardianShell">
    <GuardianHeader name={profile.full_name || "Değerli Velimiz"} students={data.students} selectedId={selectedId} />
    <div className="guardianContent">
      <section className="guardianHero">
        <div className="guardianHeroMain"><small>ÖĞRENCİ PANELİ · GÜNCEL VERİ</small><h1>{data.selected.first_name} {data.selected.last_name}</h1><p>{data.branch?.name || "Şube belirlenmedi"} · {data.group?.name || "Grup belirlenmedi"}</p><div className="guardianHeroMeta"><span><i/> Sistem verileri otomatik güncellenir</span></div></div>
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
          <div className="guardianCardHeader"><div><small className="guardianCardEyebrow">KURS DURUMU</small><h2>Kurs Bilgileri</h2></div><Link href={`/veli-devam?child=${selectedId}`}>Takvimi aç</Link></div>
          <div className="infoList">
            <div className="infoRow"><span>Şube</span><strong>{data.branch?.name || "—"}</strong></div>
            <div className="infoRow"><span>Grup</span><strong>{data.group?.name || "—"}</strong></div>
            <div className="infoRow"><span>Eğitmen</span><strong>{data.coach?.full_name || "Atanmadı"}</strong></div>
            <div className="infoRow"><span>Paket</span><strong>{data.coursePackage?.name || `${total || 0} Ders`}</strong></div>
            <div className="infoRow"><span>Başlangıç</span><strong>{formatDate(data.enrollment?.start_date)}</strong></div>
            <div className="infoRow"><span>Kullanılan / Toplam</span><strong>{used} / {total}</strong></div>
          </div>
          {data.schedules.length ? <div className="scheduleChips">{data.schedules.map((schedule: any) => <span className="scheduleChip" key={schedule.id}>{weekdayLabel(Number(schedule.weekday))} · {String(schedule.start_time).slice(0,5)}</span>)}</div> : null}
        </article>

        <article className="guardianCard">
          <div className="guardianCardHeader"><div><small className="guardianCardEyebrow">DEVAM TAKİBİ</small><h2>Son Yoklamalar</h2></div><Link href={`/veli-devam?child=${selectedId}`}>Tümünü gör</Link></div>
          <div className="timeline">{data.attendance.slice(0,5).map((item: any) => <div className="timelineItem" key={item.id}><time>{formatDate(item.lesson_date)}</time><strong>{item.coach_note || "Ders kaydı"}</strong><StatusPill tone={item.status === "present" ? "green" : item.status === "excused" ? "orange" : "red"}>{item.status === "present" ? "Katıldı" : item.status === "excused" ? "Mazeretli" : "Katılmadı"}</StatusPill></div>)}</div>
          {!data.attendance.length ? <p className="guardianSectionLead">Henüz yoklama kaydı bulunmuyor.</p> : null}
        </article>
      </section>

      <section className="guardianActions">
        <Link className="guardianAction" href={`/veli-gelisim?child=${selectedId}`}><span><GuardianIcon name="progress"/></span><div><strong>Gelişim Notları</strong><small>Antrenör değerlendirmeleri</small></div></Link>
        <Link className="guardianAction" href={`/veli-mesajlar?child=${selectedId}`}><span><GuardianIcon name="message"/></span><div><strong>Mesaj Merkezi</strong><small>Bilgilendirme ve mesajlar</small></div></Link>
        <Link className="guardianAction" href={`/veli-belgeler?child=${selectedId}`}><span><GuardianIcon name="document"/></span><div><strong>Kurallar & Belgeler</strong><small>Kurs belgeleri ve onaylar</small></div></Link>
        {data.branch?.location_url ? <a className="guardianAction" href={data.branch.location_url} target="_blank" rel="noreferrer"><span><GuardianIcon name="location"/></span><div><strong>Havuz Konumu</strong><small>Haritada görüntüle</small></div></a> : null}
        <Link className="guardianAction" href={`/veli-odemeler?child=${selectedId}`}><span><GuardianIcon name="wallet"/></span><div><strong>Ödeme Geçmişi</strong><small>Ödeme ve borç durumu</small></div></Link>
        <Link className="guardianAction" href={`/veli-duyurular?child=${selectedId}`}><span><GuardianIcon name="bell"/></span><div><strong>Duyurular</strong><small>Güncel kurs bilgilendirmeleri</small></div></Link>
      </section>
      <p className="guardianFooterNote">Bilgiler SprintOS yönetim panelindeki güncel kayıtlarla senkronize gösterilir. Grup, yoklama, ödeme ve bitiş tarihi değişiklikleri yetkili yönetici tarafından güncellendiğinde veli paneline otomatik yansır.</p>
    </div>
  </main>;
}
