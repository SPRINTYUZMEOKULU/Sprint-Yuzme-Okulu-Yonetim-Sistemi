import UstGezinme from "@/app/components/UstGezinme";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import YetkiPaneliClient from "./YetkiPaneliClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL bulunamadı.");
  }

  if (!key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY bulunamadı. Vercel Environment Variables bölümüne eklenmelidir."
    );
  }

  return createAdminClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export default async function Page() {
  /*
   * 1) Önce normal kullanıcı oturumunu doğrula.
   * Service Role ile kimlik doğrulama yapılmaz.
   */
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return (
      <main style={{ padding: 40 }}>
        Giriş yapmanız gerekiyor.
      </main>
    );
  }

  /*
   * 2) Giriş yapan kişinin yönetici olup olmadığını normal oturumla doğrula.
   */
  const { data: currentProfile, error: currentProfileError } = await supabase
    .from("profiles")
    .select("id, organization_id, role, is_active")
    .eq("id", user.id)
    .single();

  if (
    currentProfileError ||
    !currentProfile ||
    !currentProfile.is_active ||
    !["owner", "admin"].includes(String(currentProfile.role)) ||
    !currentProfile.organization_id
  ) {
    return (
      <>
        <UstGezinme />
        <main style={{ padding: 40 }}>
          Bu bölüme erişim yetkiniz bulunmuyor.
        </main>
      </>
    );
  }

  const organizationId = currentProfile.organization_id;

  /*
   * 3) Yönetici doğrulandıktan sonra yönetim verilerini Service Role ile oku.
   *
   * ÖNEMLİ:
   * actions.ts zaten yazma işlemlerini Service Role ile yapıyor.
   * Sayfa ise daha önce normal RLS istemcisi ile okuyordu.
   * Bu nedenle veri veritabanında TRUE olsa bile arayüz eski/KAPALI
   * görünebiliyordu.
   *
   * Service Role yalnızca bu SERVER COMPONENT içinde kullanılır.
   * Tarayıcıya key gönderilmez.
   */
  const admin = getAdminClient();

  const [
    profilesResult,
    staffResult,
    branchesResult,
    permissionDefinitionsResult,
    staffBranchesResult,
    staffPermissionsResult,
    auditLogsResult,
  ] = await Promise.all([
    admin
      .from("profiles")
      .select(
        "id, full_name, email, phone, role, is_active, last_sign_in_at"
      )
      .eq("organization_id", organizationId)
      .order("full_name"),

    admin
      .from("staff")
      .select(
        "id, auth_user_id, login_enabled, is_super_user, must_change_password, all_branches"
      )
      .eq("organization_id", organizationId),

    admin
      .from("branches")
      .select("id, name, short_name")
      .eq("organization_id", organizationId)
      .eq("is_active", true)
      .order("name"),

    admin
      .from("permission_definitions")
      .select(
        "permission_key, module_key, label, description, sort_order"
      )
      .eq("is_active", true)
      .order("sort_order"),

    admin
      .from("staff_branches")
      .select("staff_id, branch_id")
      .eq("organization_id", organizationId),

    admin
      .from("staff_permissions")
      .select("staff_id, permission_key, is_allowed")
      .eq("organization_id", organizationId),

    admin
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
