"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { UserRole } from "@/lib/auth/profile";

type Checkin = {
  id: string;
  checked_in_at: string;
  distance_m: number | null;
  location_verified: boolean;
  attendance_status: string;
  approval_status: string;
  manager_note?: string | null;
};

type TodayRow = {
  scheduleId: string;
  staffId: string;
  staffName: string;
  title: string;
  branchId: string;
  branchName: string;
  branchLocationConfigured: boolean;
  groupId: string | null;
  groupName: string;
  startTime: string;
  endTime: string;
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
};

type DashboardData = {
  role: UserRole;
  isManager: boolean;
  currentStaffId: string | null;
  date: string;
  today: TodayRow[];
  payroll: PayrollRow[];
  summary: {
    planned: number;
    checkedIn: number;
    pending: number;
    missing: number;
  };
};

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
    maximumFractionDigits: 0,
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
  if (checkin.attendance_status === "late") return { label: "Geç giriş", tone: "late" };
  return { label: "Geldi", tone: "success" };
}

export default function PersonelPuantajClient({ currentRole }: { currentRole: UserRole }) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"today" | "payroll">("today");
  const [clockTick, setClockTick] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/personel-puantaj", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Veriler alınamadı.");
      setData(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Veriler alınamadı.");
    } finally {
      setLoading(false);
    }
  }, []);

  const syncAlerts = useCallback(async () => {
    try {
      await fetch("/api/personel-puantaj/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
    } catch {
      // Görsel seans uyarıları istemci tarafında çalışmaya devam eder.
    }
  }, []);

  useEffect(() => {
    void load();
    void syncAlerts();
  }, [load, syncAlerts]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setClockTick((value) => value + 1);
      void syncAlerts();
      void load();
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [load, syncAlerts]);

  const currentMinute = useMemo(() => istanbulMinutesNow(), [clockTick, data]);

  const myUpcomingWarnings = useMemo(() => {
    if (!data) return [] as Array<{ row: TodayRow; diff: number }>;
    return data.today
      .filter((row) => row.isMine && !row.checkin)
      .map((row) => ({ row, diff: minutes(row.startTime) - currentMinute }))
      .filter(({ diff }) => diff <= 30 && diff > 0)
      .sort((a, b) => a.diff - b.diff);
  }, [data, currentMinute]);

  const myStartedMissing = useMemo(() => {
    if (!data) return [] as Array<{ row: TodayRow; lateBy: number }>;
    return data.today
      .filter((row) => row.isMine && !row.checkin)
      .map((row) => ({ row, lateBy: currentMinute - minutes(row.startTime) }))
      .filter(({ lateBy }) => lateBy >= 0)
      .sort((a, b) => b.lateBy - a.lateBy);
  }, [data, currentMinute]);

  const managerMissing = useMemo(() => {
    if (!data?.isManager) return [] as Array<{ row: TodayRow; lateBy: number }>;
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

  const approve = useCallback(async (checkinId: string) => {
    setBusyKey(checkinId);
    setMessage(null);
    setError(null);
    try {
      const response = await fetch("/api/personel-puantaj", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve", checkinId }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Onay verilemedi.");
      setMessage("Personel girişi onaylandı ve puantaja dahil edildi.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Onay verilemedi.");
    } finally {
      setBusyKey(null);
    }
  }, [load]);

  const totalPayroll = useMemo(
    () => (data?.payroll || []).reduce((sum, row) => sum + Number(row.estimatedAmount || 0), 0),
    [data]
  );

  if (loading && !data) {
    return <div className="ppLoading">Personel ve puantaj verileri hazırlanıyor…</div>;
  }

  if (!data) {
    return <div className="ppErrorBox">{error || "Personel puantaj verileri görüntülenemedi."}</div>;
  }

  return (
    <div className="ppContent">
      {message ? <div className="ppNotice success">{message}</div> : null}
      {error ? <div className="ppNotice danger">{error}</div> : null}

      {myUpcomingWarnings.map(({ row, diff }) => (
        <div className="ppSessionAlert warning" key={`upcoming-${row.scheduleId}`}>
          <div className="ppSessionAlertIcon">!</div>
          <div>
            <strong>Dersinizin başlamasına {diff} dakika kaldı</strong>
            <p>{row.branchName} · {row.groupName} · {row.startTime}–{row.endTime}</p>
            <span>Henüz “Derse Geldim” girişi yapmadınız. Ders başlangıcında giriş yapılmazsa yönetici otomatik olarak bilgilendirilecektir.</span>
          </div>
          <button onClick={() => void checkin(row)} disabled={busyKey === row.scheduleId}>
            {busyKey === row.scheduleId ? "Konum alınıyor…" : "Derse Geldim"}
          </button>
        </div>
      ))}

      {myStartedMissing.map(({ row, lateBy }) => (
        <div className="ppSessionAlert danger" key={`started-${row.scheduleId}`}>
          <div className="ppSessionAlertIcon">!</div>
          <div>
            <strong>Seans başladı · girişiniz bulunmuyor</strong>
            <p>{row.branchName} · {row.groupName} · {row.startTime}–{row.endTime}</p>
            <span>{lateBy > 0 ? `${lateBy} dakika geçti. ` : "Ders saati geldi. "}Yönetici bilgilendirildi. Lütfen tesisteyseniz girişinizi hemen yapın.</span>
          </div>
          <button onClick={() => void checkin(row)} disabled={busyKey === row.scheduleId}>
            {busyKey === row.scheduleId ? "Konum alınıyor…" : "Şimdi Giriş Yap"}
          </button>
        </div>
      ))}

      {data.isManager && managerMissing.length ? (
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

      <section className="ppStats">
        <article><span>Bugünkü Plan</span><strong>{data.summary.planned}</strong><small>personel / ders ataması</small></article>
        <article><span>Giriş Yapan</span><strong>{data.summary.checkedIn}</strong><small>bugün kaydedilen</small></article>
        <article><span>Onay Bekleyen</span><strong>{data.summary.pending}</strong><small>konum / yönetici kontrolü</small></article>
        <article className={managerMissing.length ? "alert" : ""}><span>Giriş Yapılmayan</span><strong>{managerMissing.length || data.summary.missing}</strong><small>başlayan seans / giriş yok</small></article>
      </section>

      <div className="ppTabs" role="tablist" aria-label="Personel puantaj bölümleri">
        <button className={activeTab === "today" ? "active" : ""} onClick={() => setActiveTab("today")}>Bugünkü Girişler</button>
        <button className={activeTab === "payroll" ? "active" : ""} onClick={() => setActiveTab("payroll")}>Aylık Puantaj & Hakediş</button>
        <button className="ppRefresh" onClick={() => void load()} disabled={loading}>{loading ? "Yenileniyor…" : "Yenile"}</button>
      </div>

      {activeTab === "today" ? (
        <section className="ppPanel">
          <div className="ppPanelHead">
            <div><p>BUGÜN</p><h2>Ders ve personel girişleri</h2></div>
            <span>{data.date}</span>
          </div>

          {data.today.length ? (
            <div className="ppLessonList">
              {data.today.map((row) => {
                const meta = statusMeta(row.checkin);
                const canCheckin = row.isMine && !row.checkin;
                const canApprove = data.isManager && row.checkin?.approval_status === "pending";
                const lateBy = currentMinute - minutes(row.startTime);
                const isMissingStarted = !row.checkin && lateBy >= 0;
                return (
                  <article className={`ppLessonRow ${isMissingStarted ? "missing" : ""}`} key={`${row.staffId}-${row.scheduleId}`}>
                    <div className="ppTimeBox"><strong>{row.startTime}</strong><span>{row.endTime}</span></div>
                    <div className="ppLessonMain">
                      <div className="ppLessonTitle">
                        <strong>{row.staffName}</strong>
                        <span className={`ppStatus ${isMissingStarted ? "danger" : meta.tone}`}>{isMissingStarted ? "Giriş yapılmadı" : meta.label}</span>
                      </div>
                      <p>{row.branchName} · {row.groupName}</p>
                      <small>{row.title || "Eğitmen"}</small>
                      {row.checkin ? (
                        <div className="ppCheckMeta">
                          <span>Giriş: {timeOf(row.checkin.checked_in_at)}</span>
                          <span>{row.checkin.location_verified ? "Konum doğrulandı" : "Konum kontrolü gerekli"}</span>
                          {typeof row.checkin.distance_m === "number" ? <span>Mesafe: {Math.round(row.checkin.distance_m)} m</span> : null}
                        </div>
                      ) : isMissingStarted ? (
                        <div className="ppMissingMeta">Planlanan seans başladı · {lateBy > 0 ? `${lateBy} dk geçti` : "giriş bekleniyor"}</div>
                      ) : !row.branchLocationConfigured ? (
                        <div className="ppBranchWarn">Bu şube için havuz koordinatı henüz tanımlı değil; giriş yönetici onayına düşer.</div>
                      ) : null}
                    </div>
                    <div className="ppActions">
                      {canCheckin ? (
                        <button className="ppPrimary" onClick={() => void checkin(row)} disabled={busyKey === row.scheduleId}>
                          {busyKey === row.scheduleId ? "Konum alınıyor…" : "📍 Konumu Doğrula · Geldim"}
                        </button>
                      ) : null}
                      {canApprove && row.checkin ? (
                        <button className="ppApprove" onClick={() => void approve(row.checkin!.id)} disabled={busyKey === row.checkin.id}>
                          {busyKey === row.checkin.id ? "Onaylanıyor…" : "Puantaja Onayla"}
                        </button>
                      ) : null}
                      {!canCheckin && !canApprove ? <span className="ppDone">{row.checkin ? "Kayıt tamamlandı" : isMissingStarted ? "Yönetici takibinde" : "Planlandı"}</span> : null}
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="ppEmpty">Bugün için atanmış aktif ders bulunmuyor.</div>
          )}
        </section>
      ) : (
        <section className="ppPanel">
          <div className="ppPanelHead">
            <div><p>AYLIK ÖZET</p><h2>Puantaj ve tahmini hakediş</h2></div>
            {data.isManager ? <strong className="ppTotal">Toplam {money(totalPayroll)}</strong> : null}
          </div>

          <div className="ppPayrollTableWrap">
            <table className="ppPayrollTable">
              <thead><tr><th>Personel</th><th>Ücret modeli</th><th>Onaylı ders</th><th>Süre</th><th>Hakediş</th></tr></thead>
              <tbody>
                {data.payroll.map((row) => (
                  <tr key={row.staffId}>
                    <td><strong>{row.staffName}</strong></td>
                    <td>{payTypeLabels[row.payType] || row.payType}</td>
                    <td>{row.lessonCount}</td>
                    <td>{Math.floor(row.totalMinutes / 60)} sa {row.totalMinutes % 60} dk</td>
                    <td><strong>{money(row.estimatedAmount)}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="ppInfo">
            <strong>Hesaplama kuralı</strong>
            <p>Hakedişe yalnızca konumu otomatik doğrulanan veya yönetici tarafından onaylanan ders girişleri dahil edilir. Personelin ücret modeli `staff` kaydındaki ders başı, saatlik veya aylık ücret ayarından hesaplanır.</p>
          </div>
        </section>
      )}

      {currentRole === "coach" ? (
        <div className="ppPrivacy">Konum yalnızca “Geldim” butonuna bastığınız anda alınır; sürekli konum takibi yapılmaz.</div>
      ) : null}
    </div>
  );
}
