const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
function load(file,imports={}){const js=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;const m={exports:{}};new Function('require','exports','module',js)(name=>name in imports?imports[name]:{},m.exports,m);return m.exports;}
const state=load('lib/guardian/request-state.ts');
const form=values=>{const f=new FormData();for(const [k,v] of Object.entries(values))f.set(k,v);return f;};
function fixture(previous={id:'request',guardian_id:'parent',student_id:'child',request_number:'VTL-1',status:'new',guardian_response:null,responded_at:null,responded_by:null,updated_at:'version1'}){
 const writes=[],notifications=[],filters=[];
 const db={from(table){let update;const q={select(){return q;},eq(k,v){filters.push([table,k,v]);return q;},update(v){update=v;writes.push({table,value:v});return q;},maybeSingle:async()=>({data:previous,error:null}),single:async()=>({data:previous,error:null})};return q;}};
 process.env.NEXT_PUBLIC_SUPABASE_URL='https://example.test';process.env.SUPABASE_SERVICE_ROLE_KEY='test-key';
 const mod=load('app/veliler/actions.ts',{'@/lib/guardian/request-state':state,'@supabase/supabase-js':{createClient:()=>db},'@/lib/auth/profile':{requireProfile:async()=>({id:'staff',organization_id:'org'})},'@/lib/notifications/create-notification':{createNotification:async n=>{notifications.push(n);return {ok:true};}},'@/lib/guardian/revalidate':{revalidateGuardianConnection(){}},'next/cache':{revalidatePath(){}},'next/navigation':{redirect:url=>{throw Object.assign(Error('redirect'),{url});}}});return {mod,writes,notifications,filters};
}
test('A new management answer changes New to Answered and notifies only the owning parent',async()=>{
 const f=fixture();await assert.rejects(f.mod.manageGuardianRequest(form({request_id:'request',status:'new',guardian_response:'Yanıt',expected_updated_at:'version1'})),e=>e.url.includes('saved='));
 assert.equal(f.writes[0].value.status,'answered');assert.equal(f.writes[0].value.responded_by,'staff');assert.equal(f.notifications.length,1);assert.deepEqual(f.notifications[0].recipientProfileIds,['parent']);assert.ok(f.notifications[0].targetPath.includes('child=child'));assert.ok(f.filters.some(x=>x[1]==='organization_id'&&x[2]==='org'));
});
test('Saving an internal/status change preserves previous answer and does not send the same answer again',async()=>{
 const f=fixture({guardian_id:'parent',student_id:'child',guardian_response:'Previous answer',responded_by:'first-staff',responded_at:'first-time',updated_at:'version1'});
 await assert.rejects(f.mod.manageGuardianRequest(form({request_id:'request',status:'resolved',internal_note:'Private'})),e=>e.url.includes('saved='));
 assert.equal(f.writes[0].value.guardian_response,'Previous answer');assert.equal(f.writes[0].value.responded_by,'first-staff');assert.equal(f.writes[0].value.responded_at,'first-time');assert.equal(f.notifications.length,0);
});
test('A stale management form is rejected before any write or notification',async()=>{
 const f=fixture();await assert.rejects(f.mod.manageGuardianRequest(form({request_id:'request',status:'new',guardian_response:'Stale',expected_updated_at:'old-version'})),e=>e.url.includes('error='));assert.equal(f.writes.length,0);assert.equal(f.notifications.length,0);
});
test('Guardian notification read and list always filter the current account and organization',async()=>{
 const calls=[];const db={from(){const q={select(){return q;},update(){return q;},eq(k,v){calls.push([k,v]);return q;},order(){return q;},limit:async()=>({data:[],error:null}),then(resolve){return Promise.resolve({error:null}).then(resolve);}};return q;}};
 const api=load('app/api/guardian-notifications/route.ts',{'next/server':{NextResponse:{json:body=>body}},'@/lib/auth/profile':{requireProfile:async roles=>{assert.deepEqual(roles,['guardian']);return {id:'parent',organization_id:'org'};}},'@/lib/supabase/server':{createClient:async()=>db}});
 await api.GET();assert.ok(calls.some(([k,v])=>k==='recipient_user_id'&&v==='parent'));calls.length=0;
 await api.POST({json:async()=>({id:'foreign-notice'})});assert.deepEqual(calls,[['organization_id','org'],['recipient_user_id','parent'],['id','foreign-notice']]);
});
