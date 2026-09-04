"use client";

import { useMemo, useState } from "react";
import { applyLessonCancellation, type PreparedCancellationMessage } from "./actions";

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

export default function LessonOperationsClient({ branches, groups, schedules, memberCounts }: Props) {
  const [branchId, setBranchId] = useState("");
  const [groupId, setGroupId] = useState("");
  const [scheduleId, setScheduleId] = useState("");
  const [cancelledDate, setCancelledDate] = useState("");
  const [reason, setReason] = useState("Havuz / tesis kaynaklı kapanış");
  const [description, setDescription] = useState("");
  const [mode, setMode] = useState<Mode>("append_end");
  const [customDate, setCustomDate] = useState("");
  const [customScheduleId, setCustomScheduleId] = useState("");
  const [prepareMessages, setPrepareMessages] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState("");
  const [preparedMessages, setPreparedMessages] = useState<PreparedCancellationMessage[]>([]);
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
  const memberCount = groupId ? memberCounts[groupId] || 0 : 0;

  function scheduleText(schedule?: Schedule | null) {
    if (!schedule) return "—";
    return `${DAY_NAMES[Number(schedule.weekday)] || "Ders"} · ${String(schedule.start_time || "").slice(0, 5)}-${String(schedule.end_time || "").slice(0, 5)}`;
  }

  async function submitOperation() {
    if (!groupId || !scheduleId || !cancelledDate || !reason.trim()) {
      setResult("Şube/grup, iptal edilen seans, tarih ve gerekçe seçilmelidir.");
      return;
    }

    if (mode === "custom" && (!customDate || !customScheduleId)) {
      setResult("Farklı telafi planında telafi tarihi ve seansı seçilmelidir.");
      return;
    }

    const modeText =
      mode === "append_end"
        ? "telafileri kayıt sonuna ekleyip bitiş tarihlerini güncellemek"
        : mode === "custom"
          ? "telafileri seçilen özel tarih/seansa planlamak"
          : "telafi haklarını saklı tutup daha sonra planlamak";

    if (!window.confirm(`${selectedGroup?.name || "Seçili grup"} için ${formatDate(cancelledDate)} tarihli ders iptal edilecek ve ${modeText} istiyorsunuz. Devam edilsin mi?`)) {
      return;
    }

    setSubmitting(true);
    setResult("Ders iptali ve telafi işlemleri uygulanıyor…");
    setPreparedMessages([]);
    setQueueIndex(0);
    setOpenedStudentIds([]);

    try {
      const response = await applyLessonCancellation({
        groupId,
        scheduleId,
        cancelledDate,
        reason,
        description,
        compensationMode: mode,
        customDate: mode === "custom" ? customDate : null,
        customScheduleId: mode === "custom" ? customScheduleId : null,
        prepareMessages,
      });

      setResult(response.message);
      setPreparedMessages(response.preparedMessages || []);
    } catch (error) {
      console.error(error);
      setResult("Ders operasyonu sırasında bağlantı hatası oluştu.");
    } finally {
      setSubmitting(false);
    }
  }

  function openNextWhatsapp() {
    const sendable = preparedMessages.filter((item) => Boolean(item.recipient));
    if (!sendable.length) {
      window.alert("WhatsApp gönderimi için geçerli telefon numarası bulunamadı.");
      return;
    }

    const safeIndex = queueIndex >= sendable.length ? 0 : queueIndex;
    const current = sendable[safeIndex];
    if (!current.recipient) return;

    window.open(
      `https://wa.me/${whatsappPhone(current.recipient)}?text=${encodeURIComponent(current.message)}`,
      "_blank",
      "noopener,noreferrer"
    );

    setOpenedStudentIds((currentIds) =>
      currentIds.includes(current.studentId) ? currentIds : [...currentIds, current.studentId]
    );
    setQueueIndex(safeIndex + 1 >= sendable.length ? 0 : safeIndex + 1);
  }

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
                  setScheduleId("");
                }}
              >
                <option value="">Şube seçin</option>
                {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
              </select>
            </label>

            <label>
              <span>Grup</span>
              <select
                value={groupId}
                disabled={!branchId}
                onChange={(event) => {
                  setGroupId(event.target.value);
                  setScheduleId("");
                  setCustomScheduleId("");
                }}
              >
                <option value="">Grup seçin</option>
                {visibleGroups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name} · {memberCounts[group.id] || 0} aktif kursiyer
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>İptal Edilen Seans</span>
              <select value={scheduleId} disabled={!groupId} onChange={(event) => setScheduleId(event.target.value)}>
                <option value="">Seans seçin</option>
                {groupSchedules.map((schedule) => (
                  <option key={schedule.id} value={schedule.id}>{scheduleText(schedule)}</option>
                ))}
              </select>
            </label>

            <label>
              <span>İptal Tarihi</span>
              <input type="date" value={cancelledDate} onChange={(event) => setCancelledDate(event.target.value)} />
            </label>
          </div>

          <div className="fieldGrid">
            <label>
              <span>Gerekçe</span>
              <select value={reason} onChange={(event) => setReason(event.target.value)}>
                <option value="Havuz / tesis kaynaklı kapanış">Havuz / tesis kaynaklı kapanış</option>
                <option value="Hijyen tedbiri / tesis kararı">Hijyen tedbiri / tesis kararı</option>
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
              <span>{memberCount} aktif grup üyesi · seçili ders gününe kayıtlı kursiyerler server tarafında doğrulanır.</span>
            </div>
          )}
        </div>

        <div className="lessonOpsCard">
          <h2>2 · Telafi yöntemi</h2>
          <div className="modeCards">
            <button type="button" className={mode === "append_end" ? "active" : ""} onClick={() => setMode("append_end")}>
              <strong>✓ Kayıt sonuna otomatik ekle</strong>
              <span>Varsayılan. Öğrencinin mevcut telafili bitişinden sonraki ilk gerçek ders günü bulunur; aynı programda telafi oluşturulur.</span>
            </button>
            <button type="button" className={mode === "custom" ? "active" : ""} onClick={() => setMode("custom")}>
              <strong>Farklı tarih / seans planla</strong>
              <span>İstisnai durumda aynı grup içindeki başka uygun seansa telafi planla.</span>
            </button>
            <button type="button" className={mode === "reserve" ? "active" : ""} onClick={() => setMode("reserve")}>
              <strong>Hakkı saklı tut, sonra planla</strong>
              <span>Henüz tarih belli değilse iptal kaydedilir; veliye telafi hakkının saklı olduğu bildirilir.</span>
            </button>
          </div>

          {mode === "custom" && (
            <div className="fieldGrid customFields">
              <label>
                <span>Telafi Tarihi</span>
                <input type="date" value={customDate} onChange={(event) => setCustomDate(event.target.value)} />
              </label>
              <label>
                <span>Telafi Seansı</span>
                <select value={customScheduleId} onChange={(event) => setCustomScheduleId(event.target.value)}>
                  <option value="">Seans seçin</option>
                  {groupSchedules.map((schedule) => (
                    <option key={schedule.id} value={schedule.id}>{scheduleText(schedule)}</option>
                  ))}
                </select>
              </label>
            </div>
          )}

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

          {result && <div className="resultBox">{result}</div>}
        </div>
      </section>

      {preparedMessages.length > 0 && (
        <section className="lessonOpsCard messageSection">
          <div className="messageHead">
            <div>
              <span>3 · VELİ BİLGİLENDİRME</span>
              <h2>{preparedMessages.length} mesaj hazır</h2>
              <p>Her mesaj gerçek öğrenci tarihlerini kullanır. Önce iptal bilgisi, sonra telafi ve iki bitiş tarihi gösterilir.</p>
            </div>
            <button type="button" className="whatsappButton" onClick={openNextWhatsapp}>
              {openedStudentIds.length
                ? `Sıradaki Mesajı Aç (${openedStudentIds.length}/${preparedMessages.filter((item) => item.recipient).length})`
                : `WhatsApp Gönderimini Başlat (${preparedMessages.filter((item) => item.recipient).length})`}
            </button>
          </div>

          <div className="messageList">
            {preparedMessages.map((item) => (
              <article key={item.studentId}>
                <div>
                  <strong>{item.studentName}</strong>
                  <span>{item.recipient ? "WhatsApp hazır" : "Telefon bilgisi yok"}</span>
                </div>
                <div className="dateCompare">
                  <span>Normal bitiş <b>{formatDate(item.oldNormalEndDate)}</b></span>
                  <span>Güncellenen bitiş <b>{formatDate(item.newCompensationEndDate)}</b></span>
                  <span>Telafi <b>{formatDate(item.compensationDate)}</b></span>
                </div>
                <span className={openedStudentIds.includes(item.studentId) ? "sentFlag opened" : "sentFlag"}>
                  {openedStudentIds.includes(item.studentId) ? "WhatsApp açıldı" : item.recipient ? "Sırada" : "Eksik"}
                </span>
              </article>
            ))}
          </div>
        </section>
      )}

      <style jsx>{`
        .lessonOpsShell{display:grid;gap:18px;color:#10233f}.lessonOpsHero{display:flex;justify-content:space-between;gap:20px;padding:26px;border-radius:22px;background:linear-gradient(135deg,#061f3d,#0a4f8c);color:#fff;box-shadow:0 18px 45px rgba(15,58,107,.18)}.lessonOpsHero>div:first-child{max-width:760px}.lessonOpsHero span{font-size:11px;font-weight:900;letter-spacing:.1em;color:#ffad2f}.lessonOpsHero h1{margin:7px 0 8px;font-size:30px}.lessonOpsHero p{margin:0;color:rgba(255,255,255,.82);line-height:1.6}.heroRule{min-width:260px;max-width:330px;padding:16px;border:1px solid rgba(255,255,255,.2);border-radius:16px;background:rgba(255,255,255,.08);display:grid;gap:6px}.heroRule strong{font-size:13px}.heroRule span{font-size:12px;line-height:1.5;color:#fff;letter-spacing:0}.lessonOpsGrid{display:grid;grid-template-columns:1fr 1fr;gap:18px}.lessonOpsCard{background:#fff;border:1px solid #dce5ef;border-radius:18px;padding:20px;box-shadow:0 10px 30px rgba(22,53,88,.06)}.lessonOpsCard h2{margin:0 0 16px;font-size:20px}.fieldGrid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.fieldGrid+ .fieldGrid{margin-top:12px}.fieldGrid label,.customFields label{display:grid;gap:6px}.fieldGrid label>span{font-size:12px;font-weight:800;color:#526980}.fieldGrid select,.fieldGrid input{width:100%;min-height:44px;border:1px solid #cfdaE7;border-radius:11px;padding:0 11px;background:#fff;color:#17345c;font:inherit}.sourcePreview{display:grid;gap:4px;margin-top:14px;padding:13px;border-radius:12px;background:#eef6ff;border:1px solid #cfe2f8}.sourcePreview span{font-size:12px;color:#5a718a}.modeCards{display:grid;gap:9px}.modeCards button{display:grid;gap:5px;text-align:left;padding:14px;border:1px solid #d8e2ed;border-radius:13px;background:#fff;color:#17345c;cursor:pointer}.modeCards button.active{border-color:#1671e8;background:#eef6ff;box-shadow:0 0 0 2px rgba(22,113,232,.08)}.modeCards strong{font-size:13px}.modeCards span{font-size:11px;line-height:1.5;color:#60758c}.customFields{margin-top:14px}.checkRow{display:flex;gap:10px;align-items:flex-start;margin-top:14px;padding:13px;border:1px solid #d7e5dc;border-radius:12px;background:#f2fbf6}.checkRow input{width:18px;height:18px;margin-top:2px}.checkRow strong,.checkRow span{display:block}.checkRow strong{font-size:13px;color:#15603c}.checkRow span{margin-top:4px;font-size:11px;color:#5d7467;line-height:1.45}.ruleBox{margin-top:14px;padding:14px;border-radius:12px;background:#fff8ea;border:1px solid #efd3a3}.ruleBox strong{color:#8a5713}.ruleBox p{margin:5px 0 0;font-size:12px;line-height:1.6;color:#705b3c}.applyButton{width:100%;margin-top:14px;min-height:48px;border:0;border-radius:12px;background:#1268d6;color:#fff;font-weight:900;cursor:pointer}.applyButton:disabled{opacity:.6;cursor:wait}.resultBox{margin-top:12px;padding:13px;border-radius:11px;background:#edf8f2;border:1px solid #c4e6d2;color:#17623b;font-size:13px;font-weight:800}.messageSection{padding:0;overflow:hidden}.messageHead{display:flex;justify-content:space-between;gap:16px;align-items:center;padding:20px;border-bottom:1px solid #dfe7ef}.messageHead>div>span{font-size:10px;font-weight:900;letter-spacing:.1em;color:#1671e8}.messageHead h2{margin:4px 0}.messageHead p{margin:0;color:#64748b;font-size:12px}.whatsappButton{border:0;border-radius:11px;padding:12px 14px;background:#1fa463;color:#fff;font-weight:900;cursor:pointer}.messageList{display:grid}.messageList article{display:grid;grid-template-columns:minmax(180px,1fr) 2fr auto;gap:14px;align-items:center;padding:13px 20px;border-bottom:1px solid #edf1f5}.messageList article:last-child{border-bottom:0}.messageList article>div:first-child strong,.messageList article>div:first-child span{display:block}.messageList article>div:first-child span{margin-top:3px;font-size:10px;color:#718096}.dateCompare{display:flex;gap:14px;flex-wrap:wrap}.dateCompare span{font-size:11px;color:#6a7f95}.dateCompare b{color:#17345c}.sentFlag{border-radius:999px;padding:6px 9px;background:#edf2f7;color:#64748b;font-size:10px;font-weight:900}.sentFlag.opened{background:#e1f6e9;color:#157044}@media(max-width:900px){.lessonOpsHero{flex-direction:column}.heroRule{max-width:none}.lessonOpsGrid{grid-template-columns:1fr}.fieldGrid{grid-template-columns:1fr}.messageHead{align-items:stretch;flex-direction:column}.messageList article{grid-template-columns:1fr}.whatsappButton{width:100%}}
      `}</style>
    </div>
  );
}
