const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
function load(file,mocks={}){const m={exports:{}};new Function('require','module','exports',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText)(name=>mocks[name]||require(name),m,m.exports);return m.exports;}
const readiness=load('lib/guardian/readiness.ts'),diagnostics=load('lib/guardian/client-diagnostics.ts');
test('readiness distinguishes missing pricing, future starts and inaccessible guardian accounts',()=>{
 const result=readiness.buildPortalReadiness([{id:'a',first_name:'Bir'},{id:'b'},{id:'c'},{id:'d'}],[{id:'ea',student_id:'a',status:'active',package_id:null},{id:'eb',student_id:'b',status:'scheduled',package_id:'p'},{id:'ec',student_id:'c',status:'active',package_id:null}],[{student_id:'a',guardian_id:'g',portal_access:true},{student_id:'b',guardian_id:'disabled',portal_access:true}],[{id:'g',auth_user_id:'profile',is_active:true,login_enabled:true},{id:'disabled',auth_user_id:'profile',is_active:true,login_enabled:false}],[{id:'profile',role:'guardian',is_active:true}],[{enrollment_id:'ec',status:'active',total_amount:0}]);
 assert.equal(result.activeStudents,4);assert.equal(result.connected,1);assert.equal(result.missingPackage,1);assert.equal(result.missingPeriod,1);assert.equal(result.awaitingStart,1);assert.equal(result.rows.find(r=>r.id==='a').name,'Bir');assert.equal(result.rows.find(r=>r.id==='c').missingPackage,false);
});
test('readiness uses the active period before a newer scheduled period',()=>{const result=readiness.buildPortalReadiness([{id:'a'}],[{id:'old',student_id:'a',status:'active',package_id:null,created_at:'2026-10-01'},{id:'new',student_id:'a',status:'scheduled',package_id:'p',created_at:'2026-11-01'}],[],[],[],[]);assert.equal(result.missingPackage,1)});
test('readiness loader scopes every table and uses the actual composite guardian-student key without writing',async()=>{
 const calls=[];const values={students:[{id:'s'}],student_enrollments:[{id:'e',student_id:'s',status:'active',package_id:'p'}],guardians:[],profiles:[],student_payment_plans:[],guardian_students:[]};
 const db={from(table){const filters=[],orders=[];let columns='';const q={select(c){columns=c;return q},eq(k,v){filters.push([k,v]);return q},in(k,v){filters.push([k,v]);return q},order(k){orders.push(k);return q},range:async()=>{calls.push({table,columns,filters,orders});return {data:values[table],error:null}}};return q;}};
 const result=await readiness.loadPortalReadiness(db,'org');assert.equal(result.activeStudents,1);
 for(const call of calls.filter(c=>c.table!=='guardian_students'))assert.ok(call.filters.some(([key,value])=>key==='organization_id'&&value==='org'));
 const links=calls.find(c=>c.table==='guardian_students');assert.equal(links.columns,'student_id,guardian_id,portal_access');assert.deepEqual(links.orders,['student_id','guardian_id']);assert.ok(links.filters.some(([key,ids])=>key==='student_id'&&ids[0]==='s'));
});
test('diagnostic payload excludes all free-form error text, stack, personal data and query parameters',()=>{
 const error={message:'Minified React error #310; Password Secret-94! phone 05551112233',stack:'private stack'};
 const result=diagnostics.portalDiagnostic(error,'/veli-odemeler?child=private-id#private','Mozilla Chrome/120');
 assert.deepEqual(result,{screen:'/veli-odemeler',category:'render',reactCode:310,browser:'chromium'});assert.doesNotMatch(JSON.stringify(result),/Secret|0555|private|stack/);
 assert.equal(diagnostics.portalDiagnostic(error,'/ogrenciler/private-id'),null);
 for(const [text,category] of [['Loading chunk 12 failed','chunk'],['SecurityError: localStorage','storage'],['WebSocket failed','realtime'],['removeChild NotFoundError','dom'],['API is not a function','unsupported']])assert.equal(diagnostics.portalDiagnostic(text,'/veli-paneli').category,category);
});
test('diagnostic endpoint accepts only an authenticated same-origin fixed schema and never logs extra properties',async()=>{
 const logs=[],saved=console.error;let role='guardian';console.error=(...args)=>logs.push(args);
 const db={auth:{getUser:async()=>({data:{user:{id:'self'}},error:null})},from:()=>({select(){return this},eq(){return this},maybeSingle:async()=>({data:{role,is_active:true},error:null})})};
 const route=load('app/api/portal-client-errors/route.ts',{'next/server':{NextResponse:{json:(body,{status=200}={})=>({body,status})}},'@/lib/supabase/server':{createClient:async()=>db},'@/lib/guardian/client-diagnostics':diagnostics});
 const req=(body,origin='https://portal.test')=>({nextUrl:new URL('https://portal.test/api/portal-client-errors'),headers:new Headers({'content-type':'application/json',origin}),json:async()=>body});
 try{const payload={screen:'/veli-paneli',category:'render',browser:'safari',reactCode:310,password:'NEVER LOG',phone:'05551112233'};assert.equal((await route.POST(req(payload))).status,200);assert.doesNotMatch(JSON.stringify(logs),/NEVER LOG|05551112233/);assert.equal((await route.POST(req(payload,'https://other.test'))).status,403);assert.equal((await route.POST(req({...payload,screen:'/veli-paneli?child=private'}))).status,400);role='coach';assert.equal((await route.POST(req(payload))).status,403);assert.equal(logs.length,1);}finally{console.error=saved;}
});
