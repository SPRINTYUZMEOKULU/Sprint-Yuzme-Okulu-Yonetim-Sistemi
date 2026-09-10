import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type AttendanceStatus = "present" | "absent" | "excused";
type ImportRecord = {
  studentId: string;
  enrollmentId?: string | null;
  groupId: string;
  scheduleId: string;
  lessonDate: string;
  status: AttendanceStatus;
};

type ProfileRow = {
  id: string;
  organization_id: string | null;
  full_name: string | null;
  role: string | null;
};

const ROLES = ["owner", "admin", "branch_manager", "registration_staff", "accounting", "coach"];
const MANAGER_ROLES = ["owner", "admin"];
const STATUSES: AttendanceStatus[] = ["present", "absent", "excused"];
const REQUEST_TYPE = "attendance_history_import";

function clean(value: unknown, max = 200) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function todayTR() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function validMonth(value: string) {
  return /^\d{4}-\d{2}$/.test(value);
}

function validDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function weekday(value: string) {
  const day = new Date(`${value}T12:00:00+03:00`).getDay();
  return day === 0 ? 7 : day;
}

function unique(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

async function getProfile(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("id,organization_id,full_name,role")
    .eq("id", auth.user.id)
    .maybeSingle();

  if (!data?.organization_id || !ROLES.includes(data.role || "")) return null;
  return data as ProfileRow;
}

async function syncEnrollmentUsedLessons(
  supabase: Awaited<ReturnType<typeof createClient>>,
  organizationId: string,
  enrollmentIds: string[],
) {
  const ids = unique(enrollmentIds);
  if (!ids.length) return;

  const { data: enrollments, error: enrollmentError } = await supabase
    .from("student_enrollments")
    .select("id,total_lessons,used_lessons")
    .eq("organization_id", organizationId)
    .in("id", ids);

  if (enrollmentError) throw new Error(`Ders paketleri okunamadı: ${enrollmentError.message}`);

  const { data: attendance, error: attendanceError } = await supabase
    .from("attendance_records")
    .select("enrollment_id,status")
    .eq("organization_id", organizationId)
    .in("enrollment_id", ids)
    .in("status", ["present", "absent", "excused"]);

  if (attendanceError) throw new Error(`Kullanılan dersler hesaplanamadı: ${attendanceError.message}`);

  const counts = new Map<string, number>();
  for (const row of attendance || []) {
    if (!row.enrollment_id) continue;
    counts.set(row.enrollment_id, (counts.get(row.enrollment_id) || 0) + 1);
  }

  for (const enrollment of enrollments || []) {
    const count = counts.get(enrollment.id) || 0;
    const total = Math.max(0, Number(enrollment.total_lessons || 0));
    const next = total > 0 ? Math.min(count, total) : count;
    if (Number(enrollment.used_lessons || 0) === next) continue;

    const { error } = await supabase
      .from("student_enrollments")
      .update({ used_lessons: next, updated_at: new Date().toISOString() })
      .eq("organization_id", organizationId)
      .eq("id", enrollment.id);

    if (error) throw new Error(`Kullanılan ders sayısı güncellenemedi: ${error.message}`);
  }
}

async function validateRecords(
  supabase: Awaited<ReturnType<typeof createClient>>,
  organizationId: string,
  month: string,
  rawRecords: unknown,
) {
  if (!Array.isArray(rawRecords) || !rawRecords.length || rawRecords.length > 800) {
    throw new Error("Kaydedilecek yoklama seçimi bulunamadı.");
  }

  const records: ImportRecord[] = [];
  const seen = new Set<string>();
  const today = todayTR();

  for (const item of rawRecords) {
    const row = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
    const studentId = clean(row.studentId, 100);
    const enrollmentId = clean(row.enrollmentId, 100) || null;
    const groupId = clean(row.groupId, 100);
    const scheduleId = clean(row.scheduleId, 100);
    const lessonDate = clean(row.lessonDate, 10);
    const status = clean(row.status, 20) as AttendanceStatus;

    if (!studentId || !groupId || !scheduleId || !validDate(lessonDate) || !STATUSES.includes(status)) {
      throw new Error("Geçersiz yoklama satırı bulundu.");
    }
    if (!lessonDate.startsWith(`${month}-`) || lessonDate > today) {
      throw new Error("Geçmiş yoklama yalnız seçilen ay içindeki gerçekleşmiş derslere girilebilir.");
    }

    const key = `${studentId}:${lessonDate}:${groupId}:${scheduleId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    records.push({ studentId, enrollmentId, groupId, scheduleId, lessonDate, status });
  }

  const studentIds = unique(records.map((row) => row.studentId));
  const groupIds = unique(records.map((row) => row.groupId));
  const scheduleIds = unique(records.map((row) => row.scheduleId));
  const enrollmentIds = unique(records.map((row) => row.enrollmentId || null));

  const [studentResult, groupResult, scheduleResult, enrollmentResult, membershipResult] = await Promise.all([
    supabase.from("students").select("id").eq("organization_id", organizationId).in("id", studentIds),
    supabase.from("training_groups").select("id,branch_id").eq("organization_id", organizationId).in("id", groupIds),
    supabase.from("lesson_schedules").select("id,group_id,branch_id,coach_id,weekday").eq("organization_id", organizationId).in("id", scheduleIds),
    enrollmentIds.length
      ? supabase.from("student_enrollments").select("id,student_id,group_id").eq("organization_id", organizationId).in("id", enrollmentIds)
      : Promise.resolve({ data: [], error: null } as any),
    supabase.from("student_group_memberships").select("student_id,group_id").eq("organization_id", organizationId).in("student_id", studentIds),
  ]);

  const queryError = studentResult.error || groupResult.error || scheduleResult.error || enrollmentResult.error || membershipResult.error;
  if (queryError) throw new Error(`Yoklama doğrulanamadı: ${queryError.message}`);

  const students = new Set((studentResult.data || []).map((row: any) => row.id));
  const groups = new Map((groupResult.data || []).map((row: any) => [row.id, row]));
  const schedules = new Map((scheduleResult.data || []).map((row: any) => [row.id, row]));
  const enrollments = new Map((enrollmentResult.data || []).map((row: any) => [row.id, row]));
  const memberships = new Set((membershipResult.data || []).map((row: any) => `${row.student_id}:${row.group_id}`));

  const normalized = records.map((row) => {
    if (!students.has(row.studentId)) throw new Error("Kuruma ait olmayan öğrenci bulundu.");
    const group: any = groups.get(row.groupId);
    const schedule: any = schedules.get(row.scheduleId);
    if (!group || !schedule || schedule.group_id !== row.groupId) {
      throw new Error("Seçilen grup ile ders seansı eşleşmiyor.");
    }
    if (Number(schedule.weekday) !== weekday(row.lessonDate)) {
      throw new Error("Seçilen tarih ders programının günü ile eşleşmiyor.");
    }

    if (row.enrollmentId) {
      const enrollment: any = enrollments.get(row.enrollmentId);
      if (!enrollment || enrollment.student_id !== row.studentId || (enrollment.group_id && enrollment.group_id !== row.groupId)) {
        throw new Error("Öğrenci paket kaydı seçilen grup ile eşleşmiyor.");
      }
    } else if (!memberships.has(`${row.studentId}:${row.groupId}`)) {
      throw new Error("Öğrencinin seçilen grupta üyelik veya paket kaydı bulunamadı.");
    }

    return {
      ...row,
      branchId: schedule.branch_id || group.branch_id || null,
      coachId: schedule.coach_id || null,
    };
  });

  return normalized;
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const profile = await getProfile(supabase);
    if (!profile?.organization_id) return NextResponse.json({ ok: false, error: "Yetkisiz işlem." }, { status: 401 });

    const url = new URL(request.url);
    const month = clean(url.searchParams.get("month"), 7) || todayTR().slice(0, 7);
    if (!validMonth(month)) return NextResponse.json({ ok: false, error: "Geçersiz ay." }, { status: 400 });

    const start = `${month}-01`;
    const nextDate = new Date(`${start}T12:00:00+03:00`);
    nextDate.setMonth(nextDate.getMonth() + 1);
    const end = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, "0")}-01`;

    const [branches, groups, schedules, memberships, students, enrollments, attendance] = await Promise.all([
      supabase.from("branches").select("id,name,short_name,is_active").eq("organization_id", profile.organization_id).eq("is_active", true).order("name"),
      supabase.from("training_groups").select("id,branch_id,name,course_type,is_active").eq("organization_id", profile.organization_id).eq("is_active", true).order("sort_order"),
      supabase.from("lesson_schedules").select("id,branch_id,group_id,coach_id,weekday,start_time,end_time,is_active").eq("organization_id", profile.organization_id).eq("is_active", true).order("weekday").order("start_time"),
      supabase.from("student_group_memberships").select("student_id,group_id,is_active").eq("organization_id", profile.organization_id).eq("is_active", true),
      supabase.from("students").select("id,first_name,last_name,student_number,guardian_name,guardian_phone,phone,is_deleted,status").eq("organization_id", profile.organization_id).eq("is_deleted", false).order("first_name"),
      supabase.from("student_enrollments").select("id,student_id,group_id,start_date,planned_end_date,normal_end_date,compensation_end_date,total_lessons,used_lessons,status").eq("organization_id", profile.organization_id),
      supabase.from("attendance_records").select("student_id,enrollment_id,group_id,schedule_id,lesson_date,status").eq("organization_id", profile.organization_id).gte("lesson_date", start).lt("lesson_date", end),
    ]);

    const error = branches.error || groups.error || schedules.error || memberships.error || students.error || enrollments.error || attendance.error;
    if (error) return NextResponse.json({ ok: false, error: `Veriler yüklenemedi: ${error.message}` }, { status: 500 });

    let pendingQuery = supabase
      .from("approval_requests")
      .select("id,request_type,status,reason,new_values,requested_by,requested_by_name,requested_at,created_at")
      .eq("organization_id", profile.organization_id)
      .eq("request_type", REQUEST_TYPE)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(50);

    if (!MANAGER_ROLES.includes(profile.role || "")) pendingQuery = pendingQuery.eq("requested_by", profile.id);
    const pending = await pendingQuery;

    return NextResponse.json({
      ok: true,
      month,
      canApprove: MANAGER_ROLES.includes(profile.role || ""),
      profile: { id: profile.id, fullName: profile.full_name || "", role: profile.role || "" },
      branches: branches.data || [],
      groups: groups.data || [],
      schedules: schedules.data || [],
      memberships: memberships.data || [],
      students: students.data || [],
      enrollments: enrollments.data || [],
      attendance: attendance.data || [],
      pendingRequests: pending.data || [],
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Geçmiş yoklama verisi alınamadı." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const profile = await getProfile(supabase);
    if (!profile?.organization_id) return NextResponse.json({ ok: false, error: "Yetkisiz işlem." }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const action = clean(body.action, 30);

    if (action === "submit") {
      const month = clean(body.month, 7);
      const mode = clean(body.mode, 30) || "student";
      if (!validMonth(month)) return NextResponse.json({ ok: false, error: "Geçersiz ay." }, { status: 400 });

      const records = await validateRecords(supabase, profile.organization_id, month, body.records);
      const studentIds = unique(records.map((row) => row.studentId));
      const branchIds = unique(records.map((row) => row.branchId));
      const groupIds = unique(records.map((row) => row.groupId));
      const entityId = crypto.randomUUID();

      const { data: created, error } = await supabase
        .from("approval_requests")
        .insert({
          organization_id: profile.organization_id,
          request_type: REQUEST_TYPE,
          module: "attendance",
          entity_type: "attendance_batch",
          entity_id: entityId,
          student_id: studentIds.length === 1 ? studentIds[0] : null,
          branch_id: branchIds.length === 1 ? branchIds[0] : null,
          group_id: groupIds.length === 1 ? groupIds[0] : null,
          requested_by: profile.id,
          requested_by_name: profile.full_name || null,
          reason: `${month} dönemi geçmiş yoklama aktarımı · ${records.length} kayıt`,
          old_values: {},
          new_values: { month, mode, records },
          metadata: { source: "monthly_attendance_history", record_count: records.length },
          status: "pending",
        })
        .select("id")
        .single();

      if (error || !created) return NextResponse.json({ ok: false, error: `Onay talebi oluşturulamadı: ${error?.message || "Bilinmeyen hata"}` }, { status: 500 });

      await supabase.from("system_notifications").insert({
        organization_id: profile.organization_id,
        recipient_user_id: null,
        category: "approvals",
        event_key: "attendance_history_import_requested",
        notification_type: "approval_required",
        title: "Geçmiş yoklama yönetici onayı bekliyor",
        message: `${profile.full_name || "Personel"} tarafından ${month} için ${records.length} yoklama kaydı onaya gönderildi.`,
        body: `${month} için ${records.length} geçmiş yoklama kaydı onay bekliyor.`,
        severity: "warning",
        priority: "high",
        entity_type: "approval_request",
        entity_id: created.id,
        source_type: "approval_request",
        source_id: created.id,
        target_path: `/yoklama/aylik?month=${month}`,
        is_read: false,
        push_requested: false,
        metadata: { request_type: REQUEST_TYPE, request_id: created.id, month, record_count: records.length },
        created_by: profile.id,
      });

      revalidatePath("/yoklama/aylik");
      revalidatePath("/onay-merkezi");
      revalidatePath("/");

      return NextResponse.json({ ok: true, requestId: created.id, message: `${records.length} yoklama kaydı yönetici onayına gönderildi.` });
    }

    if (action === "approve" || action === "reject") {
      if (!MANAGER_ROLES.includes(profile.role || "")) {
        return NextResponse.json({ ok: false, error: "Bu işlem için yönetici yetkisi gerekiyor." }, { status: 403 });
      }

      const requestId = clean(body.requestId, 100);
      if (!requestId) return NextResponse.json({ ok: false, error: "Onay talebi bulunamadı." }, { status: 400 });

      const { data: approval, error: approvalError } = await supabase
        .from("approval_requests")
        .select("*")
        .eq("id", requestId)
        .eq("organization_id", profile.organization_id)
        .eq("request_type", REQUEST_TYPE)
        .maybeSingle();

      if (approvalError || !approval) return NextResponse.json({ ok: false, error: "Onay talebi bulunamadı." }, { status: 404 });
      if (approval.status !== "pending") return NextResponse.json({ ok: false, error: "Bu talep daha önce işlenmiş." }, { status: 409 });

      const decidedAt = new Date().toISOString();
      const reviewNote = clean(body.reviewNote, 1000) || null;

      if (action === "reject") {
        const { error } = await supabase
          .from("approval_requests")
          .update({ status: "rejected", reviewed_by: profile.id, reviewed_by_name: profile.full_name || "Yönetici", reviewed_at: decidedAt, review_note: reviewNote })
          .eq("id", requestId)
          .eq("status", "pending");
        if (error) return NextResponse.json({ ok: false, error: `Talep reddedilemedi: ${error.message}` }, { status: 500 });

        await supabase.from("approval_audit_logs").insert({
          organization_id: profile.organization_id,
          approval_request_id: requestId,
          module: "attendance",
          request_type: REQUEST_TYPE,
          entity_type: "attendance_batch",
          entity_id: approval.entity_id || null,
          student_id: approval.student_id || null,
          branch_id: approval.branch_id || null,
          group_id: approval.group_id || null,
          decision: "rejected",
          requested_by: approval.requested_by || null,
          requested_by_name: approval.requested_by_name || null,
          requested_at: approval.requested_at || approval.created_at || null,
          decided_by: profile.id,
          decided_by_name: profile.full_name || "Yönetici",
          decided_at: decidedAt,
          reason: approval.reason || null,
          review_note: reviewNote,
          old_values: approval.old_values || {},
          new_values: approval.new_values || {},
          snapshot: approval,
        });

        revalidatePath("/yoklama/aylik");
        revalidatePath("/onay-merkezi");
        revalidatePath("/");
        return NextResponse.json({ ok: true, message: "Geçmiş yoklama aktarımı reddedildi." });
      }

      const payload = approval.new_values && typeof approval.new_values === "object" ? approval.new_values : {};
      const month = clean((payload as any).month, 7);
      const records = await validateRecords(supabase, profile.organization_id, month, (payload as any).records);
      const now = new Date().toISOString();

      const rows = records.map((row) => ({
        organization_id: profile.organization_id,
        branch_id: row.branchId,
        student_id: row.studentId,
        enrollment_id: row.enrollmentId || null,
        group_id: row.groupId,
        schedule_id: row.scheduleId,
        coach_id: row.coachId,
        lesson_date: row.lessonDate,
        status: row.status,
        coach_note: "Geçmiş yoklama aktarımı · yönetici onaylı",
        recorded_by: approval.requested_by || profile.id,
        updated_by: profile.id,
        edited_at: now,
        updated_at: now,
      }));

      const { error: upsertError } = await supabase
        .from("attendance_records")
        .upsert(rows, { onConflict: "student_id,lesson_date,group_id,schedule_id" });

      if (upsertError) return NextResponse.json({ ok: false, error: `Yoklama kayıtları uygulanamadı: ${upsertError.message}` }, { status: 500 });

      await syncEnrollmentUsedLessons(supabase, profile.organization_id, records.map((row) => row.enrollmentId || null).filter(Boolean) as string[]);

      const { error: finishError } = await supabase
        .from("approval_requests")
        .update({ status: "approved", reviewed_by: profile.id, reviewed_by_name: profile.full_name || "Yönetici", reviewed_at: decidedAt, review_note: reviewNote, applied_at: decidedAt })
        .eq("id", requestId)
        .eq("status", "pending");

      if (finishError) return NextResponse.json({ ok: false, error: `Yoklama uygulandı ancak onay kaydı tamamlanamadı: ${finishError.message}` }, { status: 500 });

      await supabase.from("approval_audit_logs").insert({
        organization_id: profile.organization_id,
        approval_request_id: requestId,
        module: "attendance",
        request_type: REQUEST_TYPE,
        entity_type: "attendance_batch",
        entity_id: approval.entity_id || null,
        student_id: approval.student_id || null,
        branch_id: approval.branch_id || null,
        group_id: approval.group_id || null,
        decision: "approved",
        requested_by: approval.requested_by || null,
        requested_by_name: approval.requested_by_name || null,
        requested_at: approval.requested_at || approval.created_at || null,
        decided_by: profile.id,
        decided_by_name: profile.full_name || "Yönetici",
        decided_at: decidedAt,
        reason: approval.reason || null,
        review_note: reviewNote,
        old_values: approval.old_values || {},
        new_values: approval.new_values || {},
        snapshot: { ...approval, applied_at: decidedAt, record_count: rows.length },
      });

      const activityRows = unique(records.map((row) => row.studentId)).map((studentId) => ({
        organization_id: profile.organization_id,
        student_id: studentId,
        activity_type: "historical_attendance_import",
        title: "Geçmiş yoklama aktarıldı",
        description: `${month} dönemine ait geçmiş yoklama kayıtları yönetici onayı ile sisteme işlendi.`,
        old_value: {},
        new_value: { month, request_id: requestId },
        source_type: "approval_request",
        source_id: requestId,
        performed_by: approval.requested_by || profile.id,
        approved_by: profile.id,
        performed_at: decidedAt,
        approved_at: decidedAt,
      }));
      if (activityRows.length) await supabase.from("student_activity_logs").insert(activityRows);

      await supabase.from("system_notifications").insert({
        organization_id: profile.organization_id,
        recipient_user_id: approval.requested_by || null,
        recipient_profile_id: approval.requested_by || null,
        category: "approvals",
        event_key: "attendance_history_import_approved",
        notification_type: "approval_approved",
        title: "Geçmiş yoklama aktarımı onaylandı",
        message: `${month} için ${rows.length} yoklama kaydı ${profile.full_name || "Yönetici"} tarafından onaylandı ve sisteme işlendi.`,
        body: `${rows.length} geçmiş yoklama kaydı onaylandı ve uygulandı.`,
        severity: "success",
        priority: "normal",
        entity_type: "approval_request",
        entity_id: requestId,
        source_type: "approval_request",
        source_id: requestId,
        target_path: `/yoklama/aylik?month=${month}`,
        is_read: false,
        push_requested: false,
        metadata: { request_type: REQUEST_TYPE, request_id: requestId, month, record_count: rows.length },
        created_by: profile.id,
      });

      revalidatePath("/yoklama");
      revalidatePath("/yoklama/aylik");
      revalidatePath("/yoklama/gecmis");
      revalidatePath("/ogrenciler");
      revalidatePath("/odemeler");
      revalidatePath("/onay-merkezi");
      revalidatePath("/");
      for (const studentId of unique(records.map((row) => row.studentId))) revalidatePath(`/ogrenciler/${studentId}`);

      return NextResponse.json({ ok: true, count: rows.length, message: `${rows.length} geçmiş yoklama kaydı onaylandı ve sisteme işlendi.` });
    }

    return NextResponse.json({ ok: false, error: "Geçersiz işlem." }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "İşlem tamamlanamadı." }, { status: 500 });
  }
}
