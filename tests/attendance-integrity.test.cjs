const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const ts=require('typescript');
function load(path){const source=ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;const mod={exports:{}};new Function('module','exports',source)(mod,mod.exports);return mod.exports;}
const {attendanceRoster}=load('lib/attendance/roster.ts');const {mergeAttendanceDraft,verifyAttendanceRows}=load('lib/attendance/integrity.ts');
test('only selected days and latest enrollment; exclude future, passive and missing registration',()=>{const p={students:[{id:'a'},{id:'b'},{id:'c'},{id:'d',status:'passive'}],memberships:['a','b','c','d'].map(student_id=>({student_id,group_id:'g'})),enrollments:[{id:'old',student_id:'a',group_id:'g',status:'active',lesson_weekdays:[2,4,6],created_at:'2026-09-01'},{id:'new',student_id:'a',group_id:'g',status:'active',lesson_weekdays:[2,4],created_at:'2026-10-01'},{id:'b',student_id:'b',group_id:'g',status:'active',lesson_weekdays:[6],start_date:'2026-10-12'},{id:'d',student_id:'d',group_id:'g',status:'active',lesson_weekdays:[6]}],compensationLessons:[]};assert.deepEqual(attendanceRoster(p,'g','s','2026-10-10',6).students,[]);assert.deepEqual(attendanceRoster(p,'g','s','2026-10-13',2).students.map(x=>x.id),['a']);p.compensationLessons.push({student_id:'a',target_group_id:'g',target_schedule_id:'s',lesson_date:'2026-10-10',status:'planned'});assert.deepEqual(attendanceRoster(p,'g','s','2026-10-10',6).students.map(x=>x.id),['a']);assert.deepEqual(attendanceRoster(p,'g','different','2026-10-10',6).students,[])});
test('saved server data wins over drafts; other sessions and invalid statuses are excluded',()=>{assert.deepEqual(mergeAttendanceDraft({'s:a':'absent'},{'s:a':'present','s:b':'present','other:c':'present','s:d':'invalid'},new Set(['s:a','s:b','s:d'])),{'s:a':'absent','s:b':'present'})});
test('zero rows, partial writes, mismatched status and failed reads never verify',()=>{assert.equal(verifyAttendanceRows([],[]),false);assert.equal(verifyAttendanceRows([{student_id:'a',status:'present'}],null),false);assert.equal(verifyAttendanceRows([{student_id:'a',status:'present'}],[{student_id:'a',status:'absent'}]),false);assert.equal(verifyAttendanceRows([{student_id:'a',status:'present'},{student_id:'b',status:'absent'}],[{student_id:'a',status:'present'}]),false);assert.equal(verifyAttendanceRows([{student_id:'a',status:'present'}],[{student_id:'a',status:'present'}]),true)});

test('editing days on the same enrollment immediately moves the daily roster',()=>{const enrollment={id:'e',student_id:'a',group_id:'g',status:'active',lesson_weekdays:[2,4],start_date:'2026-09-01'};const p={students:[{id:'a'}],memberships:[{student_id:'a',group_id:'g',is_active:true}],enrollments:[enrollment],compensationLessons:[]};assert.deepEqual(attendanceRoster(p,'g','s','2026-10-10',6).students,[]);enrollment.lesson_weekdays=[2,6];assert.deepEqual(attendanceRoster(p,'g','s','2026-10-10',6).students.map(x=>x.id),['a']);assert.deepEqual(attendanceRoster(p,'g','s','2026-10-15',4).students,[]);enrollment.lesson_weekdays=[2,4];assert.deepEqual(attendanceRoster(p,'g','s','2026-10-10',6).students,[])});

const {mergeRemoteAttendance}=load('lib/attendance/integrity.ts');
test('remote refresh shows coach saves and corrections, keeps local drafts, removes deleted/off-roster rows',()=>{const allowed=new Set(['s:a','s:b','s:c']);assert.deepEqual(mergeRemoteAttendance({'s:a':'present','s:b':'excused','s:c':'present','old:x':'present'},{'s:a':'present','s:b':'absent','s:c':'present'},{'s:a':'absent','s:b':'present'},allowed),{'s:a':'absent','s:b':'excused'});assert.deepEqual(mergeRemoteAttendance({}, {}, {'s:a':'present'},allowed),{'s:a':'present'});assert.deepEqual(mergeRemoteAttendance({'s:a':'absent'},{'s:a':'present'},{'s:a':'excused'},allowed),{'s:a':'absent'});});

const {registrationDaysLabel,attendanceCourseLabel}=load('lib/attendance/presentation.ts');
test('individual selected days differ from the group name; adults and team labels are explicit',()=>{assert.equal(registrationDaysLabel([2,4]),'Salı · Perşembe');assert.equal(registrationDaysLabel([6,0,7,6]),'Cumartesi · Pazar');assert.equal(attendanceCourseLabel({name:'Salı-Perşembe 20:00 / Cumartesi 19:00 · Yetişkin',course_type:'Yetişkin Yüzme Kursu'}),'Yetişkin');assert.equal(attendanceCourseLabel({course_type:'Takım / Performans'}),'Takım')});

const {coachStudentScope}=load('lib/attendance/coach-roster.ts');
test('student assignments override the session coach while preserving unassigned students and schedule isolation',()=>{
 const rows=[{schedule_id:'s',student_id:'a',coach_id:'one'},{schedule_id:'s',student_id:'b',coach_id:'two'},{schedule_id:'s',student_id:'c',coach_id:null},{schedule_id:'other',student_id:'d',coach_id:'two'},{schedule_id:'s',student_id:'e',coach_id:'two',is_active:false}];
 assert.deepEqual(coachStudentScope(rows,'s','g',new Set(['one']),true,['a','b','c','d','e']),['a','c','d','e']);
 assert.deepEqual(coachStudentScope(rows,'s','g',new Set(['two']),false,['a','b','c','d','e']),['b']);
 assert.deepEqual(coachStudentScope(rows,'s','g',new Set(['none']),false,['a']),[]);
 assert.equal(coachStudentScope([],'s','g',new Set(['one']),true,['a']),undefined);
 assert.deepEqual(coachStudentScope([{group_id:'g',student_id:'a',coach_id:'staff-id'}],'s','g',new Set(['profile-id','staff-id']),false,['a']),['a']);
});

test('pending manual start is excluded from attendance even with planned compensation; confirmation admits the student',()=>{
 const e={id:'e',student_id:'a',group_id:'g',status:'active',lesson_weekdays:[3],start_date:'2026-10-07',start_confirmation_required:true,actual_started_at:null};
 const p={students:[{id:'a'}],enrollments:[e],memberships:[{student_id:'a',group_id:'g',is_active:true}],compensationLessons:[{student_id:'a',target_group_id:'g',target_schedule_id:'s',lesson_date:'2026-10-14',status:'planned'}]};
 assert.deepEqual(attendanceRoster(p,'g','s','2026-10-14',3).students,[]);
 e.actual_started_at='2026-10-14T12:00:00Z';
 assert.deepEqual(attendanceRoster(p,'g','s','2026-10-14',3).students.map(s=>s.id),['a']);
});
