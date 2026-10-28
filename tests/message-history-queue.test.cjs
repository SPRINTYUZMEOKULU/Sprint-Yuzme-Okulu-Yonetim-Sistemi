const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {stripTypeScriptTypes}=require('node:module');
const {createHash}=require('node:crypto');
const root=path.join(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
function compileRoute(p,name,client){
  const source=read(p).replace(/^import .*;\n/gm,'').replace('export async function '+name,'async function '+name);
  return new Function('NextResponse','requireProfile','createClient','createHash',stripTypeScriptTypes(source)+';return '+name)(
    {json:(data,options={})=>({status:options.status||200,data})},
    async()=>({id:'staff',organization_id:'org'}),async()=>client,createHash);
}
function database(){
 const tables={students:[{id:'student-a',organization_id:'org'},{id:'student-b',organization_id:'org'}],message_logs:[],student_contact_logs:[],student_activity_logs:[]};
 const fail={table:null};
 return {tables,fail,from(table){
   let filters=[],row,options,single=false;
   const q={select(){return q},eq(k,v){filters.push(r=>r[k]===v);return q},in(k,v){filters.push(r=>v.includes(r[k]));return q},order(){return q},limit(){return q},maybeSingle(){single=true;return q},upsert(r,o){row=r;options=o;return q},then(resolve,reject){
     if(fail.table===table)return Promise.resolve({error:{message:'simulated failure'},data:null}).then(resolve,reject);
     if(row){const old=tables[table].findIndex(r=>r.id===row.id);if(old<0)tables[table].push({...row});else if(!options.ignoreDuplicates)tables[table][old]={...tables[table][old],...row};return Promise.resolve({error:null,data:null}).then(resolve,reject)}
     const rows=tables[table].filter(r=>filters.every(f=>f(r)));return Promise.resolve({error:null,data:single?rows[0]||null:rows}).then(resolve,reject);
   }};return q;
 }};
}
const payload={studentId:'student-a',recipient:'05000000000',message:'Test message',sourcePath:'/hazir-mesajlar',interactionId:'10000000-0000-4000-8000-000000000001',templateKey:'payment',templateTitle:'Ödeme Bilgilendirmesi'};
test('queue logs opened separately, confirms once, and never downgrades sent',async()=>{
 const db=database(),post=compileRoute('app/api/whatsapp-interactions/route.ts','POST',db);
 const send=body=>post({json:async()=>body});
 assert.equal((await send({...payload,queueEvent:'opened'})).status,200);
 assert.equal(db.tables.message_logs[0].status,'opened');assert.equal(db.tables.student_contact_logs.length,0);
 assert.equal((await send({...payload,queueEvent:'confirmed'})).status,200);
 await send({...payload,queueEvent:'confirmed'});await send({...payload,queueEvent:'opened'});
 assert.equal(db.tables.message_logs.length,1);assert.equal(db.tables.message_logs[0].status,'sent');
 assert.equal(db.tables.message_logs[0].metadata.delivery_confirmation,'manual_confirmed');
 assert.equal(db.tables.student_contact_logs.length,1);assert.equal(db.tables.student_activity_logs.length,1);
 // Shared family phone numbers must still target the explicitly chosen student.
 await send({...payload,studentId:'student-b',queueEvent:'confirmed'});
 assert.equal(db.tables.message_logs.length,2);assert.equal(db.tables.message_logs[1].student_id,'student-b');
 assert.equal((await send({...payload,studentId:'outside-org',queueEvent:'confirmed'})).status,400);
});
test('partial confirmation failure is surfaced and retry repairs mirrors without duplicates',async()=>{
 const db=database(),post=compileRoute('app/api/whatsapp-interactions/route.ts','POST',db);
 const send=()=>post({json:async()=>({...payload,queueEvent:'confirmed'})});
 db.fail.table='student_contact_logs';assert.equal((await send()).status,500);
 db.fail.table=null;assert.equal((await send()).status,200);
 assert.equal(db.tables.message_logs.length,1);assert.equal(db.tables.student_contact_logs.length,1);assert.equal(db.tables.student_activity_logs.length,1);
});
test('history keeps distinct full bodies and prefers message metadata over mirrored contacts',async()=>{
 const db=database(),time='2026-10-28T12:00:00Z',common={organization_id:'org',student_id:'student-a',prepared_at:time,sent_at:time,channel:'whatsapp',status:'sent'};
 db.tables.message_logs.push({...common,id:'one',recipient:'905000000000',message_body:'a'.repeat(180)+'first',metadata:{delivery_confirmation:'whatsapp_opened'}},{...common,id:'two',recipient:'905000000000',message_body:'a'.repeat(180)+'second',metadata:{delivery_confirmation:'manual_confirmed'}});
 db.tables.student_contact_logs.push({...common,id:'one',recipient_phone:'05000000000',message_text:'a'.repeat(180)+'first'});
 const get=compileRoute('app/api/student-message-history/route.ts','GET',db);
 const result=await get({nextUrl:new URL('https://example.test/api?studentId=student-a')});
 assert.equal(result.data.timeline.length,2);assert.equal(result.data.timeline[0].status,'opened');assert.equal(result.data.timeline[1].status,'confirmed');
});
test('history cards escape HTML and expose the entire long message accessibly',()=>{
 let source=read('app/components/student-message-history-enhancer.tsx');source=source.slice(source.indexOf('type TimelineItem'),source.indexOf('function ensureStyles'));
 const render=new Function('formatDisplayDateTime',stripTypeScriptTypes(source)+';return renderMessage;')(()=> '28.10.2026 15:00');
 const html=render({id:'x',title:'Test',body:'<script>alert(1)</script>'+ 'x'.repeat(250)+'END',status:'opened',recipient:'05000000000',sentAt:'2026-10-28'});
 assert.ok(html.includes('<details'));assert.ok(html.includes('Mesajın tamamını göster'));assert.ok(html.includes('END'));
 assert.ok(!html.includes('<script>'));assert.ok(html.includes('&lt;script&gt;'));assert.ok(html.includes('Onay bekliyor'));
});
