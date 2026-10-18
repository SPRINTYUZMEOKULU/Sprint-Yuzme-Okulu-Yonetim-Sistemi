const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

async function renderHome(failedTable) {
  const queries = [];
  function from(table) {
    const query = { table, filters: [] };
    queries.push(query);
    const builder = {
      select() { return this; },
      eq(key, value) { query.filters.push([key, value]); return this; },
      order() { return this; },
      then(resolve) {
        return Promise.resolve({
          error: failedTable === table ? { message: 'unavailable' } : null,
          count: failedTable === table ? null : table === 'student_payments' ? 4 : 0,
          data: table === 'branches' ? [{ id: 'branch-1', name: 'Veritabanındaki aktif şube' }] : [],
        }).then(resolve);
      },
    };
    return builder;
  }
  const m = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync('app/page.tsx', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  new Function('module', 'exports', 'require', code)(m, m.exports, (name) => {
    if (name === '@/lib/auth/profile') return { requireProfile: async () => ({ id: 'owner', organization_id: 'org-1', role: 'owner', full_name: '' }) };
    if (name === '@/lib/supabase/server') return { createClient: async () => ({ from }) };
    if (name === 'next/navigation') return { redirect: () => { throw new Error('Unexpected redirect'); } };
    if (name === 'next/link') return { default: ({ children, ...props }) => React.createElement('a', props, children), __esModule: true };
    if (name.includes('dashboard-icons')) return { Icons: new Proxy({}, { get: () => () => null }) };
    if (name.startsWith('@/app/components/')) return { default: () => null, __esModule: true };
    if (name.endsWith('.css')) return {};
    return require(name);
  });
  return { html: renderToStaticMarkup(await m.exports.default()), queries };
}

test('home uses the real cash handover source and scopes counts to the organization', async () => {
  const { html, queries } = await renderHome();
  assert.match(html, /Teslim Onayı Bekleyen<\/span><strong>4<\/strong>/);
  assert.ok(queries.some(q => q.table === 'student_payments' && q.filters.some(([k,v]) => k === 'cash_handover_status' && v === 'handoff_pending')));
  assert.ok(queries.every(q => q.filters.some(([k,v]) => k === 'organization_id' && v === 'org-1')));
  assert.ok(queries.filter(q => q.table === 'students').every(q => q.filters.some(([k,v]) => k === 'is_deleted' && v === false)));
  assert.match(html, /Veritabanındaki aktif şube/);
  assert.doesNotMatch(html, /Lara Life City|Konyaaltı Öğretmenevi/);
});

test('failed count is unknown while a successful empty count stays zero', async () => {
  const { html } = await renderHome('student_payments');
  assert.match(html, /Teslim Onayı Bekleyen<\/span><strong>—<\/strong>/);
  assert.match(html, /Bekleyen Ön Kayıt<\/span><strong>0<\/strong>/);
  assert.match(html, /Bilgi alınamadı/);
});

test('an alert query failure cannot display an all-clear message', async () => {
  const { html } = await renderHome('alerts');
  assert.match(html, /Uyarılar kontrol edilemedi/);
  assert.doesNotMatch(html, /Her şey yolunda|Şu anda açık uyarı bulunmuyor/);
});
