import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = [
  "/login",
  "/on-kayit",
  "/auth/signout",
  "/yetkisiz",
];

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Supabase environment variables yoksa isteği normal devam ettir.
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error("Supabase ortam değişkenleri bulunamadı.");
    return response;
  }

  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },

        setAll(cookiesToSet) {
          /*
           * Supabase session yenilerse önce request üzerindeki
           * cookie'leri güncelliyoruz.
           */
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });

          /*
           * Güncellenmiş request ile response'u yeniden oluşturuyoruz.
           */
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });

          /*
           * Yeni session cookie'lerini browser'a gönderiyoruz.
           */
          cookiesToSet.forEach(
            ({ name, value, options }) => {
              response.cookies.set(
                name,
                value,
                options
              );
            }
          );
        },
      },
    }
  );

  /*
   * Kullanıcının Supabase oturumunu doğrula.
   * Session gerekiyorsa bu işlem sırasında yenilenebilir.
   */
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  /*
   * Herkesin erişebileceği sayfalar.
   */
  const isPublicPath = PUBLIC_PATHS.some(
    (path) =>
      pathname === path ||
      pathname.startsWith(`${path}/`)
  );

  /*
   * Ön kayıt formunun kullandığı public API yolları.
   */
  const isPublicApi =
    pathname.startsWith("/api/pre-registrations") ||
    pathname.startsWith("/api/public-registration-options");

  /*
   * =========================================================
   * OTURUM YOK
   * =========================================================
   *
   * Kullanıcı korumalı bir sayfaya gidiyorsa login'e gönder.
   *
   * Örneğin:
   *
   * /ayarlar
   *
   * =>
   *
   * /login?next=/ayarlar
   */
  if (
    !user &&
    !isPublicPath &&
    !isPublicApi
  ) {
    const loginUrl = request.nextUrl.clone();

    loginUrl.pathname = "/login";
    loginUrl.search = "";
    loginUrl.searchParams.set(
      "next",
      pathname
    );

    const redirectResponse =
      NextResponse.redirect(loginUrl);

    /*
     * Supabase bu request sırasında session cookie'sini
     * yenilediyse redirect response'a da aktar.
     */
    response.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie);
    });

    redirectResponse.headers.set(
      "Cache-Control",
      "private, no-store"
    );

    return redirectResponse;
  }

  /*
   * =========================================================
   * KULLANICI ZATEN GİRİŞ YAPMIŞ
   * =========================================================
   *
   * Giriş yapmış kullanıcı /login sayfasına giderse
   * tekrar login ekranında bırakma.
   */
  if (user && pathname === "/login") {
    const requestedNext =
      request.nextUrl.searchParams.get("next");

    const targetUrl =
      request.nextUrl.clone();

    /*
     * Sadece uygulama içindeki relative URL'lere izin veriyoruz.
     */
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

    const redirectResponse =
      NextResponse.redirect(targetUrl);

    response.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie);
    });

    redirectResponse.headers.set(
      "Cache-Control",
      "private, no-store"
    );

    return redirectResponse;
  }

  /*
   * Auth kullanan sayfaların Vercel/CDN tarafından
   * yanlış session ile cache edilmesini engelle.
   */
  response.headers.set(
    "Cache-Control",
    "private, no-store"
  );

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
