const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript'),{JSDOM}=require('jsdom');
test('rescheduling treats student names as text and defaults to tomorrow in Turkey without updating enrollment',async()=>{
 const dom=new JSDOM('<div id="root"></div><section class="startingGroup"><h2>Yarın Başlayacaklar</h2><article class="startingStudentCard"><h3></h3><div class="startingStudentActions"><a href="/ogrenciler/child">Öğrenci Dosyası</a><a href="/yoklama">Yoklamaya Git</a></div></article></section>',{url:'https://test.invalid',pretendToBeVisual:true});
 const oldAbort=global.AbortController,ActualDate=Date;
 Object.assign(global,{window:dom.window,document:dom.window.document,MutationObserver:dom.window.MutationObserver,AbortController:dom.window.AbortController,IS_REACT_ACT_ENVIRONMENT:true});
 global.Date=class extends ActualDate{constructor(...args){super(...(args.length?args:['2026-11-12T22:30:00Z']))}};
 const name='<img src=x onerror="window.injected=true"> Test';document.querySelector('h3').textContent=name;
 let writes=0;global.fetch=async()=>{writes++;throw Error('Unexpected request')};
 const React=require('react'),{createRoot}=require('react-dom/client');const m={exports:{}};const imports={react:React,'react/jsx-runtime':require('react/jsx-runtime'),'next/navigation':{usePathname:()=>'/baslayacak-kursiyerler'}};
 new Function('require','module','exports',ts.transpileModule(fs.readFileSync('app/components/first-lesson-start-enhancer.tsx','utf8').replace(/<style jsx global>/g,'<style>'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX}}).outputText)(n=>imports[n],m,m.exports);
 const root=createRoot(document.getElementById('root'));try{
 await React.act(async()=>root.render(React.createElement(m.exports.default)));
 await React.act(async()=>document.querySelector('.firstLessonRescheduleAction').click());
 assert.equal(document.querySelector('.flrHead p').textContent,name);assert.equal(document.querySelector('.firstLessonRescheduleModal img'),null);assert.equal(document.querySelector('.flrDate').value,'2026-11-14');assert.equal(writes,0);
 }finally{await React.act(async()=>root.unmount());global.Date=ActualDate;global.AbortController=oldAbort;dom.window.close();}
});
