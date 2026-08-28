"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  archivePreRegistration,
  deactivatePreRegistration,
  updatePreRegistration,
} from "./actions";

type Student = {
  id: string;
  student_number: string | null;
  first_name: string;
  last_name: string;
  birth_date: string | null;
  phone: string | null;
  guardian_name: string | null;
  guardian_phone: string | null;
  preferred_days: string | null;
  preferred_time: string | null;
  swimming_level: string | null;
  registration_source: string | null;
  registration_note: string | null;
  created_at: string;
  branch_id: string | null;
  preferred_group_id: string | null;
  preferred_package_id: string | null;
  status: string;
};

type Branch = { id: string; name: string };

type Group = {
  id: string;
  name: string;
  branch_id: string | null;
  course_type: string | null;
  is_active: boolean | null;
};

type Package = {
  id: string;
  name: string;
  lesson_count: number | null;
  price: number | null;
  is_active: boolean | null;
  course_type: string | null;
};

type Consent = {
  student_id: string;
  registration_for: string | null;
  health_declaration: boolean | null;
  health_note: string | null;
  rules_accepted: boolean | null;
  whatsapp_permission: boolean | null;
  contact_request: string | null;
  rules_version: string | null;
  form_version: string | null;
  accepted_at: string | null;
  ip_address: string | null;
  user_agent: string | null;
  form_snapshot: unknown;
};

type Activity = {
  student_id: string;
  activity_type: string | null;
  title: string | null;
  description: string | null;
  new_value: unknown;
  source_type: string | null;
  performed_at: string | null;
};

type DetailTab = "current" | "original" | "edit" | "history";
type MainTab = "pending" | "archive";

function fmtDate(value: string | null | undefined) {
  if (!value) return "—";
  try {
    return new Intl.DateTimeFormat("tr-TR", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function fmtBirthDate(value: string | null | undefined) {
  if (!value) return "Belirtilmedi";
  try {
    return new Intl.DateTimeFormat("tr-TR", {
      dateStyle: "medium",
    }).format(new Date(`${value}T12:00:00`));
  } catch {
    return value;
  }
}

function yesNo(value: boolean | null | undefined) {
  return value ? "Evet ✓" : "Hayır";
}

function contactLabel(value: string | null | undefined) {
  switch (value) {
    case "call_me":
      return "Beni arayın";
    case "whatsapp_info":
      return "WhatsApp üzerinden bilgi";
    case "ready_to_start":
      return "Kayıt sonrası başlamak istiyor";
    case "need_information":
      return "Detaylı bilgi istiyor";
    default:
      return value || "Belirtilmedi";
  }
}

function getSnapshot(consent?: Consent | null) {
  if (!consent?.form_snapshot || typeof consent.form_snapshot !== "object") {
    return null;
  }
  return consent.form_snapshot as Record<string, any>;
}

function deviceSummary(userAgent: string | null | undefined) {
  if (!userAgent) return "Bilinmiyor";

  const ua = userAgent.toLowerCase();
  const device = ua.includes("iphone")
    ? "iPhone"
    : ua.includes("ipad")
    ? "iPad"
    : ua.includes("android")
    ? "Android cihaz"
    : ua.includes("macintosh")
    ? "Mac"
    : ua.includes("windows")
    ? "Windows bilgisayar"
    : "Cihaz";

  const browser = ua.includes("edg/")
    ? "Edge"
    : ua.includes("chrome/")
    ? "Chrome"
    : ua.includes("safari/")
    ? "Safari"
    : ua.includes("firefox/")
    ? "Firefox"
    : "Tarayıcı";

  return `${device} · ${browser}`;
}

function SubmitButton({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      className={className}
      disabled={pending}
      aria-disabled={pending}
    >
      {pending ? "İşleniyor…" : children}
    </button>
  );
}

export default function PreRegistrationCenter({
  students,
  branches,
  groups,
  packages,
  consents,
  activities,
  initialSelectedId,
}: {
  students: Student[];
  branches: Branch[];
  groups: Group[];
  packages: Package[];
  consents: Consent[];
  activities: Activity[];
  initialSelectedId: string | null;
}) {
  const [mainTab, setMainTab] = useState<MainTab>("pending");
  const [detailTab, setDetailTab] = useState<DetailTab>("current");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(
    initialSelectedId &&
      students.some((student) => student.id === initialSelectedId)
      ? initialSelectedId
      : null
  );

  const selected =
    students.find((student) => student.id === selectedId) || null;

  const [editBranchId, setEditBranchId] = useState(
    selected?.branch_id || ""
  );
  const [editGroupId, setEditGroupId] = useState(
    selected?.preferred_group_id || ""
  );
  const [editPackageId, setEditPackageId] = useState(
    selected?.preferred_package_id || ""
  );

  const branchMap = useMemo(
    () => new Map(branches.map((item) => [item.id, item.name])),
    [branches]
  );

  const groupMap = useMemo(
    () => new Map(groups.map((item) => [item.id, item.name])),
    [groups]
  );

  const packageMap = useMemo(
    () => new Map(packages.map((item) => [item.id, item.name])),
    [packages]
  );

  const consentByStudent = useMemo(() => {
    const map = new Map<string, Consent>();
    for (const consent of consents) {
      if (!map.has(consent.student_id)) map.set(consent.student_id, consent);
    }
    return map;
  }, [consents]);

  const filteredStudents = useMemo(() => {
    const q = search.trim().toLocaleLowerCase("tr-TR");
    if (!q) return students;

    return students.filter((student) => {
      const consent = consentByStudent.get(student.id);
      const haystack = [
        student.student_number,
        student.first_name,
        student.last_name,
        student.phone,
        student.guardian_name,
        student.guardian_phone,
        student.branch_id ? branchMap.get(student.branch_id) : "",
        student.preferred_group_id
          ? groupMap.get(student.preferred_group_id)
          : "",
        student.preferred_package_id
          ? packageMap.get(student.preferred_package_id)
          : "",
        consent?.health_note,
      ]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("tr-TR");

      return haystack.includes(q);
    });
  }, [
    students,
    search,
    branchMap,
    groupMap,
    packageMap,
    consentByStudent,
  ]);

  const selectedConsent = selected
    ? consentByStudent.get(selected.id) || null
    : null;

  const selectedSnapshot = getSnapshot(selectedConsent);

  const selectedActivities = useMemo(
    () =>
      selected
        ? activities.filter((activity) => activity.student_id === selected.id)
        : [],
    [activities, selected]
  );

  const selectedEditGroup =
    groups.find((group) => group.id === editGroupId) || null;

  const editGroups = groups.filter((group) => {
    const isCurrent = group.id === selected?.preferred_group_id;
    const branchMatches = editBranchId ? group.branch_id === editBranchId : true;
    return branchMatches && (group.is_active !== false || isCurrent);
  });

  const editPackages = packages.filter((pack) => {
    const isCurrent = pack.id === selected?.preferred_package_id;
    const activeOk = pack.is_active !== false || isCurrent;
    const courseTypeOk =
      !selectedEditGroup?.course_type ||
      !pack.course_type ||
      pack.course_type === selectedEditGroup.course_type;
    return activeOk && courseTypeOk;
  });

  function openStudent(id: string) {
    const student = students.find((item) => item.id === id);
    setSelectedId(id);
    setEditBranchId(student?.branch_id || "");
    setEditGroupId(student?.preferred_group_id || "");
    setEditPackageId(student?.preferred_package_id || "");
    setDetailTab("current");

    window.setTimeout(() => {
      document
        .getElementById("pre-registration-detail")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  }

  function openEdit() {
    if (!selected) return;
    setEditBranchId(selected.branch_id || "");
    setEditGroupId(selected.preferred_group_id || "");
    setEditPackageId(selected.preferred_package_id || "");
    setDetailTab("edit");
  }

  return (
    <section className="preRegistrationCenter">
      <div className="preRegistrationTabs" role="tablist">
        <button
          type="button"
          className={mainTab === "pending" ? "active" : ""}
          onClick={() => setMainTab("pending")}
        >
          Bekleyen Ön Kayıtlar
          <span>{students.length}</span>
        </button>

        <button
          type="button"
          className={mainTab === "archive" ? "active" : ""}
          onClick={() => setMainTab("archive")}
        >
          Form Arşivi
          <span>{consents.length}</span>
        </button>
      </div>

      {mainTab === "pending" ? (
        <>
          <div className="preRegistrationToolbar">
            <div>
              <p>BAŞVURU LİSTESİ</p>
              <h2>Bekleyen Ön Kayıtlar</h2>
              <span>
                Öğrenci, veli, telefon, şube, grup, paket veya sağlık notunda arama yapabilirsiniz.
              </span>
            </div>

            <div className="preSearchWrap">
              <span>⌕</span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                aria-label="Ön kayıt ara"
                placeholder="Öğrenci, veli, telefon veya sağlık notu ara..."
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  aria-label="Aramayı temizle"
                >
                  Temizle
                </button>
              )}
            </div>
          </div>

          <div className="preRegistrationGrid">
            {filteredStudents.map((student) => {
              const consent = consentByStudent.get(student.id);
              const branch = student.branch_id
                ? branchMap.get(student.branch_id) || "Şube bulunamadı"
                : "Şube seçilmedi";
              const group = student.preferred_group_id
                ? groupMap.get(student.preferred_group_id) || "Grup bulunamadı"
                : "Grup seçilmedi";
              const pack = student.preferred_package_id
                ? packageMap.get(student.preferred_package_id) ||
                  "Paket bulunamadı"
                : "Paket seçilmedi";
              const hasHealthNote = Boolean(consent?.health_note?.trim());

              return (
                <button
                  type="button"
                  key={student.id}
                  className={`preRegistrationCard ${
                    selectedId === student.id ? "selected" : ""
                  }`}
                  onClick={() => openStudent(student.id)}
                >
                  <div className="preCardTop">
                    <div>
                      <span className="preCardEyebrow">
                        {student.student_number || "ÖN KAYIT"}
                      </span>
                      <h3>
                        {student.first_name} {student.last_name}
                      </h3>
                    </div>

                    <div className="preCardBadges">
                      {hasHealthNote && (
                        <span className="preHealthBadge">Sağlık Notu</span>
                      )}
                      <span className="preStatus">Bekliyor</span>
                    </div>
                  </div>

                  <div className="preCardContact">
                    <strong>
                      {student.guardian_name || "Yetişkin kayıt"}
                    </strong>
                    <span>
                      {student.guardian_phone ||
                        student.phone ||
                        "Telefon bulunmuyor"}
                    </span>
                  </div>

                  <div className="preCardRoute">
                    <div>
                      <span>Şube</span>
                      <strong>{branch}</strong>
                    </div>
                    <div>
                      <span>Grup</span>
                      <strong>{group}</strong>
                    </div>
                    <div>
                      <span>Paket</span>
                      <strong>{pack}</strong>
                    </div>
                  </div>

                  <div className="preCardBottom">
                    <span>
                      {fmtDate(consent?.accepted_at || student.created_at)}
                    </span>
                    <strong>Detayı Aç →</strong>
                  </div>
                </button>
              );
            })}

            {!filteredStudents.length && (
              <div className="preRegistrationEmpty">
                <strong>Bekleyen ön kayıt bulunamadı.</strong>
                <span>
                  Arama kriterini değiştirin veya yeni başvuruyu bekleyin.
                </span>
              </div>
            )}
          </div>

          {selected && (
            <article
              id="pre-registration-detail"
              className="preRegistrationDetail"
            >
              <div className="preDetailHeader">
                <div>
                  <span className="preDetailKicker">ÖN KAYIT DETAYI</span>
                  <h2>
                    {selected.first_name} {selected.last_name}
                  </h2>
                  <p>
                    {selected.student_number ||
                      "Öğrenci numarası henüz yok"}{" "}
                    ·{" "}
                    {fmtDate(
                      selectedConsent?.accepted_at || selected.created_at
                    )}
                  </p>
                </div>

                <button
                  type="button"
                  className="preCloseButton"
                  onClick={() => setSelectedId(null)}
                  aria-label="Detayı kapat"
                >
                  ×
                </button>
              </div>

              <div className="preDetailTabs">
                <button
                  type="button"
                  className={detailTab === "current" ? "active" : ""}
                  onClick={() => setDetailTab("current")}
                >
                  Güncel Bilgiler
                </button>
                <button
                  type="button"
                  className={detailTab === "original" ? "active" : ""}
                  onClick={() => setDetailTab("original")}
                >
                  Orijinal Başvuru
                </button>
                <button
                  type="button"
                  className={detailTab === "edit" ? "active" : ""}
                  onClick={openEdit}
                >
                  Düzenle
                </button>
                <button
                  type="button"
                  className={detailTab === "history" ? "active" : ""}
                  onClick={() => setDetailTab("history")}
                >
                  İşlem Geçmişi
                  <span>{selectedActivities.length}</span>
                </button>
              </div>

              {detailTab === "current" && (
                <div className="preDetailBody">
                  <div className="preInfoGrid">
                    <Info label="Öğrenci / Katılımcı">
                      {selected.first_name} {selected.last_name}
                    </Info>
                    <Info label="Doğum Tarihi">
                      {fmtBirthDate(selected.birth_date)}
                    </Info>
                    <Info label="Telefon">
                      {selected.phone || "Belirtilmedi"}
                    </Info>
                    <Info label="Veli">
                      {selected.guardian_name || "Yetişkin kayıt"}
                    </Info>
                    <Info label="Veli Telefonu">
                      {selected.guardian_phone || "Belirtilmedi"}
                    </Info>
                    <Info label="Şube">
                      {selected.branch_id
                        ? branchMap.get(selected.branch_id) || "—"
                        : "Belirtilmedi"}
                    </Info>
                    <Info label="Grup">
                      {selected.preferred_group_id
                        ? groupMap.get(selected.preferred_group_id) || "—"
                        : "Belirtilmedi"}
                    </Info>
                    <Info label="Paket">
                      {selected.preferred_package_id
                        ? packageMap.get(selected.preferred_package_id) || "—"
                        : "Belirtilmedi"}
                    </Info>
                    <Info label="Seviye">
                      {selected.swimming_level || "Belirtilmedi"}
                    </Info>
                    <Info label="Tercih Günleri">
                      {selected.preferred_days || "Belirtilmedi"}
                    </Info>
                    <Info label="Tercih Saati">
                      {selected.preferred_time || "Belirtilmedi"}
                    </Info>
                    <Info label="İletişim Tercihi">
                      {contactLabel(selectedConsent?.contact_request)}
                    </Info>
                  </div>

                  <HealthNotice
                    declaration={selectedConsent?.health_declaration}
                    note={selectedConsent?.health_note}
                  />

                  <div className="preNoteBox">
                    <span>Kayıt Notu</span>
                    <p>
                      {selected.registration_note || "Not bulunmuyor."}
                    </p>
                  </div>

                  <div className="preConsentStrip">
                    <div>
                      <span>Kurallar</span>
                      <strong>
                        {yesNo(selectedConsent?.rules_accepted)}
                      </strong>
                    </div>
                    <div>
                      <span>Sağlık Beyanı</span>
                      <strong>
                        {yesNo(selectedConsent?.health_declaration)}
                      </strong>
                    </div>
                    <div>
                      <span>WhatsApp</span>
                      <strong>
                        {yesNo(selectedConsent?.whatsapp_permission)}
                      </strong>
                    </div>
                  </div>

                  <div className="preActionFooter">
                    <div className="preDangerActions">
                      <form
                        action={deactivatePreRegistration}
                        onSubmit={(event) => {
                          if (
                            !window.confirm(
                              "Bu ön kayıt pasife alınacak. Devam etmek istiyor musunuz?"
                            )
                          ) {
                            event.preventDefault();
                          }
                        }}
                      >
                        <input
                          type="hidden"
                          name="student_id"
                          value={selected.id}
                        />
                        <SubmitButton className="warningPreAction">
                          Pasife Al
                        </SubmitButton>
                      </form>

                      <form
                        action={archivePreRegistration}
                        onSubmit={(event) => {
                          if (
                            !window.confirm(
                              "Bu ön kayıt yönetim listesinden silinecek. Elektronik form ve işlem geçmişi korunacaktır. Devam edilsin mi?"
                            )
                          ) {
                            event.preventDefault();
                          }
                        }}
                      >
                        <input
                          type="hidden"
                          name="student_id"
                          value={selected.id}
                        />
                        <SubmitButton className="dangerPreAction">
                          Sil
                        </SubmitButton>
                      </form>
                    </div>

                    <div className="prePrimaryActions">
                      <button
                        type="button"
                        className="secondaryPreAction"
                        onClick={openEdit}
                      >
                        ✎ Bilgileri Düzenle
                      </button>

                      <Link
                        className="primaryPreAction"
                        href={`/kayit-tamamlama/${selected.id}`}
                      >
                        Kayda Aktar →
                      </Link>
                    </div>
                  </div>
                </div>
              )}

              {detailTab === "original" && (
                <div className="preDetailBody">
                  <div className="preArchiveNotice">
                    <strong>Değiştirilemez Orijinal Form Kaydı</strong>
                    <span>
                      Bu bölüm başvurunun gönderildiği andaki elektronik
                      kayıttır. Sonradan yapılan düzenlemeler bu kaydı
                      değiştirmez.
                    </span>
                  </div>

                  <div className="preInfoGrid">
                    <Info label="Gönderim Tarihi">
                      {fmtDate(selectedConsent?.accepted_at)}
                    </Info>
                    <Info label="Kayıt Türü">
                      {selectedConsent?.registration_for === "adult"
                        ? "Yetişkin"
                        : "Çocuk"}
                    </Info>
                    <Info label="Kuralları Okudum / Kabul">
                      {yesNo(selectedConsent?.rules_accepted)}
                    </Info>
                    <Info label="Sağlık Beyanı">
                      {yesNo(selectedConsent?.health_declaration)}
                    </Info>
                    <Info label="WhatsApp İzni">
                      {yesNo(selectedConsent?.whatsapp_permission)}
                    </Info>
                    <Info label="İletişim Talebi">
                      {contactLabel(selectedConsent?.contact_request)}
                    </Info>
                    <Info label="Form Sürümü">
                      {selectedConsent?.form_version || "—"}
                    </Info>
                    <Info label="Kural Sürümü">
                      {selectedConsent?.rules_version || "—"}
                    </Info>
                  </div>

                  <HealthNotice
                    declaration={selectedConsent?.health_declaration}
                    note={selectedConsent?.health_note}
                    original
                  />

                  <div className="preTechnicalBox">
                    <div>
                      <span>IP Adresi</span>
                      <strong>
                        {selectedConsent?.ip_address || "Alınamadı"}
                      </strong>
                    </div>
                    <div>
                      <span>Cihaz / Tarayıcı</span>
                      <strong>
                        {deviceSummary(selectedConsent?.user_agent)}
                      </strong>
                    </div>
                    <details>
                      <summary>
                        Ham User-Agent bilgisini göster
                      </summary>
                      <code>
                        {selectedConsent?.user_agent || "Alınamadı"}
                      </code>
                    </details>
                  </div>

                  <SnapshotView snapshot={selectedSnapshot} />
                </div>
              )}

              {detailTab === "edit" && (
                <div className="preDetailBody">
                  <div className="preEditWarning">
                    Buradaki değişiklikler öğrencinin güncel ön kayıt
                    bilgilerini günceller. Orijinal form kaydı değişmez.
                    Her değişiklik işlem geçmişine otomatik kaydedilir.
                  </div>

                  <form
                    action={updatePreRegistration}
                    className="preEditForm"
                  >
                    <input
                      type="hidden"
                      name="student_id"
                      value={selected.id}
                    />

                    <div className="preEditGrid">
                      <label>
                        <span>Ad</span>
                        <input
                          name="first_name"
                          defaultValue={selected.first_name}
                          required
                        />
                      </label>

                      <label>
                        <span>Soyad</span>
                        <input
                          name="last_name"
                          defaultValue={selected.last_name}
                          required
                        />
                      </label>

                      <label>
                        <span>Doğum Tarihi</span>
                        <input
                          type="date"
                          name="birth_date"
                          defaultValue={selected.birth_date || ""}
                        />
                      </label>

                      <label>
                        <span>Telefon</span>
                        <input
                          name="phone"
                          defaultValue={selected.phone || ""}
                        />
                      </label>

                      <label>
                        <span>Veli Adı Soyadı</span>
                        <input
                          name="guardian_name"
                          defaultValue={selected.guardian_name || ""}
                        />
                      </label>

                      <label>
                        <span>Veli Telefonu</span>
                        <input
                          name="guardian_phone"
                          defaultValue={selected.guardian_phone || ""}
                        />
                      </label>

                      <label>
                        <span>Şube</span>
                        <select
                          name="branch_id"
                          value={editBranchId}
                          onChange={(event) => {
                            const value = event.target.value;
                            setEditBranchId(value);
                            setEditGroupId("");
                            setEditPackageId("");
                          }}
                        >
                          <option value="">Şube seçilmedi</option>
                          {branches.map((branch) => (
                            <option key={branch.id} value={branch.id}>
                              {branch.name}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label>
                        <span>Grup</span>
                        <select
                          name="preferred_group_id"
                          value={editGroupId}
                          onChange={(event) => {
                            setEditGroupId(event.target.value);
                            setEditPackageId("");
                          }}
                        >
                          <option value="">Grup seçilmedi</option>
                          {editGroups.map((group) => (
                            <option key={group.id} value={group.id}>
                              {group.name}
                              {group.is_active === false ? " · Pasif" : ""}
                            </option>
                          ))}
                        </select>
                        {editBranchId && !editGroups.length && (
                          <small>
                            Bu şubede seçilebilir grup bulunmuyor.
                          </small>
                        )}
                      </label>

                      <label>
                        <span>Paket</span>
                        <select
                          name="preferred_package_id"
                          value={editPackageId}
                          onChange={(event) =>
                            setEditPackageId(event.target.value)
                          }
                        >
                          <option value="">Paket seçilmedi</option>
                          {editPackages.map((pack) => (
                            <option key={pack.id} value={pack.id}>
                              {pack.name}
                              {pack.lesson_count
                                ? ` · ${pack.lesson_count} ders`
                                : ""}
                              {pack.is_active === false ? " · Pasif" : ""}
                            </option>
                          ))}
                        </select>
                        {selectedEditGroup?.course_type && (
                          <small>
                            Paketler “{selectedEditGroup.course_type}” kurs
                            türüne göre filtreleniyor.
                          </small>
                        )}
                      </label>

                      <label>
                        <span>Yüzme Seviyesi</span>
                        <input
                          name="swimming_level"
                          defaultValue={selected.swimming_level || ""}
                        />
                      </label>

                      <label>
                        <span>Tercih Günleri</span>
                        <input
                          name="preferred_days"
                          defaultValue={selected.preferred_days || ""}
                        />
                      </label>

                      <label>
                        <span>Tercih Saati</span>
                        <input
                          name="preferred_time"
                          defaultValue={selected.preferred_time || ""}
                        />
                      </label>

                      <label className="full">
                        <span>Kayıt Notu</span>
                        <textarea
                          name="registration_note"
                          rows={4}
                          defaultValue={selected.registration_note || ""}
                        />
                      </label>
                    </div>

                    <div className="preEditActions">
                      <button
                        type="button"
                        onClick={() => setDetailTab("current")}
                      >
                        Vazgeç
                      </button>
                      <SubmitButton>
                        Değişiklikleri Kaydet
                      </SubmitButton>
                    </div>
                  </form>
                </div>
              )}

              {detailTab === "history" && (
                <div className="preDetailBody">
                  <div className="preHistory">
                    {selectedActivities.map((activity, index) => (
                      <div
                        className="preHistoryItem"
                        key={`${activity.performed_at}-${index}`}
                      >
                        <div className="preHistoryDot" />
                        <div>
                          <div className="preHistoryTop">
                            <strong>
                              {activity.title || "İşlem kaydı"}
                            </strong>
                            <span>
                              {fmtDate(activity.performed_at)}
                            </span>
                          </div>
                          <p>
                            {activity.description ||
                              "Açıklama bulunmuyor."}
                          </p>
                          {activity.activity_type ===
                            "pre_registration_updated" && (
                            <ChangeDetails value={activity.new_value} />
                          )}
                        </div>
                      </div>
                    ))}

                    {!selectedActivities.length && (
                      <div className="preRegistrationEmpty">
                        <strong>Henüz işlem geçmişi yok.</strong>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </article>
          )}
        </>
      ) : (
        <FormArchive
          consents={consents}
          students={students}
          branchMap={branchMap}
          groupMap={groupMap}
          packageMap={packageMap}
        />
      )}
    </section>
  );
}

function Info({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="preInfo">
      <span>{label}</span>
      <strong>{children}</strong>
    </div>
  );
}

function HealthNotice({
  declaration,
  note,
  original = false,
}: {
  declaration: boolean | null | undefined;
  note: string | null | undefined;
  original?: boolean;
}) {
  const clean = note?.trim();
  const hasNote = Boolean(clean);

  return (
    <div
      className={`preHealthNotice ${hasNote ? "attention" : "clear"}`}
      role={hasNote ? "alert" : undefined}
    >
      <div className="preHealthIcon">
        {hasNote ? "!" : "✓"}
      </div>
      <div>
        <span>
          {original
            ? "ORİJİNAL SAĞLIK / ANTRENÖR BİLGİLENDİRMESİ"
            : "SAĞLIK / ANTRENÖR BİLGİLENDİRMESİ"}
        </span>
        <strong>
          {hasNote
            ? "Başvuruda sağlıkla ilgili açıklama var"
            : "Ek sağlık açıklaması bulunmuyor"}
        </strong>
        <p>
          {hasNote
            ? clean
            : declaration
            ? "Sağlık beyanı onaylandı; ayrıca bir sağlık notu yazılmadı."
            : "Sağlıkla ilgili ek açıklama bildirilmedi."}
        </p>
      </div>
    </div>
  );
}

function SnapshotView({
  snapshot,
}: {
  snapshot: Record<string, any> | null;
}) {
  if (!snapshot) {
    return (
      <div className="preRegistrationEmpty">
        <strong>Orijinal form snapshot kaydı bulunamadı.</strong>
      </div>
    );
  }

  return (
    <div className="preSnapshot">
      <h3>Başvurunun İlk Gönderildiği Hali</h3>
      <div className="preInfoGrid">
        <Info label="Ad Soyad">
          {snapshot.student?.first_name || "—"}{" "}
          {snapshot.student?.last_name || ""}
        </Info>
        <Info label="Telefon">
          {snapshot.student?.phone || "—"}
        </Info>
        <Info label="Veli">
          {snapshot.guardian?.full_name || "Yetişkin kayıt"}
        </Info>
        <Info label="Şube">
          {snapshot.course?.branch_name || "—"}
        </Info>
        <Info label="Grup">
          {snapshot.course?.group_name || "—"}
        </Info>
        <Info label="Paket">
          {snapshot.course?.package_name || "—"}
        </Info>
        <Info label="Tercih Günleri">
          {snapshot.course?.preferred_days || "—"}
        </Info>
        <Info label="Tercih Saati">
          {snapshot.course?.preferred_time || "—"}
        </Info>
        <Info label="Seviye">
          {snapshot.course?.swimming_level || "—"}
        </Info>
        <Info label="İletişim Talebi">
          {contactLabel(snapshot.contact_request)}
        </Info>
      </div>

      <div className="preNoteBox">
        <span>İlk Gönderilen Not</span>
        <p>{snapshot.note || "Not bulunmuyor."}</p>
      </div>
    </div>
  );
}

function ChangeDetails({ value }: { value: unknown }) {
  if (!value || typeof value !== "object") return null;

  const record = value as Record<string, any>;
  const changes = record.changes;
  if (!changes || typeof changes !== "object") return null;

  const labels: Record<string, string> = {
    first_name: "Ad",
    last_name: "Soyad",
    birth_date: "Doğum tarihi",
    phone: "Telefon",
    guardian_name: "Veli adı",
    guardian_phone: "Veli telefonu",
    branch_id: "Şube",
    preferred_group_id: "Grup",
    preferred_package_id: "Paket",
    swimming_level: "Yüzme seviyesi",
    preferred_days: "Tercih günleri",
    preferred_time: "Tercih saati",
    registration_note: "Kayıt notu",
  };

  return (
    <div className="preChangeList">
      {Object.entries(changes).map(([key, item]: [string, any]) => (
        <div key={key}>
          <strong>{labels[key] || key}</strong>
          <span>{String(item?.old ?? "—")}</span>
          <b>→</b>
          <span>{String(item?.new ?? "—")}</span>
        </div>
      ))}
    </div>
  );
}

function FormArchive({
  consents,
  students,
  branchMap,
  groupMap,
  packageMap,
}: {
  consents: Consent[];
  students: Student[];
  branchMap: Map<string, string>;
  groupMap: Map<string, string>;
  packageMap: Map<string, string>;
}) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const studentMap = useMemo(
    () => new Map(students.map((student) => [student.id, student])),
    [students]
  );

  return (
    <div className="preArchiveSection">
      <div className="preRegistrationToolbar">
        <div>
          <p>ELEKTRONİK KAYIT ARŞİVİ</p>
          <h2>Ön Kayıt Form Arşivi</h2>
          <span>
            Formun ilk gönderildiği an, sağlık notu, onaylar, IP ve cihaz
            bilgisi burada değiştirilemez kayıt olarak saklanır.
          </span>
        </div>
      </div>

      <div className="preArchiveList">
        {consents.map((consent, index) => {
          const student = studentMap.get(consent.student_id);
          const snapshot = getSnapshot(consent);

          const name = student
            ? `${student.first_name} ${student.last_name}`
            : `${snapshot?.student?.first_name || "Başvuru"} ${
                snapshot?.student?.last_name || ""
              }`;

          const isOpen = openIndex === index;
          const hasHealthNote = Boolean(consent.health_note?.trim());

          return (
            <article
              className={`preArchiveCard ${isOpen ? "open" : ""}`}
              key={`${consent.student_id}-${index}`}
            >
              <button
                type="button"
                className="preArchiveCardButton"
                onClick={() => setOpenIndex(isOpen ? null : index)}
              >
                <div>
                  <span className="preCardEyebrow">
                    {student?.student_number || "FORM KAYDI"}
                  </span>
                  <h3>{name}</h3>
                  <p>{fmtDate(consent.accepted_at)}</p>
                </div>

                <div className="preArchiveBadges">
                  {hasHealthNote && (
                    <span className="health">Sağlık Notu !</span>
                  )}
                  <span className={consent.rules_accepted ? "ok" : "no"}>
                    Kurallar {consent.rules_accepted ? "✓" : "—"}
                  </span>
                  <span
                    className={
                      consent.whatsapp_permission ? "ok" : "no"
                    }
                  >
                    WhatsApp {consent.whatsapp_permission ? "✓" : "—"}
                  </span>
                  <b>{isOpen ? "Kapat ↑" : "Formu Gör ↓"}</b>
                </div>
              </button>

              {isOpen && (
                <div className="preArchiveExpanded">
                  <div className="preInfoGrid">
                    <Info label="Gönderim">
                      {fmtDate(consent.accepted_at)}
                    </Info>
                    <Info label="IP Adresi">
                      {consent.ip_address || "Alınamadı"}
                    </Info>
                    <Info label="Cihaz">
                      {deviceSummary(consent.user_agent)}
                    </Info>
                    <Info label="Form Sürümü">
                      {consent.form_version || "—"}
                    </Info>
                    <Info label="Kurallar Sürümü">
                      {consent.rules_version || "—"}
                    </Info>
                    <Info label="Kuralları Kabul">
                      {yesNo(consent.rules_accepted)}
                    </Info>
                    <Info label="Sağlık Beyanı">
                      {yesNo(consent.health_declaration)}
                    </Info>
                    <Info label="WhatsApp İzni">
                      {yesNo(consent.whatsapp_permission)}
                    </Info>
                  </div>

                  <HealthNotice
                    declaration={consent.health_declaration}
                    note={consent.health_note}
                    original
                  />

                  <SnapshotView snapshot={snapshot} />

                  {student && (
                    <div className="preActionFooter">
                      <button
                        type="button"
                        className="secondaryPreAction"
                        onClick={() => {
                          window.location.href = `/on-kayitlar?student=${encodeURIComponent(
                            student.id
                          )}`;
                        }}
                      >
                        Güncel Ön Kaydı Aç
                      </button>

                      <Link
                        className="primaryPreAction"
                        href={`/kayit-tamamlama/${student.id}`}
                      >
                        Kayda Aktar →
                      </Link>
                    </div>
                  )}
                </div>
              )}
            </article>
          );
        })}

        {!consents.length && (
          <div className="preRegistrationEmpty">
            <strong>Henüz arşiv kaydı bulunmuyor.</strong>
          </div>
        )}
      </div>
    </div>
  );
}
