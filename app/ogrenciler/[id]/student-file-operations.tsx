"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import { bulkTransferStudents } from "../bulk-actions";
import { createStudentPayment } from "../../odemeler/actions";

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
  enrollmentId?: string | null;
  remainingPayment?: number;
  totalReceived?: number;
  paymentDueDate?: string | null;
  renewalDefaults?: {
    package_id?: string | null;
    group_id?: string | null;
    branch_id?: string | null;
    lesson_count?: number | null;
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

type FileIconName =
  "edit" | "transfer" | "plus" | "message" | "wallet" | "trash" | "print";
function FileIcon({ name }: { name: FileIconName }) {
  const base = {
    width: 18,
    height: 18,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.9,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  const p: Record<FileIconName, ReactNode> = {
    edit: (
      <>
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z" />
      </>
    ),
    transfer: (
      <>
        <path d="M7 7h12" />
        <path d="m16 4 3 3-3 3" />
        <path d="M17 17H5" />
        <path d="m8 14-3 3 3 3" />
      </>
    ),
    plus: (
      <>
        <path d="M12 5v14" />
        <path d="M5 12h14" />
      </>
    ),
    message: (
      <>
        <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" />
        <path d="M8 9h8" />
        <path d="M8 13h5" />
      </>
    ),
    wallet: (
      <>
        <path d="M20 7V5a2 2 0 0 0-2-2H5a3 3 0 0 0 0 6h15v11H5a3 3 0 0 1-3-3V6" />
        <path d="M16 13h4" />
      </>
    ),
    trash: (
      <>
        <path d="M3 6h18" />
        <path d="M8 6V4h8v2" />
        <path d="m19 6-1 15H6L5 6" />
      </>
    ),
    print: (
      <>
        <path d="M6 9V2h12v7" />
        <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
        <rect x="6" y="14" width="12" height="8" rx="1" />
      </>
    ),
  };
  return <svg {...base}>{p[name]}</svg>;
}

export default function StudentFileOperations({
  student,
  enrollmentId,
  remainingPayment = 0,
  totalReceived = 0,
  paymentDueDate,
  renewalDefaults,
  branches,
  groups,
  schedules,
}: Props) {
  const router = useRouter();

  const [panel, setPanel] = useState<
    | "payment"
    | "renewal"
    | "obligation"
    | "transfer"
    | "compensation"
    | "message"
    | "delete"
    | null
  >(null);

  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<
    "cash" | "card" | "bank_transfer" | "eft" | "other"
  >("cash");
  const [paymentDescription, setPaymentDescription] = useState("");
  const [renewalStartDate, setRenewalStartDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [renewalDueDate, setRenewalDueDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [renewalLessonCount, setRenewalLessonCount] = useState(
    String(renewalDefaults?.lesson_count || 8),
  );
  const [renewalNote, setRenewalNote] = useState("");
  const [obligationType, setObligationType] = useState("equipment");
  const [obligationTitle, setObligationTitle] = useState("");
  const [obligationAmount, setObligationAmount] = useState("");
  const [obligationDueDate, setObligationDueDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [obligationDescription, setObligationDescription] = useState("");

  const [targetBranchId, setTargetBranchId] = useState("");
  const [targetGroupId, setTargetGroupId] = useState("");
  const [targetScheduleIds, setTargetScheduleIds] = useState<string[]>([]);
  const [effectiveDate, setEffectiveDate] = useState(
    new Date().toISOString().slice(0, 10),
  );

  const [lessonCount, setLessonCount] = useState("1");
  const [reason, setReason] = useState("");
  const [description, setDescription] = useState("");

  const [message, setMessage] = useState("");
  const [result, setResult] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [deleteReason, setDeleteReason] = useState("");
  const [deleteConfirmed, setDeleteConfirmed] = useState(false);

  const targetGroups = useMemo(
    () =>
      groups.filter(
        (group) => !targetBranchId || group.branch_id === targetBranchId,
      ),
    [groups, targetBranchId],
  );

  const targetSchedules = useMemo(
    () =>
      schedules
        .filter((schedule) => schedule.group_id === targetGroupId)
        .sort((a, b) => {
          const day = Number(a.weekday || 0) - Number(b.weekday || 0);
          if (day !== 0) return day;
          return String(a.start_time || "").localeCompare(
            String(b.start_time || ""),
          );
        }),
    [schedules, targetGroupId],
  );

  const fullName =
    `${student.first_name || ""} ${student.last_name || ""}`.trim();

  const phone =
    normalizePhone(student.guardian_phone) || normalizePhone(student.phone);

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
        `*Sprint Yüzme Okulu Yönetimi*`,
    );
    setPanel("message");
  }

  async function submitPayment() {
    if (!enrollmentId) {
      setResult(
        "Ödeme alınabilmesi için öğrencinin aktif kayıt/paketi bulunmalıdır.",
      );
      return;
    }

    const amount = Number(paymentAmount.replace(/\./g, "").replace(",", "."));

    if (!Number.isFinite(amount) || amount <= 0) {
      setResult("Geçerli bir ödeme tutarı giriniz.");
      return;
    }

    if (remainingPayment > 0 && amount > remainingPayment) {
      setResult(
        `Girilen tutar kalan ödemeden fazla olamaz. Kalan ödeme: ${remainingPayment.toLocaleString("tr-TR")} TL`,
      );
      return;
    }

    try {
      setSubmitting(true);
      setResult("");

      const response = await createStudentPayment({
        studentId: student.id,
        enrollmentId,
        amount,
        paymentMethod,
        description: paymentDescription.trim() || null,
      });

      setResult(response.message);

      if (response.ok) {
        setPaymentAmount("");
        setPaymentDescription("");
        router.refresh();
      }
    } catch (error) {
      console.error(error);
      setResult("Ödeme kaydedilirken bağlantı hatası oluştu.");
    } finally {
      setSubmitting(false);
    }
  }

  async function submitRenewal() {
    try {
      setSubmitting(true);
      setResult("");
      const response = await fetch("/api/student-renewals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: student.id,
          packageId: renewalDefaults?.package_id,
          groupId: renewalDefaults?.group_id,
          branchId: renewalDefaults?.branch_id,
          lessonCount: Number(renewalLessonCount),
          startDate: renewalStartDate,
          paymentDueDate: renewalDueDate,
          note: renewalNote,
        }),
      });
      const data = await response.json();
      setResult(data.message || data.error || "Kayıt yenileme tamamlanamadı.");
      if (response.ok && data.ok) router.refresh();
    } catch (error) {
      console.error(error);
      setResult("Kayıt yenileme sırasında bağlantı hatası oluştu.");
    } finally {
      setSubmitting(false);
    }
  }

  async function submitObligation() {
    try {
      setSubmitting(true);
      setResult("");
      const parsedAmount = Number(
        obligationAmount.replace(/\./g, "").replace(",", "."),
      );
      const response = await fetch("/api/student-obligations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: student.id,
          enrollmentId,
          obligationType,
          title: obligationTitle,
          amount: parsedAmount,
          dueDate: obligationDueDate,
          description: obligationDescription,
          reminderDays: 3,
        }),
      });
      const data = await response.json();
      setResult(data.message || data.error || "Borç kaydı oluşturulamadı.");
      if (response.ok && data.ok) {
        setObligationTitle("");
        setObligationAmount("");
        setObligationDescription("");
        router.refresh();
      }
    } catch (error) {
      console.error(error);
      setResult("Borçlandırma sırasında bağlantı hatası oluştu.");
    } finally {
      setSubmitting(false);
    }
  }

  async function submitTransfer() {
    if (!targetBranchId || !targetGroupId || !targetScheduleIds.length) {
      setResult("Yeni şube, grup ve ders seansı seçilmelidir.");
      return;
    }

    try {
      setSubmitting(true);
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
          data.error || data.details || "Telafi talebi oluşturulamadı.",
        );
        return;
      }

      setResult(
        data.message || "Bireysel telafi talebi yönetici onayına gönderildi.",
      );

      router.refresh();
    } catch (error) {
      console.error(error);
      setResult("Telafi işlemi sırasında bağlantı hatası oluştu.");
    } finally {
      setSubmitting(false);
    }
  }

  async function submitDeleteRequest() {
    if (deleteReason.trim().length < 5) {
      setResult("Silme / arşivleme gerekçesi yazılmalıdır.");
      return;
    }

    try {
      setSubmitting(true);
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
        setResult(data.error || data.details || "Silme talebi oluşturulamadı.");
        return;
      }

      setResult(data.message || "Silme talebi yönetici onayına gönderildi.");
    } catch (error) {
      console.error(error);
      setResult("Silme talebi sırasında bağlantı hatası oluştu.");
    } finally {
      setSubmitting(false);
    }
  }

  function openWhatsApp() {
    if (!phone || !message.trim()) return;
    window.open(
      `https://wa.me/${phone}?text=${encodeURIComponent(message)}`,
      "_blank",
      "noopener,noreferrer",
    );
  }

  return (
    <>
      <section className="fileCommandBar">
        <div className="fileCommandIntro">
          <span>KURSİYER İŞLEM MERKEZİ</span>
          <strong>Dosya üzerinde hızlı işlem</strong>
          <small>
            Bilgileri düzenleyin, programı aktarın, telafi oluşturun, mesaj
            gönderin veya yönetici onaylı arşivleme başlatın.
          </small>
        </div>

        <div className="fileCommandActions">
          <button
            type="button"
            className="renewal"
            onClick={() => {
              setResult("");
              setPanel("renewal");
            }}
          >
            <FileIcon name="plus" /> Kayıt Yenile
          </button>

          <button
            type="button"
            className="obligation"
            onClick={() => {
              setResult("");
              setPanel("obligation");
            }}
          >
            <FileIcon name="wallet" /> Borçlandır / Ürün Ver
          </button>

          <button
            type="button"
            className="payment"
            onClick={() => {
              setResult("");
              setPanel("payment");
            }}
          >
            <FileIcon name="wallet" /> Ödeme Al
          </button>

          <button type="button" onClick={() => jumpTo("duzenle")}>
            <FileIcon name="edit" /> Bilgileri Düzenle
          </button>

          <button
            type="button"
            className="blue"
            onClick={() => {
              setResult("");
              setPanel("transfer");
            }}
          >
            <FileIcon name="transfer" /> Grup / Şube Değiştir
          </button>

          <button
            type="button"
            className="green"
            onClick={() => {
              setResult("");
              setPanel("compensation");
            }}
          >
            <FileIcon name="plus" /> Bireysel Telafi
          </button>

          <button type="button" className="orange" onClick={openMessage}>
            <FileIcon name="message" /> Mesaj / WhatsApp
          </button>

          <button
            type="button"
            onClick={() => router.push(`/odemeler?student=${student.id}`)}
          >
            <FileIcon name="wallet" /> Ödeme Geçmişi
          </button>

          <button type="button" onClick={() => window.print()}>
            <FileIcon name="print" /> A4 Çıktı Al
          </button>

          <button
            type="button"
            className="danger"
            onClick={() => {
              setResult("");
              setDeleteConfirmed(false);
              setPanel("delete");
            }}
          >
            <FileIcon name="trash" /> Sil / Arşivle
          </button>
        </div>
      </section>

      <nav className="fileSectionNav" aria-label="Kursiyer dosyası bölümleri">
        <button type="button" onClick={() => jumpTo("genel-bilgiler")}>
          Genel Bilgiler
        </button>
        <button type="button" onClick={() => jumpTo("kurs-kaydi")}>
          Kayıt & Program
        </button>
        <button type="button" onClick={() => jumpTo("odeme")}>
          Ödeme & Kasa
        </button>
        <button type="button" onClick={() => jumpTo("yoklama")}>
          Yoklama
        </button>
        <button type="button" onClick={() => jumpTo("ders-hareketleri")}>
          Ders & Telafi
        </button>
        <button type="button" onClick={() => jumpTo("saglik")}>
          Sağlık
        </button>
        <button type="button" onClick={() => jumpTo("notlar")}>
          Notlar
        </button>
        <button type="button" onClick={() => jumpTo("mesajlar")}>
          Mesajlar
        </button>
        <button type="button" onClick={() => jumpTo("islem-gecmisi")}>
          İşlem Geçmişi
        </button>
      </nav>

      {panel && (
        <div className="fileOpsOverlay" onClick={() => setPanel(null)}>
          <aside
            className="fileOpsPanel"
            onClick={(event) => event.stopPropagation()}
          >
            <header>
              <div>
                <span>
                  {panel === "transfer"
                    ? "PROGRAM DÜZENLEME"
                    : panel === "payment"
                      ? "ÖDEME VE KASA"
                      : panel === "renewal"
                        ? "KAYIT YENİLEME"
                        : panel === "obligation"
                          ? "VADELİ BORÇ / ÜRÜN"
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
              {panel === "renewal" && (
                <>
                  <div className="proInfo renewalInfo">
                    <strong>Yeni eğitim dönemini oluştur</strong>
                    <p>
                      Mevcut dönem geçmişe kaldırılır; grup, yoklama ve ödeme
                      geçmişi korunarak yeni ders hakkı başlatılır.
                    </p>
                  </div>
                  <label>
                    <span>Yeni Ders Sayısı</span>
                    <input
                      type="number"
                      min="1"
                      max="200"
                      value={renewalLessonCount}
                      onChange={(event) =>
                        setRenewalLessonCount(event.target.value)
                      }
                    />
                  </label>
                  <label>
                    <span>Yeni Dönem Başlangıcı</span>
                    <input
                      type="date"
                      value={renewalStartDate}
                      onChange={(event) =>
                        setRenewalStartDate(event.target.value)
                      }
                    />
                  </label>
                  <label>
                    <span>Ödeme Vadesi</span>
                    <input
                      type="date"
                      value={renewalDueDate}
                      onChange={(event) =>
                        setRenewalDueDate(event.target.value)
                      }
                    />
                  </label>
                  <label>
                    <span>Yenileme Notu</span>
                    <textarea
                      rows={4}
                      value={renewalNote}
                      onChange={(event) => setRenewalNote(event.target.value)}
                      placeholder="Örn. Aynı grup ve saatle 12 ders yenilendi."
                    />
                  </label>
                </>
              )}

              {panel === "obligation" && (
                <>
                  <div className="proInfo obligationInfo">
                    <strong>Ürün veya vadeli ek ücret kaydı</strong>
                    <p>
                      Vade yaklaştığında uyarı verir; tarih geçtiğinde öğrenci
                      dosyası ve finans ekranında kırmızı görünür.
                    </p>
                  </div>
                  <label>
                    <span>Borç Türü</span>
                    <select
                      value={obligationType}
                      onChange={(event) =>
                        setObligationType(event.target.value)
                      }
                    >
                      <option value="equipment">Palet / Bone / Ekipman</option>
                      <option value="service">Ek Hizmet</option>
                      <option value="installment">Taksit / Taahhüt</option>
                      <option value="other">Diğer</option>
                    </select>
                  </label>
                  <label>
                    <span>Ürün / Borç Açıklaması</span>
                    <input
                      value={obligationTitle}
                      onChange={(event) =>
                        setObligationTitle(event.target.value)
                      }
                      placeholder="Örn. Yüzme paleti"
                    />
                  </label>
                  <label>
                    <span>Tutar</span>
                    <input
                      inputMode="decimal"
                      value={obligationAmount}
                      onChange={(event) =>
                        setObligationAmount(event.target.value)
                      }
                      placeholder="Örn. 750"
                    />
                  </label>
                  <label>
                    <span>Ödeme Taahhüt / Vade Tarihi</span>
                    <input
                      type="date"
                      value={obligationDueDate}
                      onChange={(event) =>
                        setObligationDueDate(event.target.value)
                      }
                    />
                  </label>
                  <label>
                    <span>Not</span>
                    <textarea
                      rows={4}
                      value={obligationDescription}
                      onChange={(event) =>
                        setObligationDescription(event.target.value)
                      }
                      placeholder="Örn. Veli ayın 3'ünde ödeme yapacağını bildirdi."
                    />
                  </label>
                </>
              )}

              {panel === "payment" && (
                <>
                  <div className="proInfo paymentInfo">
                    <strong>Ödemeyi doğrudan öğrenci dosyasına işle</strong>
                    <p>
                      Kayıt Ödemeler modülüne, öğrenci hareketlerine ve Günlük
                      Kasa’ya otomatik yansır. Nakit ödemeler kasa teslim onayı
                      bekler.
                    </p>
                  </div>

                  <div className="paymentSummaryGrid">
                    <div>
                      <span>Toplam Tahsilat</span>
                      <strong>
                        {totalReceived.toLocaleString("tr-TR")} TL
                      </strong>
                    </div>
                    <div>
                      <span>Kalan Ödeme</span>
                      <strong>
                        {remainingPayment.toLocaleString("tr-TR")} TL
                      </strong>
                    </div>
                    <div>
                      <span>Ödeme Vadesi</span>
                      <strong>{paymentDueDate || "—"}</strong>
                    </div>
                  </div>

                  <label>
                    <span>Alınan Tutar</span>
                    <input
                      inputMode="decimal"
                      value={paymentAmount}
                      onChange={(event) => setPaymentAmount(event.target.value)}
                      placeholder="Örn. 4.000"
                    />
                  </label>

                  <label>
                    <span>Ödeme Yöntemi</span>
                    <select
                      value={paymentMethod}
                      onChange={(event) =>
                        setPaymentMethod(
                          event.target.value as typeof paymentMethod,
                        )
                      }
                    >
                      <option value="cash">Nakit</option>
                      <option value="card">Kredi / Banka Kartı</option>
                      <option value="bank_transfer">Havale</option>
                      <option value="eft">EFT</option>
                      <option value="other">Diğer</option>
                    </select>
                  </label>

                  <label>
                    <span>Açıklama</span>
                    <textarea
                      rows={4}
                      value={paymentDescription}
                      onChange={(event) =>
                        setPaymentDescription(event.target.value)
                      }
                      placeholder="Örn. 12 derslik paket ödemesi"
                    />
                  </label>
                </>
              )}

              {panel === "renewal" && (
                <button
                  type="button"
                  className="primary renewal"
                  disabled={
                    submitting ||
                    !renewalStartDate ||
                    Number(renewalLessonCount) < 1
                  }
                  onClick={submitRenewal}
                >
                  {submitting
                    ? "Kayıt Yenileniyor..."
                    : "✓ Kaydı Yenile ve Yeni Dönemi Başlat"}
                </button>
              )}

              {panel === "obligation" && (
                <button
                  type="button"
                  className="primary obligation"
                  disabled={
                    submitting ||
                    !obligationTitle.trim() ||
                    !obligationAmount ||
                    !obligationDueDate
                  }
                  onClick={submitObligation}
                >
                  {submitting
                    ? "Borç Kaydediliyor..."
                    : "✓ Borcu Kaydet ve Takibe Al"}
                </button>
              )}

              {panel === "transfer" && (
                <>
                  <div className="proInfo">
                    <strong>Program değişikliği güvenli aktarım</strong>
                    <p>
                      Geçmiş yoklamalar ve kullanılan dersler korunur. Yalnız
                      kalan dersler yeni programa taşınır ve yeni bitiş tarihi
                      seçilen günlere göre hesaplanır.
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
                      const checked = targetScheduleIds.includes(schedule.id);
                      return (
                        <label key={schedule.id}>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() =>
                              setTargetScheduleIds((current) =>
                                checked
                                  ? current.filter((id) => id !== schedule.id)
                                  : [...current, schedule.id],
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
                      onChange={(event) => setEffectiveDate(event.target.value)}
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
                      onChange={(event) => setLessonCount(event.target.value)}
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
                      onChange={(event) => setDescription(event.target.value)}
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
                      Metni düzenleyin. Gönder butonu WhatsApp'ı alıcı ve mesaj
                      hazır şekilde açar.
                    </p>
                  </div>

                  <label>
                    <span>Alıcı</span>
                    <input value={phone || "Telefon bilgisi yok"} readOnly />
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
                      öğrenci arşivlenir; geçmiş kayıt, ödeme ve yoklama denetim
                      için korunur.
                    </p>
                  </div>

                  <label>
                    <span>Silme / Arşivleme Gerekçesi</span>
                    <textarea
                      rows={6}
                      value={deleteReason}
                      onChange={(event) => setDeleteReason(event.target.value)}
                      placeholder="Gerekçeyi ayrıntılı yazın..."
                    />
                  </label>

                  <label className="deleteApprovalCheck">
                    <input
                      type="checkbox"
                      checked={deleteConfirmed}
                      onChange={(event) =>
                        setDeleteConfirmed(event.target.checked)
                      }
                    />
                    <span>
                      Ödeme, yoklama ve işlem geçmişinin korunacağını; talebin
                      yönetici onayına ve Bildirimler modülüne gönderileceğini
                      onaylıyorum.
                    </span>
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

              {panel === "transfer" && (
                <button
                  type="button"
                  className="primary"
                  disabled={submitting}
                  onClick={submitTransfer}
                >
                  {submitting ? "Kaydediliyor..." : "✓ Değişikliği Uygula"}
                </button>
              )}

              {panel === "payment" && (
                <button
                  type="button"
                  className="primary payment"
                  disabled={submitting || !enrollmentId}
                  onClick={submitPayment}
                >
                  {submitting ? "Ödeme Kaydediliyor..." : "✓ Ödemeyi Kaydet"}
                </button>
              )}

              {panel === "compensation" && (
                <button
                  type="button"
                  className="primary green"
                  disabled={submitting}
                  onClick={submitCompensation}
                >
                  {submitting ? "Gönderiliyor..." : "Yönetici Onayına Gönder"}
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
                  className="primary danger"
                  disabled={
                    submitting ||
                    deleteReason.trim().length < 5 ||
                    !deleteConfirmed
                  }
                  onClick={submitDeleteRequest}
                >
                  {submitting ? "Gönderiliyor..." : "✓ Yönetici Onayına Gönder"}
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
          box-shadow: 0 12px 32px rgba(20, 56, 92, 0.08);
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
          letter-spacing: 0.12em;
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

        .fileCommandActions .blue {
          background: #eef6ff;
          border-color: #bcd7f7;
          color: #0b60bd;
        }

        .fileCommandActions .payment {
          background: linear-gradient(135deg, #087443, #12a365);
          border-color: #087443;
          color: #ffffff;
          box-shadow: 0 8px 18px rgba(8, 116, 67, 0.2);
        }

        .fileCommandActions .renewal {
          background: linear-gradient(135deg, #165dcc, #2587f4);
          border-color: #165dcc;
          color: #ffffff;
          box-shadow: 0 8px 18px rgba(22, 93, 204, 0.2);
        }

        .fileCommandActions .obligation {
          background: linear-gradient(135deg, #7c3aed, #9b5cf6);
          border-color: #7c3aed;
          color: #ffffff;
          box-shadow: 0 8px 18px rgba(124, 58, 237, 0.18);
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

        .fileCommandActions button,
        .fileSectionNav button,
        .fileOpsPanel button {
          transition:
            transform 0.15s ease,
            filter 0.15s ease,
            box-shadow 0.15s ease;
          touch-action: manipulation;
        }

        .fileCommandActions button:not(:disabled):active,
        .fileSectionNav button:not(:disabled):active,
        .fileOpsPanel button:not(:disabled):active {
          transform: translateY(1px) scale(0.975);
          filter: brightness(0.95);
        }

        .fileCommandActions button:disabled,
        .fileOpsPanel button:disabled {
          cursor: not-allowed;
          opacity: 0.58;
        }

        .fileSectionNav {
          position: sticky;
          top: 72px;
          z-index: 40;
          display: flex;
          gap: 7px;
          margin: 0 0 18px;
          padding: 8px;
          overflow-x: auto;
          border: 1px solid #d8e3ef;
          border-radius: 15px;
          background: rgba(255, 255, 255, 0.96);
          box-shadow: 0 9px 24px rgba(20, 56, 92, 0.08);
          backdrop-filter: blur(12px);
          scrollbar-width: none;
        }

        .fileSectionNav::-webkit-scrollbar {
          display: none;
        }

        .fileSectionNav button {
          flex: 0 0 auto;
          min-height: 40px;
          padding: 0 13px;
          border: 1px solid transparent;
          border-radius: 10px;
          background: #f4f7fb;
          color: #36516f;
          font-weight: 850;
          cursor: pointer;
          white-space: nowrap;
        }

        .fileSectionNav button:hover {
          border-color: #bdd6f1;
          background: #edf6ff;
          color: #0b60bd;
        }

        .fileOpsOverlay {
          position: fixed;
          inset: 0;
          z-index: 1200;
          display: flex;
          justify-content: flex-end;
          background: rgba(5, 22, 42, 0.62);
          backdrop-filter: blur(6px);
        }

        .fileOpsPanel {
          width: min(620px, 96vw);
          height: 100%;
          display: flex;
          flex-direction: column;
          background: #f7f9fc;
          box-shadow: -20px 0 55px rgba(0, 0, 0, 0.25);
        }

        .fileOpsPanel > header {
          display: flex;
          justify-content: space-between;
          gap: 15px;
          padding: 23px;
          background: linear-gradient(135deg, #082442, #0d5792);
          color: #fff;
        }

        .fileOpsPanel > header span {
          color: #ffab32;
          font-size: 10px;
          font-weight: 900;
          letter-spacing: 0.12em;
        }

        .fileOpsPanel > header h3 {
          margin: 6px 0 0;
          font-size: 24px;
        }

        .fileOpsPanel > header button {
          width: 38px;
          height: 38px;
          border: 1px solid rgba(255, 255, 255, 0.25);
          border-radius: 11px;
          background: rgba(255, 255, 255, 0.1);
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

        .paymentInfo {
          background: #ecfdf5;
          border-color: #a7f3d0;
        }

        .paymentInfo strong {
          color: #087443;
        }

        .renewalInfo {
          border-color: #b9d7ff;
          background: #eff6ff;
        }

        .renewalInfo strong {
          color: #165dcc;
        }

        .obligationInfo {
          border-color: #d8c4ff;
          background: #f7f2ff;
        }

        .obligationInfo strong {
          color: #6d28d9;
        }

        .paymentSummaryGrid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 9px;
          margin-bottom: 17px;
        }

        .paymentSummaryGrid > div {
          min-width: 0;
          padding: 12px;
          border: 1px solid #d9e5ef;
          border-radius: 12px;
          background: #ffffff;
        }

        .paymentSummaryGrid span,
        .paymentSummaryGrid strong {
          display: block;
        }
        .paymentSummaryGrid span {
          color: #718197;
          font-size: 10px;
          font-weight: 800;
        }
        .paymentSummaryGrid strong {
          margin-top: 5px;
          color: #12385e;
          font-size: 14px;
          overflow-wrap: anywhere;
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

        .fileOpsPanel > footer .payment {
          background: #087443;
        }

        .fileOpsPanel > footer .renewal {
          background: #165dcc;
        }

        .fileOpsPanel > footer .obligation {
          background: #7c3aed;
        }

        .deleteApprovalCheck {
          display: grid !important;
          grid-template-columns: 22px minmax(0, 1fr);
          align-items: start;
          gap: 10px !important;
          margin-top: 14px;
          padding: 13px;
          border: 1px solid #efc2c2;
          border-radius: 12px;
          background: #fff7f7;
          cursor: pointer;
        }

        .deleteApprovalCheck input {
          width: 19px;
          height: 19px;
          margin: 1px 0 0;
          accent-color: #c63b3b;
        }

        .deleteApprovalCheck span {
          color: #7d3333 !important;
          font-size: 11px !important;
          line-height: 1.5;
        }

        @media (max-width: 850px) {
          .fileCommandBar {
            align-items: stretch;
            flex-direction: column;
          }

          .fileCommandActions {
            justify-content: flex-start;
          }

          .fileCommandActions button {
            flex: 1 1 calc(50% - 8px);
            min-height: 45px;
          }

          .fileSectionNav {
            top: 62px;
            margin-left: -2px;
            margin-right: -2px;
          }

          .paymentSummaryGrid {
            grid-template-columns: 1fr;
          }

          .fileOpsPanel {
            width: 100%;
          }
        }

        .fileCommandActions button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
        }
        .fileCommandActions button svg {
          flex: 0 0 auto;
        }
        @media print {
          .fileCommandBar,
          .fileSectionNav,
          .fileOpsOverlay {
            display: none !important;
          }
          body {
            background: #fff !important;
          }
        }
      `}</style>
    </>
  );
}
