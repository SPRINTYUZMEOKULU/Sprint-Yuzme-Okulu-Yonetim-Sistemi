const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
function load(path) {
 const source=ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
 const mod={exports:{}};
 new Function('module','exports','require',source)(mod,mod.exports,name=>name.startsWith('@/')?load(`${name.slice(2)}.ts`):require(name));
 return mod.exports;
}
const {pastAttendance}=load('lib/dashboard/past-attendance.ts');
const fixture=()=>({today:'2026-10-11',schedules:[{id:'s',group_id:'g',branch_id:'b',weekday:7,start_time:'19:00:00',created_at:'2026-10-01'}],branches:[{id:'b',name:'Süleyman Erol'}],groups:[],students:[{id:'one',status:'active'},{id:'two',status:'active'}],enrollments:['one','two'].map(id=>({id:`e-${id}`,student_id:id,group_id:'g',status:'active',start_date:'2026-10-01',lesson_weekdays:[0],total_lessons:8,used_lessons:0})),memberships:['one','two'].map(id=>({student_id:id,group_id:'g',is_active:true})),records:[],closures:[]});
test('completely missing past Sunday opens its exact date, branch and time; never today or future',()=>{
 const result=pastAttendance(fixture()); assert.equal(result.length,1);assert.equal(result[0].date,'2026-10-04');assert.equal(result[0].missingCount,2);
 const url=new URL(result[0].href,'https://example.test');assert.equal(url.searchParams.get('date'),'2026-10-04');assert.equal(url.searchParams.get('branchId'),'b');assert.equal(url.searchParams.get('time'),'19:00');
});
test('partial saves retain only missing students and completed sessions disappear',()=>{
 const p=fixture();p.records=[{student_id:'one',schedule_id:'s',lesson_date:'2026-10-04',status:'present'}];assert.equal(pastAttendance(p)[0].missingCount,1);
 p.records.push({student_id:'two',schedule_id:'s',lesson_date:'2026-10-04',status:'absent'});assert.equal(pastAttendance(p).length,0);
});
test('closures, future starts, exhausted rights and new registrations do not create historic warnings',()=>{
 for(const transform of [p=>p.closures.push({event_date:'2026-10-04'}),p=>p.enrollments.forEach(e=>e.start_date='2026-10-05'),p=>p.enrollments.forEach(e=>e.used_lessons=8),p=>p.enrollments.forEach(e=>e.created_at='2026-10-05')]){const p=fixture();transform(p);assert.equal(pastAttendance(p).length,0)}
});
test('cancelled students do not create historical attendance warnings; unaffected students still do',()=>{
 const p=fixture();p.cancellations=[{source_id:'s',student_id:'one',old_value:{cancelled_lesson_date:'2026-10-04'}}];assert.equal(pastAttendance(p)[0].missingCount,1);
 p.cancellations.push({source_id:'s',student_id:'two',old_value:{cancelled_lesson_date:'2026-10-04'}});assert.deepEqual(pastAttendance(p),[]);
});
