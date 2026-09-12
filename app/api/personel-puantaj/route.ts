import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

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
    .select("id, role, organization_id, full_name")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.organization_id) return null;

  const { data: staff } = await admin
    .from("staff")
    .select("id, first_name, last_name, title, staff_type, is_active, login_enabled, pay_type, per_lesson_rate, hourly_rate, monthly_salary, payroll_active")
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

function localDateParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value || "";
  const dateKey = `${get("year")}-${get("month")}-${get("day")}`;
  const weekdayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return { dateKey, weekday: weekdayMap[get("weekday")] ?? date.getDay() };
}

function minutes(time: string | null | undefined) {
  if (!time) return 0;
  const [h, m] = String(time).slice(0, 5).split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function istanbulMinutesNow() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Istanbul",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const h = Number(parts.find((p) => p.type === "hour")?.value || 0);
  const m = Number(parts.find((p) => p.type === "minute")?.value || 0);
  return h * 60 + m;
}

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const toRad = (value: number) => value * Math.PI / 180;
  const earth = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return earth * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

async function getDashboard(ctx: NonNullable<Awaited<ReturnType<typeof getContext>>>) {
  const { admin, organizationId, role, staff: currentStaff } = ctx;
  const manager = managementRoles.includes(role);
  const { dateKey, weekday } = localDateParts();
  const monthStart = `${dateKey.slice(0, 7)}-01`;

  const [{ data: staffRows }, { data: branches }, { data: groups }, { data: schedules }, { data: assignments }, { data: todayCheckins }, { data: monthCheckins }] = await Promise.all([
    admin.from("staff").select("id, first_name, last_name, title, staff_type, auth_user_id, is_active, pay_type, per_lesson_rate, hourly_rate, monthly_salary, payroll_active").eq("organization_id", organizationId).eq("is_active", true),
    admin.from("branches").select("id, name, short_name, latitude, longitude, checkin_radius_m").eq("organization_id", organizationId).eq("is_active", true),
    admin.from("training_groups").select("id, name, branch_id, primary_coach_id").eq("organization_id", organizationId).eq("is_active", true),
    admin.from("lesson_schedules").select("id, branch_id, group_id, coach_id, weekday, start_time, end_time, is_active").eq("organization_id", organizationId).eq("weekday", weekday).eq("is_active", true),
    admin.from("lesson_staff_assignments").select("schedule_id, coach_id, assignment_role, is_active").eq("organization_id", organizationId).eq("is_active", true),
    admin.from("staff_checkins").select("id, staff_id, branch_id, schedule_id, group_id, lesson_date, checked_in_at, distance_m, location_verified, attendance_status, approval_status, manager_note").eq("organization_id", organizationId).eq("lesson_date", dateKey),
    admin.from("staff_checkins").select("staff_id, planned_start, planned_end, approval_status").eq("organization_id", organizationId).gte("lesson_date", monthStart).lte("lesson_date", dateKey),
  ]);

  const branchMap = new Map((branches || []).map((b) => [String(b.id), b]));
  const groupMap = new Map((groups || []).map((g) => [String(g.id), g]));
  const staffMap = new Map((staffRows || []).map((s) => [String(s.id), s]));
  const checkinMap = new Map((todayCheckins || []).map((c) => [`${c.staff_id}:${c.schedule_id}`, c]));
  const assignmentMap = new Map<string, string[]>();
  for (const row of assignments || []) {
    const key = String(row.schedule_id);
    const current = assignmentMap.get(key) || [];
    current.push(String(row.coach_id));
    assignmentMap.set(key, current);
  }

  const rows: Array<Record<string, unknown>> = [];
  for (const schedule of schedules || []) {
    const coachIds = new Set<string>();
    if (schedule.coach_id) coachIds.add(String(schedule.coach_id));
    for (const coachId of assignmentMap.get(String(schedule.id)) || []) coachIds.add(coachId);
    if (!coachIds.size) continue;

    for (const coachId of coachIds) {
      if (!manager && currentStaff?.id !== coachId) continue;
      const person = staffMap.get(coachId);
      if (!person) continue;
      const branch = branchMap.get(String(schedule.branch_id));
      const group = groupMap.get(String(schedule.group_id));
      const checkin = checkinMap.get(`${coachId}:${schedule.id}`);
      rows.push({
        scheduleId: schedule.id,
        staffId: coachId,
        staffName: `${person.first_name || ""} ${person.last_name || ""}`.trim(),
        title: person.title || "Eğitmen",
        branchId: schedule.branch_id,
        branchName: branch?.short_name || branch?.name || "Şube",
        branchLocationConfigured: Number.isFinite(Number(branch?.latitude)) && Number.isFinite(Number(branch?.longitude)),
        groupId: schedule.group_id,
        groupName: group?.name || "Grup",
        startTime: String(schedule.start_time || "").slice(0, 5),
        endTime: String(schedule.end_time || "").slice(0, 5),
        checkin: checkin || null,
        isMine: currentStaff?.id === coachId,
      });
    }
  }

  rows.sort((a, b) => String(a.startTime).localeCompare(String(b.startTime)) || String(a.staffName).localeCompare(String(b.staffName), "tr"));

  const approved = (monthCheckins || []).filter((c) => ["auto_approved", "approved"].includes(String(c.approval_status)));
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
      return {
        staffId: person.id,
        staffName: `${person.first_name || ""} ${person.last_name || ""}`.trim(),
        payType: type,
        lessonCount,
        totalMinutes,
        estimatedAmount: Math.round(amount * 100) / 100,
      };
    });

  return {
    role,
    isManager: manager,
    currentStaffId: currentStaff?.id || null,
    date: dateKey,
    today: rows,
    payroll,
    summary: {
      planned: rows.length,
      checkedIn: rows.filter((r) => r.checkin).length,
      pending: rows.filter((r: any) => r.checkin?.approval_status === "pending").length,
      missing: rows.filter((r) => !r.checkin && istanbulMinutesNow() > minutes(String(r.startTime)) + 10).length,
    },
  };
}

export async function GET() {
  try {
    const ctx = await getContext();
    if (!ctx || ctx.role === "guardian" || ctx.role === "pending") return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
    return NextResponse.json(await getDashboard(ctx));
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
        manager_note: body?.note ? String(body.note) : null,
        updated_at: new Date().toISOString(),
      }).eq("id", checkinId).eq("organization_id", ctx.organizationId);
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    if (!ctx.staff?.id || !ctx.staff.is_active || !ctx.staff.login_enabled) return NextResponse.json({ error: "Aktif personel hesabı bulunamadı." }, { status: 403 });

    const scheduleId = String(body?.scheduleId || "");
    const latitude = Number(body?.latitude);
    const longitude = Number(body?.longitude);
    const accuracy = Number(body?.accuracy);
    if (!scheduleId || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return NextResponse.json({ error: "Konum bilgisi alınamadı." }, { status: 400 });

    const { dateKey, weekday } = localDateParts();
    const { data: schedule } = await ctx.admin.from("lesson_schedules").select("id, organization_id, branch_id, group_id, coach_id, weekday, start_time, end_time, is_active").eq("id", scheduleId).eq("organization_id", ctx.organizationId).eq("is_active", true).maybeSingle();
    if (!schedule || Number(schedule.weekday) !== weekday) return NextResponse.json({ error: "Bu ders bugün için aktif değil." }, { status: 400 });

    let assigned = String(schedule.coach_id || "") === String(ctx.staff.id);
    if (!assigned) {
      const { data: assignment } = await ctx.admin.from("lesson_staff_assignments").select("id").eq("schedule_id", scheduleId).eq("coach_id", ctx.staff.id).eq("is_active", true).maybeSingle();
      assigned = Boolean(assignment);
    }
    if (!assigned) return NextResponse.json({ error: "Bu ders size atanmış değil." }, { status: 403 });

    const { data: branch } = await ctx.admin.from("branches").select("id, latitude, longitude, checkin_radius_m").eq("id", schedule.branch_id).maybeSingle();
    const configured = Number.isFinite(Number(branch?.latitude)) && Number.isFinite(Number(branch?.longitude));
    const distance = configured ? haversineMeters(latitude, longitude, Number(branch?.latitude), Number(branch?.longitude)) : null;
    const radius = Number(branch?.checkin_radius_m || 250);
    const locationVerified = configured && distance !== null && distance <= radius + Math.max(0, Number.isFinite(accuracy) ? accuracy : 0);
    const nowMinutes = istanbulMinutesNow();
    const startMinutes = minutes(String(schedule.start_time));
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
      accuracy_m: Number.isFinite(accuracy) ? accuracy : null,
      distance_m: distance === null ? null : Math.round(distance * 10) / 10,
      location_verified: locationVerified,
      attendance_status: attendanceStatus,
      approval_status: approvalStatus,
      source: "mobile",
      created_by: ctx.user.id,
      updated_at: new Date().toISOString(),
    };

    const { data: saved, error } = await ctx.admin.from("staff_checkins").upsert(payload, { onConflict: "staff_id,schedule_id,lesson_date" }).select("id, attendance_status, approval_status, location_verified, distance_m, checked_in_at").single();
    if (error) throw error;
    return NextResponse.json({ ok: true, checkin: saved });
  } catch (error) {
    console.error("Personel puantaj POST hatası:", error);
    return NextResponse.json({ error: "İşlem tamamlanamadı." }, { status: 500 });
  }
}
