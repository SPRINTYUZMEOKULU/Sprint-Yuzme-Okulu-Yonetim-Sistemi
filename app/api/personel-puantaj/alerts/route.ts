import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createNotification } from "@/lib/notifications/create-notification";

export const dynamic = "force-dynamic";

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase sunucu değişkenleri eksik.");
  return createAdminClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
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
  const weekdayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    dateKey: `${get("year")}-${get("month")}-${get("day")}`,
    weekday: weekdayMap[get("weekday")] ?? date.getDay(),
  };
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

async function eventExists(admin: ReturnType<typeof adminClient>, organizationId: string, eventKey: string) {
  const { data } = await admin
    .from("system_notifications")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("event_key", eventKey)
    .limit(1);
  return Boolean(data?.length);
}

export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });

    const admin = adminClient();
    const { data: profile } = await admin
      .from("profiles")
      .select("id, role, organization_id")
      .eq("id", user.id)
      .maybeSingle();
    if (!profile?.organization_id) return NextResponse.json({ error: "Profil bulunamadı." }, { status: 403 });

    const organizationId = String(profile.organization_id);
    const { data: staff } = await admin
      .from("staff")
      .select("id, first_name, last_name, auth_user_id, is_active, login_enabled")
      .eq("organization_id", organizationId)
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (!staff?.id || !staff.is_active || !staff.login_enabled) {
      return NextResponse.json({ ok: true, reminders: 0, managerAlerts: 0 });
    }

    const { dateKey, weekday } = localDateParts();
    const nowMinutes = istanbulMinutesNow();

    const [{ data: schedules }, { data: assignments }, { data: checkins }, { data: branches }, { data: groups }, { data: managers }] = await Promise.all([
      admin.from("lesson_schedules").select("id, branch_id, group_id, coach_id, start_time, end_time").eq("organization_id", organizationId).eq("weekday", weekday).eq("is_active", true),
      admin.from("lesson_staff_assignments").select("schedule_id, coach_id").eq("organization_id", organizationId).eq("coach_id", staff.id).eq("is_active", true),
      admin.from("staff_checkins").select("schedule_id").eq("organization_id", organizationId).eq("staff_id", staff.id).eq("lesson_date", dateKey),
      admin.from("branches").select("id, name, short_name").eq("organization_id", organizationId),
      admin.from("training_groups").select("id, name").eq("organization_id", organizationId),
      admin.from("profiles").select("id, role").eq("organization_id", organizationId).eq("is_active", true).in("role", ["owner", "admin", "branch_manager"]),
    ]);

    const assignedIds = new Set((assignments || []).map((row) => String(row.schedule_id)));
    const checkedIds = new Set((checkins || []).map((row) => String(row.schedule_id)));
    const branchMap = new Map((branches || []).map((row) => [String(row.id), row]));
    const groupMap = new Map((groups || []).map((row) => [String(row.id), row]));
    const managerIds = (managers || []).map((row) => String(row.id));
    const staffName = `${staff.first_name || ""} ${staff.last_name || ""}`.trim() || "Eğitmen";

    let reminders = 0;
    let managerAlerts = 0;

    for (const schedule of schedules || []) {
      const isAssigned = String(schedule.coach_id || "") === String(staff.id) || assignedIds.has(String(schedule.id));
      if (!isAssigned || checkedIds.has(String(schedule.id))) continue;

      const start = minutes(String(schedule.start_time));
      const diff = start - nowMinutes;
      const branch = branchMap.get(String(schedule.branch_id));
      const group = groupMap.get(String(schedule.group_id));
      const branchName = branch?.short_name || branch?.name || "Şube";
      const groupName = group?.name || "Grup";
      const startText = String(schedule.start_time || "").slice(0, 5);

      if (diff <= 30 && diff > 0) {
        const eventKey = `staff_session_30m:${dateKey}:${schedule.id}:${staff.id}`;
        if (!(await eventExists(admin, organizationId, eventKey))) {
          await createNotification({
            organizationId,
            title: "Dersiniz yaklaşıyor",
            body: `${branchName} · ${groupName} · ${startText} seansınıza ${diff} dakika kaldı. Henüz “Derse Geldim” girişi yapmadınız. Ders saatinde giriş olmazsa yönetici bilgilendirilecektir.`,
            category: "staff",
            eventKey,
            notificationType: "staff_session_30m",
            severity: "warning",
            priority: "high",
            sourceType: "lesson_schedule",
            sourceId: String(schedule.id),
            entityType: "staff",
            entityId: String(staff.id),
            targetPath: "/personel-puantaj",
            recipientProfileIds: [String(user.id)],
            metadata: { scheduleId: schedule.id, branchId: schedule.branch_id, groupId: schedule.group_id, lessonDate: dateKey, startTime: startText },
            createdBy: user.id,
            push: true,
          });
          reminders += 1;
        }
      }

      if (diff <= 0 && diff >= -120 && managerIds.length) {
        const eventKey = `staff_session_missing:${dateKey}:${schedule.id}:${staff.id}`;
        if (!(await eventExists(admin, organizationId, eventKey))) {
          await createNotification({
            organizationId,
            title: "Personel seans girişi yapılmadı",
            body: `${staffName} · ${branchName} · ${groupName} · ${startText} seansı başladı ancak “Derse Geldim” girişi henüz yapılmadı.`,
            category: "staff",
            eventKey,
            notificationType: "staff_session_missing",
            severity: "warning",
            priority: "high",
            sourceType: "lesson_schedule",
            sourceId: String(schedule.id),
            entityType: "staff",
            entityId: String(staff.id),
            targetPath: "/personel-puantaj",
            recipientProfileIds: managerIds,
            metadata: { staffId: staff.id, scheduleId: schedule.id, branchId: schedule.branch_id, groupId: schedule.group_id, lessonDate: dateKey, startTime: startText },
            createdBy: user.id,
            push: true,
          });
          managerAlerts += 1;
        }
      }
    }

    return NextResponse.json({ ok: true, reminders, managerAlerts });
  } catch (error) {
    console.error("Personel seans uyarısı hatası:", error);
    return NextResponse.json({ error: "Personel seans uyarıları güncellenemedi." }, { status: 500 });
  }
}
