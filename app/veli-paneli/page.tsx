import UiIcon from "@/app/components/ui-icon";
import AttendanceSummary from "@/app/components/attendance-summary";
import {attendanceSummary as currentPeriodAttendanceSummary} from "@/lib/students/attendance-summary";
import {loadGuardianPage} from "@/lib/guardian/page-context";
import { attendancePresentation, attendanceSummary, enrollmentAttendance, safePortalUrl, currentDocumentConsent } from "@/lib/guardian/presentation";
import PaymentReminder from "@/app/veli-paneli/payment-reminder";
import { guardianCombinedReminder, guardianObligationSummary, guardianPaymentSummary } from "@/lib/guardian/payment-summary";
import Link from "next/link";
import { formatDate, formatMoney, weekdayLabel } from "@/lib/guardian/data";
import { EmptyGuardian, GuardianHeader, GuardianIcon, StatusPill } from "./guardian-ui";
import "./veli.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function GuardianPortal({ searchParams }: { searchParams: Promise<{ child?: string; previewGuardian?:string }> }) {
  const query=await searchParams; const {profile,data,previewGuardian}=await loadGuardianPage(query,"overview");

  if (!data.selected) {
    return <main className="guardianShell"><GuardianHeader previewGuardian={previewGuardian} name={profile.full_name || "Değerli Velimiz"} students={data.students} issues={data.issues} /><div className="guardianContent"><EmptyGuardian title="Bağlı öğrenci bulunamadı" text="Öğrenci bağlantınız yönetim tarafından tamamlandığında ders, ödeme, yoklama ve gelişim bilgileriniz otomatik olarak burada görüntülenecektir." /></div></main>;
  }

  const total = Number(data.enrollment?.total_lessons || data.coursePackage?.lesson_count || 0);
  const used = Number(data.enrollment?.lesson_rights?.used ?? data.enrollment?.used_lessons ?? 0);
  const remaining = Number(data.enrollment?.lesson_rights?.total ?? Math.max(0,total-used));
  const currentAttendance=enrollmentAttendance(data.attendance,data.enrollment);
  const {rate:attendanceRate,absenceStreak,latestAbsence}=attendanceSummary(currentAttendance);
  const {paid: paidTotal, price: packagePrice, debt} = guardianPaymentSummary(data.enrollment, data.coursePackage, data.payments, data.paymentPlan);
  const extraDebt=guardianObligationSummary(data.obligations||[]).debt;
  const totalDebt=debt+extraDebt;
  const selectedId = data.selected.id;
  const unreadMessages=data.unreadMessageCount??data.messages.filter((m:any)=>m.kind!=="note"&&!m.read_at).length;
  const pendingDocuments=data.documents.filter((document:any)=>document.requires_consent&&!currentDocumentConsent(document,data.consents)).length;
  const openRequests=data.openRequestCount??(data.requests||[]).filter((request:any)=>!["resolved","rejected","archived"].includes(request.status)).length;
  const previewQuery=previewGuardian?`&previewGuardian=${encodeURIComponent(previewGuardian)}`:"";

  return <main className="guardianShell">
    <GuardianHeader previewGuardian={previewGuardian} name={profile.full_name || "Değerli Velimiz"} issues={data.issues} students={data.students} selectedId={selectedId} />
    <div className="guardianContent">
      <section className="guardianHero guardianOverviewHero">
        <div className="guardianHeroMain">
          <small>KURSİYER ÖZETİ</small>
          <h1>{data.selected.first_name} {data.selected.last_name}</h1>
          <p>{data.branch?.name || "Şube belirlenmedi"}</p>
          <p>{data.group?.name || "Grup belirlenmedi"}</p>
        </div>
        <div className="guardianLessonBalance">
          <div><span>Toplam kalan ders</span><strong>{remaining}</strong></div>
          <dl>
            <div><dt>Normal ders</dt><dd>{data.enrollment?.lesson_rights?.normal ?? remaining}</dd></div>
            <div><dt>Telafi</dt><dd>{data.enrollment?.lesson_rights?.compensation ?? 0}</dd></div>
          </dl>
        </div>
      </section>

      {data.enrollment?.start_confirmation_required&&!data.enrollment?.actual_started_at?<div className="guardianFooterNote" role="status"><strong>Kurs başlangıcı bekleniyor</strong><p>Planlanan başlangıç: {formatDate(data.enrollment.start_date)}. Yönetim kursu başlattığında ders ve yoklama bilgileri bu ekranda güncellenecektir.</p></div>:null}
      {latestAbsence ? <section className="guardianAttendanceAlert" style={{margin:"0 0 16px",padding:"15px 17px",border:"1px solid #f3c9c9",borderRadius:16,background:"#fff7f7",color:"#7f1d1d"}}>
        <div style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"flex-start",flexWrap:"wrap"}}>
          <div><small style={{display:"block",fontWeight:900,letterSpacing:".08em",color:"#b42318"}}>DEVAMSIZLIK BİLDİRİMİ</small><strong style={{display:"block",marginTop:4,fontSize:16}}>{absenceStreak >= 2 ? `${absenceStreak} ders üst üste katılım sağlanmadı` : "Son derse katılım sağlanmadı"}</strong><span style={{display:"block",marginTop:4,fontSize:12,color:"#8b4a4a"}}>{formatDate(latestAbsence.lesson_date)} tarihli yoklama kaydı. Yoklama güncellendiğinde bu bilgi otomatik yenilenir.</span></div>
          <Link href={`/veli-devam?child=${selectedId}${previewQuery}`} style={{padding:"8px 11px",border:"1px solid #efb4b4",borderRadius:10,background:"#fff",color:"#9f1d1d",fontWeight:900,textDecoration:"none",fontSize:12}}>Yoklama Detayı</Link>
        </div>
      </section> : null}

      <PaymentReminder reminder={data.issues.some(issue=>issue.startsWith("Ödeme")) ? null : guardianCombinedReminder(data.enrollment, debt, data.paymentInstallments, data.paymentPlan,data.obligations||[])} accountId={profile.id} enrollmentId={data.enrollment?.id} childId={data.selected.id} previewGuardian={previewGuardian}/>
      {totalDebt > 0 && !data.issues.some(issue => (issue.startsWith("Ödeme") || issue.startsWith("Kayıt"))) ? <section className="guardianPaymentOverview">
        <div><span>Kalan ödeme</span><strong>{formatMoney(totalDebt)}</strong>
          <small>Paket {formatMoney(debt)} · Ek borç {formatMoney(extraDebt)}</small></div>
        <div className="guardianPayActions">
          {!previewGuardian ? <Link className="guardianPayButton" href={`/veli-odemeler?child=${selectedId}#guvenli-odeme`}>Güvenli Ödeme Yap</Link> : null}
          <Link href={`/veli-odemeler?child=${selectedId}${previewQuery}`}>Ödeme detayları</Link>
        </div>
      </section> : null}
      <section className="guardianFollowUps" aria-label="Takip ve bekleyen işlemler">
        <Link className={unreadMessages>0?"guardianAttention":""} href={`/veli-mesajlar?child=${selectedId}${previewQuery}`}><span className="guardianFollowIcon"><GuardianIcon name="message"/></span><span><strong>{data.issues.some(issue=>issue.startsWith("Mesaj"))?"Bilgi alınamadı":`${unreadMessages} okunmamış mesaj`}</strong><small>Mesajlarınızı görüntüleyin</small></span><UiIcon name="chevronRight" size={18}/></Link>
        <Link href={`/veli-talepleri?child=${selectedId}${previewQuery}`}><span className="guardianFollowIcon"><GuardianIcon name="request"/></span><span><strong>{data.issues.some(issue=>issue.startsWith("Talep"))?"Bilgi alınamadı":`${openRequests} açık görüşme`}</strong><small>Talepler ve yönetim yanıtları</small></span><UiIcon name="chevronRight" size={18}/></Link>
        <Link href={`/veli-belgeler?child=${selectedId}${previewQuery}`}><span className="guardianFollowIcon"><GuardianIcon name="document"/></span><span><strong>{data.issues.some(issue=>issue.startsWith("Belge")||issue.startsWith("Onay"))?"Bilgi alınamadı":pendingDocuments?`${pendingDocuments} belge onay bekliyor`:data.documents.some((document:any)=>document.requires_consent)?"Belge onayları güncel":"Kurallar ve bilgilendirme"}</strong><small>Güncel kurallar ve belgeler</small></span><UiIcon name="chevronRight" size={18}/></Link>
      </section>
      <section className="guardianStats">
        <article className="guardianStat"><span>Mevcut Seviye</span><strong>{data.selected.swimming_level || "Belirlenmedi"}</strong></article>
        <article className="guardianStat"><span>Planlanan Bitiş</span><strong>{formatDate(data.enrollment?.planned_end_date)}</strong></article>
        <article className="guardianStat"><span>Devam Oranı</span><strong>{attendanceRate===null?"Henüz yoklama yok":`%${attendanceRate}`}</strong></article>
        <article className="guardianStat"><span>Ödeme Durumu</span><strong>{data.issues.some(issue=>issue.startsWith("Ödeme"))?"Bilgi alınamadı":totalDebt>0?formatMoney(totalDebt):!data.coursePackage&&!data.paymentPlan?"Paket tanımlanmadı":"Borç bulunmuyor"}</strong></article>
      </section>

      <section className="guardianGrid">
        <article className="guardianCard">
          <div className="guardianCardHeader"><div><small className="guardianCardEyebrow">KURS DURUMU</small><h2>Kurs Bilgileri</h2></div><Link href={`/veli-devam?child=${selectedId}${previewQuery}`}>Takvimi aç</Link></div>
          <div className="infoList">
            <div className="infoRow"><span>Şube</span><strong>{data.branch?.name || "—"}</strong></div>
            <div className="infoRow"><span>Grup</span><strong>{data.group?.name || "—"}</strong></div>
            <div className="infoRow"><span>Eğitmen</span><strong>{data.coach?.full_name || "Atanmadı"}</strong></div>
            <div className="infoRow"><span>Paket</span><strong>{data.coursePackage?.name || `${total || 0} Ders`}</strong></div>
            <div className="infoRow"><span>Başlangıç</span><strong>{formatDate(data.enrollment?.start_date)}</strong></div>
            <div className="infoRow"><span>Yoklama</span><AttendanceSummary summary={currentPeriodAttendanceSummary(data.attendance,data.enrollment)} /></div>
          </div>
          {data.schedules.length ? <div className="scheduleChips">{data.schedules.map((schedule: any) => <span className="scheduleChip" key={schedule.id}>{weekdayLabel(Number(schedule.weekday))} · {String(schedule.start_time).slice(0,5)}</span>)}</div> : null}
        </article>

        <article className="guardianCard">
          <div className="guardianCardHeader"><div><small className="guardianCardEyebrow">DEVAM TAKİBİ</small><h2>Son Yoklamalar</h2></div><Link href={`/veli-devam?child=${selectedId}${previewQuery}`}>Tümünü gör</Link></div>
          <div className="timeline">{data.attendance.slice(0,5).map((item: any) => <div className="timelineItem" key={item.id}><time>{formatDate(item.lesson_date)}</time><strong>{item.coach_note || "Ders kaydı"}</strong><StatusPill tone={attendancePresentation(item.status).tone}>{attendancePresentation(item.status).label}</StatusPill></div>)}</div>
          {!data.attendance.length ? <p className="guardianSectionLead">Henüz yoklama kaydı bulunmuyor.</p> : null}
        </article>
      </section>

      <section className="guardianActions">
        <Link className="guardianAction" href={`/veli-gelisim?child=${selectedId}${previewQuery}`}><span><GuardianIcon name="progress"/></span><div><strong>Gelişim Notları</strong><small>Antrenör değerlendirmeleri</small></div></Link>
        {safePortalUrl(data.branch?.location_url) ? <a className="guardianAction" href={safePortalUrl(data.branch.location_url)!} target="_blank" rel="noreferrer"><span><GuardianIcon name="location"/></span><div><strong>Havuz Konumu</strong><small>Haritada görüntüle</small></div></a> : null}
        <Link className="guardianAction" href={`/veli-odemeler?child=${selectedId}${previewQuery}`}><span><GuardianIcon name="wallet"/></span><div><strong>Ödeme Geçmişi</strong><small>Ödeme ve borç durumu</small></div></Link>
        <Link className="guardianAction" href={`/veli-duyurular?child=${selectedId}${previewQuery}`}><span><GuardianIcon name="bell"/></span><div><strong>Duyurular</strong><small>Güncel kurs bilgilendirmeleri</small></div></Link>
      </section>

    </div>
  </main>;
}
