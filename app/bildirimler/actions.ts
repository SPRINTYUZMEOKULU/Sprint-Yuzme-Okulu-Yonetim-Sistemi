"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

type ActionResult = {
  ok: boolean;
  message: string;
};

type CurrentContext = {
  userId: string;
  profileId: string;
  organizationId: string;
};

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error("Supabase sunucu ayarları eksik.");
  }

  return createAdminClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

async function getCurrentContext(): Promise<CurrentContext> {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error("Oturum bulunamadı.");
  }

  const admin = getAdminClient();

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id, organization_id")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile) {
    throw new Error("Kullanıcı profili bulunamadı.");
  }

  return {
    userId: user.id,
    profileId: profile.id,
    organizationId: profile.organization_id,
  };
}

function canAccessNotification(
  notification: {
    recipient_profile_id: string | null;
    recipient_user_id: string | null;
  },
  context: CurrentContext
) {
  const isGlobal =
    !notification.recipient_profile_id &&
    !notification.recipient_user_id;

  const isForProfile =
    notification.recipient_profile_id === context.profileId;

  const isForUser =
    notification.recipient_user_id === context.userId;

  return isGlobal || isForProfile || isForUser;
}

export async function markNotificationRead(
  notificationId: string
): Promise<ActionResult> {
  try {
    if (!notificationId) {
      return {
        ok: false,
        message: "Bildirim kimliği bulunamadı.",
      };
    }

    const context = await getCurrentContext();
    const admin = getAdminClient();

    const { data: notification, error: notificationError } =
      await admin
        .from("system_notifications")
        .select(
          "id, organization_id, recipient_profile_id, recipient_user_id, is_read"
        )
        .eq("id", notificationId)
        .eq("organization_id", context.organizationId)
        .maybeSingle();

    if (notificationError || !notification) {
      return {
        ok: false,
        message: "Bildirim bulunamadı.",
      };
    }

    if (!canAccessNotification(notification, context)) {
      return {
        ok: false,
        message: "Bu bildirim için yetkiniz bulunmuyor.",
      };
    }

    if (notification.is_read) {
      return {
        ok: true,
        message: "Bildirim zaten okunmuş.",
      };
    }

    const now = new Date().toISOString();

    const { error: updateError } = await admin
      .from("system_notifications")
      .update({
        is_read: true,
        read_at: now,
      })
      .eq("id", notification.id)
      .eq("organization_id", context.organizationId);

    if (updateError) {
      console.error(
        "SprintOS markNotificationRead:",
        updateError
      );

      return {
        ok: false,
        message: "Bildirim güncellenemedi.",
      };
    }

    revalidatePath("/bildirimler");
    revalidatePath("/");

    return {
      ok: true,
      message: "Bildirim okundu olarak işaretlendi.",
    };
  } catch (error) {
    console.error("SprintOS notification action:", error);

    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Bildirim işlemi sırasında hata oluştu.",
    };
  }
}

export async function markNotificationUnread(
  notificationId: string
): Promise<ActionResult> {
  try {
    if (!notificationId) {
      return {
        ok: false,
        message: "Bildirim kimliği bulunamadı.",
      };
    }

    const context = await getCurrentContext();
    const admin = getAdminClient();

    const { data: notification, error: notificationError } =
      await admin
        .from("system_notifications")
        .select(
          "id, organization_id, recipient_profile_id, recipient_user_id"
        )
        .eq("id", notificationId)
        .eq("organization_id", context.organizationId)
        .maybeSingle();

    if (notificationError || !notification) {
      return {
        ok: false,
        message: "Bildirim bulunamadı.",
      };
    }

    if (!canAccessNotification(notification, context)) {
      return {
        ok: false,
        message: "Bu bildirim için yetkiniz bulunmuyor.",
      };
    }

    const { error: updateError } = await admin
      .from("system_notifications")
      .update({
        is_read: false,
        read_at: null,
      })
      .eq("id", notification.id)
      .eq("organization_id", context.organizationId);

    if (updateError) {
      console.error(
        "SprintOS markNotificationUnread:",
        updateError
      );

      return {
        ok: false,
        message: "Bildirim güncellenemedi.",
      };
    }

    revalidatePath("/bildirimler");
    revalidatePath("/");

    return {
      ok: true,
      message: "Bildirim okunmamış olarak işaretlendi.",
    };
  } catch (error) {
    console.error("SprintOS notification action:", error);

    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Bildirim işlemi sırasında hata oluştu.",
    };
  }
}

export async function markAllNotificationsRead(): Promise<ActionResult> {
  try {
    const context = await getCurrentContext();
    const admin = getAdminClient();

    const { data: notifications, error: notificationsError } =
      await admin
        .from("system_notifications")
        .select(
          "id, recipient_profile_id, recipient_user_id, is_read"
        )
        .eq("organization_id", context.organizationId)
        .eq("is_read", false);

    if (notificationsError) {
      console.error(
        "SprintOS markAllNotificationsRead list:",
        notificationsError
      );

      return {
        ok: false,
        message: "Bildirimler okunamadı.",
      };
    }

    const allowedIds = (notifications ?? [])
      .filter((notification) =>
        canAccessNotification(notification, context)
      )
      .map((notification) => notification.id);

    if (allowedIds.length === 0) {
      return {
        ok: true,
        message: "Okunmamış bildirim bulunmuyor.",
      };
    }

    const now = new Date().toISOString();

    const { error: updateError } = await admin
      .from("system_notifications")
      .update({
        is_read: true,
        read_at: now,
      })
      .eq("organization_id", context.organizationId)
      .in("id", allowedIds);

    if (updateError) {
      console.error(
        "SprintOS markAllNotificationsRead:",
        updateError
      );

      return {
        ok: false,
        message: "Bildirimler güncellenemedi.",
      };
    }

    revalidatePath("/bildirimler");
    revalidatePath("/");

    return {
      ok: true,
      message: `${allowedIds.length} bildirim okundu olarak işaretlendi.`,
    };
  } catch (error) {
    console.error("SprintOS notification action:", error);

    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Bildirim işlemi sırasında hata oluştu.",
    };
  }
}
