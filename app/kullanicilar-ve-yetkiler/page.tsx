import Link from "next/link";
import type {
  CSSProperties,
} from "react";

import {
  createClient,
} from "@/lib/supabase/server";

import UstGezinme from "@/app/components/UstGezinme";

import {
  createStaff,
  updateStaffProfile,
  setStaffActive,
  setLoginEnabled,
  changeStaffPassword,
  setStaffBranches,
  setSuperUser,
  setStaffPermission,
  setAllStaffPermissions,
  setAccountingPermissions,
} from "./actions";

export const dynamic =
  "force-dynamic";

type SearchParams = {
  personel?: string;
  sekme?: string;
  q?: string;
  rol?: string;
};

const ROLE_LABELS: Record<
  string,
  string
> = {
  owner: "Sistem Sahibi",
  admin: "Yönetici",
  branch_manager:
    "Şube Yöneticisi",
  registration_staff:
    "Kayıt Personeli",
  accounting: "Muhasebe",
  coach: "Eğitmen",
  guardian: "Veli",
};

const STAFF_ROLES = [
  ["admin", "Yönetici"],
  [
    "branch_manager",
    "Şube Yöneticisi",
  ],
  [
    "registration_staff",
    "Kayıt Personeli",
  ],
  ["accounting", "Muhasebe"],
  ["coach", "Eğitmen"],
  ["guardian", "Veli"],
] as const;

const MODULE_LABELS: Record<
  string,
  string
> = {
  system: "Sistem",
  dashboard: "Ana Sayfa",
  students: "Öğrenciler",
  preregistration: "Ön Kayıt",
  groups: "Gruplar",
  schedule: "Ders Programı",
  operations:
    "Operasyon Planı",
  attendance: "Yoklama",
  finance:
    "Muhasebe ve Ödemeler",
  staff: "Personel",
  accounts:
    "Giriş ve Güvenlik",
  permissions: "Yetkiler",
  reports: "Raporlar",
  branches: "Şubeler",
};

function formatPhone(
  value?: string | null
) {
  if (!value) return "—";

  let digits =
    value.replace(/\D/g, "");

  if (
    digits.startsWith("90")
  ) {
    digits =
      digits.slice(2);
  }

  if (
    digits.length === 10
  ) {
    return `0${digits.slice(
      0,
      3
    )} ${digits.slice(
      3,
      6
    )} ${digits.slice(
      6,
      8
    )} ${digits.slice(8)}`;
  }

  return value;
}

function formatDateTime(
  value?: string | null
) {
  if (!value) {
    return "Henüz kayıt yok";
  }

  return new Intl.DateTimeFormat(
    "tr-TR",
    {
      timeZone:
        "Europe/Istanbul",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }
  ).format(
    new Date(value)
  );
}

function initials(
  name?: string | null
) {
  const parts = (
    name || "K"
  )
    .trim()
    .split(/\s+/);

  if (
    parts.length === 1
  ) {
    return parts[0]
      .slice(0, 2)
      .toUpperCase();
  }

  return `${parts[0][0] || ""}${
    parts[
      parts.length - 1
    ][0] || ""
  }`.toUpperCase();
}

function buildHref(
  current: SearchParams,
  patch: Partial<SearchParams>
) {
  const params =
    new URLSearchParams();

  const merged = {
    ...current,
    ...patch,
  };

  for (const [
    key,
    value,
  ] of Object.entries(
    merged
  )) {
    if (
      typeof value ===
        "string" &&
      value
    ) {
      params.set(key, value);
    }
  }

  return `/kullanicilar-ve-yetkiler?${params.toString()}`;
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params =
    await searchParams;

  const supabase =
    await createClient();

  const {
    data: { user },
  } =
    await supabase.auth.getUser();

  if (!user) {
    return (
      <main style={{ padding: 40 }}>
        Giriş yapmanız gerekiyor.
      </main>
    );
  }

  const {
    data: currentProfile,
  } = await supabase
    .from("profiles")
    .select(
      "id, organization_id, role, is_active"
    )
    .eq("id", user.id)
    .single();

  if (
    !currentProfile ||
    !currentProfile.is_active ||
    !["owner", "admin"].includes(
      String(
        currentProfile.role
      )
    ) ||
    !currentProfile.organization_id
  ) {
    return (
      <main style={{ padding: 40 }}>
        Bu bölüme erişim
        yetkiniz bulunmuyor.
      </main>
    );
  }

  const organizationId =
    currentProfile.organization_id;

  const [
    profilesResult,
    branchesResult,
    staffResult,
    permissionDefinitionsResult,
    branchLinksResult,
    permissionsResult,
    logsResult,
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "id, full_name, email, phone, role, is_active, branch_id, last_sign_in_at"
      )
      .eq(
        "organization_id",
        organizationId
      )
      .order("full_name"),

    supabase
      .from("branches")
      .select(
        "id, name, short_name, is_active"
      )
      .eq(
        "organization_id",
        organizationId
      )
      .eq("is_active", true)
      .order("name"),

    supabase
      .from("staff")
      .select(
        "id, auth_user_id, is_active, login_enabled, is_super_user, must_change_password, all_branches"
      )
      .eq(
        "organization_id",
        organizationId
      ),

    supabase
      .from(
        "permission_definitions"
      )
      .select(
        "permission_key, module_key, label, description, sort_order"
      )
      .eq("is_active", true)
      .order("sort_order"),

    supabase
      .from(
        "staff_branches"
      )
      .select(
        "staff_id, branch_id"
      )
      .eq(
        "organization_id",
        organizationId
      ),

    supabase
      .from(
        "staff_permissions"
      )
      .select(
        "staff_id, permission_key, is_allowed"
      )
      .eq(
        "organization_id",
        organizationId
      ),

    supabase
      .from("audit_logs")
      .select(
        "id, actor_profile_id, actor_staff_id, module_key, action_key, action_label, entity_type, entity_id, description, success, metadata, created_at"
      )
      .eq(
        "organization_id",
        organizationId
      )
      .order(
        "created_at",
        {
          ascending: false,
        }
      )
      .limit(250),
  ]);

  const loadError =
    profilesResult.error ||
    branchesResult.error ||
    staffResult.error ||
    permissionDefinitionsResult.error ||
    branchLinksResult.error ||
    permissionsResult.error ||
    logsResult.error;

  if (loadError) {
    return (
      <main style={{ padding: 40 }}>
        Veriler yüklenemedi:{" "}
        {loadError.message}
      </main>
    );
  }

  const profiles =
    profilesResult.data || [];

  const branches =
    branchesResult.data || [];

  const staffRows =
    staffResult.data || [];

  const permissionDefinitions =
    permissionDefinitionsResult.data ||
    [];

  const branchLinks =
    branchLinksResult.data || [];

  const permissionRows =
    permissionsResult.data || [];

  const logs =
    logsResult.data || [];

  const staffByProfile =
    new Map(
      staffRows
        .filter(
          (item) =>
            item.auth_user_id
        )
        .map((item) => [
          item.auth_user_id,
          item,
        ])
    );

  const search =
    (params.q || "")
      .trim()
      .toLocaleLowerCase(
        "tr-TR"
      );

  const roleFilter =
    params.rol || "";

  const filteredProfiles =
    profiles.filter(
      (profile) => {
        if (
          roleFilter &&
          profile.role !==
            roleFilter
        ) {
          return false;
        }

        if (!search) {
          return true;
        }

        const value = [
          profile.full_name,
          profile.email,
          profile.phone,
          ROLE_LABELS[
            String(
              profile.role
            )
          ],
        ]
          .filter(Boolean)
          .join(" ")
          .toLocaleLowerCase(
            "tr-TR"
          );

        return value.includes(
          search
        );
      }
    );

  const selectedProfile =
    profiles.find(
      (item) =>
        item.id ===
        params.personel
    ) ||
    filteredProfiles[0] ||
    null;

  const selectedStaff =
    selectedProfile
      ? staffByProfile.get(
          selectedProfile.id
        )
      : null;

  const selectedStaffId =
    selectedStaff?.id ||
    null;

  const selectedBranches =
    new Set(
      selectedStaffId
        ? branchLinks
            .filter(
              (item) =>
                item.staff_id ===
                selectedStaffId
            )
            .map(
              (item) =>
                item.branch_id
            )
        : []
    );

  const permissionMap =
    new Map(
      selectedStaffId
        ? permissionRows
            .filter(
              (item) =>
                item.staff_id ===
                selectedStaffId
            )
            .map((item) => [
              item.permission_key,
              Boolean(
                item.is_allowed
              ),
            ])
        : []
    );

  const allowedCount =
    [...permissionMap.values()]
      .filter(Boolean)
      .length;

  const selectedLogs =
    selectedProfile
      ? logs.filter(
          (log) =>
            log.actor_profile_id ===
              selectedProfile.id ||
            (selectedStaffId &&
              log.actor_staff_id ===
                selectedStaffId) ||
            log.entity_id ===
              selectedProfile.id
        )
      : [];

  const successfulLogin =
    selectedLogs.find(
      (log) =>
        log.action_key ===
          "auth.login.success" &&
        log.success
    );

  const lastActivity =
    selectedLogs[0] || null;

  const tab =
    [
      "genel",
      "subeler",
      "yetkiler",
      "guvenlik",
      "gecmis",
    ].includes(
      params.sekme || ""
    )
      ? params.sekme!
      : "genel";

  const permissionGroups =
    permissionDefinitions.reduce<
      Record<
        string,
        typeof permissionDefinitions
      >
    >(
      (
        result,
        permission
      ) => {
        const key =
          permission.module_key ||
          "other";

        if (!result[key]) {
          result[key] = [];
        }

        result[key].push(
          permission
        );

        return result;
      },
      {}
    );

  const activeCount =
    profiles.filter(
      (item) =>
        item.is_active
    ).length;

  const superCount =
    staffRows.filter(
      (item) =>
        item.is_super_user
    ).length +
    profiles.filter(
      (item) =>
        item.role === "owner"
    ).length;

  const recentLoginCount =
    logs.filter(
      (log) =>
        log.action_key ===
          "auth.login.success" &&
        new Date(
          log.created_at
        ).getTime() >
          Date.now() -
            24 *
              60 *
              60 *
              1000
    ).length;

  return (
    <>
      <UstGezinme />

      <main
        style={
          pageStyle
        }
      >
        <div
          style={
            containerStyle
          }
        >
          <header
            style={
              headerStyle
            }
          >
            <div>
              <div
                style={
                  eyebrowStyle
                }
              >
                SPRİNT YÜZME OKULU ·
                YÖNETİM
              </div>

              <h1
                style={
                  titleStyle
                }
              >
                Personel & Yetki
                Merkezi
              </h1>

              <p
                style={
                  subtitleStyle
                }
              >
                Personelleri, giriş
                izinlerini, şubeleri,
                yetkileri ve işlem
                geçmişini tek
                ekrandan yönetin.
              </p>
            </div>

            <Link
              href={buildHref(
                params,
                {
                  personel:
                    undefined,
                  sekme:
                    undefined,
                }
              )}
              style={
                primaryButton
              }
            >
              + Yeni Personel
            </Link>
          </header>

          <section
            style={
              statsGridStyle
            }
          >
            <Stat
              title="Toplam Personel"
              value={
                profiles.length
              }
              note="Sistemde kayıtlı"
            />

            <Stat
              title="Aktif Hesap"
              value={
                activeCount
              }
              note="Girişe açık"
            />

            <Stat
              title="Süper Kullanıcı"
              value={
                superCount
              }
              note="Tam erişim"
            />

            <Stat
              title="Son 24 Saat"
              value={
                recentLoginCount
              }
              note="Başarılı giriş"
            />

            <Stat
              title="Aktif Şube"
              value={
                branches.length
              }
              note="Personel atanabilir"
            />
          </section>

          <section
            style={
              workAreaStyle
            }
          >
            <aside
              style={
                listPanelStyle
              }
            >
              <div
                style={{
                  padding: 16,
                  borderBottom:
                    "1px solid #e8eef6",
                }}
              >
                <form
                  method="get"
                  style={{
                    display:
                      "grid",
                    gap: 8,
                  }}
                >
                  <input
                    name="q"
                    defaultValue={
                      params.q ||
                      ""
                    }
                    placeholder="Personel ara..."
                    style={
                      inputStyle
                    }
                  />

                  <select
                    name="rol"
                    defaultValue={
                      roleFilter
                    }
                    style={
                      inputStyle
                    }
                  >
                    <option value="">
                      Tüm roller
                    </option>

                    {Object.entries(
                      ROLE_LABELS
                    ).map(
                      ([
                        value,
                        label,
                      ]) => (
                        <option
                          key={
                            value
                          }
                          value={
                            value
                          }
                        >
                          {
                            label
                          }
                        </option>
                      )
                    )}
                  </select>

                  <button
                    style={
                      filterButton
                    }
                  >
                    Filtrele
                  </button>
                </form>
              </div>

              <div
                style={
                  userListStyle
                }
              >
                {filteredProfiles.map(
                  (profile) => {
                    const staff =
                      staffByProfile.get(
                        profile.id
                      );

                    const staffId =
                      staff?.id;

                    const branchesCount =
                      staffId
                        ? branchLinks.filter(
                            (
                              link
                            ) =>
                              link.staff_id ===
                              staffId
                          ).length
                        : 0;

                    const permissionsCount =
                      staffId
                        ? permissionRows.filter(
                            (
                              item
                            ) =>
                              item.staff_id ===
                                staffId &&
                              item.is_allowed
                          ).length
                        : 0;

                    const active =
                      profile.id ===
                      selectedProfile?.id;

                    return (
                      <Link
                        key={
                          profile.id
                        }
                        href={buildHref(
                          params,
                          {
                            personel:
                              profile.id,
                            sekme:
                              "genel",
                          }
                        )}
                        style={{
                          ...userCardStyle,
                          borderColor:
                            active
                              ? "#1769e8"
                              : "#e5ebf3",

                          background:
                            active
                              ? "#f1f7ff"
                              : "#fff",
                        }}
                      >
                        <div
                          style={
                            avatarStyle
                          }
                        >
                          {initials(
                            profile.full_name
                          )}
                        </div>

                        <div
                          style={{
                            minWidth:
                              0,
                            flex: 1,
                          }}
                        >
                          <div
                            style={
                              userTopStyle
                            }
                          >
                            <strong
                              style={
                                userNameStyle
                              }
                            >
                              {profile.full_name ||
                                "İsimsiz Kullanıcı"}
                            </strong>

                            <span
                              style={
                                profile.is_active
                                  ? activeBadgeStyle
                                  : passiveBadgeStyle
                              }
                            >
                              {profile.is_active
                                ? "Aktif"
                                : "Pasif"}
                            </span>
                          </div>

                          <div
                            style={
                              userMetaStyle
                            }
                          >
                            {ROLE_LABELS[
                              String(
                                profile.role
                              )
                            ] ||
                              profile.role}
                          </div>

                          <div
                            style={
                              userPhoneStyle
                            }
                          >
                            {formatPhone(
                              profile.phone
                            )}
                          </div>

                          <div
                            style={
                              miniStatsStyle
                            }
                          >
                            <span>
                              🏢{" "}
                              {staff?.all_branches
                                ? "Tüm"
                                : branchesCount}{" "}
                              Şube
                            </span>

                            <span>
                              🔑{" "}
                              {
                                permissionsCount
                              }{" "}
                              Yetki
                            </span>

                            {staff?.is_super_user ||
                            profile.role ===
                              "owner" ? (
                              <span>
                                ★ Süper
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </Link>
                    );
                  }
                )}

                {!filteredProfiles.length ? (
                  <div
                    style={
                      emptyStyle
                    }
                  >
                    Personel bulunamadı.
                  </div>
                ) : null}
              </div>
            </aside>

            <section
              style={
                detailPanelStyle
              }
            >
              {!params.personel ? (
                <NewStaffPanel
                  branches={
                    branches
                  }
                  permissionGroups={
                    permissionGroups
                  }
                />
              ) : selectedProfile ? (
                <>
                  <div
                    style={
                      personHeaderStyle
                    }
                  >
                    <div
                      style={{
                        display:
                          "flex",
                        gap: 14,
                        alignItems:
                          "center",
                      }}
                    >
                      <div
                        style={
                          bigAvatarStyle
                        }
                      >
                        {initials(
                          selectedProfile.full_name
                        )}
                      </div>

                      <div>
                        <h2
                          style={{
                            margin:
                              0,
                            fontSize:
                              24,
                          }}
                        >
                          {selectedProfile.full_name ||
                            "İsimsiz Kullanıcı"}
                        </h2>

                        <div
                          style={{
                            color:
                              "#64748b",
                            marginTop:
                              5,
                            fontSize:
                              13,
                          }}
                        >
                          {ROLE_LABELS[
                            String(
                              selectedProfile.role
                            )
                          ] ||
                            selectedProfile.role}
                          {" · "}
                          {formatPhone(
                            selectedProfile.phone
                          )}
                        </div>
                      </div>
                    </div>

                    <div
                      style={
                        headerStatusStyle
                      }
                    >
                      {selectedStaff?.is_super_user ||
                      selectedProfile.role ===
                        "owner" ? (
                        <span
                          style={
                            superBadgeStyle
                          }
                        >
                          ★ Süper
                          Kullanıcı
                        </span>
                      ) : null}

                      <span
                        style={
                          selectedProfile.is_active
                            ? activeLargeBadge
                            : passiveLargeBadge
                        }
                      >
                        {selectedProfile.is_active
                          ? "● Aktif"
                          : "● Pasif"}
                      </span>
                    </div>
                  </div>

                  <nav
                    style={
                      tabsStyle
                    }
                  >
                    {[
                      [
                        "genel",
                        "Genel Bilgiler",
                      ],
                      [
                        "subeler",
                        "Şubeler",
                      ],
                      [
                        "yetkiler",
                        "Yetkiler",
                      ],
                      [
                        "guvenlik",
                        "Giriş & Güvenlik",
                      ],
                      [
                        "gecmis",
                        "İşlem Geçmişi",
                      ],
                    ].map(
                      ([
                        key,
                        label,
                      ]) => (
                        <Link
                          key={
                            key
                          }
                          href={buildHref(
                            params,
                            {
                              personel:
                                selectedProfile.id,
                              sekme:
                                key,
                            }
                          )}
                          style={{
                            ...tabStyle,
                            ...(tab ===
                            key
                              ? activeTabStyle
                              : {}),
                          }}
                        >
                          {
                            label
                          }
                        </Link>
                      )
                    )}
                  </nav>

                  <div
                    style={
                      tabContentStyle
                    }
                  >
                    {tab ===
                    "genel" ? (
                      <GeneralTab
                        profile={
                          selectedProfile
                        }
                        isOwner={
                          selectedProfile.role ===
                          "owner"
                        }
                        allowedCount={
                          allowedCount
                        }
                        branchCount={
                          selectedStaff?.all_branches
                            ? branches.length
                            : selectedBranches.size
                        }
                        lastLogin={
                          successfulLogin?.created_at ||
                          selectedProfile.last_sign_in_at
                        }
                        lastActivity={
                          lastActivity?.created_at
                        }
                      />
                    ) : null}

                    {tab ===
                    "subeler" ? (
                      <BranchesTab
                        profile={
                          selectedProfile
                        }
                        staff={
                          selectedStaff
                        }
                        branches={
                          branches
                        }
                        selectedBranches={
                          selectedBranches
                        }
                      />
                    ) : null}

                    {tab ===
                    "yetkiler" ? (
                      <PermissionsTab
                        profile={
                          selectedProfile
                        }
                        staff={
                          selectedStaff
                        }
                        permissionGroups={
                          permissionGroups
                        }
                        permissionMap={
                          permissionMap
                        }
                      />
                    ) : null}

                    {tab ===
                    "guvenlik" ? (
                      <SecurityTab
                        profile={
                          selectedProfile
                        }
                        staff={
                          selectedStaff
                        }
                        lastLogin={
                          successfulLogin?.created_at ||
                          selectedProfile.last_sign_in_at
                        }
                      />
                    ) : null}

                    {tab ===
                    "gecmis" ? (
                      <HistoryTab
                        logs={
                          selectedLogs
                        }
                      />
                    ) : null}
                  </div>
                </>
              ) : (
                <div
                  style={
                    emptyStyle
                  }
                >
                  Personel bulunamadı.
                </div>
              )}
            </section>
          </section>
        </div>
      </main>
    </>
  );
}

function NewStaffPanel({
  branches,
  permissionGroups,
}: {
  branches: any[];
  permissionGroups: Record<
    string,
    any[]
  >;
}) {
  return (
    <div
      style={{
        padding: 24,
      }}
    >
      <div
        style={
          sectionEyebrowStyle
        }
      >
        YENİ PERSONEL
      </div>

      <h2
        style={
          panelTitleStyle
        }
      >
        Personel hesabı oluştur
      </h2>

      <p
        style={
          panelTextStyle
        }
      >
        Telefon, şifre, rol,
        şube ve başlangıç
        yetkilerini tek işlemde
        tanımlayın.
      </p>

      <form
        action={createStaff}
      >
        <div
          style={
            formGridStyle
          }
        >
          <Field
            label="Ad Soyad"
            name="full_name"
            required
          />

          <Field
            label="Telefon"
            name="phone"
            placeholder="05436048006"
          />

          <Field
            label="E-posta"
            name="email"
            type="email"
          />

          <Field
            label="Geçici Şifre"
            name="password"
            type="password"
            required
            minLength={8}
          />

          <label
            style={
              fieldStyle
            }
          >
            <span>
              Görev / Rol
            </span>

            <select
              name="role"
              required
              defaultValue=""
              style={
                inputStyle
              }
            >
              <option
                value=""
                disabled
              >
                Rol seçin
              </option>

              {STAFF_ROLES.map(
                ([
                  value,
                  label,
                ]) => (
                  <option
                    key={
                      value
                    }
                    value={
                      value
                    }
                  >
                    {
                      label
                    }
                  </option>
                )
              )}
            </select>
          </label>
        </div>

        <div
          style={
            subSectionStyle
          }
        >
          <h3>
            Çalışabileceği Şubeler
          </h3>

          <label
            style={
              checkCardStyle
            }
          >
            <input
              type="checkbox"
              name="all_branches"
              value="true"
            />

            <strong>
              Tüm Şubeler
            </strong>
          </label>

          <div
            style={
              checksGridStyle
            }
          >
            {branches.map(
              (branch) => (
                <label
                  key={
                    branch.id
                  }
                  style={
                    checkCardStyle
                  }
                >
                  <input
                    type="checkbox"
                    name="branch_ids"
                    value={
                      branch.id
                    }
                  />

                  {
                    branch.name
                  }
                </label>
              )
            )}
          </div>
        </div>

        <div
          style={
            subSectionStyle
          }
        >
          <h3>
            Başlangıç Yetkileri
          </h3>

          {Object.entries(
            permissionGroups
          ).map(
            ([
              moduleKey,
              permissions,
            ]) => (
              <div
                key={
                  moduleKey
                }
                style={{
                  marginBottom:
                    18,
                }}
              >
                <div
                  style={
                    moduleTitleStyle
                  }
                >
                  {MODULE_LABELS[
                    moduleKey
                  ] ||
                    moduleKey}
                </div>

                <div
                  style={
                    checksGridStyle
                  }
                >
                  {permissions.map(
                    (
                      permission
                    ) => (
                      <label
                        key={
                          permission.permission_key
                        }
                        style={
                          checkCardStyle
                        }
                      >
                        <input
                          type="checkbox"
                          name="permission_keys"
                          value={
                            permission.permission_key
                          }
                        />

                        <span>
                          {
                            permission.label
                          }
                        </span>
                      </label>
                    )
                  )}
                </div>
              </div>
            )
          )}
        </div>

        <button
          style={
            primaryButton
          }
        >
          + Personeli Oluştur
        </button>
      </form>
    </div>
  );
}

function GeneralTab({
  profile,
  isOwner,
  allowedCount,
  branchCount,
  lastLogin,
  lastActivity,
}: any) {
  return (
    <>
      <div
        style={
          infoGridStyle
        }
      >
        <Info
          title="Hesap Durumu"
          value={
            profile.is_active
              ? "Aktif"
              : "Pasif"
          }
        />

        <Info
          title="Şube Sayısı"
          value={
            String(
              branchCount
            )
          }
        />

        <Info
          title="Aktif Yetki"
          value={
            String(
              allowedCount
            )
          }
        />

        <Info
          title="Son Giriş"
          value={formatDateTime(
            lastLogin
          )}
        />

        <Info
          title="Son Hareket"
          value={formatDateTime(
            lastActivity
          )}
        />
      </div>

      {isOwner ? (
        <div
          style={
            ownerWarningStyle
          }
        >
          Sistem Sahibi hesabının
          rolü ve temel erişimleri
          buradan kapatılamaz.
        </div>
      ) : (
        <form
          action={
            updateStaffProfile
          }
          style={{
            marginTop: 22,
          }}
        >
          <input
            type="hidden"
            name="staff_id"
            value={
              profile.id
            }
          />

          <div
            style={
              formGridStyle
            }
          >
            <Field
              label="Ad Soyad"
              name="full_name"
              defaultValue={
                profile.full_name ||
                ""
              }
              required
            />

            <Field
              label="Telefon"
              name="phone"
              defaultValue={
                profile.phone || ""
              }
            />

            <Field
              label="E-posta"
              name="email"
              type="email"
              defaultValue={
                profile.email || ""
              }
            />

            <label
              style={
                fieldStyle
              }
            >
              <span>
                Görev / Rol
              </span>

              <select
                name="role"
                defaultValue={
                  profile.role
                }
                style={
                  inputStyle
                }
              >
                {STAFF_ROLES.map(
                  ([
                    value,
                    label,
                  ]) => (
                    <option
                      key={
                        value
                      }
                      value={
                        value
                      }
                    >
                      {
                        label
                      }
                    </option>
                  )
                )}
              </select>
            </label>
          </div>

          <button
            style={{
              ...primaryButton,
              marginTop: 14,
            }}
          >
            Bilgileri Kaydet
          </button>
        </form>
      )}
    </>
  );
}

function BranchesTab({
  profile,
  staff,
  branches,
  selectedBranches,
}: any) {
  if (
    profile.role === "owner"
  ) {
    return (
      <div
        style={
          ownerWarningStyle
        }
      >
        Sistem Sahibi tüm şubelere
        erişebilir.
      </div>
    );
  }

  return (
    <form
      action={
        setStaffBranches
      }
    >
      <input
        type="hidden"
        name="staff_id"
        value={
          profile.id
        }
      />

      <h3
        style={
          contentTitleStyle
        }
      >
        Çalışabileceği Şubeler
      </h3>

      <p
        style={
          panelTextStyle
        }
      >
        Bu personelin görev
        alabileceği havuz ve
        şubeleri belirleyin.
      </p>

      <label
        style={
          checkCardStyle
        }
      >
        <input
          type="checkbox"
          name="all_branches"
          value="true"
          defaultChecked={
            Boolean(
              staff?.all_branches
            )
          }
        />

        <strong>
          Tüm Şubeler
        </strong>
      </label>

      <div
        style={{
          ...checksGridStyle,
          marginTop: 10,
        }}
      >
        {branches.map(
          (branch: any) => (
            <label
              key={
                branch.id
              }
              style={
                checkCardStyle
              }
            >
              <input
                type="checkbox"
                name="branch_ids"
                value={
                  branch.id
                }
                defaultChecked={
                  selectedBranches.has(
                    branch.id
                  )
                }
              />

              {
                branch.name
              }
            </label>
          )
        )}
      </div>

      <button
        style={{
          ...primaryButton,
          marginTop: 16,
        }}
      >
        Şube Yetkilerini Kaydet
      </button>
    </form>
  );
}

function PermissionsTab({
  profile,
  staff,
  permissionGroups,
  permissionMap,
}: any) {
  if (
    profile.role === "owner"
  ) {
    return (
      <div
        style={
          ownerWarningStyle
        }
      >
        Sistem Sahibi tüm yetkilere
        sahiptir.
      </div>
    );
  }

  const superUser =
    Boolean(
      staff?.is_super_user
    ) ||
    permissionMap.get(
      "system.superuser"
    ) === true;

  return (
    <>
      <div
        style={
          quickControlsStyle
        }
      >
        <ToggleAction
          title="Süper Kullanıcı"
          description="Tüm yönetim yetkilerine tam erişim."
          active={
            superUser
          }
          action={
            setSuperUser
          }
          staffId={
            profile.id
          }
          fieldName="is_super_user"
        />

        <SimpleAction
          title="Tüm Standart Yetkiler"
          description="Süper kullanıcı durumunu değiştirmeden tüm normal yetkileri aç/kapat."
          staffId={
            profile.id
          }
          action={
            setAllStaffPermissions
          }
        />

        <SimpleAction
          title="Muhasebe"
          description="Ödeme, kasa ve finansal rapor yetkilerini toplu yönet."
          staffId={
            profile.id
          }
          action={
            setAccountingPermissions
          }
        />
      </div>

      {Object.entries(
        permissionGroups
      ).map(
        ([
          moduleKey,
          permissions,
        ]: any) => (
          <section
            key={
              moduleKey
            }
            style={
              permissionSectionStyle
            }
          >
            <h3
              style={
                moduleHeadingStyle
              }
            >
              {MODULE_LABELS[
                moduleKey
              ] ||
                moduleKey}
            </h3>

            <div
              style={
                permissionListStyle
              }
            >
              {permissions.map(
                (
                  permission: any
                ) => {
                  const active =
                    permissionMap.get(
                      permission.permission_key
                    ) === true;

                  return (
                    <form
                      key={
                        permission.permission_key
                      }
                      action={
                        setStaffPermission
                      }
                    >
                      <input
                        type="hidden"
                        name="staff_id"
                        value={
                          profile.id
                        }
                      />

                      <input
                        type="hidden"
                        name="permission_key"
                        value={
                          permission.permission_key
                        }
                      />

                      <input
                        type="hidden"
                        name="is_allowed"
                        value={
                          active
                            ? "false"
                            : "true"
                        }
                      />

                      <button
                        style={
                          permissionRowStyle
                        }
                      >
                        <span>
                          <strong
                            style={{
                              display:
                                "block",
                            }}
                          >
                            {
                              permission.label
                            }
                          </strong>

                          {permission.description ? (
                            <small
                              style={
                                permissionDescriptionStyle
                              }
                            >
                              {
                                permission.description
                              }
                            </small>
                          ) : null}
                        </span>

                        <span
                          style={{
                            ...switchTrackStyle,
                            background:
                              active
                                ? "#1769e8"
                                : "#cbd5e1",
                          }}
                        >
                          <span
                            style={{
                              ...switchKnobStyle,
                              transform:
                                active
                                  ? "translateX(20px)"
                                  : "translateX(0)",
                            }}
                          />
                        </span>
                      </button>
                    </form>
                  );
                }
              )}
            </div>
          </section>
        )
      )}
    </>
  );
}

function SecurityTab({
  profile,
  staff,
  lastLogin,
}: any) {
  if (
    profile.role === "owner"
  ) {
    return (
      <>
        <Info
          title="Giriş İzni"
          value="Açık"
        />

        <Info
          title="Son Giriş"
          value={formatDateTime(
            lastLogin
          )}
        />
      </>
    );
  }

  const loginEnabled =
    staff?.login_enabled !==
    false;

  return (
    <>
      <div
        style={
          securityGridStyle
        }
      >
        <div
          style={
            securityCardStyle
          }
        >
          <div>
            <strong>
              Sisteme Giriş
            </strong>

            <p>
              Bu kişinin SprintOS
              hesabına giriş yapıp
              yapamayacağını kontrol
              eder.
            </p>
          </div>

          <form
            action={
              setLoginEnabled
            }
          >
            <input
              type="hidden"
              name="staff_id"
              value={
                profile.id
              }
            />

            <input
              type="hidden"
              name="login_enabled"
              value={
                loginEnabled
                  ? "false"
                  : "true"
              }
            />

            <button
              style={
                loginEnabled
                  ? greenButtonStyle
                  : grayButtonStyle
              }
            >
              {loginEnabled
                ? "AÇIK"
                : "KAPALI"}
            </button>
          </form>
        </div>

        <div
          style={
            securityCardStyle
          }
        >
          <div>
            <strong>
              Hesap Durumu
            </strong>

            <p>
              Hesabı tamamen aktif
              veya pasif hale getirir.
            </p>
          </div>

          <form
            action={
              setStaffActive
            }
          >
            <input
              type="hidden"
              name="staff_id"
              value={
                profile.id
              }
            />

            <input
              type="hidden"
              name="is_active"
              value={
                profile.is_active
                  ? "false"
                  : "true"
              }
            />

            <button
              style={
                profile.is_active
                  ? greenButtonStyle
                  : redButtonStyle
              }
            >
              {profile.is_active
                ? "AKTİF"
                : "PASİF"}
            </button>
          </form>
        </div>
      </div>

      <div
        style={
          loginInfoStyle
        }
      >
        <Info
          title="Telefon"
          value={formatPhone(
            profile.phone
          )}
        />

        <Info
          title="E-posta"
          value={
            profile.email || "—"
          }
        />

        <Info
          title="Son Giriş"
          value={formatDateTime(
            lastLogin
          )}
        />

        <Info
          title="İlk Girişte Şifre Değişimi"
          value={
            staff?.must_change_password
              ? "Gerekli"
              : "Tamamlandı"
          }
        />
      </div>

      <form
        action={
          changeStaffPassword
        }
        style={
          passwordPanelStyle
        }
      >
        <input
          type="hidden"
          name="staff_id"
          value={
            profile.id
          }
        />

        <div>
          <strong>
            Yeni / Geçici Şifre
          </strong>

          <p
            style={
              panelTextStyle
            }
          >
            Yönetici yeni bir geçici
            şifre oluşturabilir.
          </p>
        </div>

        <input
          name="password"
          type="password"
          required
          minLength={8}
          placeholder="En az 8 karakter"
          style={{
            ...inputStyle,
            maxWidth: 300,
          }}
        />

        <button
          style={
            primaryButton
          }
        >
          Şifreyi Değiştir
        </button>
      </form>
    </>
  );
}

function HistoryTab({
  logs,
}: {
  logs: any[];
}) {
  return (
    <>
      <h3
        style={
          contentTitleStyle
        }
      >
        İşlem Geçmişi
      </h3>

      <p
        style={
          panelTextStyle
        }
      >
        Giriş, yetki, şube, hesap ve
        diğer önemli yönetim
        işlemleri tarih sırasıyla
        kayıt altında tutulur.
      </p>

      <div
        style={
          timelineStyle
        }
      >
        {logs.map(
          (log) => (
            <div
              key={
                log.id
              }
              style={
                timelineItemStyle
              }
            >
              <div
                style={
                  timelineDotStyle
                }
              />

              <div
                style={{
                  flex: 1,
                }}
              >
                <div
                  style={
                    timelineTopStyle
                  }
                >
                  <strong>
                    {log.action_label}
                  </strong>

                  <time>
                    {formatDateTime(
                      log.created_at
                    )}
                  </time>
                </div>

                {log.description ? (
                  <div
                    style={
                      timelineDescriptionStyle
                    }
                  >
                    {
                      log.description
                    }
                  </div>
                ) : null}

                <div
                  style={
                    timelineMetaStyle
                  }
                >
                  {log.module_key}
                  {" · "}
                  {log.action_key}
                </div>
              </div>
            </div>
          )
        )}

        {!logs.length ? (
          <div
            style={
              emptyStyle
            }
          >
            Henüz işlem kaydı
            bulunmuyor.
          </div>
        ) : null}
      </div>
    </>
  );
}

function ToggleAction({
  title,
  description,
  active,
  action,
  staffId,
  fieldName,
}: any) {
  return (
    <div
      style={
        quickCardStyle
      }
    >
      <div>
        <strong>
          {title}
        </strong>

        <p>
          {description}
        </p>
      </div>

      <form
        action={
          action
        }
      >
        <input
          type="hidden"
          name="staff_id"
          value={
            staffId
          }
        />

        <input
          type="hidden"
          name={
            fieldName
          }
          value={
            active
              ? "false"
              : "true"
          }
        />

        <button
          style={
            active
              ? greenButtonStyle
              : grayButtonStyle
          }
        >
          {active
            ? "AÇIK"
            : "KAPALI"}
        </button>
      </form>
    </div>
  );
}

function SimpleAction({
  title,
  description,
  staffId,
  action,
}: any) {
  return (
    <div
      style={
        quickCardStyle
      }
    >
      <div>
        <strong>
          {title}
        </strong>

        <p>
          {description}
        </p>
      </div>

      <div
        style={{
          display: "flex",
          gap: 6,
        }}
      >
        <form
          action={
            action
          }
        >
          <input
            type="hidden"
            name="staff_id"
            value={
              staffId
            }
          />

          <input
            type="hidden"
            name="is_allowed"
            value="true"
          />

          <button
            style={
              greenButtonStyle
            }
          >
            Aç
          </button>
        </form>

        <form
          action={
            action
          }
        >
          <input
            type="hidden"
            name="staff_id"
            value={
              staffId
            }
          />

          <input
            type="hidden"
            name="is_allowed"
            value="false"
          />

          <button
            style={
              redButtonStyle
            }
          >
            Kapat
          </button>
        </form>
      </div>
    </div>
  );
}

function Stat({
  title,
  value,
  note,
}: any) {
  return (
    <article
      style={
        statCardStyle
      }
    >
      <span>
        {title}
      </span>

      <strong>
        {value}
      </strong>

      <small>
        {note}
      </small>
    </article>
  );
}

function Info({
  title,
  value,
}: any) {
  return (
    <div
      style={
        infoCardStyle
      }
    >
      <span>
        {title}
      </span>

      <strong>
        {value}
      </strong>
    </div>
  );
}

function Field({
  label,
  ...props
}: any) {
  return (
    <label
      style={
        fieldStyle
      }
    >
      <span>
        {label}
      </span>

      <input
        {...props}
        style={
          inputStyle
        }
      />
    </label>
  );
}

/* =========================================================
   STYLES
========================================================= */

const pageStyle:
  CSSProperties = {
  minHeight: "100vh",
  background: "#f4f7fb",
  padding: "28px",
  color: "#13233f",
};

const containerStyle:
  CSSProperties = {
  maxWidth: 1580,
  margin: "0 auto",
};

const headerStyle:
  CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 20,
  alignItems: "center",
  flexWrap: "wrap",
  marginBottom: 20,
};

const eyebrowStyle:
  CSSProperties = {
  fontSize: 11,
  fontWeight: 900,
  color: "#1769e8",
  letterSpacing: 1.2,
};

const titleStyle:
  CSSProperties = {
  margin: "6px 0 0",
  fontSize: 32,
};

const subtitleStyle:
  CSSProperties = {
  margin: "7px 0 0",
  color: "#64748b",
  fontSize: 14,
};

const statsGridStyle:
  CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit,minmax(160px,1fr))",
  gap: 10,
  marginBottom: 16,
};

const statCardStyle:
  CSSProperties = {
  background: "#fff",
  border: "1px solid #e3eaf3",
  borderRadius: 15,
  padding: 16,
};

const workAreaStyle:
  CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "360px minmax(0,1fr)",
  gap: 14,
  alignItems: "start",
};

const listPanelStyle:
  CSSProperties = {
  background: "#fff",
  border: "1px solid #e2e8f0",
  borderRadius: 18,
  overflow: "hidden",
};

const userListStyle:
  CSSProperties = {
  padding: 9,
  display: "grid",
  gap: 8,
  maxHeight: "78vh",
  overflowY: "auto",
};

const userCardStyle:
  CSSProperties = {
  display: "flex",
  gap: 11,
  alignItems: "flex-start",
  padding: 12,
  border: "1px solid #e5ebf3",
  borderRadius: 13,
  textDecoration: "none",
  color: "#13233f",
};

const avatarStyle:
  CSSProperties = {
  width: 42,
  height: 42,
  borderRadius: 12,
  background: "#eaf3ff",
  color: "#1769e8",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontWeight: 900,
  flexShrink: 0,
};

const bigAvatarStyle:
  CSSProperties = {
  width: 58,
  height: 58,
  borderRadius: 16,
  background: "#eaf3ff",
  color: "#1769e8",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontWeight: 900,
  fontSize: 20,
};

const userTopStyle:
  CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
};

const userNameStyle:
  CSSProperties = {
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const userMetaStyle:
  CSSProperties = {
  color: "#64748b",
  fontSize: 11,
  marginTop: 3,
};

const userPhoneStyle:
  CSSProperties = {
  color: "#334155",
  fontSize: 11,
  marginTop: 3,
};

const miniStatsStyle:
  CSSProperties = {
  display: "flex",
  gap: 9,
  flexWrap: "wrap",
  color: "#64748b",
  fontSize: 9,
  marginTop: 7,
};

const activeBadgeStyle:
  CSSProperties = {
  fontSize: 9,
  fontWeight: 900,
  background: "#dcfce7",
  color: "#166534",
  padding: "4px 7px",
  borderRadius: 999,
};

const passiveBadgeStyle:
  CSSProperties = {
  ...activeBadgeStyle,
  background: "#fee2e2",
  color: "#991b1b",
};

const detailPanelStyle:
  CSSProperties = {
  background: "#fff",
  border: "1px solid #e2e8f0",
  borderRadius: 18,
  overflow: "hidden",
  minHeight: 600,
};

const personHeaderStyle:
  CSSProperties = {
  padding: 20,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 16,
  flexWrap: "wrap",
  borderBottom: "1px solid #e8eef6",
};

const headerStatusStyle:
  CSSProperties = {
  display: "flex",
  gap: 7,
  flexWrap: "wrap",
};

const superBadgeStyle:
  CSSProperties = {
  padding: "7px 10px",
  borderRadius: 999,
  background: "#eef2ff",
  color: "#4338ca",
  fontSize: 11,
  fontWeight: 850,
};

const activeLargeBadge:
  CSSProperties = {
  padding: "7px 10px",
  borderRadius: 999,
  background: "#dcfce7",
  color: "#166534",
  fontSize: 11,
  fontWeight: 850,
};

const passiveLargeBadge:
  CSSProperties = {
  ...activeLargeBadge,
  background: "#fee2e2",
  color: "#991b1b",
};

const tabsStyle:
  CSSProperties = {
  display: "flex",
  gap: 4,
  padding: "10px 14px",
  borderBottom: "1px solid #e8eef6",
  overflowX: "auto",
};

const tabStyle:
  CSSProperties = {
  whiteSpace: "nowrap",
  textDecoration: "none",
  color: "#64748b",
  fontSize: 12,
  fontWeight: 800,
  padding: "9px 11px",
  borderRadius: 8,
};

const activeTabStyle:
  CSSProperties = {
  background: "#1769e8",
  color: "#fff",
};

const tabContentStyle:
  CSSProperties = {
  padding: 22,
};

const inputStyle:
  CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  border: "1px solid #d9e3ef",
  borderRadius: 10,
  background: "#fff",
  padding: "11px 12px",
  color: "#13233f",
};

const fieldStyle:
  CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
  fontSize: 11,
  fontWeight: 800,
  color: "#64748b",
};

const formGridStyle:
  CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit,minmax(190px,1fr))",
  gap: 10,
};

const primaryButton:
  CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  textDecoration: "none",
  border: 0,
  borderRadius: 10,
  background: "#1769e8",
  color: "#fff",
  padding: "11px 15px",
  fontWeight: 850,
  fontSize: 12,
  cursor: "pointer",
};

const filterButton:
  CSSProperties = {
  ...primaryButton,
  width: "100%",
};

const sectionEyebrowStyle:
  CSSProperties = {
  color: "#1769e8",
  fontSize: 10,
  fontWeight: 900,
  letterSpacing: 1,
};

const panelTitleStyle:
  CSSProperties = {
  margin: "5px 0 0",
};

const panelTextStyle:
  CSSProperties = {
  color: "#64748b",
  fontSize: 12,
  lineHeight: 1.5,
};

const subSectionStyle:
  CSSProperties = {
  marginTop: 20,
  paddingTop: 18,
  borderTop: "1px solid #edf1f6",
};

const checksGridStyle:
  CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit,minmax(180px,1fr))",
  gap: 7,
};

const checkCardStyle:
  CSSProperties = {
  display: "flex",
  gap: 8,
  alignItems: "center",
  padding: "9px 10px",
  border: "1px solid #e3eaf2",
  borderRadius: 9,
  background: "#fafcff",
  fontSize: 11,
};

const moduleTitleStyle:
  CSSProperties = {
  color: "#64748b",
  fontSize: 10,
  fontWeight: 900,
  textTransform: "uppercase",
  marginBottom: 7,
};

const infoGridStyle:
  CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit,minmax(150px,1fr))",
  gap: 9,
};

const infoCardStyle:
  CSSProperties = {
  border: "1px solid #e5ebf3",
  borderRadius: 11,
  padding: 12,
  background: "#fafcff",
};

const ownerWarningStyle:
  CSSProperties = {
  padding: 15,
  borderRadius: 11,
  background: "#fff7ed",
  border: "1px solid #fed7aa",
  color: "#9a3412",
  fontSize: 12,
  fontWeight: 750,
};

const quickControlsStyle:
  CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit,minmax(230px,1fr))",
  gap: 9,
  marginBottom: 22,
};

const quickCardStyle:
  CSSProperties = {
  border: "1px solid #e3eaf2",
  borderRadius: 12,
  padding: 13,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 10,
};

const greenButtonStyle:
  CSSProperties = {
  border: 0,
  borderRadius: 8,
  padding: "8px 10px",
  background: "#dcfce7",
  color: "#166534",
  fontWeight: 900,
  cursor: "pointer",
};

const redButtonStyle:
  CSSProperties = {
  ...greenButtonStyle,
  background: "#fee2e2",
  color: "#991b1b",
};

const grayButtonStyle:
  CSSProperties = {
  ...greenButtonStyle,
  background: "#f1f5f9",
  color: "#475569",
};

const permissionSectionStyle:
  CSSProperties = {
  marginBottom: 20,
};

const moduleHeadingStyle:
  CSSProperties = {
  margin: "0 0 8px",
  fontSize: 13,
};

const permissionListStyle:
  CSSProperties = {
  display: "grid",
  gap: 6,
};

const permissionRowStyle:
  CSSProperties = {
  width: "100%",
  border: "1px solid #e5ebf3",
  borderRadius: 10,
  background: "#fff",
  padding: "11px 12px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  textAlign: "left",
  color: "#13233f",
  cursor: "pointer",
};

const permissionDescriptionStyle:
  CSSProperties = {
  color: "#64748b",
  fontWeight: 500,
};

const switchTrackStyle:
  CSSProperties = {
  position: "relative",
  display: "inline-flex",
  alignItems: "center",
  width: 42,
  height: 22,
  borderRadius: 999,
  padding: 2,
  transition: ".2s",
  flexShrink: 0,
};

const switchKnobStyle:
  CSSProperties = {
  width: 18,
  height: 18,
  borderRadius: "50%",
  background: "#fff",
  boxShadow: "0 1px 4px rgba(15,23,42,.25)",
  transition: ".2s",
};

const securityGridStyle:
  CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit,minmax(250px,1fr))",
  gap: 10,
};

const securityCardStyle:
  CSSProperties = {
  border: "1px solid #e3eaf2",
  borderRadius: 12,
  padding: 14,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 10,
};

const loginInfoStyle:
  CSSProperties = {
  ...infoGridStyle,
  marginTop: 16,
};

const passwordPanelStyle:
  CSSProperties = {
  marginTop: 18,
  paddingTop: 18,
  borderTop: "1px solid #edf1f6",
  display: "flex",
  gap: 12,
  alignItems: "center",
  flexWrap: "wrap",
};

const contentTitleStyle:
  CSSProperties = {
  margin: 0,
  fontSize: 17,
};

const timelineStyle:
  CSSProperties = {
  display: "grid",
  gap: 9,
  marginTop: 16,
};

const timelineItemStyle:
  CSSProperties = {
  display: "flex",
  gap: 10,
  padding: 13,
  border: "1px solid #e5ebf3",
  borderRadius: 11,
};

const timelineDotStyle:
  CSSProperties = {
  width: 10,
  height: 10,
  borderRadius: "50%",
  background: "#1769e8",
  marginTop: 5,
  flexShrink: 0,
};

const timelineTopStyle:
  CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 10,
  fontSize: 12,
};

const timelineDescriptionStyle:
  CSSProperties = {
  color: "#475569",
  fontSize: 11,
  marginTop: 5,
};

const timelineMetaStyle:
  CSSProperties = {
  color: "#94a3b8",
  fontSize: 9,
  marginTop: 5,
};

const emptyStyle:
  CSSProperties = {
  padding: 25,
  textAlign: "center",
  color: "#94a3b8",
};
