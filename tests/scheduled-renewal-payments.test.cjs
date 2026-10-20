const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
async function paymentCenter(requested=''){
 const rows={students:[{id:'child',organization_id:'org',first_name:'Test'}],student_enrollments:[
  {id:'next',student_id:'child',organization_id:'org',status:'scheduled',package_id:'p',start_date:'2026-10-22',planned_end_date:'2026-11-17'},
  {id:'current',student_id:'child',organization_id:'org',status:'active',package_id:'p',start_date:'2026-09-22',planned_end_date:'2026-10-17'},
  {id:'foreign',student_id:'other',organization_id:'other',status:'scheduled',package_id:'p'}],
  course_packages:[{id:'p',organization_id:'org',price:6000,name:'12 Ders'}],student_payments:[
   {id:'old-payment',student_id:'child',organization_id:'org',enrollment_id:'current',amount:6000,payment_status:'completed'},
   {id:'advance',student_id:'child',organization_id:'org',enrollment_id:'next',amount:1000,payment_status:'completed'}]};
 const db={from(table){let single=false;const filters=[];const q={select(){return q},eq(k,v){filters.push(r=>r[k]===v);return q},in(k,vs){filters.push(r=>vs.includes(r[k]));return q},neq(k,v){filters.push(r=>r[k]!==v);return q},order(){return q},limit(){return q},maybeSingle(){single=true;return q},then(resolve,reject){const data=(rows[table]||[]).filter(r=>filters.every(f=>f(r)));return Promise.resolve({data:single?data[0]||null:data,error:null}).then(resolve,reject)}};return q;}};
 process.env.NEXT_PUBLIC_SUPABASE_URL='https://example.test';process.env.SUPABASE_SERVICE_ROLE_KEY='test';
 const m={exports:{}};
 const code=ts.transpileModule(fs.readFileSync('app/api/student-payment-center/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
 new Function('module','exports','require',code)(m,m.exports,n=>{
  if(n==='next/server')return {NextResponse:{json:(body,options)=>({body,status:options?.status||200})}};
  if(n==='@/lib/auth/profile')return {requireProfile:async()=>({id:'owner',organization_id:'org'})};
  if(n==='@supabase/supabase-js')return {createClient:()=>db};
  throw new Error('Unexpected dependency '+n);
 });
 return m.exports.GET({nextUrl:new URL('https://example.test/api?studentId=child&enrollmentId='+requested)});
}
test('prepayment selection scopes payments to the scheduled period, leaving the paid current period separate',async()=>{
 const current=await paymentCenter();assert.equal(current.status,200);assert.equal(current.body.enrollment.id,'current');assert.equal(current.body.enrollment.remainingPayment,0);
 const next=await paymentCenter('next');assert.equal(next.status,200);assert.equal(next.body.enrollment.source,'scheduled');assert.equal(next.body.enrollment.totalReceived,1000);assert.equal(next.body.enrollment.remainingPayment,5000);assert.equal(next.body.periods.length,2);
});
test('a requested period belonging to another student or organization is rejected',async()=>{
 const result=await paymentCenter('foreign');assert.equal(result.status,404);assert.equal(result.body.ok,false);
});
