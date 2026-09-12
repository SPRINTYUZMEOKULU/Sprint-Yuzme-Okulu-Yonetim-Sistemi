"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

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

type Category = "finance" | "student" | "enrollment" | "lesson" | "attendance" | "staff" | "system";
type StatusFilter = "pending" | "approved" | "rejected" | "cancelled" | "all";
type CategoryFilter = "all" | Category;

type ApprovalRequest = {
  id: string;
  source: "approval_request" | "student_status" | "lesson_adjustment";
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

type ApiResponse = {
  ok: boolean;
  error?: string;
  details?: string;
  requests?: ApprovalRequest[];
  message?: string;
};

const CATEGORY_OPTIONS: Array<{ key: CategoryFilter; label: string; icon: string }> = [
  { key: "all", label: "Tümü", icon: "▦" },
  { key: "finance", label: "Finans & Kasa", icon: "₺" },
  { key: "student", label: "Öğrenci", icon: "●" },
  { key: "enrollment", label: "Kayıt / Paket", icon: "▤" },
  { key: "lesson", label: "Ders / Telafi", icon: "≈" },
  { key: "attendance", label: "Yoklama", icon: "✓" },
  { key: "staff", label: "Personel", icon: "◆" },
  { key: "system", label: "Sistem", icon: "⚙" },
];

const STATUS_OPTIONS: Array<{ key: StatusFilter; label: string }> = [
  { key: "pending", label: "Bekleyen" },
  { key: "approved", label: "Onaylanan" },
  { key: "rejected", label: "Reddedilen" },
  { key: "cancelled", label: "İptal Edilen" },
  { key: "all", label: "Tüm Geçmiş" },
];

function formatDate(value?: string | null) {
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
  if (typeof value === "boolean") return value ? "Evet" : "Hayır";
  if (typeof value === "number") return new Intl.NumberFormat("tr-TR").format(value);
  if (Array.isArray(value)) return value.map(formatValue).join(", ");
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return "—";
    }
  }
  return String(value);
}

function getStudentName(request: ApprovalRequest) {
  const full = `${request.student?.first_name ?? ""} ${request.student?.last_name ?? ""}`.trim();
  return full || "İlgili Kayıt";
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
    attendance_history_import: "Geçmiş Yoklama Aktarımı",
    lesson_right_change: "Ders Hakkı Düzeltme",
    group_change: "Grup Değişikliği",
    branch_change: "Şube Değişikliği",
    enrollment_freeze: "Kayıt Dondurma",
    enrollment_cancel: "Kayıt İptali",
    package_change: "Paket Değişikliği",
    staff_role_change: "Personel Yetki / Rol Değişikliği",
    staff_delete: "Personel Silme / Pasife Alma",
    registration_custom_lesson_count: "Kesin Kayıt · Standart Dışı Ders Sayısı",
  };
  return labels[request.request_type] || request.request_type || "İşlem Talebi";
}

function categoryLabel(category: Category) {
  return CATEGORY_OPTIONS.find((item) => item.key === category)?.label || "Sistem";
}

function categoryIcon(category: Category) {
  return CATEGORY_OPTIONS.find((item) => item.key === category)?.icon || "⚙";
}

function statusLabel(status: string) {
  if (status === "pending") return "Yönetici Onayı Bekliyor";
  if (status === "approved") return "Onaylandı";
  if (status === "rejected") return "Reddedildi";
  if (status === "cancelled") return "İptal Edildi";
  return status || "Bilinmiyor";
}

function statusClass(status: string) {
  return `statusBadge ${status === "approved" ? "approved" : status === "rejected" ? "rejected" : status === "cancelled" ? "cancelled" : "pending"}`;
}

function cleanPhone(phone: string) {
  return phone.replace(/\D/g, "");
}

function createWhatsAppUrl(phone: string, message: string) {
  let cleaned = cleanPhone(phone);
  if (cleaned.startsWith("0")) cleaned = `90${cleaned.slice(1)}`;
  else if (cleaned.length === 10) cleaned = `90${cleaned}`;
  return `https://wa.me/${cleaned}?text=${encodeURIComponent(message)}`;
}

async function readJsonSafely(response: Response) {
  const text = await response.text();
  if (!text) return { ok: false, error: `Sunucudan boş yanıt alındı. HTTP ${response.status}` };
  try {
    return JSON.parse(text);
  } catch {
    return { ok: false, error: "Sunucudan geçersiz yanıt alındı.", details: text.slice(0, 500) };
  }
}

export default function ApprovalCenterClientV2() {
  const [allRequests, setAllRequests] = useState<ApprovalRequest[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("pending");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [criticalOnly, setCriticalOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  async function loadRequests() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/approval-center?status=all", { method: "GET", cache: "no-store" });
      const data = (await readJsonSafely(response)) as ApiResponse;
      if (!response.ok || !data.ok) throw new Error(data.details || data.error || "Onay talepleri alınamadı.");
      setAllRequests(data.requests ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Onay talepleri yüklenirken hata oluştu.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadRequests();
  }, []);

  const globalCounts = useMemo(() => ({
    total: allRequests.length,
    pending: allRequests.filter((item) => item.status === "pending").length,
    approved: allRequests.filter((item) => item.status === "approved").length,
    rejected: allRequests.filter((item) => item.status === "rejected").length,
    cancelled: allRequests.filter((item) => item.status === "cancelled").length,
  }), [allRequests]);

  const statusRequests = useMemo(() => {
    if (statusFilter === "all") return allRequests;
    return allRequests.filter((item) => item.status === statusFilter);
  }, [allRequests, statusFilter]);

  const categoryCounts = useMemo(() => ({
    all: statusRequests.length,
    finance: statusRequests.filter((item) => item.category === "finance").length,
    student: statusRequests.filter((item) => item.category === "student").length,
    enrollment: statusRequests.filter((item) => item.category === "enrollment").length,
    lesson: statusRequests.filter((item) => item.category === "lesson").length,
    attendance: statusRequests.filter((item) => item.category === "attendance").length,
    staff: statusRequests.filter((item) => item.category === "staff").length,
    system: statusRequests.filter((item) => item.category === "system").length,
    critical: statusRequests.filter((item) => (item.priority ?? "").toLowerCase() === "critical").length,
  }), [statusRequests]);

  const visibleRequests = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("tr-TR");
    return statusRequests.filter((request) => {
      if (categoryFilter !== "all" && request.category !== categoryFilter) return false;
      if (criticalOnly && (request.priority || "").toLowerCase() !== "critical") return false;
      const date = request.requested_at || request.created_at;
      if (dateFrom && date && new Date(date).getTime() < new Date(`${dateFrom}T00:00:00`).getTime()) return false;
      if (dateTo && date && new Date(date).getTime() > new Date(`${dateTo}T23:59:59`).getTime()) return false;
      if (!query) return true;
      return [
        getStudentName(request), request.id, request.request_type, request.request_label,
        request.reason, request.description, request.requested_by_name, request.reviewed_by_name,
        request.entity_type, request.entity_id, request.module, request.category,
      ].filter(Boolean).join(" ").toLocaleLowerCase("tr-TR").includes(query);
    });
  }, [statusRequests, categoryFilter, criticalOnly, dateFrom, dateTo, search]);

  async function processRequest(request: ApprovalRequest, action: "approve" | "reject") {
    let reviewNote = "";
    if (action === "reject") {
      const note = window.prompt(`${getRequestLabel(request)} talebini reddetme gerekçesini yazınız:`);
      if (note === null) return;
      reviewNote = note.trim();
      if (!reviewNote) {
        window.alert("Reddetme gerekçesi zorunludur.");
        return;
      }
    } else {
      const confirmed = window.confirm(`"${getRequestLabel(request)}" talebini onaylamak istediğinize emin misiniz?\n\nBu işlem ilgili modülde uygulanacaktır.`);
      if (!confirmed) return;
      reviewNote = window.prompt("İsterseniz yönetici notu ekleyebilirsiniz:", "")?.trim() || "";
    }

    setProcessingId(request.id);
    setError("");
    setSuccessMessage("");

    try {
      const isHistory = request.request_type === "attendance_history_import";
      const response = await fetch(isHistory ? "/api/attendance-history-import" : "/api/approval-center", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isHistory
          ? { action, requestId: request.id, reviewNote: reviewNote || null }
          : { id: request.id, source: request.source, action, review_note: reviewNote || null }),
      });
      const data = await readJsonSafely(response) as ApiResponse;
      if (!response.ok || !data.ok) throw new Error(data.details || data.error || "İşlem tamamlanamadı.");
      setSuccessMessage(data.message || (action === "approve" ? "Talep onaylandı." : "Talep reddedildi."));
      await loadRequests();
      if (action === "approve" && request.recipient_phone && request.suggested_message) {
        const send = window.confirm("Talep onaylandı.\n\nKursiyere / veliye WhatsApp bilgilendirme mesajı göndermek ister misiniz?");
        if (send) window.open(createWhatsAppUrl(request.recipient_phone, request.suggested_message), "_blank", "noopener,noreferrer");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "İşlem sırasında hata oluştu.");
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
            <span>Tüm modüllerden gelen kritik işlemleri tek merkezden inceleyin, onaylayın, reddedin ve geçmiş kayıtlarını denetleyin.</span>
          </div>
          <div className="headerActions">
            <Link href="/">⌂ Ana Sayfa</Link>
            <Link href="/ayarlar/onay-merkezi">⚙ Onay Ayarları</Link>
          </div>
        </header>

        <section className="statusTabs">
          {STATUS_OPTIONS.map((item) => {
            const count = item.key === "pending" ? globalCounts.pending
              : item.key === "approved" ? globalCounts.approved
              : item.key === "rejected" ? globalCounts.rejected
              : item.key === "cancelled" ? globalCounts.cancelled
              : globalCounts.total;
            return <button key={item.key} type="button" className={statusFilter === item.key ? "active" : ""} onClick={() => { setStatusFilter(item.key); setCategoryFilter("all"); }}>{item.label}<span>{count}</span></button>;
          })}
        </section>

        <section className="summaryGrid">
          {CATEGORY_OPTIONS.map((item) => {
            const count = categoryCounts[item.key];
            return <button key={item.key} type="button" className={`summaryCard ${categoryFilter === item.key ? "selected" : ""}`} onClick={() => setCategoryFilter(item.key)}><div className="summaryIcon">{item.icon}</div><div><strong>{count}</strong><span>{item.label}</span></div></button>;
          })}
        </section>

        <section className="filterCard">
          <div className="searchField"><span>⌕</span><input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Öğrenci, talep no, işlem, personel veya açıklama ara..." /></div>
          <label><span>Başlangıç</span><input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} /></label>
          <label><span>Bitiş</span><input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} /></label>
          <label className="criticalToggle"><input type="checkbox" checked={criticalOnly} onChange={(e) => setCriticalOnly(e.target.checked)} /><span>Yalnız kritik</span></label>
          <button type="button" className="secondaryButton" onClick={clearFilters}>Filtreleri Temizle</button>
          <button type="button" className="refreshButton" disabled={loading} onClick={() => void loadRequests()}>{loading ? "Yükleniyor..." : "↻ Yenile"}</button>
        </section>

        <section className="resultBar">
          <div><strong>{visibleRequests.length}</strong> kayıt gösteriliyor</div>
          {categoryCounts.critical > 0 ? <div className="criticalCount">⚠ {categoryCounts.critical} kritik işlem</div> : null}
        </section>

        {error ? <div className="alert error">{error}</div> : null}
        {successMessage ? <div className="alert success">{successMessage}</div> : null}

        {loading ? (
          <div className="emptyCard"><strong>Onay talepleri yükleniyor...</strong></div>
        ) : visibleRequests.length === 0 ? (
          <div className="emptyCard"><strong>Kayıt bulunmuyor</strong><p>Seçili durum ve filtrelere uygun onay talebi bulunamadı.</p></div>
        ) : (
          <div className="requestList">
            {visibleRequests.map((request) => {
              const expanded = expandedId === request.id;
              const isProcessing = processingId === request.id;
              const oldValues = request.old_values || {};
              const newValues = request.new_values || {};
              const diffKeys = Array.from(new Set([...Object.keys(oldValues), ...Object.keys(newValues)]));
              return (
                <article className={`requestCard ${request.priority === "critical" ? "critical" : ""}`} key={`${request.source}-${request.id}`}>
                  <div className="requestTop">
                    <div className="requestIdentity">
                      <div className="moduleBadge"><span>{categoryIcon(request.category)}</span>{categoryLabel(request.category)}</div>
                      <h2>{getRequestLabel(request)}</h2>
                      <div className="subject">{getStudentName(request)}</div>
                    </div>
                    <div className={statusClass(request.status)}>{statusLabel(request.status)}</div>
                  </div>

                  <div className="requestMeta">
                    <span>Talep: {formatDate(request.requested_at || request.created_at)}</span>
                    {request.requested_by_name ? <span>İsteyen: {request.requested_by_name}</span> : null}
                    {request.reviewed_by_name ? <span>İşleyen: {request.reviewed_by_name}</span> : null}
                  </div>

                  {request.reason || request.description ? <div className="requestReason">{request.reason || request.description}</div> : null}

                  {expanded ? (
                    <div className="requestDetails">
                      {diffKeys.length > 0 ? diffKeys.map((key) => <div className="diffRow" key={key}><span>{key.replaceAll("_", " ")}</span><div><small>Önce</small><strong>{formatValue(oldValues[key])}</strong></div><div><small>Sonra</small><strong>{formatValue(newValues[key])}</strong></div></div>) : <p>Bu işlem için ek alan değişikliği bulunmuyor.</p>}
                    </div>
                  ) : null}

                  <div className="requestActions">
                    <button type="button" className="secondaryButton" onClick={() => setExpandedId(expanded ? null : request.id)}>{expanded ? "Detayı Kapat" : "Detayı Gör"}</button>
                    {request.status === "pending" ? <>
                      <button type="button" className="rejectButton" disabled={isProcessing} onClick={() => void processRequest(request, "reject")}>{isProcessing ? "İşleniyor..." : "Reddet"}</button>
                      <button type="button" className="approveButton" disabled={isProcessing} onClick={() => void processRequest(request, "approve")}>{isProcessing ? "İşleniyor..." : "Onayla"}</button>
                    </> : null}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
