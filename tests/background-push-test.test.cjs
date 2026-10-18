const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

function load({ authenticated = true, devices = true } = {}) {
  const trace = [], tasks = [], calls = [];
  const admin = { from(table) {
    const q = { select() { return q; }, eq(key, value) { trace.push([table, key, value]); return q; },
      maybeSingle: async () => ({ data: { id: 'me', organization_id: 'my-org' } }),
      then(resolve) { return Promise.resolve({ data: devices ? [{ id: 'device', endpoint: 'https://push.test/endpoint', p256dh: 'public-test-key', auth_key: 'test-auth' }] : [] }).then(resolve); }
    }; return q;
  } };
  const env = new Proxy({}, { get: () => 'test-placeholder' });
  const mod = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync('app/api/push/test/route.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText;
  new Function('module', 'exports', 'require', 'process', 'setTimeout', code)(mod, mod.exports, name => {
    if (name === 'next/server') return { after: fn => tasks.push(fn), NextResponse: { json: (body, options = {}) => ({ body, status: options.status || 200 }) } };
    if (name === '@/lib/supabase/server') return { createClient: async () => ({ auth: { getUser: async () => ({ data: { user: authenticated ? { id: 'me' } : null } }) } }) };
    if (name === '@supabase/supabase-js') return { createClient: () => admin };
    if (name === 'web-push') return { setVapidDetails() {}, sendNotification: async (...args) => calls.push(args) };
    throw new Error(name);
  }, { env }, (callback, delay) => { assert.equal(delay, 15000); callback(); });
  return { POST: mod.exports.POST, calls, tasks, trace };
}
const request = delay => ({ nextUrl: new URL(`https://sprint.test/api/push/test${delay ? '?delay=15' : ''}`) });

test('background test returns before delivery and sends via server after the delay', async () => {
  const harness = load();
  const response = await harness.POST(request(true));
  assert.equal(response.status, 202);
  assert.equal(response.body.scheduled, true);
  assert.equal(harness.calls.length, 0);
  assert.equal(harness.tasks.length, 1);
  await harness.tasks[0]();
  assert.equal(harness.calls.length, 1);
  assert.equal(harness.calls[0][2].urgency, 'high');
  assert.ok(harness.trace.some(([table, key, value]) => table === 'push_subscriptions' && key === 'profile_id' && value === 'me'));
  assert.ok(harness.trace.some(([table, key, value]) => table === 'push_subscriptions' && key === 'organization_id' && value === 'my-org'));
});
test('unauthenticated requests cannot schedule or send a push', async () => {
  const harness = load({ authenticated: false });
  assert.equal((await harness.POST(request(true))).status, 401);
  assert.equal(harness.tasks.length, 0);
  assert.equal(harness.calls.length, 0);
});
test('missing device returns a failure instead of promising a delayed delivery', async () => {
  const harness = load({ devices: false });
  assert.equal((await harness.POST(request(true))).status, 404);
  assert.equal(harness.tasks.length, 0);
});
test('existing immediate test still returns the actual delivery result', async () => {
  const harness = load();
  const response = await harness.POST(request(false));
  assert.equal(response.status, 200);
  assert.equal(response.body.sent, 1);
  assert.equal(harness.tasks.length, 0);
});
