import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createNotification, type CreateNotificationInput, type CreateNotificationResult, type NotificationCategory } from "./create-notification";

type EventRow = {
  organization_id: string;
  title: string;
  category?: string;
  body?: string | null;
  message?: string | null;
  event_key?: string | null;
  notification_type?: string;
  recipient_profile_id?: string | null;
  recipient_user_id?: string | null;
  include_requester?: string | null;
  severity?: CreateNotificationInput["severity"];
  priority?: CreateNotificationInput["priority"];
  student_id?: string | null;
  entity_type?: string | null;
  entity_id?: string | null;
  source_type?: string | null;
  source_id?: string | null;
  target_path?: string | null;
  push_requested?: boolean;
  push_required?: boolean;
  metadata?: Record<string, unknown>;
  created_by?: string | null;
  is_read?: boolean;
};
const categories = new Set(["preregistration","students","attendance","finance","payment","cash","approvals","staff","accounts","permissions","schedule","operations","reports","system"]);

/** Authenticated server callers publish after a successful business operation. */
export async function publishEventNotification(input: EventRow | EventRow[], send = createNotification) {
  let rows = Array.isArray(input) ? input : [input];
  const results: CreateNotificationResult[] = [];
  if (!rows.length) return { error: null, results };
  if (rows.length > 1 && rows.every(row => row.notification_type === "bulk_compensation_approved" && row.organization_id === rows[0].organization_id && row.source_id === rows[0].source_id)) {
    const first = rows[0];
    rows = [{ ...first, student_id: null, target_path: "/onay-merkezi?status=approved",
      body: `${rows.length} kursiyer için toplu işlem tamamlandı. ${first.body || first.message || ""}`,
      metadata: { ...first.metadata, affected_student_ids: rows.map(row => row.student_id), affected_student_count: rows.length },
    }];
  }
  try {
    for (const row of rows) {
      const category = row.category === "approval" ? "approvals" : categories.has(row.category || "") ? row.category as NotificationCategory : "approvals";
      const recipient = row.recipient_profile_id || row.recipient_user_id;
      const studentId = row.student_id || (row.entity_type === "student" ? row.entity_id : null);
      let recipients = recipient ? [recipient] : undefined;
      if (!recipient && row.include_requester) {
        const client = await createClient();
        const { data, error } = await client.from("profiles").select("id")
          .eq("organization_id", row.organization_id).eq("is_active", true).in("role", ["owner", "admin"]);
        if (error) throw new Error("Bildirim alıcıları doğrulanamadı.");
        recipients = [...new Set([...(data || []).map(profile => profile.id), row.include_requester])];
      }
      const result = await send({ organizationId: row.organization_id, title: row.title,
        body: row.body || row.message, message: row.message || row.body,
        category, eventKey: row.event_key || row.notification_type || null,
        notificationType: row.notification_type || row.event_key || category,
        severity: row.severity || "success", priority: row.priority || "normal",
        studentId, entityType: row.entity_type, entityId: row.entity_id,
        sourceType: row.source_type || row.entity_type, sourceId: row.source_id || row.entity_id,
        targetPath: row.target_path || (category === "approvals" ? "/onay-merkezi" : row.student_id ? `/ogrenciler/${row.student_id}?payment=history` : "/odemeler"),
        recipientProfileIds: recipients,
        push: row.push_requested ?? row.push_required ?? true,
        metadata: row.metadata || {}, createdBy: row.created_by,
      });
      results.push(result);
      if (!result.ok) throw new Error(result.message);
    }
    return { error: null, results };
  } catch (error) {
    // Notification transport must not turn a saved payment/approval into a failure.
    console.error("SprintOS event notification failed:", error instanceof Error ? error.message : "unknown");
    return { error: { message: "İşlem kaydedildi ancak bildirimi gönderilemedi." }, results };
  }
}
