import Link from "next/link";
import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import CorrectionForm from "./correction-form";
import CorrectionWhatsapp from "./correction-whatsapp";
import "./duzeltme.css";

export const dynamic = "force-dynamic";

const DAYS: Record<number, string> = { 1: "Pazartesi", 2: "Salı", 3: "Çarşamba", 4: "Perşembe", 5: "Cuma", 6: "Cumartesi", 7: "Pazar" };
const shortTime = (value?: string | null) => String(value || "").slice(0, 5);

export default async function ManagerCorrectionPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const profile = await requireProfile(["owner", "admin"]);
  const { id } = await params;
  const query = await searchParams;
  const organizationId = profile.organization_id;
  const supabase = await createClient();
  if (!organizationId) notFound();

  const [studentResult, enrollmentResult, planResult, branchesResult, groupsResult, packagesResult, schedulesResult] = await Promise.all([
    supabase.from("students").select("*").eq("organization_id", organizationId).eq("id", id).maybeSingle(),
    supabase.from("student_enrollments").select("*").eq("organization_id", organizationId).eq("student_id", id).eq("status", "active").order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("student_attendance_plans").select("*").eq("organization_id", organizationId).eq("student_id", id).eq("is_active", true).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("branches").select("id,name").eq("organization_id", organizationId).eq("is_active", true).order("name"),
    supabase.from("training_groups").select("id,name,branch_id").eq("organization_id", organizationId).eq("is_active", true).order("name"),
    supabase.from("course_packages").select("id,name,lesson_count,price").eq("organization_id", organizationId).order("name"),
    supabase.from("lesson_schedules").select("id,group_id,weekday,start_time,end_time").eq("organization_id", organizationId).eq("is_active", true).order("weekday").order("start_time"),
  ]);

  if (!studentResult.data) notFound();
  const student = studentResult.data;
  const savedEnrollment = enrollmentResult.data;
  const savedBranch = (branchesResult.data || []).find((branch) => branch.id === savedEnrollment?.branch_id);
  const savedGroup = (groupsResult.data || []).find((group) => group.id === savedEnrollment?.group_id);
  const savedPackage = (packagesResult.data || []).find((coursePackage) => coursePackage.id === savedEnrollment?.package_id);
  const selectedDays = new Set((planResult.data?.selected_weekdays || []).map(Number));
  const savedSessions = (schedulesResult.data || [])
    .filter((schedule) => schedule.group_id === savedEnrollment?.group_id && selectedDays.has(Number(schedule.weekday)))
    .map((schedule) => `${DAYS[Number(schedule.weekday)] || "Ders"} ${shortTime(schedule.start_time)}-${shortTime(schedule.end_time)}`);
  const savedProgramLabel = savedSessions.length ? savedSessions.join(" · ") : (savedGroup?.name || "—");

  return (
    <main className="correctionPage">
      <div className="correctionShell">
        <div className="correctionTopNav">
          <Link href={`/ogrenciler/${id}`}>← Öğrenci Dosyasına Dön</Link>
          <Link href="/ogrenciler">Öğrenci Merkezi</Link>
        </div>

        <section className="correctionHero">
          <div><span>SPRİNTOS · YÖNETİCİ KONTROLLÜ ALAN</span><h1>Kesin Kayıt Düzeltme Merkezi</h1><p>Kesinleşmiş öğrenci, paket ve program verilerini düzeltin. Eski değerler kaybolmaz; her değişiklik yönetici denetim kaydı olarak işlem geçmişine kilitlenir.</p></div>
          <aside><strong>{student.first_name} {student.last_name}</strong><span>Aktif kayıt: {enrollmentResult.data ? "Bulundu" : "Bulunamadı"}</span><small>Yalnız Owner / Admin erişebilir</small></aside>
        </section>

        {query.saved === "1" ? (
          <div className="correctionNotice success">
            <strong>✓ Düzeltme uygulandı.</strong>
            <span>Eski ve yeni değerler öğrenci işlem geçmişine kilitli denetim kaydı olarak eklendi.</span>
            <div className="savedSummary" aria-label="Kaydedilen güncel bilgiler">
              <div><small>Şube</small><b>{savedBranch?.name || "—"}</b></div><div><small>Grup / Seanslar</small><b>{savedProgramLabel}</b></div><div><small>Paket</small><b>{savedPackage?.name || "—"}</b></div><div><small>Toplam Ders</small><b>{savedEnrollment?.total_lessons ?? "—"}</b></div><div><small>Başlangıç</small><b>{savedEnrollment?.start_date || "—"}</b></div><div><small>Planlanan Bitiş</small><b>{savedEnrollment?.planned_end_date || "—"}</b></div><div><small>Ödeme Vadesi</small><b>{savedEnrollment?.payment_due_date || "—"}</b></div>
            </div>
            <CorrectionWhatsapp
              studentName={`${student.first_name || ""} ${student.last_name || ""}`.trim()}
              phone={student.phone}
              guardianPhone={student.guardian_phone}
              branchName={savedBranch?.name}
              groupName={savedProgramLabel}
              packageName={savedPackage?.name}
              totalLessons={savedEnrollment?.total_lessons}
              startDate={savedEnrollment?.start_date}
              plannedEndDate={savedEnrollment?.planned_end_date}
              paymentDueDate={savedEnrollment?.payment_due_date}
              sessions={savedSessions}
            />
          </div>
        ) : null}

        {query.error ? <div className="correctionNotice error"><strong>İşlem tamamlanamadı.</strong><span>{query.error}</span></div> : null}
        {!enrollmentResult.data ? <div className="correctionNotice error"><strong>Aktif kayıt bulunamadı.</strong><span>Paket/program düzeltmesi için öğrencinin aktif kaydı olmalıdır.</span></div> : (
          <CorrectionForm student={student} enrollment={enrollmentResult.data} attendancePlan={planResult.data || null} branches={branchesResult.data || []} groups={groupsResult.data || []} packages={packagesResult.data || []} schedules={schedulesResult.data || []} />
        )}
      </div>
    </main>
  );
}
