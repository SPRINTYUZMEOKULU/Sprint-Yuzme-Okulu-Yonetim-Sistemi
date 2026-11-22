const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
function load(file,mocks={}){const m={exports:{}};new Function('require','module','exports',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText)(name=>mocks[name]||(name==='@/app/components/ui-icon'?load('app/components/ui-icon.tsx'):require(name)),m,m.exports);return m.exports;}
test('welcome message provides accurate login, self-service password path and a credential-free guide',()=>{
 const {portalMessage,portalGuideMessage}=load('lib/guardian/portal-message.ts');const msg=portalMessage({fullName:'Örnek Veli',phone:'+905550000000',setupPath:'/portal-sifre#test-link',email:'hidden@login.sprintos.local'},'https://sprint.test/');
 for(const text of ['https://sprint.test/login','https://sprint.test/portal-rehberi','Veli Girişi','Telefon ile giriş','Hesabım ve Şifrem','Yetişkin kursiyerlerimiz','/portal-rehberi#telefona-ekle','Ana Ekrana Ekle','Uygulamayı yükle'])assert.ok(msg.includes(text));
 assert.ok(msg.includes('https://sprint.test/portal-sifre#test-link'));assert.doesNotMatch(msg,/hidden@login/);
 const guide=portalGuideMessage('https://sprint.test');assert.match(guide,/portal-rehberi/);assert.doesNotMatch(guide,/Example-94|Örnek Veli|905550000000/);
});
test('public visual guide renders instructional screen examples and functional destinations without personal data',()=>{
 const React=require('react'),{renderToStaticMarkup}=require('react-dom/server');const link={__esModule:true,default:({children,...props})=>React.createElement('a',props,children)};const install=load('app/portal-rehberi/install-guide.tsx',{'next/link':link,'./install-guide.css':{}});const Guide=load('app/portal-rehberi/page.tsx',{'next/link':link,'./install-guide':install,'./guide-actions':{__esModule:true,default:()=>null},'./guide.css':{}}).default;
 const html=renderToStaticMarkup(React.createElement(Guide));for(const text of ['Telefon ile giriş','Hesabım ve Şifrem','Yeni Şifremi Kaydet','/veli-hesabim','Şifremi unuttum','kişisel bilgi içermez','Kursiyer 1','telefona-ekle','iPhone · Safari','Android · Chrome','Ana Ekrana Ekle'])assert.ok(html.includes(text));assert.doesNotMatch(html,/<input|Example-94/);
});
test('guide remains accessible before login without granting access to account settings or management',async()=>{
 const response=(status=200,location)=>({status,headers:new Headers(location?{location}:{}),cookies:{getAll:()=>[],set(){}}});
 process.env.NEXT_PUBLIC_SUPABASE_URL='test';process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY='test';
 const middleware=load('middleware.ts',{'@/lib/auth/login-destination':load('lib/auth/login-destination.ts'),'@supabase/ssr':{createServerClient:()=>({auth:{getUser:async()=>({data:{user:null}})}})},'@supabase/supabase-js':{},'next/server':{NextResponse:{next:()=>response(),redirect:url=>response(307,String(url))}}}).middleware;
 function request(path){const url=new URL('https://sprint.test'+path);url.clone=()=>new URL(url.href);return {nextUrl:url,headers:new Headers(),cookies:{getAll:()=>[],set(){}}};}
 assert.equal((await middleware(request('/portal-rehberi'))).status,200);
 assert.equal((await middleware(request('/portal-sifre'))).status,200);
 for(const path of ['/veli-hesabim','/api/guardian-account/password','/ogrenciler'])assert.equal((await middleware(request(path))).status,307);
});
