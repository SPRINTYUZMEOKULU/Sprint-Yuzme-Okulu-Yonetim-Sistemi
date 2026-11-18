const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

function load(path, imports = {}) {
  const js = ts.transpileModule(fs.readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', js)(
    name => name in imports ? imports[name] : require(name), module, module.exports,
  );
  return module.exports;
}

function fixture(options = {}) {
  const filters = [];
  const writes = [];
  const query = {
    select: () => query,
    eq: (name, value) => { filters.push([name, value]); return query; },
    order: () => query,
    limit: () => query,
    maybeSingle: async () => ({ data: writes[0]?.row || options.latest || null }),
    upsert: async (row, settings) => { writes.push({ row, settings }); return {}; },
  };
  const { openGuardianBankPayment } = load('app/veli-odemeler/actions.ts', {
    'next/navigation': { redirect: url => { throw Object.assign(new Error('redirect'), { url }); } },
    '@/lib/auth/profile': { requireProfile: async roles => {
      assert.deepEqual(roles, ['guardian']);
      return { id: 'guardian', organization_id: 'org' };
    } },
    '@/lib/guardian/data': { getGuardianContext: async () => ({
      selected: { id: 'child' },
      issues: options.issues || [],
      enrollment: { id: 'package-enrollment', package_price: 4000 },
      payments: [],
      obligations: [{ id: 'gear', title: 'Palet', enrollment_id: 'gear-enrollment', amount: 12000, paid_amount: 100, status: 'open' }],
    }) },
    '@/lib/guardian/payment-summary': load('lib/guardian/payment-summary.ts'),
    '@/lib/payments/document-admin': { documentAdmin: () => ({ from: table => {
      assert.equal(table, 'payment_document_requests');
      return query;
    } }) },
    'node:crypto': { createHmac: (_algorithm, _key) => require('node:crypto').createHmac('sha256', 'test') },
  });
  const submit = (child, target) => {
    const form = new FormData();
    form.set('payment_target', target);
    form.set('amount', '1');
    return openGuardianBankPayment(child, form);
  };
  return { filters, writes, submit };
}

test('Guardian payment derives the selected unpaid item amount and uses the invoice queue', async () => {
  const { submit, writes, filters } = fixture();
  await assert.rejects(submit('child', 'gear'), error => /^\/odeme-belge\/[\da-f-]{36}$/.test(error.url));
  assert.equal(writes[0].row.expected_amount, 11900);
  assert.equal(writes[0].row.enrollment_id, 'gear-enrollment');
  assert.equal(writes[0].row.status, 'waiting_customer');
  assert.equal(writes[0].settings.ignoreDuplicates, true);
  assert.deepEqual(filters.slice(0, 3), [['organization_id', 'org'], ['student_id', 'child'], ['created_by', 'guardian']]);
});

test('A foreign child, missing debt or unavailable finance data cannot create a payment link', async () => {
  for (const [options, child, target] of [[{},'foreign','package'], [{},'child','unknown'], [{issues:['Ödeme bilgileri yüklenemedi']},'child','package']]) {
    const { submit, writes } = fixture(options);
    await assert.rejects(submit(child, target), error => error.url.includes('paymentError='));
    assert.equal(writes.length, 0);
  }
});

test('Opening the same pending transfer reuses its existing link', async () => {
  const { submit, writes } = fixture({ latest: {
    id: 'prior', public_token: 'token', status: 'waiting_payment', expected_amount: '4000',
    enrollment_id: 'package-enrollment', expires_at: new Date(Date.now() + 60_000).toISOString(),
  } });
  await assert.rejects(submit('child', 'package'), error => error.url === '/odeme-belge/token');
  assert.equal(writes.length, 0);
});
