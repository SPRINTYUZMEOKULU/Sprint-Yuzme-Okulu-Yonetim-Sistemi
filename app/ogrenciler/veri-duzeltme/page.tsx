import Link from "next/link";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { requireProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import UstGezinme from "@/app/components/UstGezinme";
import DataCorrectionClient, { type CorrectionRow } from "./data-correction-client";
import "../../dashboard.css";

export const dynamic = "force-dynamic";

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase finans bağlantısı yapılandırılmamış.");
  return createAdminClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function n(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function missing(row: CorrectionRow) {
  const issues: string[] = [];
  if (!row.birth_date) issues.push("Doğum tarihi eksik");
  if (!row.phone && !row.guardian_phone) issues.push("Telefon eksik");
  if (!row.guardian_name) issues.push("Veli adı eksik");
  if (!row.swimming_level) issues.push("Seviye eksik");
  if (!row.branch_name) issues.push("Şube eksik");
  if (!row.group_name) issues.push("Grup eksik");
  if (!row.package_name) issues.push("Paket eksik");
  if (!row.start_date) issues.push("Başlangıç tarihi eksik");
  if (!row.payment_due_date && row.payment_outstanding > 0) issues.push("Ödeme vadesi eksik");
  if (row.payment_outstanding > 0) issues.push(`Ödeme bekliyor: ${row.payment_outstanding.toLocaleString("tr-TR")} TL`);
  if (row.package_lesson_count > 0 && row.total_lessons > 0 && row.package_lesson_count !== row.total_lessons) issues.push("Paket / ders sayısı uyuşmuyor");
  return issues.join(" | ");
}

export default async function StudentDataCorrectionPage() {
  const profile = await requireProfile(["owner", "admin", "branch_manager", "registration_staff", "accounting"]);
  const organizationId = profile.organization_id;
  if (!organizationId) return <main className="operationPage"><div className="tableEmpty">Organizasyon bilgisi bulunamadı.</div></main>;

  const supabase = await createClient();
  const finance = adminClient();

  const [studentsResult, branchesResult, groupsResult, packagesResult, enrollmentsResult, plansResult, balancesResult, paymentsResult] = await Promise.all([
    supabase.from("students").select("id,student_number,first_name,last_name,birth_date,phone,guardian_name,guardian_phone,email,guardian_email,swimming_level,status,branch_id,preferred_group_id,preferred_package_id,registration_note,created_at,is_deleted").eq("organization_id", organizationId).eq("is_deleted", false).order("first_name"),
    supabase.from("branches").select("id,name").eq("organization_id", organizationId).eq("is_active", true).order("name"),
    supabase.from("training_groups").select("id,name,branch_id,course_type").eq("organization_id", organizationId).eq("is_active", true).order("name"),
    supabase.from("course_packages").select("id,name,lesson_count,price,course_type").eq("organization_id", organizationId).eq("is_active", true).order("lesson_count"),
    supabase.from("student_enrollments").select("id,student_id,branch_id,group_id,package_id,total_lessons,used_lessons,start_date,planned_end_date,payment_due_date,status,created_at").eq("organization_id", organizationId).eq("status", "active").order("created_at", { ascending: false }),
    supabase.from("student_attendance_plans").select("student_id,selected_weekdays,normal_planned_end_date,compensation_planned_end_date,is_active,created_at").eq("organization_id", organizationId).eq("is_active", true).order("created_at", { ascending: false }),
    supabase.from("student_lesson_balance").select("student_id,normal_lesson_balance,compensation_lesson_balance"),
    finance.from("student_payment_summary").select("student_id,total_received,total_amount,outstanding_balance,payment_status,payment_due_date,last_payment_at").eq("organization_id", organizationId),
  ]);

  if (studentsResult.error) throw new Error(studentsResult.error.message);

  const latest = <T extends { student_id?: string | null }>(rows: T[]) => {
    const map = new Map<string, T>();
    for (const row of rows) if (row.student_id && !map.has(row.student_id)) map.set(row.student_id, row);
    return map;
  };

  const branches = branchesResult.data || [];
  const groups = groupsResult.data || [];
  const packages = packagesResult.data || [];
  const branchMap = new Map(branches.map((x: any) => [x.id, x.name]));
  const groupMap = new Map(groups.map((x: any) => [x.id, x]));
  const packageMap = new Map(packages.map((x: any) => [x.id, x]));
  const enrollmentMap = latest((enrollmentsResult.data || []) as any[]);
  const planMap = latest((plansResult.data || []) as any[]);
  const balanceMap = latest((balancesResult.data || []) as any[]);
  const paymentMap = latest((paymentsResult.data || []) as any[]);

  const rows: CorrectionRow[] = (studentsResult.data || []).map((student: any) => {
    const enrollment: any = enrollmentMap.get(student.id);
    const plan: any = planMap.get(student.id);
    const balance: any = balanceMap.get(student.id);
    const payment: any = paymentMap.get(student.id);
    const groupId = enrollment?.group_id || student.preferred_group_id || null;
    const group: any = groupId ? groupMap.get(groupId) : null;
    const branchId = enrollment?.branch_id || group?.branch_id || student.branch_id || null;
    const packageId = enrollment?.package_id || student.preferred_package_id || null;
    const pkg: any = packageId ? packageMap.get(packageId) : null;
    const totalLessons = n(enrollment?.total_lessons ?? pkg?.lesson_count);
    const usedLessons = n(enrollment?.used_lessons);
    const compensation = Math.max(0, n(balance?.compensation_lesson_balance));
    const normalRemaining = Math.max(0, totalLessons - usedLessons);
    const row: CorrectionRow = {
      student_id: student.id,
      student_number: student.student_number || "",
      student_name: `${student.first_name || ""} ${student.last_name || ""}`.trim(),
      first_name: student.first_name || "",
      last_name: student.last_name || "",
      birth_date: student.birth_date || "",
      phone: student.phone || "",
      guardian_name: student.guardian_name || "",
      guardian_phone: student.guardian_phone || "",
      email: student.email || "",
      guardian_email: student.guardian_email || "",
      swimming_level: student.swimming_level || "",
      status: student.status || "",
      branch_name: branchId ? String(branchMap.get(branchId) || "") : "",
      group_name: group?.name || "",
      package_name: pkg?.name || "",
      registration_note: student.registration_note || "",
      start_date: enrollment?.start_date || "",
      payment_due_date: enrollment?.payment_due_date || payment?.payment_due_date || "",
      schedule_days: Array.isArray(plan?.selected_weekdays) ? plan.selected_weekdays.join(",") : "",
      normal_end_date: plan?.normal_planned_end_date || enrollment?.planned_end_date || "",
      compensation_end_date: plan?.compensation_planned_end_date || "",
      package_lesson_count: n(pkg?.lesson_count),
      total_lessons: totalLessons,
      used_lessons: usedLessons,
      normal_remaining: normalRemaining,
      compensation_remaining: compensation,
      total_remaining: normalRemaining + compensation,
      package_price: n(pkg?.price ?? payment?.total_amount),
      payment_received: n(payment?.total_received),
      payment_outstanding: n(payment?.outstanding_balance),
      payment_status: payment?.payment_status || "",
      last_payment_at: payment?.last_payment_at || "",
      issues: "",
    };
    row.issues = missing(row);
    return row;
  });

  return (
    <>
      <UstGezinme />
      <main className="operationPage" style={{ paddingTop: 22 }}>
        <header className="operationHeader">
          <div>
            <p>SPRİNTOS · VERİ KALİTE MERKEZİ</p>
            <h1>Öğrenci Veri Düzeltme Merkezi</h1>
            <span>Öğrenci adı ve SPR numarası birlikte korunur. Eksik/hatalı verileri Excel uyumlu dosyada düzeltip kontrollü olarak yeniden içeri aktarabilirsiniz.</span>
          </div>
          <Link href="/ogrenciler" style={{ color: "white", fontWeight: 800, textDecoration: "none" }}>← Öğrenci Merkezine Dön</Link>
        </header>
        <DataCorrectionClient rows={rows} branches={branches.map((x:any)=>x.name)} groups={groups.map((x:any)=>x.name)} packages={packages.map((x:any)=>x.name)} />
      </main>
    </>
  );
}
