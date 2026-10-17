const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
function setup(row={id:'m',status:'prepared',metadata:{source_schedule_id:'s',cancelled_date:'2026-10-14'}},failure=false){
 const writes=[],filters=[];let changes=null;
 const client={from(){const q={select(){return q},eq(k,v){filters.push([k,v]);return q},in(){return q},order(){return q},limit(){return q},maybeSingle(){return q},update(v){changes=v;writes.push(v);return q},then(resolve){return Promise.resolve({data:changes?(failure?[]:[{id:'m'}]):row,error:null}).then(resolve)}};return q}};
 const mod={exports:{}};new Function('require','module','exports',ts.transpileModule(fs.readFileSync('app/ders-operasyonlari/actions.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText)(name=>{
 if(name==='@/lib/lesson-operations/participation'){const m={exports:{}};new Function('module','exports',ts.transpileModule(fs.readFileSync('lib/lesson-operations/participation.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText)(m,m.exports);return m.exports;}
 if(name==='next/cache')return {revalidatePath(){}};if(name==='next/headers')return {cookies(){}};
 if(name==='@/lib/auth/profile')return {requireProfile:async()=>({organization_id:'org',id:'admin'})};
 if(name==='@/lib/supabase/server')return {createClient:async()=>client};throw Error(name);
 },mod,mod.exports);return {call:()=>mod.exports.confirmCancellationMessageSent({studentId:'student',message:'Cancellation message'}),writes,filters};
}
test('manual confirmation persists status and scope metadata; never sends WhatsApp',async()=>{
 const s=setup();const r=await s.call();assert.equal(r.ok,true);assert.equal(s.writes.length,1);assert.equal(s.writes[0].status,'sent');assert.equal(s.writes[0].metadata.source_schedule_id,'s');assert.equal(s.writes[0].metadata.delivery_confirmation,'user_confirmed');assert.ok(s.filters.some(([k,v])=>k==='organization_id'&&v==='org'));assert.ok(s.filters.some(([k,v])=>k==='message_body'&&v==='Cancellation message'));
});
test('already sent is idempotent; nonexistent message cannot be marked',async()=>{
 const s=setup({id:'m',status:'sent'});assert.equal((await s.call()).ok,true);assert.equal(s.writes.length,0);
 const absent=setup(null);assert.equal((await absent.call()).ok,false);assert.equal(absent.writes.length,0);
});
test('zero-row write is not reported as success',async()=>{assert.equal((await setup(undefined,true).call()).ok,false)});
