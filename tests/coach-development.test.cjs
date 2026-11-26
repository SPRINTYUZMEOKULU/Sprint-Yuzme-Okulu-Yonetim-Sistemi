const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");

function load(file, mocks = {}) {
  const module = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  new Function("module", "exports", "require", source)(module, module.exports, (name) => mocks[name] || require(name));
  return module.exports;
}

const scope = load("lib/attendance/coach-roster.ts");
const report = load("lib/attendance/development-report.ts", { "./coach-roster": scope });
const studentId = "11111111-1111-4111-8111-111111111111";
const scheduleId = "22222222-2222-4222-8222-222222222222";
const noteId = "33333333-3333-4333-8333-333333333333";
const form = { id: noteId, studentId, scheduleId, lessonDate: "2026-11-26", strengths: "Nefesini düzenli verdi", focus: "Serbest kol", goal: "10 m serbest" };

test("the report requires all three bounded sections and retains the assessment text", () => {
  assert.equal(report.developmentReportBody({ ...form, goal: " " }), null);
  assert.equal(report.developmentReportBody({ ...form, goal: "a".repeat(901) }), null);
  assert.match(report.developmentReportBody(form), /Gözlem ve kazanımlar\nNefesini düzenli verdi[\s\S]*Sonraki ders hedefi\n10 m serbest/);
});

test("direct assignments and individual student allocations control the development button", () => {
  const schedule = { id: "session", group_id: "group", coach_id: "other" };
  const coachIds = new Set(["coach", "staff"]);
  const assignments = [{ schedule_id: "session", student_id: "mine", coach_id: "staff" }];
  assert.deepEqual(report.reportStudentScope(schedule, "coach", [], assignments, coachIds, ["mine", "theirs"]), ["mine"]);
  assert.deepEqual(report.reportStudentScope({ ...schedule, coach_id: "coach" }, null, [],
    [{ schedule_id: "session", student_id: "theirs", coach_id: "other" }], coachIds, ["mine", "theirs"]), ["mine"]);
});

function fixture(otherCoach) {
  const saved = new Map();
  const notifications = new Set();
  let calls = 0;
  const db = { from(table) {
    const criteria = [];
    let payload;
    const builder = {
      select() { return builder; }, eq(key, value) { criteria.push([key, value]); return builder; }, or() { return builder; },
      upsert(row) { payload = row; return builder; },
      maybeSingle() {
        if (table === "staff") return Promise.resolve({ data: { id: "staff" } });
        if (payload && !saved.has(payload.id)) { saved.set(payload.id, payload); return Promise.resolve({ data: { id: payload.id } }); }
        if (payload) return Promise.resolve({ data: null });
        return Promise.resolve({ data: [...saved.values()].find(row => criteria.every(([key, value]) => row[key] === value)) || null });
      },
      then(resolve) {
        return Promise.resolve({ data: otherCoach ? [{ schedule_id: scheduleId, student_id: studentId, coach_id: "other" }] : [] }).then(resolve);
      },
    };
    return builder;
  } };
  const { POST } = load("app/api/coach-development/route.ts", {
    "@supabase/supabase-js": { createClient: () => db },
    "next/server": { NextResponse: { json: (body, options) => ({ body, status: options?.status || 200 }) } },
    "next/cache": { revalidatePath() {} },
    "@/lib/auth/profile": { requireProfile: async () => ({ id: "coach", organization_id: "org", base_role: "coach", is_active: true }) },
    "@/lib/attendance/roster": { attendanceRoster: () => ({ students: [{ id: studentId, status: "active" }] }) },
    "@/lib/attendance/coach-roster": scope,
    "@/lib/attendance/development-report": report,
    "@/lib/dashboard/cancellation-summary": { cancellationSummary: () => ({ studentIds: [] }) },
    "@/lib/notifications/attendance-eligibility": { loadAttendanceEligibility: async () => ({ cancellations: [] }) },
    "@/lib/personnel/sessions": {
      isLessonDate: () => true, sessionClock: () => ({ date: "2026-11-26" }),
      loadPersonnelSessions: async () => [{ id: scheduleId, group_id: "group", weekday: 4, coaches: new Map([["staff", "coach"]]) }],
    },
    "@/lib/guardian/note-sharing": { notifySharedNote: async (org, student, note, body, actor, options) => {
      assert.equal(options.developmentReport, true);
      calls += 1;
      if (calls === 1) throw new Error("temporary delivery failure");
      notifications.add(note);
      return { count: 1 };
    } },
  });
  return { submit: () => POST({ json: async () => form }), saved, notifications };
}

test("the server refuses a student allocated to another coach before creating the report", async () => {
  const flow = fixture(true);
  assert.equal((await flow.submit()).status, 403);
  assert.equal(flow.saved.size, 0);
});

test("a notification retry reuses the guardian-visible report and preserves its author", async () => {
  const flow = fixture(false);
  assert.deepEqual((await flow.submit()).body, { saved: true, notificationError: true });
  assert.deepEqual((await flow.submit()).body, { saved: true, recipientCount: 1 });
  assert.equal(flow.saved.size, 1);
  assert.equal(flow.saved.get(noteId).author_id, "coach");
  assert.equal(flow.saved.get(noteId).is_guardian_visible, true);
  assert.equal(flow.notifications.size, 1);
});
