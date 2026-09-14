"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function GuardianAutoRefresh() {
  const router = useRouter();

  useEffect(() => {
    // Mobil/PWA'da focus, pageshow ve visibilitychange olayları sayfa geçişleri
    // sırasında art arda tetiklenebiliyor. Bu olaylarda router.refresh() çağırmak
    // portal navigasyonu ile yarışıp oturum kontrolünün yeniden çalışmasına neden
    // olabiliyordu. Portal verisini yalnızca sakin bir periyodik yenilemeyle tazeliyoruz.
    const interval = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      router.refresh();
    }, 60000);

    return () => window.clearInterval(interval);
  }, [router]);

  return null;
}
