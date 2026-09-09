import { createClient as createAdminClient } from "@supabase/supabase-js";

import FinanceQuickNav from "@/app/components/finance-quick-nav";
import { requireProfile } from "@/lib/auth/profile";

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

function createFinanceAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Supabase finans bağlantısı yapılandırılmamış.");
  }

  return createAdminClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function getIstanbulTodayBounds() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const day = Number(parts.find((part) => part.type === "day")?.value);

  // Türkiye kalıcı olarak UTC+03:00 kullanıyor. Kasa günü İstanbul yerel
  // saatine göre 00:00–24:00 aralığında hesaplanır; Vercel sunucu saatine bağlı kalmaz.
  const start = new Date(Date.UTC(year, month - 1, day, -3, 0, 0, 0));
  const end = new Date(Date.UTC(year, month - 1, day + 1, -3, 0, 0, 0));

  return {
    startIso: start.toISOString(),
    endIso: end.toISOString(),
  };
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

  let supabase;

  try {
    // Sayfaya erişim önce requireProfile ile yetkilendirilir. Finans verisi daha
    // sonra sunucudan service-role ile okunur; RLS yüzünden sessizce boş liste
    // dönmesi engellenir ve Ödeme Merkezi ile aynı gerçek kayıtlar kullanılır.
    supabase = createFinanceAdminClient();
  } catch (error) {
    return (
      <main className="operationPage">
        <header className="operationHeader">
          <div>
            <p>SPRİNTOS · FİNANS VE KASA</p>
            <h1>Günlük Kasa</h1>
            <span>Günlük tahsilat ve kasa teslim hareketleri.</span>
          </div>
        </header>

        <section className="operationCard">
          <div className="tableEmpty">
            Günlük Kasa bağlantısı kurulamadı:{" "}
            {error instanceof Error ? error.message : "Bilinmeyen hata"}
          </div>
        </section>
      </main>
    );
  }

  const { startIso, endIso } = getIstanbulTodayBounds();

  const [paymentsResult, studentsResult, profilesResult] = await Promise.all([
    supabase
      .from("student_payments")
      .select("*")
      .eq("organization_id", organizationId)
      .gte("received_at", startIso)
      .lt("received_at", endIso)
      .order("received_at", {
        ascending: false,
        nullsFirst: false,
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
    paymentsResult.error || studentsResult.error || profilesResult.error;

  if (loadError) {
    console.error("Günlük Kasa yükleme hatası:", loadError);

    return (
      <main className="operationPage">
        <header className="operationHeader">
          <div>
            <p>SPRİNTOS · FİNANS VE KASA</p>
            <h1>Günlük Kasa</h1>
            <span>Günlük tahsilat ve kasa teslim hareketleri.</span>
          </div>
        </header>

        <FinanceQuickNav />

        <section className="operationCard">
          <div className="tableEmpty">
            Günlük Kasa yüklenemedi: {loadError.message}
          </div>
        </section>
      </main>
    );
  }

  const students = (studentsResult.data || []) as AnyRow[];
  const profiles = (profilesResult.data || []) as AnyRow[];

  const studentMap = new Map(
    students.map((student) => [student.id, student]),
  );

  const profileMap = new Map(
    profiles.map((userProfile) => [userProfile.id, userProfile]),
  );

  const rows: CashPaymentRow[] = (
    (paymentsResult.data || []) as AnyRow[]
  ).map((payment) => {
    const student = studentMap.get(payment.student_id);
    const receiver = profileMap.get(payment.received_by);

    return {
      id: String(payment.id),
      student_id: payment.student_id || null,
      student_number: student?.student_number || null,
      student_name:
        `${student?.first_name || ""} ${student?.last_name || ""}`.trim() ||
        "Öğrenci bilgisi yok",
      contact_phone: student?.guardian_phone || student?.phone || null,
      amount: toNumber(payment.amount),
      currency: payment.currency || "TRY",
      payment_method: payment.payment_method || null,
      payment_status: payment.payment_status || null,
      description: payment.description || null,
      received_at: payment.received_at || null,
      received_by: payment.received_by || null,
      received_by_name: receiver?.full_name || receiver?.email || null,
      cash_handover_status: payment.cash_handover_status || null,
      cash_handover_requested_at: payment.cash_handover_requested_at || null,
      cash_handover_approved_by: payment.cash_handover_approved_by || null,
      cash_handover_approved_at: payment.cash_handover_approved_at || null,
      cancelled_at: payment.cancelled_at || null,
      cancellation_reason: payment.cancellation_reason || null,
    };
  });

  return (
    <main className="operationPage">
      <header className="operationHeader">
        <div>
          <p>SPRİNTOS · FİNANS VE KASA</p>
          <h1>Günlük Kasa</h1>
          <span>
            Bugün alınan ödemeleri, ödeme yöntemlerini, personeldeki nakdi ve
            ana kasa teslim durumunu tek ekrandan yönetin.
          </span>
        </div>
      </header>

      <FinanceQuickNav />

      <KasaClient rows={rows} currentProfileId={profile.id} />
    </main>
  );
}
