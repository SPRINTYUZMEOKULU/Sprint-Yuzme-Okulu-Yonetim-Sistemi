const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const ts=require('typescript');const React=require('react');const {renderToStaticMarkup}=require('react-dom/server');
function load(file,mocks={}){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2017,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,{exports,require:name=>name==='@/lib/settings/server'?{readSettings:async(_db,_org,section)=>({values:section==='kurum'?{display_name:'Sprint Yüzme Okulu'}:{report_title:'Rapor Merkezi',report_footer:''}})}:name in mocks?mocks[name]:name.startsWith("@/")?load(name.slice(2)+".ts",mocks):require(name),Intl,Date,Map,Set,Number,Boolean,String,console});return exports;}
function fixture(){return {branches:[{id:'b1',name:'Meltem',is_active:true},{id:'b2',name:'Lara',is_active:true}],training_groups:[{id:'g',branch_id:'b1',name:'Çocuk',primary_coach_id:'c1',is_active:true}],students:[{id:'s',first_name:'Test',last_name:'Öğrenci',status:'active',branch_id:'b2',is_deleted:false}],student_enrollments:[{id:'e',student_id:'s',branch_id:'b1',group_id:'g',status:'active',created_at:'2026-10-01T10:00:00Z',start_date:'2026-10-01',planned_end_date:'2026-10-31',total_lessons:8,used_lessons:2,lesson_weekdays:[7],package_id:'p'}],attendance_records:[{id:'a',student_id:'s',branch_id:'b1',group_id:'g',schedule_id:'sc',coach_id:'c2',lesson_date:'2026-10-11',status:'present'}],student_payments:[{id:'p1',student_id:'s',enrollment_id:'e',payment_status:'received',amount:1000,received_at:'2026-09-30T22:00:00Z'},{id:'p2',student_id:'s',enrollment_id:'e',payment_status:'pending',amount:9000,received_at:'2026-10-02T10:00:00Z'},{id:'p3',student_id:'s',enrollment_id:'e',payment_status:'cancelled',amount:3000,received_at:'2026-10-02T10:00:00Z'}],profiles:[{id:'c1',full_name:'Plan Hoca',role:'coach'},{id:'c2',full_name:'Gerçek Hoca',role:'admin'}],lesson_schedules:[{id:'sc',branch_id:'b1',group_id:'g',coach_id:'c1',weekday:0,start_time:'19:00:00',is_active:true}],lesson_staff_assignments:[],lesson_student_assignments:[],course_packages:[{id:'p',price:4500}],student_payment_plans:[{id:'pl',enrollment_id:'e',total_amount:4000,status:'active'}],student_payment_installments:[]};}
async function render(data,params={}){let sheets;let reads=0;const db={rpc:async()=>({error:null}),from(table){let rows=data[table]||[];return {select(){return this},in(k,vs){rows=rows.filter(r=>vs.includes(r[k]));return this},then(resolve){return Promise.resolve({data:rows,error:null}).then(resolve)},eq(k,v){rows=rows.filter(r=>r[k]===v);return this},gte(k,v){rows=rows.filter(r=>r[k]>=v);return this},lte(k,v){rows=rows.filter(r=>r[k]<=v);return this},order(){return this},async range(a,b){reads++;return {data:rows.slice(a,b+1),error:null}}}}};const Page=load('app/raporlar/page.tsx',{'next/link':{default:({children,...p})=>React.createElement('a',p,children),__esModule:true},'@/lib/auth/profile':{requireProfile:async()=>({organization_id:'org'})},'@/lib/supabase/server':{createClient:async()=>db},'./reports.css':{},'./report-exports':{default:p=>{sheets=p.sheets;return null},__esModule:true},'@/lib/schedules/weekday':load('lib/schedules/weekday.ts'),'@/lib/schedules/effective':load('lib/schedules/effective.ts')}).default;
for(const rows of Object.values(data)) for(const row of rows)row.organization_id='org';const html=renderToStaticMarkup(await Page({searchParams:Promise.resolve({from:'2026-10-01',to:'2026-10-13',...params})}));return {html,sheets,reads};}
test('payments are received-only, Istanbul dates, enrollment balances and actual coach stay separate',async()=>{const {sheets,html}=await render(fixture(),{branch:'b1'});const summary=sheets.find(s=>s.name==='Yönetici özeti');assert.equal(summary.rows.find(r=>r[0]==='Tahsilat')[1],1000);const financial=sheets.find(s=>s.name==='Kayıt ve ödeme').rows[1];assert.equal(financial[6],4000);assert.equal(financial[7],1000);assert.equal(financial[8],3000);assert.match(html,/Öğrenci ataması eksik/);const lessons=sheets.find(s=>s.name==='Gerçekleşen dersler').rows[1];assert.equal(lessons[4],'Plan Hoca');assert.equal(lessons[5],'Gerçek Hoca');const coaches=sheets.find(s=>s.name==='Eğitmenler').rows;assert.equal(coaches.find(r=>r[0]==='Plan Hoca')[2],0);assert.equal(coaches.find(r=>r[0]==='Gerçek Hoca')[2],1);});
test('enrollment branch wins over current student branch; no double counting',async()=>{const {sheets}=await render(fixture(),{branch:'b2'});assert.equal(sheets.find(s=>s.name==='Yönetici özeti').rows.find(r=>r[0]==='Tahsilat')[1],0);});
test('reads past API limits and exports all active registrations',async()=>{const d=fixture();d.students=Array.from({length:1101},(_,i)=>({...d.students[0],id:`s${i}`}));d.student_enrollments=Array.from({length:1101},(_,i)=>({...d.student_enrollments[0],id:`e${i}`,student_id:`s${i}`}));const {sheets}=await render(d);assert.equal(sheets.find(s=>s.name==='Kayıt ve ödeme').rows.length,1102);});
test('invalid dates and reversed ranges are handled',async()=>{assert.match((await render(fixture(),{from:'2026-10-13',to:'2026-10-01'})).html,/Başlangıç tarihi/);await render(fixture(),{from:'2026-99-99'});});
if(process.env.REPORT_PREVIEW)render(fixture()).then(({html})=>fs.writeFileSync('/tmp/sprint-report-preview.html',`<!doctype html><html><head><meta charset="utf-8"><style>${fs.readFileSync('app/raporlar/reports.css','utf8')}</style></head><body>${html}</body></html>`));
test('manager summary remains compact while detail exports retain all student rows',async()=>{const d=fixture();d.students=Array.from({length:150},(_,i)=>({...d.students[0],id:`s${i}`}));d.student_enrollments=Array.from({length:150},(_,i)=>({...d.student_enrollments[0],id:`e${i}`,student_id:`s${i}`}));const {sheets,html}=await render(d);const summary=sheets.find(s=>s.name==='Yönetici özeti');assert.ok(summary.rows.length<=30);assert.equal(sheets.find(s=>s.name==='Kayıt ve ödeme').rows.length,151);assert.match(html,/<details class="reportNotesDetails">/);assert.ok(html.indexOf('Kayıt tarihleri ve ödeme durumu')<html.indexOf('Eksik ve kontrol özeti'));});
test('renewal and unpaid exports use current Istanbul date, retain partial payments and sequence rows',async()=>{const d=fixture();const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Istanbul'}).format(new Date());d.student_enrollments[0].planned_end_date=today;const {sheets,html}=await render(d);assert.equal(sheets.find(s=>s.name==='Bitişi yaklaşanlar').rows[1][2],'Bugün bitiyor');assert.equal(sheets.find(s=>s.name==='Kısmi ödeme yapanlar').rows.length,2);assert.equal(sheets.find(s=>s.name==='Ödeme yapılmayanlar').rows.length,1);assert.equal(sheets.find(s=>s.name==='Kayıt ve ödeme').rows[1][0],1);assert.doesNotMatch(html,/active \/ active/);d.student_payments=[];assert.equal((await render(d)).sheets.find(s=>s.name==='Ödeme yapılmayanlar').rows.length,2);});
test('active, awaiting-start and closed records have disjoint scopes; passive history remains auditable',async()=>{
 const d=fixture();
 d.students.push({...d.students[0],id:'passive',status:'passive'});
 d.student_enrollments.push({...d.student_enrollments[0],id:'ep',student_id:'passive'}, {...d.student_enrollments[0],id:'waiting',start_confirmation_required:true,actual_started_at:null}, {...d.student_enrollments[0],id:'scheduled',status:'scheduled'}, {...d.student_enrollments[0],id:'closed',status:'completed'});
 const rows=async status=>(await render(d,{status})).sheets.find(s=>s.name==='Kayıt ve ödeme').rows;
 assert.equal((await rows('active')).length,2);
 assert.equal((await rows('pending')).length,3);
 assert.equal((await rows('passive')).length,3);
 assert.equal((await rows('all')).length,6);
 const summary=(await render(d)).sheets.find(s=>s.name==='Yönetici özeti');
 assert.equal(summary.rows.find(r=>r[0]==='Aktif öğrenci')[1],1);
});
test('missing payment plan uses the Payment Center package and discloses its source',async()=>{
 const d=fixture();d.student_payment_plans=[];d.course_packages[0].price=99999;
 const {sheets}=await render(d);const r=sheets.find(s=>s.name==='Kayıt ve ödeme').rows[1];
 assert.equal(r[6],99999);assert.equal(r[7],1000);assert.equal(r[8],98999);assert.equal(r[13],'Borcu var');assert.match(r[14],/güncel paket ücreti/);
 assert.equal(sheets.find(s=>s.name==='Ödeme yapılmayanlar').rows.length,1);
 assert.equal(sheets.find(s=>s.name==='Yönetici özeti').rows.find(r=>r[0]==='Ücreti bilinmeyen kayıt')[1],0);
});
test('a later renewal keeps the expiry warning and appears as separate context',async()=>{
 const d=fixture();d.student_enrollments[0].planned_end_date='2026-01-02';
 d.student_enrollments.push({...d.student_enrollments[0],id:'renewal',start_date:'2099-01-01',planned_end_date:'2099-01-31',status:'scheduled'});
 const {sheets}=await render(d,{status:'all'});
 assert.equal(sheets.find(s=>s.name==='Kayıt ve ödeme').rows[1][2],'Süresi doldu');
 assert.equal(sheets.find(s=>s.name==='Kayıt ve ödeme').rows[1][11],'Yeni kayıt mevcut');
 assert.equal(sheets.find(s=>s.name==='Süresi dolanlar').rows.length,2);
});
test('passive groups do not inflate current group totals',async()=>{
 const d=fixture();d.training_groups[0].is_active=false;
 const {sheets}=await render(d);assert.equal(sheets.find(s=>s.name==='Şubeler').rows.find(r=>r[0]==='Meltem')[2],0);
});
test('expired enrollment keeps expiry warning alongside makeup rights',async()=>{
 const d=fixture();d.student_enrollments[0].planned_end_date='2026-01-02';
 d.student_compensation_lessons=[{id:'makeup',student_id:'s',enrollment_id:'e',lesson_date:'2099-01-01',status:'planned'}];
 const {sheets}=await render(d);
 assert.equal(sheets.find(s=>s.name==='Kayıt ve ödeme').rows[1][2],'Süresi doldu');
 assert.match(sheets.find(s=>s.name==='Kayıt ve ödeme').rows[1][11],/telafi hakkı var/);
 assert.equal(sheets.find(s=>s.name==='Süresi dolanlar').rows.length,2);
});

test('period numbers survive filters and payments never cross renewal periods',async()=>{
 const d=fixture();d.student_enrollments.push({...d.student_enrollments[0],id:'old',status:'completed',start_date:'2026-09-01',planned_end_date:'2026-09-30'});
 d.student_payments.push({...d.student_payments[0],id:'oldpay',enrollment_id:'old',amount:4500});
 const active=(await render(d)).sheets.find(s=>s.name==='Kayıt ve ödeme').rows[1];
 assert.equal(active[12],'2. kayıt dönemi');assert.equal(active[7],1000);assert.equal(active[8],3000);
 const old=(await render(d,{status:'all'})).sheets.find(s=>s.name==='Kayıt ve ödeme').rows[1];
 assert.equal(old[12],'1. kayıt dönemi');assert.equal(old[13],'Borcu yok');
});
test('missing package and conflicting plans remain unknown rather than debt free',async()=>{
 const d=fixture();d.student_payment_plans=[];d.course_packages=[];
 const r=(await render(d)).sheets.find(s=>s.name==='Kayıt ve ödeme').rows[1];assert.equal(r[8],null);assert.equal(r[13],'Belirlenemedi');
 d.student_payment_plans=[{id:'a',enrollment_id:'e',total_amount:4000},{id:'b',enrollment_id:'e',total_amount:5000}];d.course_packages=[{id:'p',price:4500}];
 assert.equal((await render(d)).sheets.find(s=>s.name==='Kayıt ve ödeme').rows[1][8],null);
});

test('null enrollment branch resolves from its group for filters and branch totals',async()=>{
 const d=fixture();d.student_enrollments[0].branch_id=null;
 const {sheets}=await render(d,{branch:'b1'});
 assert.equal(sheets.find(s=>s.name==='Kayıt ve ödeme').rows.length,2);
 assert.equal(sheets.find(s=>s.name==='Şubeler').rows.find(r=>r[0]==='Meltem')[1],1);
});
test('state breakdown keeps passive legacy active rows out of active scope and preserves receipt totals',async()=>{
 const d=fixture();d.students.push({...d.students[0],id:'passive',status:'passive'});
 d.student_enrollments.push({...d.student_enrollments[0],id:'ep',student_id:'passive'});
 d.student_payments.push({...d.student_payments[0],id:'pp',student_id:'passive',enrollment_id:'ep',amount:2000});
 const {sheets}=await render(d);
 assert.equal(sheets.find(s=>s.name==='Kayıt ve ödeme').rows.length,2);
 const breakdown=sheets.find(s=>s.name==='Kayıt durumları').rows;
 assert.deepEqual(Array.from(breakdown.find(r=>r[0]==='Aktif kayıt').slice(1)),[1,1,1000]);
 assert.deepEqual(Array.from(breakdown.find(r=>r[0]==='Pasif kursiyer kaydı').slice(1)),[1,1,2000]);
 assert.equal(breakdown.slice(1).reduce((sum,r)=>sum+r[3],0),3000);
 const passive=(await render(d,{status:'passive'})).sheets.find(s=>s.name==='Kayıt ve ödeme').rows;
 assert.equal(passive.length,2);assert.equal(passive[1][15],'Pasif kursiyer kaydı');
});
test('unresolved branch remains visible rather than disappearing from branch totals',async()=>{
 const d=fixture();d.student_enrollments[0].branch_id=null;d.student_enrollments[0].group_id=null;d.students[0].branch_id=null;
 const {sheets}=await render(d);assert.equal(sheets.find(s=>s.name==='Şubeler').rows.find(r=>r[0]==='Şubesi belirlenemeyen')[1],1);
});
test('group primary coach is part of the current planned session staff',async()=>{
 const d=fixture();d.lesson_schedules[0].coach_id=null;d.lesson_student_assignments=[{id:'as',schedule_id:'sc',student_id:'s',coach_id:'c1',is_active:true}];
 const {sheets}=await render(d);const a=sheets.find(s=>s.name==='Atamalar').rows[1];assert.equal(a[4],'Plan Hoca');assert.equal(a[5],'Plan Hoca');
});
