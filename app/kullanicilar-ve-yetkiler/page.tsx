import UstGezinme from "@/app/components/UstGezinme";
import { createClient } from "@/lib/supabase/server";
import YetkiPaneliClient from "./YetkiPaneliClient";

export const dynamic = "force-dynamic";

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

  const { data: currentProfile } = await supabase
    .from("profiles")
    .select("id, organization_id, role, is_active")
    .eq("id", user.id)
    .single();

  if (
    !currentProfile ||
    !currentProfile.is_active ||
    !["owner", "admin"].includes(String(currentProfile.role)) ||
    !currentProfile.organization_id
  ) {
    return (
      <main style={{ padding: 40 }}>
        Bu bölüme erişim yetkiniz bulunmuyor.
      </main>
    );
  }

  const organizationId = currentProfile.organization_id;

  const [
    profilesResult,
    staffResult,
    branchesResult,
    permissionDefinitionsResult,
    staffBranchesResult,
    staffPermissionsResult,
    auditLogsResult,
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "id, full_name, email, phone, role, is_active, last_sign_in_at"
      )
      .eq("organization_id", organizationId)
      .order("full_name"),

    supabase
      .from("staff")
      .select(
        "id, auth_user_id, login_enabled, is_super_user, must_change_password, all_branches"
      )
      .eq("organization_id", organizationId),

    supabase
      .from("branches")
      .select("id, name, short_name")
      .eq("organization_id", organizationId)
      .eq("is_active", true)
      .order("name"),

    supabase
      .from("permission_definitions")
      .select(
        "permission_key, module_key, label, description, sort_order"
      )
      .eq("is_active", true)
      .order("sort_order"),

    supabase
      .from("staff_branches")
      .select("staff_id, branch_id")
      .eq("organization_id", organizationId),

    supabase
      .from("staff_permissions")
      .select("staff_id, permission_key, is_allowed")
      .eq("organization_id", organizationId),

    supabase
      .from("audit_logs")
      .select(
        "id, actor_profile_id, actor_staff_id, module_key, action_key, action_label, entity_id, description, success, created_at"
      )
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(500),
  ]);

  const error =
    profilesResult.error ||
    staffResult.error ||
    branchesResult.error ||
    permissionDefinitionsResult.error ||
    staffBranchesResult.error ||
    staffPermissionsResult.error ||
    auditLogsResult.error;

  if (error) {
    return (
      <>
        <UstGezinme />
        <main style={{ padding: 40 }}>
          <h1>Kullanıcılar ve Yetkiler</h1>
          <p style={{ color: "#b91c1c" }}>
            Veriler yüklenemedi: {error.message}
          </p>
        </main>
      </>
    );
  }

  return (
    <>
      <UstGezinme />

      <main
        style={{
          minHeight: "100vh",
          background: "#f4f7fb",
          padding: 28,
          color: "#13233f",
          fontFamily:
            "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        }}
      >
        <div style={{ maxWidth: 1580, margin: "0 auto" }}>
          <header
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-end",
              gap: 18,
              flexWrap: "wrap",
              marginBottom: 18,
            }}
          >
            <div>
              <div
                style={{
                  color: "#1769e8",
                  fontSize: 11,
                  fontWeight: 900,
                  letterSpacing: 1.2,
                }}
              >
                SPRİNT YÜZME OKULU · SPRINTOS
              </div>

              <h1
                style={{
                  margin: "6px 0 0",
                  color: "#0f172a",
                  fontSize: 30,
                  lineHeight: 1.1,
                }}
              >
                Personel & Yetki Merkezi
              </h1>

              <p
                style={{
                  margin: "7px 0 0",
                  color: "#64748b",
                  fontSize: 13,
                }}
              >
                Kullanıcı, şube, yetki, giriş güvenliği ve işlem geçmişini
                tek merkezden yönetin.
              </p>
            </div>
          </header>

          <YetkiPaneliClient
            profiles={profilesResult.data ?? []}
            staffRows={staffResult.data ?? []}
            branches={branchesResult.data ?? []}
            permissionDefinitions={permissionDefinitionsResult.data ?? []}
            staffBranches={staffBranchesResult.data ?? []}
            staffPermissions={staffPermissionsResult.data ?? []}
            auditLogs={auditLogsResult.data ?? []}
          />
        </div>
      </main>
    </>
  );
}
