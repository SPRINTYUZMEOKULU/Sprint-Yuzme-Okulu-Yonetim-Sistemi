"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import PasswordField from "./password-field";
import {
  changeStaffPasswordAction,
  createStaffAction,
  setAccountingPermissionsAction,
  setAllStaffPermissionsAction,
  setLoginEnabledAction,
  setStaffActiveAction,
  setStaffBranchesAction,
  setStaffPermissionAction,
  setSuperUserAction,
  updateStaffProfileAction,
  type ActionResult,
  type CreateStaffInput,
  type UserRole,
} from "./actions";

type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  role: string;
  is_active: boolean;
  last_sign_in_at: string | null;
};

type Staff = {
  id: string;
  auth_user_id: string | null;
  login_enabled: boolean;
  is_super_user: boolean;
  must_change_password: boolean;
  all_branches: boolean;
};

type Branch = {
  id: string;
  name: string;
  short_name: string | null;
};

type PermissionDefinition = {
  permission_key: string;
  module_key: string;
  label: string;
  description: string | null;
  sort_order: number | null;
};

type StaffBranch = {
  staff_id: string;
  branch_id: string;
};

type StaffPermission = {
  staff_id: string;
  permission_key: string;
  is_allowed: boolean;
};

type AuditLog = {
  id: string;
  actor_profile_id: string | null;
  actor_staff_id: string | null;
  module_key: string;
  action_key: string;
  action_label: string;
  entity_id: string | null;
  description: string | null;
  success: boolean;
  created_at: string;
};

export type YetkiPaneliClientProps = {
  profiles: Profile[];
  staffRows: Staff[];
  branches: Branch[];
  permissionDefinitions: PermissionDefinition[];
  staffBranches: StaffBranch[];
  staffPermissions: StaffPermission[];
  auditLogs: AuditLog[];
};

const ROLE_LABELS: Record<string, string> = {
  owner: "Sistem Sahibi",
  admin: "Yönetici",
  branch_manager: "Şube Yöneticisi",
  registration_staff: "Kayıt Personeli",
  accounting: "Muhasebe",
  coach: "Eğitmen",
  guardian: "Veli",
};

const STAFF_ROLES: Array<[Exclude<UserRole, "owner">, string]> = [
  ["admin", "Yönetici"],
  ["branch_manager", "Şube Yöneticisi"],
  ["registration_staff", "Kayıt Personeli"],
  ["accounting", "Muhasebe"],
  ["coach", "Eğitmen"],
  ["guardian", "Veli"],
];

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
  staff: "Personel",
  accounts: "Giriş ve Güvenlik",
  permissions: "Yetkiler",
  reports: "Raporlar",
  branches: "Şubeler",
};

function formatPhone(value?: string | null) {
  if (!value) return "—";
  let digits = value.replace(/\D/g, "");
  if (digits.startsWith("90")) digits = digits.slice(2);

  if (digits.length === 10) {
    return `0${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(
      6,
      8
    )} ${digits.slice(8)}`;
  }

  return value;
}

function formatDate(value?: string | null) {
  if (!value) return "Henüz kayıt yok";

  return new Intl.DateTimeFormat("tr-TR", {
    timeZone: "Europe/Istanbul",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function initials(name?: string | null) {
  const parts = String(name || "K").trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0]?.[0] || ""}${parts[parts.length - 1]?.[0] || ""}`.toUpperCase();
}

function Toast({
  toast,
  onClose,
}: {
  toast: { type: "success" | "error"; message: string } | null;
  onClose: () => void;
}) {
  if (!toast) return null;

  return (
    <div
      style={{
        position: "fixed",
        right: 24,
        top: 88,
        zIndex: 1000,
        minWidth: 300,
        maxWidth: 440,
        borderRadius: 14,
        padding: "14px 16px",
        boxShadow: "0 18px 45px rgba(15,23,42,.18)",
        border:
          toast.type === "success"
            ? "1px solid #86efac"
            : "1px solid #fecaca",
        background: toast.type === "success" ? "#f0fdf4" : "#fef2f2",
        color: toast.type === "success" ? "#166534" : "#991b1b",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 14,
        fontWeight: 800,
      }}
    >
      <span>
        {toast.type === "success" ? "✓ " : "⚠ "}
        {toast.message}
      </span>

      <button
        onClick={onClose}
        type="button"
        style={{
          border: 0,
          background: "transparent",
          color: "inherit",
          cursor: "pointer",
          fontSize: 18,
        }}
      >
        ×
      </button>
    </div>
  );
}

export default function YetkiPaneliClient({
  profiles,
  staffRows,
  branches,
  permissionDefinitions,
  staffBranches,
  staffPermissions,
  auditLogs,
}: YetkiPaneliClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [selectedId, setSelectedId] = useState(profiles[0]?.id || "");
  const [activeTab, setActiveTab] = useState<
    "genel" | "subeler" | "yetkiler" | "guvenlik" | "gecmis"
  >("genel");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [summaryFilter, setSummaryFilter] = useState<
    "all" | "active" | "super" | "assigned"
  >("all");
  const [showCreate, setShowCreate] = useState(false);
  const [toast, setToast] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const [localStaff, setLocalStaff] = useState(staffRows);
  const [localBranches, setLocalBranches] = useState(staffBranches);
  const [localPermissions, setLocalPermissions] = useState(staffPermissions);
  const [localProfiles, setLocalProfiles] = useState(profiles);

  const selectedProfile =
    localProfiles.find((p) => p.id === selectedId) ?? null;

  const selectedStaff =
    localStaff.find((s) => s.auth_user_id === selectedId) ?? null;

  const filteredProfiles = useMemo(() => {
    const q = search.trim().toLocaleLowerCase("tr-TR");

    return localProfiles.filter((profile) => {
      if (roleFilter && profile.role !== roleFilter) return false;

      const staff = localStaff.find(
        (row) => row.auth_user_id === profile.id
      );

      if (summaryFilter === "active" && !profile.is_active) return false;
      if (
        summaryFilter === "super" &&
        profile.role !== "owner" &&
        !staff?.is_super_user
      ) {
        return false;
      }
      if (
        summaryFilter === "assigned" &&
        !staff?.all_branches &&
        !localBranches.some((row) => row.staff_id === staff?.id)
      ) {
        return false;
      }
      if (!q) return true;

      const haystack = [
        profile.full_name,
        profile.phone,
        profile.email,
        ROLE_LABELS[profile.role],
      ]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("tr-TR");

      return haystack.includes(q);
    });
  }, [
    localProfiles,
    localStaff,
    localBranches,
    search,
    roleFilter,
    summaryFilter,
  ]);

  const selectedBranchIds = useMemo(() => {
    if (!selectedStaff) return [];
    return localBranches
      .filter((x) => x.staff_id === selectedStaff.id)
      .map((x) => x.branch_id);
  }, [localBranches, selectedStaff]);

  const permissionMap = useMemo(() => {
    const map = new Map<string, boolean>();
    if (!selectedStaff) return map;

    localPermissions
      .filter((x) => x.staff_id === selectedStaff.id)
      .forEach((x) => map.set(x.permission_key, Boolean(x.is_allowed)));

    return map;
  }, [localPermissions, selectedStaff]);

  const selectedLogs = useMemo(() => {
    if (!selectedProfile) return [];
    return auditLogs.filter(
      (log) =>
        log.actor_profile_id === selectedProfile.id ||
        log.actor_staff_id === selectedStaff?.id ||
        log.entity_id === selectedProfile.id
    );
  }, [auditLogs, selectedProfile, selectedStaff]);

  const permissionsByModule = useMemo(() => {
    return permissionDefinitions.reduce<Record<string, PermissionDefinition[]>>(
      (acc, permission) => {
        const key = permission.module_key || "other";
        if (!acc[key]) acc[key] = [];
        acc[key].push(permission);
        return acc;
      },
      {}
    );
  }, [permissionDefinitions]);

  function showResult(result: ActionResult) {
    setToast({
      type: result.ok ? "success" : "error",
      message: result.message,
    });

    if (result.ok) {
      setTimeout(() => setToast(null), 3200);
    }
  }

  function runAction(
    action: () => Promise<ActionResult>,
    onOptimistic?: () => void,
    onRollback?: () => void
  ) {
    if (isPending) return;

    onOptimistic?.();

    startTransition(async () => {
      const result = await action();

      if (!result.ok) {
        onRollback?.();
      }

      showResult(result);

      if (result.ok) {
        router.refresh();
      }
    });
  }

  function updateSelectedStaff(patch: Partial<Staff>) {
    if (!selectedStaff) return;
    setLocalStaff((prev) =>
      prev.map((s) => (s.id === selectedStaff.id ? { ...s, ...patch } : s))
    );
  }

  function updateSelectedProfile(patch: Partial<Profile>) {
    if (!selectedProfile) return;
    setLocalProfiles((prev) =>
      prev.map((p) => (p.id === selectedProfile.id ? { ...p, ...patch } : p))
    );
  }

  if (!localProfiles.length) {
    return (
      <div style={emptyPanelStyle}>
        Henüz personel bulunmuyor.
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          style={primaryButton}
        >
          İlk Personeli Oluştur
        </button>
      </div>
    );
  }

  return (
    <div className="personnelUi">
      <Toast toast={toast} onClose={() => setToast(null)} />

      {isPending ? (
        <div style={pendingBarStyle}>
          <span style={spinnerStyle} />
          İşlem yapılıyor...
        </div>
      ) : null}

      <section className="personnelStats" style={statsGridStyle}>
        <Stat
          title="Toplam Personel"
          value={localProfiles.length}
          note="Sistemde kayıtlı"
          active={summaryFilter === "all"}
          onClick={() => setSummaryFilter("all")}
        />
        <Stat
          title="Aktif Hesap"
          value={localProfiles.filter((x) => x.is_active).length}
          note="Kullanılabilir"
          active={summaryFilter === "active"}
          onClick={() => setSummaryFilter("active")}
        />
        <Stat
          title="Süper Kullanıcı"
          value={
            localProfiles.filter((x) => x.role === "owner").length +
            localStaff.filter((x) => x.is_super_user).length
          }
          note="Tam erişim"
          active={summaryFilter === "super"}
          onClick={() => setSummaryFilter("super")}
        />
        <Stat
          title="Aktif Şube"
          value={branches.length}
          note="Atanan personeli göster"
          active={summaryFilter === "assigned"}
          onClick={() => setSummaryFilter("assigned")}
        />
      </section>

      <section className="personnelWorkspace" style={workspaceStyle}>
        <aside className="personnelSidebar" style={sidebarStyle}>
          <div style={sidebarHeaderStyle}>
            <div>
              <div style={eyebrowStyle}>PERSONELLER</div>
              <strong style={{ fontSize: 17 }}>Kullanıcı Listesi</strong>
            </div>

            <button
              type="button"
              onClick={() => setShowCreate(true)}
              style={smallPrimaryButton}
            >
              + Yeni
            </button>
          </div>

          <div style={filtersStyle}>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Ad, telefon veya e-posta ara..."
              style={inputStyle}
            />

            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              style={inputStyle}
            >
              <option value="">Tüm roller</option>
              {Object.entries(ROLE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div style={personListStyle}>
            {filteredProfiles.map((profile) => {
              const staff = localStaff.find(
                (row) => row.auth_user_id === profile.id
              );
              const branchCount = staff
                ? localBranches.filter((x) => x.staff_id === staff.id).length
                : 0;
              const permissionCount = staff
                ? localPermissions.filter(
                    (x) => x.staff_id === staff.id && x.is_allowed
                  ).length
                : 0;
              const active = selectedId === profile.id;

              return (
                <button
                  key={profile.id}
                  type="button"
                  onClick={() => {
                    setSelectedId(profile.id);
                    setActiveTab("genel");
                    setShowCreate(false);
                  }}
                  style={{
                    ...personCardStyle,
                    borderColor: active ? "#1769e8" : "#e2e8f0",
                    background: active ? "#eff6ff" : "#ffffff",
                  }}
                >
                  <div style={avatarStyle}>{initials(profile.full_name)}</div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={personCardTopStyle}>
                      <strong style={personNameStyle}>
                        {profile.full_name || "İsimsiz Kullanıcı"}
                      </strong>
                      <span
                        style={
                          profile.is_active ? activeBadgeStyle : passiveBadgeStyle
                        }
                      >
                        {profile.is_active ? "Aktif" : "Pasif"}
                      </span>
                    </div>

                    <div style={personMetaStyle}>
                      {ROLE_LABELS[profile.role] || profile.role}
                    </div>

                    <div style={personMetaStyle}>
                      {formatPhone(profile.phone)}
                    </div>

                    <div style={personTinyStatsStyle}>
                      <span>🏢 {staff?.all_branches ? "Tüm" : branchCount} Şube</span>
                      <span>🔑 {permissionCount} Yetki</span>
                      {staff?.is_super_user || profile.role === "owner" ? (
                        <span>★ Süper</span>
                      ) : null}
                    </div>
                  </div>

                  <span style={arrowStyle}>›</span>
                </button>
              );
            })}
          </div>
        </aside>

        <section className="personnelDetail" style={detailPanelStyle}>
          {showCreate ? (
            <CreateStaffPanel
              branches={branches}
              permissionDefinitions={permissionDefinitions}
              pending={isPending}
              onCancel={() => setShowCreate(false)}
              onSubmit={(input) =>
                runAction(
                  () => createStaffAction(input),
                  undefined,
                  undefined
                )
              }
            />
          ) : selectedProfile ? (
            <>
              <header className="personnelHeader" style={personHeaderStyle}>
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <div style={bigAvatarStyle}>
                    {initials(selectedProfile.full_name)}
                  </div>
                  <div>
                    <h2 style={{ margin: 0, fontSize: 24 }}>
                      {selectedProfile.full_name || "İsimsiz Kullanıcı"}
                    </h2>
                    <div style={headerMetaStyle}>
                      {ROLE_LABELS[selectedProfile.role] || selectedProfile.role}
                      {" · "}
                      {formatPhone(selectedProfile.phone)}
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {selectedStaff?.is_super_user ||
                  selectedProfile.role === "owner" ? (
                    <span style={superBadgeStyle}>★ Süper Kullanıcı</span>
                  ) : null}

                  <span
                    style={
                      selectedProfile.is_active
                        ? activeLargeBadgeStyle
                        : passiveLargeBadgeStyle
                    }
                  >
                    {selectedProfile.is_active ? "● Aktif" : "● Pasif"}
                  </span>
                </div>
              </header>

              <nav className="personnelTabs" style={tabsStyle}>
                {[
                  ["genel", "Genel Bilgiler"],
                  ["subeler", "Şubeler"],
                  ["yetkiler", "Yetkiler"],
                  ["guvenlik", "Giriş & Güvenlik"],
                  ["gecmis", "İşlem Geçmişi"],
                ].map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setActiveTab(key as typeof activeTab)}
                    style={{
                      ...tabButtonStyle,
                      ...(activeTab === key ? activeTabButtonStyle : {}),
                    }}
                  >
                    {label}
                  </button>
                ))}
              </nav>

              <div className="personnelTabContent" style={tabContentStyle}>
                {activeTab === "genel" ? (
                  <GeneralTab
                    profile={selectedProfile}
                    staff={selectedStaff}
                    branchCount={
                      selectedStaff?.all_branches
                        ? branches.length
                        : selectedBranchIds.length
                    }
                    permissionCount={[...permissionMap.values()].filter(Boolean).length}
                    pending={isPending}
                    onSave={(input) =>
                      runAction(
                        () => updateStaffProfileAction(input),
                        () =>
                          updateSelectedProfile({
                            full_name: input.fullName,
                            email: input.email || null,
                            phone: input.phone || null,
                            role: input.role,
                          }),
                        () => router.refresh()
                      )
                    }
                  />
                ) : null}

                {activeTab === "subeler" ? (
                  <BranchesTab
                    profile={selectedProfile}
                    staff={selectedStaff}
                    branches={branches}
                    selectedBranchIds={selectedBranchIds}
                    pending={isPending}
                    onSave={(ids, allBranches) => {
                      const oldLinks = localBranches;
                      const staffId = selectedStaff?.id;

                      runAction(
                        () =>
                          setStaffBranchesAction(
                            selectedProfile.id,
                            ids,
                            allBranches
                          ),
                        () => {
                          if (!staffId) return;
                          const nextIds = allBranches
                            ? branches.map((b) => b.id)
                            : ids;

                          setLocalBranches((prev) => [
                            ...prev.filter((x) => x.staff_id !== staffId),
                            ...nextIds.map((branchId) => ({
                              staff_id: staffId,
                              branch_id: branchId,
                            })),
                          ]);

                          updateSelectedStaff({ all_branches: allBranches });
                        },
                        () => setLocalBranches(oldLinks)
                      );
                    }}
                  />
                ) : null}

                {activeTab === "yetkiler" ? (
                  <PermissionsTab
                    profile={selectedProfile}
                    staff={selectedStaff}
                    permissionDefinitions={permissionDefinitions}
                    permissionMap={permissionMap}
                    pending={isPending}
                    onPermission={(permissionKey, allowed) => {
                      const old = localPermissions;
                      const staffId = selectedStaff?.id;
                      if (!staffId) {
                        showResult({
                          ok: false,
                          message: "Personel kaydı bulunamadı.",
                        });
                        return;
                      }

                      runAction(
                        () =>
                          setStaffPermissionAction(
                            selectedProfile.id,
                            permissionKey,
                            allowed
                          ),
                        () => {
                          setLocalPermissions((prev) => {
                            const others = prev.filter(
                              (x) =>
                                !(
                                  x.staff_id === staffId &&
                                  x.permission_key === permissionKey
                                )
                            );
                            return [
                              ...others,
                              {
                                staff_id: staffId,
                                permission_key: permissionKey,
                                is_allowed: allowed,
                              },
                            ];
                          });
                          if (permissionKey === "system.superuser") {
                            updateSelectedStaff({ is_super_user: allowed });
                          }
                        },
                        () => setLocalPermissions(old)
                      );
                    }}
                    onSuperUser={(enabled) => {
                      const previous = Boolean(selectedStaff?.is_super_user);
                      runAction(
                        () => setSuperUserAction(selectedProfile.id, enabled),
                        () => updateSelectedStaff({ is_super_user: enabled }),
                        () => updateSelectedStaff({ is_super_user: previous })
                      );
                    }}
                    onAll={(allowed) =>
                      runAction(
                        () =>
                          setAllStaffPermissionsAction(
                            selectedProfile.id,
                            allowed
                          ),
                        () => {
                          if (!selectedStaff) return;
                          const keys = permissionDefinitions
                            .map((x) => x.permission_key)
                            .filter((x) => x !== "system.superuser");

                          setLocalPermissions((prev) => {
                            const cleaned = prev.filter(
                              (x) =>
                                !(
                                  x.staff_id === selectedStaff.id &&
                                  keys.includes(x.permission_key)
                                )
                            );
                            return [
                              ...cleaned,
                              ...keys.map((permission_key) => ({
                                staff_id: selectedStaff.id,
                                permission_key,
                                is_allowed: allowed,
                              })),
                            ];
                          });
                        },
                        () => router.refresh()
                      )
                    }
                    onAccounting={(allowed) =>
                      runAction(
                        () =>
                          setAccountingPermissionsAction(
                            selectedProfile.id,
                            allowed
                          ),
                        undefined,
                        undefined
                      )
                    }
                  />
                ) : null}

                {activeTab === "guvenlik" ? (
                  <SecurityTab
                    profile={selectedProfile}
                    staff={selectedStaff}
                    pending={isPending}
                    onLoginEnabled={(enabled) => {
                      const old = selectedStaff?.login_enabled ?? true;
                      runAction(
                        () =>
                          setLoginEnabledAction(selectedProfile.id, enabled),
                        () => updateSelectedStaff({ login_enabled: enabled }),
                        () => updateSelectedStaff({ login_enabled: old })
                      );
                    }}
                    onActive={(active) => {
                      const old = selectedProfile.is_active;
                      runAction(
                        () => setStaffActiveAction(selectedProfile.id, active),
                        () => updateSelectedProfile({ is_active: active }),
                        () => updateSelectedProfile({ is_active: old })
                      );
                    }}
                    onPassword={(password) =>
                      runAction(
                        () =>
                          changeStaffPasswordAction(
                            selectedProfile.id,
                            password
                          ),
                        undefined,
                        undefined
                      )
                    }
                  />
                ) : null}

                {activeTab === "gecmis" ? (
                  <HistoryTab logs={selectedLogs} />
                ) : null}
              </div>
            </>
          ) : (
            <div style={emptyPanelStyle}>Personel seçiniz.</div>
          )}
        </section>
      </section>

      <style jsx global>{`
        .personnelUi,
        .personnelUi * {
          box-sizing: border-box;
        }

        .personnelUi {
          width: 100%;
          max-width: 100%;
          overflow: hidden;
        }

        .personnelUi button,
        .personnelUi input,
        .personnelUi select {
          font: inherit;
          touch-action: manipulation;
          -webkit-tap-highlight-color: transparent;
        }

        .personnelUi button {
          cursor: pointer;
          transition:
            transform 150ms ease,
            box-shadow 150ms ease,
            filter 150ms ease,
            opacity 150ms ease !important;
        }

        .personnelUi button:not(:disabled):hover {
          filter: brightness(0.98);
          box-shadow: 0 8px 22px rgba(23, 105, 232, 0.12);
        }

        .personnelUi button:not(:disabled):active {
          transform: translateY(1px) scale(0.975) !important;
          filter: brightness(0.94);
        }

        .personnelUi button:focus-visible,
        .personnelUi input:focus-visible,
        .personnelUi select:focus-visible {
          outline: 3px solid rgba(23, 105, 232, 0.2) !important;
          outline-offset: 2px;
        }

        .personnelUi button:disabled {
          cursor: not-allowed;
          opacity: 0.58 !important;
          box-shadow: none !important;
        }

        @media (max-width: 900px) {
          body {
            overflow-x: hidden;
          }

          main:has(.personnelUi) {
            padding: 16px 12px 32px !important;
            width: 100%;
            max-width: 100vw;
            overflow-x: hidden;
          }

          main:has(.personnelUi) > div {
            width: 100%;
            max-width: 100%;
          }

          .personnelStats {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            gap: 9px !important;
          }

          .personnelWorkspace {
            display: grid !important;
            grid-template-columns: minmax(0, 1fr) !important;
            gap: 12px !important;
            width: 100% !important;
          }

          .personnelSidebar,
          .personnelDetail {
            width: 100% !important;
            min-width: 0 !important;
            max-width: 100% !important;
          }

          .personnelSidebar {
            max-height: 390px;
            overflow-y: auto !important;
            overscroll-behavior: contain;
          }

          .personnelHeader,
          .personnelHeader > div:first-child {
            align-items: flex-start !important;
          }

          .personnelHeader {
            display: grid !important;
            grid-template-columns: minmax(0, 1fr) !important;
            gap: 12px !important;
          }

          .personnelTabs {
            display: flex !important;
            width: 100%;
            overflow-x: auto !important;
            overflow-y: hidden;
            padding: 10px 12px !important;
            scroll-snap-type: x proximity;
            -webkit-overflow-scrolling: touch;
          }

          .personnelTabs button {
            flex: 0 0 auto;
            min-height: 44px;
            scroll-snap-align: start;
          }

          .personnelTabContent {
            padding: 16px 12px !important;
            min-width: 0 !important;
            overflow: hidden;
          }

          .personnelUi input,
          .personnelUi select,
          .personnelUi button {
            min-height: 44px;
          }
        }

        @media (max-width: 560px) {
          .personnelStats {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }

          .personnelStats > article {
            padding: 13px 12px !important;
            min-width: 0;
          }

          .personnelStats strong {
            font-size: 23px !important;
          }

          .personnelUi [data-personnel-form-grid],
          .personnelUi [data-personnel-grid] {
            grid-template-columns: minmax(0, 1fr) !important;
          }

          .personnelUi [data-personnel-section-header] {
            align-items: stretch !important;
            flex-direction: column !important;
          }

          .personnelUi [data-personnel-section-header] > button {
            width: 100%;
          }

          .personnelUi [data-create-panel] {
            padding: 16px 12px 22px !important;
          }

          .personnelUi [data-password-panel] {
            display: grid !important;
            grid-template-columns: minmax(0, 1fr) !important;
            align-items: stretch !important;
          }

          .personnelUi [data-password-panel] button {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
}

function Stat({
  title,
  value,
  note,
  active,
  onClick,
}: {
  title: string;
  value: number;
  note: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      style={{
        ...statCardStyle,
        width: "100%",
        textAlign: "left",
        cursor: "pointer",
        borderColor: active ? "#1769e8" : "#e2e8f0",
        background: active
          ? "linear-gradient(145deg, #eff6ff 0%, #ffffff 100%)"
          : "#ffffff",
        boxShadow: active
          ? "0 12px 28px rgba(23, 105, 232, 0.13)"
          : "0 5px 18px rgba(15, 23, 42, 0.04)",
      }}
    >
      <span style={statTitleStyle}>{title}</span>
      <strong style={statValueStyle}>{value}</strong>
      <small style={statNoteStyle}>{active ? `✓ ${note}` : note}</small>
    </button>
  );
}

function GeneralTab({
  profile,
  staff,
  branchCount,
  permissionCount,
  pending,
  onSave,
}: {
  profile: Profile;
  staff: Staff | null;
  branchCount: number;
  permissionCount: number;
  pending: boolean;
  onSave: (input: {
    profileId: string;
    fullName: string;
    email?: string;
    phone?: string;
    role: Exclude<UserRole, "owner">;
  }) => void;
}) {
  const isOwner = profile.role === "owner";
  const [fullName, setFullName] = useState(profile.full_name || "");
  const [phone, setPhone] = useState(profile.phone || "");
  const [email, setEmail] = useState(profile.email || "");
  const [role, setRole] = useState(
    (profile.role === "owner" ? "admin" : profile.role) as Exclude<
      UserRole,
      "owner"
    >
  );

  return (
    <>
      <div data-personnel-grid style={infoGridStyle}>
        <Info label="Hesap Durumu" value={profile.is_active ? "Aktif" : "Pasif"} />
        <Info label="Şube Sayısı" value={String(branchCount)} />
        <Info label="Aktif Yetki" value={String(permissionCount)} />
        <Info
          label="Son Giriş"
          value={formatDate(profile.last_sign_in_at)}
        />
      </div>

      {isOwner ? (
        <div style={warningStyle}>
          Sistem Sahibi hesabının rolü ve temel erişimleri bu ekrandan
          değiştirilemez.
        </div>
      ) : (
        <div style={{ marginTop: 22 }}>
          <h3 style={sectionTitleStyle}>Personel Bilgileri</h3>

          <div data-personnel-form-grid style={formGridStyle}>
            <Field label="Ad Soyad">
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                style={inputStyle}
              />
            </Field>

            <Field label="Telefon">
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="05436048006"
                style={inputStyle}
              />
            </Field>

            <Field label="E-posta">
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                style={inputStyle}
              />
            </Field>

            <Field label="Görev / Rol">
              <select
                value={role}
                onChange={(e) =>
                  setRole(e.target.value as Exclude<UserRole, "owner">)
                }
                style={inputStyle}
              >
                {STAFF_ROLES.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <button
            type="button"
            disabled={pending}
            onClick={() =>
              onSave({
                profileId: profile.id,
                fullName,
                email,
                phone,
                role,
              })
            }
            style={primaryButton}
          >
            {pending ? "Kaydediliyor..." : "Bilgileri Kaydet"}
          </button>
        </div>
      )}

      {staff?.must_change_password ? (
        <div style={noticeStyle}>
          Bu kullanıcı için ilk girişte şifre değişikliği öneriliyor.
        </div>
      ) : null}
    </>
  );
}

function BranchesTab({
  profile,
  staff,
  branches,
  selectedBranchIds,
  pending,
  onSave,
}: {
  profile: Profile;
  staff: Staff | null;
  branches: Branch[];
  selectedBranchIds: string[];
  pending: boolean;
  onSave: (branchIds: string[], allBranches: boolean) => void;
}) {
  const [selected, setSelected] = useState<string[]>(selectedBranchIds);
  const [allBranches, setAllBranches] = useState(Boolean(staff?.all_branches));

  if (profile.role === "owner") {
    return <div style={warningStyle}>Sistem Sahibi tüm şubelere erişebilir.</div>;
  }

  function toggleBranch(branchId: string) {
    const next = selected.includes(branchId)
      ? selected.filter((id) => id !== branchId)
      : [...selected, branchId];

    setSelected(next);
    setAllBranches(false);
    onSave(next, false);
  }

  function toggleAll() {
    const next = !allBranches;
    setAllBranches(next);
    setSelected(next ? branches.map((b) => b.id) : []);
    onSave(next ? branches.map((b) => b.id) : [], next);
  }

  return (
    <>
      <div data-personnel-section-header style={sectionHeaderStyle}>
        <div>
          <h3 style={sectionTitleStyle}>Çalışabileceği Şubeler</h3>
          <p style={sectionTextStyle}>
            Bir kutuya tıkladığınız anda seçim otomatik kaydedilir.
          </p>
        </div>

        <span style={autoSaveBadgeStyle}>✓ Otomatik Kayıt</span>
      </div>

      <button
        type="button"
        disabled={pending}
        onClick={toggleAll}
        style={{
          ...branchCardStyle,
          borderColor: allBranches ? "#1769e8" : "#dfe7f1",
          background: allBranches ? "#eff6ff" : "#fff",
        }}
      >
        <span>
          <strong>Tüm Şubeler</strong>
          <small style={branchHelpStyle}>Aktif tüm şubelere erişim</small>
        </span>

        <Switch active={allBranches} />
      </button>

      <div data-personnel-grid style={branchGridStyle}>
        {branches.map((branch) => {
          const active = allBranches || selected.includes(branch.id);

          return (
            <button
              key={branch.id}
              type="button"
              disabled={pending || allBranches}
              onClick={() => toggleBranch(branch.id)}
              style={{
                ...branchCardStyle,
                opacity: allBranches ? 0.7 : 1,
                borderColor: active ? "#1769e8" : "#dfe7f1",
                background: active ? "#f5f9ff" : "#fff",
              }}
            >
              <span>
                <strong>{branch.name}</strong>
                <small style={branchHelpStyle}>
                  {active ? "Erişim açık" : "Erişim kapalı"}
                </small>
              </span>

              <Switch active={active} />
            </button>
          );
        })}
      </div>
    </>
  );
}

function PermissionsTab({
  profile,
  staff,
  permissionDefinitions,
  permissionMap,
  pending,
  onPermission,
  onSuperUser,
  onAll,
  onAccounting,
}: {
  profile: Profile;
  staff: Staff | null;
  permissionDefinitions: PermissionDefinition[];
  permissionMap: Map<string, boolean>;
  pending: boolean;
  onPermission: (permissionKey: string, allowed: boolean) => void;
  onSuperUser: (enabled: boolean) => void;
  onAll: (allowed: boolean) => void;
  onAccounting: (allowed: boolean) => void;
}) {
  if (profile.role === "owner") {
    return <div style={warningStyle}>Sistem Sahibi tüm yetkilere sahiptir.</div>;
  }

  const groups = permissionDefinitions.reduce<
    Record<string, PermissionDefinition[]>
  >((acc, permission) => {
    const key = permission.module_key || "other";
    if (!acc[key]) acc[key] = [];
    acc[key].push(permission);
    return acc;
  }, {});

  const superUser =
    Boolean(staff?.is_super_user) ||
    permissionMap.get("system.superuser") === true;

  return (
    <>
      <div data-personnel-grid style={quickGridStyle}>
        <QuickToggle
          title="Süper Kullanıcı"
          description="Tüm SprintOS modüllerine tam erişim sağlar."
          active={superUser}
          pending={pending}
          onClick={() => onSuperUser(!superUser)}
        />

        <QuickDual
          title="Tüm Standart Yetkiler"
          description="Normal yetkilerin tamamını tek seferde yönet."
          pending={pending}
          onOpen={() => onAll(true)}
          onClose={() => onAll(false)}
        />

        <QuickDual
          title="Muhasebe"
          description="Ödeme, kasa ve finansal yetkileri toplu yönet."
          pending={pending}
          onOpen={() => onAccounting(true)}
          onClose={() => onAccounting(false)}
        />
      </div>

      {Object.entries(groups).map(([moduleKey, permissions]) => (
        <section key={moduleKey} style={permissionSectionStyle}>
          <div style={moduleTitleStyle}>
            {MODULE_LABELS[moduleKey] || moduleKey}
          </div>

          <div style={permissionListStyle}>
            {permissions.map((permission) => {
              const active = permissionMap.get(permission.permission_key) === true;

              return (
                <button
                  key={permission.permission_key}
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    onPermission(permission.permission_key, !active)
                  }
                  style={{
                    ...permissionRowStyle,
                    borderColor: active ? "#bfdbfe" : "#e2e8f0",
                    background: active ? "#f8fbff" : "#fff",
                  }}
                >
                  <span style={{ textAlign: "left" }}>
                    <strong>{permission.label}</strong>
                    {permission.description ? (
                      <small style={permissionHelpStyle}>
                        {permission.description}
                      </small>
                    ) : null}
                  </span>

                  <span style={permissionStateStyle}>
                    <span
                      style={{
                        color: active ? "#166534" : "#64748b",
                        fontSize: 11,
                        fontWeight: 900,
                      }}
                    >
                      {active ? "AÇIK" : "KAPALI"}
                    </span>
                    <Switch active={active} />
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </>
  );
}

function SecurityTab({
  profile,
  staff,
  pending,
  onLoginEnabled,
  onActive,
  onPassword,
}: {
  profile: Profile;
  staff: Staff | null;
  pending: boolean;
  onLoginEnabled: (enabled: boolean) => void;
  onActive: (active: boolean) => void;
  onPassword: (password: string) => void;
}) {
  const [password, setPassword] = useState("");
  const isOwner = profile.role === "owner";
  const loginEnabled = isOwner ? true : staff?.login_enabled !== false;

  return (
    <>
      <div data-personnel-grid style={securityGridStyle}>
        <div style={securityCardStyle}>
          <div>
            <div style={securityLabelStyle}>Sisteme Giriş</div>
            <strong style={securityValueStyle}>
              {loginEnabled ? "Açık" : "Kapalı"}
            </strong>
            <p style={securityTextStyle}>
              Bu kişinin SprintOS hesabına giriş yapabilmesini kontrol eder.
            </p>
          </div>

          <button
            type="button"
            disabled={pending || isOwner}
            onClick={() => onLoginEnabled(!loginEnabled)}
            style={cleanButtonStyle}
          >
            <Switch active={loginEnabled} />
          </button>
        </div>

        <div style={securityCardStyle}>
          <div>
            <div style={securityLabelStyle}>Hesap Durumu</div>
            <strong style={securityValueStyle}>
              {profile.is_active ? "Aktif" : "Pasif"}
            </strong>
            <p style={securityTextStyle}>
              Hesabı tamamen aktif veya pasif duruma getirir.
            </p>
          </div>

          <button
            type="button"
            disabled={pending || isOwner}
            onClick={() => onActive(!profile.is_active)}
            style={cleanButtonStyle}
          >
            <Switch active={profile.is_active} />
          </button>
        </div>
      </div>

      <div data-personnel-grid style={infoGridStyle}>
        <Info label="Telefon" value={formatPhone(profile.phone)} />
        <Info label="E-posta" value={profile.email || "—"} />
        <Info label="Son Giriş" value={formatDate(profile.last_sign_in_at)} />
        <Info
          label="İlk Girişte Şifre Değişimi"
          value={staff?.must_change_password ? "Gerekli" : "Tamamlandı"}
        />
      </div>

      {!isOwner ? (
        <div data-password-panel style={passwordPanelStyle}>
          <div>
            <h3 style={sectionTitleStyle}>Yeni / Geçici Şifre</h3>
            <p style={sectionTextStyle}>
              En az 8 karakterlik yeni bir geçici şifre tanımlayın.
            </p>
          </div>

          <PasswordField
            value={password}
            onChange={setPassword}
            disabled={pending}
            placeholder="Yeni geçici şifre"
          />

          <button
            type="button"
            disabled={pending || password.length < 8}
            onClick={() => {
              onPassword(password);
              setPassword("");
            }}
            style={primaryButton}
          >
            {pending ? "İşleniyor..." : "Şifreyi Değiştir"}
          </button>
        </div>
      ) : null}
    </>
  );
}

function HistoryTab({ logs }: { logs: AuditLog[] }) {
  return (
    <>
      <div data-personnel-section-header style={sectionHeaderStyle}>
        <div>
          <h3 style={sectionTitleStyle}>İşlem Geçmişi</h3>
          <p style={sectionTextStyle}>
            Önemli yönetim işlemleri tarih ve saat bilgisiyle kayıt altında.
          </p>
        </div>
        <span style={autoSaveBadgeStyle}>{logs.length} kayıt</span>
      </div>

      <div style={timelineStyle}>
        {logs.map((log) => (
          <div key={log.id} style={timelineItemStyle}>
            <div style={timelineDotStyle} />
            <div style={{ flex: 1 }}>
              <div style={timelineTopStyle}>
                <strong>{log.action_label}</strong>
                <time style={timelineTimeStyle}>{formatDate(log.created_at)}</time>
              </div>

              {log.description ? (
                <div style={timelineDescriptionStyle}>{log.description}</div>
              ) : null}

              <div style={timelineMetaStyle}>
                {log.module_key} · {log.action_key}
              </div>
            </div>
          </div>
        ))}

        {!logs.length ? (
          <div style={emptyPanelStyle}>Henüz işlem kaydı bulunmuyor.</div>
        ) : null}
      </div>
    </>
  );
}

function CreateStaffPanel({
  branches,
  permissionDefinitions,
  pending,
  onCancel,
  onSubmit,
}: {
  branches: Branch[];
  permissionDefinitions: PermissionDefinition[];
  pending: boolean;
  onCancel: () => void;
  onSubmit: (input: CreateStaffInput) => void;
}) {
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] =
    useState<Exclude<UserRole, "owner">>("coach");
  const [branchIds, setBranchIds] = useState<string[]>([]);
  const [allBranches, setAllBranches] = useState(false);
  const [permissionKeys, setPermissionKeys] = useState<string[]>([]);

  return (
    <div data-create-panel style={{ padding: 24 }}>
      <div data-personnel-section-header style={sectionHeaderStyle}>
        <div>
          <div style={eyebrowStyle}>YENİ PERSONEL</div>
          <h2 style={{ margin: "5px 0 0" }}>Personel hesabı oluştur</h2>
          <p style={sectionTextStyle}>
            Telefon alanında +90 yazmanıza gerek yoktur.
          </p>
        </div>

        <button type="button" onClick={onCancel} style={secondaryButton}>
          Vazgeç
        </button>
      </div>

      <div data-personnel-form-grid style={formGridStyle}>
        <Field label="Ad Soyad">
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            style={inputStyle}
          />
        </Field>

        <Field label="Telefon">
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="05436048006"
            style={inputStyle}
          />
        </Field>

        <Field label="E-posta">
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            style={inputStyle}
          />
        </Field>

        <Field label="Geçici Şifre">
          <PasswordField
            value={password}
            onChange={setPassword}
            disabled={pending}
            placeholder="En az 8 karakter"
          />
        </Field>

        <Field label="Görev / Rol">
          <select
            value={role}
            onChange={(e) =>
              setRole(e.target.value as Exclude<UserRole, "owner">)
            }
            style={inputStyle}
          >
            {STAFF_ROLES.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div style={createSectionStyle}>
        <h3 style={sectionTitleStyle}>Şubeler</h3>

        <button
          type="button"
          onClick={() => {
            const next = !allBranches;
            setAllBranches(next);
            setBranchIds(next ? branches.map((b) => b.id) : []);
          }}
          style={{
            ...branchCardStyle,
            borderColor: allBranches ? "#1769e8" : "#dfe7f1",
          }}
        >
          <strong>Tüm Şubeler</strong>
          <Switch active={allBranches} />
        </button>

        <div data-personnel-grid style={branchGridStyle}>
          {branches.map((branch) => {
            const active = allBranches || branchIds.includes(branch.id);

            return (
              <button
                key={branch.id}
                type="button"
                disabled={allBranches}
                onClick={() =>
                  setBranchIds((prev) =>
                    prev.includes(branch.id)
                      ? prev.filter((id) => id !== branch.id)
                      : [...prev, branch.id]
                  )
                }
                style={{
                  ...branchCardStyle,
                  borderColor: active ? "#1769e8" : "#dfe7f1",
                  opacity: allBranches ? 0.7 : 1,
                }}
              >
                <span>{branch.name}</span>
                <Switch active={active} />
              </button>
            );
          })}
        </div>
      </div>

      <div style={createSectionStyle}>
        <h3 style={sectionTitleStyle}>Başlangıç Yetkileri</h3>

        <div style={permissionListStyle}>
          {permissionDefinitions.map((permission) => {
            const active = permissionKeys.includes(permission.permission_key);

            return (
              <button
                key={permission.permission_key}
                type="button"
                onClick={() =>
                  setPermissionKeys((prev) =>
                    active
                      ? prev.filter((key) => key !== permission.permission_key)
                      : [...prev, permission.permission_key]
                  )
                }
                style={permissionRowStyle}
              >
                <span style={{ textAlign: "left" }}>
                  <strong>{permission.label}</strong>
                  <small style={permissionHelpStyle}>
                    {MODULE_LABELS[permission.module_key] ||
                      permission.module_key}
                  </small>
                </span>
                <Switch active={active} />
              </button>
            );
          })}
        </div>
      </div>

      <button
        type="button"
        disabled={
          pending ||
          !fullName.trim() ||
          (!phone.trim() && !email.trim()) ||
          password.length < 8
        }
        onClick={() =>
          onSubmit({
            fullName,
            phone,
            email,
            password,
            role,
            branchIds,
            allBranches,
            permissionKeys,
          })
        }
        style={primaryButton}
      >
        {pending ? "Oluşturuluyor..." : "+ Personeli Oluştur"}
      </button>
    </div>
  );
}

function QuickToggle({
  title,
  description,
  active,
  pending,
  onClick,
}: {
  title: string;
  description: string;
  active: boolean;
  pending: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={pending}
      onClick={onClick}
      style={quickCardButtonStyle}
    >
      <span style={{ textAlign: "left" }}>
        <strong>{title}</strong>
        <small style={quickDescriptionStyle}>{description}</small>
      </span>
      <Switch active={active} />
    </button>
  );
}

function QuickDual({
  title,
  description,
  pending,
  onOpen,
  onClose,
}: {
  title: string;
  description: string;
  pending: boolean;
  onOpen: () => void;
  onClose: () => void;
}) {
  return (
    <div style={quickCardStyle}>
      <span>
        <strong>{title}</strong>
        <small style={quickDescriptionStyle}>{description}</small>
      </span>

      <div style={{ display: "flex", gap: 6 }}>
        <button
          type="button"
          disabled={pending}
          onClick={onOpen}
          style={openButtonStyle}
        >
          Aç
        </button>

        <button
          type="button"
          disabled={pending}
          onClick={onClose}
          style={closeButtonStyle}
        >
          Kapat
        </button>
      </div>
    </div>
  );
}

function Switch({ active }: { active: boolean }) {
  return (
    <span
      aria-hidden="true"
      style={{
        ...switchTrackStyle,
        background: active ? "#16a34a" : "#cbd5e1",
      }}
    >
      <span
        style={{
          ...switchKnobStyle,
          transform: active ? "translateX(20px)" : "translateX(0)",
        }}
      />
    </span>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div style={infoCardStyle}>
      <span style={infoLabelStyle}>{label}</span>
      <strong style={infoValueStyle}>{value}</strong>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label style={fieldStyle}>
      <span>{label}</span>
      {children}
    </label>
  );
}

const statsGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4,minmax(0,1fr))",
  gap: 12,
  marginBottom: 16,
};

const statCardStyle: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #e2e8f0",
  borderRadius: 16,
  padding: 16,
  display: "grid",
  gap: 5,
};

const statTitleStyle: React.CSSProperties = {
  color: "#64748b",
  fontSize: 11,
  fontWeight: 800,
};

const statValueStyle: React.CSSProperties = {
  color: "#0f172a",
  fontSize: 28,
  lineHeight: 1,
};

const statNoteStyle: React.CSSProperties = {
  color: "#94a3b8",
  fontSize: 10,
};

const workspaceStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "350px minmax(0,1fr)",
  gap: 14,
  alignItems: "start",
};

const sidebarStyle: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #e2e8f0",
  borderRadius: 18,
  overflow: "hidden",
};

const sidebarHeaderStyle: React.CSSProperties = {
  padding: 16,
  borderBottom: "1px solid #e8eef6",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
};

const eyebrowStyle: React.CSSProperties = {
  color: "#1769e8",
  fontSize: 10,
  fontWeight: 900,
  letterSpacing: 1,
};

const filtersStyle: React.CSSProperties = {
  padding: 12,
  display: "grid",
  gap: 8,
  borderBottom: "1px solid #eef2f7",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "11px 12px",
  borderRadius: 10,
  border: "1px solid #d8e2ee",
  background: "#fff",
  color: "#0f172a",
  outline: "none",
};

const personListStyle: React.CSSProperties = {
  padding: 9,
  display: "grid",
  gap: 8,
  maxHeight: "70vh",
  overflowY: "auto",
};

const personCardStyle: React.CSSProperties = {
  width: "100%",
  display: "flex",
  gap: 10,
  alignItems: "flex-start",
  border: "1px solid #e2e8f0",
  borderRadius: 14,
  padding: 12,
  cursor: "pointer",
  textAlign: "left",
  color: "#0f172a",
};

const avatarStyle: React.CSSProperties = {
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

const personCardTopStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 8,
};

const personNameStyle: React.CSSProperties = {
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const personMetaStyle: React.CSSProperties = {
  color: "#64748b",
  fontSize: 11,
  marginTop: 2,
};

const personTinyStatsStyle: React.CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  marginTop: 7,
  color: "#64748b",
  fontSize: 9,
};

const activeBadgeStyle: React.CSSProperties = {
  padding: "4px 7px",
  borderRadius: 999,
  background: "#dcfce7",
  color: "#166534",
  fontSize: 9,
  fontWeight: 900,
};

const passiveBadgeStyle: React.CSSProperties = {
  ...activeBadgeStyle,
  background: "#fee2e2",
  color: "#991b1b",
};

const arrowStyle: React.CSSProperties = {
  color: "#1769e8",
  fontSize: 25,
  lineHeight: 1,
  marginTop: 5,
};

const detailPanelStyle: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #e2e8f0",
  borderRadius: 18,
  overflow: "hidden",
  minHeight: 650,
};

const personHeaderStyle: React.CSSProperties = {
  padding: 20,
  borderBottom: "1px solid #e8eef6",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 16,
  flexWrap: "wrap",
};

const bigAvatarStyle: React.CSSProperties = {
  width: 58,
  height: 58,
  borderRadius: 16,
  background: "#eaf3ff",
  color: "#1769e8",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 20,
  fontWeight: 900,
};

const headerMetaStyle: React.CSSProperties = {
  color: "#64748b",
  fontSize: 12,
  marginTop: 5,
};

const superBadgeStyle: React.CSSProperties = {
  padding: "7px 10px",
  borderRadius: 999,
  background: "#eef2ff",
  color: "#4338ca",
  fontSize: 11,
  fontWeight: 900,
};

const activeLargeBadgeStyle: React.CSSProperties = {
  padding: "7px 10px",
  borderRadius: 999,
  background: "#dcfce7",
  color: "#166534",
  fontSize: 11,
  fontWeight: 900,
};

const passiveLargeBadgeStyle: React.CSSProperties = {
  ...activeLargeBadgeStyle,
  background: "#fee2e2",
  color: "#991b1b",
};

const tabsStyle: React.CSSProperties = {
  display: "flex",
  gap: 4,
  padding: "10px 14px",
  borderBottom: "1px solid #e8eef6",
  overflowX: "auto",
};

const tabButtonStyle: React.CSSProperties = {
  border: 0,
  background: "transparent",
  color: "#64748b",
  borderRadius: 9,
  padding: "9px 11px",
  fontSize: 11,
  fontWeight: 850,
  cursor: "pointer",
  whiteSpace: "nowrap",
};

const activeTabButtonStyle: React.CSSProperties = {
  background: "#1769e8",
  color: "#fff",
};

const tabContentStyle: React.CSSProperties = {
  padding: 22,
};

const infoGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4,minmax(0,1fr))",
  gap: 10,
};

const infoCardStyle: React.CSSProperties = {
  border: "1px solid #e2e8f0",
  borderRadius: 12,
  padding: 13,
  background: "#fbfdff",
  display: "grid",
  gap: 6,
};

const infoLabelStyle: React.CSSProperties = {
  color: "#64748b",
  fontSize: 10,
  fontWeight: 800,
};

const infoValueStyle: React.CSSProperties = {
  color: "#0f172a",
  fontSize: 14,
};

const warningStyle: React.CSSProperties = {
  marginTop: 18,
  border: "1px solid #fed7aa",
  background: "#fff7ed",
  color: "#9a3412",
  borderRadius: 12,
  padding: 14,
  fontWeight: 750,
  fontSize: 12,
};

const noticeStyle: React.CSSProperties = {
  marginTop: 16,
  border: "1px solid #bfdbfe",
  background: "#eff6ff",
  color: "#1d4ed8",
  borderRadius: 12,
  padding: 12,
  fontSize: 11,
};

const sectionTitleStyle: React.CSSProperties = {
  margin: 0,
  color: "#0f172a",
  fontSize: 16,
};

const sectionTextStyle: React.CSSProperties = {
  margin: "6px 0 0",
  color: "#64748b",
  fontSize: 11,
  lineHeight: 1.5,
};

const sectionHeaderStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 12,
  marginBottom: 16,
};

const autoSaveBadgeStyle: React.CSSProperties = {
  padding: "6px 9px",
  borderRadius: 999,
  background: "#ecfdf5",
  color: "#15803d",
  fontSize: 10,
  fontWeight: 900,
};

const formGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2,minmax(0,1fr))",
  gap: 10,
  marginTop: 12,
};

const fieldStyle: React.CSSProperties = {
  display: "grid",
  gap: 6,
  color: "#64748b",
  fontSize: 10,
  fontWeight: 900,
};

const primaryButton: React.CSSProperties = {
  border: 0,
  borderRadius: 10,
  background: "#1769e8",
  color: "#fff",
  padding: "11px 15px",
  fontSize: 11,
  fontWeight: 900,
  cursor: "pointer",
  marginTop: 14,
};

const smallPrimaryButton: React.CSSProperties = {
  ...primaryButton,
  marginTop: 0,
  padding: "9px 11px",
};

const secondaryButton: React.CSSProperties = {
  border: "1px solid #d8e2ee",
  borderRadius: 10,
  background: "#fff",
  color: "#334155",
  padding: "9px 12px",
  fontWeight: 850,
  cursor: "pointer",
};

const branchGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2,minmax(0,1fr))",
  gap: 8,
  marginTop: 10,
};

const branchCardStyle: React.CSSProperties = {
  width: "100%",
  border: "1px solid #dfe7f1",
  background: "#fff",
  borderRadius: 12,
  padding: 13,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
  color: "#0f172a",
  cursor: "pointer",
  textAlign: "left",
};

const branchHelpStyle: React.CSSProperties = {
  display: "block",
  color: "#64748b",
  fontSize: 10,
  marginTop: 3,
};

const switchTrackStyle: React.CSSProperties = {
  width: 42,
  height: 22,
  borderRadius: 999,
  padding: 2,
  display: "inline-flex",
  alignItems: "center",
  transition: "all .18s ease",
  flexShrink: 0,
};

const switchKnobStyle: React.CSSProperties = {
  width: 18,
  height: 18,
  borderRadius: "50%",
  background: "#fff",
  boxShadow: "0 1px 4px rgba(15,23,42,.25)",
  transition: "transform .18s ease",
};

const quickGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3,minmax(0,1fr))",
  gap: 10,
  marginBottom: 20,
};

const quickCardStyle: React.CSSProperties = {
  border: "1px solid #e2e8f0",
  borderRadius: 13,
  padding: 14,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
};

const quickCardButtonStyle: React.CSSProperties = {
  ...quickCardStyle,
  width: "100%",
  background: "#fff",
  color: "#0f172a",
  cursor: "pointer",
  textAlign: "left",
};

const quickDescriptionStyle: React.CSSProperties = {
  display: "block",
  color: "#64748b",
  fontSize: 10,
  marginTop: 4,
  lineHeight: 1.4,
};

const openButtonStyle: React.CSSProperties = {
  border: 0,
  borderRadius: 8,
  background: "#dcfce7",
  color: "#166534",
  padding: "8px 10px",
  fontWeight: 900,
  cursor: "pointer",
};

const closeButtonStyle: React.CSSProperties = {
  border: 0,
  borderRadius: 8,
  background: "#fee2e2",
  color: "#991b1b",
  padding: "8px 10px",
  fontWeight: 900,
  cursor: "pointer",
};

const permissionSectionStyle: React.CSSProperties = {
  marginBottom: 18,
};

const moduleTitleStyle: React.CSSProperties = {
  color: "#475569",
  fontSize: 11,
  fontWeight: 900,
  marginBottom: 7,
};

const permissionListStyle: React.CSSProperties = {
  display: "grid",
  gap: 6,
};

const permissionRowStyle: React.CSSProperties = {
  width: "100%",
  border: "1px solid #e2e8f0",
  borderRadius: 11,
  padding: "11px 12px",
  background: "#fff",
  color: "#0f172a",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  cursor: "pointer",
};

const permissionHelpStyle: React.CSSProperties = {
  display: "block",
  color: "#64748b",
  fontSize: 10,
  marginTop: 3,
};

const permissionStateStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
};

const securityGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2,minmax(0,1fr))",
  gap: 10,
  marginBottom: 14,
};

const securityCardStyle: React.CSSProperties = {
  border: "1px solid #e2e8f0",
  borderRadius: 13,
  padding: 15,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
};

const securityLabelStyle: React.CSSProperties = {
  color: "#64748b",
  fontSize: 10,
  fontWeight: 850,
};

const securityValueStyle: React.CSSProperties = {
  display: "block",
  fontSize: 18,
  marginTop: 4,
};

const securityTextStyle: React.CSSProperties = {
  margin: "6px 0 0",
  color: "#64748b",
  fontSize: 10,
  lineHeight: 1.4,
};

const cleanButtonStyle: React.CSSProperties = {
  border: 0,
  background: "transparent",
  cursor: "pointer",
  padding: 0,
};

const passwordPanelStyle: React.CSSProperties = {
  marginTop: 18,
  paddingTop: 18,
  borderTop: "1px solid #edf1f6",
  display: "flex",
  alignItems: "center",
  gap: 12,
  flexWrap: "wrap",
};

const timelineStyle: React.CSSProperties = {
  display: "grid",
  gap: 8,
};

const timelineItemStyle: React.CSSProperties = {
  display: "flex",
  gap: 10,
  border: "1px solid #e2e8f0",
  borderRadius: 12,
  padding: 13,
};

const timelineDotStyle: React.CSSProperties = {
  width: 10,
  height: 10,
  borderRadius: "50%",
  background: "#1769e8",
  marginTop: 4,
  flexShrink: 0,
};

const timelineTopStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 10,
  fontSize: 11,
};

const timelineTimeStyle: React.CSSProperties = {
  color: "#64748b",
  fontSize: 10,
};

const timelineDescriptionStyle: React.CSSProperties = {
  color: "#475569",
  fontSize: 11,
  marginTop: 5,
};

const timelineMetaStyle: React.CSSProperties = {
  color: "#94a3b8",
  fontSize: 9,
  marginTop: 5,
};

const createSectionStyle: React.CSSProperties = {
  marginTop: 20,
  paddingTop: 18,
  borderTop: "1px solid #edf1f6",
};

const pendingBarStyle: React.CSSProperties = {
  position: "fixed",
  top: 76,
  left: "50%",
  transform: "translateX(-50%)",
  zIndex: 999,
  borderRadius: 999,
  padding: "8px 13px",
  background: "#0f172a",
  color: "#fff",
  fontSize: 11,
  fontWeight: 850,
  boxShadow: "0 8px 30px rgba(15,23,42,.22)",
  display: "flex",
  alignItems: "center",
  gap: 8,
};

const spinnerStyle: React.CSSProperties = {
  width: 12,
  height: 12,
  border: "2px solid rgba(255,255,255,.35)",
  borderTopColor: "#fff",
  borderRadius: "50%",
  display: "inline-block",
};

const emptyPanelStyle: React.CSSProperties = {
  minHeight: 300,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexDirection: "column",
  gap: 12,
  color: "#64748b",
};
