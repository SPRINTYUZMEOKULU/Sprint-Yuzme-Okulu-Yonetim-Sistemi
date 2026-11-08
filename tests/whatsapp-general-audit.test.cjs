const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
function code(path){return ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;}
test('global WhatsApp wrapper verifies student and falls back when popups are blocked',async()=>{
 for(const path of ['/ogrenciler/student','/odemeler']){
  const destinations=[],requests=[];let cleanup;
  const win={location:{origin:'https://example.test',pathname:path,search:'',assign:url=>destinations.push(url)},open:()=>null,alert:msg=>{throw Error(msg)}};
  const helpers={exports:{}};new Function('module','exports','window','fetch',code('lib/messaging/current-recipient.ts'))(helpers,helpers.exports,win,async()=>({ok:true,json:async()=>({ok:true,recipient:'905050001122'})}));
  const mod={exports:{}};
  new Function('require','module','exports','window','document','fetch',code('app/components/whatsapp-safe-open.tsx'))(name=>name==='react'?{useEffect:fn=>{cleanup=fn()}}:helpers.exports,mod,mod.exports,win,{addEventListener(){},removeEventListener(){}},async(url,opts)=>{requests.push(JSON.parse(opts.body));return {ok:true}});
  mod.exports.default();win.open('https://wa.me/905550001122?text=Test');await new Promise(r=>setImmediate(r));
  assert.equal(destinations.length,1);assert.ok(destinations[0].includes(path.includes('ogrenciler')?'905050001122':'905550001122'));assert.equal(requests.length,1);cleanup();
 }
});
function database({accessible=true,ambiguous=false}={}){
 const writes=[];return {writes,from(table){let single=false;const q={select(){return q},eq(){return q},or(){return q},gte(){return q},order(){return q},limit(){return q},maybeSingle(){single=true;return q},insert(row){writes.push({table,row});return q},then(resolve){const rows=table==='students'?(accessible?(ambiguous?[{id:'a'},{id:'b'}]:[{id:'a'}]):[]):[];return Promise.resolve({data:single?(rows[0]||null):rows,error:null}).then(resolve)}};return q;}};
}
function post(db){const m={exports:{}};new Function('require','module','exports',code('app/api/whatsapp-interactions/route.ts'))(name=>name==='node:crypto'?require(name):name==='next/server'?{NextResponse:{json:(body,opts={})=>({body,status:opts.status||200})}}:name==='@/lib/auth/profile'?{requireProfile:async()=>({id:'staff',organization_id:'org'})}:{createClient:async()=>db},m,m.exports);return body=>m.exports.POST({json:async()=>body});}
test('generic opening records opened only, without sent timestamp or confirmed contact',async()=>{
 const db=database();const result=await post(db)({studentId:'a',recipient:'05050001122',message:'Ödeme bilgisi',sourcePath:'/odemeler'});
 assert.equal(result.status,200);const message=db.writes.find(w=>w.table==='message_logs').row;
 assert.equal(message.status,'opened');assert.equal(message.sent_at,undefined);assert.equal(message.sent_by,undefined);assert.equal(message.metadata.delivery_confirmation,'whatsapp_opened');
 assert.equal(db.writes.filter(w=>w.table==='student_contact_logs').length,0);assert.equal(db.writes.find(w=>w.table==='student_activity_logs').row.activity_type,'whatsapp_message_opened');
});
test('inaccessible explicit student and ambiguous family phone never attach to another student',async()=>{
 for(const [opts,studentId] of [[{accessible:false},'outside-org'],[{ambiguous:true},null]]){
 const db=database(opts);await post(db)({studentId,recipient:'05050001122',message:'Test',sourcePath:'/odemeler'});assert.equal(db.writes.length,0);
 }
});
