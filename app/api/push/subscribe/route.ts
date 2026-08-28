import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

type SubscribeBody = {
  endpoint?: string;
  keys?: {
    p256dh?: string;
    auth?: string;
  };
  deviceName?: string;
};

export async function POST(request: NextRequest) {
  try {
    // 1. Oturumdaki kullanıcıyı doğrula
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

    // 2. Gelen push aboneliğini oku
    const body = (await request.json()) as SubscribeBody;

    const endpoint = body.endpoint?.trim();
    const p256dh = body.keys?.p256dh?.trim();
    const authKey = body.keys?.auth?.trim();
    const deviceName = body.deviceName?.trim() || null;

    if (!endpoint || !p256dh || !authKey) {
      return NextResponse.json(
        {
          ok: false,
          error: "Push abonelik bilgileri eksik.",
        },
        { status: 400 }
      );
    }

    // 3. Kullanıcının profilini bul
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, organization_id")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError || !profile) {
      return NextResponse.json(
        {
          ok: false,
          error: "Kullanıcı profili bulunamadı.",
        },
        { status: 404 }
      );
    }

    // 4. Service Role sadece sunucu tarafında kullanılır
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      console.error("Push subscribe: Supabase environment variables missing.");

      return NextResponse.json(
        {
          ok: false,
          error: "Sunucu yapılandırması eksik.",
        },
        { status: 500 }
      );
    }

    const admin = createAdminClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    // 5. Aynı endpoint daha önce kaydedilmiş mi?
    const { data: existing, error: existingError } = await admin
      .from("push_subscriptions")
      .select("id")
      .eq("endpoint", endpoint)
      .maybeSingle();

    if (existingError) {
      console.error(
        "Push subscribe existing subscription error:",
        existingError
      );

      return NextResponse.json(
        {
          ok: false,
          error: "Cihaz aboneliği kontrol edilemedi.",
        },
        { status: 500 }
      );
    }

    const subscriptionData = {
      organization_id: profile.organization_id,
      profile_id: profile.id,
      endpoint,
      p256dh,
      auth_key: authKey,
      device_name: deviceName,
      is_active: true,
      updated_at: new Date().toISOString(),
    };

    // 6. Varsa güncelle, yoksa yeni cihaz kaydı oluştur
    if (existing?.id) {
      const { error: updateError } = await admin
        .from("push_subscriptions")
        .update(subscriptionData)
        .eq("id", existing.id);

      if (updateError) {
        console.error("Push subscription update error:", updateError);

        return NextResponse.json(
          {
            ok: false,
            error: "Cihaz aboneliği güncellenemedi.",
          },
          { status: 500 }
        );
      }

      return NextResponse.json({
        ok: true,
        message: "Bildirim cihaz kaydı güncellendi.",
        subscriptionId: existing.id,
      });
    }

    const { data: inserted, error: insertError } = await admin
      .from("push_subscriptions")
      .insert(subscriptionData)
      .select("id")
      .single();

    if (insertError) {
      console.error("Push subscription insert error:", insertError);

      return NextResponse.json(
        {
          ok: false,
          error: "Cihaz aboneliği kaydedilemedi.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Bildirim cihaz kaydı oluşturuldu.",
      subscriptionId: inserted.id,
    });
  } catch (error) {
    console.error("Push subscribe unexpected error:", error);

    return NextResponse.json(
      {
        ok: false,
        error: "Bildirim aboneliği sırasında beklenmeyen bir hata oluştu.",
      },
      { status: 500 }
    );
  }
}
