import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { branchHasCoordinates, isLessonDate, loadPersonnelSessions, sessionClock, sessionMinutes as minutes } from "@/lib/personnel/sessions";

import { loadAttendanceEligibility, missingAttendanceStudents } from "@/lib/notifications/attendance-eligibility";

export const dynamic = "force-dynamic";

type Role = "owner" | "admin" | "branch_manager" | "registration_staff" | "accounting" | "coach" | "guardian" | "pending";

const managementRoles: Role[] = ["owner", "admin", "branch_manager"];

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase sunucu değişkenleri eksik.");
  return createAdminClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function getContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = adminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("id, role, organization_id, is_active")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.organization_id || !profile.is_active) return null;

  const { data: staff } = await admin
    .from("staff")
    .select("id, first_name, last_name, title, staff_type, is_active, login_enabled, pay_type, per_lesson_rate, hourly_rate, monthly_salary, payroll_active")
    .eq("organization_id", profile.organization_id)
    .eq("auth_user_id", user.id)
    .maybeSingle();

  return {
    user,
    role: String(profile.role) as Role,
    organizationId: String(profile.organization_id),
    staff,
    admin,
  };
}

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const toRad = (value: number) => value * Math.PI / 180;
  const earth = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return earth * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

async function getDashboard(ctx: NonNullable<Awaited<ReturnType<typeof getContext>>>, selectedDate: string | null, previewStaffId?: string) {
  const { admin, organizationId, role, staff: viewerStaff } = ctx;
  const manager = managementRoles.includes(role);
  const { date: today, minute: now } = sessionClock();
  const dateKey = selectedDate && isLessonDate(selectedDate) ? selectedDate : today;
  const monthStart = `${dateKey.slice(0, 7)}-01`;
  const monthEnd = new Date(`${monthStart}T12:00:00Z`);
  monthEnd.setUTCMonth(monthEnd.getUTCMonth() + 1);
  const nextMonth = monthEnd.toISOString().slice(0, 10);

  const [sessions, staffResult, todayResult, monthResult, periodResult] = await Promise.all([
    loadPersonnelSessions(admin, organizationId, dateKey),
    admin.from("staff").select("id, first_name, last_name, title, auth_user_id, login_enabled, pay_type, per_lesson_rate, hourly_rate, monthly_salary, payroll_active").eq("organization_id", organizationId).eq("is_active", true),
    admin.from("staff_checkins").select("id, staff_id, schedule_id, checked_in_at, distance_m, location_verified, attendance_status, approval_status, manager_note, completed_at").eq("organization_id", organizationId).eq("lesson_date", dateKey),
    admin.from("staff_checkins").select("id, staff_id, planned_start, planned_end, lesson_date, training_groups(name), branches(name)").eq("organization_id", organizationId).gte("lesson_date", monthStart).lt("lesson_date", nextMonth).not("completed_at", "is", null).in("approval_status", ["auto_approved", "approved"]),
    admin.from("staff_payroll_periods").select("staff_id, status, approved_lesson_count, approved_minutes, total_amount, paid_amount").eq("organization_id", organizationId).eq("period_month", monthStart),
  ]);
  const error = staffResult.error || todayResult.error || monthResult.error || periodResult.error;
  if (error) throw error;
  const allStaff = staffResult.data || [];
  const currentStaff = previewStaffId ? allStaff.find((person) => person.id === previewStaffId) : viewerStaff;
  const staffRows = previewStaffId ? allStaff.filter((person) => person.id === previewStaffId) : allStaff;
  const staffIdentityMap = new Map<string, (typeof staffRows)[number]>();
  for (const person of staffRows) {
    staffIdentityMap.set(person.id, person);
    if (person.auth_user_id) staffIdentityMap.set(person.auth_user_id, person);
  }
  const checkinMap = new Map((todayResult.data || []).map((row) => [`${row.staff_id}:${row.schedule_id}`, row]));
  const periodMap = new Map((periodResult.data || []).map((row) => [row.staff_id, row]));

  const rows: Array<Record<string, unknown>> = [];
  for (const schedule of sessions) {
    const resolvedStaffIds = new Set<string>();
    for (const [rawCoachId, assignmentRole] of schedule.coaches) {
      const person = staffIdentityMap.get(rawCoachId);
      if (!person) continue;
      const staffId = String(person.id);
      if (resolvedStaffIds.has(staffId)) continue;
      resolvedStaffIds.add(staffId);
      if (!manager && String(currentStaff?.id || "") !== staffId) continue;

      const { branch, group } = schedule;
      const checkin = checkinMap.get(`${staffId}:${schedule.id}`);
      rows.push({
        scheduleId: schedule.id,
        staffId,
        staffName: `${person.first_name || ""} ${person.last_name || ""}`.trim(),
        title: person.title || "Eğitmen",
        assignmentRole: assignmentRole === "backup" ? "backup" : "coach",
        branchId: schedule.branch_id,
        branchName: branch?.short_name || branch?.name || "Şube",
        branchLocationConfigured: branchHasCoordinates(branch),
        groupId: schedule.group_id,
        groupName: group?.name || "Grup",
        startTime: String(schedule.start_time || "").slice(0, 5),
        endTime: String(schedule.end_time || "").slice(0, 5),
        checkin: checkin || null,
        isMine: !previewStaffId && String(currentStaff?.id || "") === staffId,
      });
    }
  }

  // Use the same roster and saved records as the lesson completion check.
  if ((previewStaffId || role === "coach") && dateKey <= today && rows.length) {
    try {
      const [eligibility, attendance] = await Promise.all([
        loadAttendanceEligibility(admin, organizationId),
        admin.from("attendance_records").select("student_id, schedule_id, group_id, lesson_date")
          .eq("organization_id", organizationId).eq("lesson_date", dateKey)
          .in("schedule_id", [...new Set(rows.map((row) => String(row.scheduleId)))]),
      ]);
      if (attendance.error) throw attendance.error;
      const sessionsById = new Map(sessions.map((session) => [session.id, session]));
      const recordsBySession = new Map<string, typeof attendance.data>();
      for (const record of attendance.data || []) {
        const records = recordsBySession.get(record.schedule_id) || [];
        records.push(record);
        recordsBySession.set(record.schedule_id, records);
      }
      for (const row of rows) {
        const session = sessionsById.get(row.scheduleId);
        if (!session) continue;
        const records = recordsBySession.get(session.id) || [];
        const roster = session.makeup_date ? { ...eligibility, memberships: [] } : eligibility;
        const missing = missingAttendanceStudents(roster, session, dateKey, records).length;
        row.attendanceState = missing ? (records.length ? "partial" : "pending") : records.length ? "saved" : "empty";
      }
    } catch {
      // A roster lookup failure should not prevent check-in or access to the schedule.
      for (const row of rows) row.attendanceState = "unavailable";
    }
  }

  rows.sort((a, b) => String(a.startTime).localeCompare(String(b.startTime)) || String(a.staffName).localeCompare(String(b.staffName), "tr"));

  const unassigned = manager && !previewStaffId ? sessions.filter((session) =>
    ![...session.coaches].some(([id, role]) => {
      const person = staffIdentityMap.get(id);
      return role === "coach" && person?.auth_user_id && person.login_enabled;
    })
  ).map((session) => ({
    id: session.id, branchId: session.branch_id, groupName: session.group.name,
    branchName: session.branch.short_name || session.branch.name, startTime: session.start_time.slice(0, 5),
  })) : [];

  const approved = monthResult.data || [];
  const payroll = (staffRows || [])
    .filter((s) => manager || s.id === currentStaff?.id)
    .map((person) => {
      const mine = approved.filter((c) => c.staff_id === person.id);
      const lessonCount = mine.length;
      const totalMinutes = mine.reduce((sum, c) => sum + Math.max(0, minutes(c.planned_end) - minutes(c.planned_start)), 0);
      const perLesson = Number(person.per_lesson_rate || 0);
      const hourly = Number(person.hourly_rate || 0);
      const salary = Number(person.monthly_salary || 0);
      const type = String(person.pay_type || "per_lesson");
      let amount = 0;
      if (type === "per_lesson") amount = lessonCount * perLesson;
      if (type === "hourly") amount = (totalMinutes / 60) * hourly;
      if (type === "monthly") amount = salary;
      if (type === "monthly_plus_lesson") amount = salary + lessonCount * perLesson;
      const period = periodMap.get(person.id);
      const closed = period && ["awaiting_payment", "paid", "archived"].includes(period.status);
      return {
        staffId: person.id,
        staffName: `${person.first_name || ""} ${person.last_name || ""}`.trim(),
        payType: type,
        lessonCount: closed ? period.approved_lesson_count : lessonCount,
        totalMinutes: closed ? period.approved_minutes : totalMinutes,
        estimatedAmount: closed ? Number(period.total_amount) : Math.round(amount * 100) / 100,
        paidAmount: Number(period?.paid_amount || 0),
        paymentStatus: period?.status || null,
      };
    });

  return {
    role,
    isManager: manager,
    currentStaffId: currentStaff?.id || null,
    date: dateKey,
    currentDate: today,
    today: rows,
    unassigned,
    payroll,
    lessons: approved.filter((row) => row.staff_id === currentStaff?.id).map((row) => {
      const duration = Math.max(0, minutes(row.planned_end) - minutes(row.planned_start));
      const payType = currentStaff?.pay_type || "per_lesson";
      const amount = payType === "hourly" ? duration / 60 * Number(currentStaff?.hourly_rate || 0)
        : payType === "monthly" ? null : Number(currentStaff?.per_lesson_rate || 0);

      return { ...row, duration, amount: amount === null ? null : Math.round(amount * 100) / 100 };
    }),
    summary: {
      planned: rows.length,
      checkedIn: rows.filter((r) => r.checkin).length,
      pending: rows.filter((r: any) => r.checkin?.approval_status === "pending").length,
      missing: rows.filter((r) => !r.checkin && (dateKey < today || (dateKey === today && now > minutes(String(r.startTime)) + 10))).length,
    },
  };
}

export async function GET(request: NextRequest) {
  try {
    const ctx = await getContext();
    if (!ctx || ctx.role === "guardian" || ctx.role === "pending") return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
    const previewStaffId = request.nextUrl.searchParams.get("personel");
    if (previewStaffId && !["owner", "admin"].includes(ctx.role)) {
      return NextResponse.json({ error: "Personel görünümü için yönetici yetkisi gerekiyor." }, { status: 403 });
    }
    return NextResponse.json(await getDashboard(ctx, request.nextUrl.searchParams.get("date"), previewStaffId || undefined));
  } catch (error) {
    console.error("Personel puantaj GET hatası:", error);
    return NextResponse.json({ error: "Personel puantaj verileri alınamadı." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await getContext();
    if (!ctx || ctx.role === "guardian" || ctx.role === "pending") return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
    const body = await request.json();
    const action = String(body?.action || "checkin");

    if (action === "approve") {
      if (!managementRoles.includes(ctx.role)) return NextResponse.json({ error: "Bu işlem için yönetici yetkisi gerekiyor." }, { status: 403 });
      const checkinId = String(body?.checkinId || "");
      if (!checkinId) return NextResponse.json({ error: "Giriş kaydı bulunamadı." }, { status: 400 });
      const { error } = await ctx.admin.from("staff_checkins").update({
        approval_status: "approved",
        approved_by: ctx.user.id,
        approved_at: new Date().toISOString(),
        manager_note: typeof body?.note === "string" ? body.note.trim().slice(0, 500) || null : null,
        updated_at: new Date().toISOString(),
      }).eq("id", checkinId).eq("organization_id", ctx.organizationId).eq("approval_status", "pending");
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    if (!ctx.staff?.id || !ctx.staff.is_active || !ctx.staff.login_enabled) return NextResponse.json({ error: "Aktif personel hesabı bulunamadı." }, { status: 403 });

    const scheduleId = String(body?.scheduleId || "");
    const { date: today, minute: nowMinutes } = sessionClock();
    const dateKey = action === "complete" && typeof body.lessonDate === "string" ? body.lessonDate : today;
    if (!isLessonDate(dateKey) || dateKey > today) {
      return NextResponse.json({ error: "Geçerli bir ders tarihi seçin." }, { status: 400 });
    }
    const schedule = (await loadPersonnelSessions(ctx.admin, ctx.organizationId, dateKey)).find((row) => row.id === scheduleId);
    if (!schedule) return NextResponse.json({ error: "Bu ders bugün için aktif değil." }, { status: 400 });
    if (!schedule.coaches.has(ctx.staff.id) && !schedule.coaches.has(ctx.user.id)) {
      return NextResponse.json({ error: "Bu ders size atanmış değil." }, { status: 403 });
    }

    const startMinutes = minutes(schedule.start_time);
    const endMinutes = minutes(schedule.end_time);

    if (action === "complete") {
      if (dateKey === today && nowMinutes < endMinutes) return NextResponse.json({ error: "Dersi, seans bitiş saatinden sonra tamamlayabilirsiniz." }, { status: 400 });
      const [eligibility, attendance] = await Promise.all([
        loadAttendanceEligibility(ctx.admin, ctx.organizationId),
        ctx.admin.from("attendance_records").select("student_id, schedule_id, group_id, lesson_date")
          .eq("organization_id", ctx.organizationId).eq("schedule_id", scheduleId).eq("lesson_date", dateKey),
      ]);
      if (attendance.error) throw attendance.error;
      const rosterContext = schedule.makeup_date ? { ...eligibility, memberships: [] } : eligibility;
      if (missingAttendanceStudents(rosterContext, schedule, dateKey, attendance.data || []).length) {
        return NextResponse.json({ error: "Dersi tamamlamak için seansın öğrenci yoklamasını kaydedin." }, { status: 409 });
      }
      const { data: result, error } = await ctx.admin.rpc("complete_staff_lesson", {
        p_organization_id: ctx.organizationId,
        p_staff_id: ctx.staff.id,
        p_schedule_id: scheduleId,
        p_lesson_date: dateKey,
      });
      if (error) throw error;
      if (result === "attendance_missing") return NextResponse.json({ error: "Önce seansın öğrenci yoklamasını kaydedin." }, { status: 409 });
      if (result === "period_closed") return NextResponse.json({ error: "Bu ödeme dönemi kapatılmış. Yönetimle iletişime geçin." }, { status: 409 });
      if (result !== "completed") return NextResponse.json({ error: "Önce Derse Geldim girişinizi kaydedin." }, { status: 409 });
      return NextResponse.json({ ok: true });
    }

    if (action !== "checkin") return NextResponse.json({ error: "Geçersiz işlem." }, { status: 400 });
    if (nowMinutes < startMinutes - 30 || nowMinutes >= endMinutes) {
      return NextResponse.json({ error: "Derse Geldim girişi seans başlangıcından 30 dakika önce açılır ve seans bitiminde kapanır." }, { status: 400 });
    }

    const { latitude, longitude, accuracy } = body;
    if (!Number.isFinite(latitude) || Math.abs(latitude) > 90 || !Number.isFinite(longitude) || Math.abs(longitude) > 180) {
      return NextResponse.json({ error: "Geçerli bir konum alınamadı." }, { status: 400 });
    }
    const { branch } = schedule;
    const configured = branchHasCoordinates(branch);
    const distance = configured ? haversineMeters(latitude, longitude, Number(branch.latitude), Number(branch.longitude)) : null;
    const radius = Number(branch.checkin_radius_m || 250);
    const locationVerified = distance !== null && distance <= radius && Number.isFinite(accuracy) && accuracy >= 0 && accuracy <= radius;
    const attendanceStatus = !configured ? "location_unconfigured" : !locationVerified ? "outside_geofence" : nowMinutes > startMinutes + 10 ? "late" : "on_time";
    const approvalStatus = locationVerified ? "auto_approved" : "pending";

    const payload = {
      organization_id: ctx.organizationId,
      staff_id: ctx.staff.id,
      branch_id: schedule.branch_id,
      schedule_id: schedule.id,
      group_id: schedule.group_id,
      lesson_date: dateKey,
      planned_start: schedule.start_time,
      planned_end: schedule.end_time,
      checked_in_at: new Date().toISOString(),
      latitude,
      longitude,
      accuracy_m: Number.isFinite(accuracy) && accuracy >= 0 ? accuracy : null,
      distance_m: distance === null ? null : Math.round(distance * 10) / 10,
      location_verified: locationVerified,
      attendance_status: attendanceStatus,
      approval_status: approvalStatus,
      source: "mobile",
      created_by: ctx.user.id,
      updated_at: new Date().toISOString(),
    };

    const fields = "id, attendance_status, approval_status, location_verified, distance_m, checked_in_at";
    const { data: inserted, error } = await ctx.admin.from("staff_checkins")
      .upsert(payload, { onConflict: "staff_id,schedule_id,lesson_date", ignoreDuplicates: true })
      .select(fields).maybeSingle();
    if (error) throw error;
    if (inserted) return NextResponse.json({ ok: true, checkin: inserted });
    const { data: existing, error: lookupError } = await ctx.admin.from("staff_checkins").select(fields)
      .eq("organization_id", ctx.organizationId).eq("staff_id", ctx.staff.id).eq("schedule_id", scheduleId).eq("lesson_date", dateKey).single();
    if (lookupError) throw lookupError;
    return NextResponse.json({ ok: true, checkin: existing });
  } catch (error) {
    console.error("Personel puantaj POST hatası:", error);
    return NextResponse.json({ error: "İşlem tamamlanamadı." }, { status: 500 });
  }
}
