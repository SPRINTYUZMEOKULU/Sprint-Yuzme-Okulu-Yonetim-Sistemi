const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), ts = require('typescript');
function load(path, resolver) {
  const m={exports:{}};
  new Function('module','exports','require',ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true}}).outputText)(m,m.exports,resolver);
  return m.exports;
}
function publisher() {
  const filters=[];
  const client={from(table){const q={select(){return q},eq(k,v){filters.push([k,v]);return q},in(){return q},then(resolve){return Promise.resolve({data:[{id:'owner'},{id:'admin'}],error:null}).then(resolve)}};return q}};
  const api=load('lib/notifications/publish-event.ts',name=>{
    if(name==='server-only')return {};
    if(name==='@/lib/supabase/server')return {createClient:async()=>client};
    if(name==='./create-notification')return {createNotification(){throw Error('real sender forbidden')}};
    throw Error(name);
  });
  return {...api,filters};
}
const event={organization_id:'org',title:'Payment saved',category:'finance',event_key:'payment_received',student_id:'student',entity_type:'student_payment',entity_id:'payment',body:'100 TL'};
const success={ok:true,notificationIds:['id'],recipientCount:1,push:{requested:true,sent:1,failed:0},message:'ok'};
test('payment event awaits real delivery and preserves source, student and organization',async()=>{
  const {publishEventNotification}=publisher();let delivered;
  const result=await publishEventNotification(event,async value=>{await Promise.resolve();delivered=value;return success});
  assert.equal(result.error,null);assert.equal(delivered.organizationId,'org');assert.equal(delivered.studentId,'student');assert.equal(delivered.sourceId,'payment');assert.equal(delivered.push,true);assert.match(delivered.targetPath,/student.*payment=history/);
});
test('explicit push-off and private recipient survive central routing',async()=>{
  let delivered;await publisher().publishEventNotification({...event,category:'approval',recipient_profile_id:'requester',push_requested:false},async value=>{delivered=value;return success});
  assert.equal(delivered.category,'approvals');assert.equal(delivered.push,false);assert.deepEqual(delivered.recipientProfileIds,['requester']);
});
test('bulk compensation creates one phone summary with individual student references',async()=>{
  const calls=[];const rows=['s1','s2','s3'].map(student_id=>({...event,category:undefined,notification_type:'bulk_compensation_approved',source_id:'request',student_id,body:'2 telafi dersi'}));
  await publisher().publishEventNotification(rows,async value=>{calls.push(value);return success});
  assert.equal(calls.length,1);assert.equal(calls[0].studentId,null);assert.equal(calls[0].metadata.affected_student_count,3);assert.deepEqual(calls[0].metadata.affected_student_ids,['s1','s2','s3']);assert.match(calls[0].body,/3 kursiyer/);
});
test('request owner joins organization managers and keeps role preferences in the sender',async()=>{
  const api=publisher();let delivered;
  await api.publishEventNotification({...event,category:'approvals',include_requester:'coach'},async value=>{delivered=value;return success});
  assert.deepEqual(delivered.recipientProfileIds,['owner','admin','coach']);assert.ok(api.filters.some(([k,v])=>k==='organization_id'&&v==='org'));
});
test('notification failure returns a warning without throwing after a saved business event',async()=>{
  const result=await publisher().publishEventNotification(event,async()=>{throw Error('test transport unavailable')});
  assert.ok(result.error);assert.match(result.error.message,/İşlem kaydedildi/);
});
test('repeated pending/approved cash actions do not update payments or notify again',async()=>{
  for(const [action,status] of [['requestCashHandover','handoff_pending'],['approveCashHandover','main_cash_confirmed']]){
    let writes=0,pushes=0;
    const client={from(){const q={select(){return q},eq(){return q},maybeSingle:async()=>({data:{id:'payment',student_id:'s',amount:100,payment_method:'cash',cash_handover_status:status},error:null}),update(){writes++;throw Error('unexpected update')}};return q}};
    const api=load('app/odemeler/actions.ts',name=>{
      if(name==='@/lib/notifications/cash-target')return load('lib/notifications/cash-target.ts',require);
      if(name==='next/cache')return {revalidatePath(){}};
      if(name==='@supabase/supabase-js')return {};
      if(name==='@/lib/auth/profile')return {requireProfile:async()=>({id:'owner',organization_id:'org'})};
      if(name==='@/lib/supabase/server')return {createClient:async()=>client};
      if(name==='@/lib/notifications/publish-event')return {publishEventNotification:async()=>{pushes++;return {error:null}}};
      throw Error(name);
    });
    assert.equal((await api[action]('payment')).ok,true);assert.equal(writes,0);assert.equal(pushes,0);
  }
});
