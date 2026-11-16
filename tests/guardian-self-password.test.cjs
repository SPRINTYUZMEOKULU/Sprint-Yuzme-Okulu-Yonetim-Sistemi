const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
function load(file,mocks={}){const m={exports:{}};new Function('require','module','exports',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText)(name=>mocks[name]||(name==='@/app/components/ui-icon'?load('app/components/ui-icon.tsx'):require(name)),m,m.exports);return m.exports;}
function harness({role='guardian',active=true,login=true,verifyId='self',verifyError=null,updateError=null,userId='self',phoneOnly=false}={}){
 const writes=[],verified=[],closed=[],scopes=[];
 const db={auth:{getUser:async()=>({data:{user:userId?{id:userId,email:phoneOnly?null:'phone.example@login.sprintos.local',phone:'+905550000000'}:null},error:null}),updateUser:async(input)=>{writes.push(input);return {data:{user:{id:userId}},error:updateError};}},from(table){const q={select(){return q},eq(k,v){scopes.push([table,k,v]);return q},maybeSingle:async()=>({data:table==='profiles'?{id:userId,role,is_active:active,organization_id:'org'}:{id:'guardian-row',is_active:true,login_enabled:login},error:null})};return q;}};
 const verifier={auth:{signInWithPassword:async input=>{verified.push(input);return {data:{user:{id:verifyId},session:{access_token:'not-real'}},error:verifyError};},signOut:async options=>closed.push(options)}};
 const route=load('app/api/guardian-account/password/route.ts',{'next/server':{NextResponse:{json:(body,{status=200}={})=>({body,status})}},'next/cache':{revalidatePath(){}},'@/lib/supabase/server':{createClient:async()=>db},'@supabase/supabase-js':{createClient:()=>verifier}});
 process.env.NEXT_PUBLIC_SUPABASE_URL='https://test.invalid';process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY='test-public-key';
 const valid={currentPassword:'Current-Password-94!',newPassword:'New-Password-95!',confirmPassword:'New-Password-95!'};
 return {writes,verified,closed,scopes,post:(input={},origin='https://sprint.test')=>route.POST({nextUrl:new URL('https://sprint.test/api/guardian-account/password'),headers:new Headers({'content-type':'application/json',origin}),json:async()=>({...valid,...input})})};
}
test('self-service verifies the existing password and updates only the current session, ignoring supplied account identifiers',async()=>{
 const h=harness();const result=await h.post({accountId:'other',studentId:'other'});
 assert.equal(result.status,200);assert.equal(result.body.ok,true);assert.deepEqual(h.writes,[{password:'New-Password-95!'}]);
 assert.deepEqual(h.verified,[{email:'phone.example@login.sprintos.local',password:'Current-Password-94!'}]);assert.deepEqual(h.closed,[{scope:'local'}]);
 assert.ok(h.scopes.some(([table,key,value])=>table==='profiles'&&key==='id'&&value==='self'));
 assert.ok(h.scopes.some(([table,key,value])=>table==='guardians'&&key==='auth_user_id'&&value==='self'));
 assert.doesNotMatch(JSON.stringify(result),/New-Password-95|Current-Password-94/);
});
test('phone-only identity is verified using the same account phone',async()=>{const h=harness({phoneOnly:true});assert.equal((await h.post()).body.ok,true);assert.equal(h.verified[0].phone,'+905550000000')});
test('cross-origin, signed-out, staff, inactive and disabled portal users cannot update a password',async()=>{
 const cross=harness();assert.equal((await cross.post({},'https://other.test')).status,403);assert.equal(cross.verified.length,0);
 for(const config of [{userId:null},{role:'admin'},{role:'coach'},{active:false},{login:false}]){const h=harness(config);assert.equal((await h.post()).body.ok,false);assert.equal(h.writes.length,0);assert.equal(h.verified.length,0);}
});
test('wrong existing password or mismatched verified account cannot reach updateUser',async()=>{for(const config of [{verifyError:{message:'bad'}},{verifyId:'other'}]){const h=harness(config);assert.equal((await h.post()).status,400);assert.equal(h.writes.length,0);assert.equal(h.closed.length,1);}});
test('invalid, mismatched and unchanged new passwords are rejected before authentication',async()=>{
 for(const values of [{newPassword:'short',confirmPassword:'short'},{confirmPassword:'different'},{newPassword:'Current-Password-94!',confirmPassword:'Current-Password-94!'},{newPassword:' leading-space',confirmPassword:' leading-space'},{currentPassword:''}]){const h=harness();assert.equal((await h.post(values)).status,400);assert.equal(h.verified.length,0);assert.equal(h.writes.length,0);}
});
test('provider failure never reports success or returns a password',async()=>{const h=harness({updateError:{message:'provider internal'}});const result=await h.post();assert.equal(result.status,409);assert.equal(result.body.ok,false);assert.equal(h.closed.length,1);assert.doesNotMatch(JSON.stringify(result),/provider internal|New-Password/)});
test('password form checks confirmation and clears fields only after successful update',async()=>{
 const {JSDOM}=require('jsdom'),React=require('react');const dom=new JSDOM('<div id="root"></div>',{url:'https://sprint.test/veli-hesabim'});Object.assign(global,{window:dom.window,document:dom.window.document,FormData:dom.window.FormData,IS_REACT_ACT_ENVIRONMENT:true});
 const Component=load('app/veli-hesabim/password-form.tsx').default,root=require('react-dom/client').createRoot(document.getElementById('root'));const calls=[];
 global.fetch=async(url,options)=>{calls.push({url,body:JSON.parse(options.body)});return {ok:true,json:async()=>({ok:true,message:'Şifreniz güncellendi.'})}};
 try{
  await React.act(async()=>root.render(React.createElement(Component)));
  document.querySelector('[name=currentPassword]').value='Current-94!';document.querySelector('[name=newPassword]').value='New-95!Example';document.querySelector('[name=confirmPassword]').value='different';
  await React.act(async()=>document.querySelector('form').dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true})));
  assert.equal(calls.length,0);assert.match(document.body.textContent,/eşleşmiyor/);
  document.querySelector('[name=confirmPassword]').value='New-95!Example';
  await React.act(async()=>document.querySelector('form').dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true})));
  assert.equal(calls.length,1);assert.equal(calls[0].url,'/api/guardian-account/password');assert.equal(document.querySelector('[name=newPassword]').value,'');assert.match(document.body.textContent,/Şifreniz güncellendi/);
 }finally{await React.act(async()=>root.unmount());dom.window.close();}
});
test('administrator preview contains guidance but cannot render the password form',async()=>{
 const React=require('react'),{renderToStaticMarkup}=require('react-dom/server');let forms=0;
 const Component=load('app/veli-hesabim/page.tsx',{'next/link':{__esModule:true,default:({children,...props})=>React.createElement('a',props,children)},'@/lib/guardian/page-context':{loadGuardianPage:async()=>({profile:{full_name:'Preview'},data:{students:[],issues:[]},previewGuardian:'preview-id'})},'../veli-paneli/guardian-ui':{GuardianHeader:()=>null},'./password-form':{__esModule:true,default:()=>{forms++;return null;}},'../veli-paneli/veli.css':{},'./account.css':{}}).default;
 const html=renderToStaticMarkup(await Component({searchParams:Promise.resolve({previewGuardian:'preview-id'})}));assert.equal(forms,0);assert.match(html,/Yönetici önizlemesinde/);
});
