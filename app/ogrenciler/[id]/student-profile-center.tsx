"use client";

import { useEffect, useRef, useState } from "react";
import { generatePortalPassword } from "@/lib/guardian/password";
import type { PortalCredential } from "@/lib/guardian/portal-message";
import PortalCredentialManager from "@/app/veliler/portal-credential-manager";
import { rememberPortalCredential } from "@/lib/guardian/credential-draft";
import { useRouter } from "next/navigation";
import {
  createOrLinkGuardianPortal,
  getStudentProfileForCenter,
  saveStudentProfileFromCenter,
  setGuardianPortalActive,
  unlinkGuardianPortal,
} from "./profile-center-actions";

type FormState = {
  firstName: string;
  lastName: string;
  birthDate: string;
  phone: string;
  email: string;
  guardianName: string;
  guardianPhone: string;
  guardianEmail: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  generalNote: string;
};

type GuardianPortal = {
  guardianId: string;
  fullName: string;
  email: string;
  phone: string;
  relationship: string;
  isPrimary: boolean;
  isActive: boolean;
} | null;

const emptyForm: FormState = {
  firstName: "",
  lastName: "",
  birthDate: "",
  phone: "",
  email: "",
  guardianName: "",
  guardianPhone: "",
  guardianEmail: "",
  emergencyContactName: "",
  emergencyContactPhone: "",
  generalNote: "",
};

function resolveStudentId() {
  if (typeof window === "undefined") return "";
  return window.location.pathname.match(/\/ogrenciler\/([^/]+)/)?.[1] || "";
}

function detectAdultCourse() {
  if (typeof document === "undefined") return false;
  const coursePanel = document.querySelector<HTMLElement>("#kurs-kaydi");
  const text = (coursePanel?.textContent || "").toLocaleLowerCase("tr-TR");
  return text.includes("yetişkin") || text.includes("adult");
}

export default function StudentProfileCenter() {
  const router = useRouter();
  const [studentId, setStudentId] = useState("");
  const [adultCourse, setAdultCourse] = useState(false);
  const [returnHref, setReturnHref] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [portalBusy, setPortalBusy] = useState(false);
  const portalLock = useRef(false);
  const [showSetupPassword, setShowSetupPassword] = useState(false);
  const [initialCredential, setInitialCredential] = useState<PortalCredential | undefined>();
  const [messageError, setMessageError] = useState(false);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState<FormState>(emptyForm);
  const [portal, setPortal] = useState<GuardianPortal>(null);
  const [portalForm, setPortalForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    relationship: "Veli",
    temporaryPassword: "",
  });

  useEffect(() => {
    const currentId = resolveStudentId();
    if (currentId) setStudentId(currentId);
    const requestedReturn = new URLSearchParams(window.location.search).get("returnTo");
    if (requestedReturn === `/kayit-tamamlama/${currentId}` || requestedReturn === `/on-kayitlar?student=${currentId}`) setReturnHref(requestedReturn);

    const onClick = (event: MouseEvent) => {
      const target = event.target as Element | null;
      const actionButton = target?.closest<HTMLButtonElement>(".fileCommandActions button");
      const summaryButton = target?.closest<HTMLButtonElement>("[data-open-profile-center='1']");
      const alertLink = target?.closest<HTMLAnchorElement>(".smartAlertGrid a[href='#genel-bilgiler']");
      const text = actionButton?.textContent?.replace(/\s+/g, " ").trim() || "";
      if (!summaryButton && !alertLink && !text.includes("Bilgileri Düzenle")) return;

      const id = resolveStudentId();
      if (!id) return;

      event.preventDefault();
      event.stopPropagation();
      const field=summaryButton?.dataset.profileField;
      void openEditor(id, detectAdultCourse()).then(()=>{
        if(field) window.requestAnimationFrame(()=>document.querySelector<HTMLInputElement | HTMLTextAreaElement>(`.profileCenterPanel [data-profile-field="${field}"]`)?.focus());
      });
    };

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape" && !portalBusy && !saving) setOpen(false); };
    document.addEventListener("keydown", closeOnEscape);
    return () => { document.body.style.overflow = previous; document.removeEventListener("keydown",closeOnEscape); };
  }, [open,portalBusy,saving]);

  async function openEditor(id = resolveStudentId(), adult = detectAdultCourse()) {
    if (!id) return;
    setStudentId(id);
    setAdultCourse(adult);
    setOpen(true);
    setLoading(true);
    setProfileLoaded(false);
    setInitialCredential(undefined);
    setShowSetupPassword(false);
    setMessageError(false);
    setMessage("");

    try {
    const response = await getStudentProfileForCenter(id);
    if (!response.ok || !response.student) {
      setMessage(response.message || "Bilgiler alınamadı.");
      setLoading(false);
      return;
    }

    const student = response.student as any;
    const selfAccount = response.portalOwner === "self";
    setAdultCourse(selfAccount);
    setForm({
      firstName: student.first_name || "",
      lastName: student.last_name || "",
      birthDate: student.birth_date || "",
      phone: student.phone || "",
      email: student.email || "",
      guardianName: student.guardian_name || "",
      guardianPhone: student.guardian_phone || "",
      guardianEmail: student.guardian_email || "",
      emergencyContactName: student.emergency_contact_name || "",
      emergencyContactPhone: student.emergency_contact_phone || "",
      generalNote: student.general_note || "",
    });
    setPortal((response as any).guardianPortal || null);
    setPortalForm({
      fullName: selfAccount ? `${student.first_name || ""} ${student.last_name || ""}`.trim() : student.guardian_name || "",
      email: (selfAccount ? student.email : student.guardian_email) || "",
      phone: (selfAccount ? student.phone : student.guardian_phone) || "",
      relationship: selfAccount ? "Kendisi" : "Veli",
      temporaryPassword: "",
    });
    setProfileLoaded(true);
    } catch { setMessage("Bilgiler yüklenemedi. Düzenlemeyi kapatıp tekrar açın."); } finally { setLoading(false); }
  }

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function activeStudentId() {
    return studentId || resolveStudentId();
  }

  async function save() {
    const id = activeStudentId();
    if (!id || saving || !profileLoaded) return;
    setSaving(true);
    setMessage("");
    try {
    const response = await saveStudentProfileFromCenter({ studentId: id, ...form });
    setMessage(response.message);
    setMessageError(!response.ok);
    setSaving(false);
    if (response.ok) {
      window.dispatchEvent(new CustomEvent("student-profile-saved", {detail: form}));
      router.refresh();
    }
    } catch { setMessage("Bilgiler kaydedilemedi. Bağlantıyı kontrol edip tekrar deneyin."); } finally { setSaving(false); }
  }

  async function createOrLinkPortal() {
    const id = activeStudentId();
    if (!id || portalLock.current || !profileLoaded) return;
    portalLock.current = true;
    setPortalBusy(true);
    setMessage("");
    setMessageError(false);
    try {
      const response = await createOrLinkGuardianPortal({ studentId: id, ...portalForm });
      setMessage(response.message);
      setMessageError(!response.ok);
      if (response.ok) {
        if (response.credential) {
          rememberPortalCredential(response.credential);
          setInitialCredential(response.credential);
        }
        const linked = response.guardianPortal;
        setPortal(linked || null);
        if (linked) setForm(current=>adultCourse ? {...current,phone:linked.phone,email:linked.email} : {...current,guardianName:linked.fullName,guardianPhone:linked.phone,guardianEmail:linked.email});
        setPortalForm(current=>({...current,temporaryPassword:""}));
        window.dispatchEvent(new CustomEvent("guardian-portal-linked", {detail:{studentId:id,accountId:linked?.guardianId}}));
        router.refresh();
      }
    } catch {
      setMessageError(true);
      setMessage("Hesap işlemi doğrulanamadı. Ekranı yeniden açıp bağlantıyı kontrol ediniz; WhatsApp paylaşımı yapmayınız.");
    } finally {
      portalLock.current = false;
      setPortalBusy(false);
    }
  }

  function generateSetupPassword() {
    try {
      setPortalForm(current=>({...current,temporaryPassword:generatePortalPassword()}));
      setShowSetupPassword(true);
      setMessageError(false);
      setMessage("Güçlü şifre hazırlandı. Hesabı oluşturduğunuzda kaydedilir; mevcut hesap eşleşirse şifresi korunur.");
    } catch { setMessageError(true); setMessage("Bu tarayıcıda şifre üretilemedi. Alanı boş bırakın; yeni hesabın güvenli şifresi sunucuda oluşturulur."); }
  }

  async function copySetupPassword() {
    try {
      await navigator.clipboard.writeText(portalForm.temporaryPassword);
      setMessageError(false);
      setMessage("Hazırlanan şifre kopyalandı. Veliyle paylaşmadan önce hesabı oluşturup kaydedilen giriş bilgilerini kullanınız.");
    } catch { setMessageError(true); setShowSetupPassword(true); setMessage("Kopyalama açılamadı. Şifre alanındaki metni seçip kopyalayabilirsiniz."); }
  }

  async function togglePortal() {
    const id = activeStudentId();
    if (!id || !portal || portalBusy) return;
    setPortalBusy(true);
    setMessage("");
    const response = await setGuardianPortalActive(id, !portal.isActive);
    setMessage(response.message);
    setMessageError(!response.ok);
    if (response.ok) {
      setPortal({ ...portal, isActive: !portal.isActive });
      router.refresh();
    }
    setPortalBusy(false);
  }

  async function unlinkPortal() {
    const id = activeStudentId();
    if (!id || !portal || portalBusy) return;
    setPortalBusy(true);
    setMessage("");
    const response = await unlinkGuardianPortal(id);
    setMessage(response.message);
    setMessageError(!response.ok);
    if (response.ok) {
      setPortal(null);
      router.refresh();
    }
    setPortalBusy(false);
  }


  if (!open) return null;

  const relationLabel = adultCourse ? "Yakını" : "Veli";

  return (
    <div className="profileCenterOverlay" onClick={() => { if (!portalBusy && !saving) setOpen(false); }}>
      <aside role="dialog" aria-modal="true" aria-labelledby="profile-center-title" className="profileCenterPanel" onClick={(event) => event.stopPropagation()}>
        <header>
          <div>
            <span>DİJİTAL KURSİYER DOSYASI</span>
            <h2 id="profile-center-title">{adultCourse ? "Kursiyer Bilgi Merkezi" : "Öğrenci / Veli Bilgi Merkezi"}</h2>
            <p>{adultCourse ? "Kursiyer, yakını, acil durum ve portal erişimini tek merkezden yönetin." : "Öğrenci, veli, acil durum ve portal erişimini tek merkezden yönetin."}</p>
          </div>
          <button type="button" onClick={() => { if (!portalBusy && !saving) setOpen(false); }} aria-label="Kapat">×</button>
        </header>

        {loading ? (
          <div className="profileCenterLoading">Bilgiler yükleniyor…</div>
        ) : (
          <div className="profileCenterBody">
            <section>
              <div className="sectionTitle"><b>1</b><div><strong>{adultCourse ? "Kursiyer Bilgileri" : "Öğrenci Bilgileri"}</strong><small>Kimlik ve doğrudan iletişim bilgileri</small></div></div>
              <div className="profileGrid">
                <label><span>Ad</span><input data-profile-field="firstName" value={form.firstName} onChange={(e) => set("firstName", e.target.value)} /></label>
                <label><span>Soyad</span><input data-profile-field="lastName" value={form.lastName} onChange={(e) => set("lastName", e.target.value)} /></label>
                <label><span>Doğum Tarihi</span><input data-profile-field="birthDate" type="date" value={form.birthDate} onChange={(e) => set("birthDate", e.target.value)} /></label>
                <label><span>{adultCourse ? "Kursiyer Telefonu" : "Öğrenci Telefonu"}</span><input data-profile-field="phone" value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="05xx xxx xx xx" /></label>
                <label className="full"><span>{adultCourse ? "Kursiyer E-postası" : "Öğrenci E-postası"}</span><input data-profile-field="email" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} /></label>
              </div>
            </section>

            <section>
              <div className="sectionTitle"><b>2</b><div><strong>{adultCourse ? "Yakın Bilgileri" : "Veli Bilgileri"}</strong><small>{adultCourse ? "İsteğe bağlı yakın iletişim bilgileri" : "İletişim, ödeme ve bilgilendirme için ana veli kaydı"}</small></div></div>
              <div className="profileGrid">
                <label><span>{adultCourse ? "Kursiyer" : "Veli"} Adı Soyadı</span><input data-profile-field="guardianName" value={form.guardianName} onChange={(e) => set("guardianName", e.target.value)} /></label>
                <label><span>{relationLabel} Telefonu</span><input data-profile-field="guardianPhone" value={form.guardianPhone} onChange={(e) => set("guardianPhone", e.target.value)} placeholder="05xx xxx xx xx" /></label>
                <label className="full"><span>{relationLabel} E-postası</span><input data-profile-field="guardianEmail" type="email" value={form.guardianEmail} onChange={(e) => set("guardianEmail", e.target.value)} /></label>
              </div>
            </section>

            <section>
              <div className="sectionTitle"><b>3</b><div><strong>Acil Durum ve Yönetim Notu</strong><small>Gerektiğinde hızlı erişilecek kişi ve kurum içi not</small></div></div>
              <div className="profileGrid">
                <label><span>Acil Durum Kişisi</span><input data-profile-field="emergencyContactName" value={form.emergencyContactName} onChange={(e) => set("emergencyContactName", e.target.value)} /></label>
                <label><span>Acil Durum Telefonu</span><input data-profile-field="emergencyContactPhone" value={form.emergencyContactPhone} onChange={(e) => set("emergencyContactPhone", e.target.value)} /></label>
                <label className="full"><span>Genel Yönetim Notu</span><textarea data-profile-field="generalNote" rows={4} value={form.generalNote} onChange={(e) => set("generalNote", e.target.value)} /></label>
              </div>
            </section>

            <section className="portalSection">
              <div className="sectionTitle"><b>4</b><div><strong>{adultCourse ? "Portal Hesabı" : "Veli Portalı"}</strong><small>{adultCourse ? "Kursiyer veya yakını için portal erişimi" : "Veli giriş hesabı ve öğrenci bağlantısı"}</small></div></div>
              {portal ? (
                <div className="portalConnected">
                  <div className="portalStatusRow">
                    <div><span>{adultCourse ? "BAĞLI PORTAL HESABI" : "BAĞLI VELİ HESABI"}</span><strong>{portal.fullName}</strong><small>{portal.email || portal.phone || "İletişim bilgisi yok"} · {portal.relationship}</small></div>
                    <em className={portal.isActive ? "active" : "passive"}>{portal.isActive ? "AKTİF" : "PASİF"}</em>
                  </div>
                  <div className="portalActions">
                    <button type="button" className="portalToggle" disabled={portalBusy} onClick={togglePortal}>{portal.isActive ? "Portal Erişimini Pasife Al" : "Portal Erişimini Aktif Et"}</button>
                    <button type="button" className="portalUnlink" disabled={portalBusy} onClick={unlinkPortal}>Kursiyer Bağlantısını Kaldır</button>
                  </div>
                  <PortalCredentialManager accountId={portal.guardianId} initialCredential={initialCredential}/>
                  {returnHref ? <button type="button" className="portalCreate" onClick={()=>{setOpen(false);router.push(returnHref);}}>Kayıt İşlemine Geri Dön</button> : null}

                </div>
              ) : (
                <>
                  <div className="portalInfo"><strong>{adultCourse ? "Portal hesabı bağlı değil" : "Veli hesabı bağlı değil"}</strong><p>Önce iletişim bilgilerini kontrol edin. Yeni hesap için güvenli şifre otomatik hazırlanır; mevcut hesap eşleşirse şifresi korunarak öğrenciye bağlanır.</p></div>
                  <div className="profileGrid">
                    <label><span>{adultCourse ? "Kursiyer" : "Veli"} Adı Soyadı</span><input value={portalForm.fullName} onChange={(e) => setPortalForm({ ...portalForm, fullName: e.target.value })} /></label>
                    <label><span>{adultCourse ? "Hesap sahibi" : "Yakınlık"}</span><input readOnly={adultCourse} value={portalForm.relationship} onChange={(e) => setPortalForm({ ...portalForm, relationship: e.target.value })} placeholder={adultCourse ? "Yakını, kendisi..." : "Anne, Baba, Vasi..."} /></label>
                    <label><span>Portal E-postası</span><input type="email" value={portalForm.email} onChange={(e) => setPortalForm({ ...portalForm, email: e.target.value })} /></label>
                    <label><span>Portal Telefonu</span><input value={portalForm.phone} onChange={(e) => setPortalForm({ ...portalForm, phone: e.target.value })} /></label>
                    <div className="full setupPasswordBox">
                      <label><span>Yeni hesap şifresi</span><input type={showSetupPassword ? "text" : "password"} autoComplete="new-password" value={portalForm.temporaryPassword} disabled={portalBusy} minLength={8} maxLength={100} onChange={e=>setPortalForm(current=>({...current,temporaryPassword:e.target.value}))} placeholder="Boş bırakılırsa güvenli şifre otomatik oluşturulur" aria-describedby="setup-password-help" onFocus={e=>e.target.select()}/></label>
                      <p id="setup-password-help">20 karakterlik güçlü şifre oluşturabilirsiniz. Bu alan yalnızca yeni hesap içindir. Bağlantı tamamlanınca kaydedilen giriş bilgileri ve WhatsApp paylaşımı açılır.</p>
                      <div className="setupPasswordActions"><button type="button" disabled={portalBusy} onClick={generateSetupPassword}>Güçlü Şifre Oluştur</button><button type="button" disabled={portalBusy} aria-pressed={showSetupPassword} onClick={()=>setShowSetupPassword(v=>!v)}>{showSetupPassword ? "Şifreyi Gizle" : "Şifreyi Göster"}</button><button type="button" disabled={portalBusy || !portalForm.temporaryPassword} onClick={copySetupPassword}>Şifreyi Kopyala</button></div>
                    </div>
                  </div>
                  <button type="button" className="portalCreate" disabled={portalBusy || !profileLoaded || !portalForm.fullName.trim() || (!portalForm.phone.trim() && !portalForm.email.trim())} aria-busy={portalBusy} onClick={createOrLinkPortal}>{portalBusy ? "İşleniyor…" : adultCourse ? "Portal Hesabı Oluştur / Bağla" : "Veli Hesabını Güvenle Oluştur / Bağla"}</button>
                </>
              )}
            </section>

            {message && <div className={`profileCenterMessage${messageError ? " error" : ""}`} role={messageError ? "alert" : "status"} aria-live="polite">{message}</div>}
          </div>
        )}

        <footer>
          <button type="button" className="ghost" onClick={() => { if (!portalBusy && !saving) setOpen(false); }}>Kapat</button>
          <button type="button" className="save" disabled={loading || saving || portalBusy} onClick={save}>{saving ? "Kaydediliyor…" : adultCourse ? "✓ Kursiyer / Yakın Bilgilerini Kaydet" : "✓ Öğrenci / Veli Bilgilerini Kaydet"}</button>
        </footer>
      </aside>

      <style jsx>{`
        .profileCenterOverlay{position:fixed;inset:0;z-index:10000;display:flex;justify-content:flex-end;background:rgba(4,20,38,.64);backdrop-filter:blur(7px)}
        .profileCenterPanel{box-sizing:border-box;min-width:0;max-width:100vw;overflow:hidden;width:min(780px,98vw);height:100dvh;max-height:100dvh;display:flex;flex-direction:column;background:#f5f8fc;box-shadow:-24px 0 70px rgba(0,0,0,.28)}
        header{flex:0 0 auto;display:flex;justify-content:space-between;gap:20px;padding:24px 26px;background:linear-gradient(135deg,#082b50,#0d5e9e);color:#fff}header span{display:block;color:#ffad32;font-size:10px;font-weight:900;letter-spacing:.12em}header h2{margin:5px 0 3px;font-size:25px}header p{margin:0;color:#dbeafd;font-size:13px}header button{width:40px;height:40px;border:1px solid rgba(255,255,255,.3);border-radius:11px;background:rgba(255,255,255,.1);color:#fff;font-size:25px;cursor:pointer}
        .profileCenterBody{box-sizing:border-box;min-height:0;min-width:0;overflow-x:hidden;flex:1;overflow-y:auto;padding:22px;display:grid;gap:16px}.profileCenterLoading{flex:1;padding:40px;text-align:center;color:#60778f}section{padding:18px;border:1px solid #dbe5ef;border-radius:17px;background:#fff;box-shadow:0 8px 24px rgba(20,55,90,.05)}
        .sectionTitle{display:flex;align-items:center;gap:11px;margin-bottom:15px}.sectionTitle>b{display:grid;place-items:center;width:30px;height:30px;border-radius:9px;background:#edf5ff;color:#0b62b3}.sectionTitle strong,.sectionTitle small{display:block}.sectionTitle strong{color:#11395f}.sectionTitle small{margin-top:2px;color:#728499}
        .profileGrid{min-width:0;display:grid;grid-template-columns:1fr 1fr;gap:13px}.profileGrid label{min-width:0;display:grid;gap:6px}.profileGrid .full{grid-column:1/-1}.profileGrid span{font-size:11px;font-weight:850;color:#4f647a}.profileGrid input,.profileGrid textarea{min-width:0;max-width:100%;font-size:16px;width:100%;box-sizing:border-box;border:1px solid #cfdbe8;border-radius:10px;padding:11px 12px;background:#fbfdff;color:#142f4a;font:inherit;font-size:16px;outline:none}.profileGrid input:focus,.profileGrid textarea:focus{border-color:#4894d5;box-shadow:0 0 0 3px rgba(72,148,213,.12)}
        .portalSection{border-color:#cfe0f3}.portalInfo{margin-bottom:14px;padding:13px 14px;border:1px solid #d6e6f6;border-radius:12px;background:#f1f7fd}.portalInfo strong{color:#0b5797}.portalInfo p{margin:5px 0 0;color:#58718a;font-size:12px;line-height:1.5}.portalCreate{margin-top:14px;width:100%;min-height:43px;border:0;border-radius:11px;background:#0b67b2;color:#fff;font-weight:900;cursor:pointer}.portalConnected{display:grid;gap:14px}.portalStatusRow{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:15px;border:1px solid #d8e4ef;border-radius:13px;background:#fbfdff}.portalStatusRow span,.portalStatusRow strong,.portalStatusRow small{display:block}.portalStatusRow span{font-size:9px;font-weight:900;color:#6e8196;letter-spacing:.08em}.portalStatusRow strong{margin-top:4px;color:#173d62}.portalStatusRow small{margin-top:3px;color:#71849a}.portalStatusRow em{font-style:normal;font-size:10px;font-weight:900;padding:6px 9px;border-radius:999px}.portalStatusRow em.active{background:#dcfce7;color:#166534}.portalStatusRow em.passive{background:#fee2e2;color:#991b1b}.portalActions{display:flex;gap:9px;flex-wrap:wrap}.portalActions button{min-height:40px;padding:0 13px;border-radius:10px;font-weight:850;cursor:pointer}.portalToggle{border:1px solid #c8daf0;background:#eef6ff;color:#0a5da5}.portalUnlink{border:1px solid #efcaca;background:#fff3f3;color:#a52c2c}.portalPasswordPanel{display:grid;gap:11px;padding:14px;border:1px solid #cfe0f3;border-radius:13px;background:linear-gradient(135deg,#f7fbff,#edf6ff)}.portalPasswordPanel strong,.portalPasswordPanel small{display:block}.portalPasswordPanel strong{color:#123f68}.portalPasswordPanel small{margin-top:3px;color:#6c8095;font-size:12px}.portalPasswordControls{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:9px}.portalPasswordControls input{min-width:0;border:1px solid #c8d8e8;border-radius:10px;padding:11px 12px;background:#fff;color:#17334e;font:inherit;outline:none}.portalPasswordControls input:focus{border-color:#2780c6;box-shadow:0 0 0 3px rgba(39,128,198,.12)}.portalPasswordControls button{min-height:42px;border:0;border-radius:10px;padding:0 15px;background:linear-gradient(135deg,#075eaa,#0878c9);color:#fff;font-weight:900;cursor:pointer;box-shadow:0 7px 16px rgba(7,94,170,.18)}
        .setupPasswordBox{padding:14px;border:1px solid #d5e4f3;border-radius:13px;background:#f4f8fd;min-width:0}.setupPasswordBox p{font-size:12px;line-height:1.6;color:#526a82;margin:10px 0}.setupPasswordActions{display:flex;flex-wrap:wrap;gap:8px}.setupPasswordActions button{min-height:42px;padding:10px 13px;border:1px solid #c5d8eb;border-radius:10px;background:white;color:#134d7d;font:inherit;font-size:12px;font-weight:800;cursor:pointer}.profileCenterMessage.error{background:#fff1f2;color:#9f1239;border:1px solid #fecdd3}
        .profileCenterMessage{padding:12px 14px;border-radius:11px;background:#eefaf4;color:#14643f;font-weight:800}footer{box-sizing:border-box;flex:0 0 auto;display:flex;justify-content:flex-end;gap:10px;padding:16px 22px;border-top:1px solid #dbe4ee;background:#fff}footer button{min-height:43px;padding:0 17px;border-radius:11px;font-weight:850;cursor:pointer}.ghost{border:1px solid #d2dce7;background:#fff;color:#49647e}.save{border:1px solid #0a6d46;background:linear-gradient(135deg,#087443,#12a365);color:#fff;box-shadow:0 8px 18px rgba(8,116,67,.18)}button:disabled{opacity:.55;cursor:not-allowed}
        @media(max-width:640px){header{padding:19px}.profileCenterBody{padding:13px}.profileGrid{grid-template-columns:1fr}.profileGrid .full{grid-column:auto}section{padding:14px}footer{padding:12px 14px max(12px,env(safe-area-inset-bottom));flex-direction:column-reverse}.portalStatusRow{align-items:flex-start;flex-direction:column}.portalActions,.portalPasswordControls{display:grid;grid-template-columns:1fr}.portalActions button,.portalPasswordControls button{width:100%}}
      `}</style>
    </div>
  );
}
