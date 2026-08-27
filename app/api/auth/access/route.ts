import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Supabase yönetici ortam değişkenleri bulunamadı.");
  }

  return createAdminClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export async function GET() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { ok: false, message: "Oturum bulunamadı." },
        { status: 401 }
      );
    }

    const admin = getAdminClient();

    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("id, organization_id, role, is_active")
      .eq("id", user.id)
      .single();

    if (profileError || !profile || !profile.is_active) {
      return NextResponse.json(
        { ok: false, message: "Aktif kullanıcı profili bulunamadı." },
        { status: 403 }
      );
    }

    if (profile.role === "owner") {
      return NextResponse.json({
        ok: true,
        role: profile.role,
        is_super_user: true,
        allowed_modules: ["*"],
      });
    }

    const { data: staff, error: staffError } = await admin
      .from("staff")
      .select("id, is_active, login_enabled, is_super_user")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (
      staffError ||
      !staff ||
      !staff.is_active ||
      !staff.login_enabled
    ) {
      return NextResponse.json(
        { ok: false, message: "Aktif personel hesabı bulunamadı." },
        { status: 403 }
      );
    }

    if (staff.is_super_user) {
      return NextResponse.json({
        ok: true,
        role: profile.role,
        is_super_user: true,
        allowed_modules: ["*"],
      });
    }

    const { data: permissions, error: permissionsError } = await admin
      .from("staff_permissions")
      .select("permission_key, is_allowed")
      .eq("staff_id", staff.id)
      .eq("is_allowed", true);

    if (permissionsError) {
      return NextResponse.json(
        { ok: false, message: "Yetkiler okunamadı." },
        { status: 500 }
      );
    }

    const permissionKeys = (permissions ?? []).map((x) =>
      String(x.permission_key)
    );

    if (!permissionKeys.length) {
      return NextResponse.json({
        ok: true,
        role: profile.role,
        is_super_user: false,
        allowed_modules: [],
      });
    }

    const { data: definitions, error: definitionsError } = await admin
      .from("permission_definitions")
      .select("permission_key, module_key")
      .in("permission_key", permissionKeys)
      .eq("is_active", true);

    if (definitionsError) {
      return NextResponse.json(
        { ok: false, message: "Yetki tanımları okunamadı." },
        { status: 500 }
      );
    }

    const allowedModules = Array.from(
      new Set(
        (definitions ?? [])
          .map((x) => String(x.module_key || ""))
          .filter(Boolean)
      )
    );

    return NextResponse.json({
      ok: true,
      role: profile.role,
      is_super_user: false,
      allowed_modules: allowedModules,
    });
  } catch (error) {
    console.error("SPRINTOS ACCESS API ERROR", error);

    return NextResponse.json(
      { ok: false, message: "Yetki bilgileri alınamadı." },
      { status: 500 }
    );
  }
}
