const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript'),React=require('react'),{JSDOM}=require('jsdom');
function load(file,mocks={}){const m={exports:{}};new Function('require','module','exports',ts.transpileModule(fs.readFileSync(file,'utf8').replace(/<style jsx>/g,'<style>'),{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText)(n=>mocks[n]||require(n),m,m.exports);return m.exports;}
test('expired package displays planned renewal, and future preview cannot consume unstarted lessons',async()=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'https://example.test/yoklama'});
 Object.assign(global,{window:dom.window,document:dom.window.document,localStorage:dom.window.localStorage,IS_REACT_ACT_ENVIRONMENT:true});
 const {createRoot}=require('react-dom/client');const router={refresh(){}};let writes=0;
 const Component=load('app/yoklama/quick-attendance-client.tsx',{
  '@/lib/dates/display':{formatDisplayDate:v=>v},'next/navigation':{useRouter:()=>router},
  '@/lib/attendance/integrity':load('lib/attendance/integrity.ts'),'@/lib/attendance/presentation':load('lib/attendance/presentation.ts'),'@/lib/attendance/roster':load('lib/attendance/roster.ts'),
  './attendance-reminder-panel':{__esModule:true,default:()=>null},'./actions':{getAttendanceForDate:async()=>({ok:true,records:[]}),saveAttendance:async()=>{writes++;return {ok:true};}},
 }).default;
 const period={student_id:'s',group_id:'g',lesson_weekdays:[3,5],start_confirmation_required:false};
 const app=createRoot(document.getElementById('root'));
 await React.act(async()=>app.render(React.createElement(Component,{viewerId:'staff',initialDate:'2026-10-30',initialBranchId:'b',initialTime:'20:00',branches:[{id:'b',name:'Meltem'}],groups:[{id:'g',branch_id:'b',name:'Çocuk'}],schedules:[{id:'fri',group_id:'g',branch_id:'b',weekday:5,start_time:'20:00',end_time:'21:00'},{id:'wed',group_id:'g',branch_id:'b',weekday:3,start_time:'20:00',end_time:'21:00'}],memberships:[{student_id:'s',group_id:'g',is_active:true}],students:[{id:'s',first_name:'MukhammadSalikh',status:'active'}],enrollments:[{...period,id:'new',status:'scheduled',created_at:'2026-10-30',start_date:'2026-11-04',total_lessons:8,used_lessons:0},{...period,id:'old',status:'active',created_at:'2026-09-08',start_date:'2026-09-30',total_lessons:8,used_lessons:8}],compensationLessons:[]})));
 assert.match(document.querySelector('.qaStudent').textContent,/KAYIT YENİLENDİ/);assert.match(document.querySelector('.qaRenewalNotice').textContent,/2026-11-04.*8 ders/);assert.equal(document.querySelectorAll('article.expired').length,0);assert.ok([...document.querySelectorAll('.qaButtons button')].every(b=>b.disabled));
 const date=document.querySelector('[aria-label="Yoklama tarihi"]');
 await React.act(async()=>{Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set.call(date,'2026-11-04');date.dispatchEvent(new window.Event('change',{bubbles:true}));date.dispatchEvent(new window.Event('input',{bubbles:true}));});
 assert.match(document.querySelector('.qaRenewalNotice').textContent,/8 ders/);assert.ok([...document.querySelectorAll('.qaButtons button')].every(b=>b.disabled));assert.equal(writes,0);
 await React.act(async()=>app.unmount());dom.window.close();
});
