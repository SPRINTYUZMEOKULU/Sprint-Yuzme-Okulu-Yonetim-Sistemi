"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { Icons } from "@/app/components/dashboard-icons";
import DashboardSmartCalendar from "@/app/components/dashboard-smart-calendar";

 type LiveData = {
  ok: boolean;
  date: string;
  sessions: Array<{
    id: string;
    branchId: string | null;
    branchName: string;
    groupId: string | null;
    groupName: string;
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
  const [celebrationBusy, setCelebrationBusy] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const response = await fetch("/api/dashboard/live", { cache: "no-store" });
        const result = (await response.json()) as LiveData;
        if (active && response.ok && result.ok) setData(result);
      } catch (error) {
        console.error("SprintOS canlı operasyon:", error);
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    const refresh = () => { if (document.visibilityState === "visible") void load(); };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    const timer = window.setInterval(refresh, 30000);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);

  useEffect(() => {
    if (!data?.date) return;
    try { setOpenedSession(sessionStorage.getItem(`sprintos:opened-attendance:${data.date}`)); } catch {}
  }, [data?.date]);

  const actionCount = useMemo(() => {
    if (!data) return 0;
    return data.summary.pendingAttendance + data.summary.pendingApprovals + data.summary.pendingCash + data.summary.openAlerts + data.summary.todayStartingStudents;
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

  if (loading) {
    return <section className="liveOpsShell"><div className="liveOpsLoading">Günlük operasyon verileri hazırlanıyor…</div></section>;
  }

  if (!data) return null;

  const summaryCards = [
    { label: "Bugünkü Ders", value: data.summary.todayLessons, note: "Planlanan seans", href: "/ders-programi", tone: "blue", icon: Icons.calendar },
    { label: "Yoklama Bekleyen", value: data.summary.pendingAttendance, note: data.summary.pendingAttendance ? "İşlem bekliyor" : "Tamamlandı", href: "/yoklama", tone: data.summary.pendingAttendance ? "orange" : "green", icon: Icons.check },
    { label: "Doğum Günü", value: data.summary.birthdays, note: data.summary.birthdays ? "Kutlama bekliyor" : "Bugün yok", href: "#sprint-birthdays", tone: data.summary.birthdays ? "purple" : "calm", icon: Icons.cake },
    { label: "Yapılacak İşlem", value: actionCount, note: actionCount ? "Önceliklerinizi kontrol edin" : "Her şey yolunda", href: "/uyarilar", tone: actionCount ? "red" : "green", icon: Icons.bell },
  ];

  return (
    <section className="liveOpsShell">
      <div className="liveOpsHeadline">
        <div>
          <span>CANLI OPERASYON</span>
          <h2>Bugün ne yapılması gerekiyor?</h2>
          <p>Ders, yoklama, doğum günü ve bekleyen işlemler tek ekranda canlı takip edilir.</p>
        </div>
        <a href="/bildirimler" className={actionCount ? "liveOpsSignal active" : "liveOpsSignal"}>
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
            <a href="/yoklama">Tüm Yoklamalar <Icons.arrow /></a>
          </div>

          {data.sessions.length ? (
            <div className="lessonRows">
              {data.sessions.map((session) => {
                const params = new URLSearchParams({ date: data.date, time: session.startTime, scheduleId: session.id });
                if (session.branchId) params.set("branchId", session.branchId);
                const status = session.studentCount === 0 ? "Öğrenci yok"
                  : session.attendanceComplete ? "Yoklama kaydedildi"
                  : session.missingCount > 0 ? (session.attendanceCount > 0 ? `Kısmen kaydedildi · ${session.missingCount} eksik` : "Yoklama bekliyor")
                  : "Kayıt yenileme gerekiyor";
                const tone = session.attendanceComplete ? "done" : session.missingCount > 0 ? "pending" : "neutral";
                return (
                  <Link className={`lessonRow${openedSession === session.id ? " isOpened" : ""}${openingSession === session.id ? " isOpening" : ""}`} href={`/yoklama?${params.toString()}#seans-${session.id}`} key={session.id}
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
                      <div className="lessonCounts">
                        <span className="present">Geldi {session.statusCounts.present}</span>
                        <span className="absent">Gelmedi {session.statusCounts.absent}</span>
                        <span className="excused">İzinli {session.statusCounts.excused}</span>
                      </div>
                      {session.blockedCount > 0 && <small className="lessonBlocked">{session.blockedCount} öğrencinin ders hakkı bitmiş</small>}
                    </div>
                    <div className={`lessonStatus ${tone}`}><span className="lessonStatusIcon">{session.attendanceComplete ? <Icons.check /> : session.missingCount > 0 ? <Icons.clock /> : <Icons.users />}</span>{status}</div>
                    {(session.notes.length > 0 || !session.notesAvailable) && <div className="lessonNotes">
                      <strong><Icons.note />Yoklama Notları · {session.notes.length}</strong>
                      {session.notes.map((note) => <div className="lessonNote" key={note.id}>
                        <span>{note.title}{note.status === "completed" ? " · Tamamlandı" : ""}</span>
                        <p>{note.text}</p>
                      </div>)}
                      {!session.notesAvailable && <small>Seans notları yüklenemedi.</small>}
                    </div>}
                    <span className="lessonAction" aria-live="polite">{openingSession === session.id ? "Açılıyor…" : openedSession === session.id ? "Son Açılan Seans" : "Kartı Aç"}<Icons.arrow /></span>
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
            {data.summary.pendingAttendance > 0 && <a href="/yoklama" className="priorityRow urgent"><i><Icons.bell /></i><div><strong>{data.summary.pendingAttendance} yoklama bekliyor</strong><span>Bugünkü seansları tamamlayın.</span></div><b>İşleme Git <Icons.arrow /></b></a>}
            {data.summary.pendingApprovals > 0 && <a href="/onay-merkezi" className="priorityRow warning"><i><Icons.approval /></i><div><strong>{data.summary.pendingApprovals} yönetici onayı bekliyor</strong><span>Bekleyen talepleri inceleyin.</span></div><b>İşleme Git <Icons.arrow /></b></a>}
            {data.summary.pendingCash > 0 && <a href="/kasa" className="priorityRow warning"><i><Icons.approval /></i><div><strong>{data.summary.pendingCash} kasa teslimi bekliyor</strong><span>Kasa onaylarını tamamlayın.</span></div><b>İşleme Git <Icons.arrow /></b></a>}
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
        .lessonCounts{display:flex;flex-wrap:wrap;gap:5px;margin-top:9px}.lessonCounts span{margin:0;padding:4px 7px;border-radius:7px;font-size:10px;font-weight:800}
        .lessonCounts .present{color:#16875b;background:#ecfdf3}.lessonCounts .absent{color:#b42333;background:#fff0f2}.lessonCounts .excused{color:#8a6200;background:#fff8e8}
        .lessonBlocked{display:block;margin-top:7px;color:#8a6200;font-size:10px}
        .lessonStatus{grid-column:2;justify-self:start;white-space:normal;line-height:1.4}
        .lessonStatus.neutral{background:#f1f5f9;color:#64748b}.lessonStatus.neutral i{background:#94a3b8}
        .lessonAction{grid-column:2;justify-self:end;display:inline-flex;align-items:center;gap:9px;min-height:36px;padding:7px 11px;border:1px solid #c8ddfa;border-radius:10px;background:#f2f7ff;color:#176de9;font-size:11px;font-weight:900}
        .lessonAction b{font-size:16px}.lessonsPanel .livePanelHead{align-items:center}.lessonsPanel .livePanelHead>a{flex-shrink:0;padding:9px;border:1px solid #d5e4fa;border-radius:10px}
        @media(max-width:640px){.lessonRows{padding:9px}.lessonRow{grid-template-columns:58px minmax(0,1fr);padding:13px;gap:9px 11px}.lessonTime strong{font-size:15px}.lessonInfo>strong{font-size:12px}.lessonsPanel .livePanelHead{flex-wrap:wrap}}

        .liveSummaryLabel{display:flex;align-items:center;gap:8px}.liveSummaryLabel svg{width:21px;height:21px;flex-shrink:0;color:#176de9}
        .liveSummaryCard.orange .liveSummaryLabel svg{color:#c56a13}.liveSummaryCard.green .liveSummaryLabel svg{color:#16875b}.liveSummaryCard.purple .liveSummaryLabel svg{color:#8154c7}.liveSummaryCard.red .liveSummaryLabel svg{color:#d03e45}
        .liveArrowIcon{display:grid;place-items:center;width:29px;height:29px;border:1px solid #dce7f4;border-radius:9px;background:#f4f8fd}.liveArrowIcon svg{width:16px;height:16px}
        .livePanelHead>a,.priorityRow b,.birthdayWhatsapp{display:inline-flex;align-items:center;gap:7px}.livePanelHead>a svg,.priorityRow b svg{width:15px;height:15px;flex-shrink:0}
        .lessonTime>svg{width:17px;height:17px;margin:0 auto;color:#4c85d6}.lessonStatusIcon{display:flex}.lessonStatusIcon svg{width:14px;height:14px;flex-shrink:0}.lessonAction>svg{width:17px;height:17px;flex-shrink:0}
        .priorityRow>i:before,.priorityRow>i:after{content:none;animation:none}.priorityRow>i{border-radius:12px;box-shadow:none}.priorityRow>i svg{width:21px;height:21px;color:#fff}
        .birthdayPanel h3{display:flex;align-items:center;gap:8px}.birthdayPanel h3 svg{width:21px;height:21px;color:#bf7b20}.birthdayAvatar svg{width:24px;height:24px;color:#bf7b20}.birthdayWhatsapp svg{width:16px;height:16px}

        .lessonRow{cursor:pointer;transition:background .18s ease,border-color .18s ease,box-shadow .18s ease,transform .18s ease}
        .lessonRow:hover,.lessonRow:focus-visible,.lessonRow.isOpened{background:#f0f7ff;border-color:#75aff5;box-shadow:0 0 0 2px rgba(23,109,233,.10),0 9px 24px rgba(23,109,233,.12)}
        .lessonRow:active{background:#e1efff;transform:scale(.99)}.lessonRow.isOpening{animation:lessonOpenGlow .75s ease-in-out infinite}
        @keyframes lessonOpenGlow{50%{box-shadow:0 0 0 4px rgba(23,109,233,.16),0 9px 28px rgba(23,109,233,.2)}}
        .lessonRow.isOpened .lessonAction{background:#176de9;border-color:#176de9;color:#fff}
        .lessonNotes{grid-column:2;min-width:0;padding:11px 12px;border:1px solid #d8e5f6;border-radius:12px;background:#f7faff}
        .lessonNotes>strong{display:flex;align-items:center;gap:6px;font-size:11px;color:#325982}.lessonNotes>strong svg{width:15px;height:15px;flex-shrink:0}
        .lessonNote{margin-top:9px}.lessonNote>span{font-size:10px;font-weight:800;color:#6a7f99}.lessonNote p{margin:4px 0 0;color:#243d5c;font-size:11px;line-height:1.6;white-space:pre-line;overflow-wrap:anywhere}.lessonNotes>small{display:block;margin-top:7px;color:#8b650c}
        @media(prefers-reduced-motion:reduce){.lessonRow,.lessonRow.isOpening{animation:none;transition:none}.lessonRow:active{transform:none}}
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
