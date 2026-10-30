const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
function load(path,requireFn=require){const m={exports:{}};new Function('require','module','exports',ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText)(requireFn,m,m.exports);return m.exports;}
function setup(targetBranch='b',targetCourse='adult',sundayDay=0,failureTable=null){
 const writes=[];
 const source={id:'source',group_id:'g',branch_id:'b',weekday:6,is_active:true,start_time:'19:00',end_time:'20:00'};
 const target={id:'target',group_id:'sunday',branch_id:targetBranch,weekday:sundayDay,is_active:true,start_time:'19:00',end_time:'20:00'};
 const rows={training_groups:[{id:'g',name:'Saturday',branch_id:'b',course_type:'adult',is_active:true},{id:'sunday',name:'Sunday',branch_id:targetBranch,course_type:targetCourse,is_active:true}],lesson_schedules:[source,target],student_group_memberships:[{student_id:'student',group_id:'g',is_active:true}],students:[{id:'student',first_name:'Test',status:'active',is_active:true}],student_enrollments:[{id:'e',student_id:'student',group_id:'g',start_date:'2026-10-01',lesson_weekdays:[6],planned_end_date:'2026-10-31',status:'active',created_at:'2026-10-01'}],student_attendance_plans:[{id:'p',student_id:'student',enrollment_id:'e',group_id:'g',selected_weekdays:[6],is_active:true}]};
 const client={from(table){let single=false,inserted=false;const filters=[];const q={select(){return q},eq(k,v){if(k!=='organization_id')filters.push([k,v]);return q},in(){return q},order(){return q},maybeSingle(){single=true;return q},insert(v){inserted=true;writes.push({table,value:v});return q},update(v){writes.push({table,value:v});return q},then(resolve){const data=(rows[table]||[]).filter(row=>filters.every(([k,v])=>row[k]===v));return Promise.resolve({data:single?data[0]||null:data,error:inserted&&table===failureTable?{message:'write failed'}:null}).then(resolve)}};return q;}};
 const actions=load('app/ders-operasyonlari/actions.ts',name=>{
  if(name==='next/cache')return {revalidatePath(){}};
  if(name==='next/headers')return {cookies:async()=>({get(){}})};
  if(name==='@/lib/auth/profile')return {requireProfile:async()=>({id:'admin',organization_id:'org'})};
  if(name==='@/lib/supabase/server')return {createClient:async()=>client};
  if(name==='@/lib/lesson-operations/participation')return load('lib/lesson-operations/participation.ts');
  if(name==='@/lib/lesson-operations/outcomes')return load('lib/lesson-operations/outcomes.ts');
  throw Error(name);
 });
 return {writes,rows,call:(date,schedule='target',mode='custom',cancelledDate='2026-10-17')=>actions.applyLessonCancellation({groupId:'g',scheduleId:'source',cancelledDate,reason:'Pool closure',compensationMode:mode,customDate:date,customScheduleId:schedule,prepareMessages:true})};
}
test('custom compensation rejects wrong weekday before any writes',async()=>{const s=setup();const r=await s.call('2026-10-19');assert.equal(r.ok,false);assert.match(r.message,/seansın gününe/);assert.equal(s.writes.length,0);});
test('custom compensation rejects dates before cancellation before any writes',async()=>{const s=setup();const r=await s.call('2026-10-11');assert.equal(r.ok,false);assert.match(r.message,/iptal tarihinden sonra/);assert.equal(s.writes.length,0);});
test('custom compensation rejects missing sessions',async()=>{const s=setup();const r=await s.call('2026-10-18','missing');assert.equal(r.ok,false);assert.equal(s.writes.length,0);});
test('Saturday registration can compensate in Sunday 19:00 group without transferring registration',async()=>{const s=setup();const r=await s.call('2026-10-18');assert.equal(r.ok,true);assert.equal(r.compensationCreated,1);const c=s.writes.find(w=>w.table==='student_compensation_lessons').value;assert.equal(c.target_group_id,'sunday');assert.equal(c.target_schedule_id,'target');assert.equal(c.enrollment_id,'e');assert.equal(c.lesson_date,'2026-10-18');assert.equal(c.status,'planned');assert.equal(s.writes.some(w=>['student_enrollments','student_group_memberships'].includes(w.table)),false);assert.match(r.preparedMessages[0].message,/18.10.2026/);});
test('other pools and mismatched child/adult groups are rejected before writes',async()=>{for(const s of [setup('other'),setup('b','child')]){assert.equal((await s.call('2026-10-18')).ok,false);assert.equal(s.writes.length,0);}});
test('automatic compensation still uses original group and participation days',async()=>{const s=setup();const r=await s.call(null,null,'append_end');assert.equal(r.ok,true);const c=s.writes.find(w=>w.table==='student_compensation_lessons').value;assert.equal(c.target_group_id,'g');assert.equal(c.target_schedule_id,'source');assert.equal(c.lesson_date,'2026-11-07');});

test('ISO Sunday sessions also remain supported',async()=>{const s=setup('b','adult',7);assert.equal((await s.call('2026-10-18')).ok,true);});


test('skipped participant identifies the student and the exact participation day reason',async()=>{
 const s=setup();s.rows.student_attendance_plans[0].selected_weekdays=[7];
 const r=await s.call('2026-10-18');assert.equal(r.skippedCount,1);assert.equal(r.processedCount,0);
 assert.equal(r.outcomes[0].studentId,'student');assert.equal(r.outcomes[0].studentName,'Test');
 assert.equal(r.outcomes[0].status,'skipped');assert.match(r.outcomes[0].reason,/Pazar.*Cumartesi/);assert.equal(s.writes.filter(w=>w.table==='student_compensation_lessons').length,0);assert.equal(s.writes.find(w=>w.table==='student_activity_logs').value[0].activity_type,'lesson_cancellation_skipped');
});
test('missing, future and unconfirmed registration periods have distinct reasons',async()=>{
 for(const [change,pattern] of [
  [s=>s.rows.student_enrollments=[],/aktif kayıt dönemi bulunamadı/],
  [s=>s.rows.student_enrollments[0].start_date='2026-11-01',/iptal tarihinden sonra başlıyor/],
  [s=>{s.rows.student_enrollments[0].start_confirmation_required=true},/başlatma onayı/],
 ]){const s=setup();change(s);const r=await s.call('2026-10-18');assert.equal(r.outcomes[0].status,'skipped');assert.match(r.outcomes[0].reason,pattern);assert.equal(s.writes.filter(w=>w.table==='student_compensation_lessons').length,0);}
});
test('failed compensation is reported without claiming cancellation was applied',async()=>{
 const s=setup('b','adult',0,'student_compensation_lessons');const r=await s.call('2026-10-18');
 assert.equal(r.compensationCreated,0);assert.equal(r.processedCount,0);assert.equal(r.skippedCount,1);assert.match(r.outcomes[0].reason,/Telafi kaydı oluşturulamadı/);assert.equal(r.preparedMessages.length,0);
});
test('failed message preparation keeps the successful compensation and warns without a false ready message',async()=>{
 const s=setup('b','adult',0,'message_logs');const r=await s.call('2026-10-18');
 assert.equal(r.processedCount,1);assert.equal(r.compensationCreated,1);assert.equal(r.preparedMessages.length,0);assert.equal(r.outcomes[0].status,'processed');assert.match(r.outcomes[0].reason,/Mesaj hazırlanamadı/);
});

test('reopening a previously processed cancellation cannot add a second lesson',async()=>{
 const s=setup();s.rows.student_activity_logs=[{id:'previous',student_id:'student',activity_type:'lesson_cancellation_compensation',source_id:'source','old_value->>cancelled_lesson_date':'2026-10-17'}];
 const r=await s.call('2026-10-18');assert.equal(r.compensationCreated,0);assert.equal(r.skippedCount,1);assert.match(r.outcomes[0].reason,/zaten kayıtlı/);
});
test('two cancellations can be planned in consecutive sessions on the same day',async()=>{
 const s=setup();assert.equal((await s.call('2026-10-25')).compensationCreated,1);
 s.rows.student_compensation_lessons=[{id:'first',student_id:'student',lesson_date:'2026-10-25',target_schedule_id:'target',status:'planned'}];
 s.rows.lesson_schedules.push({...s.rows.lesson_schedules[1],id:'target-late',start_time:'20:00',end_time:'21:00'});
 const r=await s.call('2026-10-25','target-late','custom','2026-10-24');assert.equal(r.compensationCreated,1);
 const lessons=s.writes.filter(w=>w.table==='student_compensation_lessons');assert.equal(lessons.length,2);assert.notEqual(lessons[0].value.target_schedule_id,lessons[1].value.target_schedule_id);
});
test('two different cancelled lessons cannot occupy the same makeup session',async()=>{
 const s=setup();s.rows.student_compensation_lessons=[{id:'first',student_id:'student',lesson_date:'2026-10-25',target_schedule_id:'target',status:'planned'}];
 const r=await s.call('2026-10-25','target','custom','2026-10-24');assert.equal(r.compensationCreated,0);assert.match(r.outcomes[0].reason,/zaten telafi var/);
});
