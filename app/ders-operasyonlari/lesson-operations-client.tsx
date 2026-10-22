"use client";

import { participationDays, participationWeekday } from "@/lib/lesson-operations/participation";
import type { CancellationOutcome } from "@/lib/lesson-operations/outcomes";
import { useEffect, useMemo, useRef, useState } from "react";
import { applyLessonCancellation, recordCancellationMessageOpened, confirmCancellationMessageSent, startingCancellationMessages, type StartingCancellationMessage, type PreparedCancellationMessage } from "./actions";

type Branch = { id: string; name: string };
type Group = { id: string; name: string; branch_id: string | null; course_type?: string | null };
type Schedule = {
  id: string;
  group_id: string | null;
  branch_id?: string | null;
  weekday: number | null;
  start_time: string | null;
  end_time: string | null;
  is_active?: boolean | null;
};

type Props = {
  branches: Branch[];
  groups: Group[];
  schedules: Schedule[];
  memberCounts: Record<string, number>;
  participation: { students: {id: string; name: string}[]; memberships: {student_id: string; group_id: string}[]; enrollments: any[]; plans: any[] };
};

type Mode = "append_end" | "custom" | "reserve";

const DAY_NAMES: Record<number, string> = {
  1: "Pazartesi",
  2: "Salı",
  3: "Çarşamba",
  4: "Perşembe",
  5: "Cuma",
  6: "Cumartesi",
  7: "Pazar",
};

function formatDate(value?: string | null) {
  if (!value) return "—";
  const [y, m, d] = value.split("-");
  return y && m && d ? `${d}.${m}.${y}` : value;
}

function whatsappPhone(value: string) {
  const raw = value.replace(/\D/g, "");
  if (raw.startsWith("90")) return raw;
  if (raw.startsWith("0")) return `90${raw.slice(1)}`;
  if (raw.length === 10) return `90${raw}`;
  return raw;
}

export default function LessonOperationsClient({ branches, groups, schedules, memberCounts: totalMemberCounts, participation }: Props) {
  const [startingMessages, setStartingMessages] = useState<StartingCancellationMessage[]>([]);
  const [startingStatus, setStartingStatus] = useState("");
  const [startingPrepared, setStartingPrepared] = useState(false);
  const [preparingStarting, setPreparingStarting] = useState(false);
  const [branchId, setBranchId] = useState("");
  const [groupId, setGroupId] = useState("");
  const [groupIds, setGroupIds] = useState<string[]>([]);
  const [sourceSchedules, setSourceSchedules] = useState<Record<string, string>>({});
  const [scheduleId, setScheduleId] = useState("");
  const [cancelledDate, setCancelledDate] = useState("");
  const [reason, setReason] = useState("Havuz / tesis kaynaklı kapanış");
  const [description, setDescription] = useState("");
  const [mode, setMode] = useState<Mode>("append_end");
  const [customTargets, setCustomTargets] = useState<Record<string, {date: string; scheduleId: string}>>({});
  const [prepareMessages, setPrepareMessages] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState("");
  const [outcomes, setOutcomes] = useState<CancellationOutcome[]>([]);
  const [messageFeedback, setMessageFeedback] = useState("");
  const [messageFilter, setMessageFilter] = useState<"all" | "pending" | "sent" | "missing">("all");
  const [preparedMessages, setPreparedMessages] = useState<PreparedCancellationMessage[]>([]);
  const [sentMessageKeys,setSentMessageKeys]=useState<string[]>([]);
  const [confirmingMessage,setConfirmingMessage]=useState<string|null>(null);
  const confirmationLock=useRef(false);
  async function confirmSent(item:PreparedCancellationMessage){
    if(confirmationLock.current)return;
    if(!window.confirm(`${item.studentName} için WhatsApp mesajını gönderdiniz mi? Onayınız gönderim kaydı olarak saklanır.`))return;
    confirmationLock.current=true;
    const key=item.studentId+item.message;setConfirmingMessage(key);
    try{const response=await confirmCancellationMessageSent({studentId:item.studentId,message:item.message});
      if(response.ok)setSentMessageKeys(keys=>keys.includes(key)?keys:[...keys,key]);
      setMessageFeedback(`${item.studentName}: ${response.message}`);
    }catch{setMessageFeedback(`${item.studentName}: Gönderim durumu kaydedilemedi. Tekrar deneyin.`);}
    finally{confirmationLock.current=false;setConfirmingMessage(null);}
  }
  const [queueIndex, setQueueIndex] = useState(0);
  const [openedStudentIds, setOpenedStudentIds] = useState<string[]>([]);

  const visibleGroups = useMemo(
    () => groups.filter((group) => !branchId || group.branch_id === branchId),
    [groups, branchId]
  );

  const groupSchedules = useMemo(
    () => schedules.filter((schedule) => schedule.group_id === groupId),
    [schedules, groupId]
  );

  const selectedGroup = groups.find((group) => group.id === groupId) || null;
  const selectedSchedule = groupSchedules.find((schedule) => schedule.id === scheduleId) || null;
  const selectedIds = groupIds.length ? groupIds : groupId ? [groupId] : [];
  const multiple = selectedIds.length > 1;
  const participatingStudents = useMemo(() => {
    const members: Record<string, {id: string; name: string}[]> = {};
    if (!cancelledDate) return members;
    const day = new Date(`${cancelledDate}T12:00:00Z`).getUTCDay() || 7;
    const seen = new Set<string>();
    for (const member of participation.memberships) {
      const key = `${member.group_id}:${member.student_id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const enrollment = participation.enrollments.filter(e => e.student_id === member.student_id && e.group_id === member.group_id && e.start_date && e.start_date <= cancelledDate && (!e.start_confirmation_required || e.actual_started_at) && (!e.actual_started_at || e.actual_started_at.slice(0,10) <= cancelledDate)).sort((a,b) => String(b.created_at).localeCompare(String(a.created_at)))[0];
      if (!enrollment) continue;
      const plan = participation.plans.find(p => p.student_id === member.student_id && p.enrollment_id === enrollment.id && p.group_id === member.group_id);
      const sessions = schedules.filter(s => s.group_id === member.group_id);
      if (sessions.some(s => participationWeekday(s.weekday) === day) && participationDays(plan?.selected_weekdays, enrollment.lesson_weekdays, sessions.map(s => s.weekday)).includes(day)) (members[member.group_id] ||= []).push({id: member.student_id, name: participation.students.find(s => s.id === member.student_id)?.name || "İsmi bulunamayan kursiyer"});
    }
    for (const list of Object.values(members)) list.sort((a,b) => a.name.localeCompare(b.name, "tr"));
    return members;
  }, [cancelledDate, participation, schedules]);
  const memberCounts = Object.fromEntries(Object.entries(participatingStudents).map(([id,list]) => [id,list.length]));
  const memberCount = selectedIds.reduce((sum, id) => sum + (memberCounts[id] || 0), 0);
  const dateWeekday = cancelledDate ? (new Date(`${cancelledDate}T12:00:00Z`).getUTCDay() || 7) : 0;
  const startingGroupKey = [...selectedIds].sort().join(",");
  useEffect(() => {
    let cancelled = false;
    setStartingMessages([]); setStartingPrepared(false); setStartingStatus("");
    if (!cancelledDate || !startingGroupKey) return;
    setStartingStatus("Başlaması planlanan kursiyerler kontrol ediliyor…");
    void startingCancellationMessages({date:cancelledDate,groupIds:startingGroupKey.split(","),reason}).then((response) => {
      if (cancelled) return;
      setStartingMessages(response.messages);
      setStartingStatus(response.ok ? "" : `Başlangıç kontrolü yapılamadı: ${response.message}`);
    }).catch(() => {if (!cancelled) setStartingStatus("Başlangıç kontrolünde bağlantı hatası oluştu.");});
    return () => {cancelled = true;};
  }, [cancelledDate, startingGroupKey, reason]);

  async function prepareStarting() {
    setPreparingStarting(true);
    try {
      const response = await startingCancellationMessages({date:cancelledDate,groupIds:selectedIds,reason,prepare:true});
      setStartingStatus(response.message);
      setStartingMessages(response.messages);
      setStartingPrepared(response.ok);
    } catch {setStartingStatus("Mesajlar hazırlanamadı. Tekrar deneyin.");}
    finally {setPreparingStarting(false);}
  }

  function sourceFor(id: string) {
    return schedules.find((s) => s.group_id === id && s.id === (multiple ? sourceSchedules[id] : scheduleId) && participationWeekday(s.weekday) === dateWeekday)
      || (multiple ? schedules.filter((s) => s.group_id === id && participationWeekday(s.weekday) === dateWeekday).length === 1
        ? schedules.find((s) => s.group_id === id && participationWeekday(s.weekday) === dateWeekday) : undefined : undefined);
  }

  function scheduleText(schedule?: Schedule | null) {
    if (!schedule) return "—";
    return `${DAY_NAMES[participationWeekday(schedule.weekday)] || "Ders"} · ${String(schedule.start_time || "").slice(0, 5)}-${String(schedule.end_time || "").slice(0, 5)}`;
  }

  function compatibleTarget(sourceId: string, targetId: string | null) {
    const source = groups.find(g => g.id === sourceId);
    const target = groups.find(g => g.id === targetId);
    const adult = (value?: string | null) => /yetişkin|yetiskin|adult|master/i.test(value || "");
    return Boolean(source && target && source.branch_id === target.branch_id && adult(source.course_type) === adult(target.course_type));
  }

  async function submitOperation() {
    if (!selectedIds.length || !cancelledDate || !reason.trim() || selectedIds.some((id) => !sourceFor(id))) {
      setResult("Grup, tarih ve gerekçe seçin; her grup için iptal tarihinin gününe uygun seansı seçin.");
      return;
    }

    if (mode === "custom" && selectedIds.some(id => {
      const target = customTargets[id];
      const day = target?.date ? new Date(`${target.date}T12:00:00Z`).getUTCDay() || 7 : 0;
      return !target?.date || target.date <= cancelledDate || !schedules.some(s => s.id === target.scheduleId && compatibleTarget(id, s.group_id) && participationWeekday(s.weekday) === day);
    })) {
      setResult("Her grup için iptal tarihinden sonraki telafi tarihini ve o güne uygun seansı seçin.");
      return;
    }

    const modeText =
      mode === "append_end"
        ? "telafileri kayıt sonuna ekleyip bitiş tarihlerini güncellemek"
        : mode === "custom"
          ? "telafileri seçilen özel tarih/seansa planlamak"
          : "telafi haklarını saklı tutup daha sonra planlamak";

    if (!window.confirm(`${selectedIds.map((id) => groups.find((g) => g.id === id)?.name).join("; ")} için ${formatDate(cancelledDate)} tarihli ders iptal edilecek ve ${modeText} istiyorsunuz. Devam edilsin mi?`)) {
      return;
    }

    setSubmitting(true);
    setResult("Ders iptali ve telafi işlemleri uygulanıyor…");
    setPreparedMessages([]);
    setOutcomes([]);
    setMessageFeedback("");
    setMessageFilter("all");
    setQueueIndex(0);
    setOpenedStudentIds([]);
    setSentMessageKeys([]);

    try {
      const messages: PreparedCancellationMessage[] = [];
      const results: string[] = [];
      const operationOutcomes: CancellationOutcome[] = [];
      for (const id of selectedIds) {
        const response = await applyLessonCancellation({
          groupId: id,
          scheduleId: sourceFor(id)!.id,
          cancelledDate, reason, description,
          compensationMode: mode,
          customDate: mode === "custom" ? customTargets[id].date : null,
          customScheduleId: mode === "custom" ? customTargets[id].scheduleId : null,
          prepareMessages,
        });
        results.push(`${groups.find((g) => g.id === id)?.name}: ${response.message}`);
        messages.push(...(response.preparedMessages || []));
        operationOutcomes.push(...("outcomes" in response ? response.outcomes || [] : []));
        setOutcomes([...operationOutcomes]);
        setResult(results.join("\n"));
        setPreparedMessages([...messages]);
        if (!response.ok) break;
      }
    } catch (error) {
      console.error(error);
      setResult("Ders operasyonu sırasında bağlantı hatası oluştu.");
    } finally {
      setSubmitting(false);
    }
  }

  function openNextWhatsapp() {
    const sendable = preparedMessages.filter((item) => Boolean(item.recipient) && !sentMessageKeys.includes(item.studentId+item.message));
    if (!sendable.length) {
      setMessageFeedback("Gönderim bekleyen, telefon numarası kayıtlı mesaj kalmadı.");
      return;
    }

    const safeIndex = queueIndex >= sendable.length ? 0 : queueIndex;
    const current = sendable[safeIndex];
    if (!current.recipient) return;

    openWhatsapp(current);
    setQueueIndex(safeIndex + 1 >= sendable.length ? 0 : safeIndex + 1);
  }

  function openWhatsapp(item: PreparedCancellationMessage) {
    if (!item.recipient) return;
    window.open(`https://wa.me/${whatsappPhone(item.recipient)}?text=${encodeURIComponent(item.message)}`, "_blank", "noopener,noreferrer");
    const key = item.studentId + item.message;
    setOpenedStudentIds(ids => ids.includes(key) ? ids : [...ids, key]);
    setMessageFeedback(`${item.studentName}: WhatsApp açma isteği oluşturuldu. Mesajı gönderdikten sonra gönderim kaydını onaylayın.`);
    void recordCancellationMessageOpened({studentId:item.studentId,message:item.message}).then(response => {
      if (!response.ok) setMessageFeedback(`${item.studentName}: WhatsApp açma durumu kaydedilemedi. Gönderim yaptıysanız ayrıca onaylayabilirsiniz.`);
    }).catch(() => setMessageFeedback(`${item.studentName}: Bağlantı nedeniyle açılma durumu kaydedilemedi.`));
  }

  const skippedOutcomes = outcomes.filter(item => item.status === "skipped");
  const processedOutcomes = outcomes.filter(item => item.status === "processed");
  const warningCount = outcomes.filter(item => item.warning).length;
  const pendingCount = preparedMessages.filter(item => item.recipient && !sentMessageKeys.includes(item.studentId+item.message)).length;
  const missingPhoneCount = preparedMessages.filter(item => !item.recipient).length;
  const visibleMessages = preparedMessages.filter(item => messageFilter === "all" || (messageFilter === "sent" ? sentMessageKeys.includes(item.studentId+item.message) : messageFilter === "missing" ? !item.recipient : Boolean(item.recipient) && !sentMessageKeys.includes(item.studentId+item.message)));

  return (
    <div className="lessonOpsShell">
      <section className="lessonOpsHero">
        <div>
          <span>SPRİNTOS · DERS OPERASYON MERKEZİ</span>
          <h1>Ders İptali + Telafi + Veli Bilgilendirme</h1>
          <p>
            Havuz/tesis kaynaklı iptali tek işlemle kaydet, telafiyi kayıt sonuna ekle veya farklı planla,
            eski ve güncellenen bitiş tarihini koru ve velilere gerçek işleme göre mesaj hazırla.
          </p>
        </div>
        <div className="heroRule">
          <strong>Varsayılan Sprint kuralı</strong>
          <span>Telafi mevcut programın sonuna, aynı gün/saat düzenine göre eklenir.</span>
        </div>
      </section>

      <section className="lessonOpsGrid">
        <div className="lessonOpsCard">
          <h2>1 · İptal edilen ders</h2>
          <div className="fieldGrid">
            <label>
              <span>Şube / Havuz</span>
              <select
                value={branchId}
                onChange={(event) => {
                  setBranchId(event.target.value);
                  setGroupId("");
                  setGroupIds([]);
                  setSourceSchedules({});
                  setScheduleId("");
                }}
              >
                <option value="">Şube seçin</option>
                {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
              </select>
            </label>

            <div className="groupField">
              <span>Gruplar · birden fazla seçebilirsiniz</span>
              <select
                value={groupId}
                style={{ display: "none" }}
                aria-hidden="true"
                tabIndex={-1}
                disabled={!branchId}
                onChange={(event) => {
                  setGroupId(event.target.value);
                  setGroupIds(event.target.value ? [event.target.value] : []);
                  setScheduleId("");
                  setCustomTargets({});
                }}
              >
                <option value="">Grup seçin</option>
                {visibleGroups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name} · {cancelledDate ? `${memberCounts[group.id] || 0} seçilen gün katılacak kursiyer` : "Önce iptal tarihini seçin"}
                  </option>
                ))}
              </select>
              <div className="groupChoices">
                <button type="button" disabled={!branchId || submitting} onClick={() => {
                  const ids = visibleGroups.map((g) => g.id);
                  setGroupIds(selectedIds.length === ids.length ? [] : ids);
                  setGroupId(selectedIds.length === ids.length ? "" : ids[0] || "");
                  setScheduleId(""); setSourceSchedules({});

                }}>Tüm grupları seç / kaldır</button>
                {branchId && visibleGroups.map((group) => (
                  <div key={group.id}>
                  <label className="groupChoice">
                    <input aria-label={group.name} type="checkbox" disabled={submitting} checked={selectedIds.includes(group.id)} onChange={(event) => {
                      const ids = event.target.checked ? [...selectedIds, group.id] : selectedIds.filter((id) => id !== group.id);
                      setGroupIds(ids); setGroupId(ids[0] || ""); setScheduleId(""); setCustomTargets({});

                    }} />
                    <span>{group.name}</span>
                  </label>
                  <details className="participantDetails" key={`${group.id}:${cancelledDate}`}>
                    <summary>{cancelledDate ? `${memberCounts[group.id] || 0} seçilen gün katılacak kursiyer` : "Önce iptal tarihini seçin"}<span> Listeyi aç / kapat</span></summary>
                    {(participatingStudents[group.id] || []).length ? <ol>{participatingStudents[group.id].map(student => <li key={student.id}>{student.name}</li>)}</ol> : <p>{cancelledDate ? "Seçilen gün katılacak kursiyer bulunmuyor." : "Kursiyerleri görmek için iptal tarihini seçin."}</p>}
                  </details>
                  </div>
                ))}
              </div>
            </div>

            {!multiple && <label>
              <span>İptal Edilen Seans</span>
              <select value={scheduleId} disabled={!groupId} onChange={(event) => setScheduleId(event.target.value)}>
                <option value="">Seans seçin</option>
                {groupSchedules.filter(s => !cancelledDate || participationWeekday(s.weekday) === dateWeekday).map((schedule) => (
                  <option key={schedule.id} value={schedule.id}>{scheduleText(schedule)}</option>
                ))}
              </select>
            </label>}

            <label>
              <span>İptal Tarihi</span>
              <input type="date" value={cancelledDate} onChange={(event) => {setCancelledDate(event.target.value); setScheduleId(""); setSourceSchedules({});}} />
            </label>
          </div>

          {multiple && <div className="sourcePreview">
            <strong>{selectedIds.length} grup seçili · {memberCount} seçilen gün katılacak kursiyer</strong>
            {selectedIds.map((id) => <label key={id}>
              <span>{groups.find((g) => g.id === id)?.name}</span>
              <select disabled={submitting || !cancelledDate} value={sourceFor(id)?.id || ""} onChange={(event) => setSourceSchedules((prev) => ({...prev, [id]: event.target.value}))}>
                <option value="">Tarihe uygun seans seçin</option>
                {schedules.filter((s) => s.group_id === id && participationWeekday(s.weekday) === dateWeekday).map((s) => <option key={s.id} value={s.id}>{scheduleText(s)}</option>)}
              </select>
            </label>)}
          </div>}

          <div className="fieldGrid">
            <label>
              <span>Gerekçe</span>
              <select value={reason} onChange={(event) => setReason(event.target.value)}>
                <option value="Havuz / tesis kaynaklı kapanış">Havuz / tesis kaynaklı kapanış</option>
                <option value="Hijyen tedbiri / tesis kararı">Hijyen tedbiri / tesis kararı</option>
                <option value="Olumsuz hava koşulları">Olumsuz hava koşulları</option>
                <option value="Teknik arıza">Teknik arıza</option>
                <option value="Resmî tatil">Resmî tatil</option>
                <option value="Yönetim kararı">Yönetim kararı</option>
                <option value="Diğer">Diğer</option>
              </select>
            </label>

            <label>
              <span>Açıklama / Operasyon Notu</span>
              <input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="İsteğe bağlı açıklama" />
            </label>
          </div>

          {selectedGroup && selectedSchedule && (
            <div className="sourcePreview">
              <strong>{selectedGroup.name}</strong>
              <span>{scheduleText(selectedSchedule)}</span>
              <span>{memberCount} seçilen gün katılacak kursiyer · seçili ders gününe kayıtlı kursiyerler server tarafında doğrulanır.</span>
            </div>
          )}
        </div>

        <div className="lessonOpsCard">
          {(startingMessages.length > 0 || startingStatus) && <aside className="startingWarning" role="status">
            {startingMessages.length > 0 && <>
              <strong>⚠ {startingMessages.length} kursiyerin ilk dersi iptal tarihine denk geliyor</strong>
              <p>Bu kursiyerler henüz başlamadı. Ayrı başlangıç mesajı hazırlanır; başlangıç ve ders hakları değiştirilmez.</p>
              {startingMessages.map((item) => <div key={item.studentId} className="startingPerson">
                <b>{item.studentName}</b><span>{item.groupName}</span>
                {!item.recipient && <span>Telefon bilgisi eksik</span>}
                {startingPrepared && item.recipient && <a href={`https://wa.me/${whatsappPhone(item.recipient)}?text=${encodeURIComponent(item.message)}`} target="_blank" rel="noopener noreferrer">Başlangıç mesajını WhatsApp’ta aç</a>}
              </div>)}
              <button type="button" disabled={preparingStarting || submitting} onClick={() => void prepareStarting()}>{preparingStarting ? "Mesaj hazırlanıyor…" : "Ayrı başlangıç mesajlarını hazırla"}</button>
              <small>WhatsApp açıldığında mesajı göndermek için Gönder’e basın.</small>
            </>}
            {startingStatus && <p>{startingStatus}</p>}
          </aside>}
          <h2>2 · Telafi yöntemi</h2>
          <div className="modeCards">
            <button type="button" className={mode === "append_end" ? "active" : ""} onClick={() => setMode("append_end")}>
              <strong>✓ Kayıt sonuna otomatik ekle</strong>
              <span>Varsayılan. Öğrencinin mevcut telafili bitişinden sonraki ilk gerçek ders günü bulunur; aynı programda telafi oluşturulur.</span>
            </button>
            <button type="button" className={mode === "custom" ? "active" : ""} onClick={() => setMode("custom")}>
              <strong>Farklı tarih / seans planla</strong>
              <span>Her grup için tarih seçin; aynı havuzdaki uygun çocuk veya yetişkin grubunun seansına telafi planlayın.</span>
            </button>
            <button type="button" className={mode === "reserve" ? "active" : ""} onClick={() => setMode("reserve")}>
              <strong>Hakkı saklı tut, sonra planla</strong>
              <span>Henüz tarih belli değilse iptal kaydedilir; veliye telafi hakkının saklı olduğu bildirilir.</span>
            </button>
          </div>

          {mode === "custom" && <div className="customTargets">
            {!selectedIds.length && <p>Telafi planlamak için önce grup seçin.</p>}
            {selectedIds.map(id => {
              const target = customTargets[id] || {date:"", scheduleId:""};
              const day = target.date ? new Date(`${target.date}T12:00:00Z`).getUTCDay() || 7 : 0;
              const options = schedules.filter(s => compatibleTarget(id, s.group_id) && participationWeekday(s.weekday) === day);
              return <fieldset key={id} className="customTarget">
                <legend>{groups.find(g => g.id === id)?.name}</legend>
                <div className="fieldGrid customFields">
                  <label><span>Telafi Tarihi</span><input type="date" value={target.date} disabled={submitting} onChange={event => setCustomTargets(prev => ({...prev,[id]:{date:event.target.value,scheduleId:""}}))} /></label>
                  <label><span>Telafi Grubu / Seansı</span><select value={target.scheduleId} disabled={submitting || !target.date} onChange={event => setCustomTargets(prev => ({...prev,[id]:{...target,scheduleId:event.target.value}}))}>
                    <option value="">Seans seçin</option>
                    {options.map(schedule => <option key={schedule.id} value={schedule.id}>{groups.find(g => g.id === schedule.group_id)?.name} · {scheduleText(schedule)}</option>)}
                  </select></label>
                </div>
                {target.date && !options.length && <p role="status">Seçilen tarihte aynı havuzda uygun aktif seans bulunamadı. Havuzun grup programını kontrol edin.</p>}
              </fieldset>;
            })}
          </div>}

          <label className="checkRow">
            <input type="checkbox" checked={prepareMessages} onChange={(event) => setPrepareMessages(event.target.checked)} />
            <div>
              <strong>Velilere iptal + telafi WhatsApp mesajı hazırla</strong>
              <span>Mesaj önce ders iptalini söyler; ardından gerçek telafi durumunu ve normal/güncellenen bitiş tarihlerini gösterir.</span>
            </div>
          </label>

          <div className="ruleBox">
            <strong>Sistem kuralı</strong>
            <p>
              İptal edilen tesis kaynaklı ders için normal paket hakkı düşürülmez. Kayıt sonuna ekleme seçilirse
              <b> Normal planlanan bitiş tarihi</b> değişmeden saklanır; <b>Telafi sonrası güncellenen bitiş tarihi</b>
              gerçek sonraki ders gününe taşınır. Oluşturulan telafi, o tarihte Yoklama ekranında <b>TELAFİ DERSİ</b> olarak görünür.
            </p>
          </div>

          <button type="button" className="applyButton" disabled={submitting} onClick={() => void submitOperation()}>
            {submitting ? "İşlem uygulanıyor…" : "Ders İptalini Uygula + Telafiyi İşle"}
          </button>

          {result && <div className="resultBox" role="status">{result}</div>}
          {outcomes.length > 0 && <div className="operationResults">
            <div className="outcomeStats"><strong>{processedOutcomes.length} kursiyere işlem uygulandı</strong><span>{skippedOutcomes.length} kursiyere işlem uygulanmadı</span>{warningCount > 0 && <span role="alert">{warningCount} kursiyerin mesajı hazırlanamadı; aşağıdaki işlem listesini kontrol edin.</span>}</div>
            {skippedOutcomes.length > 0 && <details className="outcomeDetails skippedDetails" open>
              <summary>İşlem uygulanmayan kursiyerler ({skippedOutcomes.length})</summary>
              <p>Bu listedeki kursiyerlere iptal / telafi işlemi uygulanmadı. Gerekçeyi kontrol ederek kursiyer dosyasından ilerleyebilirsiniz.</p>
              <ul>{skippedOutcomes.map((item,index) => <li key={`${item.groupName}:${item.studentId}:${index}`}><div><strong>{item.studentName || "Kursiyer"}</strong><small>{item.groupName}</small><span>{item.reason}</span></div><a href={`/ogrenciler/${item.studentId}`} target="_blank" rel="noopener noreferrer">Dosyayı aç</a></li>)}</ul>
            </details>}
            {processedOutcomes.length > 0 && <details className="outcomeDetails" open={warningCount > 0 ? true : undefined}><summary>İşlem uygulanan kursiyerler ({processedOutcomes.length})</summary><ul>{processedOutcomes.map((item,index) => <li key={`${item.groupName}:${item.studentId}:${index}`}><div><strong>{item.studentName}</strong><small>{item.groupName}</small><span>{item.reason}</span></div></li>)}</ul></details>}
          </div>}
        </div>
      </section>

      {preparedMessages.length > 0 && (
        <section className="lessonOpsCard messageSection">
          <div className="messageHead">
            <div>
              <span>3 · VELİ BİLGİLENDİRME</span>
              <h2>{preparedMessages.length} mesaj · {sentMessageKeys.length} gönderildi</h2>
              <p>WhatsApp’ta mesajı gönderdikten sonra “Gönderildi olarak kaydet” ile onaylayın. WhatsApp’ın açılması gönderim onayı değildir.</p>
              <p>Her mesaj gerçek öğrenci tarihlerini kullanır. Önce iptal bilgisi, sonra telafi ve iki bitiş tarihi gösterilir.</p>
            </div>
            <button type="button" className="whatsappButton" disabled={!pendingCount || submitting} onClick={openNextWhatsapp}>
              {openedStudentIds.length
                ? `Sıradaki mesajı aç · ${pendingCount} onay bekliyor`
                : `WhatsApp mesajlarını aç (${pendingCount})`}
            </button>
          </div>

          <div className="messageToolbar" aria-label="Mesaj durum filtresi">
            {([['all',`Tümü (${preparedMessages.length})`],['pending',`Gönderim onayı bekleyen (${pendingCount})`],['sent',`Gönderildi (${sentMessageKeys.length})`],['missing',`Telefon eksik (${missingPhoneCount})`]] as const).map(([value,label]) => <button type="button" key={value} aria-pressed={messageFilter===value} onClick={() => setMessageFilter(value)}>{label}</button>)}
          </div>
          {messageFeedback && <p className="messageFeedback" role="status">{messageFeedback}</p>}
          <div className="messageList">
            {!visibleMessages.length && <p className="messageFeedback">Bu durumda mesaj bulunmuyor.</p>}
            {visibleMessages.map((item) => (
              <article key={item.studentId+item.message}>
                <div>
                  <strong>{item.studentName}</strong>
                  <span>{item.recipient || "Telefon bilgisi yok · Kursiyer dosyasından güncelleyin"}</span>
                  <details className="messagePreview"><summary>Mesaj içeriğini göster</summary><p>{item.message}</p></details>
                </div>
                <div className="dateCompare">
                  <span>Normal bitiş <b>{formatDate(item.oldNormalEndDate)}</b></span>
                  <span>Güncellenen bitiş <b>{formatDate(item.newCompensationEndDate)}</b></span>
                  <span>Telafi <b>{formatDate(item.compensationDate)}</b></span>
                </div>
                <div className="messageSendState">
                  <span className={sentMessageKeys.includes(item.studentId+item.message) ? "sentFlag opened" : "sentFlag"}>
                    {sentMessageKeys.includes(item.studentId+item.message) ? "Gönderildi · Kullanıcı onaylı" : openedStudentIds.includes(item.studentId+item.message) ? "WhatsApp açma isteği · Onay bekliyor" : item.recipient ? "Mesaj hazır" : "Telefon eksik"}
                  </span>
                  {item.recipient && <button type="button" className="openMessage" onClick={() => openWhatsapp(item)}>WhatsApp’ta aç</button>}
                  {item.recipient && !sentMessageKeys.includes(item.studentId+item.message) && <button type="button" disabled={Boolean(confirmingMessage)} onClick={()=>void confirmSent(item)}>
                    {confirmingMessage===item.studentId+item.message ? "Kaydediliyor…" : "Gönderildi olarak kaydet"}
                  </button>}
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      <style jsx>{`
        .operationResults{display:grid;gap:10px;margin-top:12px}.outcomeStats{display:flex;flex-wrap:wrap;gap:8px 16px;padding:12px;background:#f3f7fc;border-radius:12px;font-size:13px}.outcomeStats span{color:#8a5713}.outcomeDetails{border:1px solid #d8e3ef;border-radius:12px;padding:12px;background:#fff}.outcomeDetails summary{cursor:pointer;font-size:13px;font-weight:800}.outcomeDetails p{font-size:12px;line-height:1.5;color:#705b3c}.outcomeDetails ul{list-style:none;padding:0;margin:8px 0 0;max-height:360px;overflow:auto}.outcomeDetails li{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:12px 0;border-top:1px solid #e5ebf2}.outcomeDetails li div{display:grid;gap:4px;min-width:0;overflow-wrap:anywhere}.outcomeDetails small{color:#64748b;font-size:11px}.outcomeDetails li span{font-size:12px;line-height:1.5}.outcomeDetails a{flex-shrink:0;padding:9px;border:1px solid #cadbee;border-radius:9px;text-decoration:none;color:#1268d6;font-size:12px;font-weight:800}.skippedDetails{border-color:#ebd1a0;background:#fffbf3}.messageToolbar{display:flex;gap:8px;flex-wrap:wrap;padding:16px 20px;background:#f8fafd;border-bottom:1px solid #e3ebf4}.messageToolbar button{padding:9px 12px;border:1px solid #d8e2ee;border-radius:10px;background:#fff;color:#526980;cursor:pointer;font:inherit;font-size:12px;font-weight:700}.messageToolbar button[aria-pressed=true]{background:#eaf3ff;border-color:#1268d6;color:#1260b6}.messageFeedback{padding:12px 20px;margin:0;border-bottom:1px solid #dce7f4;background:#f0f6ff;color:#214f7a;font-size:13px;line-height:1.5}.messageSendState{display:grid;gap:8px;justify-items:start}.messageSendState button{min-height:40px;border:1px solid #1268d6;border-radius:10px;padding:9px 12px;background:#1268d6;color:#fff;font-weight:700;cursor:pointer}.messageSendState .openMessage{background:#edf9f1;border-color:#bce1c9;color:#17643c}.messageSendState button:disabled,.whatsappButton:disabled{opacity:.5;cursor:default}.messagePreview{margin-top:7px;font-size:12px;color:#1260b6}.messagePreview summary{cursor:pointer}.messagePreview p{white-space:pre-wrap;overflow-wrap:anywhere;color:#314966;line-height:1.6;padding:10px;background:#f5f8fc;border-radius:10px;max-height:260px;overflow:auto}.sentFlag{line-height:1.5}.messageList article{grid-template-columns:minmax(160px,1fr) minmax(170px,1fr) minmax(160px,.9fr)}@media(max-width:900px){.messageList article{grid-template-columns:1fr}.messageSendState{justify-items:stretch}.messageSendState button{width:100%}.outcomeDetails li{align-items:flex-start}}
        .participantDetails{margin:0 4px 10px;padding:10px 12px;border:1px solid #cfdae7;border-top:0;border-radius:0 0 11px 11px;background:#fff;color:#17345c}.participantDetails summary{cursor:pointer;font-size:13px;font-weight:700;line-height:1.5}.participantDetails summary span{display:block;font-size:11px;color:#1268d6}.participantDetails ol{margin:10px 0 0;padding-left:25px;max-height:240px;overflow:auto}.participantDetails li{padding:5px;overflow-wrap:anywhere}.participantDetails p,.customTarget p{font-size:12px;line-height:1.5}.customTargets{display:grid;gap:12px;margin-top:14px}.customTarget{min-width:0;margin:0;padding:12px;border:1px solid #cfdae7;border-radius:12px}.customTarget legend{font-size:13px;font-weight:700;max-width:100%;overflow-wrap:anywhere}

        .startingWarning{padding:16px;margin-bottom:18px;border:1px solid #edbd62;border-radius:14px;background:#fff8e8;color:#704811}.startingWarning p{font-size:13px;line-height:1.5}.startingPerson{display:grid;gap:5px;padding:10px 0;border-top:1px solid #eddbb6}.startingPerson span,.startingWarning small{font-size:12px}.startingWarning button,.startingPerson a{display:block;padding:11px;border:0;border-radius:10px;background:#1268d6;color:#fff;text-decoration:none;font-weight:700;margin:8px 0}.startingWarning small{display:block}.lessonOpsShell{display:grid;gap:18px;color:#10233f}.lessonOpsHero{display:flex;justify-content:space-between;gap:20px;padding:26px;border-radius:22px;background:linear-gradient(135deg,#061f3d,#0a4f8c);color:#fff;box-shadow:0 18px 45px rgba(15,58,107,.18)}.lessonOpsHero>div:first-child{max-width:760px}.lessonOpsHero span{font-size:11px;font-weight:900;letter-spacing:.1em;color:#ffad2f}.lessonOpsHero h1{margin:7px 0 8px;font-size:30px}.lessonOpsHero p{margin:0;color:rgba(255,255,255,.82);line-height:1.6}.heroRule{min-width:260px;max-width:330px;padding:16px;border:1px solid rgba(255,255,255,.2);border-radius:16px;background:rgba(255,255,255,.08);display:grid;gap:6px}.heroRule strong{font-size:13px}.heroRule span{font-size:12px;line-height:1.5;color:#fff;letter-spacing:0}.lessonOpsGrid{display:grid;grid-template-columns:1fr 1fr;gap:18px}.lessonOpsCard{background:#fff;border:1px solid #dce5ef;border-radius:18px;padding:20px;box-shadow:0 10px 30px rgba(22,53,88,.06)}.lessonOpsCard h2{margin:0 0 16px;font-size:20px}.fieldGrid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.fieldGrid+ .fieldGrid{margin-top:12px}.fieldGrid label,.customFields label{display:grid;gap:6px}.fieldGrid label>span{font-size:12px;font-weight:800;color:#526980}.fieldGrid select,.fieldGrid input{box-sizing:border-box;min-width:0;max-width:100%;width:100%;min-height:44px;border:1px solid #cfdaE7;border-radius:11px;padding:0 11px;background:#fff;color:#17345c;font:inherit}.sourcePreview{display:grid;gap:4px;margin-top:14px;padding:13px;border-radius:12px;background:#eef6ff;border:1px solid #cfe2f8}.sourcePreview span{font-size:12px;color:#5a718a}.modeCards{display:grid;gap:9px}.modeCards button{display:grid;gap:5px;text-align:left;padding:14px;border:1px solid #d8e2ed;border-radius:13px;background:#fff;color:#17345c;cursor:pointer}.modeCards button.active{border-color:#1671e8;background:#eef6ff;box-shadow:0 0 0 2px rgba(22,113,232,.08)}.modeCards strong{font-size:13px}.modeCards span{font-size:11px;line-height:1.5;color:#60758c}.customFields{margin-top:14px}.checkRow{display:flex;gap:10px;align-items:flex-start;margin-top:14px;padding:13px;border:1px solid #d7e5dc;border-radius:12px;background:#f2fbf6}.checkRow input{width:18px;height:18px;margin-top:2px}.checkRow strong,.checkRow span{display:block}.checkRow strong{font-size:13px;color:#15603c}.checkRow span{margin-top:4px;font-size:11px;color:#5d7467;line-height:1.45}.ruleBox{margin-top:14px;padding:14px;border-radius:12px;background:#fff8ea;border:1px solid #efd3a3}.ruleBox strong{color:#8a5713}.ruleBox p{margin:5px 0 0;font-size:12px;line-height:1.6;color:#705b3c}.applyButton{width:100%;margin-top:14px;min-height:48px;border:0;border-radius:12px;background:#1268d6;color:#fff;font-weight:900;cursor:pointer}.applyButton:disabled{opacity:.6;cursor:wait}.groupField{display:grid;gap:6px}.groupField>span{font-size:12px;font-weight:800;color:#526980}.groupChoices{display:grid;gap:8px}.fieldGrid .groupChoice{display:flex;align-items:center;gap:10px;padding:12px;border:1px solid #cfdae7;border-radius:11px;background:#f6faff}.groupChoice input{width:20px;min-height:20px;height:20px;flex-shrink:0}.groupChoice small{display:block;color:#526980;margin-top:4px}.sourcePreview label{display:grid;gap:6px}.sourcePreview select{width:100%;min-height:44px;border:1px solid #cfdae7;border-radius:11px;background:#fff}.modeCards button:disabled{opacity:.5;cursor:not-allowed}.resultBox{white-space:pre-line;margin-top:12px;padding:13px;border-radius:11px;background:#edf8f2;border:1px solid #c4e6d2;color:#17623b;font-size:13px;font-weight:800}.messageSection{padding:0;overflow:hidden}.messageHead{display:flex;justify-content:space-between;gap:16px;align-items:center;padding:20px;border-bottom:1px solid #dfe7ef}.messageHead>div>span{font-size:10px;font-weight:900;letter-spacing:.1em;color:#1671e8}.messageHead h2{margin:4px 0}.messageHead p{margin:0;color:#64748b;font-size:12px}.whatsappButton{border:0;border-radius:11px;padding:12px 14px;background:#1fa463;color:#fff;font-weight:900;cursor:pointer}.messageList{display:grid}.messageList article{display:grid;grid-template-columns:minmax(180px,1fr) 2fr auto;gap:14px;align-items:center;padding:13px 20px;border-bottom:1px solid #edf1f5}.messageList article:last-child{border-bottom:0}.messageList article>div:first-child strong,.messageList article>div:first-child span{display:block}.messageList article>div:first-child span{margin-top:3px;font-size:10px;color:#718096}.dateCompare{display:flex;gap:14px;flex-wrap:wrap}.dateCompare span{font-size:11px;color:#6a7f95}.dateCompare b{color:#17345c}.sentFlag{border-radius:999px;padding:6px 9px;background:#edf2f7;color:#64748b;font-size:10px;font-weight:900}.sentFlag.opened{background:#e1f6e9;color:#157044}@media(max-width:900px){.lessonOpsHero{flex-direction:column}.heroRule{max-width:none}.lessonOpsGrid{grid-template-columns:1fr}.fieldGrid{grid-template-columns:1fr}.messageHead{align-items:stretch;flex-direction:column}.messageList article{grid-template-columns:1fr}.whatsappButton{width:100%}}
      `}</style>
    </div>
  );
}
