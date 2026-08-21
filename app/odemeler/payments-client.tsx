"use client";

import Link from "next/link";
import {
  useMemo,
  useState,
} from "react";

export type PaymentRecord = {
  id: string;
  student_id: string;
  enrollment_id: string | null;

  amount: number;
  currency: string;

  payment_method: string | null;
  payment_status: string | null;
  description: string | null;

  received_by: string | null;
  received_at: string | null;

  cash_handover_status: string | null;
  cash_handover_requested_at: string | null;
  cash_handover_approved_by: string | null;
  cash_handover_approved_at: string | null;

  cancellation_reason: string | null;
  cancelled_by: string | null;
  cancelled_at: string | null;

  created_at: string | null;

  due_date?: string | null;
};

export type PaymentStudent = {
  id: string;

  student_number: string | null;

  first_name: string;
  last_name: string;

  status: string | null;

  phone: string | null;
  guardian_name: string | null;
  guardian_phone: string | null;
  contact_phone: string | null;

  is_adult: boolean;

  branch_id: string | null;
  branch_name: string | null;

  group_id: string | null;
  group_name: string | null;

  course_type: string | null;

  enrollment_id: string | null;

  package_id: string | null;
  package_name: string | null;

  package_price: number;

  total_paid: number;
  remaining_payment: number;

  start_date: string | null;
  end_date: string | null;

  total_lessons: number;
  used_lessons: number;
  remaining_lessons: number;

  due_date: string | null;

  last_payment_at: string | null;
  last_payment_method: string | null;

  payments: PaymentRecord[];
};

type Props = {
  students: PaymentStudent[];
  payments: PaymentRecord[];
  currentProfileId: string;
};

type QuickFilter =
  | "all"
  | "three_lessons"
  | "two_lessons"
  | "one_lesson"
  | "finished"
  | "ending_week"
  | "renew_week"
  | "payment_week"
  | "renew_and_payment"
  | "no_payment"
  | "partial"
  | "paid"
  | "latest_payment"
  | "cash_pending";

type MessageType =
  | "smart"
  | "payment_reminder"
  | "payment_due"
  | "payment_overdue"
  | "renewal"
  | "renewal_payment"
  | "payment_received";

function numberValue(value: unknown) {
  const parsed = Number(value ?? 0);

  return Number.isFinite(parsed)
    ? parsed
    : 0;
}

function money(value: unknown) {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 0,
  }).format(numberValue(value));
}

function dateValue(value?: string | null) {
  if (!value) return null;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

function formatDate(value?: string | null) {
  const date = dateValue(value);

  if (!date) return "—";

  return new Intl.DateTimeFormat(
    "tr-TR",
    {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }
  ).format(date);
}

function formatDateTime(value?: string | null) {
  const date = dateValue(value);

  if (!date) return "—";

  return new Intl.DateTimeFormat(
    "tr-TR",
    {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }
  ).format(date);
}

function startOfToday() {
  const today = new Date();

  today.setHours(0, 0, 0, 0);

  return today;
}

function endOfToday() {
  const today = new Date();

  today.setHours(
    23,
    59,
    59,
    999
  );

  return today;
}

function endOfNextSevenDays() {
  const date = endOfToday();

  date.setDate(
    date.getDate() + 7
  );

  return date;
}

function isBetween(
  value: string | null | undefined,
  start: Date,
  end: Date
) {
  const date = dateValue(value);

  if (!date) return false;

  return (
    date.getTime() >=
      start.getTime() &&
    date.getTime() <=
      end.getTime()
  );
}

function isPast(
  value?: string | null
) {
  const date = dateValue(value);

  if (!date) return false;

  return (
    date.getTime() <
    startOfToday().getTime()
  );
}

function normalizePhone(
  value?: string | null
) {
  if (!value) return "";

  let phone =
    value.replace(/\D/g, "");

  if (
    phone.startsWith("0") &&
    phone.length === 11
  ) {
    phone =
      "90" + phone.slice(1);
  }

  if (
    phone.length === 10 &&
    phone.startsWith("5")
  ) {
    phone = "90" + phone;
  }

  return phone;
}

function studentName(
  student: PaymentStudent
) {
  return `${student.first_name} ${student.last_name}`.trim();
}

function renewalSoon(
  student: PaymentStudent
) {
  if (
    student.remaining_lessons <= 3
  ) {
    return true;
  }

  return isBetween(
    student.end_date,
    startOfToday(),
    endOfNextSevenDays()
  );
}

function paymentDueThisWeek(
  student: PaymentStudent
) {
  if (
    student.remaining_payment <= 0
  ) {
    return false;
  }

  return isBetween(
    student.due_date,
    startOfToday(),
    endOfNextSevenDays()
  );
}

function suggestedMessage(
  student: PaymentStudent
): MessageType {
  const renewal =
    renewalSoon(student);

  const hasDebt =
    student.remaining_payment > 0;

  if (
    renewal &&
    hasDebt
  ) {
    return "renewal_payment";
  }

  if (
    hasDebt &&
    student.due_date &&
    isPast(student.due_date)
  ) {
    return "payment_overdue";
  }

  if (
    hasDebt &&
    paymentDueThisWeek(student)
  ) {
    return "payment_due";
  }

  if (renewal) {
    return "renewal";
  }

  if (hasDebt) {
    return "payment_reminder";
  }

  return "payment_received";
}

function messageLabel(
  type: MessageType
) {
  switch (type) {
    case "smart":
      return "Akıllı Öneri";

    case "payment_reminder":
      return "Ödeme Hatırlatma";

    case "payment_due":
      return "Ödeme Tarihi Geldi";

    case "payment_overdue":
      return "Gecikmiş Ödeme";

    case "renewal":
      return "Kayıt Yenileme";

    case "renewal_payment":
      return "Kayıt Yenileme + Ödeme";

    case "payment_received":
      return "Ödeme Alındı";

    default:
      return "Mesaj";
  }
}

function buildMessage(
  student: PaymentStudent,
  requestedType: MessageType
) {
  const type =
    requestedType === "smart"
      ? suggestedMessage(student)
      : requestedType;

  const name =
    studentName(student);

  const greeting =
    student.is_adult
      ? `Değerli Kursiyerimiz, *${name}*`
      : `Değerli Velimiz,\n*${name}* isimli öğrencimiz`;

  const packageName =
    student.package_name ||
    "Aktif Paket";

  const footer =
    `\n\n☎️ *SPRİNT BİLGİLENDİRME HATTI*\n` +
    `+90 (551) 896 83 19\n\n` +
    `_Bilginize sunar, iyi günler dileriz._\n` +
    `*SPRİNT YÜZME OKULU*`;

  if (
    type ===
    "renewal_payment"
  ) {
    return (
      `*SPRİNT YÜZME OKULU*\n\n` +
      `_*KAYIT YENİLEME VE ÖDEME BİLGİLENDİRMESİ*_\n\n` +
      `${greeting}\n\n` +
      `Kayıt yenileme dönemi yaklaşmaktadır.\n\n` +
      `🏊 *Mevcut Paket:* ${packageName}\n` +
      `⏳ *Kalan Ders:* ${student.remaining_lessons}\n` +
      `📅 *Planlanan Kayıt Bitişi:* ${formatDate(student.end_date)}\n\n` +
      `💰 *Mevcut Dönem Kalan Ödeme:* ${money(student.remaining_payment)}\n` +
      `🔄 *Yeni Dönem:* ${packageName}\n` +
      `💳 *Yeni Dönem Kayıt Ücreti:* ${money(student.package_price)}\n\n` +
      `Ders planlamasının kesintiye uğramaması için kayıt yenileme ve mevcut dönem ödeme işlemlerinin tamamlanmasını rica ederiz.` +
      footer
    );
  }

  if (type === "renewal") {
    return (
      `*SPRİNT YÜZME OKULU*\n\n` +
      `_*KAYIT YENİLEME BİLGİLENDİRMESİ*_\n\n` +
      `${greeting}\n\n` +
      `Kayıt yenileme dönemi yaklaşmaktadır.\n\n` +
      `🏊 *Mevcut Paket:* ${packageName}\n` +
      `⏳ *Kalan Ders:* ${student.remaining_lessons}\n` +
      `📅 *Planlanan Kayıt Bitişi:* ${formatDate(student.end_date)}\n\n` +
      `🔄 *Yeni Dönem:* ${packageName}\n` +
      `💳 *Yeni Dönem Kayıt Ücreti:* ${money(student.package_price)}\n\n` +
      `Ders programının kesintiye uğramaması için kayıt yenileme işleminizi zamanında tamamlamanızı rica ederiz.` +
      footer
    );
  }

  if (
    type ===
    "payment_due"
  ) {
    return (
      `*SPRİNT YÜZME OKULU*\n\n` +
      `_*ÖDEME TARİHİ HATIRLATMASI*_\n\n` +
      `${greeting}\n\n` +
      `Aktif kurs kaydınıza ait ödeme tarihi gelmiştir.\n\n` +
      `💳 *Aktif Paket:* ${packageName}\n` +
      `💰 *Paket Tutarı:* ${money(student.package_price)}\n` +
      `✅ *Mevcut Dönemde Alınan:* ${money(student.total_paid)}\n` +
      `🔴 *Mevcut Dönem Kalan Ödeme:* ${money(student.remaining_payment)}\n` +
      `📅 *Ödeme Tarihi:* ${formatDate(student.due_date)}\n\n` +
      `Kalan ödemenin tamamlanmasını rica ederiz.` +
      footer
    );
  }

  if (
    type ===
    "payment_overdue"
  ) {
    return (
      `*SPRİNT YÜZME OKULU*\n\n` +
      `_*GECİKMİŞ ÖDEME BİLGİLENDİRMESİ*_\n\n` +
      `${greeting}\n\n` +
      `Aktif kurs kaydınıza ait ödeme tarihinin geçtiğini hatırlatmak isteriz.\n\n` +
      `💳 *Aktif Paket:* ${packageName}\n` +
      `💰 *Mevcut Dönem Kalan Ödeme:* ${money(student.remaining_payment)}\n` +
      `📅 *Ödeme Tarihi:* ${formatDate(student.due_date)}\n\n` +
      `Ödeme işleminizin en kısa sürede tamamlanmasını rica ederiz.` +
      footer
    );
  }

  if (
    type ===
    "payment_received"
  ) {
    return (
      `*SPRİNT YÜZME OKULU*\n\n` +
      `_*ÖDEME BİLGİLENDİRMESİ*_\n\n` +
      `${greeting}\n\n` +
      `Aktif kurs kaydınıza ait ödeme işlemi tamamlanmıştır.\n\n` +
      `💳 *Aktif Paket:* ${packageName}\n` +
      `✅ *Toplam Tahsilat:* ${money(student.total_paid)}\n` +
      `🟢 *Kalan Ödeme:* ${money(student.remaining_payment)}\n\n` +
      `Ödemeniz için teşekkür ederiz.` +
      footer
    );
  }

  return (
    `*SPRİNT YÜZME OKULU*\n\n` +
    `_*ÖDEME HATIRLATMASI*_\n\n` +
    `${greeting}\n\n` +
    `Aktif kurs kaydınıza ait ödeme bilgileri aşağıdadır.\n\n` +
    `💳 *Aktif Paket:* ${packageName}\n` +
    `💰 *Paket Tutarı:* ${money(student.package_price)}\n` +
    `✅ *Mevcut Dönemde Alınan:* ${money(student.total_paid)}\n` +
    `🔴 *Mevcut Dönem Kalan Ödeme:* ${money(student.remaining_payment)}\n\n` +
    `Ödeme planınızla ilgili bilgi almak için bizimle iletişime geçebilirsiniz.` +
    footer
  );
}

export default function PaymentsClient({
  students,
  payments,
  currentProfileId,
}: Props) {
  const [search, setSearch] =
    useState("");

  const [
    branchFilter,
    setBranchFilter,
  ] = useState("all");

  const [
    quickFilter,
    setQuickFilter,
  ] =
    useState<QuickFilter>("all");

  const [
    selectedStudent,
    setSelectedStudent,
  ] =
    useState<PaymentStudent | null>(
      null
    );

  const [
    messageStudent,
    setMessageStudent,
  ] =
    useState<PaymentStudent | null>(
      null
    );

  const [
    messageType,
    setMessageType,
  ] =
    useState<MessageType>("smart");

  const [
    messageText,
    setMessageText,
  ] =
    useState("");

  const [
    historyStudent,
    setHistoryStudent,
  ] =
    useState<PaymentStudent | null>(
      null
    );

  /*
   * ------------------------------------------------
   * ÖZETLER
   * ------------------------------------------------
   */

  const todayStart =
    startOfToday();

  const todayEnd =
    endOfToday();

  const monthStart =
    new Date(
      todayStart.getFullYear(),
      todayStart.getMonth(),
      1
    );

  const validPayments =
    useMemo(
      () =>
        payments.filter(
          (payment) =>
            !payment.cancelled_at &&
            payment.payment_status !==
              "cancelled"
        ),
      [payments]
    );

  const todayCollection =
    useMemo(
      () =>
        validPayments
          .filter((payment) =>
            isBetween(
              payment.received_at,
              todayStart,
              todayEnd
            )
          )
          .reduce(
            (sum, payment) =>
              sum +
              numberValue(
                payment.amount
              ),
            0
          ),
      [validPayments]
    );

  const monthCollection =
    useMemo(
      () =>
        validPayments
          .filter((payment) =>
            isBetween(
              payment.received_at,
              monthStart,
              todayEnd
            )
          )
          .reduce(
            (sum, payment) =>
              sum +
              numberValue(
                payment.amount
              ),
            0
          ),
      [validPayments]
    );

  const outstandingTotal =
    useMemo(
      () =>
        students.reduce(
          (sum, student) =>
            sum +
            numberValue(
              student.remaining_payment
            ),
          0
        ),
      [students]
    );

  const unpaidCount =
    students.filter(
      (student) =>
        student.package_price > 0 &&
        student.total_paid <= 0
    ).length;

  const partialCount =
    students.filter(
      (student) =>
        student.total_paid > 0 &&
        student.remaining_payment > 0
    ).length;

  const paidCount =
    students.filter(
      (student) =>
        student.package_price > 0 &&
        student.remaining_payment <= 0
    ).length;

  const cashPendingAmount =
    validPayments
      .filter((payment) =>
        [
          "with_staff",
          "handoff_pending",
        ].includes(
          payment.cash_handover_status ||
            ""
        )
      )
      .reduce(
        (sum, payment) =>
          sum +
          numberValue(payment.amount),
        0
      );

  /*
   * ------------------------------------------------
   * ŞUBELER
   * ------------------------------------------------
   */

  const branches =
    useMemo(() => {
      const map = new Map<
        string,
        string
      >();

      for (const student of students) {
        if (
          student.branch_id &&
          student.branch_name
        ) {
          map.set(
            student.branch_id,
            student.branch_name
          );
        }
      }

      return Array.from(
        map.entries()
      )
        .map(([id, name]) => ({
          id,
          name,
        }))
        .sort((a, b) =>
          a.name.localeCompare(
            b.name,
            "tr"
          )
        );
    }, [students]);

  /*
   * ------------------------------------------------
   * FİLTRE
   * ------------------------------------------------
   */

  const filteredStudents =
    useMemo(() => {
      const query =
        search
          .trim()
          .toLocaleLowerCase(
            "tr-TR"
          );

      let result =
        students.filter(
          (student) => {
            const searchable = [
              studentName(student),
              student.student_number,
              student.phone,
              student.guardian_phone,
              student.branch_name,
              student.group_name,
              student.package_name,
            ]
              .filter(Boolean)
              .join(" ")
              .toLocaleLowerCase(
                "tr-TR"
              );

            if (
              query &&
              !searchable.includes(query)
            ) {
              return false;
            }

            if (
              branchFilter !== "all" &&
              student.branch_id !==
                branchFilter
            ) {
              return false;
            }

            return true;
          }
        );

      switch (quickFilter) {
        case "three_lessons":
          result = result.filter(
            (student) =>
              student.remaining_lessons ===
              3
          );
          break;

        case "two_lessons":
          result = result.filter(
            (student) =>
              student.remaining_lessons ===
              2
          );
          break;

        case "one_lesson":
          result = result.filter(
            (student) =>
              student.remaining_lessons ===
              1
          );
          break;

        case "finished":
          result = result.filter(
            (student) =>
              student.remaining_lessons <=
              0
          );
          break;

        case "ending_week":
        case "renew_week":
          result = result.filter(
            renewalSoon
          );
          break;

        case "payment_week":
          result = result.filter(
            paymentDueThisWeek
          );
          break;

        case "renew_and_payment":
          result = result.filter(
            (student) =>
              renewalSoon(student) &&
              student.remaining_payment >
                0
          );
          break;

        case "no_payment":
          result = result.filter(
            (student) =>
              student.package_price > 0 &&
              student.total_paid <= 0
          );
          break;

        case "partial":
          result = result.filter(
            (student) =>
              student.total_paid > 0 &&
              student.remaining_payment >
                0
          );
          break;

        case "paid":
          result = result.filter(
            (student) =>
              student.package_price > 0 &&
              student.remaining_payment <=
                0
          );
          break;

        case "cash_pending":
          result = result.filter(
            (student) =>
              student.payments.some(
                (payment) =>
                  [
                    "with_staff",
                    "handoff_pending",
                  ].includes(
                    payment.cash_handover_status ||
                      ""
                  )
              )
          );
          break;

        case "latest_payment":
          result = result
            .filter(
              (student) =>
                !!student.last_payment_at
            )
            .sort(
              (a, b) =>
                (dateValue(
                  b.last_payment_at
                )?.getTime() || 0) -
                (dateValue(
                  a.last_payment_at
                )?.getTime() || 0)
            );
          break;
      }

      if (
        quickFilter !==
        "latest_payment"
      ) {
        result.sort((a, b) =>
          studentName(a).localeCompare(
            studentName(b),
            "tr"
          )
        );
      }

      return result;
    }, [
      students,
      search,
      branchFilter,
      quickFilter,
    ]);

  function openMessage(
    student: PaymentStudent,
    type: MessageType = "smart"
  ) {
    setMessageStudent(student);
    setMessageType(type);

    setMessageText(
      buildMessage(
        student,
        type
      )
    );
  }

  function changeMessageType(
    type: MessageType
  ) {
    setMessageType(type);

    if (messageStudent) {
      setMessageText(
        buildMessage(
          messageStudent,
          type
        )
      );
    }
  }

  function openWhatsApp() {
    if (!messageStudent) return;

    const phone =
      normalizePhone(
        messageStudent.contact_phone
      );

    if (!phone) {
      alert(
        "Bu öğrenci için iletişim numarası bulunamadı."
      );

      return;
    }

    const url =
      `https://wa.me/${phone}` +
      `?text=${encodeURIComponent(
        messageText
      )}`;

    window.open(
      url,
      "_blank",
      "noopener,noreferrer"
    );
  }

  const quickButtons: {
    key: QuickFilter;
    label: string;
  }[] = [
    {
      key: "all",
      label: "Tümü",
    },
    {
      key: "three_lessons",
      label: "3 Ders Kalan",
    },
    {
      key: "two_lessons",
      label: "2 Ders Kalan",
    },
    {
      key: "one_lesson",
      label: "1 Ders Kalan",
    },
    {
      key: "ending_week",
      label: "Son Haftaya Girenler",
    },
    {
      key: "finished",
      label: "Ders Hakkı Biten",
    },
    {
      key: "renew_week",
      label:
        "Bu Hafta Yenileyecek",
    },
    {
      key: "payment_week",
      label:
        "Bu Hafta Ödeme Yapacak",
    },
    {
      key: "renew_and_payment",
      label:
        "Ödeme + Yenileme",
    },
    {
      key: "no_payment",
      label: "Ödeme Yapmayan",
    },
    {
      key: "partial",
      label: "Kısmi Ödeme",
    },
    {
      key: "paid",
      label: "Tam Ödeme",
    },
    {
      key: "latest_payment",
      label: "Son Ödeme Yapanlar",
    },
    {
      key: "cash_pending",
      label: "Kasa Teslim Bekleyen",
    },
  ];

  return (
    <>
      <section className="paymentSummaryGrid">
        <button
          type="button"
          className="paymentSummaryCard"
          onClick={() =>
            setQuickFilter("all")
          }
        >
          <span>
            Bu Ay Tahsilat
          </span>
          <strong>
            {money(monthCollection)}
          </strong>
        </button>

        <button
          type="button"
          className="paymentSummaryCard"
          onClick={() =>
            setQuickFilter("all")
          }
        >
          <span>
            Bugün Tahsilat
          </span>
          <strong>
            {money(todayCollection)}
          </strong>
        </button>

        <button
          type="button"
          className="paymentSummaryCard danger"
          onClick={() =>
            setQuickFilter("no_payment")
          }
        >
          <span>
            Bekleyen Alacak
          </span>
          <strong>
            {money(outstandingTotal)}
          </strong>
        </button>

        <button
          type="button"
          className="paymentSummaryCard"
          onClick={() =>
            setQuickFilter("no_payment")
          }
        >
          <span>
            Ödeme Yapmayan
          </span>
          <strong>
            {unpaidCount}
          </strong>
        </button>

        <button
          type="button"
          className="paymentSummaryCard warning"
          onClick={() =>
            setQuickFilter("partial")
          }
        >
          <span>
            Kısmi Ödeme
          </span>
          <strong>
            {partialCount}
          </strong>
        </button>

        <button
          type="button"
          className="paymentSummaryCard success"
          onClick={() =>
            setQuickFilter("paid")
          }
        >
          <span>
            Tamamlanan
          </span>
          <strong>
            {paidCount}
          </strong>
        </button>

        <button
          type="button"
          className="paymentSummaryCard warning"
          onClick={() =>
            setQuickFilter(
              "cash_pending"
            )
          }
        >
          <span>
            Kasa Teslim Bekleyen
          </span>
          <strong>
            {money(
              cashPendingAmount
            )}
          </strong>
        </button>
      </section>

      <section className="paymentQuickSection">
        <div className="paymentQuickTitle">
          <div>
            <p>
              HIZLI TAKİP
            </p>

            <h2>
              Akıllı Filtreler
            </h2>
          </div>

          <span>
            {filteredStudents.length} öğrenci
          </span>
        </div>

        <div className="paymentQuickButtons">
          {quickButtons.map(
            (button) => (
              <button
                type="button"
                key={button.key}
                className={
                  quickFilter ===
                  button.key
                    ? "active"
                    : ""
                }
                onClick={() =>
                  setQuickFilter(
                    button.key
                  )
                }
              >
                {button.label}
              </button>
            )
          )}
        </div>
      </section>

      <section className="paymentToolbar">
        <input
          type="search"
          value={search}
          onChange={(event) =>
            setSearch(
              event.target.value
            )
          }
          placeholder="Öğrenci, telefon, öğrenci no, grup veya paket ara..."
        />

        <select
          value={branchFilter}
          onChange={(event) =>
            setBranchFilter(
              event.target.value
            )
          }
        >
          <option value="all">
            Tüm Şubeler
          </option>

          {branches.map(
            (branch) => (
              <option
                key={branch.id}
                value={branch.id}
              >
                {branch.name}
              </option>
            )
          )}
        </select>

        <button
          type="button"
          onClick={() => {
            setSearch("");
            setBranchFilter("all");
            setQuickFilter("all");
          }}
        >
          Filtreleri Temizle
        </button>
      </section>

      <section className="paymentStudentGrid">
        {filteredStudents.map(
          (student) => {
            const suggested =
              suggestedMessage(
                student
              );

            const paymentStatus =
              student.package_price <= 0
                ? "Paket Ücreti Tanımsız"
                : student.total_paid <=
                    0
                ? "Ödeme Yapılmadı"
                : student.remaining_payment >
                    0
                ? "Kısmi Ödeme"
                : "Ödeme Tamamlandı";

            return (
              <article
                className="paymentStudentCard"
                key={student.id}
              >
                <div className="paymentCardTop">
                  <div>
                    <p>
                      {student.student_number ||
                        "ÖĞRENCİ"}
                    </p>

                    <h3>
                      {studentName(
                        student
                      )}
                    </h3>

                    <span>
                      {student.branch_name ||
                        "Şube yok"}
                      {" · "}
                      {student.group_name ||
                        "Grup yok"}
                    </span>
                  </div>

                  <div
                    className={
                      student.remaining_payment >
                      0
                        ? "paymentState debt"
                        : "paymentState paid"
                    }
                  >
                    {paymentStatus}
                  </div>
                </div>

                <div className="paymentPackageBox">
                  <div>
                    <span>
                      Aktif Paket
                    </span>
                    <strong>
                      {student.package_name ||
                        "—"}
                    </strong>
                  </div>

                  <div>
                    <span>
                      Kalan Ders
                    </span>
                    <strong>
                      {
                        student.remaining_lessons
                      }
                    </strong>
                  </div>

                  <div>
                    <span>
                      Kayıt Bitişi
                    </span>
                    <strong>
                      {formatDate(
                        student.end_date
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>
                      Ödeme Vadesi
                    </span>
                    <strong>
                      {formatDate(
                        student.due_date
                      )}
                    </strong>
                  </div>
                </div>

                <div className="paymentMoneyStrip">
                  <div>
                    <span>
                      Paket Ücreti
                    </span>
                    <strong>
                      {money(
                        student.package_price
                      )}
                    </strong>
                  </div>

                  <div className="received">
                    <span>
                      Alınan
                    </span>
                    <strong>
                      {money(
                        student.total_paid
                      )}
                    </strong>
                  </div>

                  <div
                    className={
                      student.remaining_payment >
                      0
                        ? "remaining debt"
                        : "remaining"
                    }
                  >
                    <span>
                      Kalan
                    </span>
                    <strong>
                      {money(
                        student.remaining_payment
                      )}
                    </strong>
                  </div>
                </div>

                <div className="paymentSuggestion">
                  <div>
                    <span>
                      💡 Önerilen Mesaj
                    </span>

                    <strong>
                      {messageLabel(
                        suggested
                      )}
                    </strong>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      openMessage(
                        student,
                        "smart"
                      )
                    }
                  >
                    Mesajı Aç
                  </button>
                </div>

                <div className="paymentContact">
                  <span>
                    İletişim
                  </span>

                  <strong>
                    {student.contact_phone ||
                      "Telefon bilgisi yok"}
                  </strong>
                </div>

                <div className="paymentActions">
                  <button
                    type="button"
                    className="primaryPaymentButton"
                    onClick={() =>
                      setSelectedStudent(
                        student
                      )
                    }
                  >
                    + Ödeme Al
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setHistoryStudent(
                        student
                      )
                    }
                  >
                    Ödeme Geçmişi
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      openMessage(
                        student,
                        "smart"
                      )
                    }
                  >
                    WhatsApp Mesaj
                  </button>

                  <Link
                    href={`/ogrenciler/${student.id}`}
                  >
                    Öğrenci Dosyası
                  </Link>
                </div>

                {student.last_payment_at ? (
                  <div className="paymentLastInfo">
                    Son ödeme:{" "}
                    <strong>
                      {formatDateTime(
                        student.last_payment_at
                      )}
                    </strong>

                    {student.last_payment_method
                      ? ` · ${student.last_payment_method}`
                      : ""}
                  </div>
                ) : null}
              </article>
            );
          }
        )}

        {!filteredStudents.length ? (
          <div className="paymentEmpty">
            Seçilen filtrelere uygun öğrenci bulunamadı.
          </div>
        ) : null}
      </section>

      {selectedStudent ? (
        <div className="paymentModalBackdrop">
          <div className="paymentModal">
            <div className="paymentModalHeader">
              <div>
                <p>
                  YENİ TAHSİLAT
                </p>

                <h2>
                  {studentName(
                    selectedStudent
                  )}
                </h2>
              </div>

              <button
                type="button"
                onClick={() =>
                  setSelectedStudent(
                    null
                  )
                }
              >
                ×
              </button>
            </div>

            <div className="paymentModalNotice">
              <strong>
                Aktif Paket:{" "}
                {selectedStudent.package_name ||
                  "—"}
              </strong>

              <span>
                Paket:{" "}
                {money(
                  selectedStudent.package_price
                )}
                {" · "}
                Alınan:{" "}
                {money(
                  selectedStudent.total_paid
                )}
                {" · "}
                Kalan:{" "}
                {money(
                  selectedStudent.remaining_payment
                )}
              </span>
            </div>

            <div className="paymentComingSoon">
              Ödeme giriş formu bir sonraki
              <strong>
                {" "}
                actions.ts
              </strong>
              {" "}
              bağlantısında aktif olacaktır.
              Bu pencere şimdilik öğrenci ve aktif paket bilgisinin doğru
              bağlandığını kontrol etmek için hazırlandı.
            </div>

            <button
              type="button"
              className="paymentCloseButton"
              onClick={() =>
                setSelectedStudent(null)
              }
            >
              Kapat
            </button>
          </div>
        </div>
      ) : null}

      {historyStudent ? (
        <div className="paymentModalBackdrop">
          <div className="paymentModal historyModal">
            <div className="paymentModalHeader">
              <div>
                <p>
                  ÖDEME GEÇMİŞİ
                </p>

                <h2>
                  {studentName(
                    historyStudent
                  )}
                </h2>
              </div>

              <button
                type="button"
                onClick={() =>
                  setHistoryStudent(
                    null
                  )
                }
              >
                ×
              </button>
            </div>

            <div className="paymentHistoryList">
              {historyStudent.payments.map(
                (payment) => (
                  <div
                    key={payment.id}
                    className="paymentHistoryItem"
                  >
                    <div>
                      <strong>
                        {money(
                          payment.amount
                        )}
                      </strong>

                      <span>
                        {payment.payment_method ||
                          "Yöntem belirtilmedi"}
                      </span>
                    </div>

                    <div>
                      <strong>
                        {formatDateTime(
                          payment.received_at
                        )}
                      </strong>

                      <span>
                        {payment.description ||
                          "Açıklama yok"}
                      </span>
                    </div>

                    <div>
                      <span>
                        Kasa Durumu
                      </span>

                      <strong>
                        {payment.cash_handover_status ||
                          "—"}
                      </strong>
                    </div>
                  </div>
                )
              )}

              {!historyStudent.payments.length ? (
                <div className="paymentEmpty">
                  Bu aktif paket için henüz ödeme hareketi bulunmuyor.
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {messageStudent ? (
        <div className="paymentModalBackdrop">
          <div className="paymentModal messageModal">
            <div className="paymentModalHeader">
              <div>
                <p>
                  WHATSAPP MESAJ MERKEZİ
                </p>

                <h2>
                  {studentName(
                    messageStudent
                  )}
                </h2>
              </div>

              <button
                type="button"
                onClick={() =>
                  setMessageStudent(null)
                }
              >
                ×
              </button>
            </div>

            <label className="paymentField">
              <span>
                Mesaj Türü
              </span>

              <select
                value={messageType}
                onChange={(event) =>
                  changeMessageType(
                    event.target
                      .value as MessageType
                  )
                }
              >
                <option value="smart">
                  Akıllı Öneri
                </option>

                <option value="payment_reminder">
                  Ödeme Hatırlatma
                </option>

                <option value="payment_due">
                  Ödeme Tarihi Geldi
                </option>

                <option value="payment_overdue">
                  Gecikmiş Ödeme
                </option>

                <option value="renewal">
                  Kayıt Yenileme
                </option>

                <option value="renewal_payment">
                  Kayıt Yenileme + Ödeme
                </option>

                <option value="payment_received">
                  Ödeme Alındı
                </option>
              </select>
            </label>

            <div className="paymentMessageInfo">
              <div>
                <span>
                  Aktif Paket
                </span>

                <strong>
                  {messageStudent.package_name ||
                    "—"}
                </strong>
              </div>

              <div>
                <span>
                  Kalan Ders
                </span>

                <strong>
                  {
                    messageStudent.remaining_lessons
                  }
                </strong>
              </div>

              <div>
                <span>
                  Mevcut Dönem Borcu
                </span>

                <strong>
                  {money(
                    messageStudent.remaining_payment
                  )}
                </strong>
              </div>

              <div>
                <span>
                  Yeni Dönem Ücreti
                </span>

                <strong>
                  {money(
                    messageStudent.package_price
                  )}
                </strong>
              </div>
            </div>

            <label className="paymentField">
              <span>
                Mesaj Önizleme
              </span>

              <textarea
                value={messageText}
                onChange={(event) =>
                  setMessageText(
                    event.target.value
                  )
                }
                rows={18}
              />
            </label>

            <div className="paymentModalActions">
              <button
                type="button"
                onClick={() =>
                  setMessageText(
                    buildMessage(
                      messageStudent,
                      messageType
                    )
                  )
                }
              >
                Mesajı Yenile
              </button>

              <button
                type="button"
                className="whatsappButton"
                onClick={openWhatsApp}
              >
                WhatsApp'ta Aç
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <style jsx>{`
        .paymentSummaryGrid {
          display: grid;
          grid-template-columns: repeat(
            4,
            minmax(0, 1fr)
          );
          gap: 12px;
          margin-bottom: 16px;
        }

        .paymentSummaryCard {
          appearance: none;
          border: 1px solid #dbe5f1;
          background: #fff;
          border-radius: 18px;
          padding: 18px;
          text-align: left;
          cursor: pointer;
          min-height: 100px;
        }

        .paymentSummaryCard span {
          display: block;
          color: #64748b;
          font-size: 12px;
          font-weight: 700;
          margin-bottom: 8px;
        }

        .paymentSummaryCard strong {
          color: #10213a;
          font-size: 23px;
        }

        .paymentSummaryCard.danger {
          border-color: #fecaca;
        }

        .paymentSummaryCard.warning {
          border-color: #fed7aa;
        }

        .paymentSummaryCard.success {
          border-color: #bbf7d0;
        }

        .paymentQuickSection,
        .paymentToolbar {
          background: #fff;
          border: 1px solid #dbe5f1;
          border-radius: 18px;
          padding: 16px;
          margin-bottom: 16px;
        }

        .paymentQuickTitle {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 16px;
          margin-bottom: 12px;
        }

        .paymentQuickTitle p,
        .paymentModalHeader p {
          margin: 0 0 4px;
          color: #2563eb;
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 0.08em;
        }

        .paymentQuickTitle h2,
        .paymentModalHeader h2 {
          margin: 0;
          color: #10213a;
        }

        .paymentQuickButtons {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .paymentQuickButtons button {
          border: 1px solid #dbe5f1;
          background: #f8fafc;
          border-radius: 12px;
          padding: 9px 12px;
          font-weight: 800;
          color: #334155;
          cursor: pointer;
        }

        .paymentQuickButtons button.active {
          background: #156ff5;
          border-color: #156ff5;
          color: #fff;
        }

        .paymentToolbar {
          display: grid;
          grid-template-columns:
            minmax(0, 1fr)
            260px
            auto;
          gap: 10px;
        }

        .paymentToolbar input,
        .paymentToolbar select,
        .paymentToolbar button,
        .paymentField select,
        .paymentField textarea {
          width: 100%;
          box-sizing: border-box;
          border: 1px solid #dbe5f1;
          border-radius: 12px;
          background: #fff;
          padding: 11px 13px;
          font: inherit;
          color: #10213a;
        }

        .paymentToolbar button {
          width: auto;
          cursor: pointer;
          font-weight: 800;
        }

        .paymentStudentGrid {
          display: grid;
          grid-template-columns:
            repeat(
              2,
              minmax(0, 1fr)
            );
          gap: 14px;
        }

        .paymentStudentCard {
          background: #fff;
          border: 1px solid #dbe5f1;
          border-radius: 20px;
          padding: 18px;
        }

        .paymentCardTop {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 14px;
          margin-bottom: 14px;
        }

        .paymentCardTop p {
          margin: 0 0 4px;
          color: #1570ef;
          font-size: 11px;
          font-weight: 900;
        }

        .paymentCardTop h3 {
          margin: 0 0 4px;
          color: #10213a;
          font-size: 19px;
        }

        .paymentCardTop span {
          color: #64748b;
          font-size: 12px;
        }

        .paymentState {
          border-radius: 999px;
          padding: 7px 10px;
          font-size: 11px;
          font-weight: 900;
          white-space: nowrap;
        }

        .paymentState.debt {
          color: #b42318;
          background: #fee4e2;
        }

        .paymentState.paid {
          color: #067647;
          background: #dcfae6;
        }

        .paymentPackageBox {
          display: grid;
          grid-template-columns:
            repeat(4, minmax(0, 1fr));
          border: 1px solid #e2e8f0;
          border-radius: 14px;
          overflow: hidden;
          margin-bottom: 12px;
        }

        .paymentPackageBox > div {
          padding: 11px;
          border-right: 1px solid #e2e8f0;
        }

        .paymentPackageBox > div:last-child {
          border-right: 0;
        }

        .paymentPackageBox span,
        .paymentMoneyStrip span,
        .paymentMessageInfo span,
        .paymentContact span,
        .paymentHistoryItem span {
          display: block;
          color: #64748b;
          font-size: 10px;
          margin-bottom: 4px;
        }

        .paymentPackageBox strong,
        .paymentMoneyStrip strong {
          font-size: 13px;
          color: #10213a;
        }

        .paymentMoneyStrip {
          display: grid;
          grid-template-columns:
            repeat(3, minmax(0, 1fr));
          border-radius: 14px;
          background: #f8fafc;
          margin-bottom: 12px;
        }

        .paymentMoneyStrip > div {
          padding: 13px;
          text-align: center;
        }

        .paymentMoneyStrip .received strong {
          color: #067647;
        }

        .paymentMoneyStrip .debt strong {
          color: #b42318;
        }

        .paymentSuggestion {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 10px;
          border: 1px solid #bfdbfe;
          background: #eff6ff;
          border-radius: 14px;
          padding: 11px 12px;
          margin-bottom: 12px;
        }

        .paymentSuggestion span {
          display: block;
          font-size: 10px;
          color: #2563eb;
        }

        .paymentSuggestion strong {
          color: #10213a;
          font-size: 13px;
        }

        .paymentSuggestion button {
          border: 0;
          border-radius: 10px;
          background: #156ff5;
          color: #fff;
          font-weight: 800;
          padding: 9px 11px;
          cursor: pointer;
        }

        .paymentContact {
          margin-bottom: 12px;
        }

        .paymentActions {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .paymentActions button,
        .paymentActions a {
          border: 1px solid #dbe5f1;
          border-radius: 10px;
          background: #fff;
          color: #10213a;
          padding: 9px 11px;
          font-size: 12px;
          font-weight: 800;
          text-decoration: none;
          cursor: pointer;
        }

        .paymentActions .primaryPaymentButton {
          background: #156ff5;
          border-color: #156ff5;
          color: #fff;
        }

        .paymentLastInfo {
          color: #64748b;
          font-size: 11px;
          margin-top: 11px;
        }

        .paymentEmpty {
          grid-column: 1 / -1;
          background: #fff;
          border: 1px solid #dbe5f1;
          border-radius: 16px;
          padding: 30px;
          color: #64748b;
          text-align: center;
        }

        .paymentModalBackdrop {
          position: fixed;
          inset: 0;
          z-index: 1000;
          background: rgba(
            15,
            23,
            42,
            0.58
          );
          display: flex;
          justify-content: center;
          align-items: center;
          padding: 18px;
        }

        .paymentModal {
          width: min(
            680px,
            100%
          );
          max-height: 92vh;
          overflow: auto;
          background: #fff;
          border-radius: 22px;
          padding: 20px;
          box-shadow:
            0 30px 80px
            rgba(
              15,
              23,
              42,
              0.25
            );
        }

        .historyModal,
        .messageModal {
          width: min(
            780px,
            100%
          );
        }

        .paymentModalHeader {
          display: flex;
          justify-content: space-between;
          gap: 15px;
          align-items: flex-start;
          margin-bottom: 16px;
        }

        .paymentModalHeader > button {
          border: 0;
          width: 36px;
          height: 36px;
          border-radius: 10px;
          background: #f1f5f9;
          font-size: 22px;
          cursor: pointer;
        }

        .paymentModalNotice,
        .paymentComingSoon {
          border-radius: 14px;
          padding: 14px;
          margin-bottom: 14px;
        }

        .paymentModalNotice {
          background: #eff6ff;
        }

        .paymentModalNotice span {
          display: block;
          margin-top: 5px;
          color: #475569;
        }

        .paymentComingSoon {
          background: #fff7ed;
          color: #9a3412;
        }

        .paymentCloseButton {
          width: 100%;
          border: 0;
          border-radius: 12px;
          background: #10213a;
          color: #fff;
          padding: 12px;
          font-weight: 800;
          cursor: pointer;
        }

        .paymentHistoryList {
          display: grid;
          gap: 9px;
        }

        .paymentHistoryItem {
          display: grid;
          grid-template-columns:
            1fr 1fr 1fr;
          gap: 10px;
          align-items: center;
          border: 1px solid #e2e8f0;
          border-radius: 13px;
          padding: 12px;
        }

        .paymentField {
          display: block;
          margin-bottom: 14px;
        }

        .paymentField > span {
          display: block;
          margin-bottom: 6px;
          color: #475569;
          font-size: 12px;
          font-weight: 800;
        }

        .paymentField textarea {
          resize: vertical;
          line-height: 1.55;
          min-height: 330px;
        }

        .paymentMessageInfo {
          display: grid;
          grid-template-columns:
            repeat(4, minmax(0, 1fr));
          gap: 8px;
          margin-bottom: 14px;
        }

        .paymentMessageInfo > div {
          background: #f8fafc;
          border-radius: 12px;
          padding: 11px;
        }

        .paymentModalActions {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
        }

        .paymentModalActions button {
          border: 1px solid #dbe5f1;
          background: #fff;
          border-radius: 11px;
          padding: 11px 14px;
          font-weight: 800;
          cursor: pointer;
        }

        .paymentModalActions .whatsappButton {
          border-color: #16a34a;
          background: #16a34a;
          color: #fff;
        }

        @media (
          max-width: 1100px
        ) {
          .paymentSummaryGrid {
            grid-template-columns:
              repeat(
                2,
                minmax(0, 1fr)
              );
          }

          .paymentStudentGrid {
            grid-template-columns: 1fr;
          }
        }

        @media (
          max-width: 720px
        ) {
          .paymentSummaryGrid {
            grid-template-columns:
              repeat(
                2,
                minmax(0, 1fr)
              );
          }

          .paymentToolbar {
            grid-template-columns: 1fr;
          }

          .paymentPackageBox {
            grid-template-columns:
              repeat(
                2,
                minmax(0, 1fr)
              );
          }

          .paymentPackageBox > div {
            border-bottom:
              1px solid #e2e8f0;
          }

          .paymentMoneyStrip {
            grid-template-columns:
              repeat(
                3,
                minmax(0, 1fr)
              );
          }

          .paymentMessageInfo {
            grid-template-columns:
              repeat(
                2,
                minmax(0, 1fr)
              );
          }

          .paymentHistoryItem {
            grid-template-columns: 1fr;
          }

          .paymentSuggestion {
            align-items: stretch;
            flex-direction: column;
          }
        }

        @media (
          max-width: 460px
        ) {
          .paymentSummaryGrid {
            grid-template-columns: 1fr;
          }

          .paymentMoneyStrip {
            grid-template-columns: 1fr;
          }

          .paymentMessageInfo {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </>
  );
}
