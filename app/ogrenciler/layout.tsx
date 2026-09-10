import type { ReactNode } from "react";
import DefaultStudentSort from "./default-student-sort";
import LessonOperationCommandAction from "./lesson-operation-command-action";
import StudentCardInsightsEnhancer from "./student-card-insights-enhancer";
import StartingStudentsPanel from "./starting-students-panel";
import ImportedStudentBadgeEnhancer from "./imported-student-badge-enhancer";
import "./students-professional.css";

export default function StudentsLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <DefaultStudentSort />
      <StartingStudentsPanel />
      {children}
      <LessonOperationCommandAction />
      <StudentCardInsightsEnhancer />
      <ImportedStudentBadgeEnhancer />
    </>
  );
}
