import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth/profile";
import ApprovalCenterClient from "./approval-center-client";
import ApprovedArchiveFinalizer from "./approved-archive-finalizer";

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

  return (
    <>
      {["owner", "admin"].includes(profile.role) ? <ApprovedArchiveFinalizer /> : null}
      <ApprovalCenterClient />
    </>
  );
}
