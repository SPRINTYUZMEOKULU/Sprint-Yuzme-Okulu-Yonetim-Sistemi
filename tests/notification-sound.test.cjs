const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
const calls=[],values=new Map();global.localStorage={getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};
class AudioContext{constructor(){this.state='suspended';this.currentTime=0;this.destination={}}async resume(){this.state='running'}createOscillator(){return {frequency:{setValueAtTime(f){calls.push(['frequency',f])}},connect(){},disconnect(){},start:t=>calls.push(['start',t]),stop:t=>calls.push(['stop',t])}}createGain(){return {gain:{setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){},disconnect(){}}}}
global.window={AudioContext};const mod={exports:{}};new Function('module','exports',ts.transpileModule(fs.readFileSync('lib/notifications/sound.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText)(mod,mod.exports);const s=mod.exports;
test('ten distinct previews require audio unlock, preserve selected tone, and respect mute',async()=>{
 assert.equal(await s.playNotificationSound(),false);assert.equal(await s.unlockNotificationAudio(),true);assert.equal(s.NOTIFICATION_TONES.length,10);
 s.setNotificationTone('marimba');
 const durations=[];
 for(const tone of s.NOTIFICATION_TONES){calls.length=0;assert.equal(await s.playNotificationSound(true,tone.id),true);const duration=Math.max(...calls.filter(c=>c[0]==='stop'&&typeof c[1]==='number').map(c=>c[1]));durations.push(Number(duration.toFixed(2)));assert.equal(s.getNotificationTone(),'marimba');}
 assert.deepEqual(durations,[2.8,2.2,2.6,3.4,2.4,.9,.7,1.2,1,4]);s.setNotificationSoundEnabled(false);assert.equal(await s.playNotificationSound(),false);assert.equal(await s.playNotificationSound(true),true);
});
test('invalid saved tone falls back to the new bell; volume persists and stays bounded',()=>{values.set('sprintos-notification-tone-v2','invalid');assert.equal(s.getNotificationTone(),'soft-bell');s.setNotificationVolume(.8);assert.equal(s.getNotificationVolume(),.8);s.setNotificationVolume(99);assert.equal(s.getNotificationVolume(),1);s.setNotificationVolume(-1);assert.equal(s.getNotificationVolume(),.25)});


test('event routing distinguishes receipts, pending money, saved/missing attendance, absence and outcomes',()=>{
 const cases=[
  [{eventKey:'payment_received',severity:'success'},'payment'],
  [{eventKey:'cash_handover_approved'},'payment'],
  [{eventKey:'financial_obligation_payment'},'payment'],
  [{eventKey:'payment_due',severity:'warning'},'warning'],
  [{eventKey:'payment_cancel_requested',severity:'warning'},'warning'],
  [{eventKey:'payment_cancelled',severity:'success'},'error'],
  [{eventKey:'payment_received',severity:'error'},'error'],
  [{eventKey:'attendance_saved'},'attendance-saved'],
  [{eventKey:'first_lesson_attended',severity:'success'},'attendance-saved'],
  [{eventKey:'attendance_missing',severity:'warning'},'attendance-missing'],
  [{eventKey:'attendance_absent:student:date:schedule',severity:'warning'},'absence'],
  [{eventKey:'guardian_attendance_absent:student:date:schedule'},'absence'],
  [{eventKey:'first_lesson_absent'},'absence'],
  [{eventKey:'registration_approved',severity:'success'},'success'],
  [{eventKey:'request_rejected',severity:'warning'},'error'],
  [{severity:'critical'},'error'],
  [{priority:'high'},'warning'],
  [{eventKey:'unknown'},'info'],[{},'info']
 ];
 for(const [item,expected] of cases)assert.equal(s.notificationSoundEvent(item),expected,JSON.stringify(item));
});
test('each default category has a distinct sound; per-category silence and master mute apply to actual playback',async()=>{
 values.clear();
 assert.equal(new Set(s.NOTIFICATION_SOUND_EVENTS.map(e=>s.getEventNotificationTone(e.id))).size,8);
 s.setEventNotificationTone('payment','water-drop');
 assert.equal(s.getEventNotificationTone('payment'),'water-drop');
 calls.length=0;assert.equal(await s.playEventNotificationSound({eventKey:'payment_received'}),true);
 assert.equal(calls.find(c=>c[0]==='frequency')[1],659.25);
 s.setEventNotificationTone('payment','off');calls.length=0;
 assert.equal(await s.playEventNotificationSound({eventKey:'payment_received'}),false);assert.equal(calls.length,0);
 assert.equal(await s.playEventNotificationSound({eventKey:'attendance_saved'}),true);
 s.setNotificationSoundEnabled(false);calls.length=0;
 assert.equal(await s.playEventNotificationSound({eventKey:'attendance_saved'}),false);assert.equal(calls.length,0);
 s.setEventNotificationTone('payment','default');assert.equal(s.getEventNotificationTone('payment'),'payment-chime');
 values.set('sprintos-event-sound-v1:payment','corrupt');assert.equal(s.getEventNotificationTone('payment'),'payment-chime');
 s.setNotificationTone('marimba');assert.equal(s.getEventNotificationTone('info'),'marimba');
 s.setEventNotificationTone('info','bamboo');s.setNotificationTone('soft-bell');assert.equal(s.getEventNotificationTone('info'),'bamboo');
});
