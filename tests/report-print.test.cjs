const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const ts=require('typescript');
const helper={exports:{}};new Function('module','exports',ts.transpileModule(fs.readFileSync('lib/dates/display.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(helper,helper.exports);
const exportsObject={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('app/raporlar/print-report.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports:exportsObject,Intl,Date,String,require:name=>{assert.equal(name,'@/lib/dates/display');return helper.exports;}});
test('dedicated print document contains only selected section with repeated column headings',()=>{const html=exportsObject.printReportHtml({name:'Kayıt ve ödeme',rows:[['Öğrenci','Ödenen','Kalan'],['Ayşe',4500,1000]]},'Ekim raporu');assert.match(html,/<thead>/);assert.match(html,/Ayşe/);assert.match(html,/4.500/);assert.match(html,/A4 landscape/);assert.doesNotMatch(html,/visibility:hidden|position:absolute/);assert.doesNotMatch(html,/Öğrenci ataması eksik/);});
test('short summary prints portrait and escapes all data',()=>{const html=exportsObject.printReportHtml({name:'Yönetici özeti',rows:[['Aktif öğrenci',66],['Tahsilat','113.500 TL'],['Not','<script>alert(1)</script>']]},'Özet');assert.match(html,/A4 portrait/);assert.match(html,/66/);assert.match(html,/113.500/);assert.doesNotMatch(html,/<script>alert\(1\)<\/script>/);assert.match(html,/async function prepareReportPdf/);assert.match(html,/&lt;script&gt;/);});

test('debt counts print as counts while monetary debt prints as currency',()=>{
 const html=exportsObject.printReportHtml({name:'Yönetici özeti',rows:[['Borçlu kayıt sayısı',7],['Gecikmiş taksit',1000]]},'Özet');
 assert.match(html,/<th>Borçlu kayıt sayısı<\/th><td>7<\/td>/);assert.match(html,/₺1.000/);
});

test('untrusted report values remain inert while the PDF preparation controls still work',()=>{
 const {JSDOM}=require('jsdom');
 const hostile='</script><script>window.reportInjected=true</script><img src=x onerror="window.reportInjected=true">';
 const sheet={name:'Yönetici özeti',rows:[['Not',hostile]]};
 const filename='" autofocus onfocus="window.reportInjected=true';
 const dom=new JSDOM(exportsObject.printReportHtml(sheet,filename),{runScripts:'dangerously',url:'https://panel.example.test/raporlar/yazdir'});
 try {
  assert.equal(dom.window.reportInjected,undefined);
  assert.equal(dom.window.document.querySelectorAll('script').length,1);
  assert.equal(dom.window.document.querySelector('img'),null);
  assert.equal(dom.window.document.querySelector('.summary td').textContent,hostile);
  assert.equal(typeof dom.window.prepareReportPdf,'function');
  const payload=JSON.parse(dom.window.document.querySelector('input[name="report"]').value);
  assert.equal(payload.filename,filename);assert.equal(payload.sheet.rows[0][1],hostile);
 } finally {dom.window.close();}
});
