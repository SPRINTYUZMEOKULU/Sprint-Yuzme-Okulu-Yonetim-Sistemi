"use client";

import { useEffect, useState } from "react";

type CalendarItem = {
  id: string;
  type: string;
  title: string;
  branchName?: string;
  description?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  reminderAt?: string | null;
};

type CalendarDay = {
  date: string;
  lessons: CalendarItem[];
  events: CalendarItem[];
  birthdays: CalendarItem[];
  holidays: CalendarItem[];
};

type CalendarPayload = {
  ok: boolean;
  month: string;
  days: CalendarDay[];
};

const trMonths = [
  "Ocak","Şubat","Mart","Nisan","Mayıs","Haziran",
  "Temmuz","Ağustos","Eylül","Ekim","Kasım","Aralık",
];

function turkeyToday() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const obj = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${obj.year}-${obj.month}-${obj.day}`;
}

function monthOf(date: string) {
  return date.slice(0, 7);
}

function shiftMonth(month: string, delta: number) {
  const [year, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(year, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export default function DashboardSmartCalendar() {
  const today = turkeyToday();
  const [month, setMonth] = useState(monthOf(today));
  const [data, setData] = useState<CalendarPayload | null>(null);
  const [selectedDate, setSelectedDate] = useState(today);
  const [openForm, setOpenForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [eventType, setEventType] = useState("note");
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderTime, setReminderTime] = useState("09:00");
  const [message, setMessage] = useState("");

  async function load(targetMonth = month) {
    try {
      const response = await fetch(`/api/dashboard/calendar?month=${targetMonth}`, { cache: "no-store" });
      const payload = await response.json();
      if (response.ok && payload.ok) setData(payload);
    } catch (error) {
      console.error("SprintOS takvim:", error);
    }
  }

  useEffect(() => {
    void load(month);
    const timer = window.setInterval(() => void load(month), 60000);
    return () => window.clearInterval(timer);
  }, [month]);

  const [year, monthNumber] = month.split("-").map(Number);
  const firstWeekdayRaw = new Date(`${month}-01T12:00:00+03:00`).getDay();
  const firstWeekday = firstWeekdayRaw === 0 ? 7 : firstWeekdayRaw;
  const blanks = Array.from({ length: firstWeekday - 1 }, (_, i) => i);

  const selected = data?.month === month ? data.days.find((d) => d.date === selectedDate) || null : null;
  const selectedItems = selected ? [...selected.holidays, ...selected.birthdays, ...selected.events] : [];
  const lessonSlots = new Map<string, { branch: string; start: string; end: string; lessons: CalendarItem[] }>();
  for (const lesson of selected?.lessons || []) {
    const branch = lesson.branchName || "Şube";
    const start = lesson.startTime || "";
    const end = lesson.endTime || "";
    const key = JSON.stringify([branch, start, end]);
    const slot = lessonSlots.get(key) || { branch, start, end, lessons: [] };
    slot.lessons.push(lesson);
    lessonSlots.set(key, slot);
  }
  const slots = [...lessonSlots.values()].sort((a, b) => a.start.localeCompare(b.start) || a.branch.localeCompare(b.branch, "tr"));

  function changeMonth(delta: number) {
    const next = shiftMonth(month, delta);
    setMonth(next);
    setSelectedDate(next === monthOf(today) ? today : `${next}-01`);
  }

  function lessonLabel(item: CalendarItem) {
    const last = item.title.split(" · ").at(-1)?.trim() || item.title;
    return /çocuk|yetişkin|takım|master|özel/i.test(last) ? last : item.title;
  }

  async function saveNote() {
    if (!title.trim() || saving) return;
    setSaving(true);
    setMessage("");
    try {
      const reminderAt = reminderEnabled
        ? new Date(`${selectedDate}T${reminderTime}:00+03:00`).toISOString()
        : null;
      const response = await fetch("/api/dashboard/calendar", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          eventDate: selectedDate,
          eventType,
          title: title.trim(),
          description: description.trim(),
          reminderAt,
        }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error || "Takvim kaydı oluşturulamadı.");
      setTitle("");
      setDescription("");
      setReminderEnabled(false);
      setMessage("Takvim kaydı eklendi.");
      await load(month);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Takvim kaydı oluşturulamadı.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <article className="smartCalendar">
      <div className="smartCalendarTop">
        <div>
          <span>SPRİNTOS TAKVİM</span>
          <h3>{trMonths[monthNumber - 1]} {year}</h3>
          <p>Dersler, doğum günleri, bayramlar, notlar ve hatırlatmalar.</p>
        </div>
        <div className="smartCalendarActions">
          <button type="button" aria-label="Önceki ay" onClick={() => changeMonth(-1)}>‹</button>
          <button type="button" onClick={() => { setMonth(monthOf(today)); setSelectedDate(today); }}>Bugün</button>
          <button type="button" aria-label="Sonraki ay" onClick={() => changeMonth(1)}>›</button>
        </div>
      </div>

      <div className="calendarWeekHead">
        {["Pzt","Sal","Çar","Per","Cum","Cmt","Paz"].map((d) => <span key={d}>{d}</span>)}
      </div>

      <div className="calendarGrid">
        {blanks.map((i) => <span className="calendarBlank" key={`blank-${i}`} />)}
        {(data?.month === month ? data.days : []).map((day) => {
          const active = day.date === selectedDate;
          const isToday = day.date === today;
          const lesson = day.lessons.length > 0;
          const holiday = day.holidays.length > 0;
          const birthday = day.birthdays.length > 0;
          const note = day.events.length > 0;
          return (
            <button
              key={day.date}
              type="button"
              className={`calendarDay${active ? " active" : ""}${isToday ? " today" : ""}`}
              aria-pressed={active}
              aria-label={`${day.date}: ${day.lessons.length} ders, ${day.events.length} not veya etkinlik, ${day.birthdays.length} doğum günü, ${day.holidays.length} tatil`}
              onClick={() => setSelectedDate(day.date)}
            >
              <b>{Number(day.date.slice(-2))}</b>
              <i className="calendarDots">
                {lesson ? <em className="lesson" /> : null}
                {holiday ? <em className="holiday" /> : null}
                {birthday ? <em className="birthday" /> : null}
                {note ? <em className="note" /> : null}
              </i>
            </button>
          );
        })}
      </div>

      <div className="calendarLegend">
        <span><i className="lesson" /> Ders</span>
        <span><i className="holiday" /> Bayram/Tatil</span>
        <span><i className="birthday" /> Doğum günü</span>
        <span><i className="note" /> Not/Etkinlik</span>
      </div>

      <div className="selectedCalendarDay">
        <div className="selectedCalendarHead">
          <div><small className="calendarAgendaLabel">GÜNÜN PROGRAMI</small><strong>{new Intl.DateTimeFormat("tr-TR", { day:"2-digit", month:"long", year:"numeric", weekday:"long" }).format(new Date(`${selectedDate}T12:00:00+03:00`))}</strong><span className="calendarAgendaSummary">{selected?.lessons.length || 0} ders · {selectedItems.length} etkinlik / not</span></div>
          <button className="calendarAddNote" type="button" aria-expanded={openForm} onClick={() => setOpenForm((value) => !value)}>+ Not / Hatırlatma</button>
        </div>
        {slots.length > 0 && <div className="calendarAgendaSlots">
          {slots.map((slot) => <section className="calendarAgendaSlot" key={JSON.stringify([slot.branch, slot.start, slot.end])}>
            <div className="calendarSlotTime"><strong>{slot.start || "Saat yok"}</strong>{slot.end && <span>{slot.end}</span>}</div>
            <div className="calendarSlotDetails"><strong>{slot.branch}</strong><div className="calendarSlotGroups">
              {slot.lessons.map((lesson) => <span key={lesson.id} title={lesson.title} aria-label={lesson.title}>{lessonLabel(lesson)}</span>)}
            </div></div>
          </section>)}
        </div>}
        {selectedItems.length ? (
          <div className="calendarItemList">
            {selectedItems.map((item, index) => (
              <div className={`calendarItem ${item.type}`} key={`${item.id}-${index}`}>
                <i />
                <div>
                  <b>{item.title}</b>
                  <span>{item.startTime ? `${item.startTime}${item.endTime ? ` - ${item.endTime}` : ""}` : item.branchName || item.description || ""}</span>
                </div>
              </div>
            ))}
          </div>
        ) : !slots.length && <div className="calendarEmpty">Bu gün için kayıt bulunmuyor.</div>}
      </div>

      {openForm ? (
        <div className="calendarNoteForm">
          <div className="calendarNoteGrid">
            <label>Tür
              <select value={eventType} onChange={(e) => setEventType(e.target.value)}>
                <option value="note">Not</option>
                <option value="event">Etkinlik</option>
                <option value="reminder">Hatırlatma</option>
                <option value="pool_closure">Havuz / tesis notu</option>
              </select>
            </label>
            <label>Başlık
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Örn. Veli aranacak" />
            </label>
            <label className="full">Açıklama
              <textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="İsteğe bağlı detay" />
            </label>
            <label className="reminderToggle">
              <input type="checkbox" checked={reminderEnabled} onChange={(e) => setReminderEnabled(e.target.checked)} />
              Bildirim hatırlatması oluştur
            </label>
            {reminderEnabled ? <label>Hatırlatma saati<input type="time" value={reminderTime} onChange={(e) => setReminderTime(e.target.value)} /></label> : null}
          </div>
          <div className="calendarFormActions">
            <span>{message}</span>
            <button type="button" onClick={() => setOpenForm(false)}>Kapat</button>
            <button className="save" type="button" disabled={saving || !title.trim()} onClick={saveNote}>{saving ? "Kaydediliyor…" : "Kaydet"}</button>
          </div>
        </div>
      ) : null}

      <style jsx global>{`
        .dashboardContent .calendarAgendaLabel{display:block;font-size:10px;font-weight:900;letter-spacing:1.2px;color:#7387a3;margin-bottom:6px}
        .dashboardContent .calendarAgendaSummary{display:block;margin-top:6px;font-size:11px;color:#778ba4}
        .dashboardContent .selectedCalendarHead .calendarAddNote{background:#176de9;color:#fff;border-color:#176de9;white-space:nowrap}
        .calendarAgendaSlots{display:grid;gap:10px;margin-top:16px}.calendarAgendaSlot{display:grid;grid-template-columns:72px minmax(0,1fr);gap:14px;align-items:center;padding:15px;border:1px solid #dfe8f5;border-radius:15px;background:#fff}
        .calendarSlotTime{display:grid;gap:5px;align-self:start;padding:10px 4px;text-align:center;border-radius:12px;background:#eef5ff;color:#176de9}.calendarSlotTime strong{font-size:16px}.calendarSlotTime span{font-size:11px;color:#7a91af}
        .calendarSlotDetails{min-width:0}.calendarSlotDetails>strong{display:block;color:#203653;font-size:13px;line-height:1.45;overflow-wrap:anywhere}.calendarSlotGroups{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}.calendarSlotGroups>span{padding:5px 9px;border:1px solid #dfebfa;border-radius:8px;background:#f6f9ff;color:#416083;font-size:11px;line-height:1.4;overflow-wrap:anywhere}
        @media(max-width:640px){.dashboardContent .smartCalendar{padding:16px}.dashboardContent .calendarDay{min-height:44px}.dashboardContent .calendarWeekHead{margin-top:14px}.dashboardContent .calendarLegend{gap:5px;font-size:9px}.dashboardContent .calendarLegend span{padding:5px 7px}.calendarAgendaSlot{grid-template-columns:62px minmax(0,1fr);gap:10px;padding:12px}.dashboardContent .selectedCalendarHead{flex-direction:row;align-items:center;flex-wrap:wrap}.dashboardContent .selectedCalendarHead .calendarAddNote{min-height:38px;font-size:11px;padding:0 10px}}

        .smartCalendar{margin:0 0 14px;border:1px solid #dfe7f1;border-radius:20px;background:#fff;box-shadow:0 9px 26px rgba(15,23,42,.035);padding:17px 18px}
        .smartCalendarTop{display:flex;align-items:flex-start;justify-content:space-between;gap:14px}.smartCalendarTop>div:first-child>span{display:block;color:#6f829e;font-size:10px;font-weight:900;letter-spacing:1.45px}.smartCalendarTop h3{margin:4px 0 2px;color:#10213e;font-size:20px}.smartCalendarTop p{margin:0;color:#8292a7;font-size:10px}
        .smartCalendarActions{display:flex;gap:7px;align-items:center}.smartCalendarActions button,.selectedCalendarHead button,.calendarFormActions button{border:1px solid #dce6f2;background:#f8fbff;color:#31506f;border-radius:10px;min-height:34px;padding:0 10px;font:inherit;font-size:10px;font-weight:900;cursor:pointer}.smartCalendarActions button.add,.calendarFormActions button.save{background:#176de9;color:#fff;border-color:#176de9}
        .calendarWeekHead,.calendarGrid{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:5px}.calendarWeekHead{margin:3px 0 5px}.calendarWeekHead span{text-align:center;color:#92a0b2;font-size:8px;font-weight:900}.calendarBlank{min-height:42px}.calendarDay{position:relative;min-height:44px;border:1px solid #edf1f6;border-radius:11px;background:#fbfcfe;color:#203653;cursor:pointer}.calendarDay b{font-size:10px}.calendarDay.today{border-color:#79aef6;background:#f3f8ff}.calendarDay.active{box-shadow:inset 0 0 0 2px #176de9}.calendarDots{position:absolute;left:50%;bottom:6px;transform:translateX(-50%);display:flex;gap:3px}.calendarDots em,.calendarLegend i{width:5px;height:5px;border-radius:50%;display:inline-block}.calendarDots .lesson,.calendarLegend .lesson{background:#2678ec}.calendarDots .holiday,.calendarLegend .holiday{background:#ef4444}.calendarDots .birthday,.calendarLegend .birthday{background:#8b5cf6}.calendarDots .note,.calendarLegend .note{background:#f59e0b}
        .calendarLegend{display:flex;gap:12px;flex-wrap:wrap;margin-top:10px;color:#718299;font-size:8px}.calendarLegend span{display:inline-flex;align-items:center;gap:4px}
        .selectedCalendarDay{margin-top:13px;padding-top:12px;border-top:1px solid #edf1f6}.selectedCalendarHead{display:flex;justify-content:space-between;align-items:center;gap:10px}.selectedCalendarHead strong{color:#17304f;font-size:11px}.calendarItemList{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;margin-top:9px}.calendarItem{display:flex;align-items:flex-start;gap:7px;padding:9px;border:1px solid #e4ebf4;border-radius:11px;background:#fbfcfe}.calendarItem>i{width:7px;height:7px;border-radius:50%;margin-top:3px;background:#2678ec}.calendarItem.holiday>i{background:#ef4444}.calendarItem.birthday>i{background:#8b5cf6}.calendarItem.note>i,.calendarItem.event>i,.calendarItem.reminder>i{background:#f59e0b}.calendarItem b{display:block;color:#203653;font-size:9px}.calendarItem span{display:block;margin-top:2px;color:#8291a5;font-size:8px}.calendarEmpty{padding:11px 0;color:#91a0b2;font-size:9px}
        .calendarNoteForm{margin-top:12px;padding:12px;border:1px solid #dbe7f5;border-radius:14px;background:#f8fbff}.calendarNoteGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.calendarNoteGrid label{display:flex;flex-direction:column;gap:4px;color:#526a84;font-size:8px;font-weight:900}.calendarNoteGrid label.full{grid-column:1/-1}.calendarNoteGrid input,.calendarNoteGrid select,.calendarNoteGrid textarea{border:1px solid #d6e2ef;border-radius:9px;background:#fff;padding:8px;font:inherit;font-size:10px;color:#203653}.calendarNoteGrid .reminderToggle{flex-direction:row;align-items:center}.calendarNoteGrid .reminderToggle input{width:auto}.calendarFormActions{display:flex;align-items:center;justify-content:flex-end;gap:7px;margin-top:9px}.calendarFormActions span{margin-right:auto;color:#16875b;font-size:8px}
        @media(max-width:640px){.smartCalendar{padding:14px;border-radius:17px}.smartCalendarTop{flex-direction:column}.smartCalendarActions{width:100%}.smartCalendarActions button{flex:1}.calendarDay{min-height:40px}.calendarItemList{grid-template-columns:1fr}.selectedCalendarHead{align-items:flex-start;flex-direction:column}.calendarNoteGrid{grid-template-columns:1fr}.calendarNoteGrid label.full{grid-column:auto}}
      `}</style>
    </article>
  );
}
