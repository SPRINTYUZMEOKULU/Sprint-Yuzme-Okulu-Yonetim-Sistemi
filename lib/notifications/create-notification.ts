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

export type NotificationSeverity =
  | "info"
  | "success"
  | "warning"
  | "error"
  | "critical";

export type NotificationPriority =
  | "low"
  | "normal"
  | "high"
  | "critical";

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

  /*
   * Belirli kullanıcılara bildirim göndermek için.
   *
   * Boş bırakılırsa organizasyondaki aktif yönetim
   * kullanıcıları belirlenir.
   */
  recipientProfileIds?: string[];

  /*
   * true ise telefon / tarayıcı push bildirimi de gönderilir.
   */
  push?: boolean;
};

export type CreateNotificationResult = {
  ok: boolean;

  notificationIds: string[];

  recipientCount: number;

  push: {
    requested: boolean;
    sent: number;
    failed: number;
  };

  message: string;
};

type ProfileRow = {
  id: string;
};

type PushSubscriptionRow = {
  id: string;
  profile_id: string;
  endpoint: string;
  p256dh: string;
  auth_key: string;
  device_name: string | null;
};

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

function getAdminClient() {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "SprintOS notification engine: Supabase server environment variables are missing."
    );
  }

  return createAdminClient(
    supabaseUrl,
    serviceRoleKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );
}

function configureWebPush() {
  const publicKey =
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

  const privateKey =
    process.env.VAPID_PRIVATE_KEY;

  const subject =
    process.env.VAPID_SUBJECT;

  if (!publicKey || !privateKey || !subject) {
    return false;
  }

  webpush.setVapidDetails(
    subject,
    publicKey,
    privateKey
  );

  return true;
}

function uniqueIds(values: string[]) {
  return Array.from(
    new Set(
      values.filter(
        (value) =>
          typeof value === "string" &&
          value.trim().length > 0
      )
    )
  );
}

/*
 * Bildirim alacak yönetim profillerini belirler.
 *
 * recipientProfileIds verilmişse yalnızca onlar kullanılır.
 *
 * Verilmemişse organizasyondaki aktif profile kayıtlarını
 * almaya çalışır. Bu merkezi helper ileride yetki bazlı
 * recipient routing ile genişletilecek.
 */
async function resolveRecipients(
  organizationId: string,
  requestedProfileIds?: string[]
): Promise<string[]> {
  if (
    requestedProfileIds &&
    requestedProfileIds.length > 0
  ) {
    return uniqueIds(
      requestedProfileIds
    );
  }

  const admin = getAdminClient();

  const { data, error } = await admin
    .from("profiles")
    .select("id")
    .eq(
      "organization_id",
      organizationId
    )
    .eq("is_active", true);

  if (error) {
    console.error(
      "SprintOS notification recipient lookup:",
      error
    );

    throw new Error(
      "Bildirim alıcıları belirlenemedi."
    );
  }

  return uniqueIds(
    ((data ?? []) as ProfileRow[]).map(
      (profile) => profile.id
    )
  );
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

    targetPath:
      input.targetPath ||
      "/bildirimler",

    tag: `sprintos-${input.notificationId}`,

    notificationId:
      input.notificationId,

    category:
      input.category,

    severity:
      input.severity,

    requireInteraction:
      input.severity === "critical",
  });
}

async function deactivateDeadSubscription(
  subscriptionId: string
) {
  const admin = getAdminClient();

  const { error } = await admin
    .from("push_subscriptions")
    .update({
      is_active: false,
      updated_at:
        new Date().toISOString(),
    })
    .eq("id", subscriptionId);

  if (error) {
    console.error(
      "SprintOS dead push subscription deactivate:",
      error
    );
  }
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

  const {
    data: subscriptions,
    error: subscriptionsError,
  } = await admin
    .from("push_subscriptions")
    .select(
      `
        id,
        profile_id,
        endpoint,
        p256dh,
        auth_key,
        device_name
      `
    )
    .eq(
      "organization_id",
      params.organizationId
    )
    .eq(
      "profile_id",
      params.profileId
    )
    .eq("is_active", true);

  if (subscriptionsError) {
    console.error(
      "SprintOS push subscription read:",
      subscriptionsError
    );

    return {
      sent: 0,
      failed: 1,
    };
  }

  const activeSubscriptions =
    (subscriptions ??
      []) as PushSubscriptionRow[];

  if (
    activeSubscriptions.length === 0
  ) {
    return {
      sent: 0,
      failed: 0,
    };
  }

  const payload =
    buildPushPayload({
      title: params.title,
      body: params.body,
      targetPath:
        params.targetPath,
      notificationId:
        params.notificationId,
      category:
        params.category,
      severity:
        params.severity,
    });

  let sent = 0;
  let failed = 0;

  for (const subscription of activeSubscriptions) {
    try {
      await webpush.sendNotification(
        {
          endpoint:
            subscription.endpoint,

          keys: {
            p256dh:
              subscription.p256dh,

            auth:
              subscription.auth_key,
          },
        },
        payload
      );

      sent += 1;
    } catch (error: unknown) {
      failed += 1;

      const pushError =
        error as {
          statusCode?: number;
          message?: string;
        };

      console.error(
        "SprintOS push delivery error:",
        {
          subscriptionId:
            subscription.id,
          device:
            subscription.device_name,
          statusCode:
            pushError.statusCode,
          message:
            pushError.message,
        }
      );

      /*
       * 404 / 410:
       * Browser veya cihaz aboneliği artık geçersiz.
       */
      if (
        pushError.statusCode === 404 ||
        pushError.statusCode === 410
      ) {
        await deactivateDeadSubscription(
          subscription.id
        );
      }
    }
  }

  return {
    sent,
    failed,
  };
}

async function updatePushStatus(params: {
  notificationId: string;
  sent: boolean;
}) {
  const admin = getAdminClient();

  const { error } = await admin
    .from("system_notifications")
    .update({
      push_sent: params.sent,

      push_sent_at:
        params.sent
          ? new Date().toISOString()
          : null,
    })
    .eq(
      "id",
      params.notificationId
    );

  if (error) {
    console.error(
      "SprintOS push status update:",
      error
    );
  }
}

export async function createNotification(
  input: CreateNotificationInput
): Promise<CreateNotificationResult> {
  const admin = getAdminClient();

  if (!input.organizationId) {
    throw new Error(
      "organizationId zorunludur."
    );
  }

  if (!input.title?.trim()) {
    throw new Error(
      "Bildirim başlığı zorunludur."
    );
  }

  if (!input.category) {
    throw new Error(
      "Bildirim kategorisi zorunludur."
    );
  }

  const pushRequested =
    input.push === true;

  const severity =
    input.severity ?? "info";

  const priority =
    input.priority ?? "normal";

  const notificationType =
    input.notificationType ??
    input.eventKey ??
    input.category;

  const recipientProfileIds =
    await resolveRecipients(
      input.organizationId,
      input.recipientProfileIds
    );

  /*
   * Hiç alıcı bulunamazsa global notification oluşturmak
   * yerine işlemi durduruyoruz.
   *
   * Böylece yanlışlıkla tüm organizasyona görünür bir
   * kayıt oluşmaz.
   */
  if (
    recipientProfileIds.length === 0
  ) {
    return {
      ok: false,
      notificationIds: [],
      recipientCount: 0,

      push: {
        requested:
          pushRequested,
        sent: 0,
        failed: 0,
      },

      message:
        "Bildirim için aktif alıcı bulunamadı.",
    };
  }

  const body =
    input.body ??
    input.message ??
    null;

  const message =
    input.message ??
    input.body ??
    null;

  const rows: NotificationInsertRow[] =
    recipientProfileIds.map(
      (profileId) => ({
        organization_id:
          input.organizationId,

        /*
         * SprintOS profiles.id mevcut yapıda auth user id
         * ile eşleştiği için iki alanı da dolduruyoruz.
         */
        recipient_profile_id:
          profileId,

        recipient_user_id:
          profileId,

        notification_type:
          notificationType,

        title:
          input.title.trim(),

        body,

        message,

        priority,

        severity,

        category:
          input.category,

        student_id:
          input.studentId ??
          null,

        source_type:
          input.sourceType ??
          null,

        source_id:
          input.sourceId ??
          null,

        entity_type:
          input.entityType ??
          null,

        entity_id:
          input.entityId ??
          null,

        target_path:
          input.targetPath ??
          "/bildirimler",

        event_key:
          input.eventKey ??
          null,

        is_read: false,

        push_required:
          pushRequested,

        push_requested:
          pushRequested,

        push_sent: false,

        push_sent_at: null,

        metadata:
          input.metadata ?? {},

        created_by:
          input.createdBy ??
          null,
      })
    );

  const {
    data: insertedRows,
    error: insertError,
  } = await admin
    .from("system_notifications")
    .insert(rows)
    .select(
      "id, recipient_profile_id"
    );

  if (insertError) {
    console.error(
      "SprintOS notification insert:",
      insertError
    );

    throw new Error(
      `Bildirim oluşturulamadı: ${insertError.message}`
    );
  }

  const notifications =
    insertedRows ?? [];

  let totalPushSent = 0;
  let totalPushFailed = 0;

  /*
   * Push istenmemişse DB kaydıyla işlem tamamlanır.
   */
  if (!pushRequested) {
    return {
      ok: true,

      notificationIds:
        notifications.map(
          (item) => item.id
        ),

      recipientCount:
        recipientProfileIds.length,

      push: {
        requested: false,
        sent: 0,
        failed: 0,
      },

      message:
        "SprintOS bildirimi oluşturuldu.",
    };
  }

  /*
   * VAPID ayarları eksikse bildirim DB'de kalır fakat
   * push_sent false olur.
   */
  const pushConfigured =
    configureWebPush();

  if (!pushConfigured) {
    console.error(
      "SprintOS notification engine: VAPID configuration is missing."
    );

    return {
      ok: true,

      notificationIds:
        notifications.map(
          (item) => item.id
        ),

      recipientCount:
        recipientProfileIds.length,

      push: {
        requested: true,
        sent: 0,
        failed:
          notifications.length,
      },

      message:
        "Bildirim oluşturuldu ancak push yapılandırması bulunamadı.",
    };
  }

  for (const notification of notifications) {
    const profileId =
      notification.recipient_profile_id;

    if (!profileId) {
      totalPushFailed += 1;
      continue;
    }

    const pushResult =
      await sendPushToProfile({
        organizationId:
          input.organizationId,

        profileId,

        notificationId:
          notification.id,

        title:
          input.title.trim(),

        body:
          body ||
          "SprintOS'ta yeni bir bildiriminiz var.",

        category:
          input.category,

        severity,

        targetPath:
          input.targetPath ??
          "/bildirimler",
      });

    totalPushSent +=
      pushResult.sent;

    totalPushFailed +=
      pushResult.failed;

    await updatePushStatus({
      notificationId:
        notification.id,

      sent:
        pushResult.sent > 0,
    });
  }

  return {
    ok: true,

    notificationIds:
      notifications.map(
        (item) => item.id
      ),

    recipientCount:
      recipientProfileIds.length,

    push: {
      requested: true,
      sent:
        totalPushSent,
      failed:
        totalPushFailed,
    },

    message:
      totalPushSent > 0
        ? `Bildirim oluşturuldu ve ${totalPushSent} push bildirimi gönderildi.`
        : "Bildirim oluşturuldu ancak aktif push cihazına gönderim yapılamadı.",
  };
}
