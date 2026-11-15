const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
function load(file,mocks={}){const module={exports:{}};new Function('require','module','exports',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText)(name=>mocks[name]||require(name),module,module.exports);return module.exports;}
const {currentMakeupNotice,filterMakeups}=load('lib/students/compensation-management.ts');
const {studentLessonRights}=load('lib/students/lesson-rights.ts');
const {compensationChangeMessage}=load('lib/students/compensation-message.ts');
test('reserved right converted to a dated plan leaves the total unchanged',()=>{
 const base={total:8,scheduledUsed:4,legacyCompensation:0,enrollment:{id:'period',group_id:'group',start_date:'2026-01-01',planned_end_date:'2026-12-01'},today:'2026-11-16',time:'12:00',schedules:[{id:'schedule',group_id:'group',end_time:'20:00'}]};
 const cancellation={source_id:'schedule',old_value:{cancelled_lesson_date:'2026-11-01'},new_value:{compensation_mode:'reserve',compensation_date:null}};
 const before=studentLessonRights({...base,compensations:[],cancellations:[cancellation]});
 const after=studentLessonRights({...base,compensations:[{enrollment_id:'period',status:'planned'}],cancellations:[{...cancellation,new_value:{compensation_mode:'reserve',compensation_date:'2026-11-21'}}]});
 assert.equal(before.compensation,1);assert.equal(after.compensation,1);assert.equal(before.total,after.total);assert.equal(before.normal,after.normal);
});
test('central queue excludes old, cancelled and mismatched plan messages',()=>{
 const item={id:'one',lesson_date:'2026-11-20',target_schedule_id:'new',status:'planned'};
 const stale={id:'stale',status:'prepared',metadata:{compensation_id:'one',current_plan:{date:'2026-11-19',schedule_id:'old',cancelled:false}}};
 const current={id:'fresh',message_body:'new message',recipient:'905551112233',status:'prepared',metadata:{compensation_id:'one',current_plan:{date:item.lesson_date,schedule_id:'new',cancelled:false}}};
 assert.equal(currentMakeupNotice(item,[stale,{...current,status:'cancelled'},current]).id,'fresh');assert.equal(currentMakeupNotice(item,[stale]),null);
});
test('search, branch and notification filters intersect correctly with Turkish names',()=>{
 const rows=[{id:'one',status:'planned',student:{first_name:'İREM',student_number:'12'},target_group_id:'g',notification:{status:'prepared'}},{id:'two',status:'reserved',student:{first_name:'Ali'},target_group_id:'other'}];
 assert.deepEqual(filterMakeups(rows,'notifications','irem','b',[{id:'g',branch_id:'b'}]).map(r=>r.id),['one']);
 assert.equal(filterMakeups(rows,'notifications','','other',[{id:'g',branch_id:'b'}]).length,0);
 assert.equal(filterMakeups(rows,'reserved','','',[])[0].id,'two');
});
test('first planning message distinguishes a cancelled source lesson from a previously planned makeup',()=>{
 const body=compensationChangeMessage('Örnek Kursiyer',{date:'2026-11-15'},{date:'2026-11-21',time:'19:00–20:00',branch:'Muratpaşa'},true);
 assert.match(body,/saklı tutulan telafi hakkı/);assert.match(body,/21.11.2026/);assert.doesNotMatch(body,/Önceki telafi/);
});
function apiHarness({role='admin',rpcError=null}={}){
 const calls=[];
 const db={auth:{getUser:async()=>({data:{user:{id:'actor'}}})},from:()=>({select(){return this},eq(){return this},maybeSingle:async()=>({data:{id:'actor',role,organization_id:'org'}})}),rpc:async(name,args)=>{calls.push({name,args});return {data:rpcError?null:{student_id:'student',duplicate:false,previous:{},current:{}},error:rpcError};}};
 const api=load('app/api/compensation-management/route.ts',{'next/server':{NextResponse:{json:(body,{status=200}={})=>({body,status})}},'@supabase/supabase-js':{createClient:()=>db},'@/lib/supabase/server':{createClient:async()=>db},'next/cache':{revalidatePath(){}},'@/lib/students/revalidate':{revalidateStudentSurfaces(){}},'@/lib/students/compensation-message':{compensationChangeMessage},'@/lib/students/compensation-management':{currentMakeupNotice}});
 process.env.NEXT_PUBLIC_SUPABASE_URL='test';process.env.SUPABASE_SERVICE_ROLE_KEY='test';
 return {calls,post:(body)=>api.POST({json:async()=>body})};
}
test('planning endpoint uses authenticated actor and atomic RPC without client-supplied student or period',async()=>{
 const h=apiHarness();const result=await h.post({action:'plan_reserved',id:'reserve',lesson_date:'2099-01-04',target_schedule_id:'schedule',prepare_message:false,p_actor:'forged',student_id:'forged'});
 assert.equal(result.status,200);assert.deepEqual(h.calls,[{name:'plan_reserved_compensation',args:{p_actor:'actor',p_log:'reserve',p_date:'2099-01-04',p_schedule:'schedule'}}]);
});
test('unauthorized and incomplete requests never invoke planning',async()=>{
 const coach=apiHarness({role:'coach'});assert.equal((await coach.post({action:'plan_reserved'})).status,403);assert.equal(coach.calls.length,0);
 const admin=apiHarness();assert.equal((await admin.post({action:'plan_reserved',id:'reserve'})).status,400);assert.equal(admin.calls.length,0);
});
test('planning conflict is surfaced without claiming success',async()=>{
 const h=apiHarness({rpcError:{message:'Bu seansta zaten telafi kaydı var.'}});const result=await h.post({action:'plan_reserved',id:'reserve',lesson_date:'2099-01-04',target_schedule_id:'schedule'});assert.equal(result.status,409);assert.equal(result.body.ok,false);
});
