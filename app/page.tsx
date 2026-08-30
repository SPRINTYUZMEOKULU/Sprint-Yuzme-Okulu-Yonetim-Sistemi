import Link from "next/link";
import { redirect } from "next/navigation";

import {
  requireProfile,
  type UserRole,
} from "@/lib/auth/profile";

import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

import { Icons } from "@/app/components/dashboard-icons";
import GlobalSearch from "@/app/components/global-search";

import "./dashboard.css";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Ana Sayfa | SprintOS",
};

type MenuItem = {
  label: string;
  href: string;
  roles: UserRole[];
  icon: keyof typeof Icons;
  group: string;
  moduleKey: string;
};

type StatItem = {
  label: string;
  value: number | string;
  note: string;
  icon: keyof typeof Icons;
  tone: string;
  href: string;
  moduleKey: string;
};

type QuickItem = {
  label: string;
  href: string;
  icon: keyof typeof Icons;
  roles: UserRole[];
  moduleKey: string;
  badge?: number;
};

type BirthdayPerson = {
  id: string;
  name: string;
  phone: string | null;
  kind: "student" | "staff";
};

const allRoles: UserRole[] = [
  "owner",
  "admin",
  "branch_manager",
  "registration_staff",
  "accounting",
  "coach",
  "guardian",
];

const management: UserRole[] = [
  "owner",
  "admin",
  "branch_manager",
];

const staff: UserRole[] = [
  "owner",
  "admin",
  "branch_manager",
  "registration_staff",
  "accounting",
  "coach",
];

const menu: MenuItem[] = [
  {
    label: "Ana Sayfa",
    href: "/",
    roles: allRoles,
    icon: "dashboard",
    group: "GENEL",
    moduleKey: "dashboard",
  },
  {
    label: "Ön Kayıtlar",
    href: "/on-kayitlar",
    roles: ["owner", "admin", "branch_manager", "registration_staff"],
    icon: "note",
    group: "GENEL",
    moduleKey: "preregistration",
  },
  {
    label: "Öğrenciler",
    href: "/ogrenciler",
    roles: staff,
    icon: "child",
    group: "GENEL",
    moduleKey: "students",
  },
  {
    label: "Veliler",
    href: "/veliler",
    roles: ["owner", "admin", "branch_manager", "registration_staff"],
    icon: "users",
    group: "GENEL",
    moduleKey: "students",
  },
  {
    label: "Şubeler",
    href: "/subeler",
    roles: management,
    icon: "branch",
    group: "EĞİTİM",
    moduleKey: "branches",
  },
  {
    label: "Gruplar",
    href: "/gruplar",
    roles: staff,
    icon: "branch",
    group: "EĞİTİM",
    moduleKey: "groups",
  },
  {
    label: "Ders Programı",
    href: "/ders-programi",
    roles: allRoles,
    icon: "calendar",
    group: "EĞİTİM",
    moduleKey: "schedule",
  },
  {
    label: "Operasyon Planı",
    href: "/operasyon-plani",
    roles: allRoles,
    icon: "calendar",
    group: "EĞİTİM",
    moduleKey: "operations",
  },
  {
    label: "Yoklama",
    href: "/yoklama",
    roles: ["owner", "admin", "branch_manager", "coach"],
    icon: "check",
    group: "EĞİTİM",
    moduleKey: "attendance",
  },
  {
    label: "Paketler",
    href: "/paketler",
    roles: [
      "owner",
      "admin",
      "branch_manager",
      "registration_staff",
      "accounting",
      "guardian",
    ],
    icon: "approval",
    group: "FİNANS",
    moduleKey: "finance",
  },
  {
    label: "Günlük Kasa",
    href: "/kasa",
    roles: ["owner", "admin", "branch_manager", "accounting"],
    icon: "wallet",
    group: "FİNANS",
    moduleKey: "finance",
  },
  {
    label: "Ödemeler",
    href: "/odemeler",
    roles: ["owner", "admin", "branch_manager", "accounting", "guardian"],
    icon: "wallet",
    group: "FİNANS",
    moduleKey: "finance",
  },
  {
    label: "Hazır Mesajlar",
    href: "/hazir-mesajlar",
    roles: staff,
    icon: "message",
    group: "İLETİŞİM",
    moduleKey: "dashboard",
  },
  {
    label: "Uyarılar",
    href: "/uyarilar",
    roles: staff,
    icon: "bell",
    group: "YÖNETİM",
    moduleKey: "dashboard",
  },
  {
    label: "Onay Merkezi",
    href: "/onay-merkezi",
    roles: management,
    icon: "approval",
    group: "YÖNETİM",
    moduleKey: "permissions",
  },
  {
    label: "Kullanıcılar ve Yetkiler",
    href: "/kullanicilar-ve-yetkiler",
    roles: ["owner", "admin"],
    icon: "users",
    group: "YÖNETİM",
    moduleKey: "permissions",
  },
  {
    label: "Raporlar",
    href: "/raporlar",
    roles: management,
    icon: "chart",
    group: "YÖNETİM",
    moduleKey: "reports",
  },
  {
    label: "Ayarlar",
    href: "/ayarlar",
    roles: ["owner", "admin"],
    icon: "settings",
    group: "YÖNETİM",
    moduleKey: "permissions",
  },
];

const roleLabels: Record<UserRole, string> = {
  pending: "Onay Bekliyor",
  owner: "Kurucu Yönetici",
  admin: "Yönetici",
  branch_manager: "Şube Yöneticisi",
  registration_staff: "Kayıt Personeli",
  accounting: "Muhasebe",
  coach: "Eğitmen",
  guardian: "Veli",
};


async function getAllowedModules(profileId: string, role: UserRole) {
  if (role === "owner") {
    return {
      fullAccess: true,
      allowedModules: ["*"],
    };
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    console.error("SprintOS ana sayfa yetki kontrolü için ortam değişkenleri eksik.");
    return {
      fullAccess: false,
      allowedModules: [] as string[],
    };
  }

  const admin = createAdminClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { data: staffRow, error: staffError } = await admin
    .from("staff")
    .select("id, is_active, login_enabled, is_super_user")
    .eq("auth_user_id", profileId)
    .maybeSingle();

  if (
    staffError ||
    !staffRow ||
    !staffRow.is_active ||
    !staffRow.login_enabled
  ) {
    return {
      fullAccess: false,
      allowedModules: [] as string[],
    };
  }

  if (staffRow.is_super_user) {
    return {
      fullAccess: true,
      allowedModules: ["*"],
    };
  }

  const { data: permissionRows, error: permissionError } = await admin
    .from("staff_permissions")
    .select("permission_key")
    .eq("staff_id", staffRow.id)
    .eq("is_allowed", true);

  if (permissionError || !permissionRows?.length) {
    return {
      fullAccess: false,
      allowedModules: [] as string[],
    };
  }

  const permissionKeys = permissionRows.map((row) =>
    String(row.permission_key)
  );

  const { data: definitions, error: definitionsError } = await admin
    .from("permission_definitions")
    .select("module_key")
    .in("permission_key", permissionKeys)
    .eq("is_active", true);

  if (definitionsError) {
    return {
      fullAccess: false,
      allowedModules: [] as string[],
    };
  }

  return {
    fullAccess: false,
    allowedModules: Array.from(
      new Set(
        (definitions ?? [])
          .map((row) => String(row.module_key || ""))
          .filter(Boolean)
      )
    ),
  };
}

async function safeCount(
  table: string,
  filters?: Array<[string, string]>
) {
  try {
    const supabase = await createClient();

    let query = supabase
      .from(table)
      .select("id", {
        count: "exact",
        head: true,
      });

    for (const [key, value] of filters || []) {
      query = query.eq(key, value);
    }

    const {
      count,
      error,
    } = await query;

    if (error) {
      console.error(
        `${table} sayaç hatası:`,
        error
      );

      return 0;
    }

    return count || 0;
  } catch (error) {
    console.error(
      `${table} sayaç işlemi başarısız:`,
      error
    );

    return 0;
  }
}

function todayMonthDay() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  return `${month}-${day}`;
}

function whatsappNumber(value: unknown) {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("90")) return digits;
  if (digits.startsWith("0")) return `90${digits.slice(1)}`;
  return digits.length === 10 ? `90${digits}` : digits;
}

function birthdayMessage(name: string, kind: BirthdayPerson["kind"]) {
  const greeting = kind === "student" ? `Sevgili ${name}` : `Değerli ${name}`;
  return `${greeting},\n\nDoğum gününüzü en içten dileklerimizle kutlar; sağlık, mutluluk ve başarılarla dolu güzel bir yaş dileriz. 🎉🎂\n\nSprint Yüzme Okulu Yönetimi\nBilgilendirme Hattı: 0551 896 83 19`;
}

async function getTodayBirthdays(organizationId: string | null) {
  if (!organizationId) return [] as BirthdayPerson[];

  try {
    const supabase = await createClient();
    const [studentsResult, staffResult] = await Promise.all([
      supabase
        .from("students")
        .select("id,first_name,last_name,birth_date,phone,guardian_phone,status,is_deleted")
        .eq("organization_id", organizationId)
        .eq("is_deleted", false)
        .eq("status", "active"),
      supabase
        .from("staff")
        .select("*")
        .eq("organization_id", organizationId)
        .eq("is_active", true),
    ]);

    const monthDay = todayMonthDay();
    const people: BirthdayPerson[] = [];

    for (const row of studentsResult.data || []) {
      if (String(row.birth_date || "").slice(5, 10) !== monthDay) continue;
      people.push({
        id: String(row.id),
        name: `${row.first_name || ""} ${row.last_name || ""}`.trim() || "Öğrencimiz",
        phone: row.guardian_phone || row.phone || null,
        kind: "student",
      });
    }

    if (!staffResult.error) {
      for (const source of staffResult.data || []) {
        const row = source as Record<string, unknown>;
        if (String(row.birth_date || "").slice(5, 10) !== monthDay) continue;
        const name = String(
          row.full_name ||
            row.name ||
            `${row.first_name || ""} ${row.last_name || ""}`.trim() ||
            "Personelimiz"
        );
        people.push({
          id: String(row.id),
          name,
          phone: String(row.phone || row.mobile_phone || "") || null,
          kind: "staff",
        });
      }
    }

    return people;
  } catch (error) {
    console.error("Doğum günü bilgileri alınamadı:", error);
    return [] as BirthdayPerson[];
  }
}

export default async function HomePage() {
  const profile = await requireProfile();

  /*
   * VELİ ANA YÖNETİM EKRANINI GÖRMEZ.
   */
  if (profile.role === "guardian") {
    redirect("/veli-paneli");
  }

  const access = await getAllowedModules(profile.id, profile.role);

  const canAccessModule = (moduleKey: string) =>
    access.fullAccess ||
    access.allowedModules.includes("*") ||
    access.allowedModules.includes(moduleKey);

  const visibleMenu = menu.filter(
    (item) =>
      item.roles.includes(profile.role) &&
      canAccessModule(item.moduleKey)
  );

  const isCoach =
    profile.role === "coach";

  const isManager =
    management.includes(profile.role);

  const [
    activeStudents,
    preRegistrations,
    openAlerts,
    pendingApprovals,
    pendingCash,
  ] = await Promise.all([
    safeCount(
      "students",
      [["status", "active"]]
    ),

    safeCount(
      "students",
      [["status", "pre_registration"]]
    ),

    safeCount(
      "alerts",
      [["status", "open"]]
    ),

    safeCount(
      "approval_requests",
      [["status", "pending"]]
    ),

    safeCount(
      "payments",
      [["cash_status", "handoff_pending"]]
    ),
  ]);

  const birthdayPeople = await getTodayBirthdays(profile.organization_id);

  const today =
    new Intl.DateTimeFormat(
      "tr-TR",
      {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      }
    ).format(new Date());

  const firstName = (
    profile.full_name ||
    profile.email ||
    "SprintOS Kullanıcısı"
  )
    .trim()
    .split(" ")[0];

  /*
   * =========================================================
   * ANA SAYFA İSTATİSTİKLERİ
   * =========================================================
   */

  const managerStats: StatItem[] = [
    {
      label: "Aktif Öğrenci",
      value: activeStudents,
      note: "Tüm şubeler",
      icon: "child",
      tone: "blue",
      href: "/ogrenciler?durum=active",
      moduleKey: "students",
    },
    {
      label: "Bekleyen Ön Kayıt",
      value: preRegistrations,
      note: "Geri dönüş bekliyor",
      icon: "note",
      tone: "orange",
      href: "/on-kayitlar?durum=bekleyen",
      moduleKey: "preregistration",
    },
    {
      label: "Açık Uyarı",
      value: openAlerts,
      note: "İşlem gerektiriyor",
      icon: "bell",
      tone: "red",
      href: "/uyarilar?durum=open",
      moduleKey: "dashboard",
    },
    {
      label: "Kasa Onayı",
      value: pendingCash,
      note: "Teslim onayı bekliyor",
      icon: "wallet",
      tone: "purple",
      href: "/kasa?durum=handoff_pending",
      moduleKey: "finance",
    },
  ];

  const coachStats: StatItem[] = [
    {
      label: "Bugünkü Dersim",
      value: 0,
      note: "Planlanan ders",
      icon: "calendar",
      tone: "blue",
      href: "/ders-programi",
      moduleKey: "schedule",
    },
    {
      label: "Bu Ay Girdiğim Ders",
      value: 0,
      note: "Onaylı ders",
      icon: "check",
      tone: "green",
      href: "/yoklama",
      moduleKey: "attendance",
    },
    {
      label: "Yoklama Bekleyen",
      value: 0,
      note: "Tamamlanacak",
      icon: "clock",
      tone: "orange",
      href: "/yoklama",
      moduleKey: "attendance",
    },
    {
      label: "Açık Görev",
      value: openAlerts,
      note: "İşlem gerektiriyor",
      icon: "bell",
      tone: "purple",
      href: "/uyarilar",
      moduleKey: "dashboard",
    },
  ];

  const stats = (isCoach ? coachStats : managerStats).filter((item) =>
    canAccessModule(item.moduleKey)
  );

  /*
   * =========================================================
   * HIZLI ERİŞİM
   * =========================================================
   */

  const quickItems: QuickItem[] = [
    {
      label: "Yeni Ön Kayıt",
      href: "/on-kayit",
      icon: "note",
      roles: ["owner", "admin", "branch_manager", "registration_staff"],
      moduleKey: "preregistration",
    },
    {
      label: "Ön Kayıtlar",
      href: "/on-kayitlar",
      icon: "note",
      roles: ["owner", "admin", "branch_manager", "registration_staff"],
      moduleKey: "preregistration",
      badge: preRegistrations,
    },
    {
      label: "Öğrenciler",
      href: "/ogrenciler",
      icon: "child",
      roles: staff,
      moduleKey: "students",
    },
    {
      label: "Veliler",
      href: "/veliler",
      icon: "users",
      roles: ["owner", "admin", "branch_manager", "registration_staff"],
      moduleKey: "students",
    },
    {
      label: "Şubeler",
      href: "/subeler",
      icon: "branch",
      roles: management,
      moduleKey: "branches",
    },
    {
      label: "Gruplar",
      href: "/gruplar",
      icon: "branch",
      roles: staff,
      moduleKey: "groups",
    },
    {
      label: "Ders Programı",
      href: "/ders-programi",
      icon: "calendar",
      roles: staff,
      moduleKey: "schedule",
    },
    {
      label: "Yoklama",
      href: "/yoklama",
      icon: "check",
      roles: ["owner", "admin", "branch_manager", "coach"],
      moduleKey: "attendance",
    },
    {
      label: "Ödemeler",
      href: "/odemeler",
      icon: "wallet",
      roles: ["owner", "admin", "branch_manager", "accounting"],
      moduleKey: "finance",
    },
    {
      label: "Günlük Kasa",
      href: "/kasa",
      icon: "wallet",
      roles: ["owner", "admin", "branch_manager", "accounting"],
      moduleKey: "finance",
      badge: pendingCash,
    },
    {
      label: "Onay Merkezi",
      href: "/onay-merkezi",
      icon: "approval",
      roles: management,
      moduleKey: "permissions",
      badge: pendingApprovals,
    },
    {
      label: "Hazır Mesajlar",
      href: "/hazir-mesajlar",
      icon: "message",
      roles: staff,
      moduleKey: "dashboard",
    },
    {
      label: "Uyarılar",
      href: "/uyarilar",
      icon: "bell",
      roles: staff,
      moduleKey: "dashboard",
      badge: openAlerts,
    },
    {
      label: "Kullanıcılar ve Yetkiler",
      href: "/kullanicilar-ve-yetkiler",
      icon: "users",
      roles: ["owner", "admin"],
      moduleKey: "permissions",
    },
    {
      label: "Raporlar",
      href: "/raporlar",
      icon: "chart",
      roles: management,
      moduleKey: "reports",
    },
    {
      label: "Ayarlar",
      href: "/ayarlar",
      icon: "settings",
      roles: ["owner", "admin"],
      moduleKey: "permissions",
    },
  ];
  const visibleQuickItems =
    quickItems.filter(
      (item) =>
        item.roles.includes(profile.role) &&
        canAccessModule(item.moduleKey)
    );

  const groups = [
    ...new Set(
      visibleMenu.map(
        (item) => item.group
      )
    ),
  ];

  return (
    <main className="proShell">
      <input
        id="dashboard-menu-toggle"
        className="dashboardMenuToggle"
        type="checkbox"
        aria-label="Ana menüyü aç veya kapat"
      />
      <label
        htmlFor="dashboard-menu-toggle"
        className="dashboardMenuButton"
        title="Menüyü Aç / Kapat"
      >
        <span />
        <span />
        <span />
      </label>
      <label
        htmlFor="dashboard-menu-toggle"
        className="dashboardMenuBackdrop"
        aria-hidden="true"
      />
      {/* MOBİL GÜVENLİ ÇIKIŞ - SADECE TELEFON/TABLETTE GÖRÜNÜR */}
      <a
        href="/auth/signout"
        className="mobileSecureLogout"
        title="Güvenli Çıkış"
        aria-label="Güvenli Çıkış"
      >
        <Icons.logout />
        <span>Çıkış</span>
      </a>

      <style>{`
        .mobileSecureLogout {
          display: none;
        }

        @media (max-width: 768px) {
          .mobileSecureLogout {
            position: fixed;
            top: 14px;
            right: 12px;
            z-index: 999999;

            width: 46px;
            height: 46px;
            padding: 0;

            display: flex;
            align-items: center;
            justify-content: center;

            border-radius: 14px;
            border: 2px solid rgba(255,255,255,0.95);

            background: #dc2626;
            color: #ffffff;
            text-decoration: none;

            box-shadow: 0 10px 28px rgba(220,38,38,0.32);
          }

          .mobileSecureLogout svg {
            width: 21px;
            height: 21px;
          }

          .mobileSecureLogout span {
            display: none;
          }
        }
      `}</style>
      {/* =====================================================
          SOL MENÜ
      ===================================================== */}

      <aside className="proSidebar">
        <Link
          href="/"
          className="proBrand"
          title="Ana Sayfaya Dön"
        >
          <div className="proLogo">
            <img
              src="/sprint-logo.png"
              alt="Sprint Yüzme Okulu"
              style={{
                width: "100%",
                height: "100%",
                objectFit: "contain",
                borderRadius: "12px",
              }}
            />
          </div>

          <div>
            <strong>
              SprintOS
            </strong>

            <span>
              Yüzme Okulu Yönetimi
            </span>
          </div>
        </Link>

        <nav className="proNav">
          {groups.map(
            (group) => (
              <div
                className="navGroup"
                key={group}
              >
                <p>
                  {group}
                </p>

                {visibleMenu
                  .filter(
                    (item) =>
                      item.group ===
                      group
                  )
                  .map(
                    (item) => {
                      const Icon =
                        Icons[
                          item.icon
                        ];

                      return (
                        <Link
                          key={
                            item.href
                          }
                          href={
                            item.href
                          }
                          className={
                            item.href ===
                            "/"
                              ? "proNavItem active"
                              : "proNavItem"
                          }
                        >
                          <Icon />

                          <span>
                            {
                              item.label
                            }
                          </span>

                          {item.href ===
                            "/uyarilar" &&
                          openAlerts >
                            0 ? (
                            <b>
                              {
                                openAlerts
                              }
                            </b>
                          ) : null}

                          {item.href ===
                            "/onay-merkezi" &&
                          pendingApprovals >
                            0 ? (
                            <b>
                              {
                                pendingApprovals
                              }
                            </b>
                          ) : null}
                        </Link>
                      );
                    }
                  )}
              </div>
            )
          )}
        </nav>

        <div className="proUser">
          <div className="avatar">
            {(
              profile.full_name ||
              profile.email ||
              "S"
            )
              .charAt(0)
              .toUpperCase()}
          </div>

          <div>
            <strong>
              {profile.full_name ||
                profile.email ||
                "Kullanıcı"}
            </strong>

            <span>
              {
                roleLabels[
                  profile.role
                ]
              }
            </span>
          </div>

          <a
            href="/auth/signout"
            title="Güvenli Çıkış"
            aria-label="Güvenli Çıkış"
          >
            <Icons.logout />
          </a>
        </div>
      </aside>

      {/* =====================================================
          ANA İÇERİK
      ===================================================== */}

      <section className="proMain">
        {/* ===================================================
            ÜST BAR
        =================================================== */}

        <header className="proTopbar">
          {/*
           * BURASI ARTIK LINK DEĞİL.
           * GERÇEK ARAMA BİLEŞENİ.
           */}
          <GlobalSearch />

          <div className="topActions">
            <Link
              href="/uyarilar"
              aria-label="Bildirimler"
              title="Bildirimleri Aç"
              style={{
                position:
                  "relative",
              }}
            >
              <Icons.bell />

              {openAlerts > 0 ||
              pendingApprovals >
                0 ? (
                <i />
              ) : null}
            </Link>

            <span className="dateText">
              {today}
            </span>
          </div>
        </header>

        <div className="dashboardContent">
          {/* =================================================
              KARŞILAMA
          ================================================= */}

          <section className="heroRow">
            <div>
              <p className="heroEyebrow">
                SPRİNT YÜZME OKULU
              </p>

              <h1>
                Hoş geldiniz,{" "}
                {firstName}
              </h1>

              <p>
                {isCoach
                  ? "Bugünkü derslerinizi, öğrencilerinizi ve yoklamalarınızı buradan yönetin."
                  : "Günlük operasyonunuzu tek ekrandan yönetin."}
              </p>
            </div>

            <div className="heroActions">
              {isCoach ? (
                canAccessModule("attendance") ? (
                  <Link
                    className="actionPrimary"
                    href="/yoklama"
                  >
                    <Icons.check />

                    Derse Geldim
                  </Link>
                ) : null
              ) : (
                <>
                  {canAccessModule("dashboard") ? (
                    <Link
                      className="actionSecondary"
                      href="/hazir-mesajlar"
                    >
                      <Icons.message />

                      Hızlı Mesaj
                    </Link>
                  ) : null}

                  {canAccessModule("preregistration") ? (
                    <Link
                      className="actionPrimary"
                      href="/on-kayit"
                    >
                      <span>
                        +
                      </span>

                      Yeni Ön Kayıt
                    </Link>
                  ) : null}
                </>
              )}
            </div>
          </section>

          {/* =================================================
              İSTATİSTİK KARTLARI
          ================================================= */}

          <section className="proStats">
            {stats.map(
              (stat) => {
                const Icon =
                  Icons[
                    stat.icon
                  ];

                return (
                  <Link
                    href={
                      stat.href
                    }
                    className={`proStat ${stat.tone}`}
                    key={
                      stat.label
                    }
                    style={{
                      textDecoration:
                        "none",
                      color:
                        "inherit",
                    }}
                    aria-label={`${stat.label}: ${stat.value}. İlgili listeyi aç`}
                  >
                    <div className="statIcon">
                      <Icon />
                    </div>

                    <div>
                      <span>
                        {
                          stat.label
                        }
                      </span>

                      <strong>
                        {
                          stat.value
                        }
                      </strong>

                      <small>
                        {
                          stat.note
                        }
                      </small>

                      <em>
                        Ayrıntıları Gör <Icons.arrow />
                      </em>
                    </div>
                  </Link>
                );
              }
            )}
          </section>

          {/* =================================================
              ANA SAYFA GRID
          ================================================= */}

          <section className="dashboardGrid">
            {/* BUGÜNKÜ DERSLER */}

            {canAccessModule("schedule") ? (
            <article className="dashCard scheduleCard">
              <div className="dashCardHeader">
                <div>
                  <p>
                    GÜNLÜK OPERASYON
                  </p>

                  <h2>
                    {isCoach
                      ? "Bugünkü Programım"
                      : "Bugünkü Dersler ve Yoklamalar"}
                  </h2>
                </div>

                <Link href="/ders-programi">
                  Takvimi Aç{" "}
                  <Icons.arrow />
                </Link>
              </div>

              <div className="emptyPro">
                <div className="emptyIcon">
                  <Icons.calendar />
                </div>

                <strong>
                  Bugünkü program hazırlanıyor
                </strong>

                <span>
                  Bir sonraki adımda
                  bugünün tüm
                  derslerini saat,
                  şube, grup,
                  eğitmen, öğrenci
                  sayısı ve yoklama
                  durumuyla burada
                  canlı göstereceğiz.
                </span>

                <Link href="/ders-programi">
                  Ders programına git
                </Link>
              </div>
            </article>
            ) : null}

            {/* UYARILAR */}

            <article className="dashCard alertCard">
              <div className="dashCardHeader">
                <div>
                  <p>
                    ÖNCELİKLER
                  </p>

                  <h2>
                    Akıllı Uyarılar
                  </h2>
                </div>

                <Link href="/uyarilar">
                  Tümünü Gör{" "}
                  <Icons.arrow />
                </Link>
              </div>

              <div className="alertList">
                {birthdayPeople.map((person) => {
                  const phone = whatsappNumber(person.phone);
                  const href = phone
                    ? `https://wa.me/${phone}?text=${encodeURIComponent(
                        birthdayMessage(person.name, person.kind)
                      )}`
                    : person.kind === "student"
                      ? `/ogrenciler/${person.id}`
                      : "/kullanicilar-ve-yetkiler";

                  return (
                    <div className="alertItem birthday" key={`${person.kind}-${person.id}`}>
                      <span>
                        <Icons.cake />
                      </span>

                      <div>
                        <strong>{person.name} için doğum günü</strong>
                        <small>
                          {person.kind === "student" ? "Öğrenci" : "Personel"} mesajı hazır.
                        </small>
                      </div>

                      <a
                        href={href}
                        target={phone ? "_blank" : undefined}
                        rel={phone ? "noreferrer" : undefined}
                      >
                        {phone ? "Mesajı Hazırla" : "Bilgiyi Tamamla"}
                      </a>
                    </div>
                  );
                })}

                {openAlerts > 0 ? (
                  <div className="alertItem urgent">
                    <span>
                      <Icons.bell />
                    </span>

                    <div>
                      <strong>
                        {openAlerts}{" "}
                        açık uyarı
                        bulunuyor
                      </strong>

                      <small>
                        Öncelikli
                        işlemleri
                        kontrol edin.
                      </small>
                    </div>

                    <Link href="/uyarilar">
                      İncele
                    </Link>
                  </div>
                ) : (
                  <div className="alertItem success">
                    <span>
                      <Icons.check />
                    </span>

                    <div>
                      <strong>
                        Her şey yolunda
                      </strong>

                      <small>
                        Şu anda açık
                        uyarı bulunmuyor.
                      </small>
                    </div>
                  </div>
                )}

                {isManager &&
                canAccessModule("permissions") &&
                pendingApprovals >
                  0 ? (
                  <div className="alertItem warning">
                    <span>
                      <Icons.approval />
                    </span>

                    <div>
                      <strong>
                        {
                          pendingApprovals
                        }{" "}
                        işlem onay
                        bekliyor
                      </strong>

                      <small>
                        Onay Merkezi'ni
                        kontrol edin.
                      </small>
                    </div>

                    <Link href="/onay-merkezi">
                      Aç
                    </Link>
                  </div>
                ) : null}

                {canAccessModule("finance") &&
                pendingCash >
                0 ? (
                  <div className="alertItem warning">
                    <span>
                      <Icons.wallet />
                    </span>

                    <div>
                      <strong>
                        {
                          pendingCash
                        }{" "}
                        kasa işlemi
                        bekliyor
                      </strong>

                      <small>
                        Teslim ve kasa
                        işlemlerini
                        kontrol edin.
                      </small>
                    </div>

                    <Link href="/kasa">
                      Aç
                    </Link>
                  </div>
                ) : null}
              </div>
            </article>

            {/* =================================================
                HIZLI ERİŞİM
            ================================================= */}

            <article
              className="dashCard quickCard"
              style={{
                gridColumn:
                  "1 / -1",
              }}
            >
              <div className="dashCardHeader">
                <div>
                  <p>
                    HIZLI ERİŞİM
                  </p>

                  <h2>
                    İhtiyacınız Olan Modüle Tek Tıkla Ulaşın
                  </h2>
                </div>
              </div>

              <div className="quickGrid">
                {visibleQuickItems.map(
                  (item) => {
                    const Icon =
                      Icons[
                        item.icon
                      ];

                    return (
                      <Link
                        key={
                          item.label
                        }
                        href={
                          item.href
                        }
                      >
                        <span>
                          <Icon />
                        </span>

                        <strong>
                          {
                            item.label
                          }
                        </strong>

                        {item.badge &&
                        item.badge >
                          0 ? (
                          <b
                            style={{
                              marginLeft:
                                "auto",

                              marginRight:
                                "8px",

                              minWidth:
                                "22px",

                              height:
                                "22px",

                              borderRadius:
                                "999px",

                              display:
                                "inline-flex",

                              alignItems:
                                "center",

                              justifyContent:
                                "center",

                              fontSize:
                                "11px",

                              padding:
                                "0 6px",

                              background:
                                "#eaf2ff",

                              color:
                                "#1769e8",
                            }}
                          >
                            {
                              item.badge
                            }
                          </b>
                        ) : null}

                        <Icons.arrow />
                      </Link>
                    );
                  }
                )}
              </div>
            </article>

            {/* =================================================
                ŞUBE DURUMU
            ================================================= */}

            {canAccessModule("branches") ? (
            <article className="dashCard branchCard">
              <div className="dashCardHeader">
                <div>
                  <p>
                    ŞUBE DURUMU
                  </p>

                  <h2>
                    Aktif Lokasyonlar
                  </h2>
                </div>

                <Link href="/subeler">
                  Yönet{" "}
                  <Icons.arrow />
                </Link>
              </div>

              <div className="branchList">
                {[
                  "Lara Life City",
                  "Konyaaltı Öğretmenevi",
                  "Meltem Yüzme Havuzu",
                  "Süleyman Erol Olimpik",
                ].map(
                  (
                    name,
                    index
                  ) => (
                    <div
                      key={
                        name
                      }
                    >
                      <span
                        className={`branchDot b${
                          index +
                          1
                        }`}
                      />

                      <strong>
                        {name}
                      </strong>

                      <small>
                        Aktif
                      </small>
                    </div>
                  )
                )}
              </div>
            </article>
            ) : null}
          </section>
        </div>
      </section>
    </main>
  );
}
