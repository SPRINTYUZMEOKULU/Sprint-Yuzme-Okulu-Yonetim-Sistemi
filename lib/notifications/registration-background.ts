import { createNotification } from "@/lib/notifications/create-notification";

const EVENT = "registration_completion_required";
const PENDING = ["pre_registration", "waiting_payment", "waiting_approval"];

export async function runRegistrationBackground(client: any, organizationId: string,
  notify: typeof createNotification = createNotification, now = Date.now()) {
  const [students, enrollments, existing] = await Promise.all([
    client.from("students").select("id,first_name,last_name,status,created_at,branch_id,is_deleted")
      .eq("organization_id", organizationId).in("status", PENDING).eq("is_deleted", false),
    client.from("student_enrollments").select("id,student_id,status")
      .eq("organization_id", organizationId).eq("status", "active"),
    client.from("system_notifications").select("id,student_id,is_read,metadata")
      .eq("organization_id", organizationId).eq("event_key", EVENT),
  ]);
  if (students.error || enrollments.error || existing.error) throw new Error("Kesin kayıt uyarıları kontrol edilemedi.");
  const pending = new Map<string, any>((students.data || []).map((s: any) => [s.id, s]));
  const activeEnrollmentIds = new Set((enrollments.data || []).map((e: any) => e.student_id));
  let created = 0, resolved = 0, pushSent = 0, pushFailed = 0;
  for (const row of existing.data || []) {
    if (!row.is_read && !pending.has(row.student_id)) {
      const result = await client.from("system_notifications").update({ is_read: true, read_at: new Date(now).toISOString(),
        metadata: { ...row.metadata, resolved_reason: "registration_no_longer_pending" } })
        .eq("organization_id", organizationId).eq("id", row.id);
      if (result.error) throw new Error("Tamamlanan kesin kayıt uyarısı kapatılamadı.");
      resolved++;
    }
  }
  const alreadyNotified = new Set((existing.data || []).map((row: any) => row.student_id));
  for (const student of pending.values()) {
    if (alreadyNotified.has(student.id)) continue;
    // Give staff time to finish a newly opened registration. Never repeat a dismissed alert.
    if (now - Date.parse(student.created_at) < 60 * 60 * 1000) continue;
    const inconsistent = activeEnrollmentIds.has(student.id);
    const name = `${student.first_name} ${student.last_name}`.trim();
    const result = await notify({ organizationId, category: "preregistration", eventKey: EVENT,
      notificationType: EVENT, title: inconsistent ? "Kesin kayıt durumu kontrol edilmeli" : "Kesin kayıt tamamlanmalı",
      body: inconsistent ? `${name}: Ders dönemi mevcut ancak kesin kayıt durumu tamamlanmamış. Dosyayı kontrol edin.`
        : `${name}: Kesin kayıt henüz tamamlanmadı. Program, paket ve ödeme bilgilerini kontrol ederek kaydı tamamlayın.`,
      severity: "warning", priority: "high", studentId: student.id, sourceType: "student", sourceId: student.id,
      entityType: "student", entityId: student.id, targetPath: `/kayit-tamamlama/${student.id}`,
      metadata: { student_id: student.id, branch_id: student.branch_id, registration_status: student.status },
      dedupeKey: `${EVENT}:${student.id}:${student.created_at}`, push: true });
    if (!result.ok) throw new Error(result.message);
    if (result.notificationIds.length) created++;
    pushSent += result.push.sent; pushFailed += result.push.failed;
  }
  return { created, resolved, pushSent, pushFailed };
}
