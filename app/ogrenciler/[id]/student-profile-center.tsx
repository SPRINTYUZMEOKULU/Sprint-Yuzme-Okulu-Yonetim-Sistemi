"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createOrLinkGuardianPortal,
  getStudentProfileForCenter,
  resetGuardianPortalPassword,
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

export default function StudentProfileCenter() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [portalBusy, setPortalBusy] = useState(false);
  const [portalPassword, setPortalPassword] = useState("");
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

  const studentId = useMemo(() => {
    if (typeof window === "undefined") return "";
    const match = window.location.pathname.match(/\/ogrenciler\/([^/]+)/);
    return match?.[1] || "";
  }, []);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const target = event.target as Element | null;
      const actionButton = target?.closest<HTMLButtonElement>(".fileCommandActions button");
      const summaryButton = target?.closest<HTMLButtonElement>("[data-open-profile-center='1']");
      const alertLink = target?.closest<HTMLAnchorElement>(".smartAlertGrid a[href='#genel-bilgiler']");
      const text = actionButton?.textContent?.replace(/\s+/g, " ").trim() || "";
      if (!summaryButton && !alertLink && !text.includes("Bilgileri Düzenle")) return;
      event.preventDefault();
      event.stopPropagation();
      void openEditor();
    };

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [studentId]);

  async function openEditor() {
    if (!studentId) return;
    setOpen(true);
    setLoading(true);
    setMessage("");
    const response = await getStudentProfileForCenter(studentId);
    if (!response.ok || !response.student) {
      setMessage(response.message || "Bilgiler alınamadı.");
      setLoading(false);
      return;
    }

    const student = response.student as any;
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
    setPortalPassword("");
    setPortalForm({
      fullName: student.guardian_name || "",
      email: student.guardian_email || "",
      phone: student.guardian_phone || "",
      relationship: "Veli",
      temporaryPassword: "",
    });
    setLoading(false);
  }

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function save() {
    if (!studentId || saving) return;
    setSaving(true);
    setMessage("");
    const response = await saveStudentProfileFromCenter({ studentId, ...form });
    setMessage(response.message);
    setSaving(false);
    if (response.ok) router.refresh();
  }

  async function createOrLinkPortal() {
    if (!studentId || portalBusy) return;
    setPortalBusy(true);
    setMessage("");
    const response = await createOrLinkGuardianPortal({ studentId, ...portalForm });
    setMessage(response.message);
    if (response.ok) {
      setPortal((response as any).guardianPortal || null);
      setPortalForm((current) => ({ ...current, temporaryPassword: "" }));
      router.refresh();
    }
    setPortalBusy(false);
  }

  async function togglePortal() {
    if (!studentId || !portal || portalBusy) return;
    setPortalBusy(true);
    setMessage("");
    const response = await setGuardianPortalActive(studentId, !portal.isActive);
    setMessage(response.message);
    if (response.ok) {
      setPortal({ ...portal, isActive: !portal.isActive });
      router.refresh();
    }
    setPortalBusy(false);
  }

  async function unlinkPortal() {
    if (!studentId || !portal || portalBusy) return;
    setPortalBusy(true);
    setMessage("");
    const response = await unlinkGuardianPortal(studentId);
    setMessage(response.message);
    if (response.ok) {
      setPortal(null);
      router.refresh();
    }
    setPortalBusy(false);
  }

  async function resetPortalPassword() {
    if (!studentId || !portal || portalBusy || portalPassword.length < 8) return;
    setPortalBusy(true);
    setMessage("");
    const response = await resetGuardianPortalPassword(studentId, portalPassword);
    setMessage(response.message);
    if (response.ok) setPortalPassword("");
    setPortalBusy(false);
  }

  if (!open) return null;

  return (
    <div className="profileCenterOverlay" onClick={() => setOpen(false)}>
      <aside className="profileCenterPanel" onClick={(event) => event.stopPropagation()}>
        <header>
          <div>
            <span>DİJİTAL KURSİYER DOSYASI</span>
            <h2>Öğrenci / Veli Bilgi Merkezi</h2>
            <p>Öğrenci, veli, acil durum ve portal erişimini tek merkezden yönetin.</p>
          </div>
          <button type="button" onClick={() => setOpen(false)} aria-label="Kapat">×</button>
        </header>

        {loading ? (
          <div className="profileCenterLoading">Bilgiler yükleniyor…</div>
        ) : (
          <div className="profileCenterBody">
            <section>
              <div className="sectionTitle"><b>1</b><div><strong>Öğrenci Bilgileri</strong><small>Kimlik ve doğrudan iletişim bilgileri</small></div></div>
              <div className="profileGrid">
                <label><span>Ad</span><input value={form.firstName} onChange={(e) => set("firstName", e.target.value)} /></label>
                <label><span>Soyad</span><input value={form.lastName} onChange={(e) => set("lastName", e.target.value)} /></label>
                <label><span>Doğum Tarihi</span><input type="date" value={form.birthDate} onChange={(e) => set("birthDate", e.target.value)} /></label>
                <label><span>Öğrenci Telefonu</span><input value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="05xx xxx xx xx" /></label>
                <label className="full"><span>Öğrenci E-postası</span><input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} /></label>
              </div>
            </section>

            <section>
              <div className="sectionTitle"><b>2</b><div><strong>Veli Bilgileri</strong><small>İletişim, ödeme ve bilgilendirme için ana veli kaydı</small></div></div>
              <div className="profileGrid">
                <label><span>Veli Adı Soyadı</span><input value={form.guardianName} onChange={(e) => set("guardianName", e.target.value)} /></label>
                <label><span>Veli Telefonu</span><input value={form.guardianPhone} onChange={(e) => set("guardianPhone", e.target.value)} placeholder="05xx xxx xx xx" /></label>
                <label className="full"><span>Veli E-postası</span><input type="email" value={form.guardianEmail} onChange={(e) => set("guardianEmail", e.target.value)} /></label>
              </div>
            </section>

            <section>
              <div className="sectionTitle"><b>3</b><div><strong>Acil Durum ve Yönetim Notu</strong><small>Gerektiğinde hızlı erişilecek kişi ve kurum içi not</small></div></div>
              <div className="profileGrid">
                <label><span>Acil Durum Kişisi</span><input value={form.emergencyContactName} onChange={(e) => set("emergencyContactName", e.target.value)} /></label>
                <label><span>Acil Durum Telefonu</span><input value={form.emergencyContactPhone} onChange={(e) => set("emergencyContactPhone", e.target.value)} /></label>
                <label className="full"><span>Genel Yönetim Notu</span><textarea rows={4} value={form.generalNote} onChange={(e) => set("generalNote", e.target.value)} /></label>
              </div>
            </section>

            <section className="portalSection">
              <div className="sectionTitle"><b>4</b><div><strong>Veli Portalı</strong><small>Veli giriş hesabı ve öğrenci bağlantısı</small></div></div>
              {portal ? (
                <div className="portalConnected">
                  <div className="portalStatusRow">
                    <div><span>BAĞLI VELİ HESABI</span><strong>{portal.fullName}</strong><small>{portal.email || portal.phone || "İletişim bilgisi yok"} · {portal.relationship}</small></div>
                    <em className={portal.isActive ? "active" : "passive"}>{portal.isActive ? "AKTİF" : "PASİF"}</em>
                  </div>
                  <div className="portalActions">
                    <button type="button" className="portalToggle" disabled={portalBusy} onClick={togglePortal}>{portal.isActive ? "Portal Erişimini Pasife Al" : "Portal Erişimini Aktif Et"}</button>
                    <button type="button" className="portalUnlink" disabled={portalBusy} onClick={unlinkPortal}>Öğrenci Bağlantısını Kaldır</button>
                  </div>
                  <div className="portalPasswordPanel">
                    <div><strong>Giriş şifresini yenile</strong><small>En az 8 karakterlik yeni bir geçici şifre belirleyin.</small></div>
                    <div className="portalPasswordControls">
                      <input type="password" autoComplete="new-password" value={portalPassword} onChange={(event) => setPortalPassword(event.target.value)} placeholder="Yeni geçici şifre" />
                      <button type="button" disabled={portalBusy || portalPassword.length < 8} onClick={resetPortalPassword}>{portalBusy ? "İşleniyor…" : "Şifreyi Yenile"}</button>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <div className="portalInfo"><strong>Veli hesabı bağlı değil</strong><p>E-posta/telefon sistemde mevcut bir veli hesabıyla eşleşirse o hesap bağlanır. Eşleşme yoksa geçici şifreyle yeni veli hesabı oluşturulur.</p></div>
                  <div className="profileGrid">
                    <label><span>Veli Adı Soyadı</span><input value={portalForm.fullName} onChange={(e) => setPortalForm({ ...portalForm, fullName: e.target.value })} /></label>
                    <label><span>Yakınlık</span><input value={portalForm.relationship} onChange={(e) => setPortalForm({ ...portalForm, relationship: e.target.value })} placeholder="Anne, Baba, Vasi..." /></label>
                    <label><span>Portal E-postası</span><input type="email" value={portalForm.email} onChange={(e) => setPortalForm({ ...portalForm, email: e.target.value })} /></label>
                    <label><span>Portal Telefonu</span><input value={portalForm.phone} onChange={(e) => setPortalForm({ ...portalForm, phone: e.target.value })} /></label>
                    <label className="full"><span>Geçici Şifre</span><input type="password" value={portalForm.temporaryPassword} onChange={(e) => setPortalForm({ ...portalForm, temporaryPassword: e.target.value })} placeholder="Yeni hesap oluşturulacaksa en az 8 karakter" /></label>
                  </div>
                  <button type="button" className="portalCreate" disabled={portalBusy} onClick={createOrLinkPortal}>{portalBusy ? "İşleniyor…" : "Veli Hesabı Oluştur / Bağla"}</button>
                </>
              )}
            </section>

            {message && <div className="profileCenterMessage">{message}</div>}
          </div>
        )}

        <footer>
          <button type="button" className="ghost" onClick={() => setOpen(false)}>Kapat</button>
          <button type="button" className="save" disabled={loading || saving} onClick={save}>{saving ? "Kaydediliyor…" : "✓ Öğrenci / Veli Bilgilerini Kaydet"}</button>
        </footer>
      </aside>

      <style jsx>{`
        .profileCenterOverlay{position:fixed;inset:0;z-index:1500;display:flex;justify-content:flex-end;background:rgba(4,20,38,.64);backdrop-filter:blur(7px)}
        .profileCenterPanel{width:min(780px,98vw);height:100%;display:flex;flex-direction:column;background:#f5f8fc;box-shadow:-24px 0 70px rgba(0,0,0,.28)}
        header{display:flex;justify-content:space-between;gap:20px;padding:24px 26px;background:linear-gradient(135deg,#082b50,#0d5e9e);color:#fff}header span{display:block;color:#ffad32;font-size:10px;font-weight:900;letter-spacing:.12em}header h2{margin:5px 0 3px;font-size:25px}header p{margin:0;color:#dbeafd;font-size:13px}header button{width:40px;height:40px;border:1px solid rgba(255,255,255,.3);border-radius:11px;background:rgba(255,255,255,.1);color:#fff;font-size:25px;cursor:pointer}
        .profileCenterBody{flex:1;overflow-y:auto;padding:22px;display:grid;gap:16px}.profileCenterLoading{flex:1;padding:40px;text-align:center;color:#60778f}section{padding:18px;border:1px solid #dbe5ef;border-radius:17px;background:#fff;box-shadow:0 8px 24px rgba(20,55,90,.05)}
        .sectionTitle{display:flex;align-items:center;gap:11px;margin-bottom:15px}.sectionTitle>b{display:grid;place-items:center;width:30px;height:30px;border-radius:9px;background:#edf5ff;color:#0b62b3}.sectionTitle strong,.sectionTitle small{display:block}.sectionTitle strong{color:#11395f}.sectionTitle small{margin-top:2px;color:#728499}
        .profileGrid{display:grid;grid-template-columns:1fr 1fr;gap:13px}.profileGrid label{display:grid;gap:6px}.profileGrid .full{grid-column:1/-1}.profileGrid span{font-size:11px;font-weight:850;color:#4f647a}.profileGrid input,.profileGrid textarea{width:100%;box-sizing:border-box;border:1px solid #cfdbe8;border-radius:10px;padding:11px 12px;background:#fbfdff;color:#142f4a;font:inherit;outline:none}.profileGrid input:focus,.profileGrid textarea:focus{border-color:#4894d5;box-shadow:0 0 0 3px rgba(72,148,213,.12)}
        .portalSection{border-color:#cfe0f3}.portalInfo{margin-bottom:14px;padding:13px 14px;border:1px solid #d6e6f6;border-radius:12px;background:#f1f7fd}.portalInfo strong{color:#0b5797}.portalInfo p{margin:5px 0 0;color:#58718a;font-size:12px;line-height:1.5}.portalCreate{margin-top:14px;width:100%;min-height:43px;border:0;border-radius:11px;background:#0b67b2;color:#fff;font-weight:900;cursor:pointer}.portalConnected{display:grid;gap:14px}.portalStatusRow{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:15px;border:1px solid #d8e4ef;border-radius:13px;background:#fbfdff}.portalStatusRow span,.portalStatusRow strong,.portalStatusRow small{display:block}.portalStatusRow span{font-size:9px;font-weight:900;color:#6e8196;letter-spacing:.08em}.portalStatusRow strong{margin-top:4px;color:#173d62}.portalStatusRow small{margin-top:3px;color:#71849a}.portalStatusRow em{font-style:normal;font-size:10px;font-weight:900;padding:6px 9px;border-radius:999px}.portalStatusRow em.active{background:#dcfce7;color:#166534}.portalStatusRow em.passive{background:#fee2e2;color:#991b1b}.portalActions{display:flex;gap:9px;flex-wrap:wrap}.portalActions button{min-height:40px;padding:0 13px;border-radius:10px;font-weight:850;cursor:pointer}.portalToggle{border:1px solid #c8daf0;background:#eef6ff;color:#0a5da5}.portalUnlink{border:1px solid #efcaca;background:#fff3f3;color:#a52c2c}.portalPasswordPanel{display:grid;gap:11px;padding:14px;border:1px solid #cfe0f3;border-radius:13px;background:linear-gradient(135deg,#f7fbff,#edf6ff)}.portalPasswordPanel strong,.portalPasswordPanel small{display:block}.portalPasswordPanel strong{color:#123f68}.portalPasswordPanel small{margin-top:3px;color:#6c8095;font-size:12px}.portalPasswordControls{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:9px}.portalPasswordControls input{min-width:0;border:1px solid #c8d8e8;border-radius:10px;padding:11px 12px;background:#fff;color:#17334e;font:inherit;outline:none}.portalPasswordControls input:focus{border-color:#2780c6;box-shadow:0 0 0 3px rgba(39,128,198,.12)}.portalPasswordControls button{min-height:42px;border:0;border-radius:10px;padding:0 15px;background:linear-gradient(135deg,#075eaa,#0878c9);color:#fff;font-weight:900;cursor:pointer;box-shadow:0 7px 16px rgba(7,94,170,.18)}
        .profileCenterMessage{padding:12px 14px;border-radius:11px;background:#eefaf4;color:#14643f;font-weight:800}footer{display:flex;justify-content:flex-end;gap:10px;padding:16px 22px;border-top:1px solid #dbe4ee;background:#fff}footer button{min-height:43px;padding:0 17px;border-radius:11px;font-weight:850;cursor:pointer}.ghost{border:1px solid #d2dce7;background:#fff;color:#49647e}.save{border:1px solid #0a6d46;background:linear-gradient(135deg,#087443,#12a365);color:#fff;box-shadow:0 8px 18px rgba(8,116,67,.18)}button:disabled{opacity:.55;cursor:not-allowed}
        @media(max-width:640px){header{padding:19px}.profileCenterBody{padding:13px}.profileGrid{grid-template-columns:1fr}.profileGrid .full{grid-column:auto}section{padding:14px}footer{position:sticky;bottom:0;flex-direction:column-reverse}.portalStatusRow{align-items:flex-start;flex-direction:column}.portalActions,.portalPasswordControls{display:grid;grid-template-columns:1fr}.portalActions button,.portalPasswordControls button{width:100%}}
      `}</style>
    </div>
  );
}
