"use client";

import { useEffect } from "react";

function sanitizeWhatsAppText(value: string) {
  return String(value || "")
    .normalize("NFC")
    .replace(/\uFFFD/g, "")
    .replace(/\p{Extended_Pictographic}/gu, "")
    .replace(/[\u{1F1E6}-\u{1F1FF}]/gu, "")
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

export default function WhatsAppSafeOpen() {
  useEffect(() => {
    const originalOpen = window.open;

    window.open = ((
      url?: string | URL,
      target?: string,
      features?: string,
    ) => {
      const safeUrl = url ? sanitizeWhatsAppUrl(url) : url;
      return originalOpen.call(window, safeUrl as string | URL | undefined, target, features);
    }) as typeof window.open;

    return () => {
      window.open = originalOpen;
    };
  }, []);

  return null;
}
