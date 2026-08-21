import Link from "next/link";

import { requireProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";

import KasaClient, {
  type CashPaymentRow,
} from "./kasa-client";

import "../dashboard.css";

export const dynamic = "force-dynamic";

type AnyRow = Record<string, any>;

function toNumber(value: unknown) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

export default async function CashPage() {
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
            <p>SPRİNTOS · FİNANS VE KASA</p>
            <h1>Günlük Kasa</h1>
            <span>Organizasyon bilgisi bulunamadı.</span>
          </div>
        </header>
      </main>
    );
  }

  const supabase = await createClient();

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const [
    paymentsResult,
    studentsResult,
    profilesResult,
  ] = await Promise.all([
    supabase
      .from("student_payments")
      .select("*")
      .eq("organization_id", organizationId)
      .gte("received_at", today.toISOString())
      .lt("received_at", tomorrow.toISOString())
      .order("received_at", {
        ascending: false,
      }),

    supabase
      .from("students")
      .select("id,first_name,last_name,student_number,phone,guardian_phone")
      .eq("organization_id", organizationId),

    supabase
      .from("profiles")
      .select("id,full_name,email")
      .eq("organization_id", organizationId),
  ]);

  const loadError =
    paymentsResult.error ||
    studentsResult.error ||
    profilesResult.error;

  if (loadError) {
    console.error(
      "Günlük Kasa yükleme hatası:",
      loadError
    );

    return (
      <main className="operationPage">
        <header className="operationHeader">
          <div>
            <p>SPRİNTOS · FİNANS VE KASA</p>
            <h1>Günlük Kasa</h1>
            <span>
              Günlük tahsilat ve kasa teslim hareketleri.
            </span>
          </div>
        </header>

        <section className="operationCard">
          <div className="tableEmpty">
            Günlük Kasa yüklenemedi:{" "}
            {loadError.message}
          </div>
        </section>
      </main>
    );
  }

  const students =
    (studentsResult.data || []) as AnyRow[];

  const profiles =
    (profilesResult.data || []) as AnyRow[];

  const studentMap = new Map(
    students.map((student) => [
      student.id,
      student,
    ])
  );

  const profileMap = new Map(
    profiles.map((userProfile) => [
      userProfile.id,
      userProfile,
    ])
  );

  const rows: CashPaymentRow[] = (
    (paymentsResult.data || []) as AnyRow[]
  ).map((payment) => {
    const student =
      studentMap.get(payment.student_id);

    const receiver =
      profileMap.get(payment.received_by);

    return {
      id: String(payment.id),

      student_id:
        payment.student_id || null,

      student_number:
        student?.student_number || null,

      student_name:
        `${student?.first_name || ""} ${
          student?.last_name || ""
        }`.trim() || "Öğrenci bilgisi yok",

      contact_phone:
        student?.guardian_phone ||
        student?.phone ||
        null,

      amount:
        toNumber(payment.amount),

      currency:
        payment.currency || "TRY",

      payment_method:
        payment.payment_method || null,

      payment_status:
        payment.payment_status || null,

      description:
        payment.description || null,

      received_at:
        payment.received_at || null,

      received_by:
        payment.received_by || null,

      received_by_name:
        receiver?.full_name ||
        receiver?.email ||
        null,

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

      cancelled_at:
        payment.cancelled_at || null,

      cancellation_reason:
        payment.cancellation_reason || null,
    };
  });

  return (
    <main className="operationPage">
      <header className="operationHeader">
        <div>
          <p>SPRİNTOS · FİNANS VE KASA</p>

          <h1>Günlük Kasa</h1>

          <span>
            Bugün alınan ödemeleri, ödeme yöntemlerini,
            personeldeki nakdi ve ana kasa teslim durumunu
            tek ekrandan yönetin.
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
          href="/odemeler"
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
          💳 Ödeme Merkezi
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

      <KasaClient
        rows={rows}
        currentProfileId={profile.id}
      />
    </main>
  );
}
