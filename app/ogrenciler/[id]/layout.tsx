import type { ReactNode } from "react";
import { requireProfile } from "@/lib/auth/profile";
import StudentFileTabs from "./student-file-tabs";
import StudentProfileCenter from "./student-profile-center";
import GeneralInfoSummary from "./general-info-summary";
import StudentRenewalCenter from "./student-renewal-center";
import StudentActionRouter from "./student-action-router";
import StudentActionFeedback from "./student-action-feedback";
import StudentHeroEnhancer from "./student-hero-enhancer";
import RenewalApprovalOpenBridge from "./renewal-approval-open-bridge";
import RenewalMobilePolish from "./renewal-mobile-polish";
import AdminCorrectionLauncher from "./admin-correction-launcher";
import "./student-file-tabs.css";
import "./student-crm-polish.css";

export default async function StudentFileLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ id: string }>;
}) {
  const profile = await requireProfile([
    "owner",
    "admin",
    "branch_manager",
    "registration_staff",
    "accounting",
    "coach",
  ]);
  const { id } = await params;
  const canCorrect = ["owner", "admin"].includes(String(profile.role || ""));

  return (
    <>
      {children}
      <StudentFileTabs />
      <StudentProfileCenter />
      <GeneralInfoSummary />
      <StudentRenewalCenter />
      <StudentActionRouter />
      <StudentActionFeedback />
      <StudentHeroEnhancer />
      <RenewalApprovalOpenBridge />
      <RenewalMobilePolish />
      {canCorrect ? <AdminCorrectionLauncher studentId={id} /> : null}
    </>
  );
}
