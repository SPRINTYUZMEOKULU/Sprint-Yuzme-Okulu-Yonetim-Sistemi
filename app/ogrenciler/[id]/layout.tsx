import type { ReactNode } from "react";
import StudentFileTabs from "./student-file-tabs";
import "./student-file-tabs.css";

export default function StudentFileLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <StudentFileTabs />
    </>
  );
}
