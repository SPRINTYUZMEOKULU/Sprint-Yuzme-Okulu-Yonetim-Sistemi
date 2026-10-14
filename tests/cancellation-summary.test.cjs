const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
function load(path){const m={exports:{}};new Function('module','exports','require',ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText)(m,m.exports,name=>name.startsWith('@/')?load(name.slice(2)+'.ts'):require(name));return m.exports;}
const {cancellationSummary}=load('lib/dashboard/cancellation-summary.ts');const {summarizeSessionSlots}=load('lib/dashboard/session-summary.ts');
const op=(id,s='s',date='2026-10-14',planned=true)=>({student_id:id,source_id:s,old_value:{cancelled_lesson_date:date},new_value:{reason:'Hava',compensation_date:planned?'2026-10-21':null},performed_at:'2026-10-14'});
const msg=(id,status)=>({student_id:id,status,metadata:{source_schedule_id:'s',cancelled_date:'2026-10-14'}});
function group(id,students,cancellation){return {id,branchId:'b',branchName:'Meltem',groupId:id,groupName:id,startTime:'21:00',endTime:'22:00',studentCount:students.length,attendanceCount:0,attendanceComplete:false,missingCount:students.length,blockedCount:0,statusCounts:{present:0,absent:0,excused:0},notes:[],notesAvailable:true,studentStates:students.map(id=>({id,status:null,blocked:false})),cancellation};}
test('operation scope is date/schedule-specific; drafts do not cancel; recipients are deduplicated',()=>{
 const c=cancellationSummary('s','2026-10-14',[op('a'),op('a'),op('b','other'),op('c','s','2026-10-13')],[msg('a','prepared'),msg('a','sent'),msg('d','prepared')]);
 assert.deepEqual(c.studentIds,['a']);assert.deepEqual(c.sentStudentIds,['a']);assert.deepEqual(c.preparedStudentIds,['d']);assert.deepEqual(c.plannedStudentIds,['a']);
 assert.equal(cancellationSummary('s','2026-10-14',[],[msg('a','prepared')]).studentIds.length,0);
});
test('all cancelled groups in a shared slot suppress waiting without creating attendance',()=>{
 const a=cancellationSummary('s','2026-10-14',[op('a')],[msg('a','prepared')]);
 const b=cancellationSummary('t','2026-10-14',[op('b','t','2026-10-14',false)],[]);
 const [slot]=summarizeSessionSlots([group('child',['a'],a),group('adult',['b'],b)]);
 assert.equal(slot.cancelled,true);assert.equal(slot.missingCount,0);assert.equal(slot.attendanceCount,0);assert.equal(slot.attendanceComplete,false);assert.equal(slot.studentCount,2);assert.equal(slot.cancellation.plannedStudentIds.length,1);assert.equal(slot.cancellation.reservedStudentIds.length,1);
});
test('partial cancellation leaves the other group and unaffected students awaiting attendance',()=>{
 const c=cancellationSummary('s','2026-10-14',[op('a')],[]);
 const [slot]=summarizeSessionSlots([group('child',['a','b'],c),group('adult',['c'])]);assert.equal(slot.cancelled,false);assert.equal(slot.missingCount,2);
});
