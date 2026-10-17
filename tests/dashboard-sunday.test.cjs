const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

const fixedNow = '2026-10-10T21:38:00Z'; // Sunday in Istanbul, Saturday in UTC.
class Clock extends Date {
  constructor(...args) { super(...(args.length ? args : [fixedNow])); }
}
const tables = {
  branches: [{ id: 'b', organization_id: 'org', name: 'Süleyman Erol', is_active: true }],
  training_groups: ['child', 'adult'].map(id => ({ id, organization_id: 'org', branch_id: 'b', name: id, is_active: true })),
  lesson_schedules: [
    { id: 'child-s', group_id: 'child', weekday: 0 },
    { id: 'adult-s', group_id: 'adult', weekday: 7 },
    { id: 'saturday', group_id: 'child', weekday: 6 },
    { id: 'inactive', group_id: 'child', weekday: 0, is_active: false },
  ].map(s => ({ organization_id: 'org', branch_id: 'b', start_time: '19:00:00', end_time: '20:00:00', is_active: true, ...s })),
  students: ['child', 'adult'].map(id => ({ id, organization_id: 'org', status: 'active', is_deleted: false, first_name: id })),
  student_enrollments: ['child', 'adult'].map((id, i) => ({ id: `e-${id}`, organization_id: 'org', student_id: id, group_id: id, status: 'active', start_date: '2026-10-01', lesson_weekdays: [i ? 7 : 0], total_lessons: 8, used_lessons: 0 })),
  student_group_memberships: ['child', 'adult'].map(id => ({ organization_id: 'org', student_id: id, group_id: id, is_active: true })),
};
function from(table) {
  let rows = [...(tables[table] || [])];
  const q = {
    select: () => q,
    eq: (key, value) => { rows = rows.filter(r => r[key] === value); return q; },
    in: (key, values) => { rows = rows.filter(r => values.includes(r[key])); return q; },
    contains: (key,value) => { rows=rows.filter(r=>Object.entries(value).every(([k,v])=>r[key]?.[k]===v));return q; },
    neq: (key, value) => { rows = rows.filter(r => r[key] !== value); return q; },
    lt: () => q, range: () => q, gte: () => q, lte: () => q, is: () => q, not: () => q, like: () => q, order: () => q, limit: () => q,
    then: (resolve, reject) => Promise.resolve({ data: rows, error: null, count: rows.length }).then(resolve, reject),
  };
  return q;
}
function load(path) {
  const source = ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const mod = { exports: {} };
  const req = name => {
    if (name === 'next/server') return { NextResponse: { json: (body, options) => ({ body, status: options?.status || 200 }) } };
    if (name === '@/lib/auth/profile') return { requireProfile: async () => ({ id: 'owner', organization_id: 'org' }) };
    if (name === '@/lib/supabase/server') return { createClient: async () => ({ from }) };
    if (name === '@supabase/supabase-js') return { createClient: () => ({ from }) };
    if (name.startsWith('@/')) return load(`${name.slice(2)}.ts`);
    return require(name);
  };
  new Function('module', 'exports', 'require', 'Date', source)(mod, mod.exports, req, Clock);
  return mod.exports;
}
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-only';

test('Istanbul Sunday daily dashboard includes both Sunday codes, children and adults in one slot', async () => {
  const { body, status } = await load('app/api/dashboard/live/route.ts').GET();
  assert.equal(status, 200);
  assert.equal(body.date, '2026-10-11');
  assert.equal(body.summary.todayLessons, 1);
  assert.equal(body.summary.pendingAttendance, 1);
  assert.equal(body.sessions[0].studentCount, 2);
  assert.deepEqual(body.sessions[0].groups.map(g => g.id).sort(), ['adult-s', 'child-s']);
});

test('monthly calendar includes all October Sundays and excludes inactive sessions', async () => {
  const { body, status } = await load('app/api/dashboard/calendar/route.ts').GET({ nextUrl: new URL('https://example.test/api/dashboard/calendar?month=2026-10') });
  assert.equal(status, 200);
  for (const date of ['2026-10-04', '2026-10-11', '2026-10-18', '2026-10-25']) {
    assert.deepEqual(body.days.find(d => d.date === date).lessons.map(s => s.id).sort(), ['adult-s', 'child-s']);
  }
  assert.deepEqual(body.days.find(d => d.date === '2026-10-10').lessons.map(s => s.id), ['saturday']);
  assert.equal(body.days.find(d => d.date === '2026-10-12').lessons.length, 0);
});

test('cancelled shared session shows compensation and message counts and no pending attendance',async()=>{
 tables.student_activity_logs=['child','adult'].map(id=>({id:`cancel-${id}`,organization_id:'org',student_id:id,activity_type:'lesson_cancellation_compensation',source_id:`${id}-s`,old_value:{cancelled_lesson_date:'2026-10-11'},new_value:{compensation_date:'2026-10-18'},performed_at:fixedNow}));
 tables.message_logs=['child','adult'].map(id=>({id:`message-${id}`,organization_id:'org',student_id:id,template_key:'lesson_cancellation_compensation',status:id==='child'?'sent':'prepared',metadata:{source_schedule_id:`${id}-s`,cancelled_date:'2026-10-11'}}));
 try {
  const {GET}=load('app/api/dashboard/live/route.ts');const {body}=await GET();
  assert.equal(body.summary.pendingAttendance,0);assert.equal(body.sessions.length,1);assert.equal(body.sessions[0].cancelled,true);assert.equal(body.sessions[0].missingCount,0);assert.equal(body.sessions[0].attendanceCount,0);
  const calendar=await load('app/api/dashboard/calendar/route.ts').GET({nextUrl:new URL('https://example.test/api/dashboard/calendar?month=2026-10')});
  const lessons=calendar.body.days.find(day=>day.date==='2026-10-11').lessons;
  assert.ok(lessons.every(lesson=>lesson.cancellationCount===1));
  assert.match(lessons.find(lesson=>lesson.id==='child-s').messageStatus,/İptal mesajı gönderildi/);
  assert.match(lessons.find(lesson=>lesson.id==='adult-s').messageStatus,/Mesaj hazır/);
  assert.equal(body.sessions[0].cancellation.plannedStudentIds.length,2);assert.equal(body.sessions[0].cancellation.sentStudentIds.length,1);assert.equal(body.sessions[0].cancellation.preparedStudentIds.length,1);
 } finally {delete tables.student_activity_logs;delete tables.message_logs;}
});
