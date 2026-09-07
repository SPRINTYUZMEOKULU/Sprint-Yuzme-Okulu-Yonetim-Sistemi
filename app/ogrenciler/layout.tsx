import type { ReactNode } from "react";
import DefaultStudentSort from "./default-student-sort";
import LessonOperationCommandAction from "./lesson-operation-command-action";
import StudentCardInsightsEnhancer from "./student-card-insights-enhancer";
import StudentPaymentStatusEnhancer from "./student-payment-status-enhancer";

export default function StudentsLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <DefaultStudentSort />
      {children}
      <LessonOperationCommandAction />
      <StudentCardInsightsEnhancer />
      <StudentPaymentStatusEnhancer />
    </>
  );
}
