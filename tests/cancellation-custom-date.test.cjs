const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
function setup(){
 const writes=[];
 const source={id:'source',group_id:'g',weekday:6,is_active:true,start_time:'19:00',end_time:'20:00'};
 const target={id:'target',group_id:'g',weekday:7,is_active:true,start_time:'19:00',end_time:'20:00'};
 const rows={training_groups:{id:'g',name:'Group'},student_group_memberships:[{student_id:'student'}],students:[],student_enrollments:[],student_attendance_plans:[]};
 const client={from(table){let single=false;const q={select(){return q},eq(){return q},in(){return q},order(){return q},maybeSingle(){single=true;return q},insert(v){writes.push(v);return q},update(v){writes.push(v);return q},then(resolve){return Promise.resolve({data:table==='lesson_schedules'?(single?source:[source,target]):rows[table]||[],error:null}).then(resolve)}};return q;}};
 const m={exports:{}};new Function('require','module','exports',ts.transpileModule(fs.readFileSync('app/ders-operasyonlari/actions.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText)(name=>{
  if(name==='next/cache')return {revalidatePath(){}};
  if(name==='next/headers')return {cookies:async()=>({get(){}})};
  if(name==='@/lib/auth/profile')return {requireProfile:async()=>({id:'admin',organization_id:'org'})};
  if(name==='@/lib/supabase/server')return {createClient:async()=>client};
  if(name==='@/lib/lesson-operations/participation')return {};
  throw Error(name);
 },m,m.exports);
 return {writes,call:(date,schedule='target')=>m.exports.applyLessonCancellation({groupId:'g',scheduleId:'source',cancelledDate:'2026-10-17',reason:'Pool closure',compensationMode:'custom',customDate:date,customScheduleId:schedule})};
}
test('custom compensation rejects wrong weekday before any writes',async()=>{const s=setup();const r=await s.call('2026-10-19');assert.equal(r.ok,false);assert.match(r.message,/seansın gününe/);assert.equal(s.writes.length,0);});
test('custom compensation rejects dates before cancellation before any writes',async()=>{const s=setup();const r=await s.call('2026-10-11');assert.equal(r.ok,false);assert.match(r.message,/iptal tarihinden sonra/);assert.equal(s.writes.length,0);});
test('custom compensation cannot target another group schedule',async()=>{const s=setup();const r=await s.call('2026-10-18','other-group');assert.equal(r.ok,false);assert.match(r.message,/bu gruba ait değil/);assert.equal(s.writes.length,0);});
