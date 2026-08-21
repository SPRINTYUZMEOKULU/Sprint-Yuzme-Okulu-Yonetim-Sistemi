import Link from "next/link";

import { requireProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";

import PaymentsClient, {
  type PaymentRecord,
  type PaymentStudent,
} from "./payments-client";

import "../dashboard.css";

export const dynamic = "force-dynamic";

type AnyRow = Record<string, any>;

function toNumber(value: unknown) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function firstValue(
  row: AnyRow | null | undefined,
  keys: string[]
) {
  if (!row) return null;

  for (const key of keys) {
    const value = row[key];

    if (
      value !== undefined &&
      value !== null &&
      value !== ""
    ) {
      return value;
    }
  }

  return null;
}

function getPackagePrice(
  coursePackage: AnyRow | undefined
) {
  return toNumber(
    firstValue(coursePackage, [
      "price",
      "package_price",
      "amount",
      "fee",
      "registration_fee",
      "sale_price",
    ])
  );
}

function normalizeText(value: unknown) {
  return String(value || "")
    .trim()
    .toLocaleLowerCase("tr-TR");
}

function isAdultCourse(value: unknown) {
  const text = normalizeText(value);

  return (
    text.includes("yetişkin") ||
    text.includes("yetiskin") ||
    text.includes("adult")
  );
}

export default async function PaymentsPage() {
  const profile = await requireProfile([
    "owner",
    "admin",
    "branch_manager",
    "registration_staff",
    "accounting",
  ]);

  const organizationId = profile.organization_id;

  if (!organizationId) {
    return (
      <main className="operationPage">
        <header className="operationHeader">
          <div>
            <p>SPRİNTOS · FİNANS</p>
            <h1>Ödeme Merkezi</h1>
          </div>
        </header>

        <section className="operationCard">
          <div className="tableEmpty">
            Organizasyon bilgisi bulunamadı.
          </div>
        </section>
      </main>
    );
  }

  const supabase = await createClient();

  const [
    studentsResult,
    enrollmentsResult,
    paymentsResult,
    groupsResult,
    branchesResult,
    packagesResult,
  ] = await Promise.all([
    supabase
      .from("students")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("is_deleted", false)
      .order("first_name", {
        ascending: true,
      }),

    supabase
      .from("student_enrollments")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("status", "active")
      .order("created_at", {
        ascending: false,
      }),

    supabase
      .from("student_payments")
      .select("*")
      .eq("organization_id", organizationId)
      .order("received_at", {
        ascending: false,
        nullsFirst: false,
      }),

    supabase
      .from("training_groups")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("is_active", true),

    supabase
      .from("branches")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("is_active", true),

    supabase
      .from("course_packages")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("is_active", true),
  ]);

  const loadError =
    studentsResult.error ||
    enrollmentsResult.error ||
    paymentsResult.error ||
    groupsResult.error ||
    branchesResult.error ||
    packagesResult.error;

  if (loadError) {
    console.error(
      "Ödeme Merkezi yükleme hatası:",
      loadError
    );

    return (
      <main className="operationPage">
        <header className="operationHeader">
          <div>
            <p>SPRİNTOS · FİNANS YÖNETİMİ</p>

            <h1>Ödeme Merkezi</h1>

            <span>
              Öğrenci ödemeleri ve kayıt
              yenileme süreçleri.
            </span>
          </div>
        </header>

        <section className="operationCard">
          <div className="tableEmpty">
            Ödeme Merkezi yüklenemedi:{" "}
            {loadError.message}
          </div>
        </section>
      </main>
    );
  }

  const students =
    (studentsResult.data || []) as AnyRow[];

  const enrollments =
    (enrollmentsResult.data || []) as AnyRow[];

  const payments =
    (paymentsResult.data || []) as AnyRow[];

  const groups =
    (groupsResult.data || []) as AnyRow[];

  const branches =
    (branchesResult.data || []) as AnyRow[];

  const packages =
    (packagesResult.data || []) as AnyRow[];

  /*
   * --------------------------------------------------
   * HARİTALAR
   * --------------------------------------------------
   */

  const groupMap = new Map<string, AnyRow>();

  for (const group of groups) {
    if (group.id) {
      groupMap.set(group.id, group);
    }
  }

  const branchMap = new Map<string, AnyRow>();

  for (const branch of branches) {
    if (branch.id) {
      branchMap.set(branch.id, branch);
    }
  }

  const packageMap = new Map<string, AnyRow>();

  for (const coursePackage of packages) {
    if (coursePackage.id) {
      packageMap.set(
        coursePackage.id,
        coursePackage
      );
    }
  }

  /*
   * Her öğrencinin en güncel aktif kaydı.
   *
   * Query zaten created_at DESC geldiği için
   * ilk kayıt en güncel aktif kayıttır.
   */
  const enrollmentMap = new Map<
    string,
    AnyRow
  >();

  for (const enrollment of enrollments) {
    if (
      enrollment.student_id &&
      !enrollmentMap.has(
        enrollment.student_id
      )
    ) {
      enrollmentMap.set(
        enrollment.student_id,
        enrollment
      );
    }
  }

  /*
   * --------------------------------------------------
   * ÖDEME HAREKETLERİ
   * --------------------------------------------------
   */

  const paymentRecords: PaymentRecord[] =
    payments.map((payment) => ({
      id: String(payment.id),

      student_id: String(
        payment.student_id
      ),

      enrollment_id:
        payment.enrollment_id || null,

      amount: toNumber(payment.amount),

      currency:
        payment.currency || "TRY",

      payment_method:
        payment.payment_method || null,

      payment_status:
        payment.payment_status || null,

      description:
        payment.description || null,

      received_by:
        payment.received_by || null,

      received_at:
        payment.received_at || null,

      cash_handover_status:
        payment.cash_handover_status ||
        null,

      cash_handover_requested_at:
        payment.cash_handover_requested_at ||
        null,

      cash_handover_approved_by:
        payment.cash_handover_approved_by ||
        null,

      cash_handover_approved_at:
        payment.cash_handover_approved_at ||
        null,

      cancellation_reason:
        payment.cancellation_reason ||
        null,

      cancelled_by:
        payment.cancelled_by || null,

      cancelled_at:
        payment.cancelled_at || null,

      created_at:
        payment.created_at || null,

      /*
       * İleride Supabase'e due_date
       * eklediğimizde otomatik çalışacak.
       */
      due_date:
        payment.due_date || null,
    }));

  /*
   * İptal edilmiş ödeme hareketlerini
   * finans toplamlarına dahil etmiyoruz.
   */
  const validPayments =
    paymentRecords.filter(
      (payment) =>
        !payment.cancelled_at &&
        normalizeText(
          payment.payment_status
        ) !== "cancelled"
    );

  /*
   * --------------------------------------------------
   * ÖĞRENCİ + AKTİF PAKET + ÖDEME
   * --------------------------------------------------
   */

  const preparedStudents: PaymentStudent[] =
    students.map((student) => {
      const enrollment =
        enrollmentMap.get(student.id);

      /*
       * Gerçek aktif grup önce enrollment'dan.
       * Bulunamazsa öğrencinin tercih edilen
       * grubuna geri dönüyoruz.
       */
      const groupId =
        enrollment?.group_id ||
        student.preferred_group_id ||
        null;

      const group = groupId
        ? groupMap.get(groupId)
        : undefined;

      const branchId =
        group?.branch_id ||
        enrollment?.branch_id ||
        student.branch_id ||
        null;

      const branch = branchId
        ? branchMap.get(branchId)
        : undefined;

      /*
       * Paket ID'si enrollment'da varsa
       * onu kullan.
       *
       * Yoksa öğrencinin preferred_package_id
       * alanına geri dön.
       */
      const packageId =
        enrollment?.package_id ||
        enrollment?.course_package_id ||
        student.preferred_package_id ||
        null;

      const coursePackage = packageId
        ? packageMap.get(packageId)
        : undefined;

      /*
       * Paket fiyatı course_packages
       * tablosundan okunur.
       *
       * Kolon adı farklıysa yukarıdaki
       * getPackagePrice fonksiyonu
       * alternatif kolonları da kontrol eder.
       */
      const packagePrice =
        getPackagePrice(coursePackage);

      /*
       * SADECE BU AKTİF KAYDIN ÖDEMELERİ.
       *
       * Eski kayıt/paket ödemeleri
       * kesinlikle yeni döneme karışmaz.
       */
      const enrollmentPayments =
        enrollment?.id
          ? validPayments.filter(
              (payment) =>
                payment.student_id ===
                  student.id &&
                payment.enrollment_id ===
                  enrollment.id
            )
          : [];

      const totalPaid =
        enrollmentPayments.reduce(
          (sum, payment) =>
            sum +
            toNumber(payment.amount),
          0
        );

      const remainingPayment =
        Math.max(
          packagePrice - totalPaid,
          0
        );

      const totalLessons = toNumber(
        enrollment?.total_lessons ??
          coursePackage?.lesson_count ??
          coursePackage?.lessons ??
          0
      );

      const usedLessons = toNumber(
        enrollment?.used_lessons ?? 0
      );

      const remainingLessons =
        Math.max(
          totalLessons - usedLessons,
          0
        );

      const courseType =
        group?.course_type ||
        enrollment?.course_type ||
        null;

      const adult =
        isAdultCourse(courseType);

      /*
       * Çocukta önce veli telefonu.
       * Yetişkinde önce kendi telefonu.
       */
      const contactPhone = adult
        ? student.phone ||
          student.guardian_phone ||
          null
        : student.guardian_phone ||
          student.phone ||
          null;

      /*
       * Aktif paketin son ödeme hareketi.
       */
      const latestPayment =
        enrollmentPayments[0] || null;

      /*
       * Gelecekte due_date alanı
       * enrollment veya ödeme planında
       * tutulursa burada otomatik okunacak.
       */
      const dueDate =
        enrollment?.payment_due_date ||
        enrollment?.due_date ||
        latestPayment?.due_date ||
        null;

      return {
        id: String(student.id),

        student_number:
          student.student_number || null,

        first_name:
          student.first_name || "",

        last_name:
          student.last_name || "",

        status:
          student.status || null,

        phone:
          student.phone || null,

        guardian_name:
          student.guardian_name || null,

        guardian_phone:
          student.guardian_phone || null,

        contact_phone:
          contactPhone,

        is_adult:
          adult,

        branch_id:
          branchId,

        branch_name:
          branch?.name || null,

        group_id:
          groupId,

        group_name:
          group?.name || null,

        course_type:
          courseType,

        enrollment_id:
          enrollment?.id || null,

        package_id:
          packageId,

        package_name:
          coursePackage?.name ||
          enrollment?.package_name ||
          null,

        package_price:
          packagePrice,

        /*
         * AKTİF PAKET FİNANS ÖZETİ
         */
        total_paid:
          totalPaid,

        remaining_payment:
          remainingPayment,

        /*
         * KAYIT / DERS BİLGİLERİ
         */
        start_date:
          enrollment?.start_date ||
          null,

        end_date:
          enrollment?.planned_end_date ||
          enrollment?.end_date ||
          null,

        total_lessons:
          totalLessons,

        used_lessons:
          usedLessons,

        remaining_lessons:
          remainingLessons,

        /*
         * ÖDEME VADE TARİHİ
         */
        due_date:
          dueDate,

        /*
         * Son ödeme.
         */
        last_payment_at:
          latestPayment?.received_at ||
          null,

        last_payment_method:
          latestPayment?.payment_method ||
          null,

        /*
         * Aktif pakete ait ödeme geçmişi.
         */
        payments:
          enrollmentPayments,
      };
    });

  /*
   * Aktif olmayan öğrencileri de finans
   * geçmişi için göstermek isteyebiliriz.
   * Client tarafında filtrelenecek.
   */

  return (
    <main className="operationPage">
      <header className="operationHeader">
        <div>
          <p>
            SPRİNTOS · FİNANS YÖNETİMİ
          </p>

          <h1>Ödeme Merkezi</h1>

          <span>
            Öğrenci ödemelerini, aktif paket
            tahsilatlarını, kayıt yenilemelerini,
            WhatsApp bildirimlerini ve kasa
            teslim süreçlerini tek merkezden
            yönetin.
          </span>
        </div>
      </header>


      <nav
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 10,
          marginBottom: 18,
        }}
      >
        <Link
          href="/"
          style={{
            padding: "10px 14px",
            borderRadius: 12,
            background: "#156ff5",
            color: "#fff",
            fontWeight: 800,
            textDecoration: "none",
          }}
        >
          🏠 Ana Sayfa
        </Link>

        <Link
          href="/ogrenciler"
          style={{
            padding: "10px 14px",
            borderRadius: 12,
            background: "#fff",
            color: "#10213a",
            border: "1px solid #dbe5f1",
            fontWeight: 800,
            textDecoration: "none",
          }}
        >
          👤 Öğrenciler
        </Link>

        <Link
          href="/kasa"
          style={{
            padding: "10px 14px",
            borderRadius: 12,
            background: "#fff",
            color: "#10213a",
            border: "1px solid #dbe5f1",
            fontWeight: 800,
            textDecoration: "none",
          }}
        >
          💰 Günlük Kasa
        </Link>

        <Link
          href="/yoklama"
          style={{
            padding: "10px 14px",
            borderRadius: 12,
            background: "#fff",
            color: "#10213a",
            border: "1px solid #dbe5f1",
            fontWeight: 800,
            textDecoration: "none",
          }}
        >
          ✅ Yoklama
        </Link>

        <Link
          href="/onay-merkezi"
          style={{
            padding: "10px 14px",
            borderRadius: 12,
            background: "#fff",
            color: "#10213a",
            border: "1px solid #dbe5f1",
            fontWeight: 800,
            textDecoration: "none",
          }}
        >
          🛡️ Onay Merkezi
        </Link>
      </nav>

      <PaymentsClient
        students={preparedStudents}
        payments={validPayments}
        currentProfileId={profile.id}
      />
    </main>
  );
}
