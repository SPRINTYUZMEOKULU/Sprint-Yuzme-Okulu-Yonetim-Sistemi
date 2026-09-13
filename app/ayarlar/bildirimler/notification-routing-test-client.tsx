"use client";

import { useMemo, useState } from "react";

type Profile = {
  id: string;
  full_name: string | null;
  role: string;
  title?: string | null;
};

type Props = {
  profiles: Profile[];
};

const categories = [
  ["preregistration", "Ön Kayıt"],
  ["students", "Kursiyer İşlemleri"],
  ["attendance", "Yoklama"],
  ["finance", "Finans"],
  ["payment", "Ödemeler"],
  ["cash", "Kasa"],
  ["approvals", "Onay Merkezi"],
  ["staff", "Personel"],
  ["accounts", "Hesaplar"],
  ["permissions", "Yetkiler"],
  ["schedule", "Program & Seans"],
  ["operations", "Operasyon"],
  ["reports", "Raporlar"],
  ["system", "Sistem & Kritik"],
] as const;

function roleLabel(role: string) {
  if (role === "owner") return "Kurucu Yönetici";
  if (role === "admin") return "Yönetici";
  if (role === "coach") return "Eğitmen";
  if (role === "accounting") return "Muhasebe";
  if (role === "registration_staff") return "Kayıt Personeli";
  if (role === "branch_manager") return "Şube Sorumlusu";
  return role;
}

export default function NotificationRoutingTestClient({ profiles }: Props) {
  const [profileId, setProfileId] = useState(profiles[0]?.id || "");
  const [category, setCategory] = useState("attendance");
  const [push, setPush] = useState(false);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<null | {
    ok: boolean;
    blocked?: boolean;
    recipientCount?: number;
    message?: string;
    error?: string;
    push?: { requested: boolean; sent: number; failed: number };
  }>(null);

  const selected = useMemo(() => profiles.find((profile) => profile.id === profileId), [profiles, profileId]);

  async function runTest() {
    if (!profileId || !category) return;
    setRunning(true);
    setResult(null);
    try {
      const response = await fetch("/api/notification-preferences/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileId, category, push }),
      });
      const data = await response.json().catch(() => null);
      if (!data) throw new Error("Test sonucu okunamadı.");
      setResult(data);
    } catch (error) {
      setResult({ ok: false, error: error instanceof Error ? error.message : "Test çalıştırılamadı." });
    } finally {
      setRunning(false);
    }
  }

  const status = result
    ? result.blocked || result.recipientCount === 0
      ? "blocked"
      : result.ok
        ? "success"
        : "error"
    : "idle";

  return (
    <section className="rtPanel">
      <div className="rtHead">
        <div className="rtIcon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 12h11"/><path d="m11 6 6 6-6 6"/><rect x="3" y="4" width="18" height="16" rx="3"/>
          </svg>
        </div>
        <div>
          <span>GERÇEK DAĞITIM TESTİ</span>
          <h2>Bildirim Yetkisini Canlı Kontrol Et</h2>
          <p>Seçilen kullanıcıya gerçek bir SprintOS test bildirimi oluşturur. Kural kapalıysa bildirim oluşturulmaz; push açıksa kayıtlı cihaza da gönderim denenir.</p>
        </div>
      </div>

      <div className="rtGrid">
        <label>
          <span>Kullanıcı</span>
          <select value={profileId} onChange={(event) => setProfileId(event.target.value)}>
            {profiles.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.full_name || "İsimsiz kullanıcı"} · {profile.title || roleLabel(profile.role)}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Bildirim kategorisi</span>
          <select value={category} onChange={(event) => setCategory(event.target.value)}>
            {categories.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
        </label>

        <label className="rtPush">
          <span>Telefon push</span>
          <button type="button" className={push ? "on" : ""} onClick={() => setPush((value) => !value)} aria-pressed={push}>
            <i />
          </button>
          <small>{push ? "Push gönderimi de test edilir" : "Yalnız uygulama içi test"}</small>
        </label>

        <button className="rtRun" type="button" onClick={runTest} disabled={running || !profileId}>
          {running ? "Test çalışıyor..." : "Test Bildirimi Gönder"}
        </button>
      </div>

      <div className={`rtResult ${status}`}>
        {status === "idle" && <><strong>Hazır</strong><span>Bir kullanıcı ve kategori seçip testi başlatın.</span></>}
        {status === "success" && <><strong>Dağıtım başarılı</strong><span>{result?.message || "Bildirim doğru kullanıcı için oluşturuldu."}{result?.push?.requested ? ` Push: ${result.push.sent} gönderildi, ${result.push.failed} başarısız.` : ""}</span></>}
        {status === "blocked" && <><strong>Kural doğru şekilde engelledi</strong><span>Seçilen kullanıcı için bu kategori uygulama içi bildirimlere kapalı olduğu için kayıt oluşturulmadı.</span></>}
        {status === "error" && <><strong>Test tamamlanamadı</strong><span>{result?.error || result?.message || "Bilinmeyen hata oluştu."}</span></>}
      </div>

      {selected ? <div className="rtWho">Test kullanıcısı: <b>{selected.full_name || "Kullanıcı"}</b> · {selected.title || roleLabel(selected.role)}</div> : null}

      <style jsx>{`
        .rtPanel{margin-top:18px;padding:17px;border:1px solid #dce5f0;border-radius:21px;background:#fff;box-shadow:0 10px 28px rgba(15,23,42,.04)}
        .rtHead{display:flex;align-items:flex-start;gap:12px}.rtIcon{width:45px;height:45px;display:grid;place-items:center;flex:0 0 auto;border-radius:13px;background:#eef7ff;color:#176de9}.rtIcon svg{width:22px;height:22px}.rtHead span{display:block;color:#176de9;font-size:9px;font-weight:950;letter-spacing:1.2px}.rtHead h2{margin:3px 0 0;color:#162b49;font-size:18px}.rtHead p{max-width:850px;margin:4px 0 0;color:#7d8ca1;font-size:10px;line-height:1.5}
        .rtGrid{display:grid;grid-template-columns:1.2fr 1fr auto auto;gap:10px;align-items:end;margin-top:15px}.rtGrid label{display:grid;gap:6px}.rtGrid label>span{color:#64748b;font-size:9px;font-weight:900;text-transform:uppercase;letter-spacing:.45px}.rtGrid select{height:42px;min-width:0;padding:0 12px;border:1px solid #d9e2ee;border-radius:11px;background:#fff;color:#243955;font-size:11px;font-weight:800;outline:0}.rtGrid select:focus{border-color:#8ab7f8;box-shadow:0 0 0 3px #edf5ff}.rtPush{min-width:150px}.rtPush button{position:relative;width:42px;height:24px;padding:0;border:0;border-radius:999px;background:#dce3ec;cursor:pointer}.rtPush button i{position:absolute;top:3px;left:3px;width:18px;height:18px;border-radius:50%;background:#fff;box-shadow:0 1px 4px rgba(15,23,42,.18);transition:.2s}.rtPush button.on{background:#7658df}.rtPush button.on i{left:21px}.rtPush small{color:#8794a7;font-size:8px}.rtRun{height:42px;padding:0 15px;border:0;border-radius:11px;background:#176de9;color:#fff;font-size:10px;font-weight:950;cursor:pointer;white-space:nowrap}.rtRun:disabled{background:#aebccc;cursor:default}.rtResult{display:flex;align-items:center;gap:10px;margin-top:12px;padding:11px 13px;border:1px solid #e2e8f0;border-radius:12px;background:#f8fafc}.rtResult strong{color:#34445d;font-size:10px;white-space:nowrap}.rtResult span{color:#718096;font-size:9px;line-height:1.4}.rtResult.success{border-color:#bfe8d3;background:#effbf5}.rtResult.success strong{color:#11734c}.rtResult.blocked{border-color:#f3d49a;background:#fff9eb}.rtResult.blocked strong{color:#9b6500}.rtResult.error{border-color:#f0c3c3;background:#fff5f5}.rtResult.error strong{color:#b42318}.rtWho{margin-top:8px;color:#8693a6;font-size:9px}
        @media(max-width:900px){.rtGrid{grid-template-columns:1fr 1fr}.rtRun{width:100%}}
        @media(max-width:640px){.rtPanel{padding:12px;border-radius:17px}.rtGrid{grid-template-columns:1fr}.rtPush{grid-template-columns:1fr auto;align-items:center}.rtPush small{grid-column:1/-1}.rtRun{width:100%}.rtResult{display:grid;gap:4px}.rtResult strong{white-space:normal}}
      `}</style>
    </section>
  );
}
