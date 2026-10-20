const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
function load(file,imports={}){const m={exports:{}};const js=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX}}).outputText;new Function('require','exports','module',js)(n=>n in imports?imports[n]:n.endsWith('.css')?{}:require(n),m.exports,m);return m.exports;}
const visibility=load('lib/guardian/notification-visibility.ts');
const payments=load('lib/guardian/payment-summary.ts');
test('Guardian notifications reject management, foreign origin, ambiguous paths and a different child',()=>{
 for(const path of ['/on-kayitlar','//evil.test/veli-paneli','/veli-paneli-admin','/veli-paneli/../on-kayitlar','/\\evil.test/veli-paneli','javascript:alert(1)'])assert.equal(visibility.guardianNotificationPath(path),null,path);
 assert.equal(visibility.visibleGuardianNotification({target_path:'/veli-mesajlar?child=other',student_id:'child'},['child']),false);
 assert.equal(visibility.visibleGuardianNotification({target_path:'/veli-mesajlar?child=child',student_id:'other'},['child']),false);
 assert.equal(visibility.visibleGuardianNotification({target_path:'/veli-mesajlar?child=child#mesaj-1',student_id:'child'},['child']),true);
});
test('Unpaid payment is never labeled cancelled or refunded and unknown statuses are explicit',()=>{
 assert.equal(payments.paymentPresentation('pending').label,'Bekleniyor');assert.equal(payments.paymentPresentation('cancelled').label,'İptal edildi');assert.equal(payments.paymentPresentation('refunded').label,'İade edildi');assert.equal(payments.paymentPresentation('future-status').label,'Durum kontrol edilmeli');
});
test('Installment uses actual due date and paid amount rather than a stale status',()=>{
 assert.equal(payments.installmentPresentation({amount:100,paid_amount:20,status:'pending',due_date:'2026-10-01'},'2026-10-20').label,'Gecikti');
 assert.equal(payments.installmentPresentation({amount:100,paid_amount:100,status:'overdue',due_date:'2026-10-01'},'2026-10-20').label,'Ödendi');
 assert.equal(payments.installmentPresentation({amount:100,paid_amount:0,status:'cancelled',due_date:'2026-10-01'},'2026-10-20').remaining,0);
 assert.equal(payments.installmentPresentation({amount:100,paid_amount:0,status:'pending',due_date:'2026-10-20'},'2026-10-20').label,'Bugün ödenecek');
});
test('Guardian canonical record, portal access and active student are checked before returning notification scope',async()=>{
 const filters=[];const rows={guardians:{id:'canonical-id'},guardian_students:[{student_id:'child'}],students:[{id:'child'}]};
 const db={from(table){const q={select(){return q;},eq(k,v){filters.push([table,k,v]);return q;},in(k,v){filters.push([table,k,v]);return q;},maybeSingle:async()=>({data:rows[table],error:null}),then(resolve){return Promise.resolve({data:rows[table],error:null}).then(resolve);}};return q;}};
 const access=load('lib/guardian/access.ts');assert.deepEqual((await access.guardianStudentAccess(db,'parent','org')).studentIds,['child']);
 assert.ok(filters.some(([t,k,v])=>t==='guardian_students'&&k==='guardian_id'&&v==='canonical-id'));
 assert.ok(filters.some(([t,k,v])=>t==='guardian_students'&&k==='portal_access'&&v===true));assert.ok(filters.some(([t,k,v])=>t==='students'&&k==='status'&&v==='active'));
 rows.guardians=null;assert.deepEqual((await access.guardianStudentAccess(db,'parent','org')).studentIds,[]);
});
test('Portal message is saved before notifying the intended parent, using its real message ID',async()=>{
 process.env.NEXT_PUBLIC_SUPABASE_URL='https://example.test';process.env.SUPABASE_SERVICE_ROLE_KEY='test-key';const events=[];
 const db={from(table){const q={select(){return q;},eq(){return q;},insert(value){events.push({kind:'insert',table,value});return q;},maybeSingle:async()=>({data:{id:'parent'},error:null}),single:async()=>({data:{id:'message-id'},error:null})};return q;}};
 const actions=load('app/veliler/[id]/actions.ts',{'next/cache':{revalidatePath(){}},'next/navigation':{redirect:url=>{throw Object.assign(Error('redirect'),{url});}},'@supabase/supabase-js':{createClient:()=>db},'@/lib/auth/profile':{requireProfile:async()=>({id:'staff',organization_id:'org'})},'@/lib/guardian/note-sharing':{},'@/lib/guardian/revalidate':{},'@/lib/guardian/access':{guardianStudentAccess:async()=>({studentIds:['child'],error:null})},'@/lib/notifications/create-notification':{createNotification:async value=>{events.push({kind:'notification',value});return {ok:true};}}});
 const form=new FormData();for(const [k,v] of Object.entries({guardian_profile_id:'parent',title:'Program',body:'Bilgilendirme'}))form.set(k,v);
 await assert.rejects(actions.sendGuardianPortalMessage(form),error=>error.url.includes('saved='));assert.equal(events[0].table,'guardian_messages');assert.deepEqual(events[1].value.recipientProfileIds,['parent']);assert.equal(events[1].value.sourceId,'message-id');assert.equal(events[1].value.targetPath,'/veli-mesajlar#mesaj-message-id');
});
test('Payment screen excludes internal plan notes and renders the actual pending payment state',async()=>{
 const React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
 const data={students:[],selected:{id:'child'},issues:[],enrollment:{id:'e',package_price:100},coursePackage:{name:'Paket'},payments:[{id:'pay',enrollment_id:'e',payment_status:'pending',received_at:'2026-10-19T22:30:00Z',amount:20}],paymentPlan:{status:'active',total_amount:100,note:'PRIVATE STAFF NOTE'},paymentInstallments:[]};
 const dates=load('lib/dates/display.ts');const page=load('app/veli-odemeler/page.tsx',{'@/lib/guardian/page-context':{loadGuardianPage:async()=>({profile:{id:'parent'},data})},'@/lib/guardian/data':{formatDate:dates.formatDisplayDate,formatMoney:n=>String(n)},'@/app/veli-paneli/guardian-ui':{GuardianHeader:()=>null,StatusPill:({children})=>React.createElement('span',null,children),EmptyGuardian:()=>null},'@/app/veli-paneli/payment-reminder':{default:()=>null},'@/lib/guardian/payment-summary':payments});
 const html=renderToStaticMarkup(await page.default({searchParams:Promise.resolve({})}));assert.ok(!html.includes('PRIVATE STAFF NOTE'));assert.ok(html.includes('Bekleniyor'));assert.ok(html.includes('20.10.2026'));
});
