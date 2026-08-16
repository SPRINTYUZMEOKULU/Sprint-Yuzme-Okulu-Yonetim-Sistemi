"use client";

import { FormEvent, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";

type LoginRole = "admin" | "coach" | "guardian";
type LoginMethod = "email" | "phone";

const roles: Array<{
  value: LoginRole;
  label: string;
  icon: "crown" | "coach" | "family";
}> = [
  {
    value: "admin",
    label: "Yönetici Girişi",
    icon: "crown",
  },
  {
    value: "coach",
    label: "Eğitmen Girişi",
    icon: "coach",
  },
  {
    value: "guardian",
    label: "Veli Girişi",
    icon: "family",
  },
];

const allowedRoles: Record<LoginRole, string[]> = {
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

function Icon({
  name,
}: {
  name:
    | "crown"
    | "coach"
    | "family"
    | "mail"
    | "phone"
    | "lock"
    | "eye"
    | "eyeOff";
}) {
  const common = {
    width: 22,
    height: 22,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  if (name === "crown") {
    return (
      <svg {...common}>
        <path d="m2 7 4 3 6-7 6 7 4-3-2 11H4L2 7Z" />
        <path d="M5 21h14" />
      </svg>
    );
  }

  if (name === "coach") {
    return (
      <svg {...common}>
        <circle cx="12" cy="7" r="4" />
        <path d="M5.5 21a6.5 6.5 0 0 1 13 0" />
        <path d="M19 7h3M20.5 5.5v3" />
      </svg>
    );
  }

  if (name === "family") {
    return (
      <svg {...common}>
        <circle cx="12" cy="7" r="3" />
        <circle cx="5" cy="9" r="2" />
        <circle cx="19" cy="9" r="2" />
        <path d="M7 21v-2a5 5 0 0 1 10 0v2" />
        <path d="M1 21v-1a4 4 0 0 1 5-4" />
        <path d="M23 21v-1a4 4 0 0 0-5-4" />
      </svg>
    );
  }

  if (name === "mail") {
    return (
      <svg {...common}>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="m3 7 9 6 9-6" />
      </svg>
    );
  }

  if (name === "phone") {
    return (
      <svg {...common}>
        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.69 2.8a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.28-1.28a2 2 0 0 1 2.11-.45c.9.33 1.84.56 2.8.69A2 2 0 0 1 22 16.92Z" />
      </svg>
    );
  }

  if (name === "lock") {
    return (
      <svg {...common}>
        <rect x="4" y="10" width="16" height="11" rx="2" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3" />
      </svg>
    );
  }

  if (name === "eyeOff") {
    return (
      <svg {...common}>
        <path d="m3 3 18 18" />
        <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
        <path d="M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 10 8 10 8a15.6 15.6 0 0 1-2.1 3.2" />
        <path d="M6.6 6.6C3.8 8.4 2 12 2 12s3 8 10 8a10.9 10.9 0 0 0 5.4-1.4" />
      </svg>
    );
  }

  return (
    <svg {...common}>
      <path d="M2 12s3-8 10-8 10 8 10 8-3 8-10 8S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export default function LoginForm() {
  const searchParams = useSearchParams();

  const [role, setRole] =
    useState<LoginRole>("admin");

  const [method, setMethod] =
    useState<LoginMethod>("email");

  const [showPassword, setShowPassword] =
    useState(false);

  const [rememberMe, setRememberMe] =
    useState(true);

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  const activeRole = useMemo(
    () =>
      roles.find(
        (item) => item.value === role
      )!,
    [role]
  );

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setLoading(true);
    setError("");

    const form =
      new FormData(
        event.currentTarget
      );

    const identifier =
      String(
        form.get("identifier") || ""
      ).trim();

    const password =
      String(
        form.get("password") || ""
      );

    if (!identifier || !password) {
      setError(
        "Lütfen giriş bilgilerinizi eksiksiz yazın."
      );
      setLoading(false);
      return;
    }

    const supabase =
      createClient();

    const credentials =
      method === "email"
        ? {
            email: identifier,
            password,
          }
        : {
            phone:
              identifier.replace(
                /\s/g,
                ""
              ),
            password,
          };

    const {
      data,
      error: signInError,
    } =
      await supabase.auth.signInWithPassword(
        credentials
      );

    if (
      signInError ||
      !data.user
    ) {
      setError(
        method === "email"
          ? "E-posta veya şifre hatalı. Bilgilerinizi kontrol edin."
          : "Telefon numarası veya şifre hatalı. Numaranızı ülke koduyla yazın."
      );

      setLoading(false);
      return;
    }

    const {
      data: profile,
      error: profileError,
    } =
      await supabase
        .from("profiles")
        .select("role")
        .eq(
          "id",
          data.user.id
        )
        .single();

    if (
      profileError ||
      !profile
    ) {
      await supabase.auth.signOut();

      setError(
        "Kullanıcı profiliniz bulunamadı. Yöneticiyle iletişime geçin."
      );

      setLoading(false);
      return;
    }

    if (
      !allowedRoles[
        role
      ].includes(
        profile.role
      )
    ) {
      await supabase.auth.signOut();

      setError(
        `Bu hesap ${activeRole.label.toLocaleLowerCase(
          "tr-TR"
        )} yetkisine sahip değil.`
      );

      setLoading(false);
      return;
    }

    if (!rememberMe) {
      sessionStorage.setItem(
        "sprintos-session-only",
        "true"
      );
    } else {
      sessionStorage.removeItem(
        "sprintos-session-only"
      );
    }

    const {
      data: {
        session,
      },
      error:
        sessionError,
    } =
      await supabase.auth.getSession();

    if (
      sessionError ||
      !session
    ) {
      setError(
        "Oturum oluşturulamadı. Lütfen tekrar giriş yapın."
      );

      setLoading(false);
      return;
    }

    const rawNext =
      searchParams.get("next");

    const fallback =
      role === "guardian"
        ? "/veli-paneli"
        : "/";

    /*
     * Güvenlik:
     * Sadece site içindeki
     * göreli yönlendirmelere izin veriyoruz.
     */
    const next =
      rawNext &&
      rawNext.startsWith("/") &&
      !rawNext.startsWith("//")
        ? rawNext
        : fallback;

    /*
     * Client-side router yerine
     * tam sayfa geçişi kullanıyoruz.
     * Böylece Supabase session cookie'si
     * sonraki server isteğinde okunur.
     */
    window.location.assign(
      next
    );
  }

  return (
    <div>
      <div
        className="v2RoleTabs"
        role="tablist"
        aria-label="Giriş türü"
      >
        {roles.map(
          (item) => (
            <button
              key={
                item.value
              }
              type="button"
              role="tab"
              aria-selected={
                role ===
                item.value
              }
              className={
                role ===
                item.value
                  ? "v2RoleTab active"
                  : "v2RoleTab"
              }
              onClick={() => {
                setRole(
                  item.value
                );
                setError("");
              }}
            >
              <Icon
                name={
                  item.icon
                }
              />

              <span>
                {
                  item.label
                }
              </span>
            </button>
          )
        )}
      </div>

      <form
        className="v2LoginForm"
        onSubmit={
          handleSubmit
        }
      >
        <div className="v2MethodTabs">
          <button
            type="button"
            className={
              method ===
              "email"
                ? "active"
                : ""
            }
            onClick={() => {
              setMethod(
                "email"
              );
              setError("");
            }}
          >
            <Icon name="mail" />
            E-posta ile giriş
          </button>

          <button
            type="button"
            className={
              method ===
              "phone"
                ? "active"
                : ""
            }
            onClick={() => {
              setMethod(
                "phone"
              );
              setError("");
            }}
          >
            <Icon name="phone" />
            Telefon ile giriş
          </button>
        </div>

        <label className="v2Field">
          <span>
            {method ===
            "email"
              ? "E-posta adresi"
              : "Telefon numarası"}
          </span>

          <div className="v2InputWrap">
            <Icon
              name={
                method ===
                "email"
                  ? "mail"
                  : "phone"
              }
            />

            <input
              name="identifier"
              type={
                method ===
                "email"
                  ? "email"
                  : "tel"
              }
              autoComplete={
                method ===
                "email"
                  ? "email"
                  : "tel"
              }
              required
              placeholder={
                method ===
                "email"
                  ? "E-posta adresinizi giriniz"
                  : "+90 5XX XXX XX XX"
              }
            />
          </div>
        </label>

        <label className="v2Field">
          <span>
            Şifre
          </span>

          <div className="v2InputWrap">
            <Icon name="lock" />

            <input
              name="password"
              type={
                showPassword
                  ? "text"
                  : "password"
              }
              autoComplete="current-password"
              required
              placeholder="Şifrenizi giriniz"
            />

            <button
              type="button"
              className="v2PasswordToggle"
              aria-label={
                showPassword
                  ? "Şifreyi gizle"
                  : "Şifreyi göster"
              }
              onClick={() =>
                setShowPassword(
                  (
                    current
                  ) =>
                    !current
                )
              }
            >
              <Icon
                name={
                  showPassword
                    ? "eyeOff"
                    : "eye"
                }
              />
            </button>
          </div>
        </label>

        <div className="v2LoginOptions">
          <label className="v2Remember">
            <input
              type="checkbox"
              checked={
                rememberMe
              }
              onChange={(
                event
              ) =>
                setRememberMe(
                  event.target
                    .checked
                )
              }
            />

            <span>
              Beni hatırla
            </span>
          </label>

          <a href="mailto:sprintyuzmeokulu@gmail.com?subject=SprintOS%20şifre%20yenileme">
            Şifremi unuttum
          </a>
        </div>

        <button
          className="v2SubmitButton"
          disabled={
            loading
          }
          type="submit"
        >
          <Icon name="lock" />

          {loading
            ? "Giriş yapılıyor…"
            : activeRole.label}
        </button>

        {error && (
          <p
            className="v2LoginError"
            role="alert"
          >
            {error}
          </p>
        )}

        <div className="v2ContactLine">
          <span>
            veya
          </span>
        </div>

        <p className="v2ContactText">
          Hesabınız yok mu?{" "}
          <a href="mailto:sprintyuzmeokulu@gmail.com">
            İletişime geçin
          </a>
        </p>
      </form>
    </div>
  );
}
