import type { SupabaseClient } from "@supabase/supabase-js";
import { createNotification } from "@/lib/notifications/create-notification";
import { loadPersonnelSessions, sessionMinutes } from "@/lib/personnel/sessions";

export async function runPersonnelBackground(
  client: SupabaseClient,
  organizationId: string,
  date: string,
  currentMinute: number,
  notify: typeof createNotification = createNotification,
) {
  const [sessions, staffResult, profileResult, checkinResult] = await Promise.all([
    loadPersonnelSessions(client, organizationId, date),
    client.from("staff").select("id, auth_user_id, first_name, last_name").eq("organization_id", organizationId).eq("is_active", true).eq("login_enabled", true),
    client.from("profiles").select("id, role").eq("organization_id", organizationId).eq("is_active", true),
    client.from("staff_checkins").select("staff_id, schedule_id").eq("organization_id", organizationId).eq("lesson_date", date),
  ]);
  const error = staffResult.error || profileResult.error || checkinResult.error;
  if (error) throw error;
  const profiles = profileResult.data || [];
  const activeProfiles = new Set(profiles.map((profile) => profile.id));
  const managerIds = profiles.filter((profile) => ["owner", "admin"].includes(profile.role)).map((profile) => profile.id);
  const checkins = new Set((checkinResult.data || []).map((row) => `${row.staff_id}:${row.schedule_id}`));
  const totals = { created: 0, resolved: 0, pushSent: 0, pushFailed: 0 };

  for (const session of sessions) {
    const diff = sessionMinutes(session.start_time) - currentMinute;
    if (diff > 30 || currentMinute >= sessionMinutes(session.end_time)) continue;
    const isReminder = diff > 0;
    const time = session.start_time.slice(0, 5);
    const lesson = `${session.branch.short_name || session.branch.name} · ${session.group.name} · ${time}–${session.end_time.slice(0, 5)}`;

    for (const staff of staffResult.data || []) {
      if (!session.coaches.has(staff.id) && !session.coaches.has(staff.auth_user_id)) continue;
      if (!staff.auth_user_id || !activeProfiles.has(staff.auth_user_id) || checkins.has(`${staff.id}:${session.id}`)) continue;
      const recipients = isReminder ? [staff.auth_user_id] : managerIds;
      if (!recipients.length) continue;
      const type = isReminder ? "staff_session_30m" : "staff_session_missing";
      const eventKey = `${type}:${date}:${session.id}:${staff.id}`;
      const existing = await client.from("system_notifications").select("id").eq("organization_id", organizationId).eq("event_key", eventKey).limit(1);
      if (existing.error) throw existing.error;
      if (existing.data?.length) continue;

      const result = await notify({
        organizationId,
        title: isReminder ? "Dersiniz yaklaşıyor" : "Personel seans girişi yapılmadı",
        body: isReminder
          ? `${lesson} · ${diff} dakika kaldı. Tesise ulaştığınızda “Derse Geldim” seçeneğini kullanın.`
          : `${staff.first_name} ${staff.last_name} · ${lesson} seansı başladı. Eğitmen girişi bekleniyor.`,
        category: isReminder ? "schedule" : "staff",
        eventKey,
        dedupeKey: eventKey,
        notificationType: type,
        severity: "warning",
        priority: "high",
        sourceType: "lesson_schedule",
        sourceId: session.id,
        entityType: "staff",
        entityId: staff.id,
        targetPath: "/personel-puantaj",
        recipientProfileIds: recipients,
        metadata: { lessonDate: date, assignedProfileId: staff.auth_user_id, scheduleId: session.id, branchId: session.branch_id, staffId: staff.id },
        push: true,
      });
      // No eligible recipients is expected when notification preferences disable this category.
      if (!result.ok && result.recipientCount > 0) throw new Error(result.message);
      totals.created += result.notificationIds.length;
      totals.pushSent += result.push.sent;
      totals.pushFailed += result.push.failed;
    }
  }
  return totals;
}
