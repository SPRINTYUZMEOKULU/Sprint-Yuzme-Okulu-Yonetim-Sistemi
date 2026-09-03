import type { ReactNode } from "react";
import StudentFileTabs from "./student-file-tabs";
import StudentProfileCenter from "./student-profile-center";
import ProfileCenterClickBridge from "./profile-center-click-bridge";
import GeneralInfoSummary from "./general-info-summary";
import "./student-file-tabs.css";
import "./student-crm-polish.css";

export default function StudentFileLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <StudentFileTabs />
      <StudentProfileCenter />
      <ProfileCenterClickBridge />
      <GeneralInfoSummary />
    </>
  );
}
