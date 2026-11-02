const ENABLED_KEY = "sprintos-ui-sound-v1";
const VOLUME_KEY = "sprintos-ui-volume-v1";
export const UI_SOUND_CHANGE = "sprintos-ui-sound-change";
let enabled = true, volume = .35;
let context: AudioContext | null = null;
let lastPlayed = -Infinity;

export function getUiSoundPreferences() {
  try {
    enabled = localStorage.getItem(ENABLED_KEY) !== "off";
    const saved = localStorage.getItem(VOLUME_KEY);
    if (saved !== null && Number.isFinite(Number(saved))) volume = Math.max(0, Math.min(1, Number(saved)));
  } catch { /* Keep session preferences if storage is unavailable. */ }
  return { enabled, volume };
}
export function setUiSoundPreferences(next: { enabled: boolean; volume: number }) {
  enabled = next.enabled;
  volume = Number.isFinite(next.volume) ? Math.max(0, Math.min(1, next.volume)) : .35;
  try {
    localStorage.setItem(ENABLED_KEY, enabled ? "on" : "off");
    localStorage.setItem(VOLUME_KEY, String(volume));
  } catch { /* Muting still works for this session. */ }
  window.dispatchEvent(new Event(UI_SOUND_CHANGE));
}
export function isUiSoundTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) return false;
  if (target.closest('[data-ui-sound="off"], [inert], [aria-disabled="true"]')) return false;
  const control = target.closest('button, a[href], summary, [role="button"], [role="tab"], input[type="button"], input[type="submit"], input[type="reset"], input[type="checkbox"], input[type="radio"], select');
  return Boolean(control && !control.matches(':disabled, [aria-disabled="true"]'));
}
// Run directly from the user gesture for Safari. No downloads or API requests.
export async function playUiClick() {
  const prefs = getUiSoundPreferences();
  if (!prefs.enabled || prefs.volume === 0 || typeof window === "undefined") return false;
  const now = performance.now();
  if (now - lastPlayed < 65) return false;
  lastPlayed = now;
  try {
    const Ctor = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return false;
    if (!context || context.state === "closed") context = new Ctor();
    if (context.state !== "running") await context.resume();
    const current = getUiSoundPreferences();
    if (!current.enabled || current.volume === 0 || document.visibilityState === "hidden" || context.state !== "running") return false;
    const oscillator = context.createOscillator(), gain = context.createGain();
    const start = context.currentTime;
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(900, start);
    oscillator.frequency.exponentialRampToValueAtTime(450, start + .035);
    gain.gain.setValueAtTime(.0001, start);
    gain.gain.linearRampToValueAtTime(.12 * current.volume, start + .003);
    gain.gain.exponentialRampToValueAtTime(.0001, start + .045);
    oscillator.connect(gain); gain.connect(context.destination);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
    oscillator.start(start); oscillator.stop(start + .05);
    return true;
  } catch { return false; } // Sound must never interrupt the action.
}
