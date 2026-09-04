import type { ReactNode } from "react";
import DefaultStudentSort from "./default-student-sort";

export default function StudentsLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <DefaultStudentSort />
      {children}
    </>
  );
}
