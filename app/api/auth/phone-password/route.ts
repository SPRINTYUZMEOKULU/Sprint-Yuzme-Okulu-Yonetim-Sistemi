import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type LoginRole = "admin" | "coach" | "guardian";

const ALLOWED_ROLES: Record<LoginRole, string[]> = {
  admin: [
    "owner",
    "admin",
    "branch_manager",
    "registration_staff",
    "accounting",
  ],
  coach: ["coach"],
  guardian: ["guardian"],
};

function getEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const publicKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL bulunamadı.");
  }

  if (!serviceRole) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY bulunamadı.");
  }

  if (!publicKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_ANON_KEY veya NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY bulunamadı."
    );
  }

  return { url, serviceRole, publicKey };
}

function normalizeLocalPhone(value: unknown) {
  let digits = String(value ?? "").replace(/\D/g, "");

  if (!digits) return "";

  if (digits.startsWith("0090")) {
    digits = digits.slice(4);
  }

  if (digits.startsWith("90") && digits.length === 12) {
    digits = digits.slice(2);
  }

  if (digits.startsWith("0") && digits.length === 11) {
    digits = digits.slice(1);
  }

  if (digits.length !== 10 || !digits.startsWith("5")) {
    return "";
  }

  return digits;
}

function phoneCandidates(local: string) {
  return [
    `+90${local}`,
    `90${local}`,
    `0${local}`,
    local,
  ];
}

function safeRole(value: unknown): LoginRole | null {
  if (value === "admin" || value === "coach" || value === "guardian") {
    return value;
  }

  return null;
}

async function logAttempt(
  admin: ReturnType<typeof createClient>,
  input: {
    organizationId?: string | null;
    profileId?: string | null;
    staffId?: string | null;
    success: boolean;
    description: string;
  }
) {
  if (!input.organizationId) return;

  try {
    await admin.from("audit_logs").insert({
      organization_id: input.organizationId,
      actor_profile_id: input.profileId ?? null,
      actor_staff_id: input.staffId ?? null,
      module_key: "auth",
      action_key: input.success ? "login.success" : "login.failed",
      action_label: input.success
        ? "Başarılı Personel Girişi"
        : "Başarısız Personel Girişi",
      entity_id: input.profileId ?? null,
      description: input.description,
      success: input.success,
      created_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error("SPRINTOS LOGIN AUDIT ERROR", error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const localPhone = normalizeLocalPhone(body?.phone);
    const password = String(body?.password ?? "");
    const requestedRole = safeRole(body?.role);

    if (!localPhone || password.length < 1 || !requestedRole) {
      return NextResponse.json(
        {
          ok: false,
          message: "Telefon numarası veya şifre hatalı.",
        },
        { status: 400 }
      );
    }

    const { url, serviceRole, publicKey } = getEnv();

    /*
     * Service Role SADECE server tarafında kullanılır.
     * Tarayıcıya hiçbir zaman gönderilmez.
     */
    const admin = createClient(url, serviceRole, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const candidates = phoneCandidates(localPhone);

    /*
     * Kullanıcıyı önce profiles, sonra staff üzerinden buluyoruz.
     * Böylece public tarafta telefon -> Auth ID eşlemesi açılmıyor.
     */
    let authUserId: string | null = null;

    const { data: profileByPhone } = await admin
      .from("profiles")
      .select("id")
      .in("phone", candidates)
      .limit(1)
      .maybeSingle();

    if (profileByPhone?.id) {
      authUserId = profileByPhone.id;
    }

    if (!authUserId) {
      const { data: staffByPhone } = await admin
        .from("staff")
        .select("auth_user_id")
        .in("phone", candidates)
        .not("auth_user_id", "is", null)
        .limit(1)
        .maybeSingle();

      if (staffByPhone?.auth_user_id) {
        authUserId = staffByPhone.auth_user_id;
      }
    }

    /*
     * Kullanıcı var/yok bilgisini dışarı sızdırmamak için
     * aynı genel hata mesajını döndürüyoruz.
     */
    if (!authUserId) {
      return NextResponse.json(
        {
          ok: false,
          message: "Telefon numarası veya şifre hatalı.",
        },
        { status: 401 }
      );
    }

    const {
      data: { user: authUser },
      error: authUserError,
    } = await admin.auth.admin.getUserById(authUserId);

    if (authUserError || !authUser) {
      return NextResponse.json(
        {
          ok: false,
          message: "Telefon numarası veya şifre hatalı.",
        },
        { status: 401 }
      );
    }

    /*
     * Phone Provider / Twilio kullanmıyoruz.
     *
     * Supabase Auth şifre doğrulamasını yine kendisi yapıyor;
     * sadece telefonla giriş yapmak isteyen phone-only kullanıcıya
     * server tarafında dahili bir e-posta kimliği ekliyoruz.
     *
     * Şifreyi veritabanından okumuyoruz, karşılaştırmıyoruz,
     * hash'e müdahale etmiyoruz.
     */
    let loginEmail = authUser.email ?? "";

    if (!loginEmail) {
      loginEmail = `phone.${localPhone}@login.sprintos.local`;

      const { data: updatedUser, error: updateError } =
        await admin.auth.admin.updateUserById(authUserId, {
          email: loginEmail,
          email_confirm: true,
          user_metadata: {
            ...(authUser.user_metadata || {}),
            sprintos_phone_login: true,
          },
        });

      if (updateError || !updatedUser.user?.email) {
        console.error("SPRINTOS INTERNAL EMAIL CREATE ERROR", updateError);

        return NextResponse.json(
          {
            ok: false,
            message:
              "Telefonla giriş hesabı hazırlanamadı. Yöneticiyle iletişime geçin.",
          },
          { status: 500 }
        );
      }

      loginEmail = updatedUser.user.email;
    }

    /*
     * Şifre doğrulaması PUBLIC Supabase Auth istemcisiyle yapılır.
     * Service Role ile kullanıcıyı şifresiz içeri almıyoruz.
     */
    const authClient = createClient(url, publicKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { data: signInData, error: signInError } =
      await authClient.auth.signInWithPassword({
        email: loginEmail,
        password,
      });

    if (signInError || !signInData.user || !signInData.session) {
      console.error("SPRINTOS PHONE PASSWORD VERIFY ERROR", {
        userId: authUserId,
        message: signInError?.message,
        code: signInError?.code,
        status: signInError?.status,
      });

      return NextResponse.json(
        {
          ok: false,
          message: "Telefon numarası veya şifre hatalı.",
        },
        { status: 401 }
      );
    }

    /*
     * Giriş başarılı olduktan sonra profil, rol ve personel izinleri kontrol edilir.
     */
    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("id, organization_id, role, is_active")
      .eq("id", signInData.user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        {
          ok: false,
          message: "Kullanıcı profili bulunamadı.",
        },
        { status: 403 }
      );
    }

    if (!profile.is_active) {
      await logAttempt(admin, {
        organizationId: profile.organization_id,
        profileId: profile.id,
        success: false,
        description: "Pasif profil ile giriş denemesi.",
      });

      return NextResponse.json(
        {
          ok: false,
          message: "Hesabınız pasif durumda.",
        },
        { status: 403 }
      );
    }

    if (!ALLOWED_ROLES[requestedRole].includes(String(profile.role))) {
      await logAttempt(admin, {
        organizationId: profile.organization_id,
        profileId: profile.id,
        success: false,
        description: `Yanlış giriş türü seçildi. İstenen giriş: ${requestedRole}.`,
      });

      return NextResponse.json(
        {
          ok: false,
          message: "Bu hesap seçilen giriş türüne yetkili değil.",
        },
        { status: 403 }
      );
    }

    let staffId: string | null = null;

    if (profile.role !== "guardian") {
      const { data: staffAccount, error: staffError } = await admin
        .from("staff")
        .select("id, login_enabled, is_active")
        .eq("auth_user_id", signInData.user.id)
        .maybeSingle();

      if (staffError) {
        console.error("SPRINTOS STAFF LOGIN CHECK ERROR", staffError);

        return NextResponse.json(
          {
            ok: false,
            message: "Personel giriş bilgileri kontrol edilemedi.",
          },
          { status: 500 }
        );
      }

      if (!staffAccount) {
        return NextResponse.json(
          {
            ok: false,
            message: "Personel hesabı bulunamadı.",
          },
          { status: 403 }
        );
      }

      staffId = staffAccount.id;

      if (!staffAccount.is_active) {
        await logAttempt(admin, {
          organizationId: profile.organization_id,
          profileId: profile.id,
          staffId,
          success: false,
          description: "Pasif personel hesabı ile giriş denemesi.",
        });

        return NextResponse.json(
          {
            ok: false,
            message: "Personel hesabınız pasif durumda.",
          },
          { status: 403 }
        );
      }

      if (!staffAccount.login_enabled) {
        await logAttempt(admin, {
          organizationId: profile.organization_id,
          profileId: profile.id,
          staffId,
          success: false,
          description: "Giriş izni kapalı personel hesabı ile giriş denemesi.",
        });

        return NextResponse.json(
          {
            ok: false,
            message: "Bu hesap için sisteme giriş izni kapalı.",
          },
          { status: 403 }
        );
      }
    }

    const now = new Date().toISOString();

    await admin
      .from("profiles")
      .update({ last_sign_in_at: now })
      .eq("id", profile.id);

    await logAttempt(admin, {
      organizationId: profile.organization_id,
      profileId: profile.id,
      staffId,
      success: true,
      description: "SprintOS telefon + şifre ile başarılı giriş.",
    });

    /*
     * Tarayıcıya yalnızca bu kullanıcının normal Auth session tokenlarını döndürürüz.
     * SERVICE ROLE KEY kesinlikle dönmez.
     */
    return NextResponse.json({
      ok: true,
      access_token: signInData.session.access_token,
      refresh_token: signInData.session.refresh_token,
      user_id: signInData.user.id,
      role: profile.role,
    });
  } catch (error) {
    console.error("SPRINTOS PHONE LOGIN ROUTE ERROR", error);

    return NextResponse.json(
      {
        ok: false,
        message: "Giriş sırasında beklenmeyen bir hata oluştu.",
      },
      { status: 500 }
    );
  }
}
