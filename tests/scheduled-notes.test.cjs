const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), ts = require('typescript');
function moduleFrom(path, resolver, environment = {}) {
  const mod = { exports: {} };
  new Function('module', 'exports', 'require', 'process', ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText)(mod, mod.exports, resolver, { env: environment });
  return mod.exports;
}
const now = new Date('2026-10-19T10:00:00Z');
const row = { id:'notice', recipient_profile_id:'owner', student_id:'student', source_id:'log', title:'Note', body:'Follow up', metadata:{reminder_at:'2026-10-19T09:55:00Z'} };
const log = { id:'log', student_id:'student', performed_by:'owner', reminder_at:row.metadata.reminder_at, reminder_completed:false };
async function dispatch(rows, logs) {
  const trace=[], delivered=[];
  const client={from(table){const filters=[];const q={select(){return q},eq(k,v){trace.push([table,k,v]);filters.push(r=>r[k]===v);return q},in(k,values){return q},gte(){return q},lte(){return q},order(){return q},limit(){return q},then(resolve){const data=(table==='system_notifications'?rows:logs).filter(r=>filters.every(f=>f(r)));return Promise.resolve({data,error:null}).then(resolve)}};return q}};
  // Query fixtures carry organization and unread / pending flags just like rows.
  const notices=rows.map(r=>Object.assign(r,{organization_id:'org',is_read:false,push_requested:false,push_sent:false}));
  logs.forEach(l=>Object.assign(l,{organization_id:'org'}));
  const {dispatchDueNoteReminders}=moduleFrom('lib/notifications/scheduled-notes.ts',()=>({deliverScheduledNotePush(){throw Error('real push forbidden')}}));
  const result=await dispatchDueNoteReminders(client,'org',now,async item=>{delivered.push(item);return {sent:1,failed:0}});
  return {result,delivered,trace};
}
test('server sends a due note to its owner without needing an open browser',async()=>{
  const {delivered,trace}=await dispatch([{...row}],[{...log}]);
  assert.equal(delivered.length,1);assert.equal(delivered[0].notificationId,'notice');assert.equal(delivered[0].profileId,'owner');
  assert.ok(trace.some(([t,k,v])=>t==='system_notifications'&&k==='organization_id'&&v==='org'));
  assert.ok(trace.some(([t,k,v])=>t==='student_activity_logs'&&k==='organization_id'&&v==='org'));
});
test('completed or missing reminders cannot send',async()=>{
  for(const logs of [[],[{...log,reminder_completed:true}]])assert.equal((await dispatch([{...row}],logs)).delivered.length,0);
});
test('future and historic backlog reminders cannot send',async()=>{
  for(const time of ['2026-10-19T10:05:00Z','2026-09-07T12:20:00Z']){
    assert.equal((await dispatch([{...row,metadata:{reminder_at:time}}],[{...log,reminder_at:time}])).delivered.length,0);
  }
});
test('edited time and recipient mismatches cannot send',async()=>{
  for(const changed of [{...log,reminder_at:'2026-10-19T09:54:00Z'},{...log,performed_by:'other'},{...log,student_id:'other'}])assert.equal((await dispatch([{...row}],[changed])).delivered.length,0);
});
test('only exact cron endpoint avoids interactive session redirect',async()=>{
  const response=type=>({type,headers:new Headers(),cookies:{getAll:()=>[],set(){}}});
  const {middleware}=moduleFrom('middleware.ts',name=>{
    if(name==='@supabase/ssr')return {createServerClient:()=>({auth:{getUser:async()=>({data:{user:null}})}})};
    if(name==='@supabase/supabase-js')return {};
    if(name==='next/server')return {NextResponse:{next:()=>response('next'),redirect:()=>response('redirect')}};
    throw Error(name);
  },{NEXT_PUBLIC_SUPABASE_URL:'https://example.test',NEXT_PUBLIC_SUPABASE_ANON_KEY:'test'});
  const request=path=>{const url=new URL('https://sprint.test'+path);url.clone=()=>new URL(url);return {nextUrl:url,headers:new Headers(),cookies:{getAll:()=>[]}}};
  assert.equal((await middleware(request('/api/cron/attendance-notifications'))).type,'next');
  assert.equal((await middleware(request('/api/cron/attendance-notifications/other'))).type,'redirect');
  assert.equal((await middleware(request('/api/push/test'))).type,'redirect');
});
test('cron route rejects absent and forged bearer credentials before data access',async()=>{
  const {authorizedCron}=moduleFrom('lib/notifications/cron-auth.ts',require);
  for(const secret of [undefined,'s'.repeat(40)]){
    const {GET}=moduleFrom('app/api/cron/attendance-notifications/route.ts',name=>{
      if(name==='next/server')return {NextResponse:{json:(body,options)=>({body,status:options?.status||200})}};
      if(name==='@supabase/supabase-js')return {createClient(){throw Error('unauthorized DB access')}};
      if(name.endsWith('cron-auth'))return {authorizedCron};
      return {};
    },{CRON_SECRET:secret});
    const result=await GET(new Request('https://sprint.test/api/cron/attendance-notifications',{headers:{authorization:'Bearer forged'}}));
    assert.equal(result.status,secret?401:503);
  }
});
test('concurrent scheduler ticks claim and deliver an existing notification only once',async()=>{
  let claimed=false, pushes=0;
  const admin={from(table){let patch;const q={select(){return q},eq(){return q},in(){return q},update(value){patch=value;return q},
    async maybeSingle(){if(claimed)return {data:null};claimed=true;return {data:{id:'notice'}}},
    then(resolve){let data=[];if(table==='profiles')data=[{id:'owner',role:'owner'}];if(table==='push_subscriptions')data=[{id:'device',endpoint:'https://push.test',p256dh:'test',auth_key:'test'}];return Promise.resolve({data,error:null}).then(resolve)}
  };return q}};
  const {deliverScheduledNotePush}=moduleFrom('lib/notifications/create-notification.ts',name=>{
    if(name==='server-only')return {};
    if(name==='node:crypto')return require(name);
    if(name==='@supabase/supabase-js')return {createClient:()=>admin};
    if(name==='web-push')return {setVapidDetails(){},async sendNotification(){pushes++}};
    if(name==='@/lib/dates/display')return {formatDatesInText:value=>value};
    if(name.endsWith('resolve-scope-context'))return {resolveNotificationScopeContext:async()=>({hasAssignableContext:false})};
    throw Error(name);
  },new Proxy({},{get:()=> 'test-placeholder'}));
  const input={organizationId:'org',notificationId:'notice',profileId:'owner',studentId:'student',title:'Note',body:'Due',targetPath:'/bildirimler'};
  const results=await Promise.all([deliverScheduledNotePush(input),deliverScheduledNotePush(input)]);
  assert.equal(pushes,1);assert.equal(results.reduce((sum,result)=>sum+result.sent,0),1);
});
