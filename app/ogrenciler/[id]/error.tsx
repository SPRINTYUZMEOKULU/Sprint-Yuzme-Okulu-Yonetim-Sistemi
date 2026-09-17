"use client";

import { useEffect, useRef } from "react";

export default function StudentFileError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const recoveryStarted = useRef(false);

  useEffect(() => {
    console.error("SPRINTOS student file client error:", error);

    if (recoveryStarted.current) return;
    recoveryStarted.current = true;

    const timer = window.setTimeout(() => {
      reset();
    }, 150);

    return () => window.clearTimeout(timer);
  }, [error, reset]);

  return (
    <main
      style={{
        minHeight: "55vh",
        display: "grid",
        placeItems: "center",
        padding: 24,
      }}
    >
      <section
        style={{
          width: "min(520px, 100%)",
          border: "1px solid #e5e7eb",
          borderRadius: 18,
          padding: 24,
          background: "#fff",
          boxShadow: "0 14px 36px rgba(15, 23, 42, 0.08)",
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: 32, marginBottom: 10 }}>✓</div>
        <h2 style={{ margin: "0 0 8px", fontSize: 20 }}>İşlem kaydı kontrol ediliyor</h2>
        <p style={{ margin: "0 0 18px", color: "#64748b", lineHeight: 1.55 }}>
          Finans ve kursiyer bilgileri güvenli şekilde yeniden yükleniyor. Ödeme işlemini tekrar göndermeyiniz.
        </p>
        <button
          type="button"
          onClick={() => reset()}
          style={{
            border: 0,
            borderRadius: 12,
            padding: "11px 18px",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Kursiyer dosyasını yenile
        </button>
      </section>
    </main>
  );
}
