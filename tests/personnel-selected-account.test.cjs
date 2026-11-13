const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
test('switching personnel replaces the editable identity rather than retaining the previous account form',async()=>{
 const {JSDOM}=require('jsdom');const dom=new JSDOM('<div id="root"></div>',{url:'https://test.invalid',pretendToBeVisual:true});
 global.window=dom.window;global.document=dom.window.document;global.IS_REACT_ACT_ENVIRONMENT=true;global.requestAnimationFrame=callback=>setTimeout(callback,0);
 window.matchMedia=()=>({matches:true});window.HTMLElement.prototype.scrollIntoView=function(){};
 const React=require('react'),{createRoot}=require('react-dom/client');const {act}=React;const m={exports:{}};
 const imports={'react':React,'react/jsx-runtime':require('react/jsx-runtime'),'next/navigation':{useRouter:()=>({refresh(){}})},'./password-field':{default:()=>null},'./actions':new Proxy({},{get:()=>async()=>{throw Error('Unexpected server mutation')}}),'@/lib/dates/display':{formatDisplayDateTime:()=>''}};
 const js=ts.transpileModule(fs.readFileSync('app/kullanicilar-ve-yetkiler/YetkiPaneliClient.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 new Function('require','module','exports',js)(n=>{if(n in imports)return imports[n];throw Error(n)},m,m.exports);
 const profiles=[{id:'first',full_name:'First Coach',phone:'+905550000001',email:'first@example.invalid',role:'coach',is_active:true,last_sign_in_at:null},{id:'second',full_name:'Second Coach',phone:'+905550000002',email:'second@example.invalid',role:'coach',is_active:true,last_sign_in_at:null}];
 profiles.push({id:'parent',full_name:'Test Parent',phone:'+905550000003',email:'parent@example.invalid',role:'guardian',is_active:true,last_sign_in_at:null});
 profiles.push({id:'system-owner',full_name:'Owner',phone:'',email:'',role:'owner',is_active:true,last_sign_in_at:null});
 const root=createRoot(document.getElementById('root'));
 try{
 await act(async()=>root.render(React.createElement(m.exports.default,{profiles,staffRows:[{id:"owner-staff",auth_user_id:"system-owner",is_super_user:true,login_enabled:true,all_branches:true}],branches:[],permissionDefinitions:[],staffBranches:[],staffPermissions:[],auditLogs:[]})));
 assert.equal([...document.querySelectorAll(".personnelStat")].find(el=>el.textContent.includes("Süper Kullanıcı")).querySelector("strong").textContent,"1");
 const fields=()=>[...document.querySelectorAll('.personnelTabContent input')].map(e=>e.value);
 assert.deepEqual(fields().slice(0,3),['First Coach','+905550000001','first@example.invalid']);
 await act(async()=>document.querySelectorAll('.personnelPersonCard')[1].click());
 assert.equal(document.querySelector('.personnelHeader h2').textContent,'Second Coach');
 assert.deepEqual(fields().slice(0,3),['Second Coach','+905550000002','second@example.invalid']);
 await act(async()=>document.querySelectorAll('.personnelPersonCard')[0].click());
 assert.deepEqual(fields().slice(0,3),['First Coach','+905550000001','first@example.invalid']);
 await act(async()=>document.querySelectorAll('.personnelPersonCard')[2].click());
 assert.equal(document.querySelector('.personnelPortalLink').getAttribute('href'),'/veliler/parent');
 assert.equal(document.querySelector('.personnelTabs'),null);
 assert.equal(document.querySelector('.personnelTabContent input'),null);
 }finally{await act(async()=>root.unmount());dom.window.close();delete global.window;delete global.document;delete global.requestAnimationFrame;delete global.IS_REACT_ACT_ENVIRONMENT;}
});
