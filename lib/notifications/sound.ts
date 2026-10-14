const SOUND_KEY="sprintos-notification-long-sound-v1";
let context:AudioContext|null=null;
export function notificationSoundEnabled(){try{return localStorage.getItem(SOUND_KEY)!=="off"}catch{return true}}
export function setNotificationSoundEnabled(enabled:boolean){try{localStorage.setItem(SOUND_KEY,enabled?"on":"off")}catch{}}
export async function unlockNotificationAudio(){
 if(typeof window==='undefined')return false;
 const Ctor=window.AudioContext||(window as any).webkitAudioContext;
 if(!Ctor)return false;
 try{if(!context||context.state==='closed')context=new Ctor();await context!.resume();return context!.state==='running'}catch{return false}
}
export async function playNotificationSound(force=false){
 if(!force&&!notificationSoundEnabled())return false;
 if(!context||context.state!=='running')return false;
 try{
  const start=context.currentTime;
  for(let i=0;i<4;i++){
   const oscillator=context.createOscillator(),gain=context.createGain();
   oscillator.type='sine';oscillator.frequency.setValueAtTime(i%2?784:660,start+i);
   gain.gain.setValueAtTime(0,start+i);gain.gain.linearRampToValueAtTime(.18,start+i+.04);gain.gain.exponentialRampToValueAtTime(.001,start+i+.85);
   oscillator.connect(gain);gain.connect(context.destination);oscillator.start(start+i);oscillator.stop(start+i+.9);
   oscillator.onended=()=>{oscillator.disconnect();gain.disconnect()};
  }return true;
 }catch{return false}
}
