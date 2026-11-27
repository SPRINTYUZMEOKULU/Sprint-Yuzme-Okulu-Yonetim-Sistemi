"use client";
import { formatDisplayDate } from "@/lib/dates/display";


import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { UserRole } from "@/lib/auth/profile";

type Checkin = {
  id: string;
  checked_in_at: string;
  distance_m: number | null;
  location_verified: boolean;
  attendance_status: string;
  approval_status: string;
  manager_note?: string | null;
  completed_at: string | null;
};

type TodayRow = {
  scheduleId: string;
  staffId: string;
  staffName: string;
  title: string;
  assignmentRole: "coach" | "backup";
  branchId: string;
  branchName: string;
  branchLocationConfigured: boolean;
  groupId: string | null;
  groupName: string;
  startTime: string;
  endTime: string;
  attendanceState?: "pending" | "partial" | "saved" | "empty" | "unavailable";
  checkin: Checkin | null;
  isMine: boolean;
};

type PayrollRow = {
  staffId: string;
  staffName: string;
  payType: string;
  lessonCount: number;
  totalMinutes: number;
  estimatedAmount: number;
  paidAmount: number;
  paymentStatus: string | null;
};

type DashboardData = {
  role: UserRole;
  isManager: boolean;
  currentStaffId: string | null;
  date: string;
  currentDate: string;
  today: TodayRow[];
  unassigned?: Array<{ id: string; branchId: string; groupName: string; branchName: string; startTime: string }>;
  payroll: PayrollRow[];
  lessons: Array<{
    id: string;
    lesson_date: string;
    planned_start: string;
    planned_end: string;
    duration: number;
    amount: number | null;
    training_groups: { name: string } | null;
    branches: { name: string } | null;
  }>;
  summary: {
    planned: number;
    checkedIn: number;
    pending: number;
    missing: number;
  };
};

const attendanceLabels = {
  pending: "Yoklama bekleniyor",
  partial: "Yoklama eksik",
  saved: "Yoklama kaydedildi",
  empty: "Yoklama bekleyen öğrenci yok",
  unavailable: "Yoklama durumu alınamadı",
};

function shiftDay(value: string, days: number) {
  const day = new Date(`${value}T12:00:00Z`);
  day.setUTCDate(day.getUTCDate() + days);
  return day.toISOString().slice(0, 10);
}

function paymentStatus(row: PayrollRow) {
  if (row.paymentStatus === "paid" || (row.paymentStatus === "archived" && row.paidAmount > 0)) return `Ödendi · ${money(row.paidAmount)}`;
  return row.paymentStatus === "awaiting_payment" ? "Ödeme bekliyor" : "Dönem açık";
}

const payTypeLabels: Record<string, string> = {
  per_lesson: "Ders başı",
  hourly: "Saatlik",
  monthly: "Aylık sabit",
  monthly_plus_lesson: "Sabit + ek ders",
};

function money(value: number) {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 2,
  }).format(value || 0);
}

function timeOf(value: string) {
  try {
    return new Intl.DateTimeFormat("tr-TR", {
      timeZone: "Europe/Istanbul",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return "—";
  }
}

function istanbulMinutesNow() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Istanbul",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const hour = Number(parts.find((part) => part.type === "hour")?.value || 0);
  const minute = Number(parts.find((part) => part.type === "minute")?.value || 0);
  return hour * 60 + minute;
}

function minutes(value: string) {
  const [hour, minute] = String(value || "00:00").slice(0, 5).split(":").map(Number);
  return (hour || 0) * 60 + (minute || 0);
}

function statusMeta(checkin: Checkin | null) {
  if (!checkin) return { label: "Giriş bekleniyor", tone: "waiting" };
  if (checkin.approval_status === "pending") return { label: "Yönetici onayı", tone: "pending" };
  if (checkin.approval_status === "rejected") return { label: "Reddedildi", tone: "danger" };
  if (checkin.completed_at) return { label: "Ders tamamlandı", tone: "success" };
  if (checkin.attendance_status === "late") return { label: "Geç giriş", tone: "late" };
  return { label: "Geldi", tone: "success" };
}

export default function PersonelPuantajClient({ currentRole, coachHome = false, previewStaffId, initialDate = "" }: { currentRole: UserRole; coachHome?: boolean; previewStaffId?: string; initialDate?: string }) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [date, setDate] = useState(initialDate);
  const [payrollMonth, setPayrollMonth] = useState("");
  const [loadedDate, setLoadedDate] = useState<string | null>(null);
  const requestRef = useRef<AbortController | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"today" | "payroll">("today");
  const [clockTick, setClockTick] = useState(0);

  const requestedDate = coachHome && activeTab === "payroll" && payrollMonth ? `${payrollMonth}-01` : date;
  const load = useCallback(async (background = false) => {
    if (background && requestRef.current) return;
    requestRef.current?.abort();
    const request = new AbortController();
    requestRef.current = request;
    const { signal } = request;
    if (!background) {
      setLoading(true);
      setError(null);
    }
    try {
      const params = new URLSearchParams();
      if (requestedDate) params.set("date", requestedDate);
      if (previewStaffId) params.set("personel", previewStaffId);
      const query = params.size ? `?${params}` : "";
      const response = await fetch(`/api/personel-puantaj${query}`, { cache: "no-store", signal });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Veriler alınamadı.");
      if (signal.aborted) return;
      setData(payload);
      setLoadedDate(requestedDate);
    } catch (err) {
      if (!signal.aborted) setError(err instanceof Error ? err.message : "Veriler alınamadı.");
    } finally {
      if (requestRef.current === request) {
        requestRef.current = null;
        setLoading(false);
      }
    }
  }, [requestedDate, previewStaffId]);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => {
      setClockTick((value) => value + 1);
      void load(true);
    }, 60_000);
    return () => {
      requestRef.current?.abort();
      requestRef.current = null;
      window.clearInterval(timer);
    };
  }, [load]);

  const currentMinute = useMemo(() => {
    if (data && data.date < data.currentDate) return 1440;
    if (data && data.date > data.currentDate) return -1440;
    return istanbulMinutesNow();
  }, [clockTick, data]);

  const managerMissing = useMemo(() => {
    if (!data?.isManager || data.date !== data.currentDate) return [] as Array<{ row: TodayRow; lateBy: number }>;
    return data.today
      .filter((row) => !row.checkin)
      .map((row) => ({ row, lateBy: currentMinute - minutes(row.startTime) }))
      .filter(({ lateBy }) => lateBy >= 0)
      .sort((a, b) => b.lateBy - a.lateBy);
  }, [data, currentMinute]);

  const checkin = useCallback(async (row: TodayRow) => {
    setMessage(null);
    setError(null);
    setBusyKey(row.scheduleId);

    if (!navigator.geolocation) {
      setError("Bu cihaz konum paylaşımını desteklemiyor.");
      setBusyKey(null);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const response = await fetch("/api/personel-puantaj", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "checkin",
              scheduleId: row.scheduleId,
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              accuracy: position.coords.accuracy,
            }),
          });
          const payload = await response.json();
          if (!response.ok) throw new Error(payload?.error || "Giriş kaydedilemedi.");
          if (payload?.checkin?.approval_status === "pending") {
            setMessage("Giriş kaydedildi. Konum doğrulaması için yönetici onayı bekliyor.");
          } else {
            setMessage("Derse gelişiniz başarıyla kaydedildi.");
          }
          await load();
        } catch (err) {
          setError(err instanceof Error ? err.message : "Giriş kaydedilemedi.");
        } finally {
          setBusyKey(null);
        }
      },
      (geoError) => {
        const text = geoError.code === 1
          ? "Konum izni verilmedi. Telefon ayarlarından SprintOS için konum iznini açın."
          : "Konum alınamadı. GPS ve internet bağlantınızı kontrol edin.";
        setError(text);
        setBusyKey(null);
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  }, [load]);

  const approve = useCallback(async (checkinId: string, note?: string) => {
    setBusyKey(checkinId);
    setMessage(null);
    setError(null);
    try {
      const response = await fetch("/api/personel-puantaj", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve", checkinId, note }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Onay verilemedi.");
      setMessage("Personelin konum girişi onaylandı.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Onay verilemedi.");
    } finally {
      setBusyKey(null);
    }
  }, [load]);

  async function complete(row: TodayRow) {
    setBusyKey(row.scheduleId);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/personel-puantaj", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "complete", scheduleId: row.scheduleId, lessonDate: data?.date }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Ders tamamlanamadı.");
      setMessage(row.checkin?.approval_status === "pending"
        ? "Ders tamamlandı. Giriş onaylandığında puantaja yansıyacak."
        : "Ders tamamlandı ve puantaja işlendi.");
      await load();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Ders tamamlanamadı.");
    } finally {
      setBusyKey(null);
    }
  }

  const totalPayroll = useMemo(
    () => (data?.payroll || []).reduce((sum, row) => sum + Number(row.estimatedAmount || 0), 0),
    [data]
  );

  if (loading && !data) {
    return <div className="ppLoading">Personel ve puantaj verileri hazırlanıyor…</div>;
  }

  if (!data) {
    return <div className="ppErrorBox" role="alert">
      {error || "Personel puantaj verileri görüntülenemedi."} <button type="button" onClick={() => void load()}>Tekrar dene</button>
    </div>;
  }

  const dateReady = loadedDate === requestedDate;
  const selectedDay = date || data.currentDate;
  const personalPayroll = coachHome ? data.payroll[0] : undefined;

  return (
    <div className="ppContent">
      {message ? <div className="ppNotice success" role="status">{message}</div> : null}
      {error ? <div className="ppNotice danger" role="alert">{error}</div> : null}

      {!coachHome && data.isManager && managerMissing.length ? (
        <section className="ppManagerAlertPanel">
          <div className="ppManagerAlertHead">
            <div><p>YÖNETİCİ UYARISI</p><strong>Giriş yapılmayan seanslar</strong></div>
            <span>{managerMissing.length}</span>
          </div>
          {managerMissing.map(({ row, lateBy }) => (
            <div className="ppManagerAlertRow" key={`manager-${row.staffId}-${row.scheduleId}`}>
              <div>
                <strong>{row.staffName}</strong>
                <p>{row.branchName} · {row.groupName} · {row.startTime}–{row.endTime}</p>
              </div>
              <span>{lateBy > 0 ? `${lateBy} dk gecikti` : "Seans başladı"}</span>
            </div>
          ))}
        </section>
      ) : null}

      <div className="ppViewControls">
        <div className="ppTabs" role="group" aria-label="Personel puantaj bölümleri">
          <button type="button" disabled={busyKey !== null} aria-pressed={activeTab === "today"} className={activeTab === "today" ? "active" : ""} onClick={() => setActiveTab("today")}>{previewStaffId ? "Ders programı" : coachHome ? "Derslerim" : "Ders planı"}</button>
          <button type="button" disabled={busyKey !== null} aria-pressed={activeTab === "payroll"} className={activeTab === "payroll" ? "active" : ""} onClick={() => { if (coachHome && !payrollMonth) setPayrollMonth(data.currentDate.slice(0, 7)); setActiveTab("payroll"); }}>{coachHome ? "Puantaj ve ödemeler" : "Puantaj ve hakediş"}</button>
        </div>
        <div className="ppDateTools">
          {coachHome && activeTab === "payroll" ? (
            <label>Dönem <input type="month" value={payrollMonth || data.currentDate.slice(0, 7)}
              disabled={busyKey !== null} onChange={(event) => setPayrollMonth(event.target.value || data.currentDate.slice(0, 7))} /></label>
          ) : coachHome ? (
            <div className="ppDayPicker">
              <button type="button" aria-label="Önceki gün" disabled={busyKey !== null} onClick={() => setDate(shiftDay(selectedDay, -1))}>‹</button>
              <input aria-label="Ders tarihi" type="date" value={selectedDay} disabled={busyKey !== null}
                onChange={(event) => setDate(event.target.value)} />
              <button type="button" aria-label="Sonraki gün" disabled={busyKey !== null} onClick={() => setDate(shiftDay(selectedDay, 1))}>›</button>
              <button type="button" disabled={busyKey !== null || selectedDay === data.currentDate} onClick={() => setDate("")}>Bugün</button>
            </div>
          ) : (
            <>
              <label>{activeTab === "today" ? "Ders tarihi" : "Puantaj tarihi"} <input type="date" value={date || data.date} disabled={busyKey !== null} onChange={(event) => setDate(event.target.value)} /></label>
              {data.date !== data.currentDate ? <button type="button" onClick={() => setDate("")} disabled={busyKey !== null}>Bugüne dön</button> : null}
            </>
          )}
          <button type="button" onClick={() => void load()} disabled={loading}>{loading ? "Yenileniyor…" : "Yenile"}</button>
        </div>
      </div>

      {dateReady && !coachHome && activeTab === "today" ? <section className="ppStats ppCompactStats" aria-label="Ders planı özeti">
        <article><span>Planlanan görev</span><strong>{data.summary.planned}</strong></article>
        <article><span>Giriş kaydı</span><strong>{data.summary.checkedIn}</strong></article>
        <article><span>Konum onayı bekleyen</span><strong>{data.summary.pending}</strong></article>
        <article className={managerMissing.length || data.summary.missing ? "alert" : ""}><span>Giriş yapılmayan</span><strong>{managerMissing.length || data.summary.missing}</strong></article>
      </section> : null}

      {!dateReady ? (
        !error ? <div className="ppLoading" role="status">Seçilen dönem yükleniyor…</div> : null
      ) : activeTab === "today" ? (
        <section className="ppPanel">
          <div className="ppPanelHead">
            <h2>{previewStaffId ? "Atanan dersler" : coachHome ? "Derslerim" : "Antrenör, havuz ve ders planı"}</h2>
            <span>{coachHome ? `${data.today.length} seans` : formatDisplayDate(data.date)}</span>
          </div>

          {data.unassigned?.length ? (
            <section className="ppAssignmentNotice" aria-label="Eğitmen atamaları">
              <h3>{data.unassigned.length} seans eğitmen ataması bekliyor</h3>
              <ul>
                {data.unassigned.map((row) => (
                  <li key={row.id}>
                    <time>{row.startTime}</time>
                    <div>
                      <strong>{row.groupName}</strong>
                      {!row.groupName.toLocaleLowerCase("tr-TR").includes(row.branchName.toLocaleLowerCase("tr-TR")) ? <span>{row.branchName}</span> : null}
                    </div>
                    <Link
                      href={`/operasyon-plani?${new URLSearchParams({ tarih: data.date, seans: row.id, sube: row.branchId, saat: row.startTime })}`}
                      aria-label={`${row.startTime} ${row.groupName} seansını aç`}
                    >
                      Seansı aç
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          {data.today.length ? (
            <div className="ppLessonList">
              {data.today.map((row) => {
                const meta = statusMeta(row.checkin);
                const canCheckin = row.isMine && !row.checkin && data.date === data.currentDate &&
                  currentMinute >= minutes(row.startTime) - 30 && currentMinute < minutes(row.endTime);
                const canComplete = row.isMine && row.checkin && !row.checkin.completed_at &&
                  row.checkin.approval_status !== "rejected" && currentMinute >= minutes(row.endTime);
                const sessionParams = new URLSearchParams({
                  date: data.date, branchId: row.branchId, time: row.startTime, scheduleId: row.scheduleId,
                  ...(previewStaffId || (currentRole === "coach" && row.isMine) ? { personel: row.staffId } : {}),
                });
                const attendanceUrl = `/yoklama?${sessionParams}`;
                const reportsUrl = `${attendanceUrl}&gorunum=gelisim`;
                const checkinOpensAt = Math.max(0, minutes(row.startTime) - 30);
                const openingTime = `${String(Math.floor(checkinOpensAt / 60)).padStart(2, "0")}:${String(checkinOpensAt % 60).padStart(2, "0")}`;
                const showCheckin = coachHome && !previewStaffId && !row.checkin;
                const checkinHint = data.date !== data.currentDate ? `Konumlu giriş ders günü ${openingTime}–${row.endTime} arasında yapılır.`
                  : currentMinute < checkinOpensAt ? `Saat ${openingTime}’da açılır.`
                  : currentMinute >= minutes(row.endTime) ? "Ders sona erdi. Konumlu giriş kapandı."
                  : !row.isMine ? "Konumlu giriş için personel hesabınızı kontrol edin."
                  : "Tesisteyken dokunun. Telefonunuz konum izni isteyebilir.";
                const canApprove = data.isManager && row.checkin?.approval_status === "pending";
                const lateBy = currentMinute - minutes(row.startTime);
                const isMissingStarted = !row.checkin && currentMinute >= minutes(row.endTime);
                const isLate = !row.checkin && lateBy >= 0 && !isMissingStarted;
                const attendanceLabel = row.attendanceState ? attendanceLabels[row.attendanceState] : null;
                return (
                  <article className={`ppLessonRow ${isMissingStarted ? "missing" : ""}`} key={`${row.staffId}-${row.scheduleId}`}>
                    <div className="ppTimeBox"><strong>{row.startTime}</strong><span>{row.endTime}</span></div>
                    <div className="ppLessonMain">
                      <div className="ppLessonTitle">
                        <strong>{coachHome ? row.groupName : row.staffName}</strong>
                        <span className={`ppStatus ${isMissingStarted ? "danger" : isLate ? "late" : meta.tone}`}>{isMissingStarted ? "Giriş yapılmadı" : isLate ? "Giriş gecikti" : meta.label}</span>
                      </div>
                      {!coachHome ? <p>{row.branchName} · {row.groupName}</p> :
                        !row.groupName.toLocaleLowerCase("tr-TR").includes(row.branchName.toLocaleLowerCase("tr-TR")) ? <p>{row.branchName}</p> : null}
                      <small>{row.assignmentRole === "backup" ? "Yedek eğitmen" : "Ana eğitmen"}{!coachHome && row.title && row.title !== "Eğitmen" ? ` · ${row.title}` : ""}</small>
                      {previewStaffId && !row.checkin && !isMissingStarted ? (
                        <p className="ppCheckinWindow">Konumlu giriş saati {openingTime}–{row.endTime}</p>
                      ) : null}
                      {previewStaffId && row.checkin?.manager_note ? <p>{row.checkin.manager_note}</p> : null}
                      {row.checkin ? (
                        <div className="ppCheckMeta">
                          <span>Giriş: {timeOf(row.checkin.checked_in_at)}</span>
                          <span>{row.checkin.location_verified ? "Konum doğrulandı" : "Konum kontrolü gerekli"}</span>
                          {typeof row.checkin.distance_m === "number" ? <span>Mesafe: {Math.round(row.checkin.distance_m)} m</span> : null}
                        </div>
                      ) : isMissingStarted ? (
                        <div className="ppMissingMeta">Planlanan seans başladı · {data.date !== data.currentDate ? "giriş kaydı yok" : lateBy > 0 ? `${lateBy} dk geçti` : "giriş bekleniyor"}</div>
                      ) : !row.branchLocationConfigured ? (
                        <div className="ppBranchWarn">Bu şube için havuz koordinatı henüz tanımlı değil; giriş yönetici onayına düşer.</div>
                      ) : null}
                    </div>
                    <div className="ppActions">
                      {showCheckin ? (
                        <div className="ppCheckinControl">
                          <button type="button" className="ppPrimary" onClick={() => void checkin(row)}
                            disabled={!canCheckin || busyKey !== null} aria-describedby={`checkin-${row.scheduleId}`}>
                            {busyKey === row.scheduleId ? "Konum alınıyor…" : "Konumu doğrula ve geldim"}
                          </button>
                          <span id={`checkin-${row.scheduleId}`}>{checkinHint}</span>
                        </div>
                      ) : canCheckin ? (
                        <button type="button" className="ppPrimary" onClick={() => void checkin(row)} disabled={busyKey !== null}>
                          {busyKey === row.scheduleId ? "Konum alınıyor…" : "Konumu doğrula ve geldim"}
                        </button>
                      ) : null}
                      {canApprove && row.checkin ? (
                        <form className="ppApprovalForm" onSubmit={(event) => {
                          event.preventDefault();
                          const note = new FormData(event.currentTarget).get("note");
                          void approve(row.checkin!.id, typeof note === "string" ? note : undefined);
                        }}>
                          {previewStaffId ? <input name="note" aria-label="Yönetici onay notu" placeholder="Onay notu (isteğe bağlı)" maxLength={500} /> : null}
                          <button type="submit" className="ppApprove" disabled={busyKey !== null}>
                            {busyKey === row.checkin.id ? "Onaylanıyor…" : "Konum Girişini Onayla"}
                          </button>
                        </form>
                      ) : null}
                      {(row.isMine || previewStaffId) ? (
                        <div className="ppClassLinks">
                          <Link className="ppLessonLink ppAttendanceLink" href={attendanceUrl}>
                            Öğrenciler ve yoklama
                            {attendanceLabel ? <small data-state={row.attendanceState}>{attendanceLabel}</small> : null}
                          </Link>
                          {coachHome ? <Link className="ppLessonLink" href={reportsUrl}>Gelişim raporları</Link> : null}
                        </div>
                      ) : null}
                      {canComplete ? (
                        <button className="ppPrimary" disabled={busyKey !== null} onClick={() => void complete(row)}>
                          {busyKey === row.scheduleId ? "Kaydediliyor…" : "Dersi Tamamla"}
                        </button>
                      ) : null}
                      {data.isManager && !previewStaffId && ["owner", "admin"].includes(currentRole) ? (
                        <Link className="ppApprove" href={`/personel-puantaj?personel=${row.staffId}`}>Paneli Aç</Link>
                      ) : null}
                      {data.isManager ? (
                        <Link
                          className="ppLessonLink ppAssignmentLink"
                          href={`/operasyon-plani?${new URLSearchParams({ tarih: data.date, seans: row.scheduleId, sube: row.branchId, saat: row.startTime })}`}
                        >
                          Eğitmen atamasını düzenle
                        </Link>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="ppEmpty">
              <strong>Bu tarih için atanmış ders bulunmuyor.</strong>
              {data.isManager ? (
                <div style={{ marginTop: 12 }}>
                  <Link className="ppApprove" href={`/operasyon-plani?tarih=${encodeURIComponent(data.date)}`}>
                    Operasyon Planında Atama Yap / Düzelt
                  </Link>
                </div>
              ) : null}
            </div>
          )}
        </section>
      ) : (
        <section className="ppPanel">
          <div className="ppPanelHead">
            <div><p>{new Intl.DateTimeFormat("tr-TR", { month: "long", year: "numeric" }).format(new Date(`${data.date}T12:00:00`))}</p><h2>Puantaj ve hakediş</h2></div>
            {data.isManager && !coachHome ? <strong className="ppTotal">Toplam {money(totalPayroll)}</strong> : null}
          </div>

          {personalPayroll ? (
            <dl className="ppPayrollSummary">
              <div><dt>Hakediş</dt><dd>{money(personalPayroll.estimatedAmount)}</dd></div>
              <div><dt>Ödeme</dt><dd>{paymentStatus(personalPayroll)}</dd></div>
              <div><dt>Onaylı ders</dt><dd>{personalPayroll.lessonCount}</dd></div>
              <div><dt>Toplam süre</dt><dd>{Math.floor(personalPayroll.totalMinutes / 60)} sa {personalPayroll.totalMinutes % 60} dk</dd></div>
              <div><dt>Ücret modeli</dt><dd>{payTypeLabels[personalPayroll.payType] || personalPayroll.payType}</dd></div>
            </dl>
          ) : coachHome ? (
            <p className="ppEmpty">Bu dönem için puantaj bilgisi bulunamadı.</p>
          ) : (
          <div className="ppPayrollTableWrap">
            <table className="ppPayrollTable">
              <thead><tr><th>Personel</th><th>Ücret modeli</th><th>Onaylı ders</th><th>Süre</th><th>Hakediş</th><th>Ödeme</th></tr></thead>
              <tbody>
                {data.payroll.map((row) => (
                  <tr key={row.staffId}>
                    <td><strong>{row.staffName}</strong></td>
                    <td>{payTypeLabels[row.payType] || row.payType}</td>
                    <td>{row.lessonCount}</td>
                    <td>{Math.floor(row.totalMinutes / 60)} sa {row.totalMinutes % 60} dk</td>
                    <td><strong>{money(row.estimatedAmount)}</strong></td>
                    <td>{paymentStatus(row)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          )}

          {coachHome && data.lessons.length > 0 ? (
            <section className="ppLessonHistory" aria-label="Tamamlanan dersler">
              <h3>Tamamlanan dersler</h3>
              <p>Ders tutarları güncel ücret ayarlarına göre gösterilir. Kesin ödeme tutarı aylık özette yer alır.</p>
              <ul>
                {[...data.lessons].sort((a, b) => b.lesson_date.localeCompare(a.lesson_date) ||
                  b.planned_start.localeCompare(a.planned_start)).map((lesson) => (
                  <li key={lesson.id}>
                    <strong>{lesson.training_groups?.name || "Yüzme dersi"}</strong>
                    <span>{formatDisplayDate(lesson.lesson_date)} · {lesson.planned_start.slice(0, 5)}–{lesson.planned_end.slice(0, 5)} · {lesson.duration} dk</span>
                    {lesson.branches?.name ? <small>{lesson.branches.name}</small> : null}
                    {lesson.amount !== null ? <b>{money(lesson.amount)}</b> : <small>Aylık ücrete dahil</small>}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <div className="ppInfo">
            <strong>Hesaplama kuralı</strong>
            <p>Hakediş, ücret modeline göre hesaplanır. Ders ödemesine tamamlanan ve konum girişi onaylanan dersler dahil edilir.</p>
          </div>
        </section>
      )}

      {coachHome && !previewStaffId && activeTab === "today" ? (
        <div className="ppPrivacy">Konum yalnızca “Geldim” butonuna bastığınız anda alınır; sürekli konum takibi yapılmaz.</div>
      ) : null}
    </div>
  );
}
