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

  const pathname = request.nextUrl.pathname;

  /*
   * PUBLIC API
   *
   * Telefon + şifre giriş endpoint'i burada özellikle public olmalı.
   * Kullanıcı henüz oturum açmadan bu endpoint'e POST gönderiyor.
   */
  const isPublicApi =
    pathname.startsWith("/api/auth/phone-password") ||
    pathname.startsWith("/api/pre-registrations") ||
    pathname.startsWith("/api/public-registration-options");

  /*
   * Public API isteklerini Supabase oturum kontrolüne sokma.
   *
   * Özellikle:
   * POST /api/auth/phone-password
   *
   * /login sayfasına redirect edilmemeli.
   */
  if (isPublicApi) {
    response.headers.set(
      "Cache-Control",
      "private, no-store"
    );

    return response;
  }

  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Environment variables yoksa isteği normal devam ettir.
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error(
      "Supabase ortam değişkenleri bulunamadı."
    );

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
          cookiesToSet.forEach(
            ({ name, value }) => {
              request.cookies.set(
                name,
                value
              );
            }
          );

          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });

          cookiesToSet.forEach(
            ({
              name,
              value,
              options,
            }) => {
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

  // Kullanıcının Supabase oturumunu doğrula.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  /*
   * PUBLIC SAYFALAR
   */
  const isPublicPath =
    PUBLIC_PATHS.some(
      (path) =>
        pathname === path ||
        pathname.startsWith(
          `${path}/`
        )
    );

  /*
   * OTURUM YOKSA
   */
  if (
    !user &&
    !isPublicPath
  ) {
    const loginUrl =
      request.nextUrl.clone();

    loginUrl.pathname = "/login";

    loginUrl.search = "";

    loginUrl.searchParams.set(
      "next",
      pathname
    );

    const redirectResponse =
      NextResponse.redirect(
        loginUrl
      );

    response.cookies
      .getAll()
      .forEach((cookie) => {
        redirectResponse.cookies.set(
          cookie
        );
      });

    redirectResponse.headers.set(
      "Cache-Control",
      "private, no-store"
    );

    return redirectResponse;
  }

  /*
   * KULLANICI ZATEN GİRİŞ YAPMIŞSA
   * /login sayfasında bırakma.
   */
  if (
    user &&
    pathname === "/login"
  ) {
    const requestedNext =
      request.nextUrl.searchParams.get(
        "next"
      );

    const targetUrl =
      request.nextUrl.clone();

    if (
      requestedNext &&
      requestedNext.startsWith("/") &&
      !requestedNext.startsWith("//")
    ) {
      targetUrl.pathname =
        requestedNext;
    } else {
      targetUrl.pathname = "/";
    }

    targetUrl.search = "";

    const redirectResponse =
      NextResponse.redirect(
        targetUrl
      );

    response.cookies
      .getAll()
      .forEach((cookie) => {
        redirectResponse.cookies.set(
          cookie
        );
      });

    redirectResponse.headers.set(
      "Cache-Control",
      "private, no-store"
    );

    return redirectResponse;
  }

  response.headers.set(
    "Cache-Control",
    "private, no-store"
  );

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|icons/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
