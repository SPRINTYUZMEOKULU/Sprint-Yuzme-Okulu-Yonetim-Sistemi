const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const React = require('react');
const {renderToStaticMarkup} = require('react-dom/server');
function load(path, mocks={}) {
 const m={exports:{}};
 const code=ts.transpileModule(fs.readFileSync(path,'utf8').replace(/<style jsx(?: global)?>/g,'<style>'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true,target:ts.ScriptTarget.ES2020}}).outputText;
 new Function('module','exports','require',code)(m,m.exports,n=>n in mocks?mocks[n]:require(n));
 return m.exports;
}
const queue=load('lib/enrollment/renewal-queue.ts');
const a='11111111-1111-4111-8111-111111111111', b='22222222-2222-4222-8222-222222222222';
test('bulk queue resumes in order, removes only the completed student and ignores corrupt storage',()=>{
 assert.deepEqual(queue.readRenewalQueue(JSON.stringify([a,a,12,'../../wrong',b])),[a,b]);
 assert.deepEqual(queue.advanceRenewalQueue([a,b],a),[b]);
 assert.deepEqual(queue.advanceRenewalQueue([b],b),[]);
 assert.deepEqual(queue.readRenewalQueue('{broken'),[]);
 assert.deepEqual(queue.readRenewalQueue('{}'),[]);
});
const Summary=load('app/kayit-yenilemeleri/decision-completion-summary.tsx',{
 'next/link':{__esModule:true,default:({children,...props})=>React.createElement('a',props,children)},
 '@/lib/dates/display':{formatDisplayDate:()=> '30.10.2026'}
}).default;
const item=(id,status='active',category='active')=>({id,name:id,status,category,lastRenewedAt:'2026-10-30',passiveAt:null});
test('summary counts students once even across repeated renewals and passive history',()=>{
 const history=[a,a,b].map((studentId,i)=>({id:String(i),studentId,studentName:studentId,performedAt:null}));
 const html=renderToStaticMarkup(React.createElement(Summary,{items:[item(a),item(b,'passive','passive')],history,approvals:[]}));
 assert.match(html,/2 öğrencinin 2 tanesi tamamlandı, 0 tanesi bekliyor/);
 assert.match(html,/Yenilenen<\/small><b>1<\/b>/);
});
test('pending and approved-but-unconsumed requests stay pending and cannot inflate completion',()=>{
 const html=renderToStaticMarkup(React.createElement(Summary,{items:[item(a),item(b,'active','action')],history:[],approvals:[{studentId:a},{studentId:a},{studentId:b}]}));
 assert.match(html,/2 öğrencinin 0 tanesi tamamlandı, 2 tanesi bekliyor/);
 assert.match(html,/0% tamamlandı/);
});
async function decideRenewal(action, renewal=true){
 const writes=[],notifications=[];
 const approval={id:a,organization_id:'org',student_id:b,status:'pending',request_type:'registration_custom_lesson_count',metadata:{source:renewal?'student_renewal_center':'registration_completion'},new_values:{total_lessons:9},requested_by:'staff'};
 const db={auth:{getUser:async()=>({data:{user:{id:'owner'}},error:null})},from(table){let mode='read';const q={select(){return q},eq(){return q},maybeSingle(){return q},update(value){mode='update';writes.push({table,value});return q},insert(value){mode='insert';writes.push({table,value});return q},then(resolve,reject){const data=mode!=='read'?null:table==='profiles'?{id:'owner',organization_id:'org',role:'owner',full_name:'Owner'}:table==='approval_requests'?approval:table==='students'?{id:b}:null;return Promise.resolve({data,error:null}).then(resolve,reject)}};return q}};
 const route=load('app/api/approval-center/route.ts',{
  'next/server':{NextResponse:{json:(body,options)=>({body,status:options?.status||200})}},
  '@/lib/supabase/server':{createClient:async()=>db},
  '@/lib/notifications/publish-event':{publishEventNotification:async n=>{notifications.push(n);return {error:null}}}
 });
 const response=await route.POST({json:async()=>({id:a,source:'approval_request',action})});
 return {response,writes,notifications};
}
test('renewal approval preserves passive status and existing registration checklist, and opens renewal instead of first registration',async()=>{
 const {response,writes,notifications}=await decideRenewal('approve');
 assert.equal(response.status,200);assert.equal(response.body.ok,true);
 assert.equal(writes.filter(x=>x.table==='students'||x.table==='registration_completion_checklists').length,0);
 assert.equal(notifications[0].target_path,`/ogrenciler/${b}?renewalApproval=approved&renewalRequestId=${a}`);
 assert.match(notifications[0].message,/Kayıt yenileme işlemine devam/);
});
test('renewal rejection preserves the registration checklist and returns to renewal',async()=>{
 const {response,writes,notifications}=await decideRenewal('reject');
 assert.equal(response.status,200);assert.equal(writes.filter(x=>x.table==='registration_completion_checklists').length,0);
 assert.equal(notifications[0].target_path,`/ogrenciler/${b}?renewal=1`);
});
test('first registration approval retains its existing checklist and target',async()=>{
 const {response,writes,notifications}=await decideRenewal('approve',false);
 assert.equal(response.status,200);assert.ok(writes.some(x=>x.table==='registration_completion_checklists'));
 assert.equal(notifications[0].target_path,`/kayit-tamamlama/${b}?approval=approved`);
});
