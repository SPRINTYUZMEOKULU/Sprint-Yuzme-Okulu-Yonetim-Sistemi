"use client";

import { useEffect } from "react";

export default function PortalAutoOpen() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("portal") !== "1") return;

    const timer = window.setTimeout(() => {
      const trigger = document.createElement("button");
      trigger.type = "button";
      trigger.dataset.openProfileCenter = "1";
      trigger.style.display = "none";
      document.body.appendChild(trigger);
      trigger.click();
      trigger.remove();
    }, 180);

    return () => window.clearTimeout(timer);
  }, []);

  return null;
}
