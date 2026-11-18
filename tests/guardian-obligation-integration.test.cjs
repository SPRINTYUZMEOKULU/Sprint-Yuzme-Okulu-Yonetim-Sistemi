const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
function load(file,mocks={}){const m={exports:{}};new Function('require','module','exports',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText)(n=>n in mocks?mocks[n]:n.endsWith('.css')?{}:n==='@/app/components/ui-icon'?load('app/components/ui-icon.tsx'):require(n),m,m.exports);return m.exports;}
const summary=load('lib/guardian/payment-summary.ts');
test('Palet 12000 TL is shown as an independent debt even when no course package is assigned',()=>{
 const extras=summary.guardianObligationSummary([{id:'palet',title:'Palet',amount:12000,paid_amount:0,due_date:'2026-11-16',status:'open'}]);
 const course=summary.guardianPaymentSummary({id:'period',package_id:null},null,[]);
 assert.equal(course.debt,0);assert.equal(extras.debt,12000);
 const reminder=summary.guardianCombinedReminder({id:'period'},course.debt,[],null,extras.rows,'2026-11-16');assert.equal(reminder.amount,12000);assert.equal(reminder.state,'today');
});
test('extra receipt never reduces package debt or appears as excess package payment',()=>{
 const payments=[{id:'package',enrollment_id:'e',amount:1000,payment_status:'received'},{id:'extra',enrollment_id:'e',amount:12000,payment_status:'received',is_obligation_payment:true}];
 assert.deepEqual(summary.guardianPaymentSummary({id:'e'},{price:4000},payments),{paid:1000,price:4000,debt:3000,excess:0});
 const extras=summary.guardianObligationSummary([{title:'Palet',amount:12000,paid_amount:12000,status:'paid'},{title:'İptal',amount:9000,status:'cancelled'},{title:'Paket ücreti taksiti',obligation_type:'installment',amount:4000,paid_amount:1000,status:'open'}]);assert.equal(extras.debt,0);assert.equal(extras.rows.length,1);
});
test('the earliest unpaid due date wins across course installments and extra obligations',()=>{
 const reminder=summary.guardianCombinedReminder({id:'e',payment_due_date:'2026-11-20'},3000,[],null,[{title:'Palet',amount:12000,paid_amount:2000,status:'partially_paid',due_date:'2026-11-15'}],'2026-11-16');
 assert.equal(reminder.debt,13000);assert.equal(reminder.amount,10000);assert.equal(reminder.dueDate,'2026-11-15');assert.equal(reminder.state,'overdue');
});
test('payment page renders actual extra debt, due date and missing package without disclosing internal descriptions',async()=>{
 const React=require('react'),{renderToStaticMarkup}=require('react-dom/server');const data={students:[],selected:{id:'child'},issues:[],enrollment:{id:'e'},coursePackage:null,payments:[],paymentPlan:null,paymentInstallments:[],obligations:[{id:'palet',title:'Palet',amount:12000,paid_amount:0,due_date:'2026-11-16',status:'open',description:'INTERNAL ONLY'}]};
 const Page=load('app/veli-odemeler/page.tsx',{'./guardian-invoice-list':{__esModule:true,default:()=>null},'./actions':{openGuardianBankPayment(){}},'@/app/ogrenciler/[id]/pending-submit-button':{__esModule:true,default:({children})=>React.createElement('button',null,children)},'@/app/veli-paneli/section-heading':load('app/veli-paneli/section-heading.tsx',{'./guardian-ui':{GuardianIcon:()=>null}}),'@/lib/guardian/page-context':{loadGuardianPage:async()=>({profile:{id:'parent'},data})},'@/lib/guardian/data':{formatDate:d=>d,formatMoney:n=>n+' TL'},'@/app/veli-paneli/guardian-ui':{GuardianHeader:()=>null,StatusPill:({children})=>React.createElement('span',null,children),EmptyGuardian:()=>null},'@/app/veli-paneli/payment-reminder':{__esModule:true,default:()=>null},'@/app/veli-paneli/history-pagination':{__esModule:true,default:()=>null},'@/lib/guardian/payment-summary':summary}).default;
 const html=renderToStaticMarkup(await Page({searchParams:Promise.resolve({})}));for(const label of ['TOPLAM KALAN BORÇ','12000 TL','Palet','2026-11-16','Henüz tanımlanmadı','ek-borclar','Ödeme İşlemini Başlat'])assert.ok(html.includes(label),label);assert.doesNotMatch(html,/INTERNAL ONLY/);
});
test('missing real-time transport cannot crash the guardian notification component',async()=>{
 const {JSDOM}=require('jsdom'),React=require('react');const dom=new JSDOM('<div id="root"></div>',{url:'https://portal.test'});Object.assign(global,{window:dom.window,document:dom.window.document,Node:dom.window.Node,IS_REACT_ACT_ENVIRONMENT:true});
 global.fetch=async()=>({ok:true,json:async()=>({notifications:[{id:'n',title:'Borç bilgisi',body:'Palet',target_path:'/veli-odemeler',created_at:'invalid-date'}],profileId:'parent'})});
 const Component=load('app/veli-paneli/guardian-notifications.tsx',{'@/lib/supabase/browser':{createClient:()=>{throw Error('unsupported realtime')}},'next/navigation':{usePathname:()=>'/veli-paneli',useRouter:()=>({refresh(){}})},'next/link':{__esModule:true,default:({children,...p})=>React.createElement('a',p,children)},'@/lib/guardian/notification-visibility':load('lib/guardian/notification-visibility.ts'),'@/lib/dates/display':{formatDisplayDateTime:()=>{throw Error('invalid date should not be formatted')}}}).default;
 const root=require('react-dom/client').createRoot(document.getElementById('root'));try{
  await React.act(async()=>root.render(React.createElement(Component)));assert.match(document.querySelector('button').className,/guardianAttention/);
  await React.act(async()=>document.querySelector('button').click());assert.match(document.body.textContent,/Palet/);
  let posts=0,complete;global.fetch=async()=>{posts++;return new Promise(resolve=>{complete=resolve})};
  const mark=[...document.querySelectorAll('button')].find(button=>button.textContent==='Okundu olarak işaretle');
  await React.act(async()=>{mark.click();mark.click()});assert.equal(posts,1);assert.equal(mark.disabled,true);assert.match(mark.textContent,/Kaydediliyor/);
  await React.act(async()=>complete({ok:false}));assert.match(document.body.textContent,/Okundu bilgisi kaydedilemedi/);assert.match(document.body.textContent,/Palet/);assert.equal(mark.disabled,false);
  global.fetch=async()=>({ok:true});await React.act(async()=>mark.click());assert.doesNotMatch(document.body.textContent,/Palet/);

 }finally{await React.act(async()=>root.unmount());dom.window.close();}
});
test('stale chunk recovery is limited to real loading errors and never loops when storage is blocked',()=>{
 const recovery=load('lib/guardian/opening-recovery.ts');assert.equal(recovery.isStalePortalChunk(new Error('Loading chunk 104 failed.')),true);assert.equal(recovery.isStalePortalChunk(new Error('Validation failed')),false);
 const values=new Map(),storage={getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)};
 assert.equal(recovery.allowPortalReload(storage,100000),true);assert.equal(recovery.allowPortalReload(storage,110000),false);assert.equal(recovery.allowPortalReload(storage,170000),true);assert.equal(recovery.allowPortalReload({getItem(){throw Error('blocked')},setItem(){}},180000),false);
});
