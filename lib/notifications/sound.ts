const SOUND_KEY="sprintos-notification-long-sound-v1";
const TONE_KEY="sprintos-notification-tone-v2";
const VOLUME_KEY="sprintos-notification-volume-v2";
export const NOTIFICATION_TONES=[
 {id:"soft-bell",name:"Yumuşak Çan",description:"Yumuşak ve sıcak çan sesi",duration:"2,8 saniye"},
 {id:"marimba",name:"Marimba",description:"Ahşap tınılı, kısa ve doğal",duration:"2,2 saniye"},
 {id:"bamboo",name:"Bambu",description:"Marimba gibi sıcak, iki hafif vuruş",duration:"2,6 saniye"},
 {id:"warm-piano",name:"Sakin Piyano",description:"Yumuşak üç notayla sakin bir melodi",duration:"3,4 saniye"},
 {id:"water-drop",name:"Su Damlası",description:"Hafif ve yuvarlak iki damla sesi",duration:"2,4 saniye"},
 {id:"payment-chime",name:"Tahsilat Çanı",description:"Ödeme için parlak iki kısa nota",duration:"0,9 saniye"},
 {id:"attendance-confirm",name:"Yoklama Onayı",description:"Net ve kısa yükselen onay",duration:"0,7 saniye"},
 {id:"reminder-pulse",name:"Hatırlatma",description:"Dikkat çeken iki yumuşak vuruş",duration:"1,2 saniye"},
 {id:"error-fall",name:"Hata Uyarısı",description:"Alçalan iki sakin nota",duration:"1 saniye"},
 {id:"gentle-melody",name:"Huzurlu Melodi",description:"Yumuşak çanlarla daha uzun bir melodi",duration:"4 saniye"}
] as const;
export type NotificationTone=typeof NOTIFICATION_TONES[number]['id'];
type Note={frequency:number;at:number;duration:number};
const NOTES:Record<NotificationTone,Note[]>={
 'payment-chime':[{frequency:1046.5,at:0,duration:.45},{frequency:1318.51,at:.2,duration:.7}],
 'attendance-confirm':[{frequency:523.25,at:0,duration:.3},{frequency:783.99,at:.15,duration:.55}],
 'reminder-pulse':[{frequency:440,at:0,duration:.45},{frequency:440,at:.65,duration:.55}],
 'error-fall':[{frequency:349.23,at:0,duration:.45},{frequency:261.63,at:.35,duration:.65}],
 'soft-bell':[{frequency:523.25,at:0,duration:2.8}],
 'marimba':[{frequency:392,at:0,duration:1.4},{frequency:523.25,at:.4,duration:1.4},{frequency:659.25,at:.8,duration:1.4}],
 'bamboo':[{frequency:349.23,at:0,duration:1.8},{frequency:440,at:.8,duration:1.8}],
 'warm-piano':[{frequency:261.63,at:0,duration:2.2},{frequency:329.63,at:.6,duration:2.2},{frequency:392,at:1.2,duration:2.2}],
 'water-drop':[{frequency:659.25,at:0,duration:1.6},{frequency:523.25,at:.8,duration:1.6}],
 'gentle-melody':[{frequency:392,at:0,duration:2.4},{frequency:493.88,at:.8,duration:2.4},{frequency:587.33,at:1.6,duration:2.4}]
};
// Softer overtones distinguish the new wooden, piano and rounded drop sounds.
const TIMBRES:Partial<Record<NotificationTone,number[]>>={
 'bamboo':[1,.08,.015],'warm-piano':[1,.12,.035],'water-drop':[1,.025,0],'gentle-melody':[1,.09,.02]
};
let context:AudioContext|null=null;
let activeOscillators:OscillatorNode[]=[];
export function notificationSoundEnabled(){try{return localStorage.getItem(SOUND_KEY)!=="off"}catch{return true}}
export function setNotificationSoundEnabled(enabled:boolean){try{localStorage.setItem(SOUND_KEY,enabled?"on":"off")}catch{}if(!enabled)stopNotificationSound()}
export function stopNotificationSound(){for(const oscillator of activeOscillators){try{oscillator.stop()}catch{}}activeOscillators=[];}
export function getNotificationTone():NotificationTone{try{const tone=localStorage.getItem(TONE_KEY);return NOTIFICATION_TONES.some(t=>t.id===tone)?tone as NotificationTone:'soft-bell'}catch{return 'soft-bell'}}
export function setNotificationTone(tone:NotificationTone){if(!NOTIFICATION_TONES.some(t=>t.id===tone))return;try{localStorage.setItem(TONE_KEY,tone)}catch{}}
export function getNotificationVolume(){try{const raw=localStorage.getItem(VOLUME_KEY);return raw===null ? .65 : Math.max(.25,Math.min(1,Number(raw)||.65))}catch{return .65}}
export function setNotificationVolume(volume:number){try{localStorage.setItem(VOLUME_KEY,String(Math.max(.25,Math.min(1,volume))))}catch{}}
export async function unlockNotificationAudio(){
 if(typeof window==='undefined')return false;
 const Ctor=window.AudioContext||(window as any).webkitAudioContext;
 if(!Ctor)return false;
 try{if(!context||context.state==='closed')context=new Ctor();await context!.resume();return context!.state==='running'}catch{return false}
}
export async function playNotificationSound(force=false,previewTone?:NotificationTone){
 if(!force&&!notificationSoundEnabled())return false;
 if(!context||context.state!=='running')return false;
 try{
  for(const oscillator of activeOscillators){try{oscillator.stop()}catch{}}
  activeOscillators=[];
  const start=context.currentTime,tone=previewTone||getNotificationTone(),volume=getNotificationVolume();
  const weights=TIMBRES[tone]||[1,.19,.045];
  for(const note of NOTES[tone])for(const [index,ratio] of [1,2.01,3.98].entries()){
   const weight=weights[index];if(!weight)continue;
   const oscillator=context.createOscillator(),gain=context.createGain();
   oscillator.type='sine';oscillator.frequency.setValueAtTime(note.frequency*ratio,start+note.at);
   const peak=.16*volume*weight;
   gain.gain.setValueAtTime(.0001,start+note.at);gain.gain.linearRampToValueAtTime(peak,start+note.at+.012);gain.gain.exponentialRampToValueAtTime(.0001,start+note.at+note.duration);
   oscillator.connect(gain);gain.connect(context.destination);oscillator.start(start+note.at);oscillator.stop(start+note.at+note.duration);
   activeOscillators.push(oscillator);
   oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();activeOscillators=activeOscillators.filter(item=>item!==oscillator)};
  }return true;
 }catch{return false}
}


export const NOTIFICATION_SOUND_EVENTS = [
 { id: "payment", name: "Ödeme alındı / kasa teslimi", tone: "payment-chime" },
 { id: "attendance-saved", name: "Yoklama kaydedildi / derse katıldı", tone: "attendance-confirm" },
 { id: "attendance-missing", name: "Yoklama alınmadı", tone: "reminder-pulse" },
 { id: "absence", name: "Kursiyer derse gelmedi", tone: "bamboo" },
 { id: "success", name: "Olumlu işlem / onay", tone: "gentle-melody" },
 { id: "warning", name: "Hatırlatma / bekleyen işlem", tone: "warm-piano" },
 { id: "error", name: "Hata / ret / iptal", tone: "error-fall" },
 { id: "info", name: "Genel bilgilendirme", tone: "soft-bell" },
] as const;
export type NotificationSoundEvent = typeof NOTIFICATION_SOUND_EVENTS[number]["id"];
export type EventSoundChoice = NotificationTone | "off";
export type SoundNotification = { eventKey?: string | null; severity?: string | null; priority?: string | null };
const EVENT_SOUND_KEY = "sprintos-event-sound-v1:";

// Event keys take precedence over generic severity; never infer success from a title.
export function notificationSoundEvent(item: SoundNotification): NotificationSoundEvent {
 const key = (item.eventKey || "").split(":")[0];
 if (["error", "critical"].includes(item.severity || "") || /_(rejected|failed|cancelled|denied)$/.test(key)) return "error";
 if (key === "attendance_missing") return "attendance-missing";
 if (["attendance_absent", "guardian_attendance_absent", "first_lesson_absent"].includes(key)) return "absence";
 if (["payment_received", "cash_handover_approved", "financial_obligation_payment"].includes(key)) return "payment";
 if (["attendance_saved", "attendance_completed", "first_lesson_attended"].includes(key)) return "attendance-saved";
 if (item.severity === "warning" || item.priority === "high" || item.priority === "critical") return "warning";
 if (item.severity === "success") return "success";
 return "info";
}
export function getEventNotificationTone(event: NotificationSoundEvent): EventSoundChoice {
 try {
  const saved = localStorage.getItem(EVENT_SOUND_KEY + event);
  if (saved === "off" || NOTIFICATION_TONES.some(t => t.id === saved)) return saved as EventSoundChoice;
 } catch {}
 return event === "info" ? getNotificationTone() : NOTIFICATION_SOUND_EVENTS.find(option => option.id === event)!.tone;
}
export function setEventNotificationTone(event: NotificationSoundEvent, tone: EventSoundChoice | "default") {
 if (!NOTIFICATION_SOUND_EVENTS.some(option => option.id === event)) return;
 if (tone !== "default" && tone !== "off" && !NOTIFICATION_TONES.some(option => option.id === tone)) return;
 try {
  if (tone === "default") localStorage.removeItem(EVENT_SOUND_KEY + event);
  else localStorage.setItem(EVENT_SOUND_KEY + event, tone);
 } catch {}
}
export async function playEventNotificationSound(item: SoundNotification) {
 const tone = getEventNotificationTone(notificationSoundEvent(item));
 if (tone === "off") return false;
 return playNotificationSound(false, tone);
}
