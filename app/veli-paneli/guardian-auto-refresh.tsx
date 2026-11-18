"use client";

import { useEffect, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import UiIcon from "@/app/components/ui-icon";

const refreshInterval = 30_000;
const retryGuard = 10_000;

export default function GuardianAutoRefresh() {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let lastRefresh = Date.now();
    const refresh = () => {
      if (document.visibilityState !== "visible") return;
      if (document.activeElement?.closest("input, textarea, select, [contenteditable='true']")) return;
      if (Date.now() - lastRefresh < retryGuard) return;
      lastRefresh = Date.now();
      router.refresh();
    };

    const timer = window.setInterval(refresh, refreshInterval);
    const pageShow = (event: PageTransitionEvent) => {
      if (event.persisted) refresh();
    };

    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    window.addEventListener("pageshow", pageShow);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("pageshow", pageShow);
    };
  }, [router, pathname]);

  if (pathname !== "/veli-devam") return null;

  return <button type="button" className="guardianRefreshButton" disabled={pending}
    onClick={() => startTransition(() => router.refresh())}>
    <UiIcon name="refresh" size={16}/> {pending ? "Güncelleniyor…" : "Yenile"}
  </button>;
}
