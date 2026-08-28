import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

type UnsubscribeBody = {
  endpoint?: string;
};

export async function POST(request: NextRequest) {
  try {
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

    const body = (await request.json()) as UnsubscribeBody;
    const endpoint = body.endpoint?.trim();

    if (!endpoint) {
      return NextResponse.json(
        {
          ok: false,
          error: "Cihaz abonelik adresi bulunamadı.",
        },
        { status: 400 }
      );
    }

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

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
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

    const { error: updateError } = await admin
      .from("push_subscriptions")
      .update({
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .eq("organization_id", profile.organization_id)
      .eq("profile_id", profile.id)
      .eq("endpoint", endpoint);

    if (updateError) {
      console.error("Push unsubscribe error:", updateError);

      return NextResponse.json(
        {
          ok: false,
          error: "Bildirim cihaz kaydı kapatılamadı.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Bu cihaz için telefon bildirimleri kapatıldı.",
    });
  } catch (error) {
    console.error("Push unsubscribe unexpected error:", error);

    return NextResponse.json(
      {
        ok: false,
        error: "Bildirim aboneliği kapatılırken beklenmeyen bir hata oluştu.",
      },
      { status: 500 }
    );
  }
}
