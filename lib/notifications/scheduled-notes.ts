import type { SupabaseClient } from "@supabase/supabase-js";
import { deliverScheduledNotePush } from "./create-notification";

// Only recent due notes are sent; enabling the scheduler must not flood phones
// with the historic backlog. Normal polling is every five minutes.
export async function dispatchDueNoteReminders(
  client: SupabaseClient, organizationId: string, now = new Date(),
  deliver: typeof deliverScheduledNotePush = deliverScheduledNotePush,
) {
  const since = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
  const { data: rows, error } = await client.from("system_notifications")
    .select("id,recipient_profile_id,student_id,title,body,message,target_path,source_id,metadata")
    .eq("organization_id", organizationId).eq("is_read", false)
    .eq("push_requested", false).eq("push_sent", false)
    .in("notification_type", ["registration_note_reminder", "student_note_reminder"])
    .gte("metadata->>reminder_at", since).lte("metadata->>reminder_at", now.toISOString())
    .order("created_at", { ascending: true }).limit(20);
  if (error) throw new Error("Zamanlı öğrenci notları yüklenemedi.");
  const ids = [...new Set((rows || []).map(row => row.source_id).filter(Boolean))];
  if (!ids.length) return { sent: 0, failed: 0 };
  const { data: logs, error: logError } = await client.from("student_activity_logs")
    .select("id,student_id,performed_by,reminder_at,reminder_completed")
    .eq("organization_id", organizationId).in("id", ids).eq("reminder_completed", false);
  if (logError) throw new Error("Not hatırlatmalarının tamamlanma durumu doğrulanamadı.");
  const active = new Map((logs || []).map(log => [log.id, log]));
  let sent = 0, failed = 0;
  for (const row of rows || []) {
    const log = active.get(row.source_id);
    const due = new Date(row.metadata?.reminder_at || "").getTime();
    if (!log || !row.recipient_profile_id || log.performed_by !== row.recipient_profile_id || log.student_id !== row.student_id) continue;
    if (!Number.isFinite(due) || due > now.getTime() || due < now.getTime() - 3600000 || new Date(log.reminder_at).getTime() !== due) continue;
    const result = await deliver({ organizationId, notificationId: row.id,
      profileId: row.recipient_profile_id, studentId: row.student_id,
      title: row.title || "Öğrenci notu hatırlatması", body: row.body || row.message || "Takip zamanı gelen bir öğrenci notunuz var.",
      targetPath: row.target_path || `/ogrenciler/${row.student_id}#notlar`,
    });
    sent += result.sent; failed += result.failed;
  }
  return { sent, failed };
}
