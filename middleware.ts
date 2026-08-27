import { createServerClient } from "@supabase/ssr";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = [
  "/login",
  "/on-kayit",
  "/auth/signout",
  "/yetkisiz",
];

const ROUTE_MODULES: Array<{ path: string; moduleKey: string }> = [
  { path: "/on-kayitlar", moduleKey: "preregistration" },
  { path: "/ogrenciler", moduleKey: "students" },
  { path: "/subeler", moduleKey: "branches" },
  { path: "/gruplar", moduleKey: "groups" },
  { path: "/ders-programi", moduleKey: "schedule" },
  { path: "/operasyon-plani", moduleKey: "operations" },
  { path: "/yoklama", moduleKey: "attendance" },
  { path: "/odemeler", moduleKey: "finance" },
  { path: "/kasa", moduleKey: "finance" },
  { path: "/raporlar", moduleKey: "reports" },
  { path: "/kullanicilar-ve-yetkiler", moduleKey: "permissions" },

  // Henüz ayrı permission_definitions modülü olmayan yönetim ekranlarını
  // en yakın merkezi yetki grubuna bağlıyoruz.
  { path: "/paketler", moduleKey: "finance" },
  { path: "/hazir-mesajlar", moduleKey: "dashboard" },
  { path: "/uyarilar", moduleKey: "dashboard" },
  { path: "/onay-merkezi", moduleKey: "permissions" },
  { path: "/ayarlar", moduleKey: "permissions" },
];

function pathMatches(pathname: string, route: string) {
  return pathname === route || pathname.startsWith(`${route}/`);
}

function requiredModuleFor(pathname: string) {
  if (pathname === "/") return "dashboard";
  return ROUTE_MODULES.find((item) => pathMatches(pathname, item.path))?.moduleKey ?? null;
}

function copyCookies(from: NextResponse, to: NextResponse) {
  from.cookies.getAll().forEach((cookie) => {
    to.cookies.set(cookie);
  });
  return to;
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const pathname = request.nextUrl.pathname;

  const isPublicApi =
    pathname.startsWith("/api/auth/phone-password") ||
    pathname.startsWith("/api/pre-registrations") ||
    pathname.startsWith("/api/public-registration-options");

  if (isPublicApi) {
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error("Supabase ortam değişkenleri bulunamadı.");
    return response;
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });

        response = NextResponse.next({
          request: {
            headers: request.headers,
          },
        });

        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isPublicPath = PUBLIC_PATHS.some((path) => pathMatches(pathname, path));

  if (!user && !isPublicPath) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    loginUrl.searchParams.set("next", pathname);

    const redirectResponse = NextResponse.redirect(loginUrl);
    copyCookies(response, redirectResponse);
    redirectResponse.headers.set("Cache-Control", "private, no-store");
    return redirectResponse;
  }

  if (user && pathname === "/login") {
    const requestedNext = request.nextUrl.searchParams.get("next");
    const targetUrl = request.nextUrl.clone();

    if (
      requestedNext &&
      requestedNext.startsWith("/") &&
      !requestedNext.startsWith("//")
    ) {
      targetUrl.pathname = requestedNext;
    } else {
      targetUrl.pathname = "/";
    }

    targetUrl.search = "";

    const redirectResponse = NextResponse.redirect(targetUrl);
    copyCookies(response, redirectResponse);
    redirectResponse.headers.set("Cache-Control", "private, no-store");
    return redirectResponse;
  }

  /*
   * Public sayfalar burada biter.
   * /yetkisiz ve /auth/signout yetki kontrolüne girmez.
   */
  if (!user || isPublicPath) {
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  }

  /*
   * API route'larını sayfa modül yetkisine göre engellemiyoruz.
   * API'lerin kendi server-side kontrolleri çalışmaya devam eder.
   */
  if (pathname.startsWith("/api/")) {
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  }

  const requiredModule = requiredModuleFor(pathname);

  /*
   * Henüz ROUTE_MODULES içinde tanımlanmamış sayfalarda mevcut davranışı koru.
   */
  if (!requiredModule) {
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceRoleKey) {
    console.error("SUPABASE_SERVICE_ROLE_KEY bulunamadı.");
    const deniedUrl = request.nextUrl.clone();
    deniedUrl.pathname = "/yetkisiz";
    deniedUrl.search = "";
    const denied = NextResponse.redirect(deniedUrl);
    copyCookies(response, denied);
    return denied;
  }

  const admin = createAdminClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id, role, is_active")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile || !profile.is_active) {
    const deniedUrl = request.nextUrl.clone();
    deniedUrl.pathname = "/yetkisiz";
    deniedUrl.search = "";
    const denied = NextResponse.redirect(deniedUrl);
    copyCookies(response, denied);
    return denied;
  }

  /*
   * Sistem Sahibi tüm modüllere erişir.
   */
  if (String(profile.role) === "owner") {
    response.headers.set("Cache-Control", "private, no-store");
    return response;
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
    const deniedUrl = request.nextUrl.clone();
    deniedUrl.pathname = "/yetkisiz";
    deniedUrl.search = "";
    const denied = NextResponse.redirect(deniedUrl);
    copyCookies(response, denied);
    return denied;
  }

  /*
   * Süper kullanıcı tüm modüllere erişir.
   */
  if (staff.is_super_user) {
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  }

  const { data: permissions, error: permissionsError } = await admin
    .from("staff_permissions")
    .select("permission_key, is_allowed")
    .eq("staff_id", staff.id)
    .eq("is_allowed", true);

  if (permissionsError) {
    console.error("SPRINTOS MIDDLEWARE PERMISSIONS ERROR", permissionsError);
    const deniedUrl = request.nextUrl.clone();
    deniedUrl.pathname = "/yetkisiz";
    deniedUrl.search = "";
    const denied = NextResponse.redirect(deniedUrl);
    copyCookies(response, denied);
    return denied;
  }

  const permissionKeys = (permissions ?? []).map((item) =>
    String(item.permission_key)
  );

  let allowedModules: string[] = [];

  if (permissionKeys.length) {
    const { data: definitions, error: definitionsError } = await admin
      .from("permission_definitions")
      .select("module_key")
      .in("permission_key", permissionKeys)
      .eq("is_active", true);

    if (definitionsError) {
      console.error(
        "SPRINTOS MIDDLEWARE PERMISSION DEFINITIONS ERROR",
        definitionsError
      );
    } else {
      allowedModules = Array.from(
        new Set(
          (definitions ?? [])
            .map((item) => String(item.module_key || ""))
            .filter(Boolean)
        )
      );
    }
  }

  if (!allowedModules.includes(requiredModule)) {
    const deniedUrl = request.nextUrl.clone();
    deniedUrl.pathname = "/yetkisiz";
    deniedUrl.search = "";
    deniedUrl.searchParams.set("from", pathname);

    const denied = NextResponse.redirect(deniedUrl);
    copyCookies(response, denied);
    denied.headers.set("Cache-Control", "private, no-store");
    return denied;
  }

  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|icons/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
