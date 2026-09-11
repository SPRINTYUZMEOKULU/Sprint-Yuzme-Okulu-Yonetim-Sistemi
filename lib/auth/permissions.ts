import { createClient as createAdminClient } from "@supabase/supabase-js";

export type PermissionSnapshot = {
  isSuperUser: boolean;
  permissions: Record<string, boolean>;
};

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) throw new Error("Supabase yönetici bağlantısı eksik.");
  return createAdminClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function getPermissionSnapshot(params: {
  userId: string;
  organizationId: string | null;
  baseRole?: string | null;
}): Promise<PermissionSnapshot> {
  if (params.baseRole === "owner") return { isSuperUser: true, permissions: {} };
  if (!params.organizationId) return { isSuperUser: false, permissions: {} };

  const admin = adminClient();
  const { data: staff } = await admin
    .from("staff")
    .select("id,is_active,login_enabled,is_super_user")
    .eq("organization_id", params.organizationId)
    .eq("auth_user_id", params.userId)
    .maybeSingle();

  if (!staff?.id || !staff.is_active || !staff.login_enabled) {
    return { isSuperUser: false, permissions: {} };
  }

  if (staff.is_super_user) return { isSuperUser: true, permissions: {} };

  const { data: rows } = await admin
    .from("staff_permissions")
    .select("permission_key,is_allowed")
    .eq("organization_id", params.organizationId)
    .eq("staff_id", staff.id);

  const permissions: Record<string, boolean> = {};
  for (const row of rows || []) permissions[String(row.permission_key)] = Boolean(row.is_allowed);
  return { isSuperUser: false, permissions };
}

export function can(snapshot: PermissionSnapshot, permissionKey: string) {
  return snapshot.isSuperUser || snapshot.permissions[permissionKey] === true;
}
