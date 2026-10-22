"use client";

import { formatDisplayDate } from "@/lib/dates/display";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { Icons } from "@/app/components/dashboard-icons";
import { cancellationMessageLabel } from "@/lib/dashboard/cancellation-summary";
import DashboardSmartCalendar from "@/app/components/dashboard-smart-calendar";

type PastSlot = {date:string;branchId:string;branchName:string;time:string;missingCount:number;href:string};
 export type LiveData = {
  ok: boolean;
  date: string;
  cancellationMessagesAvailable?: boolean;
  sessions: Array<{
    cancelled?: boolean;
    cancellation?: {studentIds:string[];plannedStudentIds:string[];reservedStudentIds:string[];sentStudentIds:string[];preparedStudentIds:string[];openedStudentIds?:string[];reasons:string[]};
    id: string;
    branchId: string | null;
    branchName: string;
    groupId: string | null;
    groupName: string;
    groups: Array<{ id: string; groupName: string; studentCount: number; statusCounts: { present: number; absent: number; excused: number }; missingCount: number; cancelled?: boolean }>;
    startTime: string;
    endTime: string;
    studentCount: number;
    attendanceCount: number;
    attendanceComplete: boolean;
    missingCount: number;
    blockedCount: number;
    statusCounts: { present: number; absent: number; excused: number };
    notes: Array<{ id: string; title: string; text: string; status: string }>;
    notesAvailable: boolean;
  }>;
  pastAttendance?: PastSlot[];
  closedPastAttendance?: Array<PastSlot & {status: "completed" | "removed"; updatedAt?: string}>;
  canManagePastAttendance?: boolean;
  historyAvailable?: boolean;
  historyDays?: number;
  birthdays: Array<{
    id: string;
    name: string;
    age: number | null;
    branchName: string;
    whatsappUrl: string | null;
    celebrated?: boolean;
    celebratedAt?: string | null;
    celebratedBy?: string | null;
  }>;
  summary: {
    todayLessons: number;
    pendingAttendance: number;
    birthdays: number;
    pendingApprovals: number;
    pendingCash: number;
    openAlerts: number;
    preRegistrations: number;
    todayStartingStudents: number;
  };
};

function OperationPanel() {
  const [data, setData] = useState<LiveData | null>(null);
  const [openedSession, setOpenedSession] = useState<string | null>(null);
  const [openingSession, setOpeningSession] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [retryVersion, setRetryVersion] = useState(0);
  const [celebrationBusy, setCelebrationBusy] = useState<string | null>(null);

  const [historyBusy, setHistoryBusy] = useState<string | null>(null);
  const [historyMessage, setHistoryMessage] = useState("");
  const historyLock = useRef(false);
  const loadVersion = useRef(0);

  useEffect(() => {
    let active = true;
    let controller: AbortController | null = null;

    async function load() {
      const version = ++loadVersion.current;
      controller?.abort();
      const request = new AbortController();
      controller = request;
      const timeout = window.setTimeout(() => request.abort(), 15000);
      try {
        const response = await fetch("/api/dashboard/live", { cache: "no-store", signal: request.signal });
        const result = (await response.json()) as LiveData;
        if (!response.ok || !result.ok) throw new Error("Operasyon verileri alınamadı");
        if (active && version === loadVersion.current) {
          setData(result);
          setLoadError(false);
        }
      } catch (error) {
        if (active && version === loadVersion.current) {
          console.error("SprintOS canlı operasyon:", error);
          setLoadError(true);
        }
      } finally {
        window.clearTimeout(timeout);
        if (active && version === loadVersion.current) setLoading(false);
      }
    }

    void load();
    const refresh = () => { if (document.visibilityState === "visible") void load(); };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    const timer = window.setInterval(refresh, 30000);
    return () => {
      active = false;
      controller?.abort();
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [retryVersion]);

  function retryLoad() {
    setLoading(true);
    setRetryVersion((version) => version + 1);
  }

  useEffect(() => {
    if (!data?.date) return;
    try { setOpenedSession(sessionStorage.getItem(`sprintos:opened-attendance:${data.date}`)); } catch {}
  }, [data?.date]);

  const actionCount = useMemo(() => {
    if (!data) return 0;
    return (data.pastAttendance?.length || 0) + data.summary.pendingAttendance + data.summary.pendingApprovals + data.summary.pendingCash + data.summary.openAlerts + data.summary.todayStartingStudents;
  }, [data]);

  async function celebrateBirthday(birthday: LiveData["birthdays"][number]) {
    if (!birthday.whatsappUrl || celebrationBusy) return;
    window.open(birthday.whatsappUrl, "_blank", "noopener,noreferrer");
    setCelebrationBusy(birthday.id);
    try {
      const response = await fetch("/api/dashboard/birthday-celebrations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          studentId: birthday.id,
          year: Number(data?.date?.slice(0, 4) || new Date().getFullYear()),
        }),
      });
      const payload = await response.json();
      if (response.ok && payload.ok) {
        setData((current) => current ? {
          ...current,
          birthdays: current.birthdays.map((item) =>
            item.id === birthday.id
              ? { ...item, celebrated: true, celebratedAt: payload.celebration?.sent_at || new Date().toISOString() }
              : item
          ),
        } : current);
      }
    } catch (error) {
      console.error("Doğum günü kutlama kaydı:", error);
    } finally {
      setCelebrationBusy(null);
    }
  }

  async function updateHistory(item: PastSlot, status: "open" | "completed" | "removed") {
    if (historyLock.current) return;
    historyLock.current = true;
    const slotKey = (slot: PastSlot) => JSON.stringify([slot.date, slot.branchId, slot.time]);
    setHistoryBusy(slotKey(item));
    setHistoryMessage("");
    try {
      const response = await fetch("/api/dashboard/attendance-followups", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({date: item.date, branchId: item.branchId, time: item.time, status}),
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error || "İşlem kaydedilemedi.");
      ++loadVersion.current; // A refresh started before this save must not resurrect the warning.
      setData(current => {
        if (!current) return current;
        const pending = (current.pastAttendance || []).filter(slot => slotKey(slot) !== slotKey(item));
        const closed = (current.closedPastAttendance || []).filter(slot => slotKey(slot) !== slotKey(item));
        return { ...current,
          pastAttendance: status === "open" ? [...pending, item].sort((a,b) => b.date.localeCompare(a.date) || a.time.localeCompare(b.time)) : pending,
          closedPastAttendance: status === "open" ? closed : [{...item, status, updatedAt: payload.updatedAt}, ...closed],
        };
      });
      setHistoryMessage(status === "open" ? "İşlem bekleyen listeye geri alındı." : status === "completed" ? "Takip işlemi tamamlandı." : "Uyarı listeden kaldırıldı.");
    } catch (error) {
      setHistoryMessage(error instanceof Error ? error.message : "İşlem kaydedilemedi. Tekrar deneyin.");
    } finally {
      historyLock.current = false;
      setHistoryBusy(null);
    }
  }

  function celebrationTime(value?: string | null) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return new Intl.DateTimeFormat("tr-TR", {
      timeZone: "Europe/Istanbul",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  }

  if (!data) {
    return (
      <section className="liveOpsShell" aria-label="Günlük operasyon" aria-busy={loading}>
        <div className="liveOpsFeedback" role="status" aria-live="polite">
          <strong>{loading ? "Günlük operasyon yükleniyor…" : "Günlük operasyon verileri alınamadı"}</strong>
          <p>{loading ? "Dersler ve bekleyen işlemler kontrol ediliyor." : "Bağlantıyı kontrol edip yeniden deneyin."}</p>
          {!loading ? <button type="button" onClick={retryLoad}>Tekrar dene</button> : null}
        </div>
      </section>
    );
  }

  const pendingSession = data.sessions.find(session => session.missingCount > 0);
  const attendanceParams = new URLSearchParams({ date: data.date });
  if (pendingSession?.branchId) attendanceParams.set("branchId", pendingSession.branchId);
  if (pendingSession) attendanceParams.set("time", pendingSession.startTime);
  const pendingAttendanceUrl = `/yoklama?${attendanceParams.toString()}`;
  const todayAttendanceUrl = `/yoklama?date=${encodeURIComponent(data.date)}`;

  const summaryCards = [
    { label: "Bugünkü Ders", value: data.sessions.filter(session=>!session.cancelled).length, note: data.sessions.some(session=>session.cancelled) ? `${data.sessions.filter(session=>session.cancelled).length} seans iptal edildi` : "Planlanan seans", href: "/ders-programi", tone: "blue", icon: Icons.calendar },
    { label: "Yoklama Bekleyen", value: data.summary.pendingAttendance, note: data.summary.pendingAttendance ? "İşlem bekliyor" : "Tamamlandı", href: pendingAttendanceUrl, tone: data.summary.pendingAttendance ? "orange" : "green", icon: Icons.check },
    { label: "Doğum Günü", value: data.summary.birthdays, note: data.summary.birthdays ? "Kutlama bekliyor" : "Bugün yok", href: "#sprint-birthdays", tone: data.summary.birthdays ? "purple" : "calm", icon: Icons.cake },
    { label: "Yapılacak İşlem", value: actionCount, note: actionCount ? "Önceliklerinizi kontrol edin" : "Her şey yolunda", href: "/uyarilar", tone: actionCount ? "red" : "green", icon: Icons.bell },
  ];

  return (
    <section className="liveOpsShell">
      {loadError ? (
        <div className="liveOpsFeedback" role="status" aria-live="polite">
          <strong>Veriler güncellenemedi</strong>
          <p>Son alınan bilgiler gösteriliyor. İşlem yapmadan önce güncelleyin.</p>
          <button type="button" onClick={retryLoad} disabled={loading}>{loading ? "Güncelleniyor…" : "Tekrar dene"}</button>
        </div>
      ) : null}
      <div className="liveOpsHeadline">
        <div>
          <span>CANLI OPERASYON</span>
          <h2>Bugün ne yapılması gerekiyor?</h2>
          <p>Ders, yoklama, doğum günü ve bekleyen işlemler tek ekranda canlı takip edilir.</p>
        </div>
        <a href="/uyarilar" className={actionCount ? "liveOpsSignal active" : "liveOpsSignal"}>
          <i /> {actionCount ? `${actionCount} işlem` : "Operasyon normal"}
        </a>
      </div>

      <DashboardSmartCalendar />

      <div className="liveOpsSummary">
        {summaryCards.map((item) => (
          <a key={item.label} href={item.href} className={`liveSummaryCard ${item.tone}`}>
            <span className="liveSummaryLabel"><item.icon />{item.label}</span>
            <strong>{item.value}</strong>
            <small>{item.note}</small>
            <b className="liveArrowIcon"><Icons.arrow /></b>
          </a>
        ))}
      </div>

      <div className="liveOpsGrid">
        <article className="livePanel lessonsPanel">
          <div className="livePanelHead">
            <div><span>GÜNLÜK PROGRAM</span><h3>Bugünkü Dersler ve Yoklamalar</h3></div>
            <a href={todayAttendanceUrl}>Tüm Yoklamalar <Icons.arrow /></a>
          </div>

          {data.sessions.length ? (
            <div className="lessonRows">
              {data.sessions.map((session) => {
                const params = new URLSearchParams({ date: data.date, time: session.startTime });
                if (session.branchId) params.set("branchId", session.branchId);
                const status = session.cancelled ? "İptal edildi · Yoklama gerekmiyor" : session.studentCount === 0 ? "Öğrenci yok"
                  : session.attendanceComplete ? "Yoklama kaydedildi"
                  : session.missingCount > 0 ? (session.attendanceCount > 0 ? `Kısmen kaydedildi · ${session.missingCount} eksik` : "Yoklama bekliyor")
                  : "Kayıt yenileme gerekiyor";
                const tone = session.cancelled ? "cancelled" : session.attendanceComplete ? "done" : session.missingCount > 0 ? "pending" : "neutral";
                return (
                  <Link className={`lessonRow${openedSession === session.id ? " isOpened" : ""}${openingSession === session.id ? " isOpening" : ""}`} href={session.cancelled ? "/telafi-yonetimi" : `/yoklama?${params.toString()}`} key={session.id}
                    onClick={(event) => {
                      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0) return;
                      setOpenedSession(session.id);
                      setOpeningSession(session.id);
                      try { sessionStorage.setItem(`sprintos:opened-attendance:${data.date}`, session.id); } catch {}
                    }}>

                    <div className="lessonTime"><Icons.clock /><strong>{session.startTime || "—"}</strong><small>{session.endTime || "Bitiş yok"}</small></div>
                    <div className="lessonInfo">
                      <strong>{session.groupName}</strong>
                      <span>{session.branchName} · {session.studentCount} öğrenci</span>
                      <div className="lessonGroups">{session.groups.filter((group) => group.studentCount > 0).map((group) => <span key={group.id}>{group.groupName.split(" · ").at(-1)} · {group.studentCount} öğrenci · {group.cancelled ? "Ders iptal edildi" : `Geldi ${group.statusCounts.present} / Gelmedi ${group.statusCounts.absent} / İzinli ${group.statusCounts.excused}`}</span>)}</div>
                      {!session.cancelled && <div className="lessonCounts">
                        <span className="present">Geldi {session.statusCounts.present}</span>
                        <span className="absent">Gelmedi {session.statusCounts.absent}</span>
                        <span className="excused">İzinli {session.statusCounts.excused}</span>
                        {session.notes.length > 0 && <span className="noted"><Icons.note />Not {session.notes.length}</span>}
                      </div>}
                      {Boolean(session.cancellation?.studentIds.length) && <div className="lessonCancellation">
                        <strong>{session.cancelled ? "Ders iptal edildi" : `${session.cancellation!.studentIds.length} kursiyer için iptal işlendi`}</strong>
                        {session.cancellation!.plannedStudentIds.length > 0 && <span>Toplu telafi planlandı · {session.cancellation!.plannedStudentIds.length} kursiyer</span>}
                        {session.cancellation!.reservedStudentIds.length > 0 && <span>Telafi hakkı saklı · {session.cancellation!.reservedStudentIds.length} kursiyer · Tarih bekleniyor</span>}
                        <span>{data.cancellationMessagesAvailable === false ? "Mesaj durumu yüklenemedi" : cancellationMessageLabel(session.cancellation!)}</span>
                        {session.cancellation!.reasons.length > 0 && <small>{session.cancellation!.reasons.join(" · ")}</small>}
                      </div>}
                      {session.blockedCount > 0 && <small className="lessonBlocked">{session.blockedCount} öğrencinin ders hakkı bitmiş</small>}
                    </div>
                    <div className={`lessonStatus ${tone}`}><span className="lessonStatusIcon">{session.cancelled || session.attendanceComplete ? <Icons.check /> : session.missingCount > 0 ? <Icons.clock /> : <Icons.users />}</span>{status}</div>
                    {(session.notes.length > 0 || !session.notesAvailable) && <div className="lessonNotes">
                      <strong><Icons.note />Bugünün Seans ve Yoklama Notları · {session.notes.length}</strong>
                      {session.notes.map((note) => <div className="lessonNote" key={note.id}>
                        <span>{note.title}{note.status === "completed" ? " · Tamamlandı" : ""}</span>
                        <p>{note.text}</p>
                      </div>)}
                      {!session.notesAvailable && <small>Seans notları yüklenemedi.</small>}
                    </div>}
                    {openingSession === session.id && <span className="lessonOpening" role="status">Seans açılıyor…</span>}
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="liveEmpty"><strong>Bugün planlı ders bulunmuyor.</strong><span>Ders programındaki aktif seanslar otomatik olarak burada görünür.</span></div>
          )}
        </article>

        <article className="livePanel prioritiesPanel">
          <div className="livePanelHead"><div><span>ÖNCELİKLER</span><h3>Yapılacak İşlemler</h3></div><a href="/bildirimler">Bildirimler <Icons.arrow /></a></div>
          <div className="priorityRows">
            {data.summary.pendingAttendance > 0 && <a href={pendingAttendanceUrl} className="priorityRow urgent"><i><Icons.bell /></i><div><strong>{data.summary.pendingAttendance} yoklama bekliyor</strong><span>Bugünkü seansları tamamlayın.</span></div><b>İşleme Git <Icons.arrow /></b></a>}
            {(Boolean(data.pastAttendance?.length) || Boolean(data.closedPastAttendance?.length)) && <section className="pastAttendancePanel" aria-label="Geçmiş yoklama takibi">
              <details className="pastAttendanceDetails">
                <summary>
                  <span className="pastHistoryIcon"><Icons.calendar /></span>
                  <span className="pastHistoryTitle"><strong>Geçmiş Yoklama Takibi</strong><small>Son {data.historyDays || 90} gün · Eksik seanslar</small></span>
                  <span className="pastHistoryCount">{data.pastAttendance?.length || 0}<small>bekleyen</small></span>
                  <span className="pastHistoryChevron" aria-hidden="true">⌄</span>
                </summary>
                <div className="pastAttendanceList">
                  {(data.pastAttendance || []).map(item => <article className="pastAttendanceCard" key={`${item.date}:${item.branchId}:${item.time}`}>
                    <div className="pastSlotHead"><span className="pastSlotDate"><Icons.calendar />{formatDisplayDate(new Date(`${item.date}T12:00:00`))}</span><span className="pastSlotTime"><Icons.clock />{item.time}</span></div>
                    <strong className="pastSlotBranch">{item.branchName}</strong>
                    <span className="pastSlotMissing">{item.missingCount} öğrencinin yoklaması eksik</span>
                    <div className="pastSlotActions">
                      <a href={item.href}>Yoklamaya Git <Icons.arrow /></a>
                      {data.canManagePastAttendance && <><button type="button" className="pastComplete" disabled={historyBusy !== null} onClick={() => updateHistory(item,"completed")}><Icons.check />Tamamlandı</button><button type="button" className="pastRemove" disabled={historyBusy !== null} onClick={() => updateHistory(item,"removed")}>Kaldır</button></>}
                    </div>
                    {historyBusy === JSON.stringify([item.date,item.branchId,item.time]) && <small role="status">Kaydediliyor…</small>}
                  </article>)}
                  {!data.pastAttendance?.length && <p className="pastAllDone"><Icons.check />Bekleyen geçmiş yoklama işlemi yok.</p>}
                </div>
                <p className="pastHistoryHelp">“Tamamlandı” takip işlemini kapatır; “Kaldır” uyarıyı listeden çıkarır. Yoklama girmek için “Yoklamaya Git”i kullanın.</p>
              </details>
              {Boolean(data.closedPastAttendance?.length) && <details className="pastClosedDetails"><summary>Kapatılan işlemler <span>{data.closedPastAttendance?.length}</span></summary><div className="pastClosedList">{data.closedPastAttendance?.map(item => <div className="pastClosedRow" key={`${item.date}:${item.branchId}:${item.time}`}><div><strong>{formatDisplayDate(new Date(`${item.date}T12:00:00`))} · {item.time}</strong><span>{item.branchName}</span><small className={item.status === "completed" ? "completed" : "removed"}>{item.status === "completed" ? "Takip tamamlandı" : "Listeden kaldırıldı"}</small></div>{data.canManagePastAttendance && <button type="button" disabled={historyBusy !== null} onClick={() => updateHistory(item,"open")}>Geri Al</button>}</div>)}</div></details>}
            </section>}
            {historyMessage && <p className="pastHistoryMessage" role="status">{historyMessage}</p>}
            {data.historyAvailable === false && <p role="status">Geçmiş yoklama kontrolü yüklenemedi. Bugünkü yoklamalar günceldir.</p>}
            {data.summary.pendingApprovals > 0 && <a href="/onay-merkezi" className="priorityRow warning"><i><Icons.approval /></i><div><strong>{data.summary.pendingApprovals} yönetici onayı bekliyor</strong><span>Bekleyen talepleri inceleyin.</span></div><b>İşleme Git <Icons.arrow /></b></a>}
            {data.summary.pendingCash > 0 && <a href="/kasa?durum=handoff_pending" className="priorityRow warning"><i><Icons.approval /></i><div><strong>{data.summary.pendingCash} kasa teslimi bekliyor</strong><span>Kasa onaylarını tamamlayın.</span></div><b>İşleme Git <Icons.arrow /></b></a>}
            {data.summary.openAlerts > 0 && <a href="/uyarilar" className="priorityRow urgent"><i><Icons.bell /></i><div><strong>{data.summary.openAlerts} açık uyarı var</strong><span>Öncelikli işlemleri kontrol edin.</span></div><b>İşleme Git <Icons.arrow /></b></a>}
            {data.summary.todayStartingStudents > 0 && <a href="/baslayacak-kursiyerler?filter=today#kursiyer-listesi" className="priorityRow info"><i><Icons.message /></i><div><strong>{data.summary.todayStartingStudents} kursiyer bugün başlayacak</strong><span>İlk dersine başlayacak kursiyerleri kontrol edin.</span></div><b>Aç <Icons.arrow /></b></a>}
            {data.summary.preRegistrations > 0 && <a href="/on-kayitlar" className="priorityRow info"><i><Icons.message /></i><div><strong>{data.summary.preRegistrations} ön kayıt takipte</strong><span>Geri dönüş bekleyen kayıtları görüntüleyin.</span></div><b>Aç <Icons.arrow /></b></a>}
            {actionCount === 0 && <div className="priorityRow success"><i><Icons.check /></i><div><strong>Operasyon düzenli</strong><span>Şu anda kritik bekleyen işlem görünmüyor.</span></div></div>}
          </div>
        </article>
      </div>

      <article className="livePanel birthdayPanel" id="sprint-birthdays">
        <div className="livePanelHead"><div><span>KURSİYER İLETİŞİMİ</span><h3><Icons.cake />Bugünün Doğum Günleri</h3></div><a href="/ogrenciler">Öğrenciler <Icons.arrow /></a></div>
        {data.birthdays.length ? (
          <div className="birthdayRows">
            {data.birthdays.map((birthday) => (
              <div className="birthdayRow" key={birthday.id}>
                <div className="birthdayAvatar"><Icons.cake /></div>
                <div><strong>{birthday.name}</strong><span>{birthday.age !== null ? `${birthday.age} yaş` : "Doğum günü"}{birthday.branchName ? ` · ${birthday.branchName}` : ""}</span></div>
                {birthday.celebrated ? (
                  <div className="birthdayCelebrated">
                    <strong>✓ Kutlandı</strong>
                    <span>{birthday.celebratedAt ? `Saat ${celebrationTime(birthday.celebratedAt)}` : "Kutlama kaydedildi"}</span>
                    {birthday.whatsappUrl ? <button type="button" onClick={() => celebrateBirthday(birthday)} disabled={celebrationBusy === birthday.id}>Tekrar Gönder</button> : null}
                  </div>
                ) : birthday.whatsappUrl ? (
                  <button type="button" onClick={() => celebrateBirthday(birthday)} disabled={celebrationBusy === birthday.id} className="birthdayWhatsapp">
                    <Icons.message /> {celebrationBusy === birthday.id ? "Kaydediliyor…" : "WhatsApp'tan Kutla"}
                  </button>
                ) : <span className="birthdayNoPhone">Telefon yok</span>}
              </div>
            ))}
          </div>
        ) : <div className="liveEmpty compact"><strong>Bugün doğum günü yok.</strong><span>Doğum tarihleri öğrenci dosyalarından otomatik kontrol edilir.</span></div>}
      </article>

      <style jsx global>{`
        .dashboardGrid .scheduleCard{display:none!important}.liveOpsShell{margin:18px 0 20px}.liveOpsHeadline{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;margin-bottom:13px}.liveOpsHeadline>div>span,.livePanelHead span{display:block;color:#6f829e;font-size:10px;font-weight:900;letter-spacing:1.45px}.liveOpsHeadline h2{margin:5px 0 4px;color:#10213e;font-size:24px;letter-spacing:-.4px}.liveOpsHeadline p{margin:0;color:#7b8ca4;font-size:12px}.liveOpsSignal{display:inline-flex;align-items:center;gap:8px;padding:9px 12px;border:1px solid #dce6f2;border-radius:999px;background:#fff;color:#52667f;text-decoration:none;font-size:11px;font-weight:900}.liveOpsSignal i{width:8px;height:8px;border-radius:50%;background:#22a06b}.liveOpsSignal.active{border-color:#fecaca;color:#b42318;background:#fff7f7}.liveOpsSignal.active i{background:#ef4444;box-shadow:0 0 0 0 rgba(239,68,68,.38);animation:sprintPulse 1.5s infinite}@keyframes sprintPulse{70%{box-shadow:0 0 0 8px rgba(239,68,68,0)}100%{box-shadow:0 0 0 0 rgba(239,68,68,0)}}.liveOpsSummary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-bottom:14px}.liveSummaryCard{position:relative;display:flex;flex-direction:column;min-height:112px;padding:15px;border:1px solid #dfe7f1;border-radius:17px;background:#fff;text-decoration:none;color:#172b49;box-shadow:0 7px 20px rgba(15,23,42,.035);transition:transform .16s ease,box-shadow .16s ease,border-color .16s ease}.liveSummaryCard:active{transform:scale(.98)}.liveSummaryCard:hover{transform:translateY(-2px);box-shadow:0 12px 28px rgba(22,54,91,.08)}.liveSummaryCard span{color:#74859c;font-size:11px;font-weight:800}.liveSummaryCard strong{margin-top:8px;font-size:29px;line-height:1}.liveSummaryCard small{margin-top:8px;color:#8796aa;font-size:10px}.liveSummaryCard>b{position:absolute;right:14px;bottom:13px;font-size:18px}.liveSummaryCard.blue{border-color:#bfdbfe}.liveSummaryCard.orange{border-color:#fed7aa;background:#fffaf4}.liveSummaryCard.green{border-color:#bbf7d0;background:#f8fffb}.liveSummaryCard.red{border-color:#fecaca;background:#fff8f8}.liveSummaryCard.purple{border-color:#ddd6fe;background:#fbfaff}.liveSummaryCard.calm{background:#fbfcfe}.liveOpsGrid{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(320px,.85fr);gap:14px;margin-bottom:14px}.livePanel{border:1px solid #dfe7f1;border-radius:20px;background:#fff;box-shadow:0 9px 26px rgba(15,23,42,.035);overflow:hidden}.livePanelHead{display:flex;justify-content:space-between;align-items:flex-start;gap:14px;padding:18px 19px;border-bottom:1px solid #edf1f6}.livePanelHead h3{margin:4px 0 0;color:#10213e;font-size:18px}.livePanelHead>a{color:#176de9;text-decoration:none;font-size:11px;font-weight:900}.lessonRows,.priorityRows,.birthdayRows{display:flex;flex-direction:column}.lessonRow{display:grid;grid-template-columns:74px minmax(0,1fr) auto 20px;gap:12px;align-items:center;padding:13px 18px;border-bottom:1px solid #edf1f6;color:inherit;text-decoration:none;transition:background .15s ease}.lessonRow:last-child{border-bottom:0}.lessonRow:hover,.lessonRow:active{background:#f8fbff}.lessonTime strong,.lessonInfo strong{display:block;color:#142847}.lessonTime strong{font-size:17px}.lessonTime small,.lessonInfo span{display:block;margin-top:3px;color:#8594a8;font-size:10px}.lessonStatus{display:inline-flex;align-items:center;gap:6px;padding:7px 9px;border-radius:999px;font-size:9px;font-weight:900;white-space:nowrap}.lessonStatus i,.priorityRow i{width:7px;height:7px;border-radius:50%}.lessonStatus.done{background:#ecfdf3;color:#16875b}.lessonStatus.done i{background:#22a06b}.lessonStatus.pending{background:#fff7ed;color:#b54708}.lessonStatus.pending i{background:#f79009}.lessonArrow{color:#9aa9bb}.priorityRows{gap:9px;padding:10px}.priorityRow{position:relative;display:grid;grid-template-columns:42px minmax(0,1fr) auto;gap:12px;align-items:center;padding:14px 14px;border:1px solid #e8eef5;border-radius:15px;text-decoration:none;color:inherit;background:#fff;overflow:hidden;transition:transform .16s ease,box-shadow .16s ease,border-color .16s ease}.priorityRow:last-child{border-bottom:1px solid #e8eef5}.priorityRow:hover{transform:translateY(-1px)}.priorityRow>i{position:relative;display:grid;place-items:center;width:38px;height:38px;border-radius:50%;font-style:normal;z-index:1}.priorityRow>i:before{content:"!";color:#fff;font-size:19px;font-weight:950;line-height:1}.priorityRow>i:after{content:"";position:absolute;inset:-6px;border-radius:50%;border:2px solid currentColor;opacity:.18;animation:priorityRing 1.45s ease-out infinite}.priorityRow strong{display:block;color:#1a2d49;font-size:12px;line-height:1.25}.priorityRow span{display:block;margin-top:4px;color:#76879c;font-size:9.5px;line-height:1.35}.priorityRow b{display:inline-flex;align-items:center;justify-content:center;min-height:31px;padding:0 10px;border-radius:10px;background:#eef5ff;color:#176de9;font-size:9px;white-space:nowrap}.priorityRow.urgent{border-color:#fecaca;background:linear-gradient(90deg,#fff7f7 0%,#fff 78%);box-shadow:0 7px 20px rgba(239,68,68,.10);animation:priorityUrgentGlow 1.7s ease-in-out infinite}.priorityRow.urgent>i{background:#ef4444;color:#ef4444;box-shadow:0 0 0 0 rgba(239,68,68,.28)}.priorityRow.urgent strong{color:#b42318;font-size:12.5px}.priorityRow.urgent b{background:#fee2e2;color:#c81e1e}.priorityRow.warning{border-color:#fde3b0;background:linear-gradient(90deg,#fffaf0 0%,#fff 78%);box-shadow:0 7px 18px rgba(245,158,11,.08);animation:priorityWarningGlow 2s ease-in-out infinite}.priorityRow.warning>i{background:#f59e0b;color:#f59e0b}.priorityRow.warning strong{color:#9a5b00}.priorityRow.warning b{background:#fff3d6;color:#a86100}.priorityRow.info>i{background:#3b82f6;color:#3b82f6}.priorityRow.info>i:before{content:"i";font-size:16px}.priorityRow.info>i:after{animation:none}.priorityRow.success>i{background:#22a06b;color:#22a06b}.priorityRow.success>i:before{content:"✓";font-size:15px}.priorityRow.success>i:after{animation:none}@keyframes priorityRing{0%{transform:scale(.82);opacity:.35}75%,100%{transform:scale(1.55);opacity:0}}@keyframes priorityUrgentGlow{0%,100%{box-shadow:0 7px 20px rgba(239,68,68,.08);border-color:#fecaca}50%{box-shadow:0 8px 25px rgba(239,68,68,.20);border-color:#f87171}}@keyframes priorityWarningGlow{0%,100%{box-shadow:0 7px 18px rgba(245,158,11,.06);border-color:#fde3b0}50%{box-shadow:0 8px 22px rgba(245,158,11,.16);border-color:#fbbf24}}@media(prefers-reduced-motion:reduce){.priorityRow.urgent,.priorityRow.warning,.priorityRow>i:after{animation:none!important}}.liveEmpty{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:180px;padding:25px;text-align:center}.liveEmpty.compact{min-height:105px}.liveEmpty strong{color:#223652;font-size:13px}.liveEmpty span{max-width:440px;margin-top:6px;color:#8a99ac;font-size:10px;line-height:1.5}.birthdayRow{display:grid;grid-template-columns:44px minmax(0,1fr) auto;gap:12px;align-items:center;padding:13px 18px;border-bottom:1px solid #edf1f6}.birthdayRow:last-child{border-bottom:0}.birthdayAvatar{display:grid;place-items:center;width:42px;height:42px;border-radius:14px;background:#fff7ed;font-size:20px}.birthdayRow strong{display:block;color:#17304f;font-size:12px}.birthdayRow span{display:block;margin-top:3px;color:#8493a6;font-size:9px}.birthdayWhatsapp{display:inline-flex;align-items:center;justify-content:center;min-height:35px;padding:0 11px;border:0;border-radius:10px;background:#ecfdf3;color:#16875b;text-decoration:none;font:inherit;font-size:9px;font-weight:900;cursor:pointer}.birthdayWhatsapp:disabled{opacity:.65;cursor:wait}.birthdayCelebrated{display:flex;align-items:flex-end;flex-direction:column;gap:3px}.birthdayCelebrated>strong{color:#16875b!important;font-size:10px!important}.birthdayCelebrated>span{margin:0!important;color:#6f8c7d!important;font-size:8px!important}.birthdayCelebrated>button{border:0;background:transparent;color:#176de9;font:inherit;font-size:8px;font-weight:900;cursor:pointer;padding:2px 0}.birthdayNoPhone{color:#94a3b8;font-size:9px}.liveOpsLoading{padding:18px;border:1px solid #dfe7f1;border-radius:16px;background:#fff;color:#718096;font-size:11px}@media(max-width:900px){.liveOpsSummary{grid-template-columns:repeat(2,minmax(0,1fr))}.liveOpsGrid{grid-template-columns:1fr}}@media(max-width:640px){.liveOpsShell{margin:14px 0 18px}.liveOpsHeadline{align-items:flex-start}.liveOpsHeadline h2{font-size:20px}.liveOpsHeadline p{font-size:10px;line-height:1.45}.liveOpsSignal{padding:7px 9px;font-size:9px}.liveOpsSummary{gap:9px}.liveSummaryCard{min-height:103px;padding:13px}.liveSummaryCard strong{font-size:25px}.livePanel{border-radius:17px}.livePanelHead{padding:15px}.livePanelHead h3{font-size:16px}.lessonRow{grid-template-columns:58px minmax(0,1fr) 18px;padding:12px 14px;gap:9px}.lessonStatus{grid-column:2/4;justify-self:start}.lessonTime strong{font-size:15px}.birthdayRow{grid-template-columns:40px minmax(0,1fr);padding:12px 14px}.birthdayWhatsapp,.birthdayNoPhone,.birthdayCelebrated{grid-column:2;justify-self:start}.birthdayCelebrated{align-items:flex-start}.priorityRows{padding:9px;gap:8px}.priorityRow{grid-template-columns:38px minmax(0,1fr);padding:12px;gap:10px}.priorityRow>i{width:34px;height:34px}.priorityRow b{grid-column:2;justify-self:start;margin-top:4px;min-height:29px}.priorityRow strong{font-size:11.5px}.priorityRow.urgent strong{font-size:12px}}

        .lessonRows{gap:10px;padding:12px;background:#f8fbff}
        .lessonRow{grid-template-columns:66px minmax(0,1fr);gap:10px 14px;padding:16px;border:1px solid #e0e9f5;border-radius:16px;background:#fff;box-shadow:0 5px 16px rgba(22,54,91,.035)}
        .lessonRow:last-child{border-bottom:1px solid #e0e9f5}
        .lessonRow:hover{border-color:#b9d4f8;box-shadow:0 8px 22px rgba(22,54,91,.08)}
        .lessonRow:focus-visible{outline:3px solid #176de9;outline-offset:2px}
        .lessonTime{grid-row:1/3;align-self:start;display:grid;gap:5px;padding:12px 5px;text-align:center;border-radius:14px;background:#eef5ff}
        .lessonTime small{margin:0}.lessonInfo{min-width:0}.lessonInfo>strong{font-size:13px;line-height:1.45;overflow-wrap:anywhere}
        .lessonGroups{display:grid;gap:5px;margin-top:8px}.lessonGroups>span{padding:6px 8px;border-radius:8px;background:#f1f5fb;color:#47617f;font-size:10px;line-height:1.5}
        .lessonCancellation{display:grid;gap:5px;margin-top:9px;padding:10px 12px;border:1px solid #ddd6fe;border-radius:10px;background:#f5f3ff}.lessonCancellation strong{color:#6d28d9;font-size:11px}.lessonCancellation span{margin:0;color:#5b4879;font-size:10px}.lessonCancellation small{color:#76678b;font-size:9px}.lessonStatus.cancelled{background:#f3e8ff;color:#7e22ce}
        .lessonCounts{display:flex;flex-wrap:wrap;gap:5px;margin-top:9px}.lessonCounts span{margin:0;padding:4px 7px;border-radius:7px;font-size:10px;font-weight:800}
        .lessonCounts .present{color:#16875b;background:#ecfdf3}.lessonCounts .absent{color:#b42333;background:#fff0f2}.lessonCounts .excused{color:#8a6200;background:#fff8e8}
        .lessonBlocked{display:block;margin-top:7px;color:#8a6200;font-size:10px}
        .lessonsPanel .livePanelHead{align-items:center}.lessonsPanel .livePanelHead>a{flex-shrink:0;padding:9px;border:1px solid #d5e4fa;border-radius:10px}
        .lessonCounts .noted{display:inline-flex;align-items:center;gap:5px;color:#7050ad;background:#f3edff}.lessonCounts .noted svg{width:13px;height:13px}
        .lessonOpening{grid-column:2;color:#176de9;font-size:11px;font-weight:800}
        .lessonStatus{grid-column:2;justify-self:start;white-space:normal;line-height:1.4}
        .lessonStatus.neutral{background:#f1f5f9;color:#64748b}.lessonStatus.neutral i{background:#94a3b8}
        @media(max-width:640px){.lessonRows{padding:9px}.lessonRow{grid-template-columns:58px minmax(0,1fr);padding:13px;gap:9px 11px}.lessonTime strong{font-size:15px}.lessonInfo>strong{font-size:12px}.lessonsPanel .livePanelHead{flex-wrap:wrap}}

        .liveSummaryLabel{display:flex;align-items:center;gap:8px}.liveSummaryLabel svg{width:21px;height:21px;flex-shrink:0;color:#176de9}
        .liveSummaryCard.orange .liveSummaryLabel svg{color:#c56a13}.liveSummaryCard.green .liveSummaryLabel svg{color:#16875b}.liveSummaryCard.purple .liveSummaryLabel svg{color:#8154c7}.liveSummaryCard.red .liveSummaryLabel svg{color:#d03e45}
        .liveArrowIcon{display:grid;place-items:center;width:29px;height:29px;border:1px solid #dce7f4;border-radius:9px;background:#f4f8fd}.liveArrowIcon svg{width:16px;height:16px}
        .livePanelHead>a,.priorityRow b,.birthdayWhatsapp{display:inline-flex;align-items:center;gap:7px}.livePanelHead>a svg,.priorityRow b svg{width:15px;height:15px;flex-shrink:0}
        .lessonTime>svg{width:17px;height:17px;margin:0 auto;color:#4c85d6}.lessonStatusIcon{display:flex}.lessonStatusIcon svg{width:14px;height:14px;flex-shrink:0}
        .priorityRow>i:before,.priorityRow>i:after{content:none;animation:none}.priorityRow>i{border-radius:12px;box-shadow:none}.priorityRow>i svg{width:21px;height:21px;color:#fff}
        .birthdayPanel h3{display:flex;align-items:center;gap:8px}.birthdayPanel h3 svg{width:21px;height:21px;color:#bf7b20}.birthdayAvatar svg{width:24px;height:24px;color:#bf7b20}.birthdayWhatsapp svg{width:16px;height:16px}

        .lessonRow{cursor:pointer;transition:background .18s ease,border-color .18s ease,box-shadow .18s ease,transform .18s ease}
        .lessonRow:hover,.lessonRow:focus-visible,.lessonRow.isOpened{background:#f0f7ff;border-color:#75aff5;box-shadow:0 0 0 2px rgba(23,109,233,.10),0 9px 24px rgba(23,109,233,.12)}
        .lessonRow:active{background:#e1efff;transform:scale(.99)}.lessonRow.isOpening{animation:lessonOpenGlow .75s ease-in-out infinite}
        @keyframes lessonOpenGlow{50%{box-shadow:0 0 0 4px rgba(23,109,233,.16),0 9px 28px rgba(23,109,233,.2)}}
        .lessonNotes{grid-column:2;min-width:0;padding:11px 12px;border:1px solid #d8e5f6;border-radius:12px;background:#f7faff}
        .lessonNotes>strong{display:flex;align-items:center;gap:6px;font-size:11px;color:#325982}.lessonNotes>strong svg{width:15px;height:15px;flex-shrink:0}
        .lessonNote{margin-top:9px}.lessonNote>span{font-size:10px;font-weight:800;color:#6a7f99}.lessonNote p{margin:4px 0 0;color:#243d5c;font-size:11px;line-height:1.6;white-space:pre-line;overflow-wrap:anywhere}.lessonNotes>small{display:block;margin-top:7px;color:#8b650c}
        @media(prefers-reduced-motion:reduce){.lessonRow,.lessonRow.isOpening{animation:none;transition:none}.lessonRow:active{transform:none}}

        .pastAttendancePanel{border:1px solid #dbe5f2;border-radius:16px;background:linear-gradient(135deg,#f5f8ff,#fff);overflow:hidden}
        .pastAttendanceDetails>summary{display:flex;align-items:center;gap:10px;padding:15px;cursor:pointer;list-style:none}
        .pastAttendanceDetails>summary::-webkit-details-marker,.pastClosedDetails>summary::-webkit-details-marker{display:none}
        .pastHistoryIcon{display:grid;place-items:center;width:38px;height:38px;border-radius:12px;background:#e7efff;color:#3469ca;flex-shrink:0}.pastHistoryIcon svg{width:21px;height:21px}
        .pastHistoryTitle{flex:1;min-width:0}.pastHistoryTitle strong{display:block;color:#203858;font-size:13px;line-height:1.5}.pastHistoryTitle small{display:block;margin-top:3px;color:#7a8ba4;font-size:10px}
        .pastHistoryCount{display:grid;gap:2px;min-width:44px;padding:7px;border-radius:10px;background:#fff0dc;text-align:center;color:#a55e0a;font-size:19px;font-weight:900}.pastHistoryCount small{font-size:9px;font-weight:700}
        .pastHistoryChevron{color:#6d85a8;font-size:23px;transition:transform .15s}.pastAttendanceDetails[open] .pastHistoryChevron{transform:rotate(180deg)}
        .pastAttendanceList{display:grid;gap:10px;padding:0 12px 12px}.pastAttendanceCard{padding:14px;border:1px solid #e0e8f3;border-radius:13px;background:#fff;box-shadow:0 3px 10px #19375606}
        .pastSlotHead{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap}.pastSlotDate,.pastSlotTime{display:inline-flex;align-items:center;gap:6px;font-size:11px;font-weight:800;color:#4d6587}.pastSlotHead svg{width:14px;height:14px}.pastSlotTime{padding:5px 8px;border-radius:7px;background:#eef4ff;color:#2765bb}
        .pastSlotBranch{display:block;margin-top:10px;color:#1b3153;font-size:13px;line-height:1.5;overflow-wrap:anywhere}.pastSlotMissing{display:inline-block;margin-top:7px;padding:5px 8px;border-radius:7px;background:#fff7e8;color:#a06413;font-size:10px;font-weight:700}
        .pastSlotActions{display:flex;align-items:center;gap:7px;flex-wrap:wrap;margin-top:13px;padding-top:11px;border-top:1px solid #edf1f6}.pastSlotActions a,.pastSlotActions button,.pastClosedRow button{display:inline-flex;align-items:center;justify-content:center;gap:5px;min-height:36px;padding:7px 10px;border:1px solid #dbe5f2;border-radius:9px;font:inherit;font-size:10px;font-weight:800;cursor:pointer;text-decoration:none;background:#f8faff;color:#2765bb}.pastSlotActions svg{width:14px;height:14px}.pastSlotActions a{margin-right:auto;background:#eaf2ff;border-color:#d0e2fc}.pastSlotActions .pastComplete{color:#17835c;background:#effbf5;border-color:#ceeedc}.pastSlotActions .pastRemove{color:#7b5360;background:#fff8f9;border-color:#f0dfe3}.pastSlotActions button:disabled,.pastClosedRow button:disabled{opacity:.5;cursor:wait}
        .pastAttendanceCard>small{display:block;margin-top:7px;color:#6d85a8;font-size:10px}.pastHistoryHelp{margin:0;padding:0 15px 14px;color:#7a8ba4;font-size:10px;line-height:1.7}.pastClosedDetails{border-top:1px solid #e0e8f3;background:#fbfcfe}.pastClosedDetails>summary{display:flex;align-items:center;gap:7px;padding:12px 15px;font-size:11px;font-weight:800;color:#73839b;cursor:pointer;list-style:none}.pastClosedDetails>summary span{background:#edf1f6;border-radius:6px;padding:2px 6px}.pastClosedList{padding:0 12px 12px;display:grid;gap:7px}.pastClosedRow{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:11px;border:1px solid #e4eaf3;border-radius:10px;background:#fff}.pastClosedRow>div{min-width:0}.pastClosedRow strong{display:block;color:#4d6587;font-size:11px}.pastClosedRow span{display:block;margin-top:4px;color:#7a8ba4;font-size:10px;overflow-wrap:anywhere}.pastClosedRow small{display:inline-block;margin-top:6px;font-size:9px;color:#17835c}.pastClosedRow small.removed{color:#8a7180}.pastClosedRow button{flex-shrink:0}.pastAllDone{display:flex;align-items:center;gap:7px;color:#17835c;font-size:11px}.pastAllDone svg{width:16px;height:16px}.pastHistoryMessage{margin:0;padding:10px 12px;border-radius:10px;background:#f0f5ff;color:#35557c;font-size:11px;line-height:1.5}
        .pastAttendancePanel summary:focus-visible,.pastSlotActions a:focus-visible,.pastSlotActions button:focus-visible,.pastClosedRow button:focus-visible{outline:3px solid #176de9;outline-offset:2px}
        @media(max-width:400px){.pastAttendanceDetails>summary{padding:12px;gap:8px}.pastHistoryTitle strong{font-size:12px}.pastHistoryIcon{width:32px;height:32px}.pastSlotActions a{flex-basis:100%;margin-right:0}.pastSlotActions button{flex:1}}
      `}</style>
    </section>
  );
}

export default function DashboardLiveOperations() {
  const pathname = usePathname();
  const [host, setHost] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (pathname !== "/") {
      setHost(null);
      return;
    }

    let cancelled = false;
    let frame = 0;
    let attempts = 0;

    function attach() {
      if (cancelled) return;
      const stats = document.querySelector(".dashboardContent .proStats");
      if (stats instanceof HTMLElement) {
        let target = document.getElementById("sprint-live-operations-host");
        if (!(target instanceof HTMLElement)) {
          target = document.createElement("div");
          target.id = "sprint-live-operations-host";
          stats.insertAdjacentElement("afterend", target);
        }
        setHost(target);
        return;
      }
      attempts += 1;
      if (attempts < 30) frame = window.requestAnimationFrame(attach);
    }

    frame = window.requestAnimationFrame(attach);
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
      const target = document.getElementById("sprint-live-operations-host");
      if (target?.parentNode) target.parentNode.removeChild(target);
      setHost(null);
    };
  }, [pathname]);

  if (pathname !== "/" || !host) return null;
  return createPortal(<OperationPanel />, host);
}

