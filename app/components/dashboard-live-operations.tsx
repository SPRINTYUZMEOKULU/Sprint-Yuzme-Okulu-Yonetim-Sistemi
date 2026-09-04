"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";

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
  }>;
  birthdays: Array<{
    id: string;
    name: string;
    age: number | null;
    branchName: string;
    whatsappUrl: string | null;
  }>;
  summary: {
    todayLessons: number;
    pendingAttendance: number;
    birthdays: number;
    pendingApprovals: number;
    pendingCash: number;
    openAlerts: number;
    preRegistrations: number;
  };
};

function OperationPanel() {
  const [data, setData] = useState<LiveData | null>(null);
  const [loading, setLoading] = useState(true);

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
    const timer = window.setInterval(load, 60000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  const actionCount = useMemo(() => {
    if (!data) return 0;
    return data.summary.pendingAttendance + data.summary.pendingApprovals + data.summary.pendingCash + data.summary.openAlerts;
  }, [data]);

  if (loading) {
    return <section className="liveOpsShell"><div className="liveOpsLoading">Günlük operasyon verileri hazırlanıyor…</div></section>;
  }

  if (!data) return null;

  const summaryCards = [
    { label: "Bugünkü Ders", value: data.summary.todayLessons, note: "Planlanan seans", href: "/ders-programi", tone: "blue" },
    { label: "Yoklama Bekleyen", value: data.summary.pendingAttendance, note: data.summary.pendingAttendance ? "İşlem bekliyor" : "Tamamlandı", href: "/yoklama", tone: data.summary.pendingAttendance ? "orange" : "green" },
    { label: "Doğum Günü", value: data.summary.birthdays, note: data.summary.birthdays ? "Kutlama bekliyor" : "Bugün yok", href: "#sprint-birthdays", tone: data.summary.birthdays ? "purple" : "calm" },
    { label: "Yapılacak İşlem", value: actionCount, note: actionCount ? "Önceliklerinizi kontrol edin" : "Her şey yolunda", href: "/uyarilar", tone: actionCount ? "red" : "green" },
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

      <div className="liveOpsSummary">
        {summaryCards.map((item) => (
          <a key={item.label} href={item.href} className={`liveSummaryCard ${item.tone}`}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
            <small>{item.note}</small>
            <b>→</b>
          </a>
        ))}
      </div>

      <div className="liveOpsGrid">
        <article className="livePanel lessonsPanel">
          <div className="livePanelHead">
            <div><span>GÜNLÜK PROGRAM</span><h3>Bugünkü Dersler ve Yoklamalar</h3></div>
            <a href="/yoklama">Tüm Yoklamalar →</a>
          </div>

          {data.sessions.length ? (
            <div className="lessonRows">
              {data.sessions.map((session) => (
                <a className="lessonRow" href="/yoklama" key={session.id}>
                  <div className="lessonTime"><strong>{session.startTime || "—"}</strong><small>{session.endTime ? `${session.endTime}'e kadar` : "Ders"}</small></div>
                  <div className="lessonInfo"><strong>{session.groupName}</strong><span>{session.branchName} · {session.studentCount} öğrenci</span></div>
                  <div className={session.attendanceComplete ? "lessonStatus done" : "lessonStatus pending"}>
                    <i /> {session.attendanceComplete ? "Yoklama tamamlandı" : `Yoklama bekliyor · ${session.attendanceCount}/${session.studentCount}`}
                  </div>
                  <b className="lessonArrow">→</b>
                </a>
              ))}
            </div>
          ) : (
            <div className="liveEmpty"><strong>Bugün planlı ders bulunmuyor.</strong><span>Ders programındaki aktif seanslar otomatik olarak burada görünür.</span></div>
          )}
        </article>

        <article className="livePanel prioritiesPanel">
          <div className="livePanelHead"><div><span>ÖNCELİKLER</span><h3>Yapılacak İşlemler</h3></div><a href="/bildirimler">Bildirimler →</a></div>
          <div className="priorityRows">
            {data.summary.pendingAttendance > 0 && <a href="/yoklama" className="priorityRow urgent"><i /><div><strong>{data.summary.pendingAttendance} yoklama bekliyor</strong><span>Bugünkü seansları tamamlayın.</span></div><b>İşleme Git →</b></a>}
            {data.summary.pendingApprovals > 0 && <a href="/onay-merkezi" className="priorityRow warning"><i /><div><strong>{data.summary.pendingApprovals} yönetici onayı bekliyor</strong><span>Bekleyen talepleri inceleyin.</span></div><b>İşleme Git →</b></a>}
            {data.summary.pendingCash > 0 && <a href="/kasa" className="priorityRow warning"><i /><div><strong>{data.summary.pendingCash} kasa teslimi bekliyor</strong><span>Kasa onaylarını tamamlayın.</span></div><b>İşleme Git →</b></a>}
            {data.summary.openAlerts > 0 && <a href="/uyarilar" className="priorityRow urgent"><i /><div><strong>{data.summary.openAlerts} açık uyarı var</strong><span>Öncelikli işlemleri kontrol edin.</span></div><b>İşleme Git →</b></a>}
            {data.summary.preRegistrations > 0 && <a href="/on-kayitlar" className="priorityRow info"><i /><div><strong>{data.summary.preRegistrations} ön kayıt takipte</strong><span>Geri dönüş bekleyen kayıtları görüntüleyin.</span></div><b>Aç →</b></a>}
            {actionCount === 0 && <div className="priorityRow success"><i /><div><strong>Operasyon düzenli</strong><span>Şu anda kritik bekleyen işlem görünmüyor.</span></div></div>}
          </div>
        </article>
      </div>

      <article className="livePanel birthdayPanel" id="sprint-birthdays">
        <div className="livePanelHead"><div><span>KURSİYER İLETİŞİMİ</span><h3>🎂 Bugünün Doğum Günleri</h3></div><a href="/ogrenciler">Öğrenciler →</a></div>
        {data.birthdays.length ? (
          <div className="birthdayRows">
            {data.birthdays.map((birthday) => (
              <div className="birthdayRow" key={birthday.id}>
                <div className="birthdayAvatar">🎂</div>
                <div><strong>{birthday.name}</strong><span>{birthday.age !== null ? `${birthday.age} yaş` : "Doğum günü"}{birthday.branchName ? ` · ${birthday.branchName}` : ""}</span></div>
                {birthday.whatsappUrl ? <a href={birthday.whatsappUrl} target="_blank" rel="noreferrer" className="birthdayWhatsapp">WhatsApp'tan Kutla</a> : <span className="birthdayNoPhone">Telefon yok</span>}
              </div>
            ))}
          </div>
        ) : <div className="liveEmpty compact"><strong>Bugün doğum günü yok.</strong><span>Doğum tarihleri öğrenci dosyalarından otomatik kontrol edilir.</span></div>}
      </article>

      <style jsx global>{`
        .dashboardGrid .scheduleCard{display:none!important}.liveOpsShell{margin:18px 0 20px}.liveOpsHeadline{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;margin-bottom:13px}.liveOpsHeadline>div>span,.livePanelHead span{display:block;color:#6f829e;font-size:10px;font-weight:900;letter-spacing:1.45px}.liveOpsHeadline h2{margin:5px 0 4px;color:#10213e;font-size:24px;letter-spacing:-.4px}.liveOpsHeadline p{margin:0;color:#7b8ca4;font-size:12px}.liveOpsSignal{display:inline-flex;align-items:center;gap:8px;padding:9px 12px;border:1px solid #dce6f2;border-radius:999px;background:#fff;color:#52667f;text-decoration:none;font-size:11px;font-weight:900}.liveOpsSignal i{width:8px;height:8px;border-radius:50%;background:#22a06b}.liveOpsSignal.active{border-color:#fecaca;color:#b42318;background:#fff7f7}.liveOpsSignal.active i{background:#ef4444;box-shadow:0 0 0 0 rgba(239,68,68,.38);animation:sprintPulse 1.5s infinite}@keyframes sprintPulse{70%{box-shadow:0 0 0 8px rgba(239,68,68,0)}100%{box-shadow:0 0 0 0 rgba(239,68,68,0)}}.liveOpsSummary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-bottom:14px}.liveSummaryCard{position:relative;display:flex;flex-direction:column;min-height:112px;padding:15px;border:1px solid #dfe7f1;border-radius:17px;background:#fff;text-decoration:none;color:#172b49;box-shadow:0 7px 20px rgba(15,23,42,.035);transition:transform .16s ease,box-shadow .16s ease,border-color .16s ease}.liveSummaryCard:active{transform:scale(.98)}.liveSummaryCard:hover{transform:translateY(-2px);box-shadow:0 12px 28px rgba(22,54,91,.08)}.liveSummaryCard span{color:#74859c;font-size:11px;font-weight:800}.liveSummaryCard strong{margin-top:8px;font-size:29px;line-height:1}.liveSummaryCard small{margin-top:8px;color:#8796aa;font-size:10px}.liveSummaryCard>b{position:absolute;right:14px;bottom:13px;font-size:18px}.liveSummaryCard.blue{border-color:#bfdbfe}.liveSummaryCard.orange{border-color:#fed7aa;background:#fffaf4}.liveSummaryCard.green{border-color:#bbf7d0;background:#f8fffb}.liveSummaryCard.red{border-color:#fecaca;background:#fff8f8}.liveSummaryCard.purple{border-color:#ddd6fe;background:#fbfaff}.liveSummaryCard.calm{background:#fbfcfe}.liveOpsGrid{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(320px,.85fr);gap:14px;margin-bottom:14px}.livePanel{border:1px solid #dfe7f1;border-radius:20px;background:#fff;box-shadow:0 9px 26px rgba(15,23,42,.035);overflow:hidden}.livePanelHead{display:flex;justify-content:space-between;align-items:flex-start;gap:14px;padding:18px 19px;border-bottom:1px solid #edf1f6}.livePanelHead h3{margin:4px 0 0;color:#10213e;font-size:18px}.livePanelHead>a{color:#176de9;text-decoration:none;font-size:11px;font-weight:900}.lessonRows,.priorityRows,.birthdayRows{display:flex;flex-direction:column}.lessonRow{display:grid;grid-template-columns:74px minmax(0,1fr) auto 20px;gap:12px;align-items:center;padding:13px 18px;border-bottom:1px solid #edf1f6;color:inherit;text-decoration:none;transition:background .15s ease}.lessonRow:last-child{border-bottom:0}.lessonRow:hover,.lessonRow:active{background:#f8fbff}.lessonTime strong,.lessonInfo strong{display:block;color:#142847}.lessonTime strong{font-size:17px}.lessonTime small,.lessonInfo span{display:block;margin-top:3px;color:#8594a8;font-size:10px}.lessonStatus{display:inline-flex;align-items:center;gap:6px;padding:7px 9px;border-radius:999px;font-size:9px;font-weight:900;white-space:nowrap}.lessonStatus i,.priorityRow i{width:7px;height:7px;border-radius:50%}.lessonStatus.done{background:#ecfdf3;color:#16875b}.lessonStatus.done i{background:#22a06b}.lessonStatus.pending{background:#fff7ed;color:#b54708}.lessonStatus.pending i{background:#f79009}.lessonArrow{color:#9aa9bb}.priorityRow{display:grid;grid-template-columns:10px minmax(0,1fr) auto;gap:10px;align-items:center;padding:13px 17px;border-bottom:1px solid #edf1f6;text-decoration:none;color:inherit}.priorityRow:last-child{border-bottom:0}.priorityRow strong{display:block;color:#1a2d49;font-size:11px}.priorityRow span{display:block;margin-top:3px;color:#8493a6;font-size:9px}.priorityRow b{color:#176de9;font-size:9px}.priorityRow.urgent i{background:#ef4444}.priorityRow.warning i{background:#f59e0b}.priorityRow.info i{background:#3b82f6}.priorityRow.success i{background:#22a06b}.liveEmpty{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:180px;padding:25px;text-align:center}.liveEmpty.compact{min-height:105px}.liveEmpty strong{color:#223652;font-size:13px}.liveEmpty span{max-width:440px;margin-top:6px;color:#8a99ac;font-size:10px;line-height:1.5}.birthdayRow{display:grid;grid-template-columns:44px minmax(0,1fr) auto;gap:12px;align-items:center;padding:13px 18px;border-bottom:1px solid #edf1f6}.birthdayRow:last-child{border-bottom:0}.birthdayAvatar{display:grid;place-items:center;width:42px;height:42px;border-radius:14px;background:#fff7ed;font-size:20px}.birthdayRow strong{display:block;color:#17304f;font-size:12px}.birthdayRow span{display:block;margin-top:3px;color:#8493a6;font-size:9px}.birthdayWhatsapp{display:inline-flex;align-items:center;justify-content:center;min-height:35px;padding:0 11px;border-radius:10px;background:#ecfdf3;color:#16875b;text-decoration:none;font-size:9px;font-weight:900}.birthdayNoPhone{color:#94a3b8;font-size:9px}.liveOpsLoading{padding:18px;border:1px solid #dfe7f1;border-radius:16px;background:#fff;color:#718096;font-size:11px}@media(max-width:900px){.liveOpsSummary{grid-template-columns:repeat(2,minmax(0,1fr))}.liveOpsGrid{grid-template-columns:1fr}}@media(max-width:640px){.liveOpsShell{margin:14px 0 18px}.liveOpsHeadline{align-items:flex-start}.liveOpsHeadline h2{font-size:20px}.liveOpsHeadline p{font-size:10px;line-height:1.45}.liveOpsSignal{padding:7px 9px;font-size:9px}.liveOpsSummary{gap:9px}.liveSummaryCard{min-height:103px;padding:13px}.liveSummaryCard strong{font-size:25px}.livePanel{border-radius:17px}.livePanelHead{padding:15px}.livePanelHead h3{font-size:16px}.lessonRow{grid-template-columns:58px minmax(0,1fr) 18px;padding:12px 14px;gap:9px}.lessonStatus{grid-column:2/4;justify-self:start}.lessonTime strong{font-size:15px}.birthdayRow{grid-template-columns:40px minmax(0,1fr);padding:12px 14px}.birthdayWhatsapp,.birthdayNoPhone{grid-column:2;justify-self:start}.priorityRow{grid-template-columns:9px minmax(0,1fr);padding:12px 14px}.priorityRow b{grid-column:2;justify-self:start;margin-top:3px}}
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
