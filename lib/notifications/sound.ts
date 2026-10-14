const SOUND_KEY="sprintos-notification-long-sound-v1";
const TONE_KEY="sprintos-notification-tone-v2";
const VOLUME_KEY="sprintos-notification-volume-v2";
export const NOTIFICATION_TONES=[
 {id:"soft-bell",name:"Yumuşak Çan",description:"Yumuşak ve sıcak çan sesi",duration:"2,8 saniye"},
 {id:"clear-chime",name:"Kristal Melodi",description:"Üç notalı, net ve sakin melodi",duration:"3,5 saniye"},
 {id:"double-bell",name:"Çift Çan",description:"İki ayrı çan vuruşu",duration:"3,2 saniye"},
 {id:"marimba",name:"Marimba",description:"Ahşap tınılı, kısa ve doğal",duration:"2,2 saniye"},
 {id:"attention",name:"Belirgin Uyarı",description:"Daha uzun, dört notalı uyarı",duration:"4,6 saniye"}
] as const;
export type NotificationTone=typeof NOTIFICATION_TONES[number]['id'];
type Note={frequency:number;at:number;duration:number};
const NOTES:Record<NotificationTone,Note[]>={
 'soft-bell':[{frequency:523.25,at:0,duration:2.8}],
 'clear-chime':[{frequency:523.25,at:0,duration:2.3},{frequency:659.25,at:.6,duration:2.3},{frequency:783.99,at:1.2,duration:2.3}],
 'double-bell':[{frequency:587.33,at:0,duration:2.1},{frequency:783.99,at:1.1,duration:2.1}],
 'marimba':[{frequency:392,at:0,duration:1.4},{frequency:523.25,at:.4,duration:1.4},{frequency:659.25,at:.8,duration:1.4}],
 'attention':[{frequency:587.33,at:0,duration:1.6},{frequency:783.99,at:1,duration:1.6},{frequency:587.33,at:2,duration:1.6},{frequency:880,at:3,duration:1.6}]
};
let context:AudioContext|null=null;
let activeOscillators:OscillatorNode[]=[];
export function notificationSoundEnabled(){try{return localStorage.getItem(SOUND_KEY)!=="off"}catch{return true}}
export function setNotificationSoundEnabled(enabled:boolean){try{localStorage.setItem(SOUND_KEY,enabled?"on":"off")}catch{}}
export function getNotificationTone():NotificationTone{try{const tone=localStorage.getItem(TONE_KEY);return NOTIFICATION_TONES.some(t=>t.id===tone)?tone as NotificationTone:'soft-bell'}catch{return 'soft-bell'}}
export function setNotificationTone(tone:NotificationTone){if(!NOTIFICATION_TONES.some(t=>t.id===tone))return;try{localStorage.setItem(TONE_KEY,tone)}catch{}}
export function getNotificationVolume(){try{const raw=localStorage.getItem(VOLUME_KEY);return raw===null?.65:Math.max(.25,Math.min(1,Number(raw)||.65))}catch{return .65}}
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
  for(const note of NOTES[tone])for(const [ratio,weight] of [[1,1],[2.01,.19],[3.98,.045]]){
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
