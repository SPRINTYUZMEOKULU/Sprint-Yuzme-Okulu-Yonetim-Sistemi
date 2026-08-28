"use client";

import { useState } from "react";

type CopyState = "idle" | "copying" | "copied" | "error";

export default function CopyLinkButton({ url }: { url: string }) {
  const [state, setState] = useState<CopyState>("idle");

  async function copy() {
    if (state === "copying") return;

    setState("copying");

    try {
      await navigator.clipboard.writeText(url);
      setState("copied");
      window.setTimeout(() => setState("idle"), 1800);
    } catch {
      setState("error");
      window.setTimeout(() => setState("idle"), 2400);
    }
  }

  const label =
    state === "copying"
      ? "Kopyalanıyor…"
      : state === "copied"
      ? "Link Kopyalandı ✓"
      : state === "error"
      ? "Kopyalanamadı"
      : "Ön Kayıt Linkini Kopyala";

  return (
    <button
      type="button"
      onClick={copy}
      disabled={state === "copying"}
      className={`primaryOperation preCopyButton ${state}`}
      aria-live="polite"
    >
      {label}
    </button>
  );
}
