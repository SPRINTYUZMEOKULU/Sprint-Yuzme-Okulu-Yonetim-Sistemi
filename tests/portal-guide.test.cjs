const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
function load(file,mocks={}){const m={exports:{}};new Function('require','module','exports',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText)(name=>mocks[name]||require(name),m,m.exports);return m.exports;}
test('welcome message provides accurate login, self-service password path and a credential-free guide',()=>{
 const {portalMessage,portalGuideMessage}=load('lib/guardian/portal-message.ts');const msg=portalMessage({fullName:'Örnek Veli',phone:'+905550000000',password:'Example-94!',email:'hidden@login.sprintos.local'},'https://sprint.test/');
 for(const text of ['https://sprint.test/login','https://sprint.test/portal-rehberi','Veli Girişi','Telefon ile giriş','Hesabım ve Şifrem','Yetişkin kursiyerlerimiz'])assert.ok(msg.includes(text));
 assert.equal(msg.match(/Example-94!/g).length,1);assert.ok(msg.includes('```Example-94!```'));assert.doesNotMatch(msg,/hidden@login/);
 const guide=portalGuideMessage('https://sprint.test');assert.match(guide,/portal-rehberi/);assert.doesNotMatch(guide,/Example-94|Örnek Veli|905550000000/);
});
test('public visual guide renders instructional screen examples and functional destinations without personal data',()=>{
 const React=require('react'),{renderToStaticMarkup}=require('react-dom/server');const Guide=load('app/portal-rehberi/page.tsx',{'next/link':{__esModule:true,default:({children,...props})=>React.createElement('a',props,children)},'./guide-actions':{__esModule:true,default:()=>null},'./guide.css':{}}).default;
 const html=renderToStaticMarkup(React.createElement(Guide));for(const text of ['Telefon ile giriş','Hesabım ve Şifrem','Yeni Şifremi Kaydet','/veli-hesabim','Şifremi unuttum','kişisel bilgi içermez','Kursiyer 1'])assert.ok(html.includes(text));assert.doesNotMatch(html,/<input|Example-94/);
});
test('guide remains accessible before login without granting access to account settings or management',async()=>{
 const response=(status=200,location)=>({status,headers:new Headers(location?{location}:{}),cookies:{getAll:()=>[],set(){}}});
 process.env.NEXT_PUBLIC_SUPABASE_URL='test';process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY='test';
 const middleware=load('middleware.ts',{'@/lib/auth/login-destination':load('lib/auth/login-destination.ts'),'@supabase/ssr':{createServerClient:()=>({auth:{getUser:async()=>({data:{user:null}})}})},'@supabase/supabase-js':{},'next/server':{NextResponse:{next:()=>response(),redirect:url=>response(307,String(url))}}}).middleware;
 function request(path){const url=new URL('https://sprint.test'+path);url.clone=()=>new URL(url.href);return {nextUrl:url,headers:new Headers(),cookies:{getAll:()=>[],set(){}}};}
 assert.equal((await middleware(request('/portal-rehberi'))).status,200);
 for(const path of ['/veli-hesabim','/api/guardian-account/password','/ogrenciler'])assert.equal((await middleware(request(path))).status,307);
});
