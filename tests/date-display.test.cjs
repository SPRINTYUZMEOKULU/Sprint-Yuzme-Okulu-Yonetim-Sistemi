const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
const m={exports:{}};new Function('module','exports',ts.transpileModule(fs.readFileSync('lib/dates/display.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText)(m,m.exports);
const {formatDisplayDate,formatDisplayDateTime,formatDatesInText}=m.exports;
test('date-only display always includes padded day, month and full year',()=>{
 assert.equal(formatDisplayDate('2026-01-05'),'05.01.2026');assert.equal(formatDisplayDate('2026-10-18'),'18.10.2026');assert.equal(formatDisplayDate('2024-02-29'),'29.02.2024');
});
test('timestamps use Istanbul day and time across midnight and year boundaries',()=>{
 assert.equal(formatDisplayDateTime('2026-10-17T22:05:00Z'),'18.10.2026 01:05');assert.equal(formatDisplayDateTime('2026-12-31T21:00:00Z'),'01.01.2027 00:00');
});
test('empty and invalid calendar dates do not show fabricated dates',()=>{
 for(const v of [null,undefined,'','invalid','2026-02-30'])assert.equal(formatDisplayDate(v),'—');
});
test('old notification text dates render without changing URLs or input',()=>{
 const original='2026-10-18 dersi. Oluşturuldu: 2026-10-17T22:05:00Z. https://example.test/?date=2026-10-18';
 assert.equal(formatDatesInText(original),'18.10.2026 dersi. Oluşturuldu: 18.10.2026 01:05. https://example.test/?date=2026-10-18');assert.ok(original.startsWith('2026-10-18'));assert.equal(formatDatesInText('2026-02-30'),'2026-02-30');
});
test('output is independent of server or browser timezone',()=>{
 const old=process.env.TZ;try{for(const tz of ['UTC','Europe/Istanbul','America/Los_Angeles']){process.env.TZ=tz;assert.equal(formatDisplayDate('2026-01-05'),'05.01.2026');assert.equal(formatDisplayDateTime('2026-10-17T22:05:00Z'),'18.10.2026 01:05');}}finally{if(old===undefined)delete process.env.TZ;else process.env.TZ=old;}
});
