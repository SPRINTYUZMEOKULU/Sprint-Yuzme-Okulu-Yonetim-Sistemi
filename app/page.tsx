import Link from "next/link";
import { redirect } from "next/navigation";

import {
  requireProfile,
  type UserRole,
} from "@/lib/auth/profile";

import { createClient } from "@/lib/supabase/server";

import { Icons } from "@/app/components/dashboard-icons";
import GlobalSearch from "@/app/components/global-search";

import "./dashboard.css";

export const dynamic = "force-dynamic";

type MenuItem = {
  label: string;
  href: string;
  roles: UserRole[];
  icon: keyof typeof Icons;
  group: string;
};

type StatItem = {
  label: string;
  value: number | string;
  note: string;
  icon: keyof typeof Icons;
  tone: string;
  href: string;
};

type QuickItem = {
  label: string;
  href: string;
  icon: keyof typeof Icons;
  roles: UserRole[];
  badge?: number;
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
  },
  {
    label: "Ön Kayıtlar",
    href: "/on-kayitlar",
    roles: [
      "owner",
      "admin",
      "branch_manager",
      "registration_staff",
    ],
    icon: "note",
    group: "GENEL",
  },
  {
    label: "Öğrenciler",
    href: "/ogrenciler",
    roles: staff,
    icon: "child",
    group: "GENEL",
  },
  {
    label: "Veliler",
    href: "/veliler",
    roles: [
      "owner",
      "admin",
      "branch_manager",
      "registration_staff",
    ],
    icon: "users",
    group: "GENEL",
  },

  {
    label: "Şubeler",
    href: "/subeler",
    roles: management,
    icon: "branch",
    group: "EĞİTİM",
  },
  {
    label: "Gruplar",
    href: "/gruplar",
    roles: staff,
    icon: "branch",
    group: "EĞİTİM",
  },
  {
    label: "Ders Programı",
    href: "/ders-programi",
    roles: allRoles,
    icon: "calendar",
    group: "EĞİTİM",
  },
  {
  label: "Operasyon Planı",
  href: "/operasyon-plani",
  roles: allRoles,
  icon: "calendar",
  group: "EĞİTİM",
},
  {
    label: "Yoklama",
    href: "/yoklama",
    roles: [
      "owner",
      "admin",
      "branch_manager",
      "coach",
    ],
    icon: "check",
    group: "EĞİTİM",
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
  },
  {
    label: "Günlük Kasa",
    href: "/kasa",
    roles: [
      "owner",
      "admin",
      "branch_manager",
      "accounting",
    ],
    icon: "wallet",
    group: "FİNANS",
  },
  {
    label: "Ödemeler",
    href: "/odemeler",
    roles: [
      "owner",
      "admin",
      "branch_manager",
      "accounting",
      "guardian",
    ],
    icon: "wallet",
    group: "FİNANS",
  },

  {
    label: "Hazır Mesajlar",
    href: "/hazir-mesajlar",
    roles: staff,
    icon: "message",
    group: "İLETİŞİM",
  },

  {
    label: "Uyarılar",
    href: "/uyarilar",
    roles: staff,
    icon: "bell",
    group: "YÖNETİM",
  },
  {
    label: "Onay Merkezi",
    href: "/onay-merkezi",
    roles: management,
    icon: "approval",
    group: "YÖNETİM",
  },
  {
    label: "Kullanıcılar ve Yetkiler",
    href: "/kullanicilar-ve-yetkiler",
    roles: [
      "owner",
      "admin",
    ],
    icon: "users",
    group: "YÖNETİM",
  },
  {
    label: "Raporlar",
    href: "/raporlar",
    roles: management,
    icon: "chart",
    group: "YÖNETİM",
  },
  {
    label: "Ayarlar",
    href: "/ayarlar",
    roles: [
      "owner",
      "admin",
    ],
    icon: "settings",
    group: "YÖNETİM",
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

export default async function HomePage() {
  const profile = await requireProfile();

  /*
   * VELİ ANA YÖNETİM EKRANINI GÖRMEZ.
   */
  if (profile.role === "guardian") {
    redirect("/veli-paneli");
  }

  const visibleMenu = menu.filter(
    (item) =>
      item.roles.includes(profile.role)
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
    },
    {
      label: "Bekleyen Ön Kayıt",
      value: preRegistrations,
      note: "Geri dönüş bekliyor",
      icon: "note",
      tone: "orange",
      href: "/on-kayitlar?durum=bekleyen",
    },
    {
      label: "Açık Uyarı",
      value: openAlerts,
      note: "İşlem gerektiriyor",
      icon: "bell",
      tone: "red",
      href: "/uyarilar?durum=open",
    },
    {
      label: "Kasa Onayı",
      value: pendingCash,
      note: "Teslim onayı bekliyor",
      icon: "wallet",
      tone: "purple",
      href: "/kasa?durum=handoff_pending",
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
    },
    {
      label: "Bu Ay Girdiğim Ders",
      value: 0,
      note: "Onaylı ders",
      icon: "check",
      tone: "green",
      href: "/yoklama",
    },
    {
      label: "Yoklama Bekleyen",
      value: 0,
      note: "Tamamlanacak",
      icon: "clock",
      tone: "orange",
      href: "/yoklama",
    },
    {
      label: "Açık Görev",
      value: openAlerts,
      note: "İşlem gerektiriyor",
      icon: "bell",
      tone: "purple",
      href: "/uyarilar",
    },
  ];

  const stats =
    isCoach
      ? coachStats
      : managerStats;

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
      roles: [
        "owner",
        "admin",
        "branch_manager",
        "registration_staff",
      ],
    },
    {
      label: "Ön Kayıtlar",
      href: "/on-kayitlar",
      icon: "note",
      roles: [
        "owner",
        "admin",
        "branch_manager",
        "registration_staff",
      ],
      badge: preRegistrations,
    },
    {
      label: "Öğrenciler",
      href: "/ogrenciler",
      icon: "child",
      roles: staff,
    },
    {
      label: "Veliler",
      href: "/veliler",
      icon: "users",
      roles: [
        "owner",
        "admin",
        "branch_manager",
        "registration_staff",
      ],
    },
    {
      label: "Şubeler",
      href: "/subeler",
      icon: "branch",
      roles: management,
    },
    {
      label: "Gruplar",
      href: "/gruplar",
      icon: "branch",
      roles: staff,
    },
    {
      label: "Ders Programı",
      href: "/ders-programi",
      icon: "calendar",
      roles: staff,
    },
    {
      label: "Yoklama",
      href: "/yoklama",
      icon: "check",
      roles: [
        "owner",
        "admin",
        "branch_manager",
        "coach",
      ],
    },
    {
      label: "Ödemeler",
      href: "/odemeler",
      icon: "wallet",
      roles: [
        "owner",
        "admin",
        "branch_manager",
        "accounting",
      ],
    },
    {
      label: "Günlük Kasa",
      href: "/kasa",
      icon: "wallet",
      roles: [
        "owner",
        "admin",
        "branch_manager",
        "accounting",
      ],
      badge: pendingCash,
    },
    {
      label: "Onay Merkezi",
      href: "/onay-merkezi",
      icon: "approval",
      roles: management,
      badge: pendingApprovals,
    },
    {
      label: "Hazır Mesajlar",
      href: "/hazir-mesajlar",
      icon: "message",
      roles: staff,
    },
    {
      label: "Uyarılar",
      href: "/uyarilar",
      icon: "bell",
      roles: staff,
      badge: openAlerts,
    },
    {
      label: "Kullanıcılar ve Yetkiler",
      href: "/kullanicilar-ve-yetkiler",
      icon: "users",
      roles: [
        "owner",
        "admin",
      ],
    },
    {
      label: "Raporlar",
      href: "/raporlar",
      icon: "chart",
      roles: management,
    },
    {
      label: "Ayarlar",
      href: "/ayarlar",
      icon: "settings",
      roles: [
        "owner",
        "admin",
      ],
    },
  ];

  const visibleQuickItems =
    quickItems.filter(
      (item) =>
        item.roles.includes(profile.role)
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

          <Link
            href="/auth/signout"
            title="Güvenli Çıkış"
            aria-label="Güvenli Çıkış"
          >
            <Icons.logout />
          </Link>
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
                <Link
                  className="actionPrimary"
                  href="/yoklama"
                >
                  <Icons.check />

                  Derse Geldim
                </Link>
              ) : (
                <>
                  <Link
                    className="actionSecondary"
                    href="/hazir-mesajlar"
                  >
                    <Icons.message />

                    Hızlı Mesaj
                  </Link>

                  <Link
                    className="actionPrimary"
                    href="/on-kayit"
                  >
                    <span>
                      +
                    </span>

                    Yeni Ön Kayıt
                  </Link>
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

                {pendingCash >
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
          </section>
        </div>
      </section>
    </main>
  );
}
