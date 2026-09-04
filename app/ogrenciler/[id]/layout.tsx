import type { ReactNode } from "react";
import StudentFileTabs from "./student-file-tabs";
import StudentProfileCenter from "./student-profile-center";
import GeneralInfoSummary from "./general-info-summary";
import StudentRenewalCenter from "./student-renewal-center";
import StudentActionRouter from "./student-action-router";
import StudentActionFeedback from "./student-action-feedback";
import StudentHeroEnhancer from "./student-hero-enhancer";
import RenewalApprovalOpenBridge from "./renewal-approval-open-bridge";
import RenewalMobilePolish from "./renewal-mobile-polish";
import "./student-file-tabs.css";
import "./student-crm-polish.css";

export default function StudentFileLayout({ children }: { children: ReactNode }) {
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
    </>
  );
}
