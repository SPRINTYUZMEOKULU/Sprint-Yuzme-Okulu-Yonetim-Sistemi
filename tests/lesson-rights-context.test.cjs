const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
function load(p){const m={exports:{}};new Function('module','exports','require',ts.transpileModule(fs.readFileSync(p,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText)(m,m.exports,n=>load(n.slice(2)+'.ts'));return m.exports;}
const {loadLessonRightsContext,rightsForEnrollment}=load('lib/students/lesson-rights-context.ts');
test('shared context isolates student/enrollment and extends the date for their planned compensation',()=>{
 const context={today:'2026-10-14',time:'21:00',balances:new Map(),schedules:[{id:'s',group_id:'g',end_time:'22:00:00'}],cancellations:[{student_id:'other',source_id:'s',old_value:{cancelled_lesson_date:'2026-10-14'}}],compensations:[{student_id:'a',enrollment_id:'e',status:'planned',lesson_date:'2026-10-16'},{student_id:'a',enrollment_id:'old',status:'planned',lesson_date:'2027-01-01'}]};
 const r=rightsForEnrollment(context,{id:'e',student_id:'a',group_id:'g',start_date:'2026-09-18',planned_end_date:'2026-10-14',used_lessons:7,total_lessons:8});assert.equal(r.normal,1);assert.equal(r.compensation,2);assert.equal(r.endDate,'2026-10-16');
});
test('loader reads additional pages and fails visibly when a read fails',async()=>{
 const rows=Array.from({length:501},(_,i)=>({id:String(i),student_id:'a',enrollment_id:'e',status:'planned'}));
 function client(fail){return {from(table){let offset=0,last=499;const q={select(){return q},eq(){return q},in(){return q},order(){return q},range(a,b){offset=a;last=b;return q},then(resolve){return Promise.resolve({data:table==='student_compensation_lessons'?rows.slice(offset,last+1):[],error:fail?{message:'offline'}:null}).then(resolve)}};return q}}}
 assert.equal((await loadLessonRightsContext(client(false),'org',['a'])).compensations.length,501);
 await assert.rejects(()=>loadLessonRightsContext(client(true),'org',['a']),/yüklenemedi/);
});
