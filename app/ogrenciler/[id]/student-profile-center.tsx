"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getStudentProfileForCenter,
  saveStudentProfileFromCenter,
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
  const [message, setMessage] = useState("");
  const [form, setForm] = useState<FormState>(emptyForm);

  const studentId = useMemo(() => {
    if (typeof window === "undefined") return "";
    const match = window.location.pathname.match(/\/ogrenciler\/([^/]+)/);
    return match?.[1] || "";
  }, []);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const button = (event.target as Element | null)?.closest<HTMLButtonElement>(
        ".fileCommandActions button",
      );
      if (!button) return;
      const text = button.textContent?.replace(/\s+/g, " ").trim() || "";
      if (!text.includes("Bilgileri Düzenle")) return;
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
    if (response.ok) {
      router.refresh();
      window.setTimeout(() => setOpen(false), 700);
    }
  }

  if (!open) return null;

  return (
    <div className="profileCenterOverlay" onClick={() => setOpen(false)}>
      <aside className="profileCenterPanel" onClick={(event) => event.stopPropagation()}>
        <header>
          <div>
            <span>DİJİTAL KURSİYER DOSYASI</span>
            <h2>Öğrenci / Veli Bilgi Merkezi</h2>
            <p>Öğrenci, veli ve acil durum iletişim bilgilerini tek yerden yönetin.</p>
          </div>
          <button type="button" onClick={() => setOpen(false)} aria-label="Kapat">×</button>
        </header>

        {loading ? (
          <div className="profileCenterLoading">Bilgiler yükleniyor…</div>
        ) : (
          <div className="profileCenterBody">
            <section>
              <div className="sectionTitle">
                <b>1</b>
                <div><strong>Öğrenci Bilgileri</strong><small>Kimlik ve doğrudan iletişim bilgileri</small></div>
              </div>
              <div className="profileGrid">
                <label><span>Ad</span><input value={form.firstName} onChange={(e) => set("firstName", e.target.value)} /></label>
                <label><span>Soyad</span><input value={form.lastName} onChange={(e) => set("lastName", e.target.value)} /></label>
                <label><span>Doğum Tarihi</span><input type="date" value={form.birthDate} onChange={(e) => set("birthDate", e.target.value)} /></label>
                <label><span>Öğrenci Telefonu</span><input value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="05xx xxx xx xx" /></label>
                <label className="full"><span>Öğrenci E-postası</span><input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} /></label>
              </div>
            </section>

            <section>
              <div className="sectionTitle">
                <b>2</b>
                <div><strong>Veli Bilgileri</strong><small>İletişim, ödeme ve bilgilendirme için ana veli kaydı</small></div>
              </div>
              <div className="profileGrid">
                <label><span>Veli Adı Soyadı</span><input value={form.guardianName} onChange={(e) => set("guardianName", e.target.value)} /></label>
                <label><span>Veli Telefonu</span><input value={form.guardianPhone} onChange={(e) => set("guardianPhone", e.target.value)} placeholder="05xx xxx xx xx" /></label>
                <label className="full"><span>Veli E-postası</span><input type="email" value={form.guardianEmail} onChange={(e) => set("guardianEmail", e.target.value)} /></label>
              </div>
            </section>

            <section>
              <div className="sectionTitle">
                <b>3</b>
                <div><strong>Acil Durum ve Yönetim Notu</strong><small>Gerektiğinde hızlı erişilecek kişi ve kurum içi not</small></div>
              </div>
              <div className="profileGrid">
                <label><span>Acil Durum Kişisi</span><input value={form.emergencyContactName} onChange={(e) => set("emergencyContactName", e.target.value)} /></label>
                <label><span>Acil Durum Telefonu</span><input value={form.emergencyContactPhone} onChange={(e) => set("emergencyContactPhone", e.target.value)} /></label>
                <label className="full"><span>Genel Yönetim Notu</span><textarea rows={4} value={form.generalNote} onChange={(e) => set("generalNote", e.target.value)} /></label>
              </div>
            </section>

            <div className="guardianAccountNote">
              <strong>Veli hesabı ayrı yönetilecek</strong>
              <p>Bu panel veli iletişim bilgilerini günceller. Veli portalına giriş hesabı oluşturma veya mevcut hesabı bağlama işlemini ayrı “Veli Hesabı” adımı olarak ekleyeceğiz.</p>
            </div>

            {message && <div className="profileCenterMessage">{message}</div>}
          </div>
        )}

        <footer>
          <button type="button" className="ghost" onClick={() => setOpen(false)}>Vazgeç</button>
          <button type="button" className="save" disabled={loading || saving} onClick={save}>{saving ? "Kaydediliyor…" : "✓ Bilgileri Kaydet"}</button>
        </footer>
      </aside>

      <style jsx>{`
        .profileCenterOverlay{position:fixed;inset:0;z-index:1500;display:flex;justify-content:flex-end;background:rgba(4,20,38,.64);backdrop-filter:blur(7px)}
        .profileCenterPanel{width:min(760px,98vw);height:100%;display:flex;flex-direction:column;background:#f5f8fc;box-shadow:-24px 0 70px rgba(0,0,0,.28)}
        header{display:flex;justify-content:space-between;gap:20px;padding:24px 26px;background:linear-gradient(135deg,#082b50,#0d5e9e);color:#fff}
        header span{display:block;color:#ffad32;font-size:10px;font-weight:900;letter-spacing:.12em} header h2{margin:5px 0 3px;font-size:25px} header p{margin:0;color:#dbeafd;font-size:13px}
        header button{width:40px;height:40px;border:1px solid rgba(255,255,255,.3);border-radius:11px;background:rgba(255,255,255,.1);color:#fff;font-size:25px;cursor:pointer}
        .profileCenterBody{flex:1;overflow-y:auto;padding:22px;display:grid;gap:16px}.profileCenterLoading{flex:1;padding:40px;text-align:center;color:#60778f}
        section{padding:18px;border:1px solid #dbe5ef;border-radius:17px;background:#fff;box-shadow:0 8px 24px rgba(20,55,90,.05)}
        .sectionTitle{display:flex;align-items:center;gap:11px;margin-bottom:15px}.sectionTitle>b{display:grid;place-items:center;width:30px;height:30px;border-radius:9px;background:#edf5ff;color:#0b62b3}.sectionTitle strong,.sectionTitle small{display:block}.sectionTitle strong{color:#11395f}.sectionTitle small{margin-top:2px;color:#728499}
        .profileGrid{display:grid;grid-template-columns:1fr 1fr;gap:13px}.profileGrid label{display:grid;gap:6px}.profileGrid .full{grid-column:1/-1}.profileGrid span{font-size:11px;font-weight:850;color:#4f647a}.profileGrid input,.profileGrid textarea{width:100%;box-sizing:border-box;border:1px solid #cfdbe8;border-radius:10px;padding:11px 12px;background:#fbfdff;color:#142f4a;font:inherit;outline:none}.profileGrid input:focus,.profileGrid textarea:focus{border-color:#4894d5;box-shadow:0 0 0 3px rgba(72,148,213,.12)}
        .guardianAccountNote{padding:15px 17px;border:1px solid #cfe2f5;border-radius:14px;background:#eef7ff;color:#315777}.guardianAccountNote strong{display:block;color:#0b5797}.guardianAccountNote p{margin:5px 0 0;font-size:12px;line-height:1.5}
        .profileCenterMessage{padding:12px 14px;border-radius:11px;background:#eefaf4;color:#14643f;font-weight:800}
        footer{display:flex;justify-content:flex-end;gap:10px;padding:16px 22px;border-top:1px solid #dbe4ee;background:#fff}footer button{min-height:43px;padding:0 17px;border-radius:11px;font-weight:850;cursor:pointer}.ghost{border:1px solid #d2dce7;background:#fff;color:#49647e}.save{border:1px solid #0a6d46;background:linear-gradient(135deg,#087443,#12a365);color:#fff;box-shadow:0 8px 18px rgba(8,116,67,.18)}footer button:disabled{opacity:.55;cursor:not-allowed}
        @media(max-width:640px){header{padding:19px}.profileCenterBody{padding:13px}.profileGrid{grid-template-columns:1fr}.profileGrid .full{grid-column:auto}section{padding:14px}footer{position:sticky;bottom:0}}
      `}</style>
    </div>
  );
}
