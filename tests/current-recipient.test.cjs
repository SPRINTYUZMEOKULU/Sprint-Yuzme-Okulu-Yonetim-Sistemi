const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),ts=require('typescript');
function route(student,profile={organization_id:'org',id:'staff'},error=null){
 const filters=[];const q={select(){return q},eq(k,v){filters.push([k,v]);return q},maybeSingle:async()=>({data:student,error})};
 const m={exports:{}};
 new Function('require','module','exports',ts.transpileModule(fs.readFileSync('app/api/student-message-recipient/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(name=>{
  if(name==='next/server')return {NextResponse:{json:(body,options={})=>({body,status:options.status||200})}};
  if(name==='@/lib/auth/profile')return {requireProfile:async roles=>{assert.ok(!roles.includes('guardian'));return profile;}};
  if(name==='@/lib/supabase/server')return {createClient:async()=>({from:()=>q})};throw Error(name);
 },m,m.exports);
 return {call:body=>m.exports.POST({json:async()=>body}),filters};
}
test('stale prepared recipient is replaced with saved current number, scoped to organization and student',async()=>{
 const r=route({id:'ekin',phone:'+90 505 000 11 22',guardian_phone:null});
 const result=await r.call({studentId:'ekin',previousRecipient:'05430003344'});
 assert.equal(result.body.recipient,'905050001122');assert.equal(result.body.changed,true);
 assert.deepEqual(r.filters,[['organization_id','org'],['id','ekin']]);
});
test('valid selected guardian/student number is preserved and normalizes Turkish prefixes',async()=>{
 for(const value of ['05050001122','5050001122','905050001122']){
 const r=route({phone:'05050001122',guardian_phone:'05430003344'});
 assert.equal((await r.call({studentId:'a',previousRecipient:value})).body.recipient,'905050001122');}
});
test('shared family number is looked up by explicit student ID, never by phone matching',async()=>{
 const r=route({phone:'05050001122'});await r.call({studentId:'sibling-two',previousRecipient:'05430003344'});
 assert.ok(r.filters.some(([k,v])=>k==='id'&&v==='sibling-two'));
});
test('missing, deleted, inaccessible and invalid phone records fail closed',async()=>{
 for(const record of [null,{is_deleted:true,phone:'05050001122'},{phone:'abc'},{phone:null,guardian_phone:null}]){
 const result=await route(record).call({studentId:'a',previousRecipient:'05430003344'});
 assert.notEqual(result.status,200);assert.equal(result.body.recipient,undefined);}
});
test('iPhone popup is reserved synchronously and closes if fresh lookup fails',async()=>{
 const source=ts.transpileModule(fs.readFileSync('lib/messaging/current-recipient.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
 for(const ok of [true,false]){
 let closed=false;const popup={opener:'old',location:{href:'about:blank'},close(){closed=true;}};
 const m={exports:{}};new Function('module','exports','window','fetch',source)(m,m.exports,{open:()=>popup},async()=>({ok,json:async()=>ok?{ok:true,recipient:'905050001122'}:{ok:false,message:'offline'}}));
 const promise=m.exports.openCurrentWhatsapp('a','old','Test');assert.equal(popup.opener,null);
 if(ok){assert.equal(await promise,'905050001122');assert.match(popup.location.href,/wa.me\/905050001122/);}else{await assert.rejects(promise,/offline/);assert.equal(closed,true);assert.equal(popup.location.href,'about:blank');}
 }
});
