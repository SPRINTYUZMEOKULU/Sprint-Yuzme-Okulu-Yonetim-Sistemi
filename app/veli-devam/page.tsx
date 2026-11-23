import GuardianSectionHeading from "@/app/veli-paneli/section-heading";
import HistoryPagination from "@/app/veli-paneli/history-pagination";
import {loadGuardianPage} from "@/lib/guardian/page-context";
import { attendancePresentation } from "@/lib/guardian/presentation";
import { formatDate, weekdayLabel } from "@/lib/guardian/data";
import { EmptyGuardian, GuardianHeader, StatusPill } from "@/app/veli-paneli/guardian-ui";
import "@/app/veli-paneli/veli.css";
export const dynamic = "force-dynamic";
export default async function Page({ searchParams }:{searchParams:Promise<{child?:string;previewGuardian?:string;page?:string}>}){
 const query=await searchParams; const {profile,data,previewGuardian}=await loadGuardianPage(query,"attendance");
 return <main className="guardianShell"><GuardianHeader previewGuardian={previewGuardian} name={profile.full_name||"Değerli Velimiz"} issues={data.issues} students={data.students} selectedId={data.selected?.id}/><div className="guardianContent"><GuardianSectionHeading icon="calendar" title="Dersler ve Yoklama" description="Planlanan ders günleri, katılım geçmişi ve eğitmen notları."/>{!data.selected?<EmptyGuardian title="Öğrenci bulunamadı" text="Öğrenci bağlantısı tamamlandığında ders kayıtları burada görünecek."/>:<><section className="guardianCard"><div className="guardianCardHeader"><h2>Haftalık Program</h2></div>{data.enrollment?.freeze_start_date && <p className="guardianSectionLead">Dondurma başlangıcı {formatDate(data.enrollment.freeze_start_date)} · Yeniden başlama {formatDate(data.enrollment.freeze_resume_date)}</p>}{data.schedules.length ? <ul className="lessonWeek">{data.schedules.map((lesson:any) =>
  <li key={lesson.id}><strong>{weekdayLabel(Number(lesson.weekday))}</strong><span>{String(lesson.start_time).slice(0,5)} – {String(lesson.end_time).slice(0,5)}</span></li>)}</ul>
  : <p className="lessonEmpty">{data.issues.some(issue => issue.startsWith("Ders programı") || issue.startsWith("Grup") || issue.startsWith("Kayıt")) ? "Ders programı yüklenemedi." : "Henüz ders programı tanımlanmadı."}</p>}</section><section className="guardianCard" style={{marginTop:18}}><div className="guardianCardHeader"><h2>Yoklama Geçmişi</h2></div>{data.attendance.length > 0 && <ul className="lessonHistory">{data.attendance.map((record:any) => {
  const status = attendancePresentation(record.status);
  return <li key={record.id}><div><time dateTime={record.lesson_date}>{formatDate(record.lesson_date)}</time><StatusPill tone={status.tone}>{status.label}</StatusPill></div>
    {record.coach_note && <p><strong>Eğitmen notu</strong> {record.coach_note}</p>}</li>;
 })}</ul>}<HistoryPagination path="/veli-devam" page={data.historyPage||1} hasNext={data.historyHasNext||false} child={data.selected.id} previewGuardian={previewGuardian}/>{!data.attendance.length?<p className="lessonEmpty">{data.issues.some(issue => issue.startsWith("Yoklama")) ? "Yoklama kayıtları yüklenemedi." : "Bu sayfada henüz yoklama kaydı yok."}</p>:null}</section></>}</div></main>
}
