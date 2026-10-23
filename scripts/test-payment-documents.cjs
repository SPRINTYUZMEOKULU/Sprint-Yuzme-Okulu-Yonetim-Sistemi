const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function load(path, dependencies = {}) {
  const code = ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(code, { exports: module.exports, module, require: id => { if (!(id in dependencies)) throw Error(id); return dependencies[id]; }, Date, console });
  return module.exports;
}
const state = load('lib/payments/document-state.ts');
const future = '2099-01-01T00:00:00Z';
assert.equal(state.publicDocumentState('waiting_customer', future), 'form');
assert.equal(state.publicDocumentState('cancelled', future), 'cancelled');
assert.equal(state.publicDocumentState('waiting_customer', 'invalid'), 'expired');
assert.equal(state.publicDocumentState('waiting_payment', '2000-01-01'), 'expired');
assert.equal(state.publicDocumentState('waiting_payment', future), 'bank');
assert.equal(state.publicDocumentState('payment_received', future), 'received');
assert.equal(state.publicDocumentState('document_sent', future), 'document');
assert.equal(state.publicDocumentState('error', future), 'review');
const details = { recipient_type:'individual', recipient_name:'Test Alıcı', tax_identity_number:'10000000146', tax_office:null, address:'Test Adresi', customer_consent_at:future, customer_completed_at:future };
assert.equal(state.hasDocumentDetails(details), true);
assert.equal(state.hasDocumentDetails({...details,customer_consent_at:null}), false);
assert.equal(state.hasDocumentDetails({...details,recipient_type:'company',tax_identity_number:'1234567890'}), false);
const payment = { id:'payment', student_id:'student', enrollment_id:'enrollment', amount:4000, currency:'TRY', payment_method:'bank_transfer', payment_status:'received', cancelled_at:null };
const request = { ...details, id:'request', student_id:'student', enrollment_id:'enrollment', expected_amount:4000, status:'waiting_payment', payment_id:null, document_status:'not_created', provider_document_id:null, document_number:null };
let context;
const db = { from(table) {
  const query = { filters: [], updating:false, select(){return this}, update(value){ this.updating=true;context.updates.push(value);return this}, eq(...args){this.filters.push(args);return this}, is(...args){this.filters.push(args);return this}, maybeSingle(){
    assert.ok(this.filters.some(([key,value])=>key==='organization_id'&&value==='organization'), 'every service-role query must be organization scoped');
    return Promise.resolve(this.updating ? context.saved : {data:table==='student_payments'?context.payment:context.request,error:null});
  } }; return query;
} };
const actions = load('app/odeme-bilgileri/belgeler/actions.ts', {
  '@/lib/auth/profile': {requireProfile:async roles=>{if(!roles.includes(context.role))throw Error('unauthorized');return {role:context.role,organization_id:'organization'}}},
  '@/lib/payments/document-admin': {documentAdmin:()=>db}, '@/lib/payments/document-state':state,
  'next/cache':{revalidatePath:()=>{}},
});
async function run(overrides={}) { context={role:'owner',request:{...request},payment:{...payment},saved:{data:{id:'request'},error:null},updates:[],...overrides};return actions.matchDocumentPayment('request','payment'); }
(async()=>{
 assert.equal((await run()).ok,true);assert.equal(context.updates[0].status,'payment_received');assert.equal(context.updates.length,1);
 for(const changed of [{payment_method:'cash'},{payment_method:'card'},{cancelled_at:future},{payment_status:'cancelled'},{amount:4001},{currency:'USD'},{student_id:'other'},{enrollment_id:'other'}]) {
  assert.equal((await run({payment:{...payment,...changed}})).ok,false);assert.equal(context.updates.length,0);
 }
 for(const changed of [{customer_consent_at:null},{payment_id:'existing'},{status:'document_created'},{document_number:'INV001'},{provider_document_id:'existing'},{document_status:'sending'}]) {
  assert.equal((await run({request:{...request,...changed}})).ok,false);assert.equal(context.updates.length,0);
 }
 assert.equal((await run({saved:{data:null,error:null}})).ok,false,'compare-and-set conflict must not report success');
 assert.equal((await run({saved:{data:null,error:{code:'23505'}}})).ok,false,'duplicate payment must fail');
 for(const role of ['accounting','coach','guardian','registration_staff']) await assert.rejects(run({role}),/unauthorized/);
 console.log('Payment document checks passed: public states, required details, organization isolation, roles, payment eligibility, amount/currency, existing invoice, duplicate and concurrent update rejection.');
})().catch(error=>{console.error(error);process.exitCode=1});
