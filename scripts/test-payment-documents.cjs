// No credentials or live database writes. Exercise server guards with deterministic query responses.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ts = require('typescript');
const path = require('node:path');
const root = path.join(__dirname, '..');
function load(file, imports = {}, globals = {}) {
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  vm.runInNewContext(code, { exports: module.exports, require: name => { if (!(name in imports)) throw new Error(`Unexpected import ${name}`); return imports[name]; }, URL, Date, console, ...globals });
  return module.exports;
}
const rules = load('lib/payments/document-rules.ts');
assert.equal(rules.parseAmount('4.500,50'), 4500.5);
assert.equal(rules.parseAmount('4500.50'), 4500.5);
assert.equal(rules.parseAmount(''), null);
assert.ok(Number.isNaN(rules.parseAmount('1e4')));
assert.ok(Number.isNaN(rules.parseAmount('12.345')));
assert.ok(rules.validIdentity('10000000146'));
assert.ok(!rules.validIdentity('00000000000'));
assert.ok(!rules.validIdentity('10000000147'));
assert.ok(!rules.isReceivedPayment({ payment_status: 'refunded' }));
assert.ok(!rules.validDocumentUrl('javascript:alert(1)'));
assert.ok(!rules.validDocumentUrl('https://user:pass@example.com'));
const uuid = '11111111-1111-4111-8111-111111111111';
const enrollmentId = '22222222-2222-4222-8222-222222222222';
let queue = [], writes = [], queries = [], remaining = 4500;
function db() {
  return { from(table) {
    const result = queue.shift(); assert.ok(result, `Unexpected query to ${table}`);
    const q = { table, filters: [] }; queries.push(q);
    const chain = {};
    for (const name of ['select','eq','gt','in','order','limit','update','insert']) chain[name] = (...args) => { if (['update','insert'].includes(name)) writes.push({ table, name, fields: args[0] }); else q.filters.push([name, ...args]); return chain; };
    chain.maybeSingle = chain.single = async () => result;
    chain.then = (resolve, reject) => Promise.resolve(result).then(resolve, reject);
    return chain;
  } };
}
const route = load('app/api/payment-document-request/route.ts', {
  'next/server': { NextResponse: { json: (data, options) => ({ data, status: options.status }) } },
  '@/lib/auth/profile': { requireProfile: async () => ({ id: uuid, organization_id: uuid }) },
  '@/lib/payments/document-server': { documentAdmin: db, currentDocumentFinance: async () => ({ remaining, enrollment: { id: enrollmentId }, packageName: 'Test' }) },
  '@/lib/payments/document-rules': rules,
});
const request = body => ({ json: async () => body, nextUrl: new URL(`https://example.com/api/payment-document-request?studentId=${uuid}`) });
const row = { id: uuid, student_id: uuid, enrollment_id: enrollmentId, status: 'waiting_payment', expected_amount: 4500, customer_completed_at: '2026-10-07', updated_at: '2026-10-07' };
const payment = { id: enrollmentId, enrollment_id: enrollmentId, amount: 4500, payment_status: 'received', payment_method: 'eft', cancelled_at: null };
async function run() {
  assert.equal((await route.POST(request({ studentId: uuid, expectedAmount: 5000 }))).status, 400);
  remaining = 0;
  assert.equal((await route.POST(request({ studentId: uuid }))).status, 409); remaining = 4500;
  queue = [{ data: { public_token: uuid, expires_at: '2026-10-14' } }]; writes = [];
  assert.equal((await route.POST(request({ studentId: uuid }))).status, 200); assert.equal(writes.length, 0);
  queue = [{ data: row }, { data: { ...payment, enrollment_id: uuid } }]; writes = [];
  assert.equal((await route.PATCH(request({ requestId: uuid, action: 'match', paymentId: enrollmentId }))).status, 409); assert.equal(writes.length, 0);
  queue = [{ data: row }, { data: { ...payment, cancelled_at: '2026-10-07' } }];
  assert.equal((await route.PATCH(request({ requestId: uuid, action: 'match', paymentId: enrollmentId }))).status, 409);
  queue = [{ data: row }, { data: { ...payment, amount: 4000 } }];
  assert.equal((await route.PATCH(request({ requestId: uuid, action: 'match', paymentId: enrollmentId }))).status, 409);
  queue = [{ data: row }, { data: payment }, { data: { id: uuid } }]; writes = []; queries = [];
  assert.equal((await route.PATCH(request({ requestId: uuid, action: 'match', paymentId: enrollmentId }))).status, 200);
  assert.equal(writes.length, 1); assert.equal(writes[0].table, 'payment_document_requests'); assert.equal(writes[0].fields.payment_id, enrollmentId);
  assert.equal(writes[0].fields.status, 'document_pending');
  assert.ok(queries.every(q => q.filters.some(f => f[0] === 'eq' && f[1] === 'organization_id' && f[2] === uuid)));
  queue = [{ data: { ...row, payment_id: enrollmentId } }]; writes = [];
  assert.equal((await route.PATCH(request({ requestId: uuid, action: 'cancel' }))).status, 409); assert.equal(writes.length, 0);
  queue = [{ data: row }, { data: null }];
  assert.equal((await route.PATCH(request({ requestId: uuid, action: 'cancel' }))).status, 409); // concurrent update
  queue = [{ data: { ...row, payment_id: enrollmentId, status: 'document_pending' } }, { data: payment }]; writes = [];
  assert.equal((await route.PATCH(request({ requestId: uuid, action: 'document', documentNumber: 'TEST', documentUrl: 'javascript:alert(1)' }))).status, 400); assert.equal(writes.length, 0);
  let revalidated = false;
  const action = load('app/odeme-belge/[token]/actions.ts', { '@supabase/supabase-js': { createClient: db }, '@/lib/payments/document-rules': rules, 'next/cache': { revalidatePath: () => { revalidated = true; } } }, { process: { env: { NEXT_PUBLIC_SUPABASE_URL: 'https://example.com', SUPABASE_SERVICE_ROLE_KEY: 'mock' } } });
  const form = new Map(Object.entries({recipient_type:'individual', recipient_name:'Test Recipient', tax_identity_number:'10000000146', address:'Test Address', consent:'on'}));
  queue = [{ data: { ...row, status: 'cancelled', expires_at: '2099-01-01' } }]; writes = [];
  assert.equal((await action.saveCustomerDocumentInfo(uuid, form)).ok, false); assert.equal(writes.length, 0);
  queue = [{ data: { ...row, status: 'waiting_customer', expires_at: '2000-01-01' } }];
  assert.equal((await action.saveCustomerDocumentInfo(uuid, form)).ok, false);
  queue = [{ data: { ...row, status: 'waiting_payment', expires_at: '2099-01-01' } }];
  assert.equal((await action.saveCustomerDocumentInfo(uuid, form)).ok, false); // completed data cannot be overwritten
  queue = [{ data: { ...row, status: 'waiting_customer', expires_at: '2099-01-01' } }, { data: { id: uuid } }]; writes = [];
  assert.equal((await action.saveCustomerDocumentInfo(uuid, form)).ok, true); assert.ok(revalidated); assert.equal(writes[0].fields.status, 'waiting_payment');
  console.log('Payment document rules and 14 server workflow scenarios passed (mock database, no live writes).');
}
run().catch(error => { console.error(error); process.exitCode = 1; });
