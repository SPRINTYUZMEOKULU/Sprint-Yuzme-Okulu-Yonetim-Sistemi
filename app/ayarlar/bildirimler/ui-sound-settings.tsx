"use client";
import { useEffect, useState } from "react";
import { getUiSoundPreferences, setUiSoundPreferences, playUiClick, UI_SOUND_CHANGE } from "@/lib/ui-sound";
export default function UiSoundSettings() {
  const [preferences, setPreferences] = useState({ enabled: true, volume: .35 });
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    const sync = () => setPreferences(getUiSoundPreferences());
    sync(); setReady(true);
    window.addEventListener("storage", sync);
    window.addEventListener(UI_SOUND_CHANGE, sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener(UI_SOUND_CHANGE, sync);
    };
  }, []);
  function update(next: typeof preferences) {
    setPreferences(next); setUiSoundPreferences(next);
  }
  return <section className="deviceSection" data-ui-sound="off" aria-labelledby="ui-sound-title">
    <div className="deviceSectionHead"><div><span>BU CİHAZ</span><h2 id="ui-sound-title">Menü ve Tuş Sesleri</h2><p>Menü geçişleri ve butonlara basıldığında hafif bir tıklama sesi çalar. Tercihiniz bu cihazda hatırlanır. Bildirim sesleri ayrı yönetilir.</p></div></div>
    <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center" }}>
      <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <input type="checkbox" role="switch" checked={preferences.enabled} disabled={!ready} onChange={event => update({ ...preferences, enabled: event.target.checked })} />
        Menü ve tuş sesleri {preferences.enabled ? "açık" : "kapalı"}
      </label>
      <label style={{ display: "grid", gap: 6 }}>Tıklama sesi düzeyi · %{Math.round(preferences.volume * 100)}
        <input type="range" min="0" max="100" step="5" value={Math.round(preferences.volume * 100)} disabled={!ready || !preferences.enabled} onChange={event => update({ ...preferences, volume: Number(event.target.value) / 100 })} />
      </label>
      <button type="button" disabled={!ready || !preferences.enabled || preferences.volume === 0} onClick={async () => setMessage(await playUiClick() ? "Tıklama sesi çalındı." : "Ses çalınamadı. Cihazınızın ses ayarlarını kontrol edin.")}>Sesi dene</button>
    </div>
    <p role="status" style={{ fontSize: 12 }}>{message}</p>
  </section>;
}
