import { formatDisplayDate } from "@/lib/dates/display";
import Link from "next/link";
import { countStartedStudents } from "@/lib/students/start-status";
import { redirect } from "next/navigation";

import {
  requireProfile,
  type UserRole,
} from "@/lib/auth/profile";

import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

import { Icons } from "@/app/components/dashboard-icons";
import GlobalSearch from "@/app/components/global-search";
import SidebarToggle from "@/app/components/sidebar-toggle";

import "./dashboard.css";
import "./dashboard-polish.css";

export const dynamic = "force-dynamic";

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
  value: number | string | null;
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
  badge?: number | null;
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
    icon: "group",
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
    label: "Fatura Merkezi",
    href: "/fatura-merkezi",
    roles: ["owner", "admin", "accounting"],
    icon: "approval",
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
  label: "Bildirimler",
  href: "/bildirimler",
  roles: staff,
  icon: "bell",
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
  organizationId: string | null,
  filters?: Array<[string, string]>
) {
  try {
    if (!organizationId) return null;
    const supabase = await createClient();

    let query = supabase
      .from(table)
      .select("id", {
        count: "exact",
        head: true,
      }).eq("organization_id", organizationId);

    if (table === "students") query = query.eq("is_deleted", false);

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

      return null;
    }

    return count;
  } catch (error) {
    console.error(
      `${table} sayaç işlemi başarısız:`,
      error
    );

    return null;
  }
}

async function activeBranches(organizationId: string | null) {
  if (!organizationId) return null;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.from("branches").select("id,name")
      .eq("organization_id", organizationId).eq("is_active", true).order("name");
    if (error) return null;
    return data;
  } catch {
    return null;
  }
}

async function startedStudentCount(organizationId: string | null) {
  if (!organizationId) return null;
  try {
    const supabase = await createClient();
    const [students, enrollments, plans] = await Promise.all([
      supabase.from("students").select("id,status").eq("organization_id", organizationId).eq("status", "active").eq("is_deleted", false),
      supabase.from("student_enrollments").select("student_id,start_date,start_confirmation_required,actual_started_at")
        .eq("organization_id", organizationId).eq("status", "active").order("created_at", {ascending: false}),
      supabase.from("student_attendance_plans").select("student_id,start_date")
        .eq("organization_id", organizationId).eq("is_active", true).order("created_at", {ascending: false}),
    ]);
    if (students.error || enrollments.error || plans.error) return null;
    const today = new Intl.DateTimeFormat("en-CA", {timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit", day: "2-digit"}).format(new Date());
    return countStartedStudents(students.data ?? [], enrollments.data ?? [], plans.data ?? [], today);
  } catch {
    return null;
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
    branches,
  ] = await Promise.all([
    startedStudentCount(profile.organization_id),

    safeCount(
      "students",
      profile.organization_id,
      [["status", "pre_registration"]]
    ),

    safeCount(
      "alerts",
      profile.organization_id,
      [["status", "open"]]
    ),

    safeCount(
      "approval_requests",
      profile.organization_id,
      [["status", "pending"]]
    ),

    safeCount(
      "student_payments",
      profile.organization_id,
      [["cash_handover_status", "handoff_pending"]]
    ),
    canAccessModule("branches") ? activeBranches(profile.organization_id) : Promise.resolve(null),
  ]);

  const today =
    formatDisplayDate(new Date());

  const firstName = profile.full_name?.trim().split(/\s+/)[0];

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
      label: "Bekleyen Uyarı",
      value: openAlerts,
      note: "İşlem gerektiriyor",
      icon: "bell",
      tone: "red",
      href: "/uyarilar?durum=open",
      moduleKey: "dashboard",
    },
    {
      label: "Teslim Onayı Bekleyen",
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
      value: null,
      note: "Ders programını açın",
      icon: "calendar",
      tone: "blue",
      href: "/ders-programi",
      moduleKey: "schedule",
    },
    {
      label: "Bu Ay Girdiğim Ders",
      value: null,
      note: "Yoklama kayıtlarını açın",
      icon: "check",
      tone: "green",
      href: "/yoklama",
      moduleKey: "attendance",
    },
    {
      label: "Yoklama Bekleyen",
      value: null,
      note: "Yoklamayı kontrol edin",
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
      icon: "group",
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
              src="/sprint-logo.png?v=6"
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
              SPRİNT YÜZME OKULU
            </strong>

            <span>
              SprintOS Yönetim Paneli
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
                          (openAlerts ?? 0) >
                            0 ? (
                            <b>
                              {
                                openAlerts
                              }
                            </b>
                          ) : null}

                          {item.href ===
                            "/onay-merkezi" &&
                          (pendingApprovals ?? 0) >
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

        <a href="/auth/signout" className="homeMenuSignout">
          <Icons.logout /> Güvenli Çıkış
        </a>

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
  <SidebarToggle />

  {/*
   * BURASI ARTIK LINK DEĞİL.
   * GERÇEK ARAMA BİLEŞENİ.
   */}
  <GlobalSearch />

          <div className="topActions">
            <Link
              href="/bildirimler"
              aria-label="Bildirimler"
              title="Bildirimleri Aç"
              style={{
                position:
                  "relative",
              }}
            >
              <Icons.bell />

              {(openAlerts ?? 0) > 0 ||
              (pendingApprovals ?? 0) >
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
                {firstName ? `Hoş geldiniz, ${firstName}` : "Yönetim Merkezi"}
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
                    title={stat.value === null ? "Bu bilgi alınamadı. İlgili modülden kontrol edin." : undefined}
                    style={{
                      textDecoration:
                        "none",
                      color:
                        "inherit",
                    }}
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
                          stat.value ?? "—"
                        }
                      </strong>

                      <small>
                        {
                          stat.value === null ? "Bilgi alınamadı · Kontrol edin" : stat.note
                        }
                      </small>
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
                {(openAlerts ?? 0) > 0 ? (
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
                  <div className={`alertItem ${openAlerts === null ? "warning" : "success"}`}>
                    <span>
                      <Icons.check />
                    </span>

                    <div>
                      <strong>
                        {openAlerts === null ? "Uyarılar kontrol edilemedi" : "Açık uyarı yok"}
                      </strong>

                      <small>
                        {openAlerts === null ? "Uyarılar sayfasından kontrol edin." : "Şu anda açık uyarı bulunmuyor."}
                      </small>
                    </div>
                  </div>
                )}

                {isManager &&
                canAccessModule("permissions") &&
                (pendingApprovals ?? 0) >
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
                (pendingCash ?? 0) >
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

                    <Link href="/kasa?durum=handoff_pending">
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
                {branches?.map((branch, index) => (
                  <div key={branch.id}>
                    <span className={`branchDot b${index % 4 + 1}`} />
                    <strong>{branch.name}</strong>
                    <small>Aktif</small>
                  </div>
                ))}
                {branches === null ? <p>Şube bilgileri alınamadı. Şubeler ekranından kontrol edin.</p> : branches.length === 0 ? <p>Aktif şube bulunmuyor.</p> : null}
              </div>
            </article>
            ) : null}
          </section>
        </div>
      </section>
    </main>
  );
}

