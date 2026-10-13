const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");
const mod = { exports: {} };
new Function("module", "exports", ts.transpileModule(fs.readFileSync("lib/dashboard/attendance-followup.ts", "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
}).outputText)(mod, mod.exports);
const { partitionAttendance, validFollowup } = mod.exports;
const slot = { date: "2026-10-04", branchId: "11111111-1111-1111-1111-111111111111", time: "19:00", missingCount: 3 };
test("closure survives a fresh server read and only hides its exact date, branch and time", () => {
  const other = {...slot, time: "20:00"};
  for (const status of ["completed", "removed"]) {
    const fresh = partitionAttendance([slot, other], [{...slot, time: "19:00:00", status}]);
    assert.deepEqual(fresh.pending, [other]);
    assert.equal(fresh.closed[0].status, status);
    assert.equal(slot.missingCount, 3);
  }
});
test("undo restores pending tracking and fully saved attendance produces no stale closed card", () => {
  assert.equal(partitionAttendance([slot], [{...slot, status:"open"}]).pending.length, 1);
  assert.deepEqual(partitionAttendance([], [{...slot, status:"completed"}]), {pending:[],closed:[]});
});
test("mutations accept only valid past dates in history window, UUID branches, clock times and known statuses", () => {
  const body = {...slot,status:"removed"};
  const valid = value => validFollowup(value, "2026-10-14", "2026-07-16");
  assert.equal(valid(body), true);
  for (const change of [{date:"2026-10-14"}, {date:"2026-10-15"}, {date:"2026-07-15"}, {date:"2026-09-31"}, {branchId:"other"}, {time:"24:00"}, {time:"19:60"}, {status:"deleted"}]) assert.equal(valid({...body,...change}), false);
  assert.equal(valid(null), false);
});
