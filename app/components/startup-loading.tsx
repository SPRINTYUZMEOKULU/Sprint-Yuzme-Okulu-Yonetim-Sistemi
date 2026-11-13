/** Streams immediately while the route loads; never includes account data. */
export default function StartupLoading() {
  return (
    <main role="status" aria-live="polite" aria-busy="true" style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: 24, background: "#03132f", color: "#fff", textAlign: "center" }}>
      <div>
        <img src="/sprint-logo.png?v=6" alt="" width={144} height={144} style={{ objectFit: "contain", borderRadius: 24, background: "#fff" }} />
        <h1 style={{ fontSize: 20, margin: "20px 0 8px" }}>SPRİNT YÜZME OKULU</h1>
        <p style={{ fontSize: 14, margin: 0, color: "#cbd5e1" }}>Ekranınız hazırlanıyor…</p>
      </div>
    </main>
  );
}
