"use client";

import { useEffect } from "react";

export default function OperationSelectionCookieGuard({ selectedMode }: { selectedMode: boolean }) {
  useEffect(() => {
    if (selectedMode) return;

    document.cookie =
      "sprintos-lesson-operation-students=; path=/; max-age=0; samesite=lax";
  }, [selectedMode]);

  return null;
}
