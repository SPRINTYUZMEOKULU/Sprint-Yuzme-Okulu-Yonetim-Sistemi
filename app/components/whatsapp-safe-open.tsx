"use client";

import { useEffect } from "react";

function sanitizeWhatsAppText(value: string) {
  return String(value || "")
    .normalize("NFC")
    .replace(/\uFFFD/g, "")
    .replace(/[\uD83C-\uDBFF][\uDC00-\uDFFF]/g, "")
    .replace(/[\uFE0E\uFE0F\u200D]/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function sanitizeWhatsAppUrl(input: string | URL) {
  try {
    const url = new URL(String(input), window.location.origin);
    const host = url.hostname.toLowerCase();
    if (host !== "wa.me" && host !== "api.whatsapp.com" && host !== "web.whatsapp.com") {
      return String(input);
    }

    const text = url.searchParams.get("text");
    if (text !== null) {
      url.searchParams.set("text", sanitizeWhatsAppText(text));
    }

    return url.toString();
  } catch {
    return String(input);
  }
}

function isWhatsAppUrl(input?: string | URL | null) {
  if (!input) return false;
  try {
    const url = new URL(String(input), window.location.origin);
    return ["wa.me", "api.whatsapp.com", "web.whatsapp.com"].includes(url.hostname.toLowerCase());
  } catch {
    return false;
  }
}

function extractStudentId() {
  const match = window.location.pathname.match(/\/(?:ogrenciler|kayit-tamamlama)\/([^/?#]+)/i);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

function extractWhatsAppPayload(input: string | URL) {
  try {
    const url = new URL(String(input), window.location.origin);
    const host = url.hostname.toLowerCase();
    let recipient = "";

    if (host === "wa.me") {
      recipient = url.pathname.replace(/^\/+/, "").split("/")[0] || "";
    } else {
      recipient = url.searchParams.get("phone") || "";
    }

    return {
      recipient,
      message: sanitizeWhatsAppText(url.searchParams.get("text") || ""),
    };
  } catch {
    return { recipient: "", message: "" };
  }
}

const recentlyLogged = new Map<string, number>();

function logWhatsAppInteraction(input: string | URL) {
  if (!isWhatsAppUrl(input)) return;

  const payload = extractWhatsAppPayload(input);
  if (!payload.message) return;

  const key = `${payload.recipient}|${payload.message}`;
  const now = Date.now();
  const last = recentlyLogged.get(key) || 0;
  if (now - last < 5000) return;
  recentlyLogged.set(key, now);

  fetch("/api/whatsapp-interactions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      studentId: extractStudentId(),
      recipient: payload.recipient || null,
      message: payload.message,
      sourcePath: `${window.location.pathname}${window.location.search}`,
    }),
    keepalive: true,
  }).catch(() => undefined);
}

export default function WhatsAppSafeOpen() {
  useEffect(() => {
    const originalOpen = window.open;

    window.open = ((
      url?: string | URL,
      target?: string,
      features?: string,
    ) => {
      const safeUrl = url ? sanitizeWhatsAppUrl(url) : url;

      if (safeUrl && isWhatsAppUrl(safeUrl)) {
        logWhatsAppInteraction(safeUrl);
      }

      return originalOpen.call(window, safeUrl as string | URL | undefined, target, features);
    }) as typeof window.open;

    const onClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const anchor = target?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor || !isWhatsAppUrl(anchor.href)) return;

      const safeHref = sanitizeWhatsAppUrl(anchor.href);
      if (safeHref !== anchor.href) anchor.href = safeHref;
      logWhatsAppInteraction(safeHref);
    };

    document.addEventListener("click", onClick, true);

    return () => {
      document.removeEventListener("click", onClick, true);
      window.open = originalOpen;
    };
  }, []);

  return null;
}
