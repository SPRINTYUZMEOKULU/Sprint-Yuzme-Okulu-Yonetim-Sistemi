import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = [
  "/login",
  "/on-kayit",
  "/auth/signout",
  "/yetkisiz",
];

function copyCookies(
  source: NextResponse,
  target: NextResponse
) {
  source.cookies.getAll().forEach((cookie) => {
    target.cookies.set(cookie);
  });

  return target;
}

export default async function proxy(
  request: NextRequest
) {
  let response = NextResponse.next({
    request,
  });

  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  /*
   * Ortam değişkenleri yoksa
   * uygulamayı burada tamamen kilitlemiyoruz.
   */
  if (
    !supabaseUrl ||
    !supabaseAnonKey
  ) {
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
           * Yenilenen auth cookie'lerini
           * aynı request'e de işliyoruz.
           */
          cookiesToSet.forEach(
            ({
              name,
              value,
            }) => {
              request.cookies.set(
                name,
                value
              );
            }
          );

          /*
           * Güncellenmiş request ile
           * yeni response oluşturuyoruz.
           */
          response =
            NextResponse.next({
              request,
            });

          /*
           * Browser'a geri gönderilecek
           * auth cookie'lerini response'a ekliyoruz.
           */
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

  /*
   * Kullanıcıyı server tarafında doğrula.
   * Supabase gerektiğinde token'ı burada yenileyebilir.
   */
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  const pathname =
    request.nextUrl.pathname;

  const isPublicPath =
    PUBLIC_PATHS.some(
      (path) =>
        pathname === path ||
        pathname.startsWith(
          `${path}/`
        )
    );

  const isPublicApi =
    pathname.startsWith(
      "/api/pre-registrations"
    ) ||
    pathname.startsWith(
      "/api/public-registration-options"
    );

  /*
   * Giriş yapılmamış kullanıcı:
   * sadece korumalı sayfalarda login'e gönderilir.
   */
  if (
    (!user || userError) &&
    !isPublicPath &&
    !isPublicApi
  ) {
    const loginUrl =
      request.nextUrl.clone();

    loginUrl.pathname =
      "/login";

    loginUrl.search = "";

    loginUrl.searchParams.set(
      "next",
      pathname
    );

    const redirectResponse =
      NextResponse.redirect(
        loginUrl
      );

    return copyCookies(
      response,
      redirectResponse
    );
  }

  /*
   * Kullanıcı zaten giriş yaptıysa
   * /login sayfasına dönmesine gerek yok.
   */
  if (
    user &&
    pathname === "/login"
  ) {
    const rawNext =
      request.nextUrl.searchParams.get(
        "next"
      );

    const safeNext =
      rawNext &&
      rawNext.startsWith("/") &&
      !rawNext.startsWith("//")
        ? rawNext
        : "/";

    const targetUrl =
      request.nextUrl.clone();

    targetUrl.pathname =
      safeNext;

    targetUrl.search = "";

    const redirectResponse =
      NextResponse.redirect(
        targetUrl
      );

    return copyCookies(
      response,
      redirectResponse
    );
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
