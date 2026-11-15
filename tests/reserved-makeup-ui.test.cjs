const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript'),{JSDOM}=require('jsdom');
function load(file,mocks={}){const m={exports:{}};new Function('require','module','exports',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText)(name=>mocks[name]||require(name),m,m.exports);return m.exports;}
test('central UI preserves partial bulk results, supports rescheduling and clears only explicitly confirmed notices',async()=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'https://sprint.test/telafi-yonetimi'});
 Object.assign(global,{window:dom.window,document:dom.window.document,IS_REACT_ACT_ENVIRONMENT:true});window.confirm=()=>true;global.confirm=window.confirm;
 const React=require('react'),{createRoot}=require('react-dom/client');
 const shared={'next/link':{__esModule:true,default:({children,...props})=>React.createElement('a',props,children)},'next/navigation':{useRouter:()=>({refresh(){}})}};
 const editor=load('app/ogrenciler/[id]/compensation-plan-editor.tsx',{...shared,'@/lib/messaging/current-recipient':{openCurrentWhatsapp:async()=>{throw Error('No WhatsApp send should occur in this test');}}});
 const Component=load('app/telafi-yonetimi/compensation-management-client.tsx',{...shared,'@/lib/dates/display':{formatDisplayDate:d=>d.toISOString().slice(0,10)},'../ogrenciler/[id]/compensation-plan-editor':editor,'@/lib/students/compensation-management':load('lib/students/compensation-management.ts')}).default;
 let items=['one','two'].map((id,i)=>({id,student_id:id,status:'reserved',lesson_date:null,target_group_id:'g',student:{first_name:i?'Ali':'İrem',last_name:'Örnek'}}));
 const data=()=>({items,schedules:[{id:'schedule',group_id:'g',weekday:0,start_time:'19:00',end_time:'20:00'}],groups:[{id:'g',name:'Çocuk Grubu',branch_id:'b'}],branches:[{id:'b',name:'Muratpaşa'}],canDelete:true});
 const calls=[];global.fetch=async(url,opts={})=>{const body=opts.body?JSON.parse(opts.body):null;calls.push(body);let result=data(),ok=true;
  if(body?.action==='plan_reserved'){
   if(body.id==='two'){ok=false;result={error:'Kaynak dönem kontrol edilmeli.'};}
   else{items=items.map(item=>item.id==='one'?{...item,status:'planned',lesson_date:body.lesson_date,target_schedule_id:body.target_schedule_id,notification:{id:'notice',body:'Güncel telafi planı',recipient:'905551112233',status:'prepared'}}:item);result={message:'Planlandı.'};}
  }else if(body?.action==='reschedule'){items=items.map(item=>item.id===body.id?{...item,lesson_date:body.lesson_date,notification:{...item.notification,id:'notice2',body:'Yeni tarih: '+body.lesson_date}}:item);result={message:'Güncellendi.',notification:items.find(i=>i.id===body.id).notification};}
  else if(body?.action==='confirm_sent'){items=items.map(item=>item.notification?{...item,notification:{...item.notification,status:'sent'}}:item);result={message:'Gönderildi olarak kaydedildi.'};}
  return {ok,redirected:false,json:async()=>result};
 };
 const root=createRoot(document.getElementById('root'));
 const click=async(label)=>{const button=[...document.querySelectorAll('button')].find(b=>b.textContent===label||b.textContent.startsWith(label));assert.ok(button,label+' button exists');await React.act(async()=>button.click());};
 const change=async(selector,value)=>{const el=document.querySelector(selector);assert.ok(el,selector);await React.act(async()=>{Object.getOwnPropertyDescriptor(el.tagName==='SELECT'?window.HTMLSelectElement.prototype:window.HTMLInputElement.prototype,'value').set.call(el,value);el.dispatchEvent(new window.Event(el.tagName==='SELECT'?'change':'input',{bubbles:true}));});};
 try{
  await React.act(async()=>root.render(React.createElement(Component)));
  assert.match(document.body.textContent,/İrem Örnek/);
  await React.act(async()=>document.querySelector('.cmSelectAll input').click());
  await change('.cmPlanFields input','2099-01-04');await change('.cmPlanFields select','schedule');
  await click('Seçilen Hakları Planla');
  assert.equal(document.querySelectorAll('.cmResults .success').length,1);assert.equal(document.querySelectorAll('.cmResults .failure').length,1);
  assert.equal(document.querySelectorAll('.cmCard').length,1);assert.equal(document.querySelector('.cmCard input').checked,true,'failed row remains selected');
  await click('Bilgilendirme Bekleyen');
  assert.equal(document.querySelectorAll('.cmCard').length,1);assert.match(document.querySelector('textarea').value,/Güncel telafi planı/);
  await click('Telafiyi Düzenle');await change('.makeupFields input[type=date]','2099-01-11');await change('.makeupFields select','schedule');await click('Yeni Planı Kaydet');
  assert.match(document.querySelector('textarea').value,/2099-01-11/);
  assert.equal(calls.filter(c=>c?.action==='confirm_sent').length,0,'saving never claims message delivery');
  await click('Gönderdim, Kaydet');assert.equal(document.querySelectorAll('.cmCard').length,0,'confirmed notice leaves pending queue');
  await click('Planlanan');assert.match(document.body.textContent,/Gönderildi olarak kaydedildi/);
 }finally{await React.act(async()=>root.unmount());dom.window.close();}
});
