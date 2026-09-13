import "server-only";

import { createClient as createAdminClient } from "@supabase/supabase-js";
import webpush from "web-push";

export type NotificationCategory =
  | "preregistration"
  | "students"
  | "attendance"
  | "finance"
  | "payment"
  | "cash"
  | "approvals"
  | "staff"
  | "accounts"
  | "permissions"
  | "schedule"
  | "operations"
  | "reports"
  | "system";

export type NotificationSeverity = "info" | "success" | "warning" | "error" | "critical";
export type NotificationPriority = "low" | "normal" | "high" | "critical";

type NotificationScope = "all" | "branches" | "assigned";

export type CreateNotificationInput = {
  organizationId: string;
  title: string;
  body?: string | null;
  message?: string | null;
  category: NotificationCategory;
  eventKey?: string | null;
  notificationType?: string;
  severity?: NotificationSeverity;
  priority?: NotificationPriority;
  studentId?: string | null;
  sourceType?: string | null;
  sourceId?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  targetPath?: string | null;
  metadata?: Record<string, unknown>;
  createdBy?: string | null;
  recipientProfileIds?: string[];
  push?: boolean;
};

export type CreateNotificationResult = {
  ok: boolean;
  notificationIds: string[];
  recipientCount: number;
  push: { requested: boolean; sent: number; failed: number };
  message: string;
};

type ProfileRow = { id: string; role: string | null };
type PreferenceRow = {
  profile_id: string;
  category: string;
  in_app_enabled: boolean;
  push_enabled: boolean;
  scope: NotificationScope;
};
type StaffRow = { auth_user_id: string | null; all_branches: boolean | null };
type StaffBranchRow = { staff_id: string; branch_id: string };
type PushSubscriptionRow = {
  id: string;
  profile_id: string;
  endpoint: string;
  p256dh: string;
  auth_key: string;
  device_name: string | null;
};
type RecipientRoute = { profileId: string; pushEnabled: boolean };
type InsertedNotification = { id: string; recipient_profile_id: string | null; push_required: boolean | null };

type NotificationInsertRow = {
  organization_id: string;
  recipient_profile_id: string | null;
  recipient_user_id: string | null;
  notification_type: string;
  title: string;
  body: string | null;
  message: string | null;
  priority: string;
  severity: string;
  category: string;
  student_id: string | null;
  source_type: string | null;
  source_id: string | null;
  entity_type: string | null;
  entity_id: string | null;
  target_path: string | null;
  event_key: string | null;
  is_read: boolean;
  push_required: boolean;
  push_requested: boolean;
  push_sent: boolean;
  push_sent_at: string | null;
  metadata: Record<string, unknown>;
  created_by: string | null;
};

const STAFF_ROLES = new Set([
  "owner",
  "admin",
  "branch_manager",
  "registration_staff",
  "accounting",
  "coach",
]);

const COACH_DEFAULT_CATEGORIES = new Set([
  "students",
  "attendance",
  "staff",
  "schedule",
  "operations",
]);

function getAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("SprintOS notification engine: Supabase server environment variables are missing.");
  }
  return createAdminClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function configureWebPush() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject) return false;
  webpush.setVapidDetails(subject, publicKey, privateKey);
  return true;
}

function uniqueIds(values: string[]) {
  return Array.from(new Set(values.filter((value) => typeof value === "string" && value.trim().length > 0)));
}

function getStringMetadata(metadata: Record<string, unknown> | undefined, keys: string[]) {
  if (!metadata) return null;
  for (const key of keys) {
    const value = metadata[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function getStringArrayMetadata(metadata: Record<string, unknown> | undefined, keys: string[]) {
  if (!metadata) return [] as string[];
  for (const key of keys) {
    const value = metadata[key];
    if (Array.isArray(value)) return uniqueIds(value.filter((item): item is string => typeof item === "string"));
  }
  return [] as string[];
}

function defaultRule(role: string | null, category: NotificationCategory, explicit: boolean) {
  if (explicit) return { inAppEnabled: true, pushEnabled: true, scope: "all" as NotificationScope };
  if (role === "owner" || role === "admin") {
    return { inAppEnabled: true, pushEnabled: true, scope: "all" as NotificationScope };
  }
  const enabled = COACH_DEFAULT_CATEGORIES.has(category);
  return {
    inAppEnabled: enabled,
    pushEnabled: category === "attendance" || category === "schedule",
    scope: "assigned" as NotificationScope,
  };
}

async function resolveRecipients(input: CreateNotificationInput): Promise<RecipientRoute[]> {
  const admin = getAdminClient();
  const explicitIds = uniqueIds(input.recipientProfileIds ?? []);
  const explicit = explicitIds.length > 0;

  let profileQuery = admin
    .from("profiles")
    .select("id,role")
    .eq("organization_id", input.organizationId)
    .eq("is_active", true);

  if (explicit) profileQuery = profileQuery.in("id", explicitIds);

  const { data: profileData, error: profileError } = await profileQuery;
  if (profileError) throw new Error(`Bildirim alıcıları belirlenemedi: ${profileError.message}`);

  const profiles = ((profileData ?? []) as ProfileRow[]).filter((profile) => explicit || STAFF_ROLES.has(String(profile.role || "")));
  if (!profiles.length) return [];

  const candidateIds = profiles.map((profile) => profile.id);
  const [{ data: preferenceData, error: preferenceError }, { data: staffData, error: staffError }] = await Promise.all([
    admin
      .from("notification_user_preferences")
      .select("profile_id,category,in_app_enabled,push_enabled,scope")
      .eq("organization_id", input.organizationId)
      .eq("category", input.category)
      .in("profile_id", candidateIds),
    admin
      .from("staff")
      .select("id,auth_user_id,all_branches")
      .eq("organization_id", input.organizationId)
      .eq("is_active", true)
      .in("auth_user_id", candidateIds),
  ]);

  if (preferenceError) throw new Error(`Bildirim kuralları okunamadı: ${preferenceError.message}`);
  if (staffError) throw new Error(`Personel kapsamı okunamadı: ${staffError.message}`);

  const preferences = new Map(
    ((preferenceData ?? []) as PreferenceRow[]).map((row) => [String(row.profile_id), row])
  );

  const staffRows = ((staffData ?? []) as Array<StaffRow & { id: string }>);
  const staffByProfile = new Map(staffRows.map((row) => [String(row.auth_user_id), row]));
  const branchScopedStaffIds = staffRows.filter((row) => !row.all_branches).map((row) => row.id);

  let staffBranches: StaffBranchRow[] = [];
  if (branchScopedStaffIds.length) {
    const { data, error } = await admin
      .from("staff_branches")
      .select("staff_id,branch_id")
      .eq("organization_id", input.organizationId)
      .in("staff_id", branchScopedStaffIds);
    if (error) throw new Error(`Şube kapsamı okunamadı: ${error.message}`);
    staffBranches = (data ?? []) as StaffBranchRow[];
  }

  const allowedBranchesByStaff = new Map<string, Set<string>>();
  for (const row of staffBranches) {
    const set = allowedBranchesByStaff.get(String(row.staff_id)) ?? new Set<string>();
    set.add(String(row.branch_id));
    allowedBranchesByStaff.set(String(row.staff_id), set);
  }

  const branchId = getStringMetadata(input.metadata, ["branchId", "branch_id"]);
  const assignedProfileIds = new Set([
    ...getStringArrayMetadata(input.metadata, ["assignedProfileIds", "assigned_profile_ids", "coachProfileIds", "coach_profile_ids"]),
    ...[
      getStringMetadata(input.metadata, ["assignedProfileId", "assigned_profile_id"]),
      getStringMetadata(input.metadata, ["coachProfileId", "coach_profile_id", "primaryCoachId", "primary_coach_id"]),
    ].filter((value): value is string => Boolean(value)),
  ]);

  return profiles.flatMap((profile) => {
    const stored = preferences.get(profile.id);
    const rule = stored
      ? {
          inAppEnabled: stored.in_app_enabled,
          pushEnabled: stored.push_enabled,
          scope: stored.scope,
        }
      : defaultRule(profile.role, input.category, explicit);

    if (!rule.inAppEnabled) return [];

    if (rule.scope === "branches" && branchId) {
      const staff = staffByProfile.get(profile.id);
      if (staff && !staff.all_branches) {
        const allowed = allowedBranchesByStaff.get(String(staff.id));
        if (!allowed?.has(branchId)) return [];
      }
    }

    if (rule.scope === "assigned" && assignedProfileIds.size > 0 && !assignedProfileIds.has(profile.id)) {
      return [];
    }

    return [{ profileId: profile.id, pushEnabled: input.push === true && rule.pushEnabled }];
  });
}

function buildPushPayload(input: {
  title: string;
  body: string;
  targetPath: string | null;
  notificationId: string;
  category: string;
  severity: string;
}) {
  return JSON.stringify({
    title: input.title,
    body: input.body,
    targetPath: input.targetPath || "/bildirimler",
    tag: `sprintos-${input.notificationId}`,
    notificationId: input.notificationId,
    category: input.category,
    severity: input.severity,
    requireInteraction: input.severity === "critical",
  });
}

async function deactivateDeadSubscription(subscriptionId: string) {
  const admin = getAdminClient();
  const { error } = await admin
    .from("push_subscriptions")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("id", subscriptionId);
  if (error) console.error("SprintOS dead push subscription deactivate:", error);
}

async function sendPushToProfile(params: {
  organizationId: string;
  profileId: string;
  notificationId: string;
  title: string;
  body: string;
  category: string;
  severity: string;
  targetPath: string | null;
}) {
  const admin = getAdminClient();
  const { data, error } = await admin
    .from("push_subscriptions")
    .select("id,profile_id,endpoint,p256dh,auth_key,device_name")
    .eq("organization_id", params.organizationId)
    .eq("profile_id", params.profileId)
    .eq("is_active", true);

  if (error) {
    console.error("SprintOS push subscription read:", error);
    return { sent: 0, failed: 1 };
  }

  const subscriptions = (data ?? []) as PushSubscriptionRow[];
  if (!subscriptions.length) return { sent: 0, failed: 0 };

  const payload = buildPushPayload(params);
  let sent = 0;
  let failed = 0;

  for (const subscription of subscriptions) {
    try {
      await webpush.sendNotification(
        { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth_key } },
        payload
      );
      sent += 1;
    } catch (error: unknown) {
      failed += 1;
      const pushError = error as { statusCode?: number; message?: string };
      console.error("SprintOS push delivery error:", {
        subscriptionId: subscription.id,
        device: subscription.device_name,
        statusCode: pushError.statusCode,
        message: pushError.message,
      });
      if (pushError.statusCode === 404 || pushError.statusCode === 410) {
        await deactivateDeadSubscription(subscription.id);
      }
    }
  }

  return { sent, failed };
}

async function updatePushStatus(notificationId: string, sent: boolean) {
  const admin = getAdminClient();
  const { error } = await admin
    .from("system_notifications")
    .update({ push_sent: sent, push_sent_at: sent ? new Date().toISOString() : null })
    .eq("id", notificationId);
  if (error) console.error("SprintOS push status update:", error);
}

export async function createNotification(input: CreateNotificationInput): Promise<CreateNotificationResult> {
  const admin = getAdminClient();
  if (!input.organizationId) throw new Error("organizationId zorunludur.");
  if (!input.title?.trim()) throw new Error("Bildirim başlığı zorunludur.");
  if (!input.category) throw new Error("Bildirim kategorisi zorunludur.");

  const pushRequested = input.push === true;
  const severity = input.severity ?? "info";
  const priority = input.priority ?? "normal";
  const notificationType = input.notificationType ?? input.eventKey ?? input.category;
  const routes = await resolveRecipients(input);

  if (!routes.length) {
    return {
      ok: false,
      notificationIds: [],
      recipientCount: 0,
      push: { requested: pushRequested, sent: 0, failed: 0 },
      message: "Bildirim için yetkili aktif alıcı bulunamadı.",
    };
  }

  const body = input.body ?? input.message ?? null;
  const message = input.message ?? input.body ?? null;
  const rows: NotificationInsertRow[] = routes.map((route) => ({
    organization_id: input.organizationId,
    recipient_profile_id: route.profileId,
    recipient_user_id: route.profileId,
    notification_type: notificationType,
    title: input.title.trim(),
    body,
    message,
    priority,
    severity,
    category: input.category,
    student_id: input.studentId ?? null,
    source_type: input.sourceType ?? null,
    source_id: input.sourceId ?? null,
    entity_type: input.entityType ?? null,
    entity_id: input.entityId ?? null,
    target_path: input.targetPath ?? "/bildirimler",
    event_key: input.eventKey ?? null,
    is_read: false,
    push_required: route.pushEnabled,
    push_requested: pushRequested,
    push_sent: false,
    push_sent_at: null,
    metadata: input.metadata ?? {},
    created_by: input.createdBy ?? null,
  }));

  const { data: insertedRows, error: insertError } = await admin
    .from("system_notifications")
    .insert(rows)
    .select("id,recipient_profile_id,push_required");

  if (insertError) throw new Error(`Bildirim oluşturulamadı: ${insertError.message}`);

  const notifications = (insertedRows ?? []) as InsertedNotification[];
  if (!pushRequested) {
    return {
      ok: true,
      notificationIds: notifications.map((item) => item.id),
      recipientCount: routes.length,
      push: { requested: false, sent: 0, failed: 0 },
      message: "SprintOS bildirimi yetki kurallarına göre oluşturuldu.",
    };
  }

  const pushTargets = notifications.filter((item) => item.push_required && item.recipient_profile_id);
  if (!pushTargets.length) {
    return {
      ok: true,
      notificationIds: notifications.map((item) => item.id),
      recipientCount: routes.length,
      push: { requested: true, sent: 0, failed: 0 },
      message: "Bildirimler oluşturuldu; seçili alıcılarda push kapalı olduğu için telefon bildirimi gönderilmedi.",
    };
  }

  if (!configureWebPush()) {
    console.error("SprintOS notification engine: VAPID configuration is missing.");
    return {
      ok: true,
      notificationIds: notifications.map((item) => item.id),
      recipientCount: routes.length,
      push: { requested: true, sent: 0, failed: pushTargets.length },
      message: "Bildirim oluşturuldu ancak push yapılandırması bulunamadı.",
    };
  }

  let totalPushSent = 0;
  let totalPushFailed = 0;
  for (const notification of pushTargets) {
    const profileId = notification.recipient_profile_id;
    if (!profileId) continue;
    const result = await sendPushToProfile({
      organizationId: input.organizationId,
      profileId,
      notificationId: notification.id,
      title: input.title.trim(),
      body: body || "SprintOS'ta yeni bir bildiriminiz var.",
      category: input.category,
      severity,
      targetPath: input.targetPath ?? "/bildirimler",
    });
    totalPushSent += result.sent;
    totalPushFailed += result.failed;
    await updatePushStatus(notification.id, result.sent > 0);
  }

  return {
    ok: true,
    notificationIds: notifications.map((item) => item.id),
    recipientCount: routes.length,
    push: { requested: true, sent: totalPushSent, failed: totalPushFailed },
    message:
      totalPushSent > 0
        ? `Bildirim kurallara göre oluşturuldu ve ${totalPushSent} push bildirimi gönderildi.`
        : "Bildirim oluşturuldu ancak aktif push cihazına gönderim yapılamadı.",
  };
}
