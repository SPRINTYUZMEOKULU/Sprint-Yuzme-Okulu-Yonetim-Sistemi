const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const ts = require('typescript');
const source = ts.transpileModule(fs.readFileSync('lib/enrollment/dates.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const mod = { exports: {} };
new Function('module', 'exports', source)(mod, mod.exports);
const dates = mod.exports;

test('renewal preserves two selected days in a three-day group', () => {
  const days = dates.renewalWeekdays([2, 4], [2, 4, 6]);
  assert.deepEqual(days, [2, 4]);
  assert.equal(dates.calculatePackageEndDate('2026-10-13', 8, days), '2026-11-05');
  assert.equal(dates.calculatePackageEndDate('2026-10-13', 8, [2, 4, 6]), '2026-10-29');
});

test('missing or incompatible selected days stop renewal instead of changing it', () => {
  assert.throws(() => dates.renewalWeekdays([], [2, 4, 6]));
  assert.throws(() => dates.renewalWeekdays([3, 5], [2, 4, 6]));
});

test('Sunday aliases and year boundaries produce the correct final lesson', () => {
  assert.deepEqual(dates.renewalWeekdays([7], [0, 6]), [0]);
  assert.equal(dates.calculatePackageEndDate('2026-12-27', 2, [7]), '2027-01-03');
});

test('invalid calendar dates are rejected', () => {
  assert.equal(dates.isISODate('2026-02-30'), false);
  assert.equal(dates.isISODate('2028-02-29'), true);
  assert.throws(() => dates.calculatePackageEndDate('2026-02-30', 8, [2, 4]));
});

test('the final lesson remains valid on its date', () => {
  assert.equal(dates.enrollmentDateEnded('2026-10-13', '2026-10-13'), false);
  assert.equal(dates.enrollmentDateEnded('2026-10-12', '2026-10-13'), true);
  assert.equal(dates.enrollmentDateEnded('2026-10-14', '2026-10-13'), false);
});

test('Istanbul midnight is used for the renewal default', () => {
  assert.equal(dates.istanbulDate(new Date('2026-10-12T21:30:00Z')), '2026-10-13');
});
