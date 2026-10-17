const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
const m={exports:{}};new Function('module','exports',ts.transpileModule(fs.readFileSync('lib/lesson-operations/participation.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText)(m,m.exports);
const {participationDays}=m.exports;
test('Saturday cancellation excludes Sunday-only members without an attendance plan',()=>{assert.equal(participationDays(null,[7],[6,7]).includes(6),false);assert.equal(participationDays(null,[6,7],[6,7]).includes(6),true);});
test('current registration plan overrides registration days; empty plans fall back to registration',()=>{assert.deepEqual(participationDays([2,4],[2,4,6],[2,4,6]),[2,4]);assert.deepEqual(participationDays([],[7],[6,7]),[7]);assert.deepEqual(participationDays(null,null,[6,7]),[6,7]);});
