import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = [
  "/login",
  "/on-kayit",
  "/auth/signout",
  "/yetkisiz",
];

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return supabaseResponse;
  }

  const supabase = createServerClient(
    url,
    anonKey,
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

          supabaseResponse =
            NextResponse.next({
              request,
            });

          cookiesToSet.forEach(
            ({
              name,
              value,
              options,
            }) => {
              supabaseResponse.cookies.set(
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
   * ÖNEMLİ:
   * Bu çağrı session/token yenilemesini tetikleyebilir.
   * Bundan önce auth ile ilgili başka işlem yapmayın.
   */
  const {
    data: { user },
  } =
    await supabase.auth.getUser();

  const pathname =
    request.nextUrl.pathname;

  const isPublic =
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
   * OTURUM YOKSA
   */
  if (
    !user &&
    !isPublic &&
    !isPublicApi
  ) {
    const loginUrl =
      request.nextUrl.clone();

    loginUrl.pathname = "/login";

    loginUrl.searchParams.set(
      "next",
      pathname
    );

    const redirectResponse =
      NextResponse.redirect(
        loginUrl
      );

    /*
     * Supabase token yenilediyse
     * oluşan cookie'leri redirect
     * response'una da taşı.
     */
    supabaseResponse.cookies
      .getAll()
      .forEach((cookie) => {
        redirectResponse.cookies.set(
          cookie
        );
      });

    return redirectResponse;
  }

  /*
   * ZATEN GİRİŞ YAPMIŞ KULLANICI
   * /login'e gelirse ana panele dönsün.
   */
  if (
    user &&
    pathname === "/login"
  ) {
    const homeUrl =
      request.nextUrl.clone();

    homeUrl.pathname = "/";
    homeUrl.search = "";

    const redirectResponse =
      NextResponse.redirect(
        homeUrl
      );

    supabaseResponse.cookies
      .getAll()
      .forEach((cookie) => {
        redirectResponse.cookies.set(
          cookie
        );
      });

    return redirectResponse;
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
