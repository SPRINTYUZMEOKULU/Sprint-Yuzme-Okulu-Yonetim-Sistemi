import Link from "next/link";
import { requireProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function money(value: unknown) {
  const amount = Number(value ?? 0);

  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
  }).format(Number.isFinite(amount) ? amount : 0);
}

function fmtDate(value?: string | null) {
  if (!value) return "—";

  try {
    return new Intl.DateTimeFormat("tr-TR", {
      dateStyle: "medium",
      timeZone: "Europe/Istanbul",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

export default async function AttendancePage() {
  const profile = await requireProfile([
    "owner",
    "admin",
    "branch_manager",
    "registration_staff",
    "accounting",
    "coach",
  ]);

  const supabase = await createClient();

  const { data: students, error } = await supabase
    .from("students")
    .select("*")
    .eq("organization_id", profile.organization_id)
    .eq("is_deleted", false)
    .order("first_name");

  if (error) {
    return (
      <main style={{ padding: 32 }}>
        <h1>Yoklama</h1>
        <p>Öğrenciler yüklenemedi: {error.message}</p>
      </main>
    );
  }

  const studentIds = (students || []).map((s: any) => s.id);

  const [
    enrollmentsResult,
    paymentSummaryResult,
    lessonBalanceResult,
  ] = await Promise.all([
    studentIds.length
      ? supabase
          .from("student_enrollments")
          .select("*")
          .in("student_id", studentIds)
          .eq("status", "active")
      : Promise.resolve({ data: [] as any[] }),

    studentIds.length
      ? supabase
          .from("student_payment_summary")
          .select("*")
          .in("student_id", studentIds)
      : Promise.resolve({ data: [] as any[] }),

    studentIds.length
      ? supabase
          .from("student_lesson_balance")
          .select("*")
          .in("student_id", studentIds)
      : Promise.resolve({ data: [] as any[] }),
  ]);

  const enrollments = enrollmentsResult.data || [];
  const paymentSummaries = paymentSummaryResult.data || [];
  const lessonBalances = lessonBalanceResult.data || [];

  const rows = (students || []).map((student: any) => {
    const enrollment = enrollments.find(
      (e: any) => e.student_id === student.id
    );

    const payment = paymentSummaries.find(
      (p: any) => p.student_id === student.id
    );

    const balance = lessonBalances.find(
      (b: any) => b.student_id === student.id
    );

    const totalLessons = Number(
      enrollment?.total_lessons ?? 0
    );

    const usedLessons = Number(
      enrollment?.used_lessons ?? 0
    );

    const remainingLessons = Math.max(
      0,
      totalLessons - usedLessons
    );

    const compensation = Math.max(
      0,
      Number(balance?.compensation_lesson_balance ?? 0)
    );

    const plannedEnd =
      enrollment?.planned_end_date ?? null;

    const registrationExpired =
      plannedEnd
        ? new Date(plannedEnd).getTime() <
          new Date().setHours(0, 0, 0, 0)
        : false;

    const totalDue = Number(
      payment?.total_due ??
        payment?.package_amount ??
        0
    );

    const totalReceived = Number(
      payment?.total_received ?? 0
    );

    const outstanding = Math.max(
      0,
      Number(
        payment?.outstanding_balance ??
          payment?.remaining_balance ??
          totalDue - totalReceived
      )
    );

    return {
      student,
      enrollment,
      payment,
      remainingLessons,
      compensation,
      registrationExpired,
      outstanding,
    };
  });

  return (
    <main
      style={{
        minHeight: "100vh",
        padding: "32px",
        background:
          "linear-gradient(180deg,#f5f8fc 0%,#eef3f9 100%)",
        color: "#10213a",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 16,
          alignItems: "center",
          marginBottom: 24,
        }}
      >
        <div>
          <p
            style={{
              margin: 0,
              color: "#0b6ff4",
              fontSize: 12,
              fontWeight: 900,
              letterSpacing: ".12em",
            }}
          >
            SPRINTOS · YOKLAMA
          </p>

          <h1
            style={{
              margin: "5px 0 0",
              fontSize: 32,
            }}
          >
            Yoklama ve Ders Takibi
          </h1>

          <p
            style={{
              color: "#66758a",
              marginTop: 8,
            }}
          >
            Öğrenci devamı, kalan ders, kayıt ve ödeme durumunu
            tek ekrandan kontrol edin.
          </p>
        </div>

        <Link
          href="/"
          style={{
            textDecoration: "none",
            padding: "11px 16px",
            borderRadius: 12,
            background: "#fff",
            color: "#15385f",
            border: "1px solid #dce5ee",
            fontWeight: 800,
          }}
        >
          ← Yönetim Paneli
        </Link>
      </div>

      <section
        style={{
          background: "#fff",
          border: "1px solid #dfe8f2",
          borderRadius: 20,
          overflow: "hidden",
          boxShadow: "0 14px 36px rgba(15,42,76,.08)",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "2.2fr 1fr 1fr 1fr 1fr 1.1fr",
            gap: 12,
            padding: "14px 18px",
            background: "#eef4fa",
            fontSize: 11,
            fontWeight: 900,
            color: "#607089",
            textTransform: "uppercase",
          }}
        >
          <span>Öğrenci</span>
          <span>Kalan Ders</span>
          <span>Telafi</span>
          <span>Kayıt</span>
          <span>Ödeme</span>
          <span>İşlem</span>
        </div>

        {rows.map((row) => {
          const {
            student,
            remainingLessons,
            compensation,
            registrationExpired,
            outstanding,
          } = row;

          const lessonWarning =
            remainingLessons === 0
              ? {
                  text: "KAYIT YENİLE",
                  bg: "#7f1d1d",
                  color: "#fff",
                }
              : remainingLessons === 1
              ? {
                  text: "SON DERS",
                  bg: "#fee2e2",
                  color: "#991b1b",
                }
              : remainingLessons === 2
              ? {
                  text: "2 DERS KALDI",
                  bg: "#ffedd5",
                  color: "#9a3412",
                }
              : remainingLessons === 3
              ? {
                  text: "3 DERS KALDI",
                  bg: "#fef9c3",
                  color: "#854d0e",
                }
              : null;

          return (
            <div
              key={student.id}
              style={{
                display: "grid",
                gridTemplateColumns:
                  "2.2fr 1fr 1fr 1fr 1fr 1.1fr",
                gap: 12,
                alignItems: "center",
                padding: "16px 18px",
                borderTop: "1px solid #edf2f7",
              }}
            >
              <div>
                <strong
                  style={{
                    display: "block",
                    fontSize: 15,
                    color: "#123b68",
                  }}
                >
                  {student.first_name} {student.last_name}
                </strong>

                <span
                  style={{
                    display: "block",
                    marginTop: 4,
                    fontSize: 11,
                    color: "#7c8998",
                  }}
                >
                  {student.student_number || "Öğrenci no yok"}
                </span>

                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 6,
                    marginTop: 8,
                  }}
                >
                  {lessonWarning && (
                    <span
                      style={{
                        padding: "5px 8px",
                        borderRadius: 999,
                        background: lessonWarning.bg,
                        color: lessonWarning.color,
                        fontSize: 10,
                        fontWeight: 900,
                      }}
                    >
                      {lessonWarning.text}
                    </span>
                  )}

                  {registrationExpired && (
                    <span
                      style={{
                        padding: "5px 8px",
                        borderRadius: 999,
                        background: "#fee2e2",
                        color: "#991b1b",
                        fontSize: 10,
                        fontWeight: 900,
                      }}
                    >
                      KAYDI BİTMİŞ
                    </span>
                  )}

                  {outstanding > 0 && (
                    <span
                      style={{
                        padding: "5px 8px",
                        borderRadius: 999,
                        background: "#fee2e2",
                        color: "#991b1b",
                        fontSize: 10,
                        fontWeight: 900,
                      }}
                    >
                      ÖDEME BEKLİYOR
                    </span>
                  )}
                </div>
              </div>

              <strong
                style={{
                  fontSize: 20,
                  color:
                    remainingLessons <= 1
                      ? "#b91c1c"
                      : remainingLessons <= 3
                      ? "#c2410c"
                      : "#15803d",
                }}
              >
                {remainingLessons}
              </strong>

              <strong style={{ color: "#0b6ff4" }}>
                +{compensation}
              </strong>

              <span
                style={{
                  color: registrationExpired
                    ? "#b91c1c"
                    : "#15803d",
                  fontWeight: 800,
                }}
              >
                {registrationExpired
                  ? "Bitti"
                  : "Aktif"}
              </span>

              <span
                style={{
                  color:
                    outstanding > 0
                      ? "#b91c1c"
                      : "#15803d",
                  fontWeight: 800,
                }}
              >
                {outstanding > 0
                  ? money(outstanding)
                  : "Tamam"}
              </span>

              <Link
                href={`/ogrenciler/${student.id}`}
                style={{
                  display: "inline-flex",
                  justifyContent: "center",
                  padding: "9px 10px",
                  borderRadius: 10,
                  background: "#0b6ff4",
                  color: "#fff",
                  textDecoration: "none",
                  fontSize: 11,
                  fontWeight: 900,
                }}
              >
                Öğrenci Kartı
              </Link>
            </div>
          );
        })}

        {!rows.length && (
          <div
            style={{
              padding: 30,
              textAlign: "center",
              color: "#7d8997",
            }}
          >
            Aktif öğrenci bulunamadı.
          </div>
        )}
      </section>
    </main>
  );
}
