const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
const {JSDOM}=require('jsdom'),React=require('react');
function load(file,mocks={}){const m={exports:{}};new Function('require','module','exports',ts.transpileModule(fs.readFileSync(file,'utf8').replace(/<style jsx>/g,'<style>'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText)(n=>mocks[n]||require(n),m,m.exports);return m.exports;}
test('mounted UI plans two independent cancellations in consecutive makeup slots, prevents duplicate retry',async()=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'https://example.test/ders-operasyonlari'});
 Object.assign(global,{window:dom.window,document:dom.window.document,Event:dom.window.Event,IS_REACT_ACT_ENVIRONMENT:true});
 const {createRoot}=require("react-dom/client");
 window.confirm=()=>true;const calls=[];
 const Component=load('app/ders-operasyonlari/lesson-operations-client.tsx',{
  '@/lib/messaging/current-recipient':{},
  '@/lib/lesson-operations/participation':load('lib/lesson-operations/participation.ts'),
  './actions':{startingCancellationMessages:async()=>({ok:true,messages:[]}),applyLessonCancellation:async input=>{calls.push(input);return {ok:true,message:'Saved',preparedMessages:[],outcomes:[]};}},
 }).default;
 const app=createRoot(document.getElementById('root'));
 await React.act(async()=>app.render(React.createElement(Component,{branches:[{id:'b',name:'Pool'}],groups:[{id:'g',branch_id:'b',name:'Child',course_type:'child'}],schedules:[{id:'sat',group_id:'g',weekday:6,start_time:'19:00',end_time:'20:00'},{id:'sun1',group_id:'g',weekday:7,start_time:'19:00',end_time:'20:00'},{id:'sun2',group_id:'g',weekday:7,start_time:'20:00',end_time:'21:00'}],memberCounts:{},participation:{students:[],memberships:[],enrollments:[],plans:[]}})));
 const button=text=>[...document.querySelectorAll('button')].find(b=>b.textContent.includes(text));
 async function value(el,v){await React.act(async()=>{const proto=el.tagName==='SELECT'?window.HTMLSelectElement.prototype:window.HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(el,v);el.dispatchEvent(new window.Event('change',{bubbles:true}));el.dispatchEvent(new window.Event('input',{bubbles:true}));});}
 await value(document.querySelector('select'),'b');
 await React.act(async()=>document.querySelector('.groupChoice input').click());
 await value(document.querySelector('input[type=date]'),'2026-10-17');
 await value([...document.querySelectorAll('select')].find(s=>[...s.options].some(o=>o.value==='sat')),'sat');
 await React.act(async()=>button('Farklı tarih').click());
 let field=document.querySelector('.customTarget');
 await value(field.querySelector('input'),'2026-10-25');await value(field.querySelector('select'),'sun1');
 await React.act(async()=>button('+ Telafi Dersi Ekle').click());
 const extra=document.querySelector('[aria-label="Ek telafi dersleri"] .customTarget');
 await value(extra.querySelector('input'),'2026-10-24');
 await value(extra.querySelectorAll('select')[1],'sat');
 await value(extra.querySelectorAll('input')[1],'2026-10-25');
 await value(extra.querySelectorAll('select')[2],'sun2');
 await React.act(async()=>button('Ders İptalini Uygula').click());
 assert.equal(calls.length,2,document.querySelector(".resultBox")?.textContent);assert.deepEqual(calls.map(c=>[c.cancelledDate,c.customDate,c.customScheduleId]),[['2026-10-17','2026-10-25','sun1'],['2026-10-24','2026-10-25','sun2']]);
 await React.act(async()=>button('Ders İptalini Uygula').click());assert.equal(calls.length,2);
 await React.act(async()=>app.unmount());dom.window.close();
});
