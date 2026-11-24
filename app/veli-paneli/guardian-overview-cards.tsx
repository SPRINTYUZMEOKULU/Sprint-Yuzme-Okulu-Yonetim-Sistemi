import Link from "next/link";
import AttendanceSummary from "@/app/components/attendance-summary";
import { attendanceSummary as currentPeriodAttendanceSummary } from "@/lib/students/attendance-summary";
import { formatDate, formatMoney, weekdayLabel, type GuardianContext } from "@/lib/guardian/data";
import { guardianCombinedReminder, guardianObligationSummary, guardianPaymentSummary } from "@/lib/guardian/payment-summary";
import { attendancePresentation, attendanceSummary, enrollmentAttendance } from "@/lib/guardian/presentation";
import { GuardianIcon, StatusPill } from "./guardian-ui";
import LessonBalance from "./lesson-balance";
import PaymentReminder from "./payment-reminder";
import "./course-summary.css";

export default function GuardianOverviewCards({ data, accountId, previewGuardian, management = false }: {
  data: GuardianContext;
  accountId: string;
  previewGuardian?: string;
  management?: boolean;
}) {
  if (!data.selected) return null;
  const total = Number(data.enrollment?.total_lessons || data.coursePackage?.lesson_count || 0);
  const rights = data.enrollment?.lesson_rights;
  const rightsReady = Boolean(rights && Number.isFinite(rights.normal) && Number.isFinite(rights.compensation));
  const currentAttendance=enrollmentAttendance(data.attendance,data.enrollment);
  const {rate:attendanceRate,absenceStreak,latestAbsence}=attendanceSummary(currentAttendance);
  const {debt} = guardianPaymentSummary(data.enrollment, data.coursePackage, data.payments, data.paymentPlan);
  const extraDebt=guardianObligationSummary(data.obligations||[]).debt;
  const totalDebt=debt+extraDebt;
  const selectedId = data.selected.id;
  const previewQuery = previewGuardian ? `&previewGuardian=${encodeURIComponent(previewGuardian)}` : "";
  const StudentHeading = management ? "h2" : "h1";
  const studentFile = `/ogrenciler/${selectedId}`;
  const attendanceUrl = management ? `${studentFile}#yoklama` : `/veli-devam?child=${selectedId}${previewQuery}`;
  const paymentUrl = management ? `${studentFile}#odeme` : `/veli-odemeler?child=${selectedId}${previewQuery}`;

  return <>
    <section className="courseIdentity">
      <div className="courseMonogram" aria-hidden="true">{[data.selected.first_name, data.selected.last_name].map(part => part?.trim().slice(0,1).toLocaleUpperCase("tr-TR")).join("")}</div>
      <div><small>{data.selected.swimming_level || "Kursiyer özeti"}</small>
        <StudentHeading>{data.selected.first_name} {data.selected.last_name}</StudentHeading>
        <p><GuardianIcon name="location" size={16}/>{data.branch?.name || "Şube belirlenmedi"}</p>
      </div>
    </section>
    {data.enrollment || data.issues.some(issue => issue.startsWith("Kayıt")) ? <LessonBalance
      normal={Math.max(0, rights?.normal ?? 0)}
      makeup={Math.max(0, rights?.compensation ?? 0)}
      ready={rightsReady}
      alertKey={!management && !previewGuardian && data.enrollment?.id ? `${accountId}:${data.enrollment.id}` : undefined}
      attendanceUrl={management ? `${studentFile}#ders-hareketleri` : attendanceUrl}
      attendanceLabel={management ? "Ders hakları ve telafiyi yönet" : undefined}
      requestUrl={`/veli-talepleri?child=${selectedId}${previewQuery}`}
      showRequestLink={!management}
    /> : null}

    {data.enrollment?.start_confirmation_required&&!data.enrollment?.actual_started_at?<div className="guardianFooterNote" role="status"><strong>Kurs başlangıcı bekleniyor</strong><p>Planlanan başlangıç: {formatDate(data.enrollment.start_date)}. Yönetim kursu başlattığında ders ve yoklama bilgileri bu ekranda güncellenecektir.</p></div>:null}
    {data.enrollment?.freeze_start_date && data.enrollment?.freeze_resume_date && (
      <div className="guardianFooterNote" role="status">
        <strong>Onaylı kayıt dondurma</strong>
        <p>Dondurma başlangıcı {formatDate(data.enrollment.freeze_start_date)}. {data.enrollment.freeze_restart_pending ? "Planlanan dönüş" : "Yeniden başlama"} {formatDate(data.enrollment.freeze_resume_date)}. {data.enrollment.freeze_restart_pending ? "Dersler, yönetim kaydı yeniden başlattığında devam eder." : "Dersler seans günlerinde devam eder."}</p>
      </div>
    )}
    {latestAbsence ? <section className="guardianAttendanceAlert" style={{margin:"0 0 16px",padding:"15px 17px",border:"1px solid #f3c9c9",borderRadius:16,background:"#fff7f7",color:"#7f1d1d"}}>
      <div style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"flex-start",flexWrap:"wrap"}}>
        <div><small style={{display:"block",fontWeight:900,letterSpacing:".08em",color:"#b42318"}}>DEVAMSIZLIK BİLDİRİMİ</small><strong style={{display:"block",marginTop:4,fontSize:16}}>{absenceStreak >= 2 ? `${absenceStreak} ders üst üste katılım sağlanmadı` : "Son derse katılım sağlanmadı"}</strong><span style={{display:"block",marginTop:4,fontSize:12,color:"#8b4a4a"}}>{formatDate(latestAbsence.lesson_date)} tarihli yoklama kaydı. Yoklama güncellendiğinde bu bilgi otomatik yenilenir.</span></div>
        <Link href={attendanceUrl} style={{padding:"8px 11px",border:"1px solid #efb4b4",borderRadius:10,background:"#fff",color:"#9f1d1d",fontWeight:900,textDecoration:"none",fontSize:12}}>{management ? "Yoklamayı aç" : "Yoklama Detayı"}</Link>
      </div>
    </section> : null}

    <PaymentReminder reminder={data.issues.some(issue=>issue.startsWith("Ödeme")) ? null : guardianCombinedReminder(data.enrollment, debt, data.paymentInstallments, data.paymentPlan,data.obligations||[])} accountId={accountId} enrollmentId={data.enrollment?.id} childId={data.selected.id} previewGuardian={previewGuardian} managementHref={management ? paymentUrl : undefined}/>
    {totalDebt > 0 && !data.issues.some(issue => (issue.startsWith("Ödeme") || issue.startsWith("Kayıt"))) ? <section className="guardianPaymentOverview">
      <div><span>Kalan ödeme</span><strong>{formatMoney(totalDebt)}</strong>
        <small>Paket {formatMoney(debt)} · Ek borç {formatMoney(extraDebt)}</small></div>
      <div className="guardianPayActions">
        {!management && !previewGuardian ? <Link className="guardianPayButton" href={`/veli-odemeler?child=${selectedId}#guvenli-odeme`}>Güvenli Ödeme Yap</Link> : null}
        <Link href={paymentUrl}>{management ? "Ödemeyi yönet" : "Ödeme detayları"}</Link>
      </div>
    </section> : null}
    {totalDebt <= 0 || data.issues.some(issue => issue.startsWith("Ödeme") || issue.startsWith("Kayıt")) ? <section className="guardianPaymentOverview">
      <div><span>Ödeme durumu</span><strong>{data.issues.some(issue => issue.startsWith("Ödeme") || issue.startsWith("Kayıt")) ? "Bilgi alınamadı" : !data.coursePackage && !data.paymentPlan ? "Paket tanımlanmadı" : "Borç bulunmuyor"}</strong></div>
      <div className="guardianPayActions"><Link href={paymentUrl}>{management ? "Ödemeyi yönet" : "Ödeme detayları"}</Link></div>
    </section> : null}
    <section className="guardianGrid">
      <article className="guardianCard courseDetails">
        <div className="guardianCardHeader"><div><h2>Kurs Bilgileri</h2></div><Link href={management ? `${studentFile}#kurs-kaydi` : attendanceUrl}><GuardianIcon name="calendar" size={16}/> {management ? "Kayıt ve programı yönet" : "Takvimi aç"}</Link></div>
        <dl className="courseFacts">
          <div><dt>Grup</dt><dd>{data.group?.name || "—"}</dd></div>
          <div><dt>Eğitmen</dt><dd>{data.coach?.full_name || "Atanmadı"}</dd></div>
          <div><dt>Paket</dt><dd>{data.coursePackage?.name || `${total || 0} Ders`}</dd></div>
          <div><dt>Başlangıç</dt><dd>{formatDate(data.enrollment?.start_date)}</dd></div>
          <div><dt>Planlanan bitiş</dt><dd>{formatDate(data.enrollment?.planned_end_date)}</dd></div>
        </dl>
        {data.schedules.length ? <div className="courseTimes"><h3>Ders programı</h3><div className="scheduleChips">{data.schedules.map((schedule: any) => <span className="scheduleChip" key={schedule.id}>{weekdayLabel(Number(schedule.weekday))} · {String(schedule.start_time).slice(0,5)}</span>)}</div></div> : null}
      </article>

      <article className="guardianCard">
        <div className="guardianCardHeader"><h2>Son Yoklamalar</h2><Link href={attendanceUrl}>{management ? "Yoklamayı yönet" : "Tümünü gör"}</Link></div>
        {currentAttendance.length > 0 && <div className="courseAttendance"><AttendanceSummary summary={currentPeriodAttendanceSummary(data.attendance,data.enrollment)} />{attendanceRate !== null && <span>Devam oranı <strong>%{attendanceRate}</strong></span>}</div>}
        <div className="timeline">{data.attendance.slice(0,5).map((item: any) => <div className="timelineItem" key={item.id}><time>{formatDate(item.lesson_date)}</time><strong>{item.coach_note || "Ders kaydı"}</strong><StatusPill tone={attendancePresentation(item.status).tone}>{attendancePresentation(item.status).label}</StatusPill></div>)}</div>
        {!data.attendance.length ? <p className="guardianSectionLead">Henüz yoklama kaydı bulunmuyor.</p> : null}
      </article>
    </section>

  </>;
}
