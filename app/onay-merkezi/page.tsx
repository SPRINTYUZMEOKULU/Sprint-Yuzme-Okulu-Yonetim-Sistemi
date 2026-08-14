import Link from "next/link";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type StatusRequest = {
  id: string;
  student_id: string;
  organization_id: string;
  branch_id: string | null;
  group_id: string | null;
  request_type: string;
  reason: string | null;
  description: string | null;
  old_status: string | null;
  new_status: string | null;
  requested_status: string | null;
  status: string;
  requested_by: string | null;
  requested_at: string | null;
  created_at: string | null;
};

function formatDate(value: string | null) {
  if (!value) return "—";

  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Europe/Istanbul",
  }).format(new Date(value));
}

export default async function ApprovalCenterPage() {
  const profile = await requireProfile();

  if (!["owner", "admin", "branch_manager"].includes(profile.role)) {
    redirect("/yetkisiz");
  }

  const supabase = await createClient();

  const { data: requests, error } = await supabase
    .from("student_status_change_requests")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  const rows = (requests ?? []) as StatusRequest[];

  const studentIds = [...new Set(rows.map((item) => item.student_id).filter(Boolean))];

  const { data: students } =
    studentIds.length > 0
      ? await supabase
          .from("students")
          .select("id, first_name, last_name, branch_id, group_id")
          .in("id", studentIds)
      : { data: [] };

  const studentMap = new Map(
    (students ?? []).map((student) => [student.id, student])
  );

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f4f7fb",
        padding: "32px",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div style={{ maxWidth: "1280px", margin: "0 auto" }}>
        <div style={{ marginBottom: "28px" }}>
          <div
            style={{
              color: "#1769e0",
              fontSize: "12px",
              fontWeight: 800,
              letterSpacing: "1px",
              marginBottom: "8px",
            }}
          >
            SPRINT YÜZME OKULU
          </div>

          <h1
            style={{
              margin: 0,
              color: "#14213d",
              fontSize: "32px",
            }}
          >
            Onay Merkezi
          </h1>

          <p style={{ color: "#667085", marginTop: "8px" }}>
            Yönetici onayı bekleyen öğrenci işlemleri.
          </p>

          <Link
            href="/"
            style={{
              color: "#1769e0",
              fontWeight: 700,
              textDecoration: "none",
            }}
          >
            ← Yönetim paneline dön
          </Link>
        </div>

        {error ? (
          <div
            style={{
              background: "#fff1f1",
              border: "1px solid #ffcaca",
              padding: "18px",
              borderRadius: "12px",
              color: "#a61b1b",
            }}
          >
            Talepler yüklenemedi: {error.message}
          </div>
        ) : rows.length === 0 ? (
          <div
            style={{
              background: "white",
              border: "1px solid #e5e7eb",
              borderRadius: "16px",
              padding: "50px 24px",
              textAlign: "center",
            }}
          >
            <div
              style={{
                fontSize: "20px",
                fontWeight: 800,
                color: "#14213d",
              }}
            >
              Bekleyen talep bulunmuyor
            </div>

            <p style={{ color: "#667085" }}>
              Yönetici onayına gönderilen işlemler burada görüntülenecek.
            </p>
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gap: "16px",
            }}
          >
            {rows.map((request) => {
              const student = studentMap.get(request.student_id);

              const studentName = student
                ? `${student.first_name ?? ""} ${student.last_name ?? ""}`.trim()
                : "Öğrenci";

              return (
                <div
                  key={request.id}
                  style={{
                    background: "white",
                    border: "1px solid #e5e7eb",
                    borderRadius: "16px",
                    padding: "22px",
                    boxShadow: "0 4px 16px rgba(16,24,40,0.05)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: "20px",
                      flexWrap: "wrap",
                    }}
                  >
                    <div>
                      <div
                        style={{
                          color: "#1769e0",
                          fontSize: "12px",
                          fontWeight: 800,
                          marginBottom: "6px",
                        }}
                      >
                        PASİFE ALMA TALEBİ
                      </div>

                      <div
                        style={{
                          fontSize: "21px",
                          fontWeight: 800,
                          color: "#14213d",
                        }}
                      >
                        {studentName}
                      </div>

                      <div
                        style={{
                          color: "#667085",
                          marginTop: "5px",
                          fontSize: "14px",
                        }}
                      >
                        Talep tarihi:{" "}
                        {formatDate(request.requested_at ?? request.created_at)}
                      </div>
                    </div>

                    <div
                      style={{
                        background: "#fff7e8",
                        color: "#a15c00",
                        border: "1px solid #ffd89a",
                        borderRadius: "999px",
                        padding: "7px 13px",
                        fontWeight: 800,
                        height: "fit-content",
                        fontSize: "13px",
                      }}
                    >
                      Yönetici Onayı Bekliyor
                    </div>
                  </div>

                  <div
                    style={{
                      marginTop: "20px",
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                      gap: "12px",
                    }}
                  >
                    <div>
                      <div style={{ color: "#667085", fontSize: "12px" }}>
                        Mevcut Durum
                      </div>
                      <strong>{request.old_status ?? "Aktif"}</strong>
                    </div>

                    <div>
                      <div style={{ color: "#667085", fontSize: "12px" }}>
                        Talep Edilen Durum
                      </div>
                      <strong>
                        {request.requested_status ??
                          request.new_status ??
                          "Pasif"}
                      </strong>
                    </div>

                    <div>
                      <div style={{ color: "#667085", fontSize: "12px" }}>
                        Gerekçe
                      </div>
                      <strong>{request.reason ?? "—"}</strong>
                    </div>
                  </div>

                  {request.description && (
                    <div
                      style={{
                        marginTop: "18px",
                        background: "#f8fafc",
                        border: "1px solid #e5e7eb",
                        borderRadius: "10px",
                        padding: "14px",
                      }}
                    >
                      <div
                        style={{
                          fontSize: "12px",
                          color: "#667085",
                          marginBottom: "5px",
                        }}
                      >
                        Açıklama / Not
                      </div>

                      <div style={{ color: "#14213d" }}>
                        {request.description}
                      </div>
                    </div>
                  )}

                  <div
                    style={{
                      marginTop: "20px",
                      borderTop: "1px solid #e5e7eb",
                      paddingTop: "16px",
                      color: "#667085",
                      fontSize: "13px",
                    }}
                  >
                    Talep No: {request.id}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
