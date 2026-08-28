import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import webpush from "web-push";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase sunucu ayarları eksik.");
  }

  return createAdminClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export async function POST() {
  try {
    /*
     * 1. İstek yapan kullanıcıyı normal Supabase oturumundan doğrula.
     */
    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        {
          ok: false,
          error: "Oturum bulunamadı.",
        },
        { status: 401 }
      );
    }

    /*
     * 2. VAPID ayarlarını kontrol et.
     */
    const vapidPublicKey =
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

    const vapidPrivateKey =
      process.env.VAPID_PRIVATE_KEY;

    const vapidSubject =
      process.env.VAPID_SUBJECT;

    if (
      !vapidPublicKey ||
      !vapidPrivateKey ||
      !vapidSubject
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "VAPID environment variable ayarları eksik.",
        },
        { status: 500 }
      );
    }

    /*
     * 3. web-push yapılandırması.
     */
    webpush.setVapidDetails(
      vapidSubject,
      vapidPublicKey,
      vapidPrivateKey
    );

    /*
     * 4. Kullanıcının profile kaydını bul.
     *
     * push_subscriptions tablosunda profile_id
     * kullanıldığı için Auth user id -> profile id
     * eşleştirmesini burada yapıyoruz.
     */
    const admin = getAdminClient();

    const {
      data: profile,
      error: profileError,
    } = await admin
      .from("profiles")
      .select("id, organization_id")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      console.error(
        "SprintOS push profile:",
        profileError
      );

      return NextResponse.json(
        {
          ok: false,
          error: "Kullanıcı profili okunamadı.",
        },
        { status: 500 }
      );
    }

    if (!profile) {
      return NextResponse.json(
        {
          ok: false,
          error: "Kullanıcı profili bulunamadı.",
        },
        { status: 404 }
      );
    }

    /*
     * 5. Bu kullanıcının aktif cihaz aboneliklerini getir.
     */
    const {
      data: subscriptions,
      error: subscriptionsError,
    } = await admin
      .from("push_subscriptions")
      .select(
        "id, endpoint, p256dh, auth_key, device_name"
      )
      .eq("organization_id", profile.organization_id)
      .eq("profile_id", profile.id)
      .eq("is_active", true);

    if (subscriptionsError) {
      console.error(
        "SprintOS subscriptions:",
        subscriptionsError
      );

      return NextResponse.json(
        {
          ok: false,
          error:
            "Push abonelikleri okunamadı.",
        },
        { status: 500 }
      );
    }

    if (!subscriptions?.length) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Bu kullanıcıya ait aktif bildirim cihazı bulunamadı.",
        },
        { status: 404 }
      );
    }

    /*
     * 6. Service Worker'a gönderilecek gerçek payload.
     */
    const payload = JSON.stringify({
      title: "SprintOS Test Bildirimi",
      body:
        "Telefon bildirim sistemi başarıyla çalışıyor. 🏊‍♂️",
      targetPath: "/",
      tag: `sprintos-test-${Date.now()}`,
      requireInteraction: false,
    });

    let sent = 0;
    let failed = 0;

    const results: Array<{
      subscriptionId: string;
      deviceName: string | null;
      ok: boolean;
      statusCode?: number;
    }> = [];

    /*
     * 7. Kullanıcının tüm aktif cihazlarına gönder.
     */
    for (const subscription of subscriptions) {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: {
              p256dh: subscription.p256dh,
              auth: subscription.auth_key,
            },
          },
          payload
        );

        sent += 1;

        results.push({
          subscriptionId: subscription.id,
          deviceName:
            subscription.device_name ?? null,
          ok: true,
        });
      } catch (error: unknown) {
        failed += 1;

        const pushError = error as {
          statusCode?: number;
          message?: string;
        };

        console.error(
          "SprintOS push send:",
          pushError
        );

        results.push({
          subscriptionId: subscription.id,
          deviceName:
            subscription.device_name ?? null,
          ok: false,
          statusCode: pushError.statusCode,
        });

        /*
         * 404 / 410:
         * Browser push subscription artık geçersiz.
         * Silmek yerine pasif yapıyoruz.
         */
        if (
          pushError.statusCode === 404 ||
          pushError.statusCode === 410
        ) {
          await admin
            .from("push_subscriptions")
            .update({
              is_active: false,
              updated_at:
                new Date().toISOString(),
            })
            .eq("id", subscription.id);
        }
      }
    }

    /*
     * 8. Test sonucunu döndür.
     */
    return NextResponse.json({
      ok: sent > 0,
      message:
        sent > 0
          ? "SprintOS test bildirimi gönderildi."
          : "Bildirim gönderilemedi.",
      sent,
      failed,
      devices: results,
    });
  } catch (error) {
    console.error(
      "SprintOS push test route:",
      error
    );

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Beklenmeyen push bildirimi hatası.",
      },
      { status: 500 }
    );
  }
}
