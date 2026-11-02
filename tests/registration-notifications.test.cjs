const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
function load(path, resolver) {
 const out = { exports: {} };
 new Function('module', 'exports', 'require', ts.transpileModule(fs.readFileSync(path, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true }
 }).outputText)(out, out.exports, resolver);
 return out.exports;
}
const { runRegistrationBackground } = load('lib/notifications/registration-background.ts', () => ({}));
const now = Date.parse('2026-11-02T12:00:00Z');
function fixture() {
 const tables = { students: [{ id: 's', organization_id: 'org', first_name: 'Alp', last_name: 'Yiğit', status: 'pre_registration', is_deleted: false, created_at: '2026-10-31T19:00:00Z' }], student_enrollments: [], system_notifications: [] };
 let fail = false;
 const client = { from(table) {
  const filters = []; let values;
  const q = { select() { return q; }, eq(k, v) { filters.push(r => r[k] === v); return q; }, in(k, v) { filters.push(r => v.includes(r[k])); return q; }, update(v) { values = v; return q; }, then(resolve) {
   const rows = tables[table].filter(r => filters.every(f => f(r)));
   if (values) rows.forEach(r => Object.assign(r, values));
   return Promise.resolve({ data: rows, error: fail ? { message: 'offline' } : null }).then(resolve);
  } }; return q;
 } };
 const sent = [];
 const notify = async input => { sent.push(input); tables.system_notifications.push({ id: 'n', organization_id: 'org', student_id: input.studentId, event_key: input.eventKey, is_read: false }); return { ok: true, notificationIds: ['n'], push: { sent: 1, failed: 0 } }; };
 return { tables, client, notify, sent, fail: () => { fail = true; } };
}
test('pending registration produces a student-specific push and never repeats after dismissal', async () => {
 const f = fixture(); assert.equal((await runRegistrationBackground(f.client, 'org', f.notify, now)).created, 1);
 assert.equal(f.sent[0].targetPath, '/kayit-tamamlama/s'); assert.equal(f.sent[0].push, true);
 assert.match(f.sent[0].body, /Alp Yiğit/); assert.ok(f.sent[0].dedupeKey);
 f.tables.system_notifications[0].is_read = true;
 assert.equal((await runRegistrationBackground(f.client, 'org', f.notify, now)).created, 0); assert.equal(f.sent.length, 1);
});
test('successfully activated registration automatically closes its warning', async () => {
 const f = fixture(); await runRegistrationBackground(f.client, 'org', f.notify, now);
 f.tables.students[0].status = 'active';
 assert.equal((await runRegistrationBackground(f.client, 'org', f.notify, now)).resolved, 1);
 assert.equal(f.tables.system_notifications[0].is_read, true);
});
test('fresh registrations have time to finish without an immediate warning', async () => {
 const f = fixture(); f.tables.students[0].created_at = new Date(now - 1000).toISOString();
 assert.equal((await runRegistrationBackground(f.client, 'org', f.notify, now)).created, 0);
});
test('existing enrollment does not silently activate an incomplete registration', async () => {
 const f = fixture(); f.tables.student_enrollments.push({ id: 'e', student_id: 's', organization_id: 'org', status: 'active' });
 await runRegistrationBackground(f.client, 'org', f.notify, now);
 assert.equal(f.sent[0].title, 'Kesin kayıt durumu kontrol edilmeli'); assert.equal(f.tables.students[0].status, 'pre_registration');
});
test('failed database read cannot dismiss an unresolved warning', async () => {
 const f = fixture(); await runRegistrationBackground(f.client, 'org', f.notify, now); f.fail();
 await assert.rejects(runRegistrationBackground(f.client, 'org', f.notify, now), /kontrol edilemedi/);
 assert.equal(f.tables.system_notifications[0].is_read, false);
});
test('concurrent notification requests insert and push only once per recipient', async () => {
 const inserted = new Map(); let pushes = 0;
 const client = { from(table) {
  let rows = table === 'profiles' ? [{ id: 'owner', role: 'owner' }] : []; let incoming;
  const q = { select() { return q; }, eq() { return q; }, in() { return q; }, update() { return q; }, upsert(r, options) { assert.equal(options.ignoreDuplicates, true); incoming = r; return q; }, then(resolve) {
   if (incoming) rows = incoming.flatMap(r => { if (inserted.has(r.id)) return []; inserted.set(r.id, r); return [r]; });
   return Promise.resolve({ data: rows, error: null }).then(resolve);
  } }; return q;
 } };
 const engine = load('lib/notifications/create-notification.ts', name => {
  if (name === 'server-only') return {};
  if (name === '@supabase/supabase-js') return { createClient: () => client };
  if (name === 'web-push') return { setVapidDetails() {}, async sendNotification() { pushes++; } };
  if (name === '@/lib/notifications/resolve-scope-context') return { resolveNotificationScopeContext: async () => ({ assignedProfileIds: new Set(), hasAssignableContext: false }) };
  if (name === '@/lib/dates/display') return { formatDatesInText: x => x };
  return require(name);
 });
 process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.invalid'; process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-only';
 const input = { organizationId: 'org', title: 'Kesin kayıt tamamlanmalı', category: 'preregistration', dedupeKey: 'registration:s', push: false };
 const result = await Promise.all([engine.createNotification(input), engine.createNotification(input)]);
 assert.equal(result.flatMap(r => r.notificationIds).length, 1); assert.equal(inserted.size, 1); assert.equal(pushes, 0);
 assert.notEqual(engine.notificationDedupeId('org', 'key', 'a'), engine.notificationDedupeId('org', 'key', 'b'));
});
