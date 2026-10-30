const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript'),React=require('react'),{JSDOM}=require('jsdom');
function load(file,mocks={}){const m={exports:{}};new Function('require','module','exports',ts.transpileModule(fs.readFileSync(file,'utf8').replace(/<style jsx(?: global)?>/g,'<style>'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText)(n=>mocks[n]||require(n),m,m.exports);return m.exports;}
test('desktop pointer and click open once; closing and reopening a scheduled renewal cannot submit it again',async()=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'https://example.test/ogrenciler/student'});
 Object.assign(global,{window:dom.window,document:dom.window.document,CustomEvent:dom.window.CustomEvent,Event:dom.window.Event,Element:dom.window.Element,HTMLAnchorElement:dom.window.HTMLAnchorElement,IS_REACT_ACT_ENVIRONMENT:true});
 const {createRoot}=require('react-dom/client');const router={refresh(){}};let loads=0,posts=0;
 global.fetch=async(url,options)=>{if(options?.method==='POST'){posts++;throw Error('must not submit');}if(url.includes('/status?'))return {ok:true,json:async()=>({ok:true,request:null})};loads++;return {ok:true,json:async()=>({ok:true,packages:[{id:'p',name:'8 Ders',lesson_count:8,price:4000}],selectedPackageId:'p',scheduledEnrollment:{id:'new',package_id:'p',start_date:'2026-11-04',planned_end_date:'2026-11-27',total_lessons:8}})};};
 const Center=load('app/ogrenciler/[id]/student-renewal-center.tsx',{'next/navigation':{useRouter:()=>router},'@/lib/enrollment/renewal-queue':load('lib/enrollment/renewal-queue.ts'),'@/lib/enrollment/dates':load('lib/enrollment/dates.ts'),'../../odemeler/actions':{}}).default;
 const Button=load('app/ogrenciler/[id]/student-renewal-button.tsx').default,Router=load('app/ogrenciler/[id]/student-action-router.tsx').default;
 const app=createRoot(document.getElementById('root'));
 await React.act(async()=>app.render(React.createElement(React.Fragment,null,React.createElement('div',{className:'fileCommandActions'},React.createElement(Button)),React.createElement(Center,{studentId:'student'}),React.createElement(Router))));
 const quick=()=>document.querySelector('[data-renewal-button]');
 await React.act(async()=>{quick().dispatchEvent(new window.Event('pointerup',{bubbles:true,cancelable:true}));quick().click();quick().click();});
 assert.equal(loads,1);assert.equal(document.querySelectorAll('.renewalOverlay').length,1);assert.match(document.querySelector('.renewalBody').textContent,/Kayıt zaten yenilenmiş/);assert.equal(document.querySelector('footer .primary').disabled,true);
 await React.act(async()=>document.querySelector('.renewalPanel header button').click());
 await React.act(async()=>quick().click());assert.equal(loads,1);assert.equal(document.querySelector('footer .primary').disabled,true);assert.equal(posts,0);
 await React.act(async()=>app.unmount());dom.window.close();
});
test('message-history enhancement preserves React children through the renewal refresh and repeated list updates',async()=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'https://example.test/ogrenciler/student'});
 Object.assign(global,{window:dom.window,document:dom.window.document,HTMLElement:dom.window.HTMLElement,IS_REACT_ACT_ENVIRONMENT:true});
 const {createRoot}=require('react-dom/client');global.fetch=async()=>({ok:true,json:async()=>({ok:true,timeline:[],count:0,paymentNotices:[]})});
 const Enhancer=load('app/components/student-message-history-enhancer.tsx',{'@/lib/dates/display':{formatDisplayDateTime:v=>v}}).default;
 function Page({ids}){return React.createElement(React.Fragment,null,React.createElement('section',{id:'mesajlar'},React.createElement('div',{className:'panelHead'}),React.createElement('div',{className:'list'},ids.map(id=>React.createElement('article',{key:id,'data-original':id},id)))),React.createElement(Enhancer));}
 const errors=[];const app=createRoot(document.getElementById('root'),{onUncaughtError:error=>errors.push(error)});
 await React.act(async()=>app.render(React.createElement(Page,{ids:['old']})));
 await React.act(async()=>new Promise(resolve=>setTimeout(resolve,130)));
 await React.act(async()=>app.render(React.createElement(Page,{ids:['new','old']})));
 await React.act(async()=>app.render(React.createElement(Page,{ids:['new']})));
 assert.equal(errors.length,0);assert.ok(document.querySelector('[data-original="new"]'));await React.act(async()=>app.unmount());dom.window.close();
});

test('message tab count uses unified messages once while React legacy rows remain hidden',()=>{
 const dom=new JSDOM('<main><section id="mesajlar"><div class="list" style="display:none"><article>A</article><article>B</article></div><div data-unified-message-history><article>Unified message</article></div></section></main>');
 const source=fs.readFileSync('app/ogrenciler/[id]/student-file-tabs.tsx','utf8');
 const excerpt=source.slice(source.indexOf('function articleCount'),source.indexOf('function paymentStatusCount'))+';module.exports=articleCount;';
 const m={exports:{}};new Function('module',ts.transpileModule(excerpt,{compilerOptions:{target:ts.ScriptTarget.ES2020}}).outputText)(m);
 assert.equal(m.exports(dom.window.document.querySelector('main'),'#mesajlar'),1);dom.window.close();
});
