import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

export type UserRole =
  | "pending"
  | "owner"
  | "admin"
  | "branch_manager"
  | "registration_staff"
  | "accounting"
  | "coach"
  | "guardian";

export type CurrentProfile = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: UserRole;
  base_role: UserRole;
  organization_id: string | null;
  is_super_user: boolean;
};

async function getSuperUserState(userId: string, role: UserRole) {
  if (role === "owner") return true;
  if (role === "guardian" || role === "pending") return false;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    console.error("SprintOS süper kullanıcı kontrolü için ortam değişkenleri eksik.");
    return false;
  }

  const admin = createAdminClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { data: staff, error } = await admin
    .from("staff")
    .select("is_active, login_enabled, is_super_user")
    .eq("auth_user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("SprintOS süper kullanıcı kontrolü başarısız:", error);
    return false;
  }

  return Boolean(
    staff?.is_active &&
      staff?.login_enabled &&
      staff?.is_super_user
  );
}

function resolveEffectiveRole(
  baseRole: UserRole,
  isSuperUser: boolean,
  allowedRoles?: UserRole[]
): UserRole {
  if (!isSuperUser || baseRole === "owner") return baseRole;

  // Eğitmen kendi rolünün izinli olduğu bir ekrandaysa eğitmen davranışını koru.
  if (allowedRoles?.includes(baseRole)) return baseRole;

  // Süper kullanıcı yönetim ekranlarında yönetici gibi davranır.
  return "admin";
}

export async function requireProfile(allowedRoles?: UserRole[]): Promise<CurrentProfile> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, organization_id")
    .eq("id", user.id)
    .single();

  if (error || !profile) redirect("/yetkisiz");

  const baseRole = profile.role as UserRole;

  if (baseRole === "pending") redirect("/yetkisiz?reason=pending");

  const isSuperUser = await getSuperUserState(user.id, baseRole);
  const effectiveRole = resolveEffectiveRole(
    baseRole,
    isSuperUser,
    allowedRoles
  );

  if (
    allowedRoles &&
    !allowedRoles.includes(baseRole) &&
    !isSuperUser
  ) {
    redirect("/yetkisiz");
  }

  return {
    id: String(profile.id),
    full_name: profile.full_name,
    email: profile.email,
    role: effectiveRole,
    base_role: baseRole,
    organization_id: profile.organization_id,
    is_super_user: isSuperUser,
  };
}

export function isManagement(role: UserRole) {
  return ["owner", "admin", "branch_manager"].includes(role);
}
