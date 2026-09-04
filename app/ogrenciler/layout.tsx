import type { ReactNode } from "react";
import DefaultStudentSort from "./default-student-sort";
import LessonOperationCommandAction from "./lesson-operation-command-action";

export default function StudentsLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <DefaultStudentSort />
      {children}
      <LessonOperationCommandAction />
    </>
  );
}
