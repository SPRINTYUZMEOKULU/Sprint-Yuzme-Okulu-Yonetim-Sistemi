const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), ts = require('typescript');
const React = require('react'), {renderToStaticMarkup} = require('react-dom/server');
async function renderScope(searchParams) {
  const trace = [];
  const fixtures = Array.from({length:4},(_,i)=>({id:'pending-'+i,organization_id:'org',cash_handover_status:'handoff_pending',received_at:'2026-10-16T10:00:00Z',amount:100,student_id:'student'}));
  const client = {from(table) {
    const filters=[];
    const q={select(){return q},order(){return q},eq(k,v){trace.push(['eq',table,k,v]);filters.push(r=>r[k]===v);return q},gte(k,v){trace.push(['gte',table,k,v]);filters.push(r=>r[k]>=v);return q},lt(k,v){trace.push(['lt',table,k,v]);filters.push(r=>r[k]<v);return q},then(resolve){return Promise.resolve({data:table==='student_payments'?fixtures.filter(r=>filters.every(f=>f(r))):[],error:null}).then(resolve)}};return q;
  }};
  const m={exports:{}};
  const code=ts.transpileModule(fs.readFileSync('app/kasa/page.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2020}}).outputText;
  let props;
  new Function('module','exports','require',code)(m,m.exports,name=>{
    if(name==='@supabase/supabase-js')return {createClient:()=>client};
    if(name==='@/lib/dates/display'){const helper={exports:{}};new Function('module','exports',ts.transpileModule(fs.readFileSync('lib/dates/display.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(helper,helper.exports);return helper.exports;}
    if(name==='@/lib/auth/profile')return {requireProfile:async()=>({id:'owner',organization_id:'org'})};
    if(name==='next/link')return {__esModule:true,default:({children,...p})=>React.createElement('a',p,children)};
    if(name==='./kasa-client')return {__esModule:true,default:p=>{props=p;return null}};
    if(name.includes('finance-quick-nav'))return {__esModule:true,default:()=>null};
    if(name.endsWith('.css'))return {};
    return require(name);
  });
  const previousUrl=process.env.NEXT_PUBLIC_SUPABASE_URL,previousKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
  process.env.NEXT_PUBLIC_SUPABASE_URL='https://example.test';process.env.SUPABASE_SERVICE_ROLE_KEY='test-placeholder';
  try {const html=renderToStaticMarkup(await m.exports.default({searchParams:Promise.resolve(searchParams)}));return {html,props,trace};}
  finally {if(previousUrl===undefined)delete process.env.NEXT_PUBLIC_SUPABASE_URL;else process.env.NEXT_PUBLIC_SUPABASE_URL=previousUrl;if(previousKey===undefined)delete process.env.SUPABASE_SERVICE_ROLE_KEY;else process.env.SUPABASE_SERVICE_ROLE_KEY=previousKey;}
}
test('dashboard pending link displays older pending payments across all dates',async()=>{
 const {html,props,trace}=await renderScope({date:'2026-10-18',durum:'handoff_pending'});
 assert.equal(props.rows.length,4);assert.equal(props.pendingOnly,true);
 assert.match(html,/TÜM TARİHLER/);assert.match(html,/Günlük Kasaya Dön/);
 assert.ok(!trace.some(([op])=>op==='gte'||op==='lt'));
 assert.ok(trace.some(([op,table,k,v])=>op==='eq'&&table==='student_payments'&&k==='organization_id'&&v==='org'));
});
test('daily cash keeps its selected-day boundary',async()=>{
 const {props,trace}=await renderScope({date:'2026-10-18'});
 assert.equal(props.rows.length,0);assert.equal(props.pendingOnly,false);
 assert.ok(trace.some(([op])=>op==='gte'));assert.ok(trace.some(([op])=>op==='lt'));
});
test('unknown status does not widen the daily query to all dates',async()=>{
 const {props}=await renderScope({date:'2026-10-18',durum:'anything'});
 assert.equal(props.rows.length,0);assert.equal(props.pendingOnly,false);
});
