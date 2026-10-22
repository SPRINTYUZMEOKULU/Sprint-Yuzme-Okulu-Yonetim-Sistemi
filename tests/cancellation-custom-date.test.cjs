const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
function load(path,requireFn=require){const m={exports:{}};new Function('require','module','exports',ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText)(requireFn,m,m.exports);return m.exports;}
function setup(targetBranch='b',targetCourse='adult',sundayDay=0,sourceCourse='adult'){
 const writes=[];
 const source={id:'source',group_id:'g',branch_id:'b',weekday:6,is_active:true,start_time:'19:00',end_time:'20:00'};
 const target={id:'target',group_id:'sunday',branch_id:targetBranch,weekday:sundayDay,is_active:true,start_time:'19:00',end_time:'20:00'};
 const rows={training_groups:[{id:'g',name:'Saturday',branch_id:'b',course_type:sourceCourse,is_active:true},{id:'sunday',name:'Sunday',branch_id:targetBranch,course_type:targetCourse,is_active:true}],lesson_schedules:[source,target],student_group_memberships:[{student_id:'student',group_id:'g',is_active:true}],students:[{id:'student',first_name:'Test',status:'active',is_active:true}],student_enrollments:[{id:'e',student_id:'student',group_id:'g',start_date:'2026-10-01',lesson_weekdays:[6],planned_end_date:'2026-10-31',status:'active',created_at:'2026-10-01'}],student_attendance_plans:[{id:'p',student_id:'student',enrollment_id:'e',group_id:'g',selected_weekdays:[6],is_active:true}]};
 const client={from(table){let single=false;const filters=[];const q={select(){return q},eq(k,v){if(k!=='organization_id')filters.push([k,v]);return q},in(){return q},order(){return q},maybeSingle(){single=true;return q},insert(v){writes.push({table,value:v});return q},update(v){writes.push({table,value:v});return q},then(resolve){const data=(rows[table]||[]).filter(row=>filters.every(([k,v])=>row[k]===v));return Promise.resolve({data:single?data[0]||null:data,error:null}).then(resolve)}};return q;}};
 const actions=load('app/ders-operasyonlari/actions.ts',name=>{
  if(name==='next/cache')return {revalidatePath(){}};
  if(name==='next/headers')return {cookies:async()=>({get(){}})};
  if(name==='@/lib/auth/profile')return {requireProfile:async()=>({id:'admin',organization_id:'org'})};
  if(name==='@/lib/supabase/server')return {createClient:async()=>client};
  if(name==='@/lib/lesson-operations/compensation-targets')return load('lib/lesson-operations/compensation-targets.ts',n=>{if(n==='./participation')return load('lib/lesson-operations/participation.ts');throw Error(n)});
  if(name==='@/lib/lesson-operations/participation')return load('lib/lesson-operations/participation.ts');
  throw Error(name);
 });
 return {writes,call:(date,schedule='target',mode='custom')=>actions.applyLessonCancellation({groupId:'g',scheduleId:'source',cancelledDate:'2026-10-17',reason:'Pool closure',compensationMode:mode,customDate:date,customScheduleId:schedule,prepareMessages:true})};
}
test('custom compensation rejects wrong weekday before any writes',async()=>{const s=setup();const r=await s.call('2026-10-19');assert.equal(r.ok,false);assert.match(r.message,/seansın gününe/);assert.equal(s.writes.length,0);});
test('custom compensation rejects dates before cancellation before any writes',async()=>{const s=setup();const r=await s.call('2026-10-11');assert.equal(r.ok,false);assert.match(r.message,/iptal tarihinden sonra/);assert.equal(s.writes.length,0);});
test('custom compensation rejects missing sessions',async()=>{const s=setup();const r=await s.call('2026-10-18','missing');assert.equal(r.ok,false);assert.equal(s.writes.length,0);});
test('Saturday registration can compensate in Sunday 19:00 group without transferring registration',async()=>{const s=setup();const r=await s.call('2026-10-18');assert.equal(r.ok,true);assert.equal(r.compensationCreated,1);const c=s.writes.find(w=>w.table==='student_compensation_lessons').value;assert.equal(c.target_group_id,'sunday');assert.equal(c.target_schedule_id,'target');assert.equal(c.enrollment_id,'e');assert.equal(c.lesson_date,'2026-10-18');assert.equal(c.status,'planned');assert.equal(s.writes.some(w=>['student_enrollments','student_group_memberships'].includes(w.table)),false);assert.match(r.preparedMessages[0].message,/18.10.2026/);});
test('other pools and mismatched child/adult groups are rejected before writes',async()=>{for(const s of [setup('other'),setup('b','child')]){assert.equal((await s.call('2026-10-18')).ok,false);assert.equal(s.writes.length,0);}});
test('automatic compensation still uses original group and participation days',async()=>{const s=setup();const r=await s.call(null,null,'append_end');assert.equal(r.ok,true);const c=s.writes.find(w=>w.table==='student_compensation_lessons').value;assert.equal(c.target_group_id,'g');assert.equal(c.target_schedule_id,'source');assert.equal(c.lesson_date,'2026-11-07');});

test('ISO Sunday sessions also remain supported',async()=>{const s=setup('b','adult',7);assert.equal((await s.call('2026-10-18')).ok,true);});


test('child and team compensation cannot cross in either direction',async()=>{for(const [source,target] of [['Çocuk Yüzme Kursu','Takım / Performans'],['Takım / Performans','Çocuk Yüzme Kursu']]){const s=setup('b',target,0,source);assert.equal((await s.call('2026-10-18')).ok,false);assert.equal(s.writes.length,0);}});
test('team compensation remains available in another team group',async()=>{const s=setup('b','Takım / Performans',0,'Takım / Performans');assert.equal((await s.call('2026-10-18')).ok,true);});
