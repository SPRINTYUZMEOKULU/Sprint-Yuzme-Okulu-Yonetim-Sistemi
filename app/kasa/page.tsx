import { createClient as createAdminClient } from "@supabase/supabase-js";
import Link from "next/link";

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

function getIstanbulTodayKey() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const year = parts.find((part) => part.type === "year")?.value || "";
  const month = parts.find((part) => part.type === "month")?.value || "";
  const day = parts.find((part) => part.type === "day")?.value || "";

  return `${year}-${month}-${day}`;
}

function normalizeSelectedDate(value: string | undefined, todayKey: string) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return todayKey;
  }

  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));

  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return todayKey;
  }

  return value > todayKey ? todayKey : value;
}

function shiftDateKey(dateKey: string, days: number) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));

  return shifted.toISOString().slice(0, 10);
}

function getIstanbulDayBounds(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);

  // Türkiye kalıcı olarak UTC+03:00 kullanıyor. Kasa günü İstanbul yerel
  // saatine göre 00:00–24:00 aralığında hesaplanır; Vercel sunucu saatine bağlı kalmaz.
  const start = new Date(Date.UTC(year, month - 1, day, -3, 0, 0, 0));
  const end = new Date(Date.UTC(year, month - 1, day + 1, -3, 0, 0, 0));

  return {
    startIso: start.toISOString(),
    endIso: end.toISOString(),
  };
}

function formatDayLabel(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);

  return new Intl.DateTimeFormat("tr-TR", {
    timeZone: "Europe/Istanbul",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(Date.UTC(year, month - 1, day, 12, 0, 0)));
}

export default async function CashPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { date } = await searchParams;
  const todayKey = getIstanbulTodayKey();
  const selectedDateKey = normalizeSelectedDate(date, todayKey);
  const selectedDayLabel = formatDayLabel(selectedDateKey);
  const previousDateKey = shiftDateKey(selectedDateKey, -1);
  const nextDateKey = shiftDateKey(selectedDateKey, 1);
  const isToday = selectedDateKey === todayKey;
  const canGoNext = nextDateKey <= todayKey;
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

  const { startIso, endIso } = getIstanbulDayBounds(selectedDateKey);

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
            {isToday ? "Bugün" : selectedDayLabel} alınan ödemeleri, ödeme
            yöntemlerini, personeldeki nakdi ve ana kasa teslim durumunu tek
            ekrandan yönetin.
          </span>
        </div>
      </header>

      <FinanceQuickNav />

      <section className="cashDateNavigator" aria-label="Kasa tarihi">
        <Link href={`/kasa?date=${previousDateKey}`} className="cashDateArrow">
          ← Önceki Gün
        </Link>

        <div className="cashDateCurrent">
          <small>{isToday ? "BUGÜN" : "SEÇİLİ GÜN"}</small>
          <strong>{selectedDayLabel}</strong>
        </div>

        {canGoNext ? (
          <Link href={`/kasa?date=${nextDateKey}`} className="cashDateArrow">
            Sonraki Gün →
          </Link>
        ) : (
          <span className="cashDateArrow disabled" aria-disabled="true">
            Sonraki Gün →
          </span>
        )}
      </section>

      {!isToday ? (
        <div className="cashTodayShortcut">
          <Link href="/kasa">Bugünün Kasasına Dön</Link>
        </div>
      ) : null}

      <KasaClient
        rows={rows}
        currentProfileId={profile.id}
        dayLabel={selectedDayLabel}
        isToday={isToday}
      />

      <style>{`
        .cashDateNavigator {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
          align-items: center;
          gap: 14px;
          margin: 18px 0;
          padding: 14px;
          border: 1px solid #d7e4f4;
          border-radius: 22px;
          background: #ffffff;
          box-shadow: 0 10px 28px rgba(15, 23, 42, 0.05);
        }

        .cashDateArrow {
          min-height: 48px;
          padding: 0 16px;
          border: 1px solid #d7e4f4;
          border-radius: 15px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          color: #16345c;
          background: #f8fbff;
          font-weight: 800;
          text-decoration: none;
        }

        .cashDateArrow:last-child {
          justify-self: end;
        }

        .cashDateArrow.disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .cashDateCurrent {
          min-width: 220px;
          text-align: center;
          display: grid;
          gap: 3px;
        }

        .cashDateCurrent small {
          color: #2372e8;
          font-weight: 900;
          letter-spacing: 0.08em;
          font-size: 11px;
        }

        .cashDateCurrent strong {
          color: #102542;
          font-size: 17px;
        }

        .cashTodayShortcut {
          margin: -4px 0 16px;
          text-align: center;
        }

        .cashTodayShortcut a {
          color: #2372e8;
          font-weight: 800;
          text-decoration: none;
        }

        @media (max-width: 720px) {
          .cashDateNavigator {
            grid-template-columns: 1fr 1fr;
            gap: 10px;
            border-radius: 18px;
          }

          .cashDateCurrent {
            grid-column: 1 / -1;
            grid-row: 1;
            min-width: 0;
            padding: 4px 0 8px;
          }

          .cashDateArrow {
            width: 100%;
            min-height: 46px;
            padding: 0 10px;
            font-size: 14px;
          }

          .cashDateArrow:last-child {
            justify-self: stretch;
          }
        }
      `}</style>
    </main>
  );
}
