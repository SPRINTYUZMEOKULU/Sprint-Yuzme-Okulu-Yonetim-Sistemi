import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth/profile";
import ApprovalCenterClient from "./approval-center-client";

export const dynamic = "force-dynamic";

export default async function ApprovalCenterPage() {
  const profile = await requireProfile();

  if (
    !["owner", "admin", "branch_manager"].includes(
      profile.role
    )
  ) {
    redirect("/yetkisiz");
  }

  return <ApprovalCenterClient />;
}
