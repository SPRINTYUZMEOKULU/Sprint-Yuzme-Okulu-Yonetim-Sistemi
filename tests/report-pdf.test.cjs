const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
const m={exports:{}};
const code=ts.transpileModule(fs.readFileSync('app/raporlar/report-pdf.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true}}).outputText;
new Function('module','exports','require',code)(m,m.exports,n=>n==='@/lib/dates/display'?{formatDisplayDateTime:()=> '30.10.2026 12:00'}:require(n));
test('real summary PDF uses portrait A4 and embeds Turkish-capable fonts',async()=>{
 const result=await m.exports.reportPdf({name:'Yönetici özeti',rows:[['Aktif öğrenci',66],['Tahsilat',113500],['Not','Öğrenci Şule Işık — Çarşamba']]},'Ekim raporu');
 const pdf=Buffer.from(result).toString('latin1');
 assert.match(pdf,/^%PDF-/);assert.match(pdf,/\/MediaBox \[0 0 595\.28 841\.89\]/);assert.match(pdf,/\/FontFile2/);assert.match(pdf,/%%EOF/);
});
test('real detailed report PDF uses landscape A4 and produces multiple pages for long exports',async()=>{
 const rows=[['Sıra','Öğrenci','Ücret','Ödenen','Kalan','Yapılacak işlemler'],...Array.from({length:120},(_,i)=>[i+1,'Öğrenci Şule Işık '+i,4500,1000,3500,'Kalan ödemeyi takip edin.'])];
 const result=await m.exports.reportPdf({name:'Kayıt ve ödeme',rows},'Ekim raporu');const pdf=Buffer.from(result).toString('latin1');
 assert.match(pdf,/^%PDF-/);assert.match(pdf,/\/MediaBox \[0 0 841\.89 595\.28\]/);assert.ok([...pdf.matchAll(/\/Type \/Page\b/g)].length>1);assert.match(pdf,/%%EOF/);
 if(process.env.REPORT_PDF_QA_DIR){fs.mkdirSync(process.env.REPORT_PDF_QA_DIR,{recursive:true});fs.writeFileSync(process.env.REPORT_PDF_QA_DIR+'/detail.pdf',result);}
});
