import Link from "next/link";
import type { CSSProperties } from "react";

import { createClient } from "@/lib/supabase/server";

import {
  createStaff,
  updateStaffProfile,
  setStaffActive,
  changeStaffPassword,
  setStaffBranches,
  setStaffPermission,
  setAllStaffPermissions,
  setAccountingPermissions,
} from "./actions";

export const dynamic = "force-dynamic";

const ROLE_LABELS: Record<string, string> = {
  owner: "Sistem Sahibi",
  admin: "Yönetici",
  branch_manager: "Şube Yöneticisi",
  registration_staff: "Kayıt Personeli",
  accounting: "Muhasebe",
  coach: "Eğitmen",
  guardian: "Veli",
};

const STAFF_ROLES = [
  ["admin", "Yönetici"],
  ["branch_manager", "Şube Yöneticisi"],
  ["registration_staff", "Kayıt Personeli"],
  ["accounting", "Muhasebe"],
  ["coach", "Eğitmen"],
  ["guardian", "Veli"],
] as const;

const MODULE_LABELS: Record<string, string> = {
  system: "Sistem",
  dashboard: "Ana Sayfa",
  students: "Öğrenciler",
  preregistration: "Ön Kayıt",
  groups: "Gruplar",
  schedule: "Ders Programı",
  operations: "Operasyon Planı",
  attendance: "Yoklama",
  finance: "Muhasebe ve Ödemeler",
  accounting: "Muhasebe",
  payments: "Ödemeler",
  cash: "Günlük Kasa",
  staff: "Personel",
  accounts: "Kullanıcı Hesapları",
  permissions: "Yetkiler",
  reports: "Raporlar",
  branches: "Şubeler",
};

const card: CSSProperties = {
  background: "#fff",
  border: "1px solid #e3eaf3",
  borderRadius: 18,
  padding: 22,
  boxShadow: "0 8px 25px rgba(15,23,42,.05)",
};

const input: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "12px 13px",
  borderRadius: 10,
  border: "1px solid #d7e0ec",
  background: "#fff",
  color: "#13233f",
  fontSize: 14,
};

const blueButton: CSSProperties = {
  border: 0,
  borderRadius: 10,
  padding: "11px 16px",
  background: "#1769e8",
  color: "#fff",
  fontWeight: 800,
  cursor: "pointer",
};

const whiteButton: CSSProperties = {
  border: "1px solid #d7e0ec",
  borderRadius: 10,
  padding: "10px 14px",
  background: "#fff",
  color: "#334155",
  fontWeight: 750,
  cursor: "pointer",
};

export default async function Page() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <main style={{ padding: 40 }}>
        Giriş yapmanız gerekiyor.
      </main>
    );
  }

  const { data: currentProfile } =
    await supabase
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
      String(currentProfile.role)
    )
  ) {
    return (
      <main style={{ padding: 40 }}>
        Bu bölüme erişim yetkiniz bulunmuyor.
      </main>
    );
  }

  const organizationId =
    currentProfile.organization_id;

  if (!organizationId) {
    return (
      <main style={{ padding: 40 }}>
        Organizasyon bulunamadı.
      </main>
    );
  }

  const [
    profilesResult,
    branchesResult,
    permissionsResult,
    staffResult,
    staffBranchesResult,
    staffPermissionsResult,
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
      .order("name"),

    supabase
      .from("permission_definitions")
      .select(
        "permission_key, module_key, label, description, sort_order, is_active"
      )
      .eq("is_active", true)
      .order("sort_order"),

    supabase
      .from("staff")
      .select(
        "id, auth_user_id, is_super_user, all_branches, login_enabled, must_change_password"
      )
      .eq(
        "organization_id",
        organizationId
      ),

    supabase
      .from("staff_branches")
      .select(
        "staff_id, branch_id"
      )
      .eq(
        "organization_id",
        organizationId
      ),

    supabase
      .from("staff_permissions")
      .select(
        "staff_id, permission_key, is_allowed"
      )
      .eq(
        "organization_id",
        organizationId
      ),
  ]);

  const error =
    profilesResult.error ||
    branchesResult.error ||
    permissionsResult.error ||
    staffResult.error ||
    staffBranchesResult.error ||
    staffPermissionsResult.error;

  if (error) {
    return (
      <main style={{ padding: 40 }}>
        <h1>Kullanıcılar ve Yetkiler</h1>
        <p style={{ color: "#b91c1c" }}>
          Veriler yüklenemedi: {error.message}
        </p>
      </main>
    );
  }

  const profiles =
    profilesResult.data ?? [];

  const branches =
    branchesResult.data ?? [];

  const permissions =
    permissionsResult.data ?? [];

  const staffRows =
    staffResult.data ?? [];

  const staffBranches =
    staffBranchesResult.data ?? [];

  const staffPermissions =
    staffPermissionsResult.data ?? [];

  const staffByAuthUser =
    new Map(
      staffRows.map((staff) => [
        staff.auth_user_id,
        staff,
      ])
    );

  const permissionGroups =
    permissions.reduce<
      Record<string, typeof permissions>
    >((result, permission) => {
      const key =
        permission.module_key || "other";

      if (!result[key]) {
        result[key] = [];
      }

      result[key].push(permission);

      return result;
    }, {});

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f4f7fc",
        padding: 30,
        color: "#13233f",
        fontFamily:
          "Inter,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
      }}
    >
      <div
        style={{
          maxWidth: 1450,
          margin: "0 auto",
        }}
      >
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 20,
            flexWrap: "wrap",
            marginBottom: 24,
          }}
        >
          <div>
            <div
              style={{
                color: "#1769e8",
                fontSize: 12,
                fontWeight: 900,
                letterSpacing: 1,
              }}
            >
              SPRİNT YÜZME OKULU · SPRINTOS
            </div>

            <h1
              style={{
                margin: "6px 0 0",
                fontSize: 32,
              }}
            >
              Kullanıcılar ve Yetkiler
            </h1>

            <p
              style={{
                color: "#64748b",
                margin: "7px 0 0",
              }}
            >
              Personel, giriş, şube ve yetkileri
              tek merkezden yönetin.
            </p>
          </div>

          <div
            style={{
              display: "flex",
              gap: 8,
            }}
          >
            <Link
              href="/operasyon-plani"
              style={{
                ...whiteButton,
                textDecoration: "none",
              }}
            >
              Operasyon Planı
            </Link>

            <Link
              href="/"
              style={{
                ...blueButton,
                textDecoration: "none",
              }}
            >
              Ana Sayfa
            </Link>
          </div>
        </header>

        <section
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit,minmax(180px,1fr))",
            gap: 12,
            marginBottom: 22,
          }}
        >
          {[
            [
              "Toplam Kullanıcı",
              profiles.length,
            ],
            [
              "Aktif Kullanıcı",
              profiles.filter(
                (x) => x.is_active
              ).length,
            ],
            [
              "Eğitmen",
              profiles.filter(
                (x) => x.role === "coach"
              ).length,
            ],
            [
              "Aktif Şube",
              branches.filter(
                (x) => x.is_active
              ).length,
            ],
            [
              "Tanımlı Yetki",
              permissions.length,
            ],
          ].map(([title, number]) => (
            <div
              key={String(title)}
              style={card}
            >
              <strong
                style={{
                  fontSize: 28,
                }}
              >
                {number}
              </strong>

              <div
                style={{
                  color: "#64748b",
                  fontSize: 13,
                  marginTop: 5,
                }}
              >
                {title}
              </div>
            </div>
          ))}
        </section>

        <section
          style={{
            ...card,
            marginBottom: 22,
          }}
        >
          <div
            style={{
              color: "#1769e8",
              fontWeight: 900,
              fontSize: 12,
              letterSpacing: 1,
            }}
          >
            YENİ PERSONEL / KULLANICI
          </div>

          <h2
            style={{
              margin: "6px 0 4px",
            }}
          >
            Yeni Kullanıcı Oluştur
          </h2>

          <p
            style={{
              color: "#64748b",
              marginTop: 0,
            }}
          >
            Hesap, şifre, şube ve yetkileri
            birlikte oluşturun.
          </p>

          <form action={createStaff}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit,minmax(200px,1fr))",
                gap: 10,
              }}
            >
              <input
                name="full_name"
                required
                placeholder="Ad Soyad"
                style={input}
              />

              <input
                name="email"
                type="email"
                placeholder="E-posta"
                style={input}
              />

              <input
                name="phone"
                placeholder="05xx..."
                style={input}
              />

              <input
                name="password"
                type="password"
                minLength={8}
                required
                placeholder="Geçici şifre"
                style={input}
              />

              <select
                name="role"
                defaultValue=""
                required
                style={input}
              >
                <option
                  value=""
                  disabled
                >
                  Rol seç
                </option>

                {STAFF_ROLES.map(
                  ([value, label]) => (
                    <option
                      key={value}
                      value={value}
                    >
                      {label}
                    </option>
                  )
                )}
              </select>
            </div>

            <hr
              style={{
                border: 0,
                borderTop:
                  "1px solid #edf1f6",
                margin: "20px 0",
              }}
            />

            <strong>
              Çalışabileceği Şubeler
            </strong>

            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 9,
                marginTop: 10,
              }}
            >
              <label
                style={{
                  padding: "9px 12px",
                  border:
                    "1px solid #b9d4fa",
                  borderRadius: 10,
                  background: "#eef6ff",
                  fontWeight: 800,
                }}
              >
                <input
                  type="checkbox"
                  name="all_branches"
                  value="true"
                />{" "}
                Tüm Şubeler
              </label>

              {branches
                .filter(
                  (branch) =>
                    branch.is_active
                )
                .map((branch) => (
                  <label
                    key={branch.id}
                    style={{
                      padding: "9px 12px",
                      border:
                        "1px solid #dce5f1",
                      borderRadius: 10,
                    }}
                  >
                    <input
                      type="checkbox"
                      name="branch_ids"
                      value={branch.id}
                    />{" "}
                    {branch.name}
                  </label>
                ))}
            </div>

            <hr
              style={{
                border: 0,
                borderTop:
                  "1px solid #edf1f6",
                margin: "20px 0",
              }}
            />

            <strong>
              Başlangıç Yetkileri
            </strong>

            <div
              style={{
                marginTop: 12,
              }}
            >
              {Object.entries(
                permissionGroups
              ).map(
                ([
                  moduleKey,
                  modulePermissions,
                ]) => (
                  <div
                    key={moduleKey}
                    style={{
                      marginBottom: 18,
                    }}
                  >
                    <div
                      style={{
                        color: "#64748b",
                        fontSize: 12,
                        fontWeight: 900,
                        marginBottom: 8,
                      }}
                    >
                      {MODULE_LABELS[
                        moduleKey
                      ] || moduleKey}
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns:
                          "repeat(auto-fit,minmax(230px,1fr))",
                        gap: 8,
                      }}
                    >
                      {modulePermissions.map(
                        (permission) => (
                          <label
                            key={
                              permission.permission_key
                            }
                            style={{
                              padding: 11,
                              border:
                                "1px solid #e5ebf4",
                              borderRadius: 10,
                              background:
                                "#fafbfc",
                            }}
                          >
                            <input
                              type="checkbox"
                              name="permission_keys"
                              value={
                                permission.permission_key
                              }
                            />{" "}
                            <strong>
                              {
                                permission.label
                              }
                            </strong>

                            {permission.description ? (
                              <div
                                style={{
                                  color:
                                    "#64748b",
                                  fontSize: 12,
                                  marginTop: 4,
                                }}
                              >
                                {
                                  permission.description
                                }
                              </div>
                            ) : null}
                          </label>
                        )
                      )}
                    </div>
                  </div>
                )
              )}
            </div>

            <button
              type="submit"
              style={blueButton}
            >
              + Kullanıcıyı Oluştur
            </button>
          </form>
        </section>

        <section style={card}>
          <h2
            style={{
              marginTop: 0,
            }}
          >
            Personel ve Yetki Yönetimi
          </h2>

          <div
            style={{
              display: "grid",
              gap: 16,
            }}
          >
            {profiles.map((profile) => {
              const staff =
                staffByAuthUser.get(
                  profile.id
                );

              const realStaffId =
                staff?.id;

              const assignedBranches =
                new Set(
                  realStaffId
                    ? staffBranches
                        .filter(
                          (x) =>
                            x.staff_id ===
                            realStaffId
                        )
                        .map(
                          (x) =>
                            x.branch_id
                        )
                    : []
                );

              const permissionMap =
                new Map(
                  realStaffId
                    ? staffPermissions
                        .filter(
                          (x) =>
                            x.staff_id ===
                            realStaffId
                        )
                        .map((x) => [
                          x.permission_key,
                          Boolean(
                            x.is_allowed
                          ),
                        ])
                    : []
                );

              const isOwner =
                profile.role === "owner";

              const isSuperUser =
                isOwner ||
                staff?.is_super_user ||
                permissionMap.get(
                  "system.superuser"
                ) === true;

              return (
                <article
                  key={profile.id}
                  style={{
                    border:
                      "1px solid #e2e8f0",
                    borderRadius: 15,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      padding: 16,
                      background:
                        "#fbfcfe",
                      borderBottom:
                        "1px solid #e8edf4",
                      display: "flex",
                      justifyContent:
                        "space-between",
                      gap: 10,
                      flexWrap: "wrap",
                    }}
                  >
                    <div>
                      <strong
                        style={{
                          fontSize: 17,
                        }}
                      >
                        {profile.full_name ||
                          "İsimsiz Kullanıcı"}
                      </strong>

                      <div
                        style={{
                          color:
                            "#64748b",
                          fontSize: 13,
                          marginTop: 4,
                        }}
                      >
                        {ROLE_LABELS[
                          String(
                            profile.role
                          )
                        ] ||
                          profile.role}
                        {" • "}
                        {profile.phone ||
                          profile.email ||
                          "Giriş bilgisi yok"}
                      </div>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        gap: 7,
                      }}
                    >
                      {isSuperUser && (
                        <span
                          style={{
                            padding:
                              "6px 10px",
                            borderRadius:
                              999,
                            background:
                              "#eef2ff",
                            color:
                              "#4338ca",
                            fontWeight:
                              800,
                            fontSize: 12,
                          }}
                        >
                          ★ Süper Kullanıcı
                        </span>
                      )}

                      <span
                        style={{
                          padding:
                            "6px 10px",
                          borderRadius:
                            999,
                          background:
                            profile.is_active
                              ? "#eaf8ef"
                              : "#fff0f0",
                          color:
                            profile.is_active
                              ? "#15803d"
                              : "#dc2626",
                          fontWeight: 800,
                          fontSize: 12,
                        }}
                      >
                        {profile.is_active
                          ? "● Aktif"
                          : "● Pasif"}
                      </span>
                    </div>
                  </div>

                  <div
                    style={{
                      padding: 16,
                    }}
                  >
                    {isOwner ? (
                      <div
                        style={{
                          padding: 13,
                          background:
                            "#fff8e8",
                          border:
                            "1px solid #fde7ad",
                          borderRadius: 10,
                          color:
                            "#854d0e",
                        }}
                      >
                        Sistem Sahibi
                        hesabının temel
                        erişimleri bu
                        ekrandan
                        kapatılamaz.
                      </div>
                    ) : (
                      <>
                        <form
                          action={
                            updateStaffProfile
                          }
                        >
                          <input
                            type="hidden"
                            name="staff_id"
                            value={
                              profile.id
                            }
                          />

                          <div
                            style={{
                              display:
                                "grid",
                              gridTemplateColumns:
                                "repeat(auto-fit,minmax(190px,1fr))",
                              gap: 9,
                            }}
                          >
                            <input
                              name="full_name"
                              required
                              defaultValue={
                                profile.full_name ??
                                ""
                              }
                              style={input}
                            />

                            <input
                              name="email"
                              defaultValue={
                                profile.email ??
                                ""
                              }
                              style={input}
                            />

                            <input
                              name="phone"
                              defaultValue={
                                profile.phone ??
                                ""
                              }
                              style={input}
                            />

                            <select
                              name="role"
                              defaultValue={
                                profile.role
                              }
                              style={input}
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
                          </div>

                          <button
                            style={{
                              ...whiteButton,
                              marginTop: 9,
                            }}
                          >
                            Profili Kaydet
                          </button>
                        </form>

                        <div
                          style={{
                            display: "flex",
                            gap: 8,
                            flexWrap: "wrap",
                            borderTop:
                              "1px solid #edf1f6",
                            marginTop: 16,
                            paddingTop: 16,
                          }}
                        >
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
                                whiteButton
                              }
                            >
                              {profile.is_active
                                ? "Pasif Yap"
                                : "Aktif Yap"}
                            </button>
                          </form>

                          <form
                            action={
                              changeStaffPassword
                            }
                            style={{
                              display:
                                "flex",
                              gap: 7,
                            }}
                          >
                            <input
                              type="hidden"
                              name="staff_id"
                              value={
                                profile.id
                              }
                            />

                            <input
                              name="password"
                              type="password"
                              minLength={8}
                              required
                              placeholder="Yeni şifre"
                              style={{
                                ...input,
                                width: 180,
                              }}
                            />

                            <button
                              style={
                                whiteButton
                              }
                            >
                              Şifre Ver
                            </button>
                          </form>
                        </div>

                        <form
                          action={
                            setStaffBranches
                          }
                          style={{
                            borderTop:
                              "1px solid #edf1f6",
                            marginTop: 16,
                            paddingTop: 16,
                          }}
                        >
                          <input
                            type="hidden"
                            name="staff_id"
                            value={
                              profile.id
                            }
                          />

                          <strong>
                            Şubeler
                          </strong>

                          <div
                            style={{
                              display:
                                "flex",
                              flexWrap:
                                "wrap",
                              gap: 8,
                              marginTop: 9,
                            }}
                          >
                            <label>
                              <input
                                type="checkbox"
                                name="all_branches"
                                value="true"
                                defaultChecked={
                                  Boolean(
                                    staff?.all_branches
                                  )
                                }
                              />{" "}
                              Tüm Şubeler
                            </label>

                            {branches
                              .filter(
                                (x) =>
                                  x.is_active
                              )
                              .map(
                                (branch) => (
                                  <label
                                    key={
                                      branch.id
                                    }
                                  >
                                    <input
                                      type="checkbox"
                                      name="branch_ids"
                                      value={
                                        branch.id
                                      }
                                      defaultChecked={assignedBranches.has(
                                        branch.id
                                      )}
                                    />{" "}
                                    {
                                      branch.name
                                    }
                                  </label>
                                )
                              )}
                          </div>

                          <button
                            style={{
                              ...whiteButton,
                              marginTop: 9,
                            }}
                          >
                            Şubeleri Kaydet
                          </button>
                        </form>

                        <div
                          style={{
                            borderTop:
                              "1px solid #edf1f6",
                            marginTop: 16,
                            paddingTop: 16,
                          }}
                        >
                          <div
                            style={{
                              display:
                                "flex",
                              gap: 7,
                              flexWrap:
                                "wrap",
                              marginBottom:
                                12,
                            }}
                          >
                            <form
                              action={
                                setAllStaffPermissions
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
                                name="is_allowed"
                                value="true"
                              />

                              <button
                                style={
                                  whiteButton
                                }
                              >
                                Tümünü Aç
                              </button>
                            </form>

                            <form
                              action={
                                setAllStaffPermissions
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
                                name="is_allowed"
                                value="false"
                              />

                              <button
                                style={
                                  whiteButton
                                }
                              >
                                Tümünü Kapat
                              </button>
                            </form>

                            <form
                              action={
                                setAccountingPermissions
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
                                name="is_allowed"
                                value="true"
                              />

                              <button
                                style={
                                  whiteButton
                                }
                              >
                                Muhasebeyi Aç
                              </button>
                            </form>

                            <form
                              action={
                                setAccountingPermissions
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
                                name="is_allowed"
                                value="false"
                              />

                              <button
                                style={
                                  whiteButton
                                }
                              >
                                Muhasebeyi Kapat
                              </button>
                            </form>
                          </div>

                          {Object.entries(
                            permissionGroups
                          ).map(
                            ([
                              moduleKey,
                              modulePermissions,
                            ]) => (
                              <div
                                key={
                                  moduleKey
                                }
                                style={{
                                  marginBottom:
                                    16,
                                }}
                              >
                                <strong
                                  style={{
                                    color:
                                      "#64748b",
                                    fontSize:
                                      12,
                                  }}
                                >
                                  {MODULE_LABELS[
                                    moduleKey
                                  ] ||
                                    moduleKey}
                                </strong>

                                <div
                                  style={{
                                    display:
                                      "grid",
                                    gridTemplateColumns:
                                      "repeat(auto-fit,minmax(210px,1fr))",
                                    gap: 7,
                                    marginTop: 7,
                                  }}
                                >
                                  {modulePermissions.map(
                                    (
                                      permission
                                    ) => {
                                      const allowed =
                                        permissionMap.get(
                                          permission.permission_key
                                        ) ===
                                        true;

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
                                              allowed
                                                ? "false"
                                                : "true"
                                            }
                                          />

                                          <button
                                            style={{
                                              width:
                                                "100%",
                                              border:
                                                allowed
                                                  ? "1px solid #b9ddc6"
                                                  : "1px solid #e2e8f0",
                                              borderRadius:
                                                10,
                                              padding:
                                                11,
                                              textAlign:
                                                "left",
                                              background:
                                                allowed
                                                  ? "#f0faf4"
                                                  : "#fafbfc",
                                              color:
                                                "#13233f",
                                              cursor:
                                                "pointer",
                                            }}
                                          >
                                            <strong>
                                              {
                                                permission.label
                                              }
                                            </strong>

                                            <div
                                              style={{
                                                color:
                                                  allowed
                                                    ? "#15803d"
                                                    : "#94a3b8",
                                                fontSize:
                                                  11,
                                                marginTop:
                                                  3,
                                              }}
                                            >
                                              {allowed
                                                ? "AÇIK"
                                                : "KAPALI"}
                                            </div>
                                          </button>
                                        </form>
                                      );
                                    }
                                  )}
                                </div>
                              </div>
                            )
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
}
