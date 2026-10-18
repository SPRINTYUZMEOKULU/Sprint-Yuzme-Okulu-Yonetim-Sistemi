const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
const m={exports:{}};new Function('module','exports',ts.transpileModule(fs.readFileSync('lib/students/start-status.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(m,m.exports);
const {startsAfterToday,countStartedStudents}=m.exports;
test('64 active-status records with seven unconfirmed starts produce 57 started students',()=>{
 const students=Array.from({length:64},(_,i)=>({id:String(i),status:'active'}));
 const enrollments=students.map((s,i)=>({student_id:s.id,start_date:'2026-10-01',start_confirmation_required:i<7,actual_started_at:null}));
 assert.equal(countStartedStudents(students,enrollments,[],'2026-10-18'),57);
});
test('plan date, start confirmation and newest active enrollment follow Student Center rules',()=>{
 const students=[{id:'future',status:'active'},{id:'waiting',status:'active'},{id:'confirmed',status:'active'},{id:'legacy',status:'active'},{id:'passive',status:'passive'}];
 const enrollments=[{student_id:'future',start_date:'2026-10-01'},{student_id:'waiting',start_date:'2026-10-01',start_confirmation_required:true},{student_id:'waiting',start_date:'2026-09-01',actual_started_at:'2026-09-01'},{student_id:'confirmed',start_date:'2026-10-18',start_confirmation_required:true,actual_started_at:'2026-10-18'}];
 assert.equal(countStartedStudents(students,enrollments,[{student_id:'future',start_date:'2026-10-20'}],'2026-10-18'),2);
 assert.equal(startsAfterToday({status:'active',start_date:'not-a-date'},'2026-10-18'),false);
 assert.equal(startsAfterToday({status:'active',start_date:'2026-10-18'},'2026-10-18'),false);
});
