import "server-only";
import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { createNotification } from "@/lib/notifications/create-notification";

export const messageDeliveryIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const messageCenterRoles = ["owner", "admin", "branch_manager", "registration_staff", "accounting", "coach"] as const;

export async function deliverPortalMessage(input: {
  organizationId: string;
  studentId: string;
  actorId: string;
  deliveryId: string;
  title: string;
  message: string;
}) {
  const { organizationId, studentId, actorId, deliveryId, title, message } = input;
  const result = { saved: 0, push: 0, failed: 0 };

  // Authentication links and credentials belong to the separate account flow.
  if (/şifre|sifre|password|doğrulama kodu|dogrulama kodu|\botp\b|giriş bilg|giris bilg|\/s[#/?]|[?&](?:token|code)=/iu.test(message + "\n" + title)) {
    return { ...result, skipped: true };
  }

  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: student, error: studentError } = await db.from("students").select("id")
    .eq("id", studentId).eq("organization_id", organizationId).eq("is_deleted", false).maybeSingle();
  if (studentError) throw studentError;
  if (!student) return result;
  const { data: links, error: linkError } = await db.from("guardian_students")
    .select("guardian_id").eq("student_id", studentId).eq("portal_access", true).eq("receives_messages", true);
  if (linkError) throw linkError;
  if (!links?.length) return result;

  const { data: guardians, error: guardianError } = await db.from("guardians")
    .select("auth_user_id").eq("organization_id", organizationId).eq("is_active", true).eq("login_enabled", true)
    .in("id", links.map(link => link.guardian_id));
  if (guardianError) throw guardianError;
  const ids = [...new Set((guardians ?? []).map(guardian => guardian.auth_user_id).filter(Boolean))] as string[];
  if (!ids.length) return result;

  const { data: profiles, error: profileError } = await db.from("profiles").select("id")
    .eq("organization_id", organizationId).eq("role", "guardian").eq("is_active", true).in("id", ids);
  if (profileError) throw profileError;

  for (const profile of profiles ?? []) {
    const hash = createHash("sha256").update(JSON.stringify([organizationId, studentId, deliveryId, profile.id])).digest("hex");
    const id = `${hash.slice(0, 8)}-${hash.slice(8, 12)}-5${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
    const { error } = await db.from("guardian_messages").upsert({
      id, organization_id: organizationId, student_id: studentId, guardian_id: profile.id,
      title: title.slice(0, 180), body: message, message_type: "information", channel: "panel",
      sent_by: actorId, sent_at: new Date().toISOString(),
    }, { onConflict: "id", ignoreDuplicates: true });
    if (error) {
      result.failed++;
      continue;
    }

    result.saved++;
    try {
      const notification = await createNotification({
        organizationId, studentId, category: "students", eventKey: "guardian_portal_message",
        title: "SprintOS’ta yeni mesajınız var",
        body: "Mesajınızı uygulamadaki Mesajlar bölümünden okuyabilirsiniz.",
        sourceType: "guardian_message", sourceId: id,
        targetPath: `/veli-mesajlar?child=${studentId}#mesaj-${id}`,
        recipientProfileIds: [profile.id], createdBy: actorId, push: true, dedupeKey: `guardian-message:${id}`,
      });
      result.push += notification.push.sent;
      if (!notification.ok || notification.push.failed) result.failed++;
    } catch {
      result.failed++;
    }
  }
  return result;
}
