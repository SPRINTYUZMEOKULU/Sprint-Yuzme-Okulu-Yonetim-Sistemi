const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
const calls=[],values=new Map();global.localStorage={getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)};
class AudioContext{constructor(){this.state='suspended';this.currentTime=0;this.destination={}}async resume(){this.state='running'}createOscillator(){return {frequency:{setValueAtTime(f){calls.push(['frequency',f])}},connect(){},disconnect(){},start:t=>calls.push(['start',t]),stop:t=>calls.push(['stop',t])}}createGain(){return {gain:{setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){},disconnect(){}}}}
global.window={AudioContext};const mod={exports:{}};new Function('module','exports',ts.transpileModule(fs.readFileSync('lib/notifications/sound.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText)(mod,mod.exports);const s=mod.exports;
test('five distinct previews require audio unlock, preserve selected tone, and respect mute',async()=>{
 assert.equal(await s.playNotificationSound(),false);assert.equal(await s.unlockNotificationAudio(),true);assert.equal(s.NOTIFICATION_TONES.length,5);
 s.setNotificationTone('marimba');
 const durations=[];
 for(const tone of s.NOTIFICATION_TONES){calls.length=0;assert.equal(await s.playNotificationSound(true,tone.id),true);const duration=Math.max(...calls.filter(c=>c[0]==='stop'&&typeof c[1]==='number').map(c=>c[1]));durations.push(duration);assert.equal(s.getNotificationTone(),'marimba');}
 assert.deepEqual(durations,[2.8,3.5,3.2,2.2,4.6]);s.setNotificationSoundEnabled(false);assert.equal(await s.playNotificationSound(),false);assert.equal(await s.playNotificationSound(true),true);
});
test('invalid saved tone falls back to the new bell; volume persists and stays bounded',()=>{values.set('sprintos-notification-tone-v2','invalid');assert.equal(s.getNotificationTone(),'soft-bell');s.setNotificationVolume(.8);assert.equal(s.getNotificationVolume(),.8);s.setNotificationVolume(99);assert.equal(s.getNotificationVolume(),1);s.setNotificationVolume(-1);assert.equal(s.getNotificationVolume(),.25)});
