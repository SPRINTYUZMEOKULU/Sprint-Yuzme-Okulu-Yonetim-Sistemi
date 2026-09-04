import type { ReactNode } from "react";
import Link from "next/link";
import DefaultStudentSort from "./default-student-sort";

export default function StudentsLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <DefaultStudentSort />
      <div
        style={{
          width: "100%",
          padding: "10px 18px 0",
          boxSizing: "border-box",
          display: "flex",
          justifyContent: "flex-end",
        }}
      >
        <Link
          href="/ders-operasyonlari"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
            minHeight: 40,
            padding: "0 13px",
            borderRadius: 11,
            background: "#fff7ed",
            border: "1px solid #fed7aa",
            color: "#9a3412",
            textDecoration: "none",
            fontSize: 12,
            fontWeight: 900,
          }}
        >
          🏊 Ders İptali / Telafi Operasyonu
        </Link>
      </div>
      {children}
    </>
  );
}
