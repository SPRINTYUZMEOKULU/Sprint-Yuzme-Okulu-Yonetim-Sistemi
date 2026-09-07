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
    if (!local) return NextResponse.json({ ok: false, message: "Geçerli bir cep telefonu numarası giriniz." }, { status: 400 });

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return NextResponse.json({ ok: false, message: "Kimlik doğrulama servisi yapılandırılmamış." }, { status: 500 });

    const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const phone = `+90${local}`;
    const candidates = [phone, `90${local}`, `0${local}`, local];

    const { data: profile } = await admin
      .from("profiles")
      .select("id,role,is_active,phone")
      .eq("role", "guardian")
      .eq("is_active", true)
      .in("phone", candidates)
      .limit(1)
      .maybeSingle();

    if (!profile?.id) {
      return NextResponse.json({ ok: false, message: "Bu telefon numarasıyla aktif bir veli hesabı bulunamadı." }, { status: 404 });
    }

    const { data: authResult, error: authReadError } = await admin.auth.admin.getUserById(profile.id);
    if (authReadError || !authResult?.user) {
      return NextResponse.json({ ok: false, message: "Veli giriş hesabı bulunamadı. Yönetimle iletişime geçiniz." }, { status: 404 });
    }

    const currentPhone = String(authResult.user.phone || "");
    if (currentPhone !== phone) {
      const { error: updateError } = await admin.auth.admin.updateUserById(profile.id, {
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

    return NextResponse.json({ ok: true, phone });
  } catch (error) {
    console.error("GUARDIAN OTP PREPARE ERROR", error);
    return NextResponse.json({ ok: false, message: "Telefon doğrulama hazırlanırken beklenmeyen bir hata oluştu." }, { status: 500 });
  }
}
