"use client";

import { useMemo, useState } from "react";

type Profile = { id: string; full_name: string | null; email: string | null; phone: string | null; role: string; title?: string | null; staff_type?: string | null; all_branches?: boolean | null };
type Preference = { profile_id: string; category: string; in_app_enabled: boolean; push_enabled: boolean; can_approve: boolean; scope: "all" | "branches" | "assigned" };
type Props = { profiles: Profile[]; preferences: Preference[]; activePushProfileIds: string[] };

type Rule = { inAppEnabled: boolean; pushEnabled: boolean; canApprove: boolean; scope: "all" | "branches" | "assigned" };

const categories = [
  { key: "preregistration", label: "Ön Kayıt", desc: "Yeni ön kayıt, kayıt tamamlanması ve başlangıç uyarıları", icon: "user-plus" },
  { key: "students", label: "Kursiyer İşlemleri", desc: "Aktif/pasif, kayıt yenileme, grup ve şube işlemleri", icon: "users" },
  { key: "attendance", label: "Yoklama", desc: "Ders başlangıcı, gelmedi, geç kaldı ve yoklama uyarıları", icon: "clipboard" },
  { key: "finance", label: "Finans", desc: "Borç, vade, ödeme planı ve finansal takip bildirimleri", icon: "wallet" },
  { key: "payment", label: "Ödemeler", desc: "Ödeme alındı, tahsilat ve ödeme güncelleme bildirimleri", icon: "card" },
  { key: "cash", label: "Kasa", desc: "Kasaya teslim, gün sonu ve kasa onay bildirimleri", icon: "bank" },
  { key: "approvals", label: "Onay Merkezi", desc: "Pasife alma, arşivleme ve yönetici onay talepleri", icon: "check" },
  { key: "staff", label: "Personel", desc: "Derse geldim, geç kalma, puantaj ve personel uyarıları", icon: "badge" },
  { key: "accounts", label: "Hesaplar", desc: "Portal hesabı, şifre ve kullanıcı erişim işlemleri", icon: "key" },
  { key: "permissions", label: "Yetkiler", desc: "Rol ve kullanıcı yetkilerindeki kritik değişiklikler", icon: "shield" },
  { key: "schedule", label: "Program & Seans", desc: "Seans, saat, grup ve program değişiklikleri", icon: "calendar" },
  { key: "operations", label: "Operasyon", desc: "Havuz kapanışı, telafi, şube ve operasyon uyarıları", icon: "activity" },
  { key: "reports", label: "Raporlar", desc: "Rapor hazır, dışa aktarım ve yönetim raporları", icon: "chart" },
  { key: "system", label: "Sistem & Kritik", desc: "Bağlantı, servis ve kritik sistem bildirimleri", icon: "alert" },
] as const;

function Icon({ name, size = 20 }: { name: string; size?: number }) {
  const common = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.9, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  const paths: Record<string, React.ReactNode> = {
    "user-plus": <><path d="M15 19a6 6 0 0 0-12 0"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6M16 11h6"/></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></>,
    clipboard: <><rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V2h6v2M9 12l2 2 4-4"/></>,
    wallet: <><path d="M20 7V5a2 2 0 0 0-2-2H5a3 3 0 0 0 0 6h15v10a2 2 0 0 1-2 2H5a3 3 0 0 1-3-3V6"/><path d="M16 13h4"/></>,
    card: <><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20M6 15h4"/></>,
    bank: <><path d="M3 10h18M5 10v8M9 10v8M15 10v8M19 10v8M2 21h20M12 3 2 8h20L12 3z"/></>,
    check: <><circle cx="12" cy="12" r="9"/><path d="m8 12 2.5 2.5L16 9"/></>,
    badge: <><circle cx="12" cy="8" r="4"/><path d="M6 21v-2a6 6 0 0 1 12 0v2"/></>,
    key: <><circle cx="7.5" cy="15.5" r="4.5"/><path d="m11 12 8-8M15 8l3 3M17 6l2 2"/></>,
    shield: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/><path d="m9 12 2 2 4-4"/></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></>,
    activity: <path d="M3 12h4l2-7 4 14 2-7h6"/>,
    chart: <><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></>,
    alert: <><path d="M12 3 2.5 20h19L12 3z"/><path d="M12 9v5M12 17h.01"/></>,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></>,
    search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
    save: <><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2"/><path d="M17 21v-8H7v8M7 3v5h8"/></>,
    phone: <><rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/></>,
    grid: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
  };
  return <svg {...common}>{paths[name] ?? paths.bell}</svg>;
}

function defaultRule(role: string, category: string): Rule {
  if (role === "owner" || role === "admin") return { inAppEnabled: true, pushEnabled: true, canApprove: category === "approvals" || category === "cash" || category === "permissions", scope: "all" };
  const coachEnabled = ["students", "attendance", "staff", "schedule", "operations"].includes(category);
  return { inAppEnabled: coachEnabled, pushEnabled: category === "attendance" || category === "schedule", canApprove: false, scope: "assigned" };
}

function roleLabel(role: string) {
  return role === "owner" ? "Kurucu Yönetici" : role === "admin" ? "Yönetici" : role === "coach" ? "Eğitmen" : role;
}

export default function NotificationRoutingClient({ profiles, preferences, activePushProfileIds }: Props) {
  const initial = useMemo(() => {
    const map: Record<string, Rule> = {};
    for (const profile of profiles) for (const category of categories) {
      const stored = preferences.find((p) => p.profile_id === profile.id && p.category === category.key);
      map[`${profile.id}:${category.key}`] = stored ? {
        inAppEnabled: stored.in_app_enabled,
        pushEnabled: stored.push_enabled,
        canApprove: stored.can_approve,
        scope: stored.scope,
      } : defaultRule(profile.role, category.key);
    }
    return map;
  }, [profiles, preferences]);

  const [rules, setRules] = useState<Record<string, Rule>>(initial);
  const [selectedUser, setSelectedUser] = useState(profiles[0]?.id || "");
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [dirty, setDirty] = useState(false);

  const selected = profiles.find((p) => p.id === selectedUser) ?? profiles[0];
  const visibleProfiles = profiles.filter((p) => `${p.full_name || ""} ${p.email || ""} ${p.phone || ""}`.toLocaleLowerCase("tr").includes(query.toLocaleLowerCase("tr")));
  const pushSet = new Set(activePushProfileIds);

  function update(category: string, patch: Partial<Rule>) {
    if (!selected) return;
    const key = `${selected.id}:${category}`;
    setRules((old) => ({ ...old, [key]: { ...old[key], ...patch } }));
    setDirty(true);
    setMessage("");
  }

  function applyPreset(type: "management" | "coach" | "silent") {
    if (!selected) return;
    const next = { ...rules };
    for (const category of categories) {
      if (type === "management") next[`${selected.id}:${category.key}`] = { inAppEnabled: true, pushEnabled: true, canApprove: ["approvals", "cash", "permissions"].includes(category.key), scope: "all" };
      if (type === "coach") next[`${selected.id}:${category.key}`] = defaultRule("coach", category.key);
      if (type === "silent") next[`${selected.id}:${category.key}`] = { inAppEnabled: false, pushEnabled: false, canApprove: false, scope: "assigned" };
    }
    setRules(next); setDirty(true); setMessage("");
  }

  async function save() {
    setSaving(true); setMessage("");
    try {
      const payload = profiles.flatMap((profile) => categories.map((category) => {
        const rule = rules[`${profile.id}:${category.key}`];
        return { profileId: profile.id, category: category.key, ...rule };
      }));
      const response = await fetch("/api/notification-preferences", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rules: payload }) });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok) throw new Error(data?.error || "Bildirim kuralları kaydedilemedi.");
      setDirty(false); setMessage(`${data.saved} bildirim kuralı başarıyla kaydedildi.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Bildirim kuralları kaydedilemedi."); }
    finally { setSaving(false); }
  }

  const recipientCount = profiles.filter((profile) => categories.some((c) => rules[`${profile.id}:${c.key}`]?.inAppEnabled)).length;
  const approvalCount = profiles.filter((profile) => categories.some((c) => rules[`${profile.id}:${c.key}`]?.canApprove)).length;
  const pushCount = profiles.filter((profile) => pushSet.has(profile.id)).length;

  return <div className="nrRoot">
    <section className="nrStats">
      <article><div className="nrStatIcon blue"><Icon name="users" /></div><div><span>Bildirim Alıcısı</span><strong>{recipientCount}</strong><small>Aktif kullanıcı</small></div></article>
      <article><div className="nrStatIcon green"><Icon name="phone" /></div><div><span>Push Hazır</span><strong>{pushCount}</strong><small>Kayıtlı cihaz sahibi</small></div></article>
      <article><div className="nrStatIcon amber"><Icon name="check" /></div><div><span>Onay Yetkilisi</span><strong>{approvalCount}</strong><small>İşlem onayı verebilir</small></div></article>
      <article><div className="nrStatIcon violet"><Icon name="grid" /></div><div><span>Kural Seti</span><strong>{categories.length}</strong><small>Bildirim kategorisi</small></div></article>
    </section>

    <section className="nrWorkspace">
      <aside className="nrUsers">
        <div className="nrAsideHead"><div><span>KULLANICILAR</span><h2>Kime bildirim düşecek?</h2></div><b>{profiles.length}</b></div>
        <label className="nrSearch"><Icon name="search" size={18}/><input value={query} onChange={(e)=>setQuery(e.target.value)} placeholder="Kullanıcı ara..." /></label>
        <div className="nrUserList">
          {visibleProfiles.map((profile) => {
            const active = selected?.id === profile.id;
            const initials = (profile.full_name || "?").split(" ").filter(Boolean).slice(0,2).map((v)=>v[0]).join("").toUpperCase();
            return <button key={profile.id} className={`nrUser ${active ? "active" : ""}`} onClick={()=>setSelectedUser(profile.id)}>
              <span className="nrAvatar">{initials}</span>
              <span className="nrUserCopy"><strong>{profile.full_name || "İsimsiz kullanıcı"}</strong><small>{profile.title || roleLabel(profile.role)}</small></span>
              <span className={`nrDot ${pushSet.has(profile.id) ? "online" : ""}`} title={pushSet.has(profile.id) ? "Push cihazı kayıtlı" : "Push cihazı yok"}/>
            </button>;
          })}
        </div>
      </aside>

      <div className="nrRules">
        {selected ? <>
          <header className="nrRulesHead">
            <div><span>BİLDİRİM YETKİLERİ</span><h2>{selected.full_name || "Kullanıcı"}</h2><p>{roleLabel(selected.role)} · Hangi bildirimi göreceğini, push alacağını ve onay yetkisini belirleyin.</p></div>
            <div className="nrPresets"><button onClick={()=>applyPreset("management")}>Yönetim</button><button onClick={()=>applyPreset("coach")}>Eğitmen</button><button onClick={()=>applyPreset("silent")}>Tümünü Kapat</button></div>
          </header>

          <div className="nrLegend"><span><i className="dot app"/> Uygulama içi</span><span><i className="dot push"/> Push</span><span><i className="dot approve"/> Onay yetkisi</span></div>

          <div className="nrCategoryList">
            {categories.map((category) => {
              const rule = rules[`${selected.id}:${category.key}`] ?? defaultRule(selected.role, category.key);
              return <article className="nrCategory" key={category.key}>
                <div className="nrCategoryMain"><div className="nrCatIcon"><Icon name={category.icon}/></div><div><strong>{category.label}</strong><p>{category.desc}</p></div></div>
                <div className="nrControls">
                  <label className="nrToggleLabel"><span>Uygulama</span><button type="button" className={`switch ${rule.inAppEnabled ? "on" : ""}`} onClick={()=>update(category.key,{inAppEnabled:!rule.inAppEnabled})}><i/></button></label>
                  <label className="nrToggleLabel"><span>Push</span><button type="button" disabled={!rule.inAppEnabled} className={`switch pushSw ${rule.pushEnabled && rule.inAppEnabled ? "on" : ""}`} onClick={()=>update(category.key,{pushEnabled:!rule.pushEnabled})}><i/></button></label>
                  <label className="nrToggleLabel"><span>Onay</span><button type="button" disabled={!rule.inAppEnabled} className={`switch approveSw ${rule.canApprove && rule.inAppEnabled ? "on" : ""}`} onClick={()=>update(category.key,{canApprove:!rule.canApprove})}><i/></button></label>
                  <select value={rule.scope} onChange={(e)=>update(category.key,{scope:e.target.value as Rule["scope"]})} disabled={!rule.inAppEnabled}>
                    <option value="all">Tüm şubeler</option><option value="branches">Yetkili şubeler</option><option value="assigned">Kendi grup/seansları</option>
                  </select>
                </div>
              </article>;
            })}
          </div>
        </> : <div className="nrEmpty">Bildirim yetkilerini düzenlemek için bir kullanıcı seçin.</div>}
      </div>
    </section>

    <div className="nrSaveBar">
      <div><strong>{dirty ? "Kaydedilmemiş değişiklikler var" : "Bildirim dağıtım kuralları güncel"}</strong><span>{message || "Değişiklikler kaydedildiğinde SprintOS bildirim dağıtımında kullanılacaktır."}</span></div>
      <button onClick={save} disabled={saving || !dirty}><Icon name="save" size={18}/>{saving ? "Kaydediliyor..." : "Kuralları Kaydet"}</button>
    </div>

    <style jsx>{`
      .nrRoot{display:grid;gap:16px}.nrStats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.nrStats article{display:flex;align-items:center;gap:13px;padding:16px;border:1px solid #dfe7f1;border-radius:18px;background:#fff;box-shadow:0 8px 24px rgba(15,23,42,.04)}.nrStatIcon{width:46px;height:46px;display:grid;place-items:center;border-radius:14px}.nrStatIcon.blue{color:#176de9;background:#edf5ff}.nrStatIcon.green{color:#16875b;background:#ecfdf5}.nrStatIcon.amber{color:#b76b00;background:#fff7e8}.nrStatIcon.violet{color:#6d4fd7;background:#f3f0ff}.nrStats span,.nrStats small{display:block;color:#8290a6;font-size:10px;font-weight:800}.nrStats strong{display:block;margin:1px 0;color:#10213f;font-size:25px;line-height:1}.nrWorkspace{display:grid;grid-template-columns:290px minmax(0,1fr);gap:14px;align-items:start}.nrUsers,.nrRules{border:1px solid #dfe7f1;border-radius:21px;background:#fff;box-shadow:0 10px 30px rgba(15,23,42,.045)}.nrUsers{padding:15px;position:sticky;top:18px}.nrAsideHead{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;padding:3px 3px 12px}.nrAsideHead span,.nrRulesHead span{color:#176de9;font-size:9px;font-weight:950;letter-spacing:1.2px}.nrAsideHead h2,.nrRulesHead h2{margin:4px 0 0;color:#122340;font-size:17px}.nrAsideHead b{display:grid;place-items:center;min-width:28px;height:28px;border-radius:10px;background:#edf5ff;color:#176de9;font-size:11px}.nrSearch{display:flex;align-items:center;gap:8px;padding:0 11px;height:42px;border:1px solid #dbe4ef;border-radius:12px;background:#f8fafc;color:#8da0b8}.nrSearch input{width:100%;border:0;outline:0;background:transparent;color:#21324d;font:inherit;font-size:12px}.nrUserList{display:grid;gap:6px;margin-top:10px;max-height:600px;overflow:auto}.nrUser{display:flex;align-items:center;gap:10px;width:100%;padding:10px;border:1px solid transparent;border-radius:13px;background:transparent;text-align:left;cursor:pointer}.nrUser:hover{background:#f7faff}.nrUser.active{border-color:#bdd7ff;background:#eef6ff}.nrAvatar{width:38px;height:38px;display:grid;place-items:center;flex:0 0 auto;border-radius:12px;background:#102d5c;color:#fff;font-size:11px;font-weight:950}.nrUserCopy{min-width:0;flex:1}.nrUserCopy strong,.nrUserCopy small{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.nrUserCopy strong{color:#19304f;font-size:12px}.nrUserCopy small{margin-top:2px;color:#8391a6;font-size:10px}.nrDot{width:8px;height:8px;border-radius:50%;background:#d7dee8}.nrDot.online{background:#23a46f;box-shadow:0 0 0 3px #e6f8f0}.nrRules{padding:18px}.nrRulesHead{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;padding:2px 2px 14px;border-bottom:1px solid #edf1f6}.nrRulesHead h2{font-size:23px}.nrRulesHead p{max-width:650px;margin:6px 0 0;color:#748399;font-size:11px;line-height:1.5}.nrPresets{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end}.nrPresets button{min-height:34px;padding:0 10px;border:1px solid #dbe4ee;border-radius:10px;background:#fff;color:#41536d;font-size:10px;font-weight:900;cursor:pointer}.nrPresets button:hover{border-color:#9fc5ff;background:#f5f9ff}.nrLegend{display:flex;gap:15px;flex-wrap:wrap;padding:12px 2px;color:#6f7f95;font-size:10px;font-weight:800}.nrLegend span{display:flex;align-items:center;gap:6px}.dot{width:8px;height:8px;border-radius:50%}.dot.app{background:#176de9}.dot.push{background:#7b61e8}.dot.approve{background:#e2961a}.nrCategoryList{display:grid;gap:8px}.nrCategory{display:grid;grid-template-columns:minmax(240px,1fr) auto;gap:14px;align-items:center;padding:13px 14px;border:1px solid #e6ebf2;border-radius:15px;background:#fff}.nrCategory:hover{border-color:#cddbf0;background:#fbfdff}.nrCategoryMain{display:flex;align-items:center;gap:11px;min-width:0}.nrCatIcon{width:40px;height:40px;display:grid;place-items:center;flex:0 0 auto;border-radius:12px;background:#f0f6ff;color:#176de9}.nrCategoryMain strong{display:block;color:#18304f;font-size:12px}.nrCategoryMain p{margin:3px 0 0;color:#8492a6;font-size:10px;line-height:1.45}.nrControls{display:flex;align-items:center;gap:10px}.nrToggleLabel{display:grid;justify-items:center;gap:4px;color:#7c8ba1;font-size:8px;font-weight:900;text-transform:uppercase;letter-spacing:.4px}.switch{position:relative;width:38px;height:22px;padding:0;border:0;border-radius:999px;background:#dce3ec;cursor:pointer;transition:.2s}.switch i{position:absolute;top:3px;left:3px;width:16px;height:16px;border-radius:50%;background:#fff;box-shadow:0 1px 4px rgba(15,23,42,.18);transition:.2s}.switch.on{background:#176de9}.switch.pushSw.on{background:#7658df}.switch.approveSw.on{background:#df9417}.switch.on i{left:19px}.switch:disabled{opacity:.4;cursor:default}.nrControls select{height:36px;min-width:145px;padding:0 28px 0 10px;border:1px solid #dce4ef;border-radius:10px;background:#fff;color:#465973;font-size:10px;font-weight:800;outline:0}.nrSaveBar{position:sticky;bottom:10px;z-index:5;display:flex;align-items:center;justify-content:space-between;gap:16px;padding:13px 15px;border:1px solid #cbd9eb;border-radius:16px;background:rgba(255,255,255,.96);box-shadow:0 12px 35px rgba(15,23,42,.12);backdrop-filter:blur(12px)}.nrSaveBar strong,.nrSaveBar span{display:block}.nrSaveBar strong{color:#173052;font-size:11px}.nrSaveBar span{margin-top:3px;color:#8090a6;font-size:9px}.nrSaveBar button{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:42px;padding:0 16px;border:0;border-radius:11px;background:#176de9;color:#fff;font-size:11px;font-weight:950;cursor:pointer}.nrSaveBar button:disabled{background:#aebccc;cursor:default}.nrEmpty{padding:40px;text-align:center;color:#8390a3;font-size:12px}
      @media(max-width:1050px){.nrStats{grid-template-columns:repeat(2,minmax(0,1fr))}.nrWorkspace{grid-template-columns:1fr}.nrUsers{position:static}.nrUserList{grid-template-columns:repeat(2,minmax(0,1fr));max-height:none}.nrCategory{grid-template-columns:1fr}.nrControls{justify-content:flex-end}}
      @media(max-width:640px){.nrStats{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.nrStats article{padding:12px;gap:9px;border-radius:15px}.nrStatIcon{width:38px;height:38px;border-radius:11px}.nrStats strong{font-size:21px}.nrWorkspace{gap:10px}.nrUsers,.nrRules{border-radius:18px}.nrUsers{padding:12px}.nrUserList{display:flex;overflow-x:auto;gap:7px;padding-bottom:3px}.nrUser{min-width:205px}.nrRules{padding:13px}.nrRulesHead{display:grid}.nrRulesHead h2{font-size:20px}.nrPresets{justify-content:flex-start}.nrCategory{padding:12px;gap:11px}.nrControls{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.nrControls select{grid-column:1/-1;width:100%;min-width:0}.nrCategoryMain p{font-size:9px}.nrSaveBar{bottom:8px;display:grid;padding:11px}.nrSaveBar button{width:100%}}
    `}</style>
  </div>;
}
