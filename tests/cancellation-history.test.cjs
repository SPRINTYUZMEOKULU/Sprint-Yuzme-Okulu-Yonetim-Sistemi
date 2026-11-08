const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
const m={exports:{}};new Function('module','exports',ts.transpileModule(fs.readFileSync('lib/lesson-operations/history.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText)(m,m.exports);
const build=m.exports.buildCancellationHistory;
const log=(student,type='lesson_cancellation_compensation',time='2026-10-22T12:00:00Z',schedule='s')=>({student_id:student,activity_type:type,source_id:schedule,old_value:{cancelled_lesson_date:'2026-10-22'},new_value:{compensation_date:'2026-10-25'},performed_at:time,description:'Açıklama'});
function run(logs,messages=[]){return build(logs,messages,new Map([['a','Ali'],['b','Ayşe']]),new Map([['s',{group_id:'g',start_time:'19:00:00'}]]),new Map([['g','Çocuk']]));}
test('history restores saved cancellation without writing or reapplying it',()=>{const [s]=run([log('a'),log('b','lesson_cancellation_skipped')]);assert.equal(s.groupName,'Çocuk');assert.equal(s.students.length,2);assert.equal(s.hasSkippedRecords,true);assert.equal(s.students.find(r=>r.studentId==='b').status,'skipped');});
test('latest student result wins when an earlier skip was later completed',()=>{const [s]=run([log('a','lesson_cancellation_skipped','2026-10-22T11:00:00Z'),log('a')]);assert.equal(s.students.length,1);assert.equal(s.students[0].status,'processed');});
test('legacy data does not fabricate skipped students',()=>{const [s]=run([log('a')]);assert.equal(s.hasSkippedRecords,false);assert.equal(s.students.filter(r=>r.status==='skipped').length,0);});
test('message joins require student, schedule and cancellation date; latest persisted status wins',()=>{const msg={student_id:'a',metadata:{source_schedule_id:'s',cancelled_date:'2026-10-22'},message_body:'Doğru mesaj',status:'sent',prepared_at:'2026-10-22T12:00:00Z'};const [s]=run([log('a')],[msg,{...msg,student_id:'b',message_body:'Başka kişi'},{...msg,metadata:{...msg.metadata,source_schedule_id:'other'},message_body:'Başka seans'}]);assert.equal(s.students[0].message,'Doğru mesaj');assert.equal(s.students[0].messageStatus,'sent');});

test('bulk corrected message supplies the current date instead of original cancellation date',()=>{
 const message={student_id:'a',metadata:{source_schedule_id:'s',cancelled_date:'2026-10-22',compensation_date:'2026-10-24'},message_body:'Güncel tarih',status:'prepared',prepared_at:'2026-10-23'};
 const row=run([log('a')],[message])[0].students[0];assert.equal(row.compensationDate,'2026-10-24');assert.equal(row.message,'Güncel tarih');assert.equal(row.messageStatus,'prepared');assert.equal(row.sentAt,null);
});
test('rescheduling follows the exact makeup chain and hides stale messages',()=>{
 const original=log('a');original.new_value.target_schedule_id='target';
 const change=(date,next,source='c')=>({student_id:'a',source_id:source,old_value:{lesson_date:date,target_schedule_id:'target'},new_value:{lesson_date:next,target_schedule_id:'target'},performed_at:next});
 const msg={student_id:'a',metadata:{source_schedule_id:'s',cancelled_date:'2026-10-22',compensation_date:'2026-10-25'},message_body:'Eski tarih',status:'prepared'};
 const rows=build([original],[msg],new Map(),new Map(),new Map(),[change('2026-10-25','2026-10-26'),change('2026-10-26','2026-10-27'),change('2026-10-27','2026-10-28','other')]);
 assert.equal(rows[0].students[0].compensationDate,'2026-10-27');assert.equal(rows[0].students[0].message,null);
});
