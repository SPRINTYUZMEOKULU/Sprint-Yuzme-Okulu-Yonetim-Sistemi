"use client";

import { useEffect } from "react";

export default function RenewalApprovalOpenBridge() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("renewalApproval") !== "approved") return;

    let tries = 0;
    const open = () => {
      const button = document.querySelector<HTMLButtonElement>("[data-renewal-button='1']");
      if (button) {
        button.click();
        params.delete("renewalApproval");
        const query = params.toString();
        const cleanUrl = `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`;
        window.history.replaceState(null, "", cleanUrl);
        return;
      }
      tries += 1;
      if (tries < 20) window.setTimeout(open, 150);
    };

    open();
  }, []);

  return null;
}
