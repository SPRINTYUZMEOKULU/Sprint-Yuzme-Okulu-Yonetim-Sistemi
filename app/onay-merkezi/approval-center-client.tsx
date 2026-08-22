"use client";

import { useEffect, useMemo, useState } from "react";
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

type Category =
  | "finance"
  | "student"
  | "enrollment"
  | "lesson"
  | "attendance"
  | "staff"
  | "system";

type ApprovalRequest = {
  id: string;

  source:
    | "approval_request"
    | "student_status"
    | "lesson_adjustment";

  category: Category;

  module?: string | null;
  priority?: string | null;

  request_type: string;
  request_label?: string | null;

  student_id: string | null;
  branch_id: string | null;
  group_id: string | null;

  entity_type?: string | null;
  entity_id?: string | null;

  lesson_count: number | null;

  reason: string | null;
  description: string | null;

  old_status: string | null;
  new_status: string | null;
  requested_status: string | null;

  old_values?: Record<string, unknown>;
  new_values?: Record<string, unknown>;
  metadata?: Record<string, unknown>;

  status: string;

  requested_by: string | null;
  requested_by_name?: string | null;
  requested_at: string | null;
  created_at: string | null;

  reviewed_by?: string | null;
  reviewed_by_name?: string | null;
  reviewed_at?: string | null;
  review_note?: string | null;
  applied_at?: string | null;

  student: StudentInfo | null;

  recipient_phone?: string | null;
  recipient_type?: "student" | "guardian" | "emergency" | null;

  suggested_message?: string | null;
};

type Counts = {
  total: number;
  finance: number;
  student: number;
  enrollment: number;
  lesson: number;
  attendance: number;
  staff: number;
  system: number;
  pending: number;
  approved: number;
  rejected: number;
  cancelled: number;
  critical: number;
};

type ApiResponse = {
  ok: boolean;
  error?: string;
  details?: string;
  counts?: Partial<Counts>;
  requests?: ApprovalRequest[];
};

type StatusFilter =
  | "pending"
  | "approved"
  | "rejected"
  | "cancelled"
  | "all";

type CategoryFilter = "all" | Category;

const EMPTY_COUNTS: Counts = {
  total: 0,
  finance: 0,
  student: 0,
  enrollment: 0,
  lesson: 0,
  attendance: 0,
  staff: 0,
  system: 0,
  pending: 0,
  approved: 0,
  rejected: 0,
  cancelled: 0,
  critical: 0,
};

const CATEGORY_OPTIONS: Array<{
  key: CategoryFilter;
  label: string;
  icon: string;
}> = [
  { key: "all", label: "Tümü", icon: "🗂️" },
  { key: "finance", label: "Finans & Kasa", icon: "💳" },
  { key: "student", label: "Öğrenci", icon: "👤" },
  { key: "enrollment", label: "Kayıt / Paket", icon: "📋" },
  { key: "lesson", label: "Ders / Telafi", icon: "🏊" },
  { key: "attendance", label: "Yoklama", icon: "✅" },
  { key: "staff", label: "Personel", icon: "👥" },
  { key: "system", label: "Sistem", icon: "⚙️" },
];

const STATUS_OPTIONS: Array<{
  key: StatusFilter;
  label: string;
}> = [
  { key: "pending", label: "Bekleyen" },
  { key: "approved", label: "Onaylanan" },
  { key: "rejected", label: "Reddedilen" },
  { key: "cancelled", label: "İptal Edilen" },
  { key: "all", label: "Tüm Geçmiş" },
];

function formatDate(value: string | null | undefined) {
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

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";

  if (typeof value === "boolean") {
    return value ? "Evet" : "Hayır";
  }

  if (typeof value === "number") {
    return new Intl.NumberFormat("tr-TR").format(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => formatValue(item)).join(", ");
  }

  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return "—";
    }
  }

  return String(value);
}

function prettifyKey(key: string) {
  const labels: Record<string, string> = {
    payment_due_date: "Ödeme Vadesi",
    start_date: "Kayıt Başlangıç Tarihi",
    amount: "Tutar",
    payment_method: "Ödeme Yöntemi",
    description: "Açıklama",
    payment_status: "Ödeme Durumu",
    cancellation_reason: "İptal Gerekçesi",
    cash_handover_status: "Kasa Teslim Durumu",
    status: "Durum",
    lesson_count: "Ders Sayısı",
    branch_id: "Şube",
    group_id: "Grup",
  };

  return (
    labels[key] ||
    key
      .replaceAll("_", " ")
      .replace(/\b\w/g, (char) => char.toLocaleUpperCase("tr-TR"))
  );
}

function getStudentName(request: ApprovalRequest) {
  const firstName = request.student?.first_name ?? "";
  const lastName = request.student?.last_name ?? "";
  const fullName = `${firstName} ${lastName}`.trim();

  return fullName || "İlgili Kayıt";
}

function getRequestLabel(request: ApprovalRequest) {
  if (request.request_label) return request.request_label;

  const labels: Record<string, string> = {
    payment_due_date_change: "Ödeme Vadesi Değiştirme",
    payment_edit: "Ödeme Düzeltme",
    payment_cancel: "Ödeme İptal / Silme",
    cash_handover_approve: "Kasa Teslim Onayı",
    made_passive: "Pasife Alma",
    deactivate: "Pasife Alma",
    made_active: "Aktife Alma",
    activate: "Aktife Alma",
    individual_compensation: "Bireysel Telafi",
    bulk_compensation: "Toplu Telafi",
    lesson_count_change: "Ders Sayısı Değişikliği",
    compensation_add: "Telafi Ekleme",
    compensation_delete: "Telafi Silme",
    attendance_edit: "Yoklama Düzeltme",
    lesson_right_change: "Ders Hakkı Düzeltme",
    group_change: "Grup Değişikliği",
    branch_change: "Şube Değişikliği",
    enrollment_freeze: "Kayıt Dondurma",
    enrollment_cancel: "Kayıt İptali",
    package_change: "Paket Değişikliği",
    staff_role_change: "Personel Yetki / Rol Değişikliği",
    staff_delete: "Personel Silme / Pasife Alma",
  };

  return labels[request.request_type] || request.request_type || "İşlem Talebi";
}

function categoryLabel(category: Category) {
  return (
    CATEGORY_OPTIONS.find((item) => item.key === category)?.label || "Sistem"
  );
}

function categoryIcon(category: Category) {
  return (
    CATEGORY_OPTIONS.find((item) => item.key === category)?.icon || "⚙️"
  );
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

function statusLabel(status: string) {
  switch (status) {
    case "pending":
      return "Yönetici Onayı Bekliyor";
    case "approved":
      return "Onaylandı";
    case "rejected":
      return "Reddedildi";
    case "cancelled":
      return "İptal Edildi";
    default:
      return status || "Bilinmiyor";
  }
}

function statusClass(status: string) {
  switch (status) {
    case "approved":
      return "statusBadge approved";
    case "rejected":
      return "statusBadge rejected";
    case "cancelled":
      return "statusBadge cancelled";
    default:
      return "statusBadge pending";
  }
}

async function readJsonSafely(response: Response) {
  const text = await response.text();

  if (!text) {
    return {
      ok: false,
      error: `Sunucudan boş yanıt alındı. HTTP ${response.status}`,
    };
  }

  try {
    return JSON.parse(text);
  } catch {
    return {
      ok: false,
      error: "Sunucudan geçersiz yanıt alındı.",
      details: text.slice(0, 500),
    };
  }
}

export default function ApprovalCenterClient() {
  const [requests, setRequests] = useState<ApprovalRequest[]>([]);
  const [counts, setCounts] = useState<Counts>(EMPTY_COUNTS);

  const [statusFilter, setStatusFilter] =
    useState<StatusFilter>("pending");

  const [categoryFilter, setCategoryFilter] =
    useState<CategoryFilter>("all");

  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [criticalOnly, setCriticalOnly] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [processingId, setProcessingId] =
    useState<string | null>(null);

  const [expandedId, setExpandedId] =
    useState<string | null>(null);

  async function loadRequests(nextStatus = statusFilter) {
    setLoading(true);
    setError("");
    setSuccessMessage("");

    try {
      const params = new URLSearchParams();
      params.set("status", nextStatus);

      const response = await fetch(
        `/api/approval-center?${params.toString()}`,
        {
          method: "GET",
          cache: "no-store",
        }
      );

      const data = (await readJsonSafely(response)) as ApiResponse;

      if (!response.ok || !data.ok) {
        throw new Error(
          data.details ||
            data.error ||
            "Onay talepleri alınamadı."
        );
      }

      const loadedRequests = data.requests ?? [];

      setRequests(loadedRequests);

      setCounts({
        ...EMPTY_COUNTS,
        ...(data.counts ?? {}),
      });
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
    void loadRequests(statusFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const visibleRequests = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("tr-TR");

    return requests.filter((request) => {
      if (
        categoryFilter !== "all" &&
        request.category !== categoryFilter
      ) {
        return false;
      }

      if (
        criticalOnly &&
        (request.priority || "").toLowerCase() !== "critical"
      ) {
        return false;
      }

      const requestDate =
        request.requested_at || request.created_at;

      if (dateFrom && requestDate) {
        const requestTime = new Date(requestDate).getTime();
        const fromTime = new Date(`${dateFrom}T00:00:00`).getTime();

        if (requestTime < fromTime) return false;
      }

      if (dateTo && requestDate) {
        const requestTime = new Date(requestDate).getTime();
        const toTime = new Date(`${dateTo}T23:59:59`).getTime();

        if (requestTime > toTime) return false;
      }

      if (!query) return true;

      const studentName = getStudentName(request);

      const haystack = [
        studentName,
        request.id,
        request.request_type,
        request.request_label,
        request.reason,
        request.description,
        request.requested_by_name,
        request.reviewed_by_name,
        request.entity_type,
        request.entity_id,
        request.module,
        request.category,
      ]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("tr-TR");

      return haystack.includes(query);
    });
  }, [
    requests,
    categoryFilter,
    search,
    dateFrom,
    dateTo,
    criticalOnly,
  ]);

  async function processRequest(
    request: ApprovalRequest,
    action: "approve" | "reject"
  ) {
    let reviewNote = "";

    if (action === "reject") {
      const note = window.prompt(
        `${getRequestLabel(
          request
        )} talebini reddetme gerekçesini yazınız:`
      );

      if (note === null) return;

      reviewNote = note.trim();

      if (!reviewNote) {
        window.alert("Reddetme gerekçesi zorunludur.");
        return;
      }
    } else {
      const confirmed = window.confirm(
        `"${getRequestLabel(
          request
        )}" talebini onaylamak istediğinize emin misiniz?\n\nBu işlem ilgili modülde uygulanacaktır.`
      );

      if (!confirmed) return;

      reviewNote =
        window.prompt(
          "İsterseniz yönetici notu ekleyebilirsiniz:",
          ""
        )?.trim() || "";
    }

    setProcessingId(request.id);
    setError("");
    setSuccessMessage("");

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
          review_note: reviewNote || null,
        }),
      });

      const data = await readJsonSafely(response);

      if (!response.ok || !data.ok) {
        throw new Error(
          data.details ||
            data.error ||
            `Talep ${
              action === "approve"
                ? "onaylanamadı"
                : "reddedilemedi"
            }.`
        );
      }

      setSuccessMessage(
        data.message ||
          (action === "approve"
            ? "Talep onaylandı."
            : "Talep reddedildi.")
      );

      await loadRequests(statusFilter);

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
        err instanceof Error
          ? err.message
          : "İşlem sırasında hata oluştu."
      );
    } finally {
      setProcessingId(null);
    }
  }

  function clearFilters() {
    setCategoryFilter("all");
    setSearch("");
    setDateFrom("");
    setDateTo("");
    setCriticalOnly(false);
  }

  return (
    <main className="approvalPage">
      <div className="approvalContainer">
        <header className="approvalHeader">
          <div>
            <p className="eyebrow">SPRİNTOS · MERKEZİ DENETİM</p>

            <h1>Onay Merkezi</h1>

            <span>
              Tüm modüllerden gelen kritik işlemleri tek merkezden
              inceleyin, onaylayın, reddedin ve geçmiş kayıtlarını
              denetleyin.
            </span>
          </div>

          <div className="headerActions">
            <Link href="/">🏠 Ana Sayfa</Link>
            <Link href="/ayarlar/onay-merkezi">
              ⚙️ Onay Ayarları
            </Link>
          </div>
        </header>

        <section className="statusTabs">
          {STATUS_OPTIONS.map((item) => (
            <button
              key={item.key}
              type="button"
              className={
                statusFilter === item.key ? "active" : ""
              }
              onClick={() => setStatusFilter(item.key)}
            >
              {item.label}

              <span>
                {item.key === "pending"
                  ? counts.pending
                  : item.key === "approved"
                  ? counts.approved
                  : item.key === "rejected"
                  ? counts.rejected
                  : item.key === "cancelled"
                  ? counts.cancelled
                  : counts.total}
              </span>
            </button>
          ))}
        </section>

        <section className="summaryGrid">
          {CATEGORY_OPTIONS.map((item) => {
            const count =
              item.key === "all"
                ? counts.total
                : counts[item.key];

            return (
              <button
                key={item.key}
                type="button"
                className={`summaryCard ${
                  categoryFilter === item.key ? "selected" : ""
                }`}
                onClick={() => setCategoryFilter(item.key)}
              >
                <div className="summaryIcon">{item.icon}</div>

                <div>
                  <strong>{count}</strong>
                  <span>{item.label}</span>
                </div>
              </button>
            );
          })}
        </section>

        <section className="filterCard">
          <div className="searchField">
            <span>🔎</span>

            <input
              type="search"
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Öğrenci, talep no, işlem, personel veya açıklama ara..."
            />
          </div>

          <label>
            <span>Başlangıç</span>
            <input
              type="date"
              value={dateFrom}
              onChange={(event) =>
                setDateFrom(event.target.value)
              }
            />
          </label>

          <label>
            <span>Bitiş</span>
            <input
              type="date"
              value={dateTo}
              onChange={(event) =>
                setDateTo(event.target.value)
              }
            />
          </label>

          <label className="criticalToggle">
            <input
              type="checkbox"
              checked={criticalOnly}
              onChange={(event) =>
                setCriticalOnly(event.target.checked)
              }
            />
            <span>Yalnız kritik</span>
          </label>

          <button
            type="button"
            className="secondaryButton"
            onClick={clearFilters}
          >
            Filtreleri Temizle
          </button>

          <button
            type="button"
            className="refreshButton"
            disabled={loading}
            onClick={() => void loadRequests(statusFilter)}
          >
            {loading ? "Yükleniyor..." : "↻ Yenile"}
          </button>
        </section>

        <section className="resultBar">
          <div>
            <strong>{visibleRequests.length}</strong> kayıt gösteriliyor
          </div>

          {counts.critical > 0 ? (
            <div className="criticalCount">
              ⚠️ {counts.critical} kritik işlem
            </div>
          ) : null}
        </section>

        {error ? (
          <div className="alert error">{error}</div>
        ) : null}

        {successMessage ? (
          <div className="alert success">{successMessage}</div>
        ) : null}

        {loading ? (
          <div className="emptyCard">
            <strong>Onay talepleri yükleniyor...</strong>
          </div>
        ) : visibleRequests.length === 0 ? (
          <div className="emptyCard">
            <strong>Kayıt bulunmuyor</strong>
            <p>
              Seçili durum ve filtrelere uygun onay talebi bulunamadı.
            </p>
          </div>
        ) : (
          <div className="requestList">
            {visibleRequests.map((request) => {
              const isProcessing =
                processingId === request.id;

              const expanded =
                expandedId === request.id;

              const oldValues =
                request.old_values || {};

              const newValues =
                request.new_values || {};

              const diffKeys = Array.from(
                new Set([
                  ...Object.keys(oldValues),
                  ...Object.keys(newValues),
                ])
              );

              return (
                <article
                  className={`requestCard ${
                    request.priority === "critical"
                      ? "critical"
                      : ""
                  }`}
                  key={`${request.source}-${request.id}`}
                >
                  <div className="requestTop">
                    <div className="requestIdentity">
                      <div className="moduleBadge">
                        <span>
                          {categoryIcon(request.category)}
                        </span>

                        {categoryLabel(request.category)}
                      </div>

                      <h2>{getRequestLabel(request)}</h2>

                      <div className="subject">
                        {getStudentName(request)}
                      </div>

                      <div className="requestMeta">
                        Talep tarihi:{" "}
                        {formatDate(
                          request.requested_at ??
                            request.created_at
                        )}

                        {request.requested_by_name ? (
                          <>
                            {" · "}Talep eden:{" "}
                            <strong>
                              {request.requested_by_name}
                            </strong>
                          </>
                        ) : null}
                      </div>
                    </div>

                    <div className="requestStatusArea">
                      {request.priority === "critical" ? (
                        <span className="criticalBadge">
                          ⚠ Kritik
                        </span>
                      ) : null}

                      <span className={statusClass(request.status)}>
                        {statusLabel(request.status)}
                      </span>
                    </div>
                  </div>

                  <div className="quickInfoGrid">
                    <Info
                      label="Gerekçe"
                      value={request.reason || "—"}
                    />

                    <Info
                      label="Kaynak"
                      value={
                        request.source === "approval_request"
                          ? "Merkezi Onay Sistemi"
                          : request.source === "student_status"
                          ? "Öğrenci İşlemleri"
                          : "Ders / Telafi"
                      }
                    />

                    <Info
                      label="İşlem Türü"
                      value={request.request_type || "—"}
                    />

                    {request.lesson_count != null ? (
                      <Info
                        label="Ders Sayısı"
                        value={`${request.lesson_count} ders`}
                      />
                    ) : null}

                    {request.recipient_phone ? (
                      <Info
                        label={`${getPhoneLabel(
                          request.recipient_type
                        )} Telefonu`}
                        value={request.recipient_phone}
                      />
                    ) : null}

                    {request.reviewed_by_name ? (
                      <Info
                        label="Karar Veren"
                        value={request.reviewed_by_name}
                      />
                    ) : null}

                    {request.reviewed_at ? (
                      <Info
                        label="Karar Tarihi"
                        value={formatDate(request.reviewed_at)}
                      />
                    ) : null}
                  </div>

                  {diffKeys.length > 0 ? (
                    <div className="diffSection">
                      <div className="sectionTitle">
                        Eski Değer → Talep Edilen Yeni Değer
                      </div>

                      <div className="diffGrid">
                        {diffKeys.map((key) => (
                          <div className="diffRow" key={key}>
                            <div className="diffLabel">
                              {prettifyKey(key)}
                            </div>

                            <div className="oldValue">
                              <span>Eski</span>
                              <strong>
                                {formatValue(oldValues[key])}
                              </strong>
                            </div>

                            <div className="arrow">→</div>

                            <div className="newValue">
                              <span>Yeni</span>
                              <strong>
                                {formatValue(newValues[key])}
                              </strong>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : request.category === "student" ? (
                    <div className="diffSection">
                      <div className="diffGrid">
                        <div className="diffRow">
                          <div className="diffLabel">Durum</div>

                          <div className="oldValue">
                            <span>Eski</span>
                            <strong>
                              {request.old_status || "—"}
                            </strong>
                          </div>

                          <div className="arrow">→</div>

                          <div className="newValue">
                            <span>Yeni</span>
                            <strong>
                              {request.requested_status ||
                                request.new_status ||
                                "—"}
                            </strong>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {expanded ? (
                    <div className="detailPanel">
                      {request.description ? (
                        <DetailBlock
                          title="Açıklama / Not"
                          value={request.description}
                        />
                      ) : null}

                      {request.review_note ? (
                        <DetailBlock
                          title="Yönetici Notu"
                          value={request.review_note}
                        />
                      ) : null}

                      {request.entity_type ||
                      request.entity_id ? (
                        <DetailBlock
                          title="Bağlı Kayıt"
                          value={`${request.entity_type || "kayıt"} · ${
                            request.entity_id || "—"
                          }`}
                        />
                      ) : null}

                      {request.suggested_message ? (
                        <DetailBlock
                          title="Onay Sonrası WhatsApp Mesajı"
                          value={request.suggested_message}
                          multiline
                        />
                      ) : null}

                      <DetailBlock
                        title="Talep Numarası"
                        value={request.id}
                      />

                      {request.applied_at ? (
                        <DetailBlock
                          title="Uygulanma Tarihi"
                          value={formatDate(request.applied_at)}
                        />
                      ) : null}
                    </div>
                  ) : null}

                  <div className="requestFooter">
                    <button
                      type="button"
                      className="detailButton"
                      onClick={() =>
                        setExpandedId(
                          expanded ? null : request.id
                        )
                      }
                    >
                      {expanded ? "Detayı Kapat" : "Detay"}
                    </button>

                    <div className="requestActions">
                      {request.status === "pending" ? (
                        <>
                          <button
                            type="button"
                            className="rejectButton"
                            disabled={isProcessing}
                            onClick={() =>
                              void processRequest(
                                request,
                                "reject"
                              )
                            }
                          >
                            Reddet
                          </button>

                          <button
                            type="button"
                            className="approveButton"
                            disabled={isProcessing}
                            onClick={() =>
                              void processRequest(
                                request,
                                "approve"
                              )
                            }
                          >
                            {isProcessing
                              ? "İşleniyor..."
                              : "Onayla"}
                          </button>
                        </>
                      ) : (
                        <span className="historyNote">
                          Bu kayıt işlem geçmişinde saklanıyor.
                        </span>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      <style jsx>{`
        .approvalPage {
          min-height: 100vh;
          background: #f4f7fb;
          padding: 30px 22px 70px;
          font-family: Arial, sans-serif;
        }

        .approvalContainer {
          width: min(1380px, 100%);
          margin: 0 auto;
        }

        .approvalHeader {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 24px;
          margin-bottom: 20px;
        }

        .eyebrow {
          margin: 0 0 7px;
          color: #1769e0;
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 0.1em;
        }

        .approvalHeader h1 {
          margin: 0;
          color: #14213d;
          font-size: 31px;
        }

        .approvalHeader > div > span {
          display: block;
          margin-top: 8px;
          max-width: 820px;
          color: #667085;
          line-height: 1.55;
        }

        .headerActions {
          display: flex;
          gap: 9px;
          flex-wrap: wrap;
        }

        .headerActions a {
          text-decoration: none;
          color: #14213d;
          background: #fff;
          border: 1px solid #d9e2ec;
          border-radius: 11px;
          padding: 10px 13px;
          font-size: 12px;
          font-weight: 800;
          white-space: nowrap;
        }

        .statusTabs {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-bottom: 13px;
        }

        .statusTabs button {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          border: 1px solid #dbe5f1;
          background: #fff;
          color: #475467;
          border-radius: 999px;
          padding: 8px 13px;
          font-weight: 800;
          cursor: pointer;
        }

        .statusTabs button span {
          display: inline-grid;
          place-items: center;
          min-width: 23px;
          height: 23px;
          padding: 0 5px;
          border-radius: 999px;
          background: #f1f5f9;
          color: #344054;
          font-size: 11px;
        }

        .statusTabs button.active {
          color: #155eef;
          border-color: #84adff;
          background: #eff6ff;
        }

        .summaryGrid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 10px;
          margin-bottom: 13px;
        }

        .summaryCard {
          display: flex;
          gap: 11px;
          align-items: center;
          border: 1px solid #dbe5f1;
          background: #fff;
          border-radius: 15px;
          padding: 14px;
          cursor: pointer;
          text-align: left;
        }

        .summaryCard.selected {
          border-color: #84adff;
          box-shadow: 0 0 0 2px #dbeafe inset;
          background: #f8fbff;
        }

        .summaryIcon {
          display: grid;
          place-items: center;
          width: 38px;
          height: 38px;
          border-radius: 11px;
          background: #f1f5f9;
          font-size: 18px;
        }

        .summaryCard strong {
          display: block;
          color: #14213d;
          font-size: 21px;
          line-height: 1;
        }

        .summaryCard span {
          display: block;
          margin-top: 4px;
          color: #667085;
          font-size: 11px;
          font-weight: 700;
        }

        .filterCard {
          display: grid;
          grid-template-columns:
            minmax(260px, 1fr)
            160px
            160px
            auto
            auto
            auto;
          gap: 9px;
          align-items: end;
          background: #fff;
          border: 1px solid #dbe5f1;
          border-radius: 16px;
          padding: 13px;
          margin-bottom: 12px;
        }

        .searchField {
          display: flex;
          align-items: center;
          gap: 8px;
          border: 1px solid #dbe5f1;
          border-radius: 10px;
          padding: 0 11px;
        }

        .searchField input {
          width: 100%;
          border: 0;
          outline: 0;
          min-height: 40px;
          font: inherit;
          color: #14213d;
        }

        .filterCard label > span {
          display: block;
          margin-bottom: 5px;
          color: #667085;
          font-size: 10px;
          font-weight: 800;
        }

        .filterCard input[type="date"] {
          width: 100%;
          box-sizing: border-box;
          min-height: 40px;
          border: 1px solid #dbe5f1;
          border-radius: 10px;
          padding: 0 9px;
        }

        .criticalToggle {
          display: flex;
          align-items: center;
          gap: 7px;
          min-height: 40px;
          padding: 0 11px;
          border: 1px solid #fed7aa;
          background: #fff7ed;
          border-radius: 10px;
        }

        .criticalToggle span {
          margin: 0 !important;
          color: #c2410c !important;
          white-space: nowrap;
        }

        .secondaryButton,
        .refreshButton {
          min-height: 40px;
          border-radius: 10px;
          padding: 0 12px;
          font-weight: 800;
          cursor: pointer;
          white-space: nowrap;
        }

        .secondaryButton {
          border: 1px solid #dbe5f1;
          background: #fff;
          color: #344054;
        }

        .refreshButton {
          border: 1px solid #1769e0;
          background: #1769e0;
          color: #fff;
        }

        .resultBar {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          align-items: center;
          margin: 12px 1px;
          color: #667085;
          font-size: 12px;
        }

        .resultBar strong {
          color: #14213d;
        }

        .criticalCount {
          color: #c2410c;
          font-weight: 800;
        }

        .alert {
          border-radius: 12px;
          padding: 13px 15px;
          margin-bottom: 14px;
          font-weight: 700;
        }

        .alert.error {
          color: #b42318;
          background: #fff1f2;
          border: 1px solid #fecaca;
        }

        .alert.success {
          color: #047857;
          background: #ecfdf3;
          border: 1px solid #bbf7d0;
        }

        .emptyCard {
          background: #fff;
          border: 1px solid #dbe5f1;
          border-radius: 16px;
          padding: 50px 22px;
          text-align: center;
        }

        .emptyCard strong {
          color: #14213d;
          font-size: 20px;
        }

        .emptyCard p {
          color: #667085;
          margin-bottom: 0;
        }

        .requestList {
          display: grid;
          gap: 13px;
        }

        .requestCard {
          background: #fff;
          border: 1px solid #dbe5f1;
          border-radius: 17px;
          padding: 19px;
          box-shadow: 0 4px 14px rgba(16, 24, 40, 0.035);
        }

        .requestCard.critical {
          border-color: #fdba74;
          box-shadow: 0 0 0 2px #ffedd5 inset;
        }

        .requestTop {
          display: flex;
          justify-content: space-between;
          gap: 18px;
          align-items: flex-start;
        }

        .moduleBadge {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          color: #1769e0;
          font-size: 10px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .requestIdentity h2 {
          margin: 7px 0 0;
          color: #14213d;
          font-size: 19px;
        }

        .subject {
          margin-top: 5px;
          color: #344054;
          font-size: 14px;
          font-weight: 800;
        }

        .requestMeta {
          margin-top: 5px;
          color: #667085;
          font-size: 11px;
        }

        .requestStatusArea {
          display: flex;
          gap: 7px;
          align-items: center;
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        .statusBadge,
        .criticalBadge {
          border-radius: 999px;
          padding: 7px 10px;
          font-size: 10px;
          font-weight: 900;
          white-space: nowrap;
        }

        .statusBadge.pending {
          color: #a15c00;
          background: #fff7e8;
          border: 1px solid #ffd89a;
        }

        .statusBadge.approved {
          color: #047857;
          background: #ecfdf3;
          border: 1px solid #bbf7d0;
        }

        .statusBadge.rejected {
          color: #b42318;
          background: #fff1f2;
          border: 1px solid #fecaca;
        }

        .statusBadge.cancelled {
          color: #475467;
          background: #f2f4f7;
          border: 1px solid #d0d5dd;
        }

        .criticalBadge {
          color: #c2410c;
          background: #fff7ed;
          border: 1px solid #fdba74;
        }

        .quickInfoGrid {
          display: grid;
          grid-template-columns: repeat(
            auto-fit,
            minmax(180px, 1fr)
          );
          gap: 10px;
          margin-top: 17px;
          padding-top: 15px;
          border-top: 1px solid #edf2f7;
        }

        .diffSection {
          margin-top: 15px;
          border: 1px solid #dbe5f1;
          border-radius: 13px;
          overflow: hidden;
        }

        .sectionTitle {
          padding: 10px 12px;
          background: #f8fafc;
          color: #475467;
          font-size: 10px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          border-bottom: 1px solid #e5e7eb;
        }

        .diffGrid {
          display: grid;
        }

        .diffRow {
          display: grid;
          grid-template-columns:
            minmax(140px, 0.8fr)
            minmax(180px, 1fr)
            34px
            minmax(180px, 1fr);
          align-items: stretch;
          border-bottom: 1px solid #eef2f6;
        }

        .diffRow:last-child {
          border-bottom: 0;
        }

        .diffLabel,
        .oldValue,
        .newValue,
        .arrow {
          padding: 11px 12px;
        }

        .diffLabel {
          background: #fbfcfe;
          color: #344054;
          font-size: 11px;
          font-weight: 900;
        }

        .oldValue span,
        .newValue span {
          display: block;
          color: #98a2b3;
          font-size: 9px;
          font-weight: 900;
          text-transform: uppercase;
          margin-bottom: 3px;
        }

        .oldValue strong,
        .newValue strong {
          color: #14213d;
          font-size: 12px;
          word-break: break-word;
        }

        .newValue {
          background: #f0fdf4;
        }

        .arrow {
          display: grid;
          place-items: center;
          color: #98a2b3;
          font-weight: 900;
        }

        .detailPanel {
          display: grid;
          grid-template-columns: repeat(
            auto-fit,
            minmax(240px, 1fr)
          );
          gap: 10px;
          margin-top: 15px;
          padding: 13px;
          border-radius: 13px;
          background: #f8fafc;
          border: 1px solid #e5e7eb;
        }

        .requestFooter {
          display: flex;
          justify-content: space-between;
          gap: 14px;
          align-items: center;
          margin-top: 16px;
          padding-top: 14px;
          border-top: 1px solid #edf2f7;
        }

        .detailButton,
        .rejectButton,
        .approveButton {
          border-radius: 9px;
          padding: 9px 14px;
          font-weight: 800;
          cursor: pointer;
        }

        .detailButton {
          color: #344054;
          background: #fff;
          border: 1px solid #d0d5dd;
        }

        .requestActions {
          display: flex;
          gap: 8px;
          align-items: center;
          flex-wrap: wrap;
        }

        .rejectButton {
          color: #b42318;
          background: #fff;
          border: 1px solid #fda29b;
        }

        .approveButton {
          color: #fff;
          background: #1769e0;
          border: 1px solid #1769e0;
        }

        .rejectButton:disabled,
        .approveButton:disabled {
          opacity: 0.55;
          cursor: wait;
        }

        .historyNote {
          color: #667085;
          font-size: 11px;
          font-weight: 700;
        }

        @media (max-width: 1100px) {
          .summaryGrid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .filterCard {
            grid-template-columns: 1fr 1fr;
          }

          .searchField {
            grid-column: 1 / -1;
          }
        }

        @media (max-width: 720px) {
          .approvalPage {
            padding: 20px 12px 60px;
          }

          .approvalHeader,
          .requestTop,
          .requestFooter {
            flex-direction: column;
          }

          .headerActions,
          .requestActions {
            width: 100%;
          }

          .summaryGrid {
            grid-template-columns: 1fr;
          }

          .filterCard {
            grid-template-columns: 1fr;
          }

          .diffRow {
            grid-template-columns: 1fr;
          }

          .arrow {
            display: none;
          }
        }
      `}</style>
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
          fontSize: "10px",
          marginBottom: "3px",
          fontWeight: 800,
        }}
      >
        {label}
      </div>

      <strong
        style={{
          color: "#14213d",
          wordBreak: "break-word",
          fontSize: "12px",
        }}
      >
        {value}
      </strong>
    </div>
  );
}

function DetailBlock({
  title,
  value,
  multiline = false,
}: {
  title: string;
  value: string;
  multiline?: boolean;
}) {
  return (
    <div>
      <div
        style={{
          color: "#667085",
          fontSize: "10px",
          fontWeight: 900,
          marginBottom: "5px",
          textTransform: "uppercase",
        }}
      >
        {title}
      </div>

      <div
        style={{
          color: "#14213d",
          fontSize: "12px",
          lineHeight: 1.55,
          whiteSpace: multiline ? "pre-wrap" : "normal",
          wordBreak: "break-word",
        }}
      >
        {value}
      </div>
    </div>
  );
}
