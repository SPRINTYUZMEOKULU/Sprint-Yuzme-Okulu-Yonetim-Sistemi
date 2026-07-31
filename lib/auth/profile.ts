import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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
  organization_id: string | null;
};

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
  if (profile.role === "pending") redirect("/yetkisiz?reason=pending");
  if (allowedRoles && !allowedRoles.includes(profile.role as UserRole)) redirect("/yetkisiz");

  return profile as CurrentProfile;
}

export function isManagement(role: UserRole) {
  return ["owner", "admin", "branch_manager"].includes(role);
}
