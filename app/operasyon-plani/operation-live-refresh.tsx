"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function OperationLiveRefresh() {
  const router = useRouter();
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      if (document.querySelector('[aria-busy="true"]')) return;
      if (document.activeElement?.matches("input,select,textarea,button")) return;
      router.refresh();
    }, 30000);
    return () => window.clearInterval(timer);
  }, [router]);
  return null;
}
