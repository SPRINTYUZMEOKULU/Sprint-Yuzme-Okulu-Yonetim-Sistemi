const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
const student='11111111-1111-1111-1111-111111111111';
function setup({logged=true,active=true,role='registration_staff',duplicate=false,rpcError=null}={}){
 const calls=[],notices=[],trace=[];
 const client={auth:{getUser:async()=>({data:{user:logged?{id:'actor'}:null}})},from(table){const q={select(){return q},eq(k,v){trace.push([table,k,v]);return q},maybeSingle:async()=>({data:{id:'actor',organization_id:'org',is_active:active,role}})};return q}};
 const m={exports:{}};new Function('require','module','exports',ts.transpileModule(fs.readFileSync('app/api/lesson-adjustments/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(name=>({
 'next/server':{NextResponse:{json:(body,{status=200}={})=>({body,status})}},'@/lib/supabase/server':{createClient:async()=>client},
 '@/lib/attendance/operations-db':{validUuid:v=>typeof v==='string'&&/^[0-9a-f-]{36}$/i.test(v),attendanceOperationsDb:()=>({rpc:async(name,args)=>{calls.push({name,args});return {data:rpcError?null:{ok:true,duplicate,request:{id:'request',status:'pending'}},error:rpcError}}})},
 '@/lib/notifications/publish-event':{publishEventNotification:async payload=>notices.push(payload)},'@/lib/students/revalidate':{revalidateStudentSurfaces(){}}
 }[name]),m,m.exports);
 return {calls,notices,trace,post:body=>m.exports.POST({url:'https://sprint.test/api/lesson-adjustments',headers:new Headers(),json:async()=>({request_type:'individual_compensation',student_id:student,lesson_count:2,reason:'Tesis kaynaklı',...body})})};
}
test('individual request uses authenticated actor and transactional RPC, then links exact approval',async()=>{const h=setup();const r=await h.post({organization_id:'foreign',requested_by:'someone'});assert.equal(r.status,200);assert.equal(h.calls[0].name,'request_individual_compensation');assert.deepEqual(h.calls[0].args,{p_actor:'actor',p_student:student,p_count:2,p_reason:'Tesis kaynaklı',p_description:''});assert.equal(h.notices[0].target_path,'/onay-merkezi?requestId=request');assert.ok(!h.trace.some(([table])=>table==='organizations'))});
for(const [label,config]of[['logged out',{logged:false}],['inactive',{active:false}],['guardian',{role:'guardian'}]])test(label+' cannot create requests',async()=>{const h=setup(config);assert.equal((await h.post()).status,403);assert.equal(h.calls.length,0);assert.equal(h.notices.length,0)});
test('duplicate pending request reuses original and sends no second notification',async()=>{const h=setup({duplicate:true});const r=await h.post();assert.equal(r.status,200);assert.match(r.body.message,/bekleyen/);assert.equal(h.notices.length,0)});
test('invalid count, student and missing reason fail before any write',async()=>{for(const body of [{lesson_count:0},{lesson_count:1.5},{student_id:'wrong'},{reason:''}]){const h=setup();assert.equal((await h.post(body)).status,400);assert.equal(h.calls.length,0)}});
test('database error is shown without claiming a saved request or notifying managers',async()=>{const h=setup({rpcError:{message:'Öğrenci bulunamadı.'}});const r=await h.post();assert.equal(r.status,400);assert.match(r.body.error,/Öğrenci/);assert.equal(h.notices.length,0)});
