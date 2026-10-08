"use client";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";

export default function AttendanceBackButton({ children }: { children: ReactNode }) {
  const router = useRouter();

  function goBack() {
    if (window.history.length > 1) {
      router.back();
    } else {
      router.replace("/");
    }
  }

  return (
    <button type="button" className="saTopNavItem" onClick={goBack}
      aria-label="Önceki ekrana geri dön" style={{ font: "inherit", cursor: "pointer", textAlign: "left" }}>
      {children}
    </button>
  );
}
