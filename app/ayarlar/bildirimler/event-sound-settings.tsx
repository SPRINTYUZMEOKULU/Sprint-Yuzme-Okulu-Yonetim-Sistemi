"use client";
import { useEffect, useState } from "react";
import { NOTIFICATION_SOUND_EVENTS, NOTIFICATION_TONES, getEventNotificationTone, setEventNotificationTone, unlockNotificationAudio, playNotificationSound, type NotificationTone, type EventSoundChoice, type NotificationSoundEvent } from "@/lib/notifications/sound";

function readChoices() {
  return Object.fromEntries(NOTIFICATION_SOUND_EVENTS.map(event => [event.id, getEventNotificationTone(event.id)])) as Record<NotificationSoundEvent, EventSoundChoice>;
}
export default function EventSoundSettings({ generalTone }: { generalTone: NotificationTone }) {
  const [choices, setChoices] = useState<Record<NotificationSoundEvent, EventSoundChoice> | null>(null);
  const [message, setMessage] = useState("");
  useEffect(() => {
    const sync = () => setChoices(readChoices());
    sync(); window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, [generalTone]);
  async function preview(id: NotificationSoundEvent) {
    const tone = getEventNotificationTone(id);
    if (tone === "off") return;
    const played = await unlockNotificationAudio() && await playNotificationSound(true, tone);
    setMessage(played ? "Ses önizlemesi çalınıyor." : "Ses başlatılamadı. Cihazınızın ses ayarlarını kontrol edin.");
  }
  return <section className="eventSoundSettings" data-ui-sound="off" aria-labelledby="event-sound-heading">
    <h3 id="event-sound-heading">Duruma Göre Bildirim Sesleri</h3>
    <p>Her bildirim türünü sesinden ayırt edin. Seçimler bu cihazda otomatik saklanır. Bildirim seslerini yukarıdaki anahtarla topluca kapatabilirsiniz; önizleme yalnızca Dinle düğmesiyle çalar.</p>
    <div className="eventSoundRows">
      {NOTIFICATION_SOUND_EVENTS.map(event => <div className="eventSoundRow" key={event.id}>
        <label htmlFor={`event-sound-${event.id}`}>{event.name}</label>
        <select id={`event-sound-${event.id}`} disabled={!choices} value={choices?.[event.id] || event.tone} onChange={e => {
          setEventNotificationTone(event.id, e.target.value as EventSoundChoice);
          setChoices(readChoices()); setMessage(`${event.name} ses tercihi kaydedildi.`);
        }}>
          <option value="off">Sessiz</option>
          {NOTIFICATION_TONES.map(tone => <option value={tone.id} key={tone.id}>{tone.name}</option>)}
        </select>
        <button type="button" disabled={!choices || choices[event.id] === "off"} aria-label={`${event.name} sesini dinle`} onClick={() => void preview(event.id)}>Dinle</button>
      </div>)}
    </div>
    <button type="button" disabled={!choices} onClick={() => {
      for (const event of NOTIFICATION_SOUND_EVENTS) setEventNotificationTone(event.id, "default");
      setChoices(readChoices()); setMessage("Bildirim türlerinin varsayılan sesleri geri yüklendi.");
    }}>Varsayılan seslere dön</button>
    <p role="status">{message}</p>
    <p>Farklı sesler uygulama açıkken çalışır. Uygulama kapalıyken telefon bildirim sesini iOS yönetir.</p>
    <style jsx>{`
      .eventSoundSettings{min-width:0;margin-bottom:24px;padding-bottom:18px;border-bottom:1px solid #dce5f0}
      h3{margin:0 0 8px;color:#162b49;font-size:16px}p{font-size:12px;line-height:1.6;color:#64748b}
      .eventSoundRows{display:grid;gap:10px;margin:16px 0}.eventSoundRow{display:grid;grid-template-columns:minmax(0,1fr) minmax(130px,180px) auto;align-items:center;gap:10px;padding:12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px}
      label{font-size:12px;font-weight:650;overflow-wrap:anywhere}select,button{font:inherit;font-size:12px;min-height:42px;border:1px solid #cbd5e1;border-radius:9px;background:white;color:#18314e;padding:8px 12px;max-width:100%}select{width:100%;min-width:0}button{cursor:pointer}button:disabled{opacity:.5;cursor:default}select:focus-visible,button:focus-visible{outline:3px solid #93b8fa;outline-offset:2px}
      @media(max-width:640px){.eventSoundRow{grid-template-columns:minmax(0,1fr) auto}.eventSoundRow label{grid-column:1/-1}}
    `}</style>
  </section>;
}
