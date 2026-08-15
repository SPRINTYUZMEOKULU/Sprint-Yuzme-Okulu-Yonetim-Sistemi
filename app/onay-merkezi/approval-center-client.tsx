"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type StudentInfo = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  guardian_name: string | null;
  guardian_phone: string | null;
  emergency_contact_phone: string | null;
  branch_id: string | null;
};

type ApprovalRequest = {
  id: string;
  source: "student_status" | "lesson_adjustment";
  category: "student" | "lesson";

  request_type: string;
  request_label?: string | null;

  student_id: string | null;
  branch_id: string | null;
  group_id: string | null;

  lesson_count: number | null;

  reason: string | null;
  description: string | null;

  old_status: string | null;
  new_status: string | null;
  requested_status: string | null;

  status: string;

  requested_by: string | null;
  requested_at: string | null;
  created_at: string | null;

  student: StudentInfo | null;

  recipient_phone?: string | null;
  recipient_type?: "student" | "guardian" | "emergency" | null;

  suggested_message?: string | null;
};

type ApiResponse = {
  ok: boolean;
  error?: string;
  details?: string;
  counts?: {
    total: number;
    student: number;
    lesson: number;
  };
  requests?: ApprovalRequest[];
};

function formatDate(value: string | null) {
  if (!value) return "—";

  try {
    return new Intl.DateTimeFormat("tr-TR", {
      dateStyle: "short",
      timeStyle: "short",
      timeZone: "Europe/Istanbul",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function getStudentName(request: ApprovalRequest) {
  const firstName = request.student?.first_name ?? "";
  const lastName = request.student?.last_name ?? "";
  const fullName = `${firstName} ${lastName}`.trim();

  return fullName || "Öğrenci";
}

function getRequestLabel(request: ApprovalRequest) {
  if (request.request_label) return request.request_label;

  switch (request.request_type) {
    case "made_passive":
      return "Pasife Alma";
    case "individual_compensation":
      return "Bireysel Telafi";
    case "lesson_count_change":
      return "Ders Sayısı Değişikliği";
    default:
      return request.request_type || "İşlem Talebi";
  }
}

function getPhoneLabel(type?: ApprovalRequest["recipient_type"]) {
  switch (type) {
    case "guardian":
      return "Veli";
    case "emergency":
      return "Acil Durum";
    case "student":
      return "Öğrenci";
    default:
      return "Telefon";
  }
}

function cleanPhone(phone: string) {
  return phone.replace(/\D/g, "");
}

function createWhatsAppUrl(phone: string, message: string) {
  let cleaned = cleanPhone(phone);

  if (cleaned.startsWith("0")) {
    cleaned = `90${cleaned.slice(1)}`;
  } else if (cleaned.length === 10) {
    cleaned = `90${cleaned}`;
  }

  return `https://wa.me/${cleaned}?text=${encodeURIComponent(message)}`;
}

export default function ApprovalCenterClient() {
 const [requests, setRequests] = useState<ApprovalRequest[]>([]);

const [filter, setFilter] =
  useState<"all" | "student" | "lesson">("all");

const [counts, setCounts] = useState({
  total: 0,
  student: 0,
  lesson: 0,
});

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [processingId, setProcessingId] = useState<string | null>(null);

  async function loadRequests() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/approval-center", {
        method: "GET",
        cache: "no-store",
      });

      const data = (await response.json()) as ApiResponse;

      if (!response.ok || !data.ok) {
        throw new Error(
          data.details || data.error || "Onay talepleri alınamadı."
        );
      }

      setRequests(data.requests ?? []);
      setCounts(
        data.counts ?? {
          total: data.requests?.length ?? 0,
          student: 0,
          lesson: 0,
        }
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Onay talepleri yüklenirken hata oluştu."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadRequests();
  }, []); 
  const filteredRequests = requests.filter((request) => {
  if (filter === "all") return true;
  return request.category === filter;
});

  async function processRequest(
    request: ApprovalRequest,
    action: "approve" | "reject"
  ) {
    const actionText = action === "approve" ? "onaylamak" : "reddetmek";

    const confirmed = window.confirm(
      `${getStudentName(request)} için "${getRequestLabel(
        request
      )}" talebini ${actionText} istediğinize emin misiniz?`
    );

    if (!confirmed) return;

    setProcessingId(request.id);
    setError("");

    try {
      const response = await fetch("/api/approval-center", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: request.id,
          source: request.source,
          action,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(
          data.details ||
            data.error ||
            `Talep ${action === "approve" ? "onaylanamadı" : "reddedilemedi"}.`
        );
      }

      setRequests((current) =>
        current.filter((item) => item.id !== request.id)
      );

      setCounts((current) => ({
        total: Math.max(0, current.total - 1),
        student:
          request.category === "student"
            ? Math.max(0, current.student - 1)
            : current.student,
        lesson:
          request.category === "lesson"
            ? Math.max(0, current.lesson - 1)
            : current.lesson,
      }));

      if (
        action === "approve" &&
        request.recipient_phone &&
        request.suggested_message
      ) {
        const sendMessage = window.confirm(
          "Talep onaylandı.\n\nKursiyere / veliye WhatsApp bilgilendirme mesajı göndermek ister misiniz?"
        );

        if (sendMessage) {
          window.open(
            createWhatsAppUrl(
              request.recipient_phone,
              request.suggested_message
            ),
            "_blank",
            "noopener,noreferrer"
          );
        }
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "İşlem sırasında hata oluştu."
      );
    } finally {
      setProcessingId(null);
    }
  }

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
            Yönetici onayı bekleyen öğrenci ve ders işlemleri.
          </p>

          <div
            style={{
              display: "flex",
              gap: "10px",
              flexWrap: "wrap",
              marginTop: "18px",
              marginBottom: "18px",
            }}
          >
          <button
  type="button"
  onClick={() => setFilter("all")}
  style={{
    ...summaryCardStyle,
    cursor: "pointer",
    border: filter === "all" ? "2px solid #2563eb" : "1px solid #e5e7eb",
    background: filter === "all" ? "#eff6ff" : "#ffffff",
  }}
>
  <span style={summaryNumberStyle}>{counts.total}</span>
  <span style={summaryLabelStyle}>Toplam Bekleyen</span>
</button>

<button
  type="button"
  onClick={() => setFilter("student")}
  style={{
    ...summaryCardStyle,
    cursor: "pointer",
    border: filter === "student" ? "2px solid #2563eb" : "1px solid #e5e7eb",
    background: filter === "student" ? "#eff6ff" : "#ffffff",
  }}
>
  <span style={summaryNumberStyle}>{counts.student}</span>
  <span style={summaryLabelStyle}>Öğrenci İşlemi</span>
</button>

<button
  type="button"
  onClick={() => setFilter("lesson")}
  style={{
    ...summaryCardStyle,
    cursor: "pointer",
    border: filter === "lesson" ? "2px solid #2563eb" : "1px solid #e5e7eb",
    background: filter === "lesson" ? "#eff6ff" : "#ffffff",
  }}
>
  <span style={summaryNumberStyle}>{counts.lesson}</span>
  <span style={summaryLabelStyle}>Ders İşlemi</span>
</button>
          <div
            style={{
              display: "flex",
              gap: "18px",
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
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

            <button
              type="button"
              onClick={() => void loadRequests()}
              disabled={loading}
              style={{
                border: "1px solid #d0d5dd",
                background: "white",
                color: "#344054",
                borderRadius: "8px",
                padding: "8px 13px",
                fontWeight: 700,
                cursor: loading ? "not-allowed" : "pointer",
              }}
            >
              {loading ? "Yükleniyor..." : "Yenile"}
            </button>
          </div>
        </div>

        {error && (
          <div
            style={{
              background: "#fff1f1",
              border: "1px solid #ffcaca",
              padding: "16px",
              borderRadius: "12px",
              color: "#a61b1b",
              marginBottom: "18px",
              fontWeight: 600,
            }}
          >
            {error}
          </div>
        )}

        {loading ? (
          <div style={emptyStyle}>
            <div
              style={{
                fontSize: "20px",
                fontWeight: 800,
                color: "#14213d",
              }}
            >
              Onay talepleri yükleniyor...
            </div>
         </div>
) : filteredRequests.length === 0 ? (
          <div style={emptyStyle}>
            <div
              style={{
                fontSize: "22px",
                fontWeight: 800,
                color: "#14213d",
              }}
            >
              Bekleyen talep bulunmuyor
            </div>

            <p style={{ color: "#667085", marginBottom: 0 }}>
              Yönetici onayına gönderilen işlemler burada görüntülenecek.
            </p>
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gap: "16px",
            }}
         >{filteredRequests.map((request) => {
              const studentName = getStudentName(request);
              const requestLabel = getRequestLabel(request);
              const isProcessing = processingId === request.id;

              return (
                <div
                  key={`${request.source}-${request.id}`}
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
                          color:
                            request.category === "student"
                              ? "#1769e0"
                              : "#7c3aed",
                          fontSize: "12px",
                          fontWeight: 800,
                          marginBottom: "6px",
                          textTransform: "uppercase",
                        }}
                      >
                        {requestLabel} TALEBİ
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
                        {formatDate(
                          request.requested_at ?? request.created_at
                        )}
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
                      gridTemplateColumns:
                        "repeat(auto-fit, minmax(180px, 1fr))",
                      gap: "12px",
                    }}
                  >
                    {request.category === "student" ? (
                      <>
                        <Info
                          label="Mevcut Durum"
                          value={request.old_status ?? "Aktif"}
                        />

                        <Info
                          label="Talep Edilen Durum"
                          value={
                            request.requested_status ??
                            request.new_status ??
                            "Pasif"
                          }
                        />
                      </>
                    ) : (
                      <Info
                        label="Ders Sayısı"
                        value={
                          request.lesson_count != null
                            ? `${request.lesson_count} ders`
                            : "—"
                        }
                      />
                    )}

                    <Info
                      label="Gerekçe"
                      value={request.reason ?? "—"}
                    />

                    {request.recipient_phone && (
                      <Info
                        label={`${getPhoneLabel(
                          request.recipient_type
                        )} Telefonu`}
                        value={request.recipient_phone}
                      />
                    )}
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

                  {request.suggested_message && (
                    <div
                      style={{
                        marginTop: "14px",
                        background: "#f0fdf4",
                        border: "1px solid #bbf7d0",
                        borderRadius: "10px",
                        padding: "14px",
                      }}
                    >
                      <div
                        style={{
                          fontSize: "12px",
                          color: "#667085",
                          marginBottom: "6px",
                        }}
                      >
                        Onay Sonrası Bilgilendirme Mesajı
                      </div>

                      <div
                        style={{
                          color: "#14213d",
                          whiteSpace: "pre-wrap",
                          lineHeight: 1.5,
                        }}
                      >
                        {request.suggested_message}
                      </div>
                    </div>
                  )}

                  <div
                    style={{
                      marginTop: "20px",
                      borderTop: "1px solid #e5e7eb",
                      paddingTop: "16px",
                      display: "flex",
                      justifyContent: "space-between",
                      gap: "16px",
                      flexWrap: "wrap",
                      alignItems: "center",
                    }}
                  >
                    <div
                      style={{
                        color: "#667085",
                        fontSize: "12px",
                        wordBreak: "break-all",
                      }}
                    >
                      Talep No: {request.id}
                    </div>

                    <div
                      style={{
                        display: "flex",
                        gap: "10px",
                        flexWrap: "wrap",
                      }}
                    >
                      <button
                        type="button"
                        disabled={isProcessing}
                        onClick={() =>
                          void processRequest(request, "reject")
                        }
                        style={{
                          border: "1px solid #fda29b",
                          background: "#fff",
                          color: "#b42318",
                          borderRadius: "9px",
                          padding: "10px 18px",
                          fontWeight: 800,
                          cursor: isProcessing
                            ? "not-allowed"
                            : "pointer",
                          opacity: isProcessing ? 0.6 : 1,
                        }}
                      >
                        Reddet
                      </button>

                      <button
                        type="button"
                        disabled={isProcessing}
                        onClick={() =>
                          void processRequest(request, "approve")
                        }
                        style={{
                          border: "1px solid #1769e0",
                          background: "#1769e0",
                          color: "white",
                          borderRadius: "9px",
                          padding: "10px 20px",
                          fontWeight: 800,
                          cursor: isProcessing
                            ? "not-allowed"
                            : "pointer",
                          opacity: isProcessing ? 0.6 : 1,
                        }}
                      >
                        {isProcessing
                          ? "İşleniyor..."
                          : "Onayla"}
                      </button>
                    </div>
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

function Info({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <div
        style={{
          color: "#667085",
          fontSize: "12px",
          marginBottom: "3px",
        }}
      >
        {label}
      </div>

      <strong
        style={{
          color: "#14213d",
          wordBreak: "break-word",
        }}
      >
        {value}
      </strong>
    </div>
  );
}

const summaryCardStyle = {
  background: "white",
  border: "1px solid #e5e7eb",
  borderRadius: "12px",
  padding: "12px 18px",
  display: "flex",
  flexDirection: "column" as const,
  minWidth: "145px",
};

const summaryNumberStyle = {
  color: "#14213d",
  fontWeight: 900,
  fontSize: "22px",
};

const summaryLabelStyle = {
  color: "#667085",
  fontSize: "12px",
  marginTop: "2px",
};

const emptyStyle = {
  background: "white",
  border: "1px solid #e5e7eb",
  borderRadius: "16px",
  padding: "50px 24px",
  textAlign: "center" as const,
};
