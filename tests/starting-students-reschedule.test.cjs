const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

function setup(overrides = {}, attendance = [], rpcError = null) {
  const enrollment = { id:'current', student_id:'student', organization_id:'org', status:'active', group_id:'group', start_date:'2026-10-07', planned_end_date:'2026-11-13', start_confirmation_required:true, actual_started_at:null, ...overrides };
  const tables = { students:[{id:'student',organization_id:'org',first_name:'Cankat',last_name:'Orak'}], student_enrollments:[enrollment], attendance_records:attendance, training_groups:[{id:'group',organization_id:'org',name:'Çocuk'}], student_activity_logs:[] };
  const rpcCalls = [];
  const client = {
    from(table) {
      let rows = tables[table]; const filters = []; let one = false;
      const q = {
        select(){return q}, order(){return q}, limit(){return q},
        eq(k,v){filters.push(r=>r[k]===v);return q},
        gte(k,v){filters.push(r=>r[k]>=v);return q},
        in(k,v){filters.push(r=>v.includes(r[k]));return q},
        is(k,v){filters.push(r=>r[k]===v);return q},
        maybeSingle(){one=true;return q},single(){one=true;return q},
        insert(row){tables[table].push(row);return q},
        update(row){Object.assign(enrollment,row);return q},
        then(resolve){const matches=rows.filter(r=>filters.every(f=>f(r)));return Promise.resolve({data:one?matches[0]||null:matches,error:null}).then(resolve)}
      };return q;
    },
    async rpc(name,args){rpcCalls.push({name,args});if(rpcError)return {data:null,error:{message:rpcError}};enrollment.start_date=args.p_start_date;enrollment.planned_end_date='2026-11-20';return {data:{ok:true},error:null};}
  };
  const source = ts.transpileModule(fs.readFileSync('app/api/starting-students/reschedule/route.ts','utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
  const mod={exports:{}};
  new Function('require','module','exports',source)(name=>{
    if(name==='next/server')return {NextResponse:{json:(body,opts)=>({body,status:opts?.status||200})}};
    if(name==='@/lib/auth/profile')return {requireProfile:async()=>({id:'admin',organization_id:'org'})};
    if(name==='@/lib/supabase/server')return {createClient:async()=>client};
    throw Error(name);
  },mod,mod.exports);
  return {post:()=>mod.exports.POST({json:async()=>({studentId:'student',startDate:'2099-10-16'})}), enrollment, rpcCalls};
}
const record=(props={})=>({id:'attendance',organization_id:'org',student_id:'student',enrollment_id:'current',lesson_date:'2026-10-14',status:'present',...props});
test('pending registration ignores historic attendance and reschedules without starting',async()=>{
  const s=setup({},[record({lesson_date:'2026-09-23'}),record({enrollment_id:'old'})]);
  const r=await s.post();assert.equal(r.status,200);assert.equal(s.rpcCalls[0].args.p_confirm,false);assert.equal(s.rpcCalls[0].args.p_expected_start_date,'2026-10-07');assert.equal(s.enrollment.actual_started_at,null);assert.equal(r.body.plannedEndDate,'2026-11-20');
});
test('confirmed registration cannot be rescheduled even with no attendance',async()=>{
  const s=setup({actual_started_at:'2026-10-14T15:00:00Z'});assert.equal((await s.post()).status,400);assert.equal(s.rpcCalls.length,0);
});
test('current package normal attendance blocks a legacy reschedule',async()=>{
  const s=setup({start_confirmation_required:false},[record()]);assert.equal((await s.post()).status,400);
});
test('old package, pre-start attendance and cancellation do not block',async()=>{
  for(const row of [record({enrollment_id:'old'}),record({lesson_date:'2026-09-23'}),record({status:'cancelled'})]){
    const s=setup({start_confirmation_required:false},[row]);assert.equal((await s.post()).status,200);
  }
});
test('RPC conflict is reported without changing the enrollment',async()=>{
  const s=setup({},[],'Başlangıç tarihi değişmiş.');const r=await s.post();assert.equal(r.status,400);assert.equal(s.enrollment.start_date,'2026-10-07');
});
