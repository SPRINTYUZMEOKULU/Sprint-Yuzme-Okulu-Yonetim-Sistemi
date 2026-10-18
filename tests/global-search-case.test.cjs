const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
function load(path, mocks = {}) {
  const m = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  new Function('module', 'exports', 'require', code)(m, m.exports, name => mocks[name] || (name.startsWith('@/') ? load(name.slice(2) + '.ts', mocks) : require(name)));
  return m.exports;
}
const { searchPattern, searchOrFilter } = load('lib/search/case-insensitive.ts');
const fixtures = [{ id: 'student-1', first_name: 'İrem', last_name: 'Yılmaz', guardian_name: 'IŞIK ÜNAL', student_number: 'SPR123', organization_id: 'org-1', is_deleted: false }, { id: 'other-org', first_name: 'İrem', organization_id: 'org-2', is_deleted: false }, { id: 'deleted', first_name: 'İrem', organization_id: 'org-1', is_deleted: true }];
function database() {
  return { from(table) {
    const filters = [];
    const b = {
      select() { return b; }, order() { return b; }, limit() { return b; },
      eq(k,v) { filters.push(row => row[k] === v); return b; },
      in() { return b; },
      filter(k,op,value) { assert.equal(op, 'match'); filters.push(row => new RegExp(value,'u').test(row[k] || '')); return b; },
      or(value) {
        const alternatives = value.split(',').map(part => {
          const split = part.indexOf('.match.');
          assert.ok(split > 0);
          const key = part.slice(0,split), pattern = JSON.parse(part.slice(split + 7));
          return row => new RegExp(pattern,'u').test(row[key] || '');
        });
        filters.push(row => alternatives.some(f => f(row))); return b;
      },
      then(resolve) { return Promise.resolve({ data: table === 'students' ? fixtures.filter(row => filters.every(f=>f(row))) : [], error: null }).then(resolve); },
    };return b;
  } };
}
const { GET } = load('app/api/global-search/route.ts', {
  '@/lib/auth/profile': { requireProfile: async () => ({ organization_id: 'org-1' }) },
  '@/lib/supabase/server': { createClient: async () => database() },
});
async function ids(query) {
  const response = await GET({ nextUrl: new URL('https://example.test/api/global-search?q=' + encodeURIComponent(query)) });
  assert.equal(response.status, 200);
  return (await response.json()).results.map(row => row.id);
}
test('student names match all uppercase, lowercase and mixed Turkish I variants', async () => {
  for (const q of ['İREM','irem','Irem','ıReM','I\u0307rem']) assert.deepEqual(await ids(q), ['student-1'], q);
});
test('full first/last names match independently of case', async () => {
  for (const q of ['İREM YILMAZ','irem yılmaz','ıReM yIlMaZ']) assert.deepEqual(await ids(q), ['student-1'], q);
});
test('guardian names and Turkish case pairs match', async () => {
  for (const q of ['IŞIK ÜNAL','ışık ünal','iŞiK üNaL']) assert.deepEqual(await ids(q), ['student-1'], q);
  assert.ok(new RegExp(searchPattern('çağrı özgür şule'),'u').test('ÇAĞRI ÖZGÜR ŞULE'));
});
test('student number search still works without case sensitivity', async () => {
  for (const q of ['SPR123','spr123','sPr123']) assert.deepEqual(await ids(q), ['student-1']);
});
test('punctuation is literal and cannot create regex wildcards or filter syntax', () => {
  const text = 'A.*[B]$+?\\"';
  const pattern = searchPattern(text);
  assert.ok(new RegExp(pattern,'u').test(text));
  assert.equal(new RegExp(pattern,'u').test('AXXXXB'),false);
  assert.equal(searchOrFilter(['first_name'],text), 'first_name.match.' + JSON.stringify(pattern));
});
test('a query containing only removed punctuation does not match every student', async () => {
  assert.deepEqual(await ids('%,_()'), []);
});
