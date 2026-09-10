import { NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const ROLES = ["owner", "admin", "branch_manager", "registration_staff", "accounting"] as const;
const editable = new Set(["first_name","last_name","birth_date","phone","guardian_name","guardian_phone","email","guardian_email","swimming_level","branch_name","group_name","package_name","start_date","payment_due_date","registration_note"]);

function clean(value: unknown) { return String(value ?? "").trim(); }
function norm(value: unknown) { return clean(value).toLocaleLowerCase("tr-TR"); }
function nullable(value: string) { return value === "TEMİZLE" ? null : value; }

function calculateEndDate(startDate: string, lessonCount: number, weekdays: number[]) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || lessonCount < 1 || !weekdays.length) return null;
  const allowed = new Set(weekdays.map((d) => d === 7 ? 0 : d));
  const cursor = new Date(`${startDate}T12:00:00+03:00`);
  let remaining = lessonCount; let safety = 0;
  while (remaining > 0 && safety < 730) {
    if (allowed.has(cursor.getDay())) remaining--;
    if (remaining > 0) cursor.setDate(cursor.getDate() + 1);
    safety++;
  }
  if (remaining !== 0) return null;
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone:"Europe/Istanbul", year:"numeric", month:"2-digit", day:"2-digit" }).format(cursor);
  return parts;
}

export async function POST(request: Request) {
  try {
    const profile = await requireProfile([...ROLES]);
    const organizationId = profile.organization_id;
    if (!organizationId) return NextResponse.json({ error:"Organizasyon bilgisi bulunamadı." }, { status:400 });
    const body = await request.json().catch(() => null);
    const rows = Array.isArray(body?.rows) ? body.rows.slice(0, 1000) : [];
    if (!rows.length) return NextResponse.json({ error:"Uygulanacak değişiklik bulunamadı." }, { status:400 });
    const supabase = await createClient();

    const [branchesResult, groupsResult, packagesResult] = await Promise.all([
      supabase.from("branches").select("id,name").eq("organization_id", organizationId).eq("is_active", true),
      supabase.from("training_groups").select("id,name,branch_id,course_type").eq("organization_id", organizationId).eq("is_active", true),
      supabase.from("course_packages").select("id,name,lesson_count,price,course_type").eq("organization_id", organizationId).eq("is_active", true),
    ]);
    const branches = branchesResult.data || []; const groups = groupsResult.data || []; const packages = packagesResult.data || [];
    const branchByName = new Map(branches.map((x:any)=>[norm(x.name), x]));
    const groupByName = new Map(groups.map((x:any)=>[norm(x.name), x]));
    const packageByName = new Map(packages.map((x:any)=>[norm(x.name), x]));

    let updated = 0; const errors: string[] = [];
    for (const item of rows) {
      const studentId = clean(item?.student_id); const studentNo = clean(item?.student_number);
      const rawChanges = item?.changes && typeof item.changes === "object" ? item.changes as Record<string, unknown> : {};
      const changes = Object.fromEntries(Object.entries(rawChanges).filter(([key]) => editable.has(key)).map(([key,value]) => [key, clean(value)]));
      if (!studentId || !Object.keys(changes).length) continue;

      const { data: student } = await supabase.from("students").select("*").eq("organization_id", organizationId).eq("id", studentId).maybeSingle();
      if (!student) { errors.push(`${studentNo || studentId}: öğrenci bulunamadı`); continue; }
      if (studentNo && student.student_number && studentNo !== student.student_number) { errors.push(`${studentNo}: öğrenci numarası eşleşmiyor`); continue; }

      const { data: enrollment } = await supabase.from("student_enrollments").select("*").eq("organization_id", organizationId).eq("student_id", studentId).eq("status", "active").order("created_at", { ascending:false }).limit(1).maybeSingle();
      const { data: plan } = await supabase.from("student_attendance_plans").select("*").eq("organization_id", organizationId).eq("student_id", studentId).eq("is_active", true).order("created_at", { ascending:false }).limit(1).maybeSingle();

      const studentUpdate: Record<string, unknown> = {};
      const enrollmentUpdate: Record<string, unknown> = {};
      const planUpdate: Record<string, unknown> = {};
      const applied: Record<string, {old: unknown; new: unknown}> = {};

      const simpleStudentFields = ["first_name","last_name","birth_date","phone","guardian_name","guardian_phone","email","guardian_email","swimming_level","registration_note"];
      for (const key of simpleStudentFields) if (key in changes) {
        const value = nullable(changes[key]);
        const old = student[key] ?? null;
        if (String(old ?? "") !== String(value ?? "")) { studentUpdate[key] = value; applied[key] = { old, new:value }; }
      }

      let branch = changes.branch_name ? branchByName.get(norm(changes.branch_name)) as any : null;
      if (changes.branch_name && !branch) { errors.push(`${student.student_number || studentId}: şube bulunamadı (${changes.branch_name})`); continue; }
      let group = changes.group_name ? groupByName.get(norm(changes.group_name)) as any : null;
      if (changes.group_name && !group) { errors.push(`${student.student_number || studentId}: grup bulunamadı (${changes.group_name})`); continue; }
      let pkg = changes.package_name ? packageByName.get(norm(changes.package_name)) as any : null;
      if (changes.package_name && !pkg) { errors.push(`${student.student_number || studentId}: paket bulunamadı (${changes.package_name})`); continue; }

      if (group && branch && group.branch_id !== branch.id) { errors.push(`${student.student_number || studentId}: seçilen grup seçilen şubeye bağlı değil`); continue; }
      if (group && !branch) branch = branches.find((b:any)=>b.id===group.branch_id) || null;
      if (group && pkg && group.course_type && pkg.course_type && group.course_type !== pkg.course_type) { errors.push(`${student.student_number || studentId}: grup ile paket kurs türü uyumsuz`); continue; }

      if (branch) {
        if (student.branch_id !== branch.id) applied.branch_name = { old: student.branch_id, new: branch.id };
        studentUpdate.branch_id = branch.id; if (enrollment) enrollmentUpdate.branch_id = branch.id;
      }
      if (group) {
        const oldGroup = enrollment?.group_id ?? student.preferred_group_id ?? null;
        if (oldGroup !== group.id) applied.group_name = { old: oldGroup, new:group.id };
        studentUpdate.preferred_group_id = group.id; if (enrollment) enrollmentUpdate.group_id = group.id; if (plan) planUpdate.group_id = group.id;
      }
      if (pkg) {
        const oldPkg = enrollment?.package_id ?? student.preferred_package_id ?? null;
        if (oldPkg !== pkg.id) applied.package_name = { old:oldPkg, new:pkg.id };
        studentUpdate.preferred_package_id = pkg.id;
        if (enrollment) { enrollmentUpdate.package_id = pkg.id; enrollmentUpdate.total_lessons = Number(pkg.lesson_count || enrollment.total_lessons || 0); }
      }
      if (changes.start_date) {
        const value = nullable(changes.start_date);
        if (enrollment) { applied.start_date = { old: enrollment.start_date, new:value }; enrollmentUpdate.start_date = value; }
        if (plan) planUpdate.start_date = value;
      }
      if (changes.payment_due_date && enrollment) {
        const value = nullable(changes.payment_due_date); applied.payment_due_date = { old:enrollment.payment_due_date, new:value }; enrollmentUpdate.payment_due_date = value;
      }

      const effectiveStart = String(enrollmentUpdate.start_date ?? enrollment?.start_date ?? "");
      const effectiveLessons = Number(enrollmentUpdate.total_lessons ?? enrollment?.total_lessons ?? pkg?.lesson_count ?? 0);
      const weekdays = Array.isArray(plan?.selected_weekdays) ? plan.selected_weekdays.map(Number).filter((x:number)=>x>=1&&x<=7) : [];
      const recalculatedEnd = calculateEndDate(effectiveStart, effectiveLessons, weekdays);
      if (recalculatedEnd && enrollment) enrollmentUpdate.planned_end_date = recalculatedEnd;
      if (recalculatedEnd && plan) planUpdate.normal_planned_end_date = recalculatedEnd;

      if (Object.keys(studentUpdate).length) {
        const { error } = await supabase.from("students").update(studentUpdate).eq("organization_id", organizationId).eq("id", studentId);
        if (error) { errors.push(`${student.student_number || studentId}: öğrenci güncellenemedi - ${error.message}`); continue; }
      }
      if (enrollment && Object.keys(enrollmentUpdate).length) {
        const { error } = await supabase.from("student_enrollments").update(enrollmentUpdate).eq("organization_id", organizationId).eq("id", enrollment.id);
        if (error) { errors.push(`${student.student_number || studentId}: kayıt güncellenemedi - ${error.message}`); continue; }
      }
      if (group) {
        await supabase.from("student_group_memberships").update({ group_id:group.id }).eq("organization_id", organizationId).eq("student_id", studentId).eq("is_active", true);
      }
      if (plan && Object.keys(planUpdate).length) {
        await supabase.from("student_attendance_plans").update(planUpdate).eq("organization_id", organizationId).eq("id", plan.id);
      }

      const editor = (profile as any).full_name || (profile as any).email || "Yetkili kullanıcı";
      await supabase.from("student_activity_logs").insert({
        organization_id: organizationId,
        student_id: studentId,
        activity_type: "bulk_data_correction_import",
        title: "Excel veri düzeltmesi uygulandı",
        description: `${editor} tarafından Veri Düzeltme Merkezi üzerinden ${Object.keys(applied).length} alan güncellendi.`,
        new_value: { changes:applied, editor_profile_id:profile.id },
        source_type: "student_data_correction_center",
        source_id: studentId,
        performed_at: new Date().toISOString(),
      });
      updated++;
    }

    return NextResponse.json({ ok:true, updated, errors });
  } catch (error) {
    return NextResponse.json({ error:error instanceof Error ? error.message : "Veri düzeltmeleri uygulanamadı." }, { status:500 });
  }
}
