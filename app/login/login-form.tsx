"use client";

import { FormEvent, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";

type LoginRole = "admin" | "coach" | "guardian";
type LoginMethod = "email" | "phone";
type SupportKind = "password" | "contact" | "login_error";

const roles: Array<{ value: LoginRole; label: string; icon: "crown" | "coach" | "family" }> = [
  { value: "guardian", label: "Veli Girişi", icon: "family" },
  { value: "coach", label: "Eğitmen Girişi", icon: "coach" },
  { value: "admin", label: "Yönetici Girişi", icon: "crown" },
];

const allowedRoles: Record<LoginRole, string[]> = {
  admin: ["owner", "admin", "branch_manager", "registration_staff", "accounting"],
  coach: ["coach"],
  guardian: ["guardian"],
};

function getLocalTurkishDigits(value: string) {
  let digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("0090")) digits = digits.slice(4);
  if (digits.startsWith("90") && digits.length === 12) digits = digits.slice(2);
  if (digits.startsWith("0") && digits.length === 11) digits = digits.slice(1);
  if (digits.length !== 10 || !digits.startsWith("5")) return "";
  return digits;
}

function formatPhoneForDisplay(value: string) {
  const local = getLocalTurkishDigits(value);
  if (!local) return value;
  return `0${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6, 8)} ${local.slice(8)}`;
}

function Icon({ name }: { name: "crown" | "coach" | "family" | "mail" | "phone" | "lock" | "eye" | "eyeOff" }) {
  const common = { width: 22, height: 22, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (name === "crown") return <svg {...common}><path d="m2 7 4 3 6-7 6 7 4-3-2 11H4L2 7Z"/><path d="M5 21h14"/></svg>;
  if (name === "coach") return <svg {...common}><circle cx="12" cy="7" r="4"/><path d="M5.5 21a6.5 6.5 0 0 1 13 0"/><path d="M19 7h3M20.5 5.5v3"/></svg>;
  if (name === "family") return <svg {...common}><circle cx="12" cy="7" r="3"/><circle cx="5" cy="9" r="2"/><circle cx="19" cy="9" r="2"/><path d="M7 21v-2a5 5 0 0 1 10 0v2"/><path d="M1 21v-1a4 4 0 0 1 5-4"/><path d="M23 21v-1a4 4 0 0 0-5-4"/></svg>;
  if (name === "mail") return <svg {...common}><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>;
  if (name === "phone") return <svg {...common}><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.69 2.8a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.28-1.28a2 2 0 0 1 2.11-.45c.9.33 1.84.56 2.8.69A2 2 0 0 1 22 16.92Z"/></svg>;
  if (name === "lock") return <svg {...common}><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>;
  if (name === "eyeOff") return <svg {...common}><path d="m3 3 18 18"/><path d="M10.6 10.6a2 2 0 0 0 2.8 2.8"/><path d="M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 10 8 10 8a15.6 15.6 0 0 1-2.1 3.2"/><path d="M6.6 6.6C3.8 8.4 2 12 2 12s3 8 10 8a10.9 10.9 0 0 0 5.4-1.4"/></svg>;
  return <svg {...common}><path d="M2 12s3-8 10-8 10 8 10 8-3 8-10 8S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>;
}

export default function LoginForm() {
  const searchParams = useSearchParams();
  const [role, setRole] = useState<LoginRole>("guardian");
  const [method, setMethod] = useState<LoginMethod>("phone");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [phonePreview, setPhonePreview] = useState("");
  const [supportOpen, setSupportOpen] = useState(false);
  const [supportKind, setSupportKind] = useState<SupportKind>("contact");
  const [supportIdentifier, setSupportIdentifier] = useState("");
  const [supportMessage, setSupportMessage] = useState("");
  const [supportStatus, setSupportStatus] = useState("");
  const [supportLoading, setSupportLoading] = useState(false);

  const activeRole = useMemo(() => roles.find((item) => item.value === role)!, [role]);

  function openSupport(kind: SupportKind) {
    setSupportKind(kind);
    setSupportStatus("");
    setSupportMessage(kind === "password" ? "Şifremi yenilemek istiyorum." : kind === "login_error" ? "Bilgilerimi doğru girdiğim halde sisteme giriş yapamıyorum." : "SprintOS hesabımla ilgili destek almak istiyorum.");
    setSupportOpen(true);
  }

  async function submitSupport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (supportLoading) return;
    setSupportLoading(true);
    setSupportStatus("");
    try {
      const response = await fetch("/api/auth/support-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: supportKind, role, method, identifier: supportIdentifier.trim(), message: supportMessage.trim() }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.ok) throw new Error(result?.message || "Talep gönderilemedi.");
      setSupportStatus("Talebiniz SprintOS yönetim ekranına gönderildi. Yönetici uygulama içinden işlemi tamamlayabilir.");
    } catch (supportError) {
      setSupportStatus(supportError instanceof Error ? supportError.message : "Talep gönderilemedi.");
    } finally {
      setSupportLoading(false);
    }
  }

  async function verifyBrowserProfile(authUserId: string, currentRole: LoginRole) {
    const supabase = createClient();
    const { data: profile, error: profileError } = await supabase.from("profiles").select("id, role, is_active").eq("id", authUserId).single();
    if (profileError || !profile) { await supabase.auth.signOut(); throw new Error("Kullanıcı profiliniz bulunamadı. Yöneticiyle iletişime geçin."); }
    if (profile.is_active === false) { await supabase.auth.signOut(); throw new Error("Hesabınız pasif durumda. Yöneticiyle iletişime geçin."); }
    if (!allowedRoles[currentRole].includes(profile.role)) { await supabase.auth.signOut(); throw new Error(`Bu hesap ${activeRole.label.toLocaleLowerCase("tr-TR")} yetkisine sahip değil.`); }
    return profile;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    setLoading(true); setError("");
    const form = new FormData(event.currentTarget);
    const identifier = String(form.get("identifier") || "").trim();
    const password = String(form.get("password") || "");
    setSupportIdentifier(identifier);
    if (!identifier || !password) { setError("Lütfen giriş bilgilerinizi eksiksiz yazın."); setLoading(false); return; }
    const supabase = createClient();
    try {
      let authUserId = "";
      if (method === "email") {
        const { data, error: signInError } = await supabase.auth.signInWithPassword({ email: identifier.toLowerCase(), password });
        if (signInError || !data.user || !data.session) throw new Error("E-posta veya şifre doğrulanamadı.");
        authUserId = data.user.id;
        await verifyBrowserProfile(authUserId, role);
        if (role !== "guardian") {
          const { data: staffAccount } = await supabase.from("staff").select("login_enabled, is_active").eq("auth_user_id", authUserId).maybeSingle();
          if (staffAccount?.is_active === false) { await supabase.auth.signOut(); throw new Error("Personel hesabınız pasif durumda."); }
          if (staffAccount?.login_enabled === false) { await supabase.auth.signOut(); throw new Error("Bu hesap için sisteme giriş izni kapalı."); }
        }
        try { await supabase.from("profiles").update({ last_sign_in_at: new Date().toISOString() }).eq("id", authUserId); } catch {}
      } else {
        const localPhone = getLocalTurkishDigits(identifier);
        if (!localPhone) throw new Error("Telefon numaranızı 05XX XXX XX XX şeklinde yazın.");
        const response = await fetch("/api/auth/phone-password", { method: "POST", headers: { "Content-Type": "application/json" }, cache: "no-store", body: JSON.stringify({ phone: localPhone, password, role }) });
        const result = await response.json().catch(() => null);
        if (!response.ok || !result?.ok || !result?.user_id) throw new Error(result?.message || "Telefon numarası veya şifre doğrulanamadı.");
        authUserId = result.user_id;
      }
      if (method === "email") {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !session) throw new Error("Oturum oluşturulamadı. Lütfen tekrar giriş yapın.");
      }
      if (!rememberMe) sessionStorage.setItem("sprintos-session-only", "true"); else sessionStorage.removeItem("sprintos-session-only");
      const rawNext = searchParams.get("next");
      const fallback = role === "guardian" ? "/veli-paneli" : "/";
      const next = rawNext && rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : fallback;
      window.location.assign(next);
    } catch (loginError) {
      try { await supabase.auth.signOut(); } catch {}
      const message = loginError instanceof Error ? loginError.message : "Giriş sırasında beklenmeyen bir hata oluştu.";
      setError(message);
      setLoading(false);
    }
  }

  return <div>
    <div className="v2RoleTabs" role="tablist" aria-label="Giriş türü">
      {roles.map((item) => <button key={item.value} type="button" role="tab" aria-selected={role === item.value} className={role === item.value ? "v2RoleTab active" : "v2RoleTab"} onClick={() => { setRole(item.value); setError(""); }}><Icon name={item.icon}/><span>{item.label}</span></button>)}
    </div>

    <form className="v2LoginForm" onSubmit={handleSubmit}>
      <div className="v2MethodTabs">
        <button type="button" className={method === "email" ? "active" : ""} onClick={() => { setMethod("email"); setError(""); setPhonePreview(""); }}><Icon name="mail"/>E-posta ile giriş</button>
        <button type="button" className={method === "phone" ? "active" : ""} onClick={() => { setMethod("phone"); setError(""); }}><Icon name="phone"/>Telefon ile giriş</button>
      </div>

      <label className="v2Field"><span>{method === "email" ? "E-posta adresi" : "Telefon numarası"}</span><div className="v2InputWrap"><Icon name={method === "email" ? "mail" : "phone"}/><input name="identifier" type={method === "email" ? "email" : "tel"} inputMode={method === "phone" ? "numeric" : undefined} autoComplete={method === "email" ? "email" : "tel"} required placeholder={method === "email" ? "E-posta adresinizi giriniz" : "05XX XXX XX XX"} onChange={(event) => { setSupportIdentifier(event.target.value); if (method === "phone") setPhonePreview(formatPhoneForDisplay(event.target.value)); setError(""); }}/></div>{method === "phone" && phonePreview ? <small style={{display:"block",marginTop:6,color:"#64748b",fontSize:12}}>Giriş numarası: <strong>{phonePreview}</strong></small> : null}</label>

      <label className="v2Field"><span>Şifre</span><div className="v2InputWrap"><Icon name="lock"/><input name="password" type={showPassword ? "text" : "password"} autoComplete="current-password" required placeholder="Şifrenizi giriniz"/><button type="button" className="v2PasswordToggle" aria-label={showPassword ? "Şifreyi gizle" : "Şifreyi göster"} title={showPassword ? "Şifre görünür" : "Şifre gizli"} onClick={() => setShowPassword((current) => !current)}><Icon name={showPassword ? "eye" : "eyeOff"}/></button></div></label>

      <div className="v2LoginOptions"><label className="v2Remember"><input type="checkbox" checked={rememberMe} onChange={(event) => setRememberMe(event.target.checked)}/><span>Beni hatırla</span></label><button type="button" className="loginInlineLink" onClick={() => openSupport("password")}>Şifremi unuttum</button></div>

      <button className="v2SubmitButton" disabled={loading} type="submit"><Icon name="lock"/>{loading ? "Giriş yapılıyor…" : activeRole.label}</button>
      {error ? <div className="v2LoginError" role="alert"><p>{error}</p><button type="button" onClick={() => openSupport("login_error")}>Giriş sorununu yönetime bildir</button></div> : null}
      <div className="v2ContactLine"><span>veya</span></div>
      <p className="v2ContactText">Hesabınız yok mu? <button type="button" className="loginInlineLink" onClick={() => openSupport("contact")}>İletişime geçin</button></p>
    </form>

    {supportOpen ? <div className="loginSupportOverlay" role="dialog" aria-modal="true"><div className="loginSupportCard"><button type="button" className="loginSupportClose" onClick={() => setSupportOpen(false)}>×</button><p className="loginSupportEyebrow">SPRİNTOS · DESTEK</p><h3>{supportKind === "password" ? "Şifre Yenileme Talebi" : supportKind === "login_error" ? "Giriş Sorunu Bildir" : "İletişim Talebi"}</h3><p>Talebiniz doğrudan SprintOS yönetim ekranına düşer. Yetkili kullanıcı uygulama içinden hesabınızı kontrol edebilir ve gerekiyorsa şifrenizi yenileyebilir.</p><form onSubmit={submitSupport}><label>E-posta veya telefon<input value={supportIdentifier} onChange={(e) => setSupportIdentifier(e.target.value)} required placeholder="Hesabınızda kayıtlı bilgi"/></label><label>Mesaj<textarea value={supportMessage} onChange={(e) => setSupportMessage(e.target.value)} rows={4} required/></label><button type="submit" disabled={supportLoading}>{supportLoading ? "Gönderiliyor…" : "Uygulamaya Mesaj Gönder"}</button></form>{supportStatus ? <div className="loginSupportStatus">{supportStatus}</div> : null}</div></div> : null}

    <style jsx>{`
      .loginInlineLink{border:0;background:transparent;color:#0b6ef3;text-decoration:underline;font:inherit;font-weight:800;cursor:pointer;padding:0}.v2LoginError p{margin:0 0 7px}.v2LoginError button{border:0;background:transparent;color:#b42318;text-decoration:underline;font:inherit;font-weight:800;cursor:pointer;padding:0}.loginSupportOverlay{position:fixed;inset:0;z-index:99999;display:grid;place-items:center;padding:18px;background:rgba(3,19,47,.58);backdrop-filter:blur(6px)}.loginSupportCard{position:relative;width:min(470px,100%);padding:24px;border-radius:20px;background:#fff;box-shadow:0 24px 70px rgba(2,18,44,.28);color:#14213d}.loginSupportClose{position:absolute;right:13px;top:12px;width:34px;height:34px;border:0;border-radius:10px;background:#f1f5f9;color:#64748b;font-size:22px;cursor:pointer}.loginSupportEyebrow{margin:0 0 6px!important;color:#176de9!important;font-size:10px!important;font-weight:900;letter-spacing:1.2px}.loginSupportCard h3{margin:0;font-size:22px}.loginSupportCard>p:not(.loginSupportEyebrow){margin:9px 0 18px;color:#667085;font-size:13px;line-height:1.55}.loginSupportCard form{display:grid;gap:12px}.loginSupportCard label{display:grid;gap:6px;font-size:12px;font-weight:800}.loginSupportCard input,.loginSupportCard textarea{width:100%;border:1px solid #d8e1ed;border-radius:11px;padding:11px 12px;font:inherit;font-weight:500;resize:vertical}.loginSupportCard form button{min-height:44px;border:0;border-radius:11px;background:#176de9;color:#fff;font-weight:900;cursor:pointer}.loginSupportCard form button:disabled{opacity:.6}.loginSupportStatus{margin-top:12px;padding:11px 12px;border-radius:11px;background:#eff6ff;color:#1d4ed8;font-size:12px;line-height:1.5}
    `}</style>
  </div>;
}
