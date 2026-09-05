"use client";

import Link from "next/link";
import {
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { useFormStatus } from "react-dom";

import {
  addRegistrationNote,
  completeRegistration,
  requestCustomLessonCountApproval,
  saveRegistrationDraft,
} from "./actions";

/*
 * ============================================================
 * TİPLER
 * ============================================================
 */

type Branch = {
  id: string;
  name: string;
  location_url: string | null;
  contact_phone: string | null;
  material_list: string | null;
};

type Group = {
  id: string;
  name: string;
  branch_id: string;
  course_type: string;
  primary_coach_id: string | null;

  schedules: Array<{
    weekday: number;
    start_time: string;
    end_time: string;
  }>;
};

type Package = {
  id: string;
  name: string;
  lesson_count: number;
  price: number;
  course_type?: string | null;
};

type Coach = {
  id: string;
  full_name: string | null;
};

type Student = {
  id: string;

  student_number?: string | null;

  first_name: string;
  last_name: string;

  phone?: string | null;
  email?: string | null;

  guardian_name: string | null;
  guardian_phone: string | null;
  guardian_email?: string | null;

  branch_id?: string | null;

  preferred_group_id?: string | null;

  preferred_package_id?: string | null;

  preferred_days?: string | null;

  preferred_time?: string | null;

  swimming_level?: string | null;

  status?: string | null;

  registration_note?: string | null;

  birth_date?: string | null;

  created_at?: string | null;
};

type Consent = {
  student_id: string;

  registration_for?: string | null;

  health_declaration?: boolean | null;

  health_note?: string | null;

  rules_accepted?: boolean | null;

  whatsapp_permission?: boolean | null;

  contact_request?: string | null;

  rules_version?: string | null;

  form_version?: string | null;

  accepted_at?: string | null;

  form_snapshot?: unknown;
} | null;

type Draft = {
  student_id: string;

  enrollment_id?: string | null;

  payment_received?: boolean | null;

  health_declaration_received?: boolean | null;

  rules_accepted?: boolean | null;

  message_prepared?: boolean | null;

  message_sent?: boolean | null;

  location_sent?: boolean | null;

  swim_cap_delivered?: boolean | null;

  receipt_created?: boolean | null;

  draft_data?: Record<string, unknown> | null;

  draft_saved_at?: string | null;

  payment_due_date?: string | null;

  payment_due_date_manual?: boolean | null;

  payment_note?: string | null;

  message_draft?: string | null;

  updated_at?: string | null;
} | null;

type ActiveEnrollment = {
  id: string;

  student_id: string;

  package_id?: string | null;

  group_id?: string | null;

  start_date?: string | null;

  planned_end_date?: string | null;

  lesson_weekdays?: number[] | null;

  total_lessons?: number | null;

  used_lessons?: number | null;

  payment_due_date?: string | null;

  status?: string | null;

  created_at?: string | null;
} | null;

type Payment = {
  id: string;

  student_id: string;

  enrollment_id: string | null;

  amount: number;

  currency?: string | null;

  payment_method?: string | null;

  payment_status?: string | null;

  description?: string | null;

  received_at?: string | null;

  cash_handover_status?: string | null;

  cancelled_at?: string | null;
};

type Note = {
  id: string;

  student_id: string;

  activity_type: string;

  title?: string | null;

  description?: string | null;

  performed_at?: string | null;

  reminder_at?: string | null;

  reminder_completed?: boolean | null;

  reminder_completed_at?: string | null;

  performed_by?: string | null;
};

type Props = {
  student: Student;

  branches: Branch[];

  groups: Group[];

  packages: Package[];

  coaches: Coach[];

  template: string;

  consent: Consent;

  draft: Draft;

  activeEnrollment: ActiveEnrollment;

  payments: Payment[];

  notes: Note[];
};

/*
 * ============================================================
 * SABİTLER
 * ============================================================
 */

const dayNames: Record<
  number,
  string
> = {
  0: "Pazar",

  1: "Pazartesi",

  2: "Salı",

  3: "Çarşamba",

  4: "Perşembe",

  5: "Cuma",

  6: "Cumartesi",
};

/*
 * Şubenin özel konumu yoksa
 * ana iletişim sayfamız kullanılacak.
 */

const communicationFallback =
  "https://sprintyuzmekursu.com/iletisim/";

/*
 * ============================================================
 * FORMATLAMA
 * ============================================================
 */

function formatDate(
  value?: string | null
) {
  if (!value) {
    return "—";
  }

  const raw =
    value.includes("T")
      ? value
      : `${value}T12:00:00`;

  const date =
    new Date(raw);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "—";
  }

  return new Intl.DateTimeFormat(
    "tr-TR",
    {
      dateStyle:
        "long",
    }
  ).format(date);
}

function formatNumericDate(value?: string | null) {
  if (!value) return "—";

  const date = new Date(value.includes("T") ? value : `${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function formatDateTime(
  value?: string | null
) {
  if (!value) {
    return "—";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "—";
  }

  return new Intl.DateTimeFormat(
    "tr-TR",
    {
      dateStyle:
        "medium",

      timeStyle:
        "short",
    }
  ).format(date);
}

function money(
  value: number
) {
  return new Intl.NumberFormat(
    "tr-TR",
    {
      style:
        "currency",

      currency:
        "TRY",

      maximumFractionDigits:
        0,
    }
  ).format(
    Number(
      value || 0
    )
  );
}

/*
 * ============================================================
 * BİTİŞ TARİHİ HESABI
 * ============================================================
 */

function calculateEndDate(
  start: string,
  weekdays: number[],
  lessonCount: number
) {
  if (
    !start ||
    !weekdays.length ||
    lessonCount < 1
  ) {
    return null;
  }

  const date =
    new Date(
      `${start}T12:00:00`
    );

  let count = 0;

  let guard = 0;

  while (
    count <
      lessonCount &&
    guard < 730
  ) {
    if (
      weekdays.includes(
        date.getDay()
      )
    ) {
      count += 1;
    }

    if (
      count <
      lessonCount
    ) {
      date.setDate(
        date.getDate() + 1
      );
    }

    guard += 1;
  }

  return date
    .toISOString()
    .slice(
      0,
      10
    );
}

/*
 * ============================================================
 * MESAJ ŞABLONU
 * ============================================================
 */

function normalizeTemplateText(value: string) {
  return value
    .replace(/\\r\\n/g, "\n")
    .replace(/\\n/g, "\n")
    .replace(/\\t/g, " ")
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function fillTemplate(
  template: string,
  variables: Record<string, string>
) {
  const normalized = normalizeTemplateText(template);

  return Object.entries(variables).reduce(
    (result, [key, value]) =>
      result.replaceAll(`{{${key}}}`, value || "—"),
    normalized
  );
}

/*
 * ============================================================
 * WHATSAPP TELEFON FORMATLAMA
 * ============================================================
 */

function normalizeWhatsAppPhone(
  phone: string
) {
  let cleaned =
    phone.replace(
      /\D/g,
      ""
    );

  if (
    cleaned.startsWith(
      "0"
    )
  ) {
    cleaned =
      `90${cleaned.slice(
        1
      )}`;
  } else if (
    cleaned.length ===
    10
  ) {
    cleaned =
      `90${cleaned}`;
  }

  return cleaned;
}

/*
 * ============================================================
 * İKONLAR
 *
 * Emoji yerine sade SVG ikon kullanıyoruz.
 * Harici icon paketi gerektirmez.
 * ============================================================
 */

function Icon({
  name,
  size = 20,
}: {
  name:
    | "save"
    | "calendar"
    | "wallet"
    | "health"
    | "document"
    | "note"
    | "whatsapp"
    | "location"
    | "gift"
    | "check"
    | "clock"
    | "arrow";

  size?: number;
}) {
  const icons:
    Record<
      string,
      ReactNode
    > = {
    save: (
      <>
        <path d="M5 3h12l2 2v16H5V3Z" />

        <path d="M8 3v6h8V3" />

        <path d="M8 21v-7h8v7" />
      </>
    ),

    calendar: (
      <>
        <path d="M4 6h16v14H4Z" />

        <path d="M8 3v6" />

        <path d="M16 3v6" />

        <path d="M4 10h16" />
      </>
    ),

    wallet: (
      <>
        <path d="M4 7h15a2 2 0 0 1 2 2v10H4a2 2 0 0 1-2-2V7a3 3 0 0 1 3-3h13" />

        <path d="M16 12h5v4h-5a2 2 0 0 1 0-4Z" />
      </>
    ),

    health: (
      <>
        <path d="M12 21s-8-5-8-11a4 4 0 0 1 7-2 4 4 0 0 1 7 2c0 6-6 11-6 11Z" />

        <path d="M12 11v5" />

        <path d="M9.5 13.5h5" />
      </>
    ),

    document: (
      <>
        <path d="M6 3h9l3 3v15H6Z" />

        <path d="M14 3v5h5" />

        <path d="M9 12h6" />

        <path d="M9 16h6" />
      </>
    ),

    note: (
      <>
        <path d="M5 4h14v16H5Z" />

        <path d="M8 8h8" />

        <path d="M8 12h8" />

        <path d="M8 16h5" />
      </>
    ),

    whatsapp: (
      <>
        <path d="M20 11.5a8 8 0 0 1-11.8 7L4 20l1.5-4A8 8 0 1 1 20 11.5Z" />

        <path d="M9 8c1 4 3 6 7 7" />
      </>
    ),

    location: (
      <>
        <path d="M12 21s6-5.2 6-12A6 6 0 0 0 6 9c0 6.8 6 12 6 12Z" />

        <circle
          cx="12"
          cy="9"
          r="2"
        />
      </>
    ),

    gift: (
      <>
        <path d="M4 10h16v11H4Z" />

        <path d="M3 7h18v4H3Z" />

        <path d="M12 7v14" />

        <path d="M12 7c-5 0-5-5-2-5 2 0 2 3 2 5Z" />

        <path d="M12 7c5 0 5-5 2-5-2 0-2 3-2 5Z" />
      </>
    ),

    check: (
      <path d="m5 12 4 4L19 6" />
    ),

    clock: (
      <>
        <circle
          cx="12"
          cy="12"
          r="9"
        />

        <path d="M12 7v6l4 2" />
      </>
    ),

    arrow: (
      <path d="m9 18 6-6-6-6" />
    ),
  };

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {icons[name]}
    </svg>
  );
}

function SaveDraftButton({ className = "saveDraftButton" }: { className?: string }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      formAction={saveRegistrationDraft}
      className={className}
      disabled={pending}
      aria-busy={pending}
    >
      <Icon name={pending ? "clock" : "save"} size={18} />
      {pending ? "Kaydediliyor…" : "Kaydet"}
    </button>
  );
}

/*
 * ============================================================
 * COMPONENT
 * ============================================================
 */

export default function RegistrationWizard({
  student,
  branches,
  groups,
  packages,
  coaches,
  template,
  consent,
  draft,
  activeEnrollment,
  payments,
  notes,
}: Props) {
  /*
   * ==========================================================
   * TASLAK
   * ==========================================================
   */

  const draftData =
    (
      draft?.draft_data ||
      {}
    ) as Record<
      string,
      unknown
    >;

  /*
   * ----------------------------------------------------------
   * İlk grup
   * ----------------------------------------------------------
   */

  const initialGroupId =
    String(
      draftData.group_id ||
        ""
    ) ||
    activeEnrollment?.group_id ||
    student.preferred_group_id ||
    "";

  const initialGroup =
    groups.find(
      (group) =>
        group.id ===
        initialGroupId
    );

  /*
   * ----------------------------------------------------------
   * İlk şube
   * ----------------------------------------------------------
   */

  const initialBranchId =
    String(
      draftData.branch_id ||
        ""
    ) ||
    initialGroup?.branch_id ||
    student.branch_id ||
    "";

  /*
   * ----------------------------------------------------------
   * İlk paket
   * ----------------------------------------------------------
   */

  const initialPackageId =
    String(
      draftData.package_id ||
        ""
    ) ||
    activeEnrollment?.package_id ||
    student.preferred_package_id ||
    "";

  const initialPackageCandidate =
    packages.find(
      (item) =>
        item.id ===
        initialPackageId
    );

  /*
   * Ön kayıttan gelen paket seçili kurs türüyle uyuşmuyorsa
   * yanlış çocuk/yetişkin paketini taşımıyoruz.
   */
  const initialPackage =
    initialPackageCandidate &&
    initialGroup?.course_type &&
    initialPackageCandidate.course_type &&
    initialPackageCandidate.course_type !== initialGroup.course_type
      ? undefined
      : initialPackageCandidate;

  const safeInitialPackageId =
    initialPackage?.id || "";

  /*
   * ----------------------------------------------------------
   * Taslak günleri
   * ----------------------------------------------------------
   */

  const draftWeekdays =
    Array.isArray(
      draftData.lesson_weekdays
    )
      ? draftData.lesson_weekdays
          .map(Number)
          .filter(
            Number.isInteger
          )
      : [];

  /*
   * ----------------------------------------------------------
   * İlk günler
   * ----------------------------------------------------------
   */

  const initialWeekdays =
    draftWeekdays.length
      ? draftWeekdays

      : Array.isArray(
            activeEnrollment?.lesson_weekdays
          ) &&
          activeEnrollment
            ?.lesson_weekdays
            ?.length
        ? activeEnrollment
            .lesson_weekdays

        : initialGroup
            ?.schedules
            ?.map(
              (item) =>
                item.weekday
            )
            .filter(
              (
                day,
                index,
                array
              ) =>
                array.indexOf(
                  day
                ) ===
                index
            )
            .sort() ||
          [];

  /*
   * ----------------------------------------------------------
   * Başlangıç
   * ----------------------------------------------------------
   */

  const initialStartDate =
    String(
      draftData.start_date ||
        ""
    ) ||
    activeEnrollment?.start_date ||
    new Date()
      .toISOString()
      .slice(
        0,
        10
      );

  /*
   * ==========================================================
   * STATE
   * ==========================================================
   */

  const [
    branchId,
    setBranchId,
  ] =
    useState(
      initialBranchId
    );

  const [
    groupId,
    setGroupId,
  ] =
    useState(
      initialGroupId
    );

  const [
    packageId,
    setPackageId,
  ] =
    useState(
      safeInitialPackageId
    );

  const [
    coachId,
    setCoachId,
  ] =
    useState(
      String(
        draftData.coach_id ||
          ""
      ) ||
        initialGroup?.primary_coach_id ||
        ""
    );

  const [
    startDate,
    setStartDate,
  ] =
    useState(
      initialStartDate
    );

  const [
    weekdays,
    setWeekdays,
  ] =
    useState<
      number[]
    >(
      initialWeekdays
    );

  const [
    lessonCount,
    setLessonCount,
  ] =
    useState(
      Math.min(
        100,
        Math.max(
          1,
          Number(
            draftData.total_lessons ||
              activeEnrollment?.total_lessons ||
              initialPackage?.lesson_count ||
              8
          )
        )
      )
    );

  /*
   * ==========================================================
   * VADE
   *
   * Normal:
   * start_date
   *
   * Manuel değişiklik:
   * payment_due_date_manual = true
   * ==========================================================
   */

  const [
    dueDateManual,
    setDueDateManual,
  ] =
    useState(
      Boolean(
        draft?.payment_due_date_manual
      )
    );

  const [
    paymentDueDate,
    setPaymentDueDate,
  ] =
    useState(
      draft?.payment_due_date ||
        activeEnrollment?.payment_due_date ||
        initialStartDate
    );

  const [
    paymentNote,
    setPaymentNote,
  ] =
    useState(
      draft?.payment_note ||
        ""
    );

  /*
   * ==========================================================
   * MESAJ
   * ==========================================================
   */

  /*
   * Mesaj şablonu Ayarlar / Hazır Mesajlar merkezinden değiştiğinde
   * eski taslak metin yeni şablonun önüne geçmesin.
   * Eski kayıt mesajı başlığını taşımayan taslaklar güvenli biçimde
   * yeniden merkezi şablondan üretilir.
   */
  const savedMessageDraft =
    String(
      draft?.message_draft ||
        ""
    ).trim();

  const draftUsesCurrentRegistrationTemplate =
    savedMessageDraft.includes(
      "SPRİNT YÜZME OKULU | KAYIT BİLGİLENDİRMESİ"
    );

  const [
    message,
    setMessage,
  ] =
    useState(
      draftUsesCurrentRegistrationTemplate
        ? savedMessageDraft
        : ""
    );

  const [
    copied,
    setCopied,
  ] =
    useState(false);

  const [
    finalSubmitting,
    setFinalSubmitting,
  ] =
    useState(false);

  const initialWhatsappOpened =
    draftUsesCurrentRegistrationTemplate &&
    draftData.whatsapp_opened === true;

  const [
    messageSent,
    setMessageSent,
  ] =
    useState(
      Boolean(
        draft?.message_sent &&
        initialWhatsappOpened
      )
    );

  const [
    whatsappOpening,
    setWhatsappOpening,
  ] = useState(false);

  const [
    whatsappOpened,
    setWhatsappOpened,
  ] = useState(initialWhatsappOpened);

  /*
   * ==========================================================
   * SAĞLIK DETAY
   * ==========================================================
   */

  const [
    healthOpen,
    setHealthOpen,
  ] =
    useState(
      Boolean(
        consent?.health_note
      )
    );

  /*
   * ==========================================================
   * SEKMELERE SCROLL
   * ==========================================================
   */

  const planRef =
    useRef<HTMLElement>(
      null
    );

  const paymentRef =
    useRef<HTMLElement>(
      null
    );

  const consentRef =
    useRef<HTMLElement>(
      null
    );

  const notesRef =
    useRef<HTMLElement>(
      null
    );

  const messageRef =
    useRef<HTMLElement>(
      null
    );

  /*
   * ==========================================================
   * SEÇİMLER
   * ==========================================================
   */

  const selectedGroup =
    groups.find(
      (group) =>
        group.id ===
        groupId
    );

  const selectedBranch =
    branches.find(
      (branch) =>
        branch.id ===
        branchId
    );

  const selectedPackage =
    packages.find(
      (item) =>
        item.id ===
        packageId
    );

  const selectedCoach =
    coaches.find(
      (coach) =>
        coach.id ===
        (
          coachId ||
          selectedGroup?.primary_coach_id ||
          ""
        )
    );

  /*
   * ==========================================================
   * ŞUBEYE GÖRE GRUP
   * ==========================================================
   */

  const availableGroups =
    groups.filter(
      (group) =>
        !branchId ||
        group.branch_id ===
          branchId
    );

  /*
   * ==========================================================
   * KURS TÜRÜNE GÖRE PAKET
   * ==========================================================
   */

  const availablePackages =
    packages.filter(
      (item) => {
        if (
          !selectedGroup?.course_type
        ) {
          return true;
        }

        if (
          !item.course_type
        ) {
          return true;
        }

        return (
          item.course_type ===
          selectedGroup.course_type
        );
      }
    );

  /*
   * ==========================================================
   * BİTİŞ TARİHİ
   * ==========================================================
   */

  const endDate =
    useMemo(
      () =>
        calculateEndDate(
          startDate,
          weekdays,
          lessonCount
        ),

      [
        startDate,
        weekdays,
        lessonCount,
      ]
    );

  /*
   * ==========================================================
   * GRUP SAATİ
   * ==========================================================
   */

  const timeText =
    selectedGroup
      ?.schedules
      ?.length
      ? `${selectedGroup.schedules[0].start_time.slice(
          0,
          5
        )} - ${selectedGroup.schedules[0].end_time.slice(
          0,
          5
        )}`

      : student.preferred_time ||
        "—";

  /*
   * ==========================================================
   * ÖDEME DURUMU
   * ==========================================================
   */

  const currentEnrollmentPayments =
    activeEnrollment
      ? payments.filter(
          (item) =>
            item.enrollment_id ===
              activeEnrollment.id &&
            item.payment_status !==
              "cancelled" &&
            !item.cancelled_at
        )

      : [];

  const totalPaid =
    currentEnrollmentPayments.reduce(
      (
        sum,
        item
      ) =>
        sum +
        Number(
          item.amount ||
            0
        ),

      0
    );

  const packagePrice =
    Number(
      selectedPackage?.price ||
        0
    );

  const remainingPayment =
    Math.max(
      0,
      packagePrice -
        totalPaid
    );

  const paymentStatus =
    totalPaid <= 0
      ? "Bekleniyor"

      : packagePrice > 0 &&
          totalPaid <
            packagePrice
        ? "Kısmi Ödeme"

        : "Ödendi";

  const isStandardLessonCount =
    lessonCount === 8 || lessonCount === 12;

  const requiresManagerApproval =
    !isStandardLessonCount;

  const customApproval =
    draftData.custom_lesson_approval &&
    typeof draftData.custom_lesson_approval === "object"
      ? (draftData.custom_lesson_approval as Record<string, unknown>)
      : null;

  const customApprovalLessonCount =
    Number(customApproval?.lesson_count || 0);

  const customApprovalMatches =
    requiresManagerApproval &&
    customApprovalLessonCount === lessonCount;

  const customApprovalStatus =
    customApprovalMatches
      ? String(customApproval?.status || "")
      : "";

  const customApprovalPending =
    customApprovalStatus === "pending";

  const customApprovalApproved =
    customApprovalStatus === "approved";

  const customApprovalRejected =
    customApprovalStatus === "rejected";

  /*
   * ==========================================================
   * ŞUBE KONUMU
   * ==========================================================
   */

  const locationUrl =
    selectedBranch?.location_url ||
    communicationFallback;

  /*
   * ==========================================================
   * MESAJ DEĞİŞKENLERİ
   * ==========================================================
   */

  const variables =
    useMemo(
      () => ({
        veli_adi:
          student.guardian_name ||
          "Değerli Velimiz",

        ogrenci_adi:
          `${student.first_name} ${student.last_name}`,

        ogrenci_no:
          student.student_number ||
          "Kayıt tamamlandığında oluşturulacak",

        sube:
          selectedBranch?.name ||
          "—",

        kurs_turu:
          selectedGroup?.course_type ||
          "—",

        grup:
          selectedGroup?.name ||
          "—",

        gunler:
          weekdays
            .map(
              (day) =>
                dayNames[day]
            )
            .join(
              " - "
            ) ||
          "—",

        saat:
          timeText,

        paket:
          selectedPackage
            ? `${selectedPackage.name} (${selectedPackage.lesson_count} Ders)`
            : "Özel Ders Sayısı",

        ders_sayisi:
          String(
            lessonCount
          ),

        baslangic:
          formatDate(
            startDate
          ),

        bitis:
          formatDate(
            endDate
          ),

        vade_tarihi:
          formatDate(
            paymentDueDate
          ),

        egitmen:
          selectedCoach?.full_name ||
          "Sprint Yüzme Okulu Antrenörü",

        /*
         * Şimdilik branches.material_list kullanılır.
         *
         * İleride tek kaynak Malzemeler modülü olacaktır.
         */

        malzemeler:
          selectedBranch?.material_list ||
          "Ders için gerekli malzeme bilgileri şubeniz tarafından paylaşılacaktır.",

        konum:
          locationUrl,

        telefon:
          selectedBranch?.contact_phone ||
          "+90 (551) 896 83 19",
      }),

      [
        student,
        selectedBranch,
        selectedGroup,
        selectedPackage,
        selectedCoach,
        weekdays,
        timeText,
        lessonCount,
        startDate,
        endDate,
        paymentDueDate,
        locationUrl,
      ]
    );

  /*
   * ==========================================================
   * MESAJ
   * ==========================================================
   */

  const professionalTemplate = `*SPRİNT YÜZME OKULU | KAYIT BİLGİLENDİRMESİ*

Değerli Velimiz,

*{{ogrenci_adi}}* adına yüzme okulumuzdaki kayıt işlemleri *başarıyla tamamlanmıştır.* Aramıza hoş geldiniz.

_Kurs başlangıcınız ve kayıt bilgileriniz aşağıda yer almaktadır._

*KURS BİLGİLERİ*
• Öğrenci No: *{{ogrenci_no}}*
• Şube: *{{sube}}*
• Kurs: *{{kurs_turu}}*
• Grup: *{{grup}}*
• Günler: *{{gunler}}*
• Saat: *{{saat}}*
• Paket: *{{paket}}*
• Ders Sayısı: *{{ders_sayisi}}*

*EĞİTİM TARİHLERİ*
• Başlangıç Tarihi: *{{baslangic}}*
• Planlanan Bitiş Tarihi: *{{bitis}}*

*ÖDEME BİLGİSİ*
• Ödeme Vade Tarihi: *{{vade_tarihi}}*

*DERS İÇİN GEREKLİ MALZEMELER*
• *Sprint Yüzme Bonesi* — Öğrencimize yüzme okulumuz tarafından _hediye edilmektedir._
• *Yüzücü Gözlüğü* — Kendi gözlüğünüzü kullanabilir veya yüzme okulumuzdan temin edebilirsiniz.
• *Yüzme Kıyafeti* — Mayo, bikini, yüzme şortu veya haşema kullanılabilir.
• *Terlik* — Havuz alanında kullanılmak üzere kaymaz tabanlı terlik önerilmektedir.
• *Havlu ve Kişisel Malzemeler* — Havlu ve ihtiyaç duyulan kişisel bakım malzemeleri getirilebilir.

*ÖNEMLİ HATIRLATMA*
Ders başlangıç saatinden *en az 15 dakika önce* tesiste hazır bulunmanızı rica ederiz.

_Bu sayede öğrencimizin hazırlanma ve havuza giriş süreci ders süresini etkilemeden tamamlanabilir._

*İLETİŞİM*
*{{telefon}}*

*KONUM*
{{konum}}

Yeni eğitim dönemimizin öğrencimiz için keyifli, verimli ve başarılı geçmesini dileriz.

*SPRİNT YÜZME OKULU*
_Antalya'nın En Köklü Yüzme Okulu_`

  /*
   * message_templates içindeki registration_completed kaydı varsa
   * ana kaynak odur. Böylece ileride Hazır Mesajlar / Ayarlar modülünden
   * metni değiştirdiğimizde bu ekrana yeniden kod yazmak gerekmez.
   * Kayıt yoksa yukarıdaki güvenli varsayılan şablon kullanılır.
   */
  const activeMessageTemplate =
    template?.trim()
      ? template
      : professionalTemplate;

  const generatedMessage = fillTemplate(
    activeMessageTemplate,
    variables
  );

  /*
   * ==========================================================
   * WHATSAPP
   * ==========================================================
   */

  const whatsappPhone =
    normalizeWhatsAppPhone(
      student.guardian_phone ||
        student.phone ||
        ""
    );

  const whatsappUrl =
    `https://wa.me/${whatsappPhone}` +
    `?text=${encodeURIComponent(
      message ||
        generatedMessage
    )}`;

  /*
   * ==========================================================
   * SCROLL
   * ==========================================================
   */

  function scrollTo(
    ref: RefObject<
      HTMLElement | null
    >
  ) {
    ref.current
      ?.scrollIntoView({
        behavior:
          "smooth",

        block:
          "start",
      });
  }

  /*
   * ==========================================================
   * GRUP DEĞİŞİMİ
   * ==========================================================
   */

  function handleGroupChange(
    value: string
  ) {
    setGroupId(
      value
    );

    const group =
      groups.find(
        (item) =>
          item.id ===
          value
      );

    if (!group) {
      setWeekdays([]);

      setCoachId("");

      return;
    }

    setBranchId(
      group.branch_id
    );

    setCoachId(
      group.primary_coach_id ||
        ""
    );

    /*
     * Grup programı varsayılan gelir.
     */

    setWeekdays(
      [
        ...new Set(
          group.schedules.map(
            (item) =>
              item.weekday
          )
        ),
      ].sort()
    );

    /*
     * Seçili paket yeni kurs türüyle uyumsuzsa temizle.
     */

    const currentPackage =
      packages.find(
        (item) =>
          item.id ===
          packageId
      );

    if (
      currentPackage
        ?.course_type &&
      currentPackage.course_type !==
        group.course_type
    ) {
      setPackageId("");
    }
  }

  /*
   * ==========================================================
   * PAKET DEĞİŞİMİ
   * ==========================================================
   */

  function handlePackageChange(
    value: string
  ) {
    setPackageId(
      value
    );

    const selected =
      packages.find(
        (item) =>
          item.id ===
          value
      );

    if (
      selected
    ) {
      setLessonCount(
        Math.min(
          100,
          Math.max(
            1,
            selected.lesson_count
          )
        )
      );
    }
  }

  /*
   * ==========================================================
   * BAŞLANGIÇ TARİHİ
   *
   * Vade manuel değiştirilmediyse beraber değişir.
   * ==========================================================
   */

  function handleStartDate(
    value: string
  ) {
    setStartDate(
      value
    );

    if (
      !dueDateManual
    ) {
      setPaymentDueDate(
        value
      );
    }
  }

  /*
   * ==========================================================
   * VADE TARİHİ
   * ==========================================================
   */

  function handleDueDate(
    value: string
  ) {
    setPaymentDueDate(
      value
    );

    /*
     * Başlangıç tarihinden farklıysa manuel kabul edilir.
     */

    setDueDateManual(
      value !==
        startDate
    );
  }

  /*
   * ==========================================================
   * MESAJ KOPYALA
   * ==========================================================
   */

  async function copyMessage() {
    const text =
      message ||
      generatedMessage;

    if (
      !message
    ) {
      setMessage(
        text
      );
    }

    await navigator
      .clipboard
      .writeText(
        text
      );

    setCopied(
      true
    );

    window.setTimeout(
      () =>
        setCopied(
          false
        ),

      1800
    );
  }

  /*
   * ==========================================================
   * VADE GEÇMİŞ Mİ?
   * ==========================================================
   */

  const dueReminder =
    Boolean(
      paymentDueDate
    ) &&
    new Date(
      `${paymentDueDate}T23:59:59`
    ).getTime() <
      Date.now() &&
    paymentStatus !==
      "Ödendi";

  /*
   * ==========================================================
   * RENDER
   * ==========================================================
   */

  return (
    <form
      action={
        completeRegistration
      }
      className="registrationShell"
      onSubmit={(event) => {
        const nativeEvent = event.nativeEvent as SubmitEvent;
        const submitter = nativeEvent.submitter as HTMLButtonElement | null;

        if (submitter?.dataset.finalRegistration === "true") {
          setFinalSubmitting(true);
        }
      }}
    >

      {/*
       * =====================================================
       * HIDDEN ALANLAR
       * =====================================================
       */}

      <input
        type="hidden"
        name="student_id"
        value={student.id}
      />

      <input
        type="hidden"
        name="active_enrollment_id"
        value={
          activeEnrollment?.id ||
          ""
        }
      />

      <input
        type="hidden"
        name="total_lessons"
        value={lessonCount}
      />

      <input
        type="hidden"
        name="planned_end_date"
        value={
          endDate ||
          ""
        }
      />

      <input
        type="hidden"
        name="message_body"
        value={
          message ||
          generatedMessage
        }
      />

      <input
        type="hidden"
        name="recipient"
        value={
          student.guardian_phone ||
          student.phone ||
          ""
        }
      />

      <input
        type="hidden"
        name="whatsapp_opened"
        value={whatsappOpened ? "on" : ""}
      />

      {/*
       * =====================================================
       * ÜST SABİT MENÜ
       * =====================================================
       */}

      <div className="stickyCommandBar">

        <div className="commandTabs">

          <button
            type="button"
            onClick={() =>
              scrollTo(
                planRef
              )
            }
          >
            Kayıt Planı
          </button>

          <button
            type="button"
            onClick={() =>
              scrollTo(
                paymentRef
              )
            }
          >
            Ödeme & Vade
          </button>

          <button
            type="button"
            onClick={() =>
              scrollTo(
                consentRef
              )
            }
          >
            Sağlık & Kurallar
          </button>

          <button
            type="button"
            onClick={() =>
              scrollTo(
                notesRef
              )
            }
          >
            Notlar
          </button>

          <button
            type="button"
            onClick={() =>
              scrollTo(
                messageRef
              )
            }
          >
            WhatsApp
          </button>

        </div>

        <SaveDraftButton />

      </div>

      {/*
       * =====================================================
       * 01 KAYIT PLANI
       * =====================================================
       */}

      <section
        ref={planRef}
        id="kayit-plani"
        className="wizardCard planCard"
      >

        <div className="sectionHeading">

          <div className="sectionIcon">
            <Icon name="calendar" />
          </div>

          <div>

            <p>
              01 · KAYIT PLANI
            </p>

            <h2>
              Şube, Grup, Paket ve Takvim
            </h2>

            <span>
              Seçimler birbirine bağlı çalışır ve bitiş tarihi otomatik hesaplanır.
            </span>

          </div>

        </div>

        <div className="formGrid">

          <label>

            <span>
              Doğum Tarihi
            </span>

            <input
              value={formatNumericDate(student.birth_date)}
              readOnly
              aria-label="Ön kayıt formundan gelen doğum tarihi"
            />

            <small className="fieldHint">
              Ön kayıt formundan otomatik aktarılmıştır.
            </small>

          </label>

          <label>

            <span>
              Şube
            </span>

            <select
              name="branch_id"
              value={branchId}
              onChange={(
                event
              ) => {
                setBranchId(
                  event.target.value
                );

                setGroupId("");

                setCoachId("");

                setWeekdays([]);
              }}
              required
            >

              <option value="">
                Şube seçiniz
              </option>

              {branches.map(
                (branch) => (
                  <option
                    key={
                      branch.id
                    }
                    value={
                      branch.id
                    }
                  >
                    {branch.name}
                  </option>
                )
              )}

            </select>

          </label>

          <label>

            <span>
              Grup
            </span>

            <select
              name="group_id"
              value={groupId}
              onChange={(
                event
              ) =>
                handleGroupChange(
                  event.target.value
                )
              }
              required
            >

              <option value="">
                Grup seçiniz
              </option>

              {availableGroups.map(
                (group) => (
                  <option
                    key={
                      group.id
                    }
                    value={
                      group.id
                    }
                  >
                    {group.name}
                  </option>
                )
              )}

            </select>

          </label>

          <label>

            <span>
              Kurs Türü
            </span>

            <input
              value={
                selectedGroup
                  ?.course_type ||
                "Grup seçiniz"
              }
              readOnly
            />

          </label>

          <label>

            <span>
              Paket
            </span>

            <select
              name="package_id"
              value={packageId}
              onChange={(
                event
              ) =>
                handlePackageChange(
                  event.target.value
                )
              }
            >

              <option value="">
                Özel / Paket seçmeden
              </option>

              {availablePackages.map(
                (item) => (
                  <option
                    key={
                      item.id
                    }
                    value={
                      item.id
                    }
                  >
                    {item.name}
                    {" · "}
                    {item.lesson_count}
                    {" Ders · "}
                    {money(
                      item.price
                    )}
                  </option>
                )
              )}

            </select>

          </label>

          <label>

            <span>
              Ders Sayısı
            </span>

            <input
              type="number"
              min={1}
              max={100}
              step={1}
              value={
                lessonCount
              }
              onChange={(
                event
              ) =>
                setLessonCount(
                  Math.min(
                    100,
                    Math.max(
                      1,
                      Number(
                        event
                          .target
                          .value
                      ) ||
                        1
                    )
                  )
                )
              }
              required
            />

            {requiresManagerApproval ? (
              <small
                style={{
                  color: customApprovalApproved
                    ? "#15803d"
                    : customApprovalRejected
                      ? "#b91c1c"
                      : "#b45309",
                  fontWeight: 800,
                }}
              >
                {customApprovalApproved
                  ? `Yönetici onayı alındı ✓ · ${lessonCount} ders`
                  : customApprovalPending
                    ? `Yönetici onayı bekleniyor · ${lessonCount} ders`
                    : customApprovalRejected
                      ? `${lessonCount} ders talebi reddedildi. Düzenleyip yeniden gönderebilirsiniz.`
                      : `Yönetici onayı gerekir. Standart ders sayıları 8 ve 12'dir.`}
              </small>
            ) : null}

          </label>

          <label>

            <span>
              Eğitmen
            </span>

            <select
              name="coach_id"
              value={coachId}
              onChange={(
                event
              ) =>
                setCoachId(
                  event.target.value
                )
              }
            >

              <option value="">
                Grup eğitmeni
              </option>

              {coaches.map(
                (coach) => (
                  <option
                    key={
                      coach.id
                    }
                    value={
                      coach.id
                    }
                  >
                    {coach.full_name ||
                      "İsimsiz Eğitmen"}
                  </option>
                )
              )}

            </select>

          </label>

          <label>

            <span>
              Başlangıç Tarihi
            </span>

            <input
              name="start_date"
              type="date"
              value={
                startDate
              }
              onChange={(
                event
              ) =>
                handleStartDate(
                  event.target.value
                )
              }
              required
            />

          </label>

          <label>

            <span>
              Planlanan Bitiş
            </span>

            <input
              value={
                formatNumericDate(endDate)
              }
              readOnly
            />

          </label>

        </div>

        {/*
         * ---------------------------------------------------
         * GERÇEK KATILIM GÜNLERİ
         * ---------------------------------------------------
         */}

        <div className="dayPicker">

          <span>
            Öğrencinin gerçekten katılacağı günler
          </span>

          <div>

            {Object.entries(
              dayNames
            ).map(
              ([
                value,
                label,
              ]) => {
                const day =
                  Number(
                    value
                  );

                const selected =
                  weekdays.includes(
                    day
                  );

                return (
                  <label
                    key={
                      value
                    }
                    className={
                      selected
                        ? "selected"
                        : ""
                    }
                  >

                    <input
                      type="checkbox"
                      name="lesson_weekdays"
                      value={day}
                      checked={
                        selected
                      }
                      onChange={(
                        event
                      ) =>
                        setWeekdays(
                          (
                            current
                          ) =>
                            event
                              .target
                              .checked
                              ? [
                                  ...new Set(
                                    [
                                      ...current,
                                      day,
                                    ]
                                  ),
                                ].sort()

                              : current.filter(
                                  (
                                    item
                                  ) =>
                                    item !==
                                    day
                                )
                        )
                      }
                    />

                    {label}

                  </label>
                );
              }
            )}

          </div>

        </div>

        {/*
         * ---------------------------------------------------
         * ÖZET
         * ---------------------------------------------------
         */}

        <div className="summaryStrip">

          <div>

            <small>
              Başlangıç
            </small>

            <strong>
              {formatDate(
                startDate
              )}
            </strong>

          </div>

          <div>

            <small>
              Bitiş
            </small>

            <strong>
              {formatDate(
                endDate
              )}
            </strong>

          </div>

          <div>

            <small>
              Haftalık
            </small>

            <strong>
              {weekdays.length} Gün
            </strong>

          </div>

          <div>

            <small>
              Ders Hakkı
            </small>

            <strong>
              {lessonCount}
            </strong>

          </div>

        </div>

      </section>

      {/*
       * =====================================================
       * 02 ÖDEME & VADE
       * =====================================================
       */}

      <section
        ref={paymentRef}
        id="odeme"
        className="wizardCard paymentCard"
      >

        <div className="sectionHeading">

          <div className="sectionIcon">
            <Icon name="wallet" />
          </div>

          <div>

            <p>
              02 · ÖDEME & VADE
            </p>

            <h2>
              Ödemeler Modülü ile Tek Vade Sistemi
            </h2>

            <span>
              Normal ödeme vadesi kurs başlangıç tarihidir. Farklı tarih girerseniz seçtiğiniz tarih korunur.
            </span>

          </div>

          <Link
            className="sectionLink"
            href={
              `/odemeler?student=${student.id}&action=payment`
            }
          >
            Ödeme Al / Plan Hazırla

            <Icon
              name="arrow"
              size={16}
            />
          </Link>

        </div>

        <div className="paymentOverview">

          {/*
           * -------------------------------------------------
           * ÖDEME DURUMU
           * -------------------------------------------------
           */}

          <div
            className={
              `statusPanel ${
                paymentStatus ===
                "Ödendi"
                  ? "paid"

                  : dueReminder
                    ? "late"

                    : "pending"
              }`
            }
          >

            <small>
              Ödeme Durumu
            </small>

            <strong>
              {paymentStatus}
            </strong>

            <span>

              {packagePrice > 0
                ? `${money(
                    totalPaid
                  )} ödendi · ${money(
                    remainingPayment
                  )} kalan`

                : "Paket fiyatı seçildiğinde bakiye hesaplanır."}

            </span>

          </div>

          {/*
           * -------------------------------------------------
           * VADE
           * -------------------------------------------------
           */}

          <label className="dueDateField">

            <span>
              Ödeme Vade Tarihi
            </span>

            <input
              name="payment_due_date"
              type="date"
              value={
                paymentDueDate
              }
              onChange={(
                event
              ) =>
                handleDueDate(
                  event.target.value
                )
              }
              required
            />

            {/*
             * Checkbox kullanıcıya gösterilmiyor.
             * Server action manuel tarih olup olmadığını buradan bilir.
             */}

            <input
              type="checkbox"
              name="payment_due_date_manual"
              checked={
                dueDateManual
              }
              onChange={(
                event
              ) => {
                const checked =
                  event.target.checked;

                setDueDateManual(
                  checked
                );

                if (
                  !checked
                ) {
                  setPaymentDueDate(
                    startDate
                  );
                }
              }}
              className="hiddenCheckbox"
            />

            <small>

              {dueDateManual
                ? "Vade elle değiştirildi. Başlangıç tarihi değişse bile korunur."

                : "Otomatik vade: kurs başlangıç tarihi."}

            </small>

          </label>

        </div>

        {/*
         * ---------------------------------------------------
         * ÖDEME NOTU
         * ---------------------------------------------------
         */}

        <label className="wideField">

          <span>
            Ödeme Notu
          </span>

          <textarea
            name="payment_note"
            value={
              paymentNote
            }
            onChange={(
              event
            ) =>
              setPaymentNote(
                event.target.value
              )
            }
            rows={3}
            placeholder="Örn. Veli ile görüşüldü, 15 Eylül tarihinde ödeme yapacağını belirtti."
          />

        </label>

        {/*
         * ---------------------------------------------------
         * VADE GEÇMİŞ UYARISI
         * ---------------------------------------------------
         */}

        {dueReminder ? (
          <div className="warningInline">

            <Icon name="clock" />

            <div>

              <strong>
                Ödeme vadesi geçmiş görünüyor.
              </strong>

              <span>
                Ödeme alınmadıysa Ödemeler Merkezi üzerinden işlemi takip edin.
              </span>

            </div>

          </div>
        ) : null}

      </section>

      {/*
       * =====================================================
       * 03 SAĞLIK & KURALLAR
       * =====================================================
       */}

      <section
        ref={consentRef}
        id="onaylar"
        className="wizardCard"
      >

        <div className="sectionHeading">

          <div className="sectionIcon">
            <Icon name="document" />
          </div>

          <div>

            <p>
              03 · OTOMATİK KONTROLLER
            </p>

            <h2>
              Sağlık Beyanı ve Kurallar
            </h2>

            <span>
              Bu bilgiler tekrar işaretlenmez; ön kayıt elektronik kabul kaydından otomatik okunur.
            </span>

          </div>

          <Link
            className="sectionLink"
            href={
              `/on-kayitlar?student=${student.id}`
            }
          >
            Orijinal Ön Kayıt

            <Icon
              name="arrow"
              size={16}
            />
          </Link>

        </div>

        <div className="statusCardGrid">

          {/*
           * -------------------------------------------------
           * SAĞLIK
           * -------------------------------------------------
           */}

          <article
            className={
              `statusCard ${
                consent
                  ? "ok"
                  : "danger"
              }`
            }
          >

            <span className="statusIcon">
              <Icon name="health" />
            </span>

            <div>

              <small>
                Sağlık Beyanı
              </small>

              <strong>
                {consent
                  ? "Beyan Kayıtlı"
                  : "Kayıt Bulunamadı"}
              </strong>

              <p>

                {consent?.health_note
                  ? "Sağlık notu mevcut. Detayı inceleyin."

                  : consent
                    ? "Sağlık notu girilmemiş."

                    : "Ön kayıt elektronik kabul kaydı bulunamadı."}

              </p>

            </div>

            {consent
              ?.health_note ? (
              <button
                type="button"
                onClick={() =>
                  setHealthOpen(
                    (
                      current
                    ) =>
                      !current
                  )
                }
              >
                {healthOpen
                  ? "Kapat"
                  : "Detay"}
              </button>
            ) : null}

          </article>

          {/*
           * -------------------------------------------------
           * KURALLAR
           * -------------------------------------------------
           */}

          <article
            className={
              `statusCard ${
                consent?.rules_accepted
                  ? "ok"
                  : "danger"
              }`
            }
          >

            <span className="statusIcon">
              <Icon name="check" />
            </span>

            <div>

              <small>
                Yüzme Okulu Kuralları
              </small>

              <strong>

                {consent?.rules_accepted
                  ? "Okundu ve Kabul Edildi"

                  : "Onay Bulunamadı"}

              </strong>

              <p>

                {consent?.rules_accepted
                  ? `${consent.rules_version || "Kural sürümü"} · ${formatDateTime(
                      consent.accepted_at
                    )}`

                  : "Kesin kayıt için kurallar kabul kaydı gereklidir."}

              </p>

            </div>

          </article>

        </div>

        {/*
         * ---------------------------------------------------
         * SAĞLIK NOTU DETAYI
         * ---------------------------------------------------
         */}

        {healthOpen &&
        consent?.health_note ? (
          <div className="healthDetail">

            <div>
              <Icon name="health" />
            </div>

            <div>

              <small>
                ÖN KAYITTA BİLDİRİLEN SAĞLIK NOTU
              </small>

              <strong>
                {consent.health_note}
              </strong>

              <span>
                Kabul zamanı:{" "}
                {formatDateTime(
                  consent.accepted_at
                )}
              </span>

            </div>

          </div>
        ) : null}

      </section>

      {/*
       * =====================================================
       * 04 MALZEME
       * =====================================================
       */}

      <section
        className="wizardCard materialsCard"
      >

        <div className="sectionHeading">

          <div className="sectionIcon">
            <Icon name="gift" />
          </div>

          <div>

            <p>
              04 · MALZEME
            </p>

            <h2>
              Malzemeler Modülüne Hazır
            </h2>

            <span>
              Ürün, fiyat, stok, hediye ve teslim bilgisi ileride Malzemeler modülünden otomatik çekilecek.
            </span>

          </div>

        </div>

        {/*
         * Şimdilik yalnız fiziksel teslim işaretlemesi.
         *
         * Ürün/fiyat burada hardcode edilmiyor.
         */}

        <label className="physicalCheck">

          <input
            type="checkbox"
            name="swim_cap_delivered"
            defaultChecked={
              Boolean(
                draft?.swim_cap_delivered
              )
            }
          />

          <span>

            <strong>
              Mevcut malzeme teslimi
            </strong>

            <small>
              Kayıt sırasında verilecek fiziksel malzeme öğrenciye teslim edildi.
            </small>

          </span>

        </label>

      </section>

      {/*
       * =====================================================
       * 05 NOTLAR & HATIRLATMALAR
       * =====================================================
       */}

      <section
        ref={notesRef}
        id="notlar"
        className="wizardCard notesCard"
      >

        <div className="sectionHeading">

          <div className="sectionIcon">
            <Icon name="note" />
          </div>

          <div>

            <p>
              05 · NOTLAR & HATIRLATMALAR
            </p>

            <h2>
              Tarihli Öğrenci Notları
            </h2>

            <span>
              Notu kaydedin; gerekiyorsa takip tarihini ve saatini belirleyin.
            </span>

          </div>

        </div>

        {/*
         * ---------------------------------------------------
         * NOT EKLE
         * ---------------------------------------------------
         */}

        <div className="noteComposer">

          <label>

            <span>
              Yeni Not
            </span>

            <textarea
              name="note_text"
              rows={4}
              placeholder="Örn. Veli ile görüşüldü, ödeme için tekrar aranacak."
            />

          </label>

          <label>

            <span>
              Hatırlatma Tarihi / Saati
            </span>

            <input
              name="reminder_at"
              type="datetime-local"
            />

            <small>
              Boş bırakırsanız normal not olarak kaydedilir.
            </small>

          </label>

          <button
            type="submit"
            formAction={
              addRegistrationNote
            }
            className="secondaryAction"
          >

            <Icon
              name="note"
              size={18}
            />

            Notu Kaydet

          </button>

        </div>

        {/*
         * ---------------------------------------------------
         * GEÇMİŞ NOTLAR
         * ---------------------------------------------------
         */}

        <div className="noteTimeline">

          {notes.length ? (
            notes.map(
              (note) => (
                <article
                  key={
                    note.id
                  }
                  className={
                    note.reminder_completed
                      ? "done"
                      : ""
                  }
                >

                  <div className="timelineDot" />

                  <div>

                    <div className="noteMeta">

                      <strong>
                        {note.title ||
                          "Kayıt Notu"}
                      </strong>

                      <span>
                        {formatDateTime(
                          note.performed_at
                        )}
                      </span>

                    </div>

                    <p>
                      {note.description ||
                        "—"}
                    </p>

                    {note.reminder_at ? (
                      <div className="reminderBadge">

                        <Icon
                          name="clock"
                          size={15}
                        />

                        {note.reminder_completed
                          ? "Tamamlandı · "
                          : "Hatırlatma · "}

                        {formatDateTime(
                          note.reminder_at
                        )}

                      </div>
                    ) : null}

                  </div>

                </article>
              )
            )
          ) : (
            <div className="emptyState">
              Henüz kayıt notu eklenmemiş.
            </div>
          )}

        </div>

      </section>

      {/*
       * =====================================================
       * 06 WHATSAPP
       * =====================================================
       */}

      <section
        ref={messageRef}
        id="whatsapp"
        className="wizardCard messageCard"
      >

        <div className="sectionHeading">

          <div className="sectionIcon whatsappIcon">
            <Icon name="whatsapp" />
          </div>

          <div>

            <p>
              06 · WHATSAPP
            </p>

            <h2>
              Kayıt Tamamlandı Mesajı
            </h2>

            <span>
              Seçili şubenin konum bilgisi mesaj içerisine otomatik olarak eklenir.
            </span>

          </div>

          <button
            type="button"
            className="sectionLink buttonLink"
            onClick={() =>
              setMessage(
                generatedMessage
              )
            }
          >
            Mesajı Yenile
          </button>

        </div>

        {/*
         * ---------------------------------------------------
         * KONUM
         * ---------------------------------------------------
         */}

        <div className="locationPreview">

          <Icon name="location" />

          <div>

            <small>
              Mesaja eklenecek konum
            </small>

            <strong>
              {selectedBranch?.name ||
                "Şube seçilmedi"}
            </strong>

            <a
              href={
                locationUrl
              }
              target="_blank"
              rel="noreferrer"
            >

              {selectedBranch?.location_url
                ? "Şube konum bağlantısını aç"

                : "Şube özel konumu yok · İletişim sayfası kullanılacak"}

            </a>

          </div>

        </div>

        {/*
         * ---------------------------------------------------
         * MESAJ
         * ---------------------------------------------------
         */}

        <textarea
          className="messageTextarea"
          value={
            message ||
            generatedMessage
          }
          onChange={(
            event
          ) =>
            setMessage(
              event.target.value
            )
          }
          rows={18}
        />

        <div className="messageActions">

          <button
            type="button"
            onClick={
              copyMessage
            }
          >

            {copied
              ? "Kopyalandı ✓"
              : "Metni Kopyala"}

          </button>

          <a
            href={
              whatsappUrl
            }
            target="_blank"
            rel="noreferrer"
            onClick={() => {
              if (!message) {
                setMessage(generatedMessage);
              }

              /*
               * WhatsApp bağlantısına gerçekten basılmadan
               * "Gönderildi" onayı açılamaz.
               * Tarayıcı WhatsApp içindeki Send tuşunu teknik olarak
               * göremez; bu yüzden açılış + personel teyidi birlikte kullanılır.
               */
              setMessageSent(false);
              setWhatsappOpening(true);
              setWhatsappOpened(true);

              window.setTimeout(() => {
                setWhatsappOpening(false);
              }, 700);
            }}
          >

            <Icon
              name={whatsappOpened ? "check" : "whatsapp"}
              size={18}
            />

            {whatsappOpening
              ? "WhatsApp Açılıyor..."
              : whatsappOpened
                ? "WhatsApp Açıldı ✓"
                : "WhatsApp'ta Aç"}

          </a>

          <label className="sentCheck">

            <input
              type="checkbox"
              name="message_sent"
              checked={
                messageSent
              }
              disabled={!whatsappOpened}
              onChange={(
                event
              ) =>
                setMessageSent(
                  whatsappOpened &&
                    event.target.checked
                )
              }
            />

            <span>

              {messageSent
                ? "Gönderildi ✓"
                : whatsappOpened
                  ? "WhatsApp'ta gönderdiğimi onaylıyorum"
                  : "Önce WhatsApp'ta Aç butonuna basın"}

            </span>

          </label>

        </div>

      </section>

      {/*
       * =====================================================
       * SON İŞLEM
       * =====================================================
       */}

      <section className="finalPanel">

        <div>

          <small>
            SON KONTROL
          </small>

          <h3>
            Kesin kaydı oluştur
          </h3>

          <p>
            Kaydet butonu yalnızca taslağı saklar. Kesin kayıt butonu öğrenciyi aktif kayda, gruba ve gerçek katılım planına aktarır.
          </p>

        </div>

        <div style={{ display: "grid", gap: 8, margin: "14px 0" }}>
          <div className={messageSent ? "requirementOk" : "requirementMissing"}>
            <strong>{messageSent ? "✓ WhatsApp bilgilendirmesi gönderildi" : "WhatsApp bilgilendirmesi bekleniyor"}</strong>
          </div>
          <div
            className={
              !requiresManagerApproval || customApprovalApproved
                ? "requirementOk"
                : customApprovalRejected
                  ? "requirementMissing"
                  : "requirementApproval"
            }
          >
            <strong>
              {!requiresManagerApproval
                ? `✓ ${lessonCount} ders standart kayıt paketidir`
                : customApprovalApproved
                  ? `✓ Yönetici onayı alındı · ${lessonCount} ders`
                  : customApprovalPending
                    ? `Yönetici onayı bekleniyor · ${lessonCount} ders`
                    : customApprovalRejected
                      ? `${lessonCount} ders talebi reddedildi · Düzenleyip yeniden gönderebilirsiniz`
                      : `${lessonCount} ders standart paket dışıdır · Yönetici onayı gerekir`}
            </strong>
          </div>
        </div>

        {finalSubmitting ? (
          <div
            role="status"
            aria-live="polite"
            style={{
              margin: "14px 0 4px",
              padding: "14px 16px",
              borderRadius: 14,
              background: "#eff6ff",
              border: "1px solid #bfdbfe",
              color: "#1e3a8a",
              fontWeight: 800,
              lineHeight: 1.5,
            }}
          >
            Kayıt işleniyor... Öğrenci aktif kayda alınıyor, grup üyeliği ve ders planı oluşturuluyor.
            Lütfen bu işlem tamamlanana kadar sayfayı kapatmayın.
          </div>
        ) : null}

        <div className="finalButtons">

          <button
            type="submit"
            formAction={
              saveRegistrationDraft
            }
            className="outlineSave"
            disabled={finalSubmitting}
          >

            <Icon
              name="save"
              size={18}
            />

            Taslağı Kaydet

          </button>

          <button
            type="submit"
            formAction={
              requiresManagerApproval && !customApprovalApproved
                ? requestCustomLessonCountApproval
                : completeRegistration
            }
            className="completeButton"
            aria-busy={finalSubmitting}
            disabled={
              finalSubmitting ||
              (requiresManagerApproval && !customApprovalApproved
                ? customApprovalPending
                : !consent?.rules_accepted || !messageSent)
            }
            data-final-registration={
              !requiresManagerApproval || customApprovalApproved
                ? "true"
                : "false"
            }
          >

            <Icon
              name="check"
              size={19}
            />

            {finalSubmitting
              ? "Kayıt İşleniyor..."
              : requiresManagerApproval && customApprovalPending
                ? "Yönetici Onayı Bekleniyor"
                : requiresManagerApproval && !customApprovalApproved
                  ? customApprovalRejected
                    ? "Yeniden Yönetici Onayına Gönder"
                    : "Yönetici Onayına Gönder"
                  : !messageSent
                    ? "Önce WhatsApp Mesajını Gönderin"
                    : "Kaydı Tamamla ve Öğrenciye Aktar"}

          </button>

        </div>

      </section>

    </form>
  );
}
