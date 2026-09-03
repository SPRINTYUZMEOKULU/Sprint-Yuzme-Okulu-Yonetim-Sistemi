"use client";

import { useEffect } from "react";

export default function RenewalApprovalOpenBridge() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("renewalApproval") !== "approved") return;

    const requestId = params.get("renewalRequestId") || undefined;
    const timer = window.setTimeout(() => {
      window.dispatchEvent(
        new CustomEvent("sprint:open-renewal", {
          detail: { requestId },
        }),
      );

      params.delete("renewalApproval");
      params.delete("renewalRequestId");
      const query = params.toString();
      const cleanUrl = `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`;
      window.history.replaceState(null, "", cleanUrl);
    }, 180);

    return () => window.clearTimeout(timer);
  }, []);

  return null;
}
