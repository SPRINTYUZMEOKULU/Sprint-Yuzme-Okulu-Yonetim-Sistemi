import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normalizeLocalPhone(value: unknown) {
  let digits = String(value ?? "").replace(/\D/g, "");
  if (digits.startsWith("0090")) digits = digits.slice(4);
  if (digits.startsWith("90") && digits.length === 12) digits = digits.slice(2);
  if (digits.startsWith("0") && digits.length === 11) digits = digits.slice(1);
  if (digits.length !== 10 || !digits.startsWith("5")) return "";
  return digits;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const local = normalizeLocalPhone(body?.phone);
    if (!local) {
      return NextResponse.json({ ok: false, message: "Geçerli bir cep telefonu numarası giriniz." }, { status: 400 });
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      return NextResponse.json({ ok: false, message: "Kimlik doğrulama servisi yapılandırılmamış." }, { status: 500 });
    }

    const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const phone = `+90${local}`;
    const candidates = [phone, `90${local}`, `0${local}`, local];

    // Yeni veri modelinde portal ilişkisi guardians -> auth_user_id -> profiles/auth.users şeklindedir.
    const { data: guardian, error: guardianError } = await admin
      .from("guardians")
      .select("id,auth_user_id,phone,is_active,login_enabled")
      .in("phone", candidates)
      .eq("is_active", true)
      .eq("login_enabled", true)
      .limit(1)
      .maybeSingle();

    if (guardianError) {
      console.error("GUARDIAN OTP GUARDIAN LOOKUP ERROR", guardianError);
      return NextResponse.json({ ok: false, message: "Veli hesabı kontrol edilirken bir hata oluştu." }, { status: 500 });
    }

    let authUserId = guardian?.auth_user_id || "";

    // Eski kayıtlar için profiles tablosundan geriye dönük uyumluluk.
    if (!authUserId) {
      const { data: legacyProfile, error: legacyError } = await admin
        .from("profiles")
        .select("id,role,is_active,phone")
        .eq("role", "guardian")
        .eq("is_active", true)
        .in("phone", candidates)
        .limit(1)
        .maybeSingle();

      if (legacyError) {
        console.error("GUARDIAN OTP LEGACY PROFILE LOOKUP ERROR", legacyError);
        return NextResponse.json({ ok: false, message: "Veli hesabı kontrol edilirken bir hata oluştu." }, { status: 500 });
      }
      authUserId = legacyProfile?.id || "";
    }

    if (!authUserId) {
      return NextResponse.json({ ok: false, message: "Bu telefon numarasıyla aktif bir portal hesabı bulunamadı." }, { status: 404 });
    }

    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("id,role,is_active,phone")
      .eq("id", authUserId)
      .maybeSingle();

    if (profileError || !profile || profile.role !== "guardian" || profile.is_active === false) {
      return NextResponse.json({ ok: false, message: "Portal profili aktif değil veya bulunamadı." }, { status: 404 });
    }

    const { data: authResult, error: authReadError } = await admin.auth.admin.getUserById(authUserId);
    if (authReadError || !authResult?.user) {
      return NextResponse.json({ ok: false, message: "Telefon giriş hesabı bulunamadı. Yönetimle iletişime geçiniz." }, { status: 404 });
    }

    const currentPhone = String(authResult.user.phone || "");
    if (currentPhone !== phone) {
      const { error: updateError } = await admin.auth.admin.updateUserById(authUserId, {
        phone,
        phone_confirm: true,
        user_metadata: {
          ...(authResult.user.user_metadata || {}),
          role: "guardian",
          sprintos_phone_otp: true,
        },
      });
      if (updateError) {
        console.error("GUARDIAN OTP PHONE SYNC ERROR", updateError);
        return NextResponse.json({ ok: false, message: "Telefon doğrulama hesabı hazırlanamadı." }, { status: 500 });
      }
    }

    if (profile.phone !== phone) {
      await admin.from("profiles").update({ phone, updated_at: new Date().toISOString() }).eq("id", authUserId);
    }

    if (guardian?.id && guardian.phone !== phone) {
      await admin.from("guardians").update({ phone, updated_at: new Date().toISOString() }).eq("id", guardian.id);
    }

    return NextResponse.json({ ok: true, phone, user_id: authUserId });
  } catch (error) {
    console.error("GUARDIAN OTP PREPARE ERROR", error);
    return NextResponse.json({ ok: false, message: "Telefon doğrulama hazırlanırken beklenmeyen bir hata oluştu." }, { status: 500 });
  }
}
