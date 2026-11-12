const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { createRoot } = require('react-dom/client');
const { JSDOM } = require('jsdom');

async function mount({disabled=false,pathname='/dashboard',permission='granted'}={}) {
  const dom = new JSDOM('<div id="root"></div>', {url:'https://sprint.test'});
  const calls=[];
  const sub={endpoint:'https://push.test',toJSON:()=>({keys:{p256dh:'p',auth:'a'}})};
  const pushManager={getSubscription:async()=>null,subscribe:async()=>{calls.push('subscribe');return sub}};
  Object.defineProperty(dom.window.navigator,'serviceWorker',{value:{register:async()=>({}),ready:Promise.resolve({pushManager})}});
  dom.window.PushManager=function(){};
  dom.window.Notification={permission};
  if(disabled)dom.window.localStorage.setItem('sprintos_push_disabled_v1','1');
  Object.assign(global,{window:dom.window,document:dom.window.document,Notification:dom.window.Notification,IS_REACT_ACT_ENVIRONMENT:true});
  Object.defineProperty(global,'navigator',{value:dom.window.navigator,configurable:true});
  global.fetch=async()=>{calls.push('save');return {ok:true,json:async()=>({ok:true})}};
  const mod={exports:{}};
  const code=ts.transpileModule(fs.readFileSync('app/components/pwa-register.tsx','utf8'),{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS}}).outputText;
  new Function('module','exports','require','process',code)(mod,mod.exports,name=>name==='next/navigation'?{usePathname:()=>pathname}:require(name),{env:{NEXT_PUBLIC_VAPID_PUBLIC_KEY:'YWJj'}});
  const root=createRoot(document.getElementById('root'));
  await React.act(async()=>root.render(React.createElement(mod.exports.default)));
  return {calls,close:async()=>{await React.act(async()=>root.unmount());dom.window.close()}};
}
test('returning with permission granted restores an expired device subscription',async()=>{const h=await mount();try{assert.deepEqual(h.calls,['subscribe','save'])}finally{await h.close()}});
test('explicitly disabled notifications stay disabled after reopening',async()=>{const h=await mount({disabled:true});try{assert.deepEqual(h.calls,[])}finally{await h.close()}});
test('login and public registration do not rebind a push device',async()=>{for(const pathname of ['/login','/on-kayit','/auth/callback']){const h=await mount({pathname});try{assert.deepEqual(h.calls,[])}finally{await h.close()}}});

function worker(){const handlers={};const notifications=[];const opened=[];const self={location:{origin:'https://sprint.test'},addEventListener:(name,fn)=>handlers[name]=fn,registration:{showNotification:async(...args)=>notifications.push(args)},clients:{matchAll:async()=>[],openWindow:async url=>opened.push(url)}};vm.runInNewContext(fs.readFileSync('public/sw.js','utf8'),{self,URL});return {handlers,notifications,opened,self}}
test('malformed and null push payloads still display a visible notification',async()=>{for(const data of [null,[],42]){const h=worker();let pending;h.handlers.push({data:{json:()=>data},waitUntil:p=>pending=p});await pending;assert.equal(h.notifications.length,1);assert.equal(h.notifications[0][0],'SprintOS')}});
test('notification click preserves internal query parameters and rejects external targets',async()=>{for(const [path,expected] of [['/on-kayit?requestId=abc','/on-kayit?requestId=abc'],['https://evil.test/','/bildirimler'],['javascript:alert(1)','/bildirimler'],['http://[','/bildirimler']]){const h=worker();let pending;h.handlers.notificationclick({notification:{close(){},data:{targetPath:path}},waitUntil:p=>pending=p});await pending;assert.equal(h.opened[0],'https://sprint.test'+expected)}});
test('failed existing-window navigation falls back to opening the target',async()=>{const h=worker();h.self.clients.matchAll=async()=>[{url:'https://sprint.test/dashboard',navigate:async()=>null,focus:async()=>assert.fail('wrong screen focused')}];let pending;h.handlers.notificationclick({notification:{close(){},data:{targetPath:'/bildirimler?item=abc'}},waitUntil:p=>pending=p});await pending;assert.equal(h.opened[0],'https://sprint.test/bildirimler?item=abc')});
