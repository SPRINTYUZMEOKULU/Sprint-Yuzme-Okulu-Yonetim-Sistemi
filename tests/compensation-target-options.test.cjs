const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), ts = require('typescript');
function load(path) {
  const m = {exports:{}};
  new Function('require','module','exports',ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText)(
    name => name === './participation' ? load('lib/lesson-operations/participation.ts') : require(name), m, m.exports);
  return m.exports;
}
const {compensationTargetOptions: options, compatibleCompensationGroups: compatible} = load('lib/lesson-operations/compensation-targets.ts');
const groups = [
  {id:'a',branch_id:'pool',course_type:'Yetişkin Yüzme Kursu'},
  {id:'b',branch_id:'pool',course_type:'adult'},
  {id:'child',branch_id:'pool',course_type:'Çocuk Yüzme Kursu'},
  {id:'team',branch_id:'pool',course_type:'Takım / Performans'},
  {id:'other',branch_id:'other',course_type:'adult'},
];
const session = (id,group_id,weekday=6,start_time='19:00:00') => ({id,group_id,weekday,start_time,end_time:'20:00:00',is_active:true});
const schedules = [session('b19','b'),session('a19','a'),session('c19','child'),session('t19','team'),session('o19','other'),session('a20','a',6,'20:00:00'),session('sun','b',0)];
test('shared Saturday is one choice preserving the source group schedule',()=>{
  assert.deepEqual(options('a','2026-10-24',groups,schedules).map(s=>s.id),['a19','a20']);
  assert.deepEqual(options('b','2026-10-24',groups,[...schedules].reverse()).map(s=>s.id),['b19','a20']);
});
test('cross-group Sunday keeps its actual target ID and supports 0 and 7',()=>{
  for(const weekday of [0,7]) assert.deepEqual(options('a','2026-10-25',groups,[session('sun','b',weekday)]).map(s=>[s.id,s.group_id]),[['sun','b']]);
});
test('children, teams and adults stay separate and inactive sessions are excluded',()=>{
  assert.deepEqual(options('child','2026-10-24',groups,schedules).map(s=>s.id),['c19']);
  assert.deepEqual(options('team','2026-10-24',groups,schedules).map(s=>s.id),['t19']);
  assert.deepEqual(options('a','2026-10-24',groups,schedules.map(s=>({...s,is_active:false}))),[]);
});
test('missing date, unknown groups and missing pool cannot broaden the choices',()=>{
  assert.deepEqual(options('a','',groups,schedules),[]);
  assert.deepEqual(options('missing','2026-10-24',groups,schedules),[]);
  assert.equal(compatible({id:'x',branch_id:null},{id:'y',branch_id:null}),false);
  assert.equal(compatible({id:'x',branch_id:'pool'},{id:'y',branch_id:'pool'}),false);
});
