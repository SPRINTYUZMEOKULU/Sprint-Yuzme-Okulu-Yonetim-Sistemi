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
];

function cardStyle(): React.CSSProperties {
  return {
    background: "#ffffff",
    border: "1px solid #e3eaf3",
    borderRadius: "18px",
    padding: "22px",
    boxShadow: "0 8px 25px rgba(15,23,42,.05)",
  };
}

function inputStyle(): React.CSSProperties {
  return {
    width: "100%",
    boxSizing: "border-box",
    padding: "12px 13px",
    borderRadius: "10px",
    border: "1px solid #d7e0ec",
    background: "#ffffff",
    color: "#13233f",
    fontSize: "14px",
    outline: "none",
  };
}

function primaryButton(): React.CSSProperties {
  return {
    border: 0,
    borderRadius: "10px",
    padding: "11px 16px",
    background: "#1769e8",
    color: "#ffffff",
    fontWeight: 750,
    cursor: "pointer",
  };
}

function secondaryButton(): React.CSSProperties {
  return {
    border: "1px solid #d7e0ec",
    borderRadius: "10px",
    padding: "10px 14px",
    background: "#ffffff",
    color: "#334155",
    fontWeight: 700,
    cursor: "pointer",
  };
}

export default async function KullanicilarVeYetkilerPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <main style={{ padding: 40 }}>
        <h1>Oturum bulunamadı</h1>
        <p>Bu sayfayı görüntülemek için giriş yapmalısınız.</p>
      </main>
    );
  }

  const { data: currentProfile } = await supabase
    .from("profiles")
    .select("id, organization_id, role, full_name, is_active")
    .eq("id", user.id)
    .single();

  if (
    !currentProfile ||
    !currentProfile.is_active ||
    !["owner", "admin"].includes(String(currentProfile.role))
  ) {
    return (
      <main style={{ padding: 40 }}>
        <h1>Yetkisiz erişim</h1>
        <p>Bu bölüm yalnızca sistem sahibi ve yöneticiler tarafından kullanılabilir.</p>
      </main>
    );
  }

  const organizationId = currentProfile.organization_id;

  const [
    profilesResult,
    branchesResult,
    permissionsResult,
    staffBranchesResult,
    staffPermissionsResult,
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "id, full_name, email, phone, role, is_active, branch_id, created_at"
      )
      .eq("organization_id", organizationId)
      .order("full_name"),

    supabase
      .from("branches")
      .select("id, name, is_active")
      .eq("organization_id", organizationId)
      .order("name"),

    supabase
      .from("permission_definitions")
      .select(
        "permission_key, module_key, permission_name, description, is_active"
      )
      .eq("is_active", true)
      .order("module_key"),

    supabase
      .from("staff_branches")
      .select("staff_id, branch_id")
      .eq("organization_id", organizationId),

    supabase
      .from("staff_permissions")
      .select("staff_id, permission_key, is_allowed")
      .eq("organization_id", organizationId),
  ]);

  const profiles = profilesResult.data ?? [];
  const branches = branchesResult.data ?? [];
  const permissions = permissionsResult.data ?? [];
  const staffBranches = staffBranchesResult.data ?? [];
  const staffPermissions = staffPermissionsResult.data ?? [];

  const activeProfiles = profiles.filter((p) => p.is_active);
  const coaches = profiles.filter((p) => p.role === "coach");
  const managers = profiles.filter((p) =>
    ["owner", "admin", "branch_manager"].includes(String(p.role))
  );

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f4f7fc",
        padding: "30px",
        fontFamily:
          "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        color: "#13233f",
      }}
    >
      <div style={{ maxWidth: "1450px", margin: "0 auto" }}>
        {/* HEADER */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 20,
            flexWrap: "wrap",
            marginBottom: 26,
          }}
        >
          <div>
            <div
              style={{
                color: "#1769e8",
                fontWeight: 850,
                fontSize: 12,
                letterSpacing: 1.4,
                marginBottom: 7,
              }}
            >
              SPRİNT YÜZME OKULU
            </div>

            <h1
              style={{
                margin: 0,
                fontSize: 32,
                letterSpacing: "-0.6px",
              }}
            >
              Kullanıcılar ve Yetkiler
            </h1>

            <p
              style={{
                color: "#64748b",
                margin: "8px 0 0",
              }}
            >
              Personel hesapları, şubeler, giriş bilgileri ve SprintOS erişim
              yetkileri.
            </p>
          </div>

          <a
            href="/"
            style={{
              ...secondaryButton(),
              textDecoration: "none",
              display: "inline-block",
            }}
          >
            ← Ana Sayfa
          </a>
        </div>

        {/* ÖZET */}
        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))",
            gap: 14,
            marginBottom: 24,
          }}
        >
          {[
            ["Toplam Kullanıcı", profiles.length, "👥"],
            ["Aktif Kullanıcı", activeProfiles.length, "✓"],
            ["Eğitmen", coaches.length, "🏊"],
            ["Yönetici", managers.length, "🛡️"],
            ["Şube", branches.filter((b) => b.is_active !== false).length, "🏢"],
          ].map(([label, value, icon]) => (
            <div key={String(label)} style={cardStyle()}>
              <div
                style={{
                  fontSize: 23,
                  marginBottom: 12,
                }}
              >
                {icon}
              </div>

              <div
                style={{
                  fontSize: 27,
                  fontWeight: 850,
                }}
              >
                {value}
              </div>

              <div
                style={{
                  color: "#64748b",
                  fontSize: 13,
                  marginTop: 4,
                }}
              >
                {label}
              </div>
            </div>
          ))}
        </section>

        {/* YENİ PERSONEL */}
        <section style={{ ...cardStyle(), marginBottom: 24 }}>
          <div style={{ marginBottom: 20 }}>
            <div
              style={{
                color: "#1769e8",
                fontSize: 12,
                fontWeight: 850,
                letterSpacing: 1,
                marginBottom: 7,
              }}
            >
              YENİ HESAP
            </div>

            <h2 style={{ margin: 0, fontSize: 21 }}>
              Yeni Kullanıcı Yetkilendir
            </h2>

            <p
              style={{
                color: "#64748b",
                fontSize: 14,
                marginBottom: 0,
              }}
            >
              Yeni personel hesabını oluşturun ve ilk şube/yetkilerini
              tanımlayın.
            </p>
          </div>

          <form action={createStaff}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))",
                gap: 12,
              }}
            >
              <input
                name="full_name"
                required
                placeholder="Ad Soyad"
                style={inputStyle()}
              />

              <input
                name="email"
                type="email"
                placeholder="E-posta"
                style={inputStyle()}
              />

              <input
                name="phone"
                placeholder="Telefon: 05xx..."
                style={inputStyle()}
              />

              <input
                name="password"
                type="password"
                minLength={8}
                required
                placeholder="Geçici şifre (en az 8 karakter)"
                style={inputStyle()}
              />

              <select name="role" required defaultValue="" style={inputStyle()}>
                <option value="" disabled>
                  Görev / Rol seçiniz
                </option>

                {STAFF_ROLES.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div
              style={{
                marginTop: 20,
                paddingTop: 18,
                borderTop: "1px solid #edf1f6",
              }}
            >
              <div style={{ fontWeight: 800, marginBottom: 10 }}>
                Şube Yetkisi
              </div>

              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 10,
                }}
              >
                {branches
                  .filter((branch) => branch.is_active !== false)
                  .map((branch) => (
                    <label
                      key={branch.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        border: "1px solid #dce5f1",
                        borderRadius: 10,
                        padding: "10px 13px",
                        cursor: "pointer",
                        background: "#fbfcfe",
                      }}
                    >
                      <input
                        type="checkbox"
                        name="branch_ids"
                        value={branch.id}
                      />
                      {branch.name}
                    </label>
                  ))}
              </div>
            </div>

            <div
              style={{
                marginTop: 20,
                paddingTop: 18,
                borderTop: "1px solid #edf1f6",
              }}
            >
              <div style={{ fontWeight: 800, marginBottom: 10 }}>
                Başlangıç Yetkileri
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(auto-fit,minmax(220px,1fr))",
                  gap: 8,
                }}
              >
                {permissions.map((permission) => (
                  <label
                    key={permission.permission_key}
                    style={{
                      display: "flex",
                      gap: 9,
                      alignItems: "flex-start",
                      padding: 11,
                      borderRadius: 10,
                      background: "#f8fafc",
                      border: "1px solid #e7edf5",
                      fontSize: 13,
                    }}
                  >
                    <input
                      type="checkbox"
                      name="permission_keys"
                      value={permission.permission_key}
                    />

                    <span>
                      <strong>
                        {permission.permission_name ||
                          permission.permission_key}
                      </strong>

                      {permission.description ? (
                        <div
                          style={{
                            color: "#64748b",
                            marginTop: 3,
                            lineHeight: 1.4,
                          }}
                        >
                          {permission.description}
                        </div>
                      ) : null}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div style={{ marginTop: 20 }}>
              <button type="submit" style={primaryButton()}>
                + Kullanıcı Oluştur
              </button>
            </div>
          </form>
        </section>

        {/* PERSONEL LİSTESİ */}
        <section style={cardStyle()}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 15,
              flexWrap: "wrap",
              marginBottom: 20,
            }}
          >
            <div>
              <h2 style={{ margin: 0, fontSize: 21 }}>
                Personel ve Yetki Yönetimi
              </h2>

              <p
                style={{
                  color: "#64748b",
                  margin: "6px 0 0",
                  fontSize: 14,
                }}
              >
                {profiles.length} kullanıcı bulundu.
              </p>
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gap: 18,
            }}
          >
            {profiles.map((staff) => {
              const assignedBranchIds = new Set(
                staffBranches
                  .filter((item) => item.staff_id === staff.id)
                  .map((item) => item.branch_id)
              );

              const permissionMap = new Map(
                staffPermissions
                  .filter((item) => item.staff_id === staff.id)
                  .map((item) => [
                    item.permission_key,
                    Boolean(item.is_allowed),
                  ])
              );

              const isOwner = staff.role === "owner";

              return (
                <article
                  key={staff.id}
                  style={{
                    border: "1px solid #e2e8f0",
                    borderRadius: 16,
                    overflow: "hidden",
                    background: "#ffffff",
                  }}
                >
                  {/* PERSONEL BAŞLIK */}
                  <div
                    style={{
                      padding: 18,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 15,
                      flexWrap: "wrap",
                      background: "#fbfcfe",
                      borderBottom: "1px solid #e8edf4",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 13,
                      }}
                    >
                      <div
                        style={{
                          width: 46,
                          height: 46,
                          borderRadius: 14,
                          background: "#eaf3ff",
                          color: "#1769e8",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontWeight: 850,
                          fontSize: 18,
                        }}
                      >
                        {(staff.full_name || "?")
                          .slice(0, 1)
                          .toUpperCase()}
                      </div>

                      <div>
                        <div
                          style={{
                            fontWeight: 850,
                            fontSize: 17,
                          }}
                        >
                          {staff.full_name || "İsimsiz Kullanıcı"}

                          {staff.id === user.id ? (
                            <span
                              style={{
                                fontSize: 11,
                                color: "#1769e8",
                                marginLeft: 8,
                              }}
                            >
                              SİZ
                            </span>
                          ) : null}
                        </div>

                        <div
                          style={{
                            color: "#64748b",
                            fontSize: 13,
                            marginTop: 3,
                          }}
                        >
                          {ROLE_LABELS[String(staff.role)] ||
                            String(staff.role)}
                          {" • "}
                          {staff.email || staff.phone || "Giriş bilgisi yok"}
                        </div>
                      </div>
                    </div>

                    <span
                      style={{
                        borderRadius: 999,
                        padding: "7px 11px",
                        fontWeight: 750,
                        fontSize: 12,
                        background: staff.is_active
                          ? "#eaf8ef"
                          : "#fff0f0",
                        color: staff.is_active
                          ? "#15803d"
                          : "#dc2626",
                      }}
                    >
                      {staff.is_active ? "● Aktif" : "● Pasif"}
                    </span>
                  </div>

                  <div style={{ padding: 18 }}>
                    {/* PROFİL */}
                    {!isOwner ? (
                      <form action={updateStaffProfile}>
                        <input
                          type="hidden"
                          name="staff_id"
                          value={staff.id}
                        />

                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns:
                              "repeat(auto-fit,minmax(190px,1fr))",
                            gap: 10,
                          }}
                        >
                          <input
                            name="full_name"
                            required
                            defaultValue={staff.full_name ?? ""}
                            style={inputStyle()}
                          />

                          <input
                            name="email"
                            type="email"
                            defaultValue={staff.email ?? ""}
                            placeholder="E-posta"
                            style={inputStyle()}
                          />

                          <input
                            name="phone"
                            defaultValue={staff.phone ?? ""}
                            placeholder="Telefon"
                            style={inputStyle()}
                          />

                          <select
                            name="role"
                            defaultValue={staff.role ?? ""}
                            style={inputStyle()}
                          >
                            {STAFF_ROLES.map(([value, label]) => (
                              <option key={value} value={value}>
                                {label}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div style={{ marginTop: 10 }}>
                          <button type="submit" style={secondaryButton()}>
                            Profili Kaydet
                          </button>
                        </div>
                      </form>
                    ) : (
                      <div
                        style={{
                          background: "#fff8e8",
                          border: "1px solid #fde7ad",
                          borderRadius: 10,
                          padding: 12,
                          fontSize: 13,
                          color: "#854d0e",
                        }}
                      >
                        Sistem sahibi hesabının rolü bu ekrandan
                        değiştirilemez.
                      </div>
                    )}

                    {/* HESAP */}
                    {!isOwner ? (
                      <div
                        style={{
                          marginTop: 18,
                          paddingTop: 18,
                          borderTop: "1px solid #edf1f6",
                          display: "flex",
                          flexWrap: "wrap",
                          gap: 10,
                        }}
                      >
                        <form action={setStaffActive}>
                          <input
                            type="hidden"
                            name="staff_id"
                            value={staff.id}
                          />

                          <input
                            type="hidden"
                            name="is_active"
                            value={
                              staff.is_active ? "false" : "true"
                            }
                          />

                          <button
                            type="submit"
                            style={{
                              ...secondaryButton(),
                              color: staff.is_active
                                ? "#dc2626"
                                : "#15803d",
                            }}
                          >
                            {staff.is_active
                              ? "Hesabı Pasif Yap"
                              : "Hesabı Aktif Yap"}
                          </button>
                        </form>

                        <form
                          action={changeStaffPassword}
                          style={{
                            display: "flex",
                            gap: 8,
                            flexWrap: "wrap",
                          }}
                        >
                          <input
                            type="hidden"
                            name="staff_id"
                            value={staff.id}
                          />

                          <input
                            name="password"
                            type="password"
                            minLength={8}
                            required
                            placeholder="Yeni şifre"
                            style={{
                              ...inputStyle(),
                              width: 190,
                            }}
                          />

                          <button
                            type="submit"
                            style={secondaryButton()}
                          >
                            Şifreyi Değiştir
                          </button>
                        </form>
                      </div>
                    ) : null}

                    {/* ŞUBELER */}
                    {!isOwner ? (
                      <div
                        style={{
                          marginTop: 20,
                          paddingTop: 18,
                          borderTop: "1px solid #edf1f6",
                        }}
                      >
                        <div
                          style={{
                            fontWeight: 800,
                            marginBottom: 10,
                          }}
                        >
                          Şube Erişimleri
                        </div>

                        <form action={setStaffBranches}>
                          <input
                            type="hidden"
                            name="staff_id"
                            value={staff.id}
                          />

                          <div
                            style={{
                              display: "flex",
                              flexWrap: "wrap",
                              gap: 9,
                            }}
                          >
                            {branches
                              .filter(
                                (branch) =>
                                  branch.is_active !== false
                              )
                              .map((branch) => (
                                <label
                                  key={branch.id}
                                  style={{
                                    border:
                                      "1px solid #dce5f1",
                                    borderRadius: 10,
                                    padding: "9px 12px",
                                    display: "flex",
                                    gap: 7,
                                    alignItems: "center",
                                    fontSize: 13,
                                  }}
                                >
                                  <input
                                    type="checkbox"
                                    name="branch_ids"
                                    value={branch.id}
                                    defaultChecked={assignedBranchIds.has(
                                      branch.id
                                    )}
                                  />

                                  {branch.name}
                                </label>
                              ))}
                          </div>

                          <button
                            type="submit"
                            style={{
                              ...secondaryButton(),
                              marginTop: 10,
                            }}
                          >
                            Şubeleri Kaydet
                          </button>
                        </form>
                      </div>
                    ) : null}

                    {/* YETKİLER */}
                    {!isOwner ? (
                      <div
                        style={{
                          marginTop: 20,
                          paddingTop: 18,
                          borderTop: "1px solid #edf1f6",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            flexWrap: "wrap",
                            gap: 10,
                            marginBottom: 12,
                          }}
                        >
                          <div style={{ fontWeight: 800 }}>
                            Modül Yetkileri
                          </div>

                          <div
                            style={{
                              display: "flex",
                              flexWrap: "wrap",
                              gap: 7,
                            }}
                          >
                            <form action={setAllStaffPermissions}>
                              <input
                                type="hidden"
                                name="staff_id"
                                value={staff.id}
                              />
                              <input
                                type="hidden"
                                name="is_allowed"
                                value="true"
                              />

                              <button
                                type="submit"
                                style={secondaryButton()}
                              >
                                Tümünü Aç
                              </button>
                            </form>

                            <form action={setAllStaffPermissions}>
                              <input
                                type="hidden"
                                name="staff_id"
                                value={staff.id}
                              />
                              <input
                                type="hidden"
                                name="is_allowed"
                                value="false"
                              />

                              <button
                                type="submit"
                                style={secondaryButton()}
                              >
                                Tümünü Kapat
                              </button>
                            </form>

                            <form action={setAccountingPermissions}>
                              <input
                                type="hidden"
                                name="staff_id"
                                value={staff.id}
                              />
                              <input
                                type="hidden"
                                name="is_allowed"
                                value="true"
                              />

                              <button
                                type="submit"
                                style={secondaryButton()}
                              >
                                Muhasebeyi Aç
                              </button>
                            </form>
                          </div>
                        </div>

                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns:
                              "repeat(auto-fit,minmax(220px,1fr))",
                            gap: 8,
                          }}
                        >
                          {permissions.map((permission) => {
                            const allowed =
                              permissionMap.get(
                                permission.permission_key
                              ) === true;

                            return (
                              <form
                                key={permission.permission_key}
                                action={setStaffPermission}
                              >
                                <input
                                  type="hidden"
                                  name="staff_id"
                                  value={staff.id}
                                />

                                <input
                                  type="hidden"
                                  name="permission_key"
                                  value={permission.permission_key}
                                />

                                <input
                                  type="hidden"
                                  name="is_allowed"
                                  value={allowed ? "false" : "true"}
                                />

                                <button
                                  type="submit"
                                  style={{
                                    width: "100%",
                                    textAlign: "left",
                                    border: allowed
                                      ? "1px solid #b9ddc6"
                                      : "1px solid #e2e8f0",
                                    borderRadius: 11,
                                    padding: 12,
                                    background: allowed
                                      ? "#f0faf4"
                                      : "#fafbfc",
                                    cursor: "pointer",
                                    color: "#13233f",
                                  }}
                                >
                                  <div
                                    style={{
                                      display: "flex",
                                      justifyContent:
                                        "space-between",
                                      gap: 8,
                                      fontWeight: 750,
                                      fontSize: 13,
                                    }}
                                  >
                                    <span>
                                      {permission.permission_name ||
                                        permission.permission_key}
                                    </span>

                                    <span
                                      style={{
                                        color: allowed
                                          ? "#15803d"
                                          : "#94a3b8",
                                      }}
                                    >
                                      {allowed ? "AÇIK" : "KAPALI"}
                                    </span>
                                  </div>

                                  <div
                                    style={{
                                      color: "#64748b",
                                      fontSize: 11,
                                      marginTop: 4,
                                    }}
                                  >
                                    {permission.module_key}
                                  </div>
                                </button>
                              </form>
                            );
                          })}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </article>
              );
            })}

            {!profiles.length ? (
              <div
                style={{
                  padding: 30,
                  textAlign: "center",
                  color: "#64748b",
                  border: "1px dashed #cbd5e1",
                  borderRadius: 14,
                }}
              >
                Henüz kullanıcı bulunamadı.
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}
