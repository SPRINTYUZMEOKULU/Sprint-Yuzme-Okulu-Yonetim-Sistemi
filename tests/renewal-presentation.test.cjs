const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
const out={exports:{}};new Function('module','exports',ts.transpileModule(fs.readFileSync('lib/enrollment/renewal-presentation.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(out,out.exports);
const {renewalPresentation,correctionOverlapsRenewal}=out.exports;
const next={id:'new-period',status:'scheduled',start_date:'2026-11-03',planned_end_date:'2026-11-28',total_lessons:12};
test('prepared renewal is shown as twelve new lessons without claiming it is active early',()=>{assert.deepEqual(renewalPresentation(next),{title:'Kayıt yenilendi · Yeni dönem hazır',startDate:'2026-11-03',endDate:'2026-11-28',lessons:12,enrollmentId:'new-period'});assert.equal(next.status,'scheduled')});
test('missing and completed periods do not suppress renewal warnings',()=>{assert.equal(renewalPresentation(null),null);assert.equal(renewalPresentation({...next,status:'completed'}),null)});
test('manager cannot overwrite old period with prepared renewal dates',()=>{assert.equal(correctionOverlapsRenewal('2026-11-03','2026-11-28',next),true);assert.equal(correctionOverlapsRenewal('2026-10-01','2026-11-03',next),true);assert.equal(correctionOverlapsRenewal('2026-10-01','2026-10-27',next),false)});
test('legitimate correction remains available when there is no prepared renewal',()=>{assert.equal(correctionOverlapsRenewal('2026-11-03','2026-11-28',null),false)});
