"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { bulkTransferStudents } from "../bulk-actions";
import { updateStudentOperationalDetails } from "./actions";

type BranchOption = {
  id: string;
  name: string;
};

type GroupOption = {
  id: string;
  branch_id: string | null;
  name: string;
  course_type?: string | null;
};

type ScheduleOption = {
  id: string;
  group_id: string | null;
  weekday: number | null;
  start_time: string | null;
  end_time: string | null;
};

type Props = {
  student: {
    id: string;
    first_name?: string | null;
    last_name?: string | null;
    phone?: string | null;
    guardian_phone?: string | null;
    email?: string | null;
    guardian_name?: string | null;
    guardian_email?: string | null;
    general_note?: string | null;
    status?: string | null;
    branch_id?: string | null;
    branch_name?: string | null;
    group_id?: string | null;
    group_name?: string | null;
  };
  branches: BranchOption[];
  groups: GroupOption[];
  schedules: ScheduleOption[];
};

const DAYS: Record<number, string> = {
  1: "Pazartesi",
  2: "Salı",
  3: "Çarşamba",
  4: "Perşembe",
  5: "Cuma",
  6: "Cumartesi",
  7: "Pazar",
};

function shortTime(value?: string | null) {
  return value ? value.slice(0, 5) : "";
}

function normalizePhone(value?: string | null) {
  let digits = (value || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("0")) digits = `90${digits.slice(1)}`;
  if (digits.length === 10) digits = `90${digits}`;
  return digits;
}

export default function StudentFileOperations({
  student,
  branches,
  groups,
  schedules,
}: Props) {
  const router = useRouter();

  const [panel, setPanel] = useState<
    "edit" | "transfer" | "compensation" | "message" | "delete" | null
  >(null);

  const [targetBranchId, setTargetBranchId] = useState(
    student.branch_id || ""
  );
  const [targetGroupId, setTargetGroupId] = useState(
    student.group_id || ""
  );
  const [targetScheduleIds, setTargetScheduleIds] = useState<string[]>([]);
  const [effectiveDate, setEffectiveDate] = useState(
    new Date().toISOString().slice(0, 10)
  );

  const [lessonCount, setLessonCount] = useState("1");
  const [reason, setReason] = useState("");
  const [description, setDescription] = useState("");

  const [message, setMessage] = useState("");
  const [result, setResult] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [deleteReason, setDeleteReason] = useState("");

  const [editPhone, setEditPhone] = useState(student.phone || "");
  const [editEmail, setEditEmail] = useState(student.email || "");
  const [editGuardianName, setEditGuardianName] = useState(
    student.guardian_name || ""
  );
  const [editGuardianPhone, setEditGuardianPhone] = useState(
    student.guardian_phone || ""
  );
  const [editGuardianEmail, setEditGuardianEmail] = useState(
    student.guardian_email || ""
  );
  const [editGeneralNote, setEditGeneralNote] = useState(
    student.general_note || ""
  );
  const [editProgramToo, setEditProgramToo] = useState(false);
  const [workingAction, setWorkingAction] = useState<
    "edit" | "transfer" | "compensation" | "delete" | null
  >(null);

  const targetGroups = useMemo(
    () =>
      groups.filter(
        (group) =>
          !targetBranchId || group.branch_id === targetBranchId
      ),
    [groups, targetBranchId]
  );

  const targetSchedules = useMemo(
    () =>
      schedules
        .filter((schedule) => schedule.group_id === targetGroupId)
        .sort((a, b) => {
          const day =
            Number(a.weekday || 0) - Number(b.weekday || 0);
          if (day !== 0) return day;
          return String(a.start_time || "").localeCompare(
            String(b.start_time || "")
          );
        }),
    [schedules, targetGroupId]
  );

  const fullName =
    `${student.first_name || ""} ${student.last_name || ""}`.trim();

  const phone =
    normalizePhone(student.guardian_phone) ||
    normalizePhone(student.phone);

  function jumpTo(id: string) {
    document.getElementById(id)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  function openMessage() {
    setResult("");
    setMessage(
      `*SPRİNT YÜZME OKULU*\n\nSayın Velimiz,\n\n` +
        `${fullName} isimli öğrencimizin aktif kurs kaydıyla ilgili bilgilendirme için iletişime geçiyoruz.\n\n` +
        `Detaylı bilgi ve program desteği için bize ulaşabilirsiniz.\n\n` +
        `*Sprint Yüzme Okulu Yönetimi*`
    );
    setPanel("message");
  }

  async function submitProfessionalEdit() {
    try {
      setSubmitting(true);
      setWorkingAction("edit");
      setResult("");

      const profileResult = await updateStudentOperationalDetails({
        studentId: student.id,
        phone: editPhone,
        email: editEmail,
        guardianName: editGuardianName,
        guardianPhone: editGuardianPhone,
        guardianEmail: editGuardianEmail,
        generalNote: editGeneralNote,
      });

      if (!profileResult.ok) {
        setResult(profileResult.message);
        return;
      }

      if (editProgramToo) {
        if (
          !targetBranchId ||
          !targetGroupId ||
          !targetScheduleIds.length
        ) {
          setResult(
            "İletişim bilgileri kaydedildi. Program değişikliği için şube, grup ve en az bir ders seansı seçilmelidir."
          );
          return;
        }

        const transferResult = await bulkTransferStudents({
          studentIds: [student.id],
          targetBranchId,
          targetGroupId,
          targetScheduleIds,
          effectiveDate,
          prepareMessages: true,
          updateAttendancePlans: true,
          logHistory: true,
        });

        setResult(
          transferResult.transferredCount
            ? "✓ Bilgiler ve kurs programı başarıyla güncellendi."
            : transferResult.message
        );
      } else {
        setResult("✓ Kursiyer bilgileri başarıyla güncellendi.");
      }

      router.refresh();
    } catch (error) {
      console.error(error);
      setResult("Düzenleme işlemi sırasında hata oluştu.");
    } finally {
      setSubmitting(false);
      setWorkingAction(null);
    }
  }

  async function submitTransfer() {
    if (
      !targetBranchId ||
      !targetGroupId ||
      !targetScheduleIds.length
    ) {
      setResult("Yeni şube, grup ve ders seansı seçilmelidir.");
      return;
    }

    try {
      setSubmitting(true);
      setWorkingAction("transfer");
      setResult("");

      const response = await bulkTransferStudents({
        studentIds: [student.id],
        targetBranchId,
        targetGroupId,
        targetScheduleIds,
        effectiveDate,
        prepareMessages: true,
        updateAttendancePlans: true,
        logHistory: true,
      });

      setResult(response.message);

      if (response.transferredCount) {
        router.refresh();
      }
    } catch (error) {
      console.error(error);
      setResult("Aktarım işlemi sırasında hata oluştu.");
    } finally {
      setSubmitting(false);
      setWorkingAction(null);
    }
  }

  async function submitCompensation() {
    const count = Number(lessonCount);

    if (!Number.isInteger(count) || count < 1 || count > 20) {
      setResult("Telafi ders sayısı 1-20 arasında olmalıdır.");
      return;
    }

    if (!reason.trim()) {
      setResult("Telafi gerekçesi yazılmalıdır.");
      return;
    }

    try {
      setSubmitting(true);
      setWorkingAction("compensation");
      setResult("");

      const response = await fetch("/api/lesson-adjustments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          request_type: "individual_compensation",
          student_id: student.id,
          branch_id: student.branch_id || null,
          group_id: null,
          lesson_count: count,
          reason: reason.trim(),
          description: description.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        setResult(
          data.error ||
            data.details ||
            "Telafi talebi oluşturulamadı."
        );
        return;
      }

      setResult(
        data.message ||
          "Bireysel telafi talebi yönetici onayına gönderildi."
      );

      router.refresh();
    } catch (error) {
      console.error(error);
      setResult("Telafi işlemi sırasında bağlantı hatası oluştu.");
    } finally {
      setSubmitting(false);
      setWorkingAction(null);
    }
  }

  async function submitDeleteRequest() {
    if (deleteReason.trim().length < 5) {
      setResult("Silme / arşivleme gerekçesi yazılmalıdır.");
      return;
    }

    try {
      setSubmitting(true);
      setWorkingAction("delete");
      setResult("");

      const response = await fetch("/api/student-status-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          request_type: "delete",
          student_id: student.id,
          branch_id: student.branch_id || null,
          group_id: null,
          reason: deleteReason.trim(),
          description:
            "Dijital Kursiyer Dosyası üzerinden yönetici onayına gönderildi.",
          old_status: student.status || "active",
          new_status: "deleted",
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        setResult(
          data.error ||
            data.details ||
            "Silme talebi oluşturulamadı."
        );
        return;
      }

      setResult(
        data.message ||
          "Silme talebi yönetici onayına gönderildi."
      );
    } catch (error) {
      console.error(error);
      setResult("Silme talebi sırasında bağlantı hatası oluştu.");
    } finally {
      setSubmitting(false);
      setWorkingAction(null);
    }
  }

  function openWhatsApp() {
    if (!phone || !message.trim()) return;
    window.open(
      `https://wa.me/${phone}?text=${encodeURIComponent(message)}`,
      "_blank",
      "noopener,noreferrer"
    );
  }

  return (
    <>
      <section className="fileCommandBar">
        <div className="fileCommandIntro">
          <span>KURSİYER İŞLEM MERKEZİ</span>
          <strong>Dosya üzerinde hızlı işlem</strong>
          <small>
            Bilgileri düzenleyin, programı aktarın, telafi oluşturun,
            mesaj gönderin veya yönetici onaylı arşivleme başlatın.
          </small>
        </div>

        <div className="fileCommandActions">
          <button
            type="button"
            className="editMain"
            onClick={() => {
              setResult("");
              setPanel("edit");
            }}
          >
            ✎ Profesyonel Düzenle
          </button>

          <button
            type="button"
            className="blue"
            onClick={() => {
              setResult("");
              setPanel("transfer");
            }}
          >
            ⇄ Grup / Şube Değiştir
          </button>

          <button
            type="button"
            className="green"
            onClick={() => {
              setResult("");
              setPanel("compensation");
            }}
          >
            + Bireysel Telafi
          </button>

          <button type="button" className="orange" onClick={openMessage}>
            ✉ Mesaj / WhatsApp
          </button>

          <button
            type="button"
            onClick={() => router.push(`/odemeler?student=${student.id}`)}
          >
            ₺ Ödeme Geçmişi
          </button>

          <button
            type="button"
            className="danger"
            onClick={() => {
              setResult("");
              setPanel("delete");
            }}
          >
            ⛔ Sil / Arşivle
          </button>
        </div>
      </section>

      {panel && (
        <div
          className="fileOpsOverlay"
          onClick={() => setPanel(null)}
        >
          <aside
            className="fileOpsPanel"
            onClick={(event) => event.stopPropagation()}
          >
            <header>
              <div>
                <span>
                  {panel === "edit"
                    ? "PROFESYONEL KURSİYER DÜZENLEME"
                    : panel === "transfer"
                    ? "PROGRAM DÜZENLEME"
                    : panel === "compensation"
                    ? "BİREYSEL TELAFİ"
                    : panel === "message"
                    ? "İLETİŞİM MERKEZİ"
                    : "YÖNETİCİ ONAYLI ARŞİVLEME"}
                </span>
                <h3>{fullName}</h3>
              </div>
              <button type="button" onClick={() => setPanel(null)}>
                ×
              </button>
            </header>

            <div className="fileOpsBody">
              {panel === "edit" && (
                <>
                  <div className="proInfo premiumEditInfo">
                    <strong>Tek ekrandan kursiyer düzenleme</strong>
                    <p>
                      İletişim ve veli bilgilerini güncelleyin. İsterseniz aynı
                      işlemde şube, grup, gün ve saat programını da değiştirin.
                      Program değişikliğinde geçmiş yoklamalar korunur.
                    </p>
                  </div>

                  <div className="editSectionTitle">
                    <span>01</span>
                    <div>
                      <strong>İletişim ve Veli Bilgileri</strong>
                      <small>Güncel kursiyer iletişim kayıtları</small>
                    </div>
                  </div>

                  <div className="editGrid">
                    <label>
                      <span>Öğrenci Telefonu</span>
                      <input
                        value={editPhone}
                        onChange={(event) => setEditPhone(event.target.value)}
                        placeholder="05xx xxx xx xx"
                      />
                    </label>

                    <label>
                      <span>Öğrenci E-posta</span>
                      <input
                        type="email"
                        value={editEmail}
                        onChange={(event) => setEditEmail(event.target.value)}
                        placeholder="ornek@mail.com"
                      />
                    </label>

                    <label>
                      <span>Veli Adı Soyadı</span>
                      <input
                        value={editGuardianName}
                        onChange={(event) =>
                          setEditGuardianName(event.target.value)
                        }
                      />
                    </label>

                    <label>
                      <span>Veli Telefonu</span>
                      <input
                        value={editGuardianPhone}
                        onChange={(event) =>
                          setEditGuardianPhone(event.target.value)
                        }
                        placeholder="05xx xxx xx xx"
                      />
                    </label>

                    <label className="full">
                      <span>Veli E-posta</span>
                      <input
                        type="email"
                        value={editGuardianEmail}
                        onChange={(event) =>
                          setEditGuardianEmail(event.target.value)
                        }
                      />
                    </label>

                    <label className="full">
                      <span>Genel Yönetim Notu</span>
                      <textarea
                        rows={4}
                        value={editGeneralNote}
                        onChange={(event) =>
                          setEditGeneralNote(event.target.value)
                        }
                        placeholder="Kursiyer hakkında yönetim notu..."
                      />
                    </label>
                  </div>

                  <div className="editSectionTitle programTitle">
                    <span>02</span>
                    <div>
                      <strong>Kurs / Grup / Saat Düzenleme</strong>
                      <small>
                        Mevcut: {student.branch_name || "Şube yok"} ·{" "}
                        {student.group_name || "Grup yok"}
                      </small>
                    </div>
                  </div>

                  <label className="programToggle">
                    <input
                      type="checkbox"
                      checked={editProgramToo}
                      onChange={(event) =>
                        setEditProgramToo(event.target.checked)
                      }
                    />
                    <div>
                      <strong>Program bilgilerini de değiştir</strong>
                      <span>
                        Şube, grup, gün ve saat alanlarını bu işlemde güncelle.
                      </span>
                    </div>
                  </label>

                  {editProgramToo && (
                    <div className="programEditBox">
                      <label>
                        <span>Şube</span>
                        <select
                          value={targetBranchId}
                          onChange={(event) => {
                            setTargetBranchId(event.target.value);
                            setTargetGroupId("");
                            setTargetScheduleIds([]);
                          }}
                        >
                          <option value="">Şube seçin</option>
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
                          value={targetGroupId}
                          onChange={(event) => {
                            setTargetGroupId(event.target.value);
                            setTargetScheduleIds([]);
                          }}
                        >
                          <option value="">Grup seçin</option>
                          {targetGroups.map((group) => (
                            <option key={group.id} value={group.id}>
                              {group.name}
                            </option>
                          ))}
                        </select>
                      </label>

                      <div className="scheduleChoices">
                        <span>Ders Günleri ve Saatleri</span>
                        {!targetGroupId ? (
                          <p className="emptySchedule">
                            Önce şube ve grup seçin.
                          </p>
                        ) : targetSchedules.length ? (
                          targetSchedules.map((schedule) => {
                            const checked = targetScheduleIds.includes(
                              schedule.id
                            );

                            return (
                              <label key={schedule.id}>
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() =>
                                    setTargetScheduleIds((current) =>
                                      checked
                                        ? current.filter(
                                            (id) => id !== schedule.id
                                          )
                                        : [...current, schedule.id]
                                    )
                                  }
                                />
                                <strong>
                                  {DAYS[Number(schedule.weekday)] || "Ders"}
                                </strong>
                                <span>
                                  {shortTime(schedule.start_time)}–
                                  {shortTime(schedule.end_time)}
                                </span>
                              </label>
                            );
                          })
                        ) : (
                          <p className="emptySchedule">
                            Bu grup için aktif ders programı bulunamadı.
                          </p>
                        )}
                      </div>

                      <label>
                        <span>Yeni Program Başlangıç Tarihi</span>
                        <input
                          type="date"
                          value={effectiveDate}
                          onChange={(event) =>
                            setEffectiveDate(event.target.value)
                          }
                        />
                      </label>

                      <div className="proInfo">
                        <strong>Güvenli program güncelleme</strong>
                        <p>
                          Kullanılmış dersler ve geçmiş yoklamalar değişmez.
                          Kalan dersler yeni programa taşınır. Yeni planlanan
                          bitiş tarihi seçilen günlere göre otomatik hesaplanır.
                        </p>
                      </div>
                    </div>
                  )}

                  <button
                    type="button"
                    className="openClassicForm"
                    onClick={() => {
                      setPanel(null);
                      setTimeout(() => jumpTo("duzenle"), 80);
                    }}
                  >
                    Ayrıntılı sağlık / acil durum alanlarını aç ↓
                  </button>
                </>
              )}

              {panel === "transfer" && (
                <>
                  <div className="proInfo">
                    <strong>Program değişikliği güvenli aktarım</strong>
                    <p>
                      Geçmiş yoklamalar ve kullanılan dersler korunur.
                      Yalnız kalan dersler yeni programa taşınır ve yeni
                      bitiş tarihi seçilen günlere göre hesaplanır.
                    </p>
                  </div>

                  <label>
                    <span>Yeni Şube</span>
                    <select
                      value={targetBranchId}
                      onChange={(event) => {
                        setTargetBranchId(event.target.value);
                        setTargetGroupId("");
                        setTargetScheduleIds([]);
                      }}
                    >
                      <option value="">Şube seçin</option>
                      {branches.map((branch) => (
                        <option key={branch.id} value={branch.id}>
                          {branch.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    <span>Yeni Grup</span>
                    <select
                      value={targetGroupId}
                      onChange={(event) => {
                        setTargetGroupId(event.target.value);
                        setTargetScheduleIds([]);
                      }}
                    >
                      <option value="">Grup seçin</option>
                      {targetGroups.map((group) => (
                        <option key={group.id} value={group.id}>
                          {group.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <div className="scheduleChoices">
                    <span>Yeni Gün / Saat</span>
                    {targetSchedules.map((schedule) => {
                      const checked = targetScheduleIds.includes(
                        schedule.id
                      );
                      return (
                        <label key={schedule.id}>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() =>
                              setTargetScheduleIds((current) =>
                                checked
                                  ? current.filter(
                                      (id) => id !== schedule.id
                                    )
                                  : [...current, schedule.id]
                              )
                            }
                          />
                          <strong>
                            {DAYS[Number(schedule.weekday)] || "Ders"}
                          </strong>
                          <span>
                            {shortTime(schedule.start_time)}–
                            {shortTime(schedule.end_time)}
                          </span>
                        </label>
                      );
                    })}
                  </div>

                  <label>
                    <span>Başlangıç Tarihi</span>
                    <input
                      type="date"
                      value={effectiveDate}
                      onChange={(event) =>
                        setEffectiveDate(event.target.value)
                      }
                    />
                  </label>
                </>
              )}

              {panel === "compensation" && (
                <>
                  <div className="proInfo">
                    <strong>Bireysel telafi yönetimi</strong>
                    <p>
                      Talep öğrenci dosyasına kaydedilir ve mevcut onay
                      sürecinden geçer.
                    </p>
                  </div>

                  <label>
                    <span>Telafi Ders Sayısı</span>
                    <input
                      type="number"
                      min="1"
                      max="20"
                      value={lessonCount}
                      onChange={(event) =>
                        setLessonCount(event.target.value)
                      }
                    />
                  </label>

                  <label>
                    <span>Gerekçe</span>
                    <input
                      value={reason}
                      onChange={(event) => setReason(event.target.value)}
                      placeholder="Örn. tesis kaynaklı ders iptali"
                    />
                  </label>

                  <label>
                    <span>Açıklama</span>
                    <textarea
                      rows={5}
                      value={description}
                      onChange={(event) =>
                        setDescription(event.target.value)
                      }
                      placeholder="Yönetici notu / açıklama"
                    />
                  </label>
                </>
              )}

              {panel === "message" && (
                <>
                  <div className="proInfo whatsappInfo">
                    <strong>WhatsApp'a hazır mesaj</strong>
                    <p>
                      Metni düzenleyin. Gönder butonu WhatsApp'ı alıcı
                      ve mesaj hazır şekilde açar.
                    </p>
                  </div>

                  <label>
                    <span>Alıcı</span>
                    <input
                      value={phone || "Telefon bilgisi yok"}
                      readOnly
                    />
                  </label>

                  <label>
                    <span>Mesaj Metni</span>
                    <textarea
                      rows={14}
                      value={message}
                      onChange={(event) => setMessage(event.target.value)}
                    />
                  </label>
                </>
              )}

              {panel === "delete" && (
                <>
                  <div className="proInfo dangerInfo">
                    <strong>Kalıcı veri silinmez</strong>
                    <p>
                      İşlem önce yönetici onayına gönderilir. Onay sonrası
                      öğrenci arşivlenir; geçmiş kayıt, ödeme ve yoklama
                      denetim için korunur.
                    </p>
                  </div>

                  <label>
                    <span>Silme / Arşivleme Gerekçesi</span>
                    <textarea
                      rows={6}
                      value={deleteReason}
                      onChange={(event) =>
                        setDeleteReason(event.target.value)
                      }
                      placeholder="Gerekçeyi ayrıntılı yazın..."
                    />
                  </label>
                </>
              )}

              {result && <div className="fileOpsResult">{result}</div>}
            </div>

            <footer>
              <button
                type="button"
                className="ghost"
                onClick={() => setPanel(null)}
              >
                Vazgeç
              </button>

              {panel === "edit" && (
                <button
                  type="button"
                  className={`primary ${
                    workingAction === "edit" ? "working" : ""
                  }`}
                  disabled={submitting}
                  onClick={submitProfessionalEdit}
                >
                  {workingAction === "edit"
                    ? "● Değişiklikler Kaydediliyor..."
                    : editProgramToo
                    ? "✓ Bilgileri ve Programı Kaydet"
                    : "✓ Bilgileri Kaydet"}
                </button>
              )}

              {panel === "transfer" && (
                <button
                  type="button"
                  className={`primary ${
                    workingAction === "transfer" ? "working" : ""
                  }`}
                  disabled={submitting}
                  onClick={submitTransfer}
                >
                  {workingAction === "transfer"
                    ? "● Aktarım Yapılıyor..."
                    : "✓ Değişikliği Uygula"}
                </button>
              )}

              {panel === "compensation" && (
                <button
                  type="button"
                  className={`primary green ${
                    workingAction === "compensation" ? "working" : ""
                  }`}
                  disabled={submitting}
                  onClick={submitCompensation}
                >
                  {workingAction === "compensation"
                    ? "● Talep Gönderiliyor..."
                    : "Yönetici Onayına Gönder"}
                </button>
              )}

              {panel === "message" && (
                <button
                  type="button"
                  className="primary whatsapp"
                  disabled={!phone || !message.trim()}
                  onClick={openWhatsApp}
                >
                  WhatsApp'ta Gönder ↗
                </button>
              )}

              {panel === "delete" && (
                <button
                  type="button"
                  className={`primary danger ${
                    workingAction === "delete" ? "working" : ""
                  }`}
                  disabled={submitting}
                  onClick={submitDeleteRequest}
                >
                  {workingAction === "delete"
                    ? "● Onaya Gönderiliyor..."
                    : "Yönetici Onayına Gönder"}
                </button>
              )}
            </footer>
          </aside>
        </div>
      )}

      <style jsx>{`
        .fileCommandBar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 22px;
          margin: 18px 0;
          padding: 18px 20px;
          border: 1px solid #d6e2ef;
          border-radius: 18px;
          background: #fff;
          box-shadow: 0 12px 32px rgba(20, 56, 92, .08);
        }

        .fileCommandIntro {
          min-width: 250px;
        }

        .fileCommandIntro span,
        .fileCommandIntro strong,
        .fileCommandIntro small {
          display: block;
        }

        .fileCommandIntro span {
          color: #f28c18;
          font-size: 10px;
          font-weight: 900;
          letter-spacing: .12em;
        }

        .fileCommandIntro strong {
          margin-top: 4px;
          color: #0c3159;
          font-size: 17px;
        }

        .fileCommandIntro small {
          margin-top: 4px;
          color: #6f8094;
          line-height: 1.45;
        }

        .fileCommandActions {
          display: flex;
          flex-wrap: wrap;
          justify-content: flex-end;
          gap: 8px;
        }

        .fileCommandActions button {
          border: 1px solid #cfdbea;
          border-radius: 11px;
          padding: 9px 11px;
          background: #fff;
          color: #1d4369;
          font-weight: 850;
          cursor: pointer;
        }

        .fileCommandActions .editMain {
          background: linear-gradient(180deg, #0b5db2, #084c93);
          border-color: #0b5db2;
          color: #fff;
          box-shadow: 0 7px 16px rgba(11, 93, 178, .18);
        }

        .editSectionTitle {
          display: flex;
          align-items: center;
          gap: 11px;
          margin: 20px 0 12px;
          padding-bottom: 10px;
          border-bottom: 1px solid #dce5ef;
        }

        .editSectionTitle > span {
          display: grid;
          place-items: center;
          width: 32px;
          height: 32px;
          border-radius: 10px;
          background: #0d5da9;
          color: #fff;
          font-size: 11px;
          font-weight: 900;
        }

        .editSectionTitle strong,
        .editSectionTitle small {
          display: block;
        }

        .editSectionTitle strong {
          color: #14395e;
          font-size: 14px;
        }

        .editSectionTitle small {
          margin-top: 2px;
          color: #75879a;
          font-size: 10px;
        }

        .programTitle > span {
          background: #f29218;
        }

        .editGrid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }

        .editGrid label {
          display: grid;
          gap: 6px;
        }

        .editGrid label.full {
          grid-column: 1 / -1;
        }

        .editGrid label > span,
        .programEditBox label > span {
          color: #526a83;
          font-size: 11px;
          font-weight: 850;
        }

        .programToggle {
          display: flex !important;
          grid-template-columns: none !important;
          align-items: flex-start;
          gap: 10px !important;
          margin-bottom: 14px !important;
          padding: 13px 14px;
          border: 1px solid #d4e0ec;
          border-radius: 13px;
          background: #fff;
          cursor: pointer;
        }

        .programToggle input {
          width: 18px !important;
          height: 18px;
          margin-top: 2px;
          accent-color: #0d69c7;
        }

        .programToggle strong,
        .programToggle span {
          display: block;
        }

        .programToggle strong {
          color: #163e64;
          font-size: 13px;
        }

        .programToggle span {
          margin-top: 3px;
          color: #72869a;
          font-size: 11px;
        }

        .programEditBox {
          margin-bottom: 14px;
          padding: 14px;
          border: 1px solid #cfe0f1;
          border-radius: 14px;
          background: #f8fbfe;
        }

        .programEditBox > label {
          display: grid;
          gap: 6px;
          margin-bottom: 12px;
        }

        .emptySchedule {
          margin: 0;
          padding: 11px 12px;
          border-radius: 10px;
          background: #eef3f8;
          color: #6d8093;
          font-size: 11px;
        }

        .openClassicForm {
          width: 100%;
          border: 1px dashed #aebfd0;
          border-radius: 11px;
          padding: 10px 12px;
          background: #fff;
          color: #476681;
          font-weight: 800;
          cursor: pointer;
        }

        .premiumEditInfo {
          background:
            linear-gradient(135deg, #edf6ff 0%, #f7fbff 100%);
        }

        .working {
          position: relative;
          overflow: hidden;
          cursor: wait !important;
          box-shadow: 0 0 0 3px rgba(18,104,214,.12),
            0 10px 24px rgba(18,104,214,.22) !important;
          animation: fileOperationPulse 1s ease-in-out infinite;
        }

        .working::after {
          content: "";
          position: absolute;
          inset: 0;
          background: linear-gradient(
            100deg,
            transparent 20%,
            rgba(255,255,255,.32) 45%,
            transparent 70%
          );
          transform: translateX(-120%);
          animation: fileOperationSweep 1.05s linear infinite;
          pointer-events: none;
        }

        @keyframes fileOperationPulse {
          0%, 100% { filter: brightness(1); }
          50% { filter: brightness(1.08); }
        }

        @keyframes fileOperationSweep {
          to { transform: translateX(120%); }
        }

        .fileCommandActions .blue {
          background: #eef6ff;
          border-color: #bcd7f7;
          color: #0b60bd;
        }

        .fileCommandActions .green {
          background: #eefaf4;
          border-color: #bfe6d2;
          color: #157147;
        }

        .fileCommandActions .orange {
          background: #fff6e9;
          border-color: #f8d4a5;
          color: #a85a08;
        }

        .fileCommandActions .danger {
          background: #fff1f1;
          border-color: #f2c3c3;
          color: #a92c2c;
        }

        .fileOpsOverlay {
          position: fixed;
          inset: 0;
          z-index: 1200;
          display: flex;
          justify-content: flex-end;
          background: rgba(5, 22, 42, .62);
          backdrop-filter: blur(6px);
        }

        .fileOpsPanel {
          width: min(620px, 96vw);
          height: 100%;
          display: flex;
          flex-direction: column;
          background: #f7f9fc;
          box-shadow: -20px 0 55px rgba(0,0,0,.25);
        }

        .fileOpsPanel > header {
          display: flex;
          justify-content: space-between;
          gap: 15px;
          padding: 23px;
          background: linear-gradient(135deg,#082442,#0d5792);
          color: #fff;
        }

        .fileOpsPanel > header span {
          color: #ffab32;
          font-size: 10px;
          font-weight: 900;
          letter-spacing: .12em;
        }

        .fileOpsPanel > header h3 {
          margin: 6px 0 0;
          font-size: 24px;
        }

        .fileOpsPanel > header button {
          width: 38px;
          height: 38px;
          border: 1px solid rgba(255,255,255,.25);
          border-radius: 11px;
          background: rgba(255,255,255,.1);
          color: #fff;
          font-size: 24px;
          cursor: pointer;
        }

        .fileOpsBody {
          flex: 1;
          overflow-y: auto;
          padding: 22px;
        }

        .fileOpsBody > label {
          display: grid;
          gap: 6px;
          margin-bottom: 15px;
        }

        .fileOpsBody > label > span,
        .scheduleChoices > span {
          color: #50667f;
          font-size: 11px;
          font-weight: 850;
        }

        .fileOpsBody input,
        .fileOpsBody select,
        .fileOpsBody textarea {
          width: 100%;
          box-sizing: border-box;
          border: 1px solid #ccd9e8;
          border-radius: 11px;
          padding: 11px 12px;
          background: #fff;
          color: #143759;
          font: inherit;
        }

        .proInfo {
          margin-bottom: 16px;
          padding: 13px 14px;
          border: 1px solid #cfe0f2;
          border-radius: 13px;
          background: #edf6ff;
        }

        .proInfo strong {
          color: #0c548e;
        }

        .proInfo p {
          margin: 5px 0 0;
          color: #58718a;
          font-size: 12px;
          line-height: 1.5;
        }

        .whatsappInfo {
          background: #eefaf4;
          border-color: #c4e7d3;
        }

        .whatsappInfo strong {
          color: #157148;
        }

        .dangerInfo {
          background: #fff3f3;
          border-color: #efcaca;
        }

        .dangerInfo strong {
          color: #a52c2c;
        }

        .scheduleChoices {
          display: grid;
          gap: 8px;
          margin-bottom: 16px;
        }

        .scheduleChoices label {
          display: grid;
          grid-template-columns: auto 1fr auto;
          gap: 10px;
          align-items: center;
          padding: 10px 12px;
          border: 1px solid #d7e2ed;
          border-radius: 10px;
          background: #fff;
        }

        .scheduleChoices label input {
          width: 17px;
          height: 17px;
        }

        .scheduleChoices label span {
          color: #60758b;
          font-size: 11px;
        }

        .fileOpsResult {
          padding: 12px;
          border: 1px solid #c8e3d3;
          border-radius: 11px;
          background: #edf9f2;
          color: #17643d;
          font-size: 12px;
          font-weight: 800;
        }

        .fileOpsPanel > footer {
          display: flex;
          justify-content: flex-end;
          gap: 9px;
          padding: 15px 18px;
          border-top: 1px solid #d9e3ed;
          background: #fff;
        }

        .fileOpsPanel > footer button {
          border: 0;
          border-radius: 10px;
          padding: 10px 14px;
          font-weight: 900;
          cursor: pointer;
        }

        .fileOpsPanel > footer .ghost {
          border: 1px solid #cbd7e4;
          background: #fff;
          color: #294968;
        }

        .fileOpsPanel > footer .primary {
          background: #1268d6;
          color: #fff;
        }

        .fileOpsPanel > footer .green {
          background: #178b59;
        }

        .fileOpsPanel > footer .whatsapp {
          background: #1fa463;
        }

        .fileOpsPanel > footer .danger {
          background: #c63b3b;
        }

        @media (max-width: 850px) {
          .fileCommandBar {
            align-items: stretch;
            flex-direction: column;
          }

          .fileCommandActions {
            justify-content: flex-start;
          }

          .editGrid {
            grid-template-columns: 1fr;
          }

          .editGrid label.full {
            grid-column: auto;
          }

          .fileOpsPanel {
            width: 100%;
          }
        }
      `}</style>
    </>
  );
}
