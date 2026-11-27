const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { JSDOM } = require("jsdom");
const ts = require("typescript");

test("manager preview keeps the exact seance scope and separates payroll month from lesson date", async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: "https://sprintos.invalid" });
  const restore = ["window", "document", "fetch", "IS_REACT_ACT_ENVIRONMENT"].map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]);
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const React = require("react");
  const { createRoot } = require("react-dom/client");
  const { act } = React;
  const calls = [];
  globalThis.fetch = async (href) => {
    const params = new URL(href, dom.window.location.href).searchParams;
    calls.push(Object.fromEntries(params));
    return { ok: true, json: async () => ({
      isManager: true, currentDate: "2026-11-27", date: params.get("date") || "2026-11-27",
      today: [{
        scheduleId: "session-id", staffId: "staff-id", branchId: "meltem", groupName: "VIP Çocuk",
        branchName: "Hasan Subaşı", assignmentRole: "coach", startTime: "20:00", endTime: "21:00",
        branchLocationConfigured: true, isMine: false, checkin: null, attendanceState: "partial",
      }],
      payroll: [{ staffId: "staff-id", payType: "per_lesson", lessonCount: 2, totalMinutes: 120, estimatedAmount: 900, paidAmount: 0 }],
      lessons: [],
    }) };
  };

  const moduleMock = { exports: {} };
  const imports = {
    react: React,
    "react/jsx-runtime": require("react/jsx-runtime"),
    "next/link": { default: (props) => React.createElement("a", props) },
    "@/lib/dates/display": { formatDisplayDate: (value) => value },
  };
  const js = ts.transpileModule(readFileSync("app/personel-puantaj/personel-puantaj-client.tsx", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  new Function("require", "module", "exports", js)((name) => imports[name], moduleMock, moduleMock.exports);

  const root = createRoot(document.getElementById("root"));
  const button = (label) => [...document.querySelectorAll("button")].find((element) => element.textContent === label);
  const paramsOf = (selector) => Object.fromEntries(new URL(document.querySelector(selector).href).searchParams);
  try {
    await act(async () => root.render(React.createElement(moduleMock.exports.default, {
      currentRole: "coach", coachHome: true, previewStaffId: "staff-id", initialDate: "2026-10-16",
    })));
    assert.equal(button("Konumu doğrula ve geldim"), undefined);
    assert.equal(document.querySelector(".ppAttendanceLink small").textContent, "Yoklama eksik");
    assert.deepEqual(paramsOf(".ppAttendanceLink"), {
      date: "2026-10-16", branchId: "meltem", time: "20:00", scheduleId: "session-id", personel: "staff-id",
    });
    assert.deepEqual(paramsOf(".ppAssignmentLink"), {
      tarih: "2026-10-16", seans: "session-id", sube: "meltem", saat: "20:00",
    });
    await act(async () => button("Puantaj ve ödemeler").click());
    assert.deepEqual(calls.at(-1), { date: "2026-11-01", personel: "staff-id" });
    assert.equal(document.querySelector(".ppPayrollSummary").textContent.includes("Onaylı ders2"), true);
    await act(async () => button("Ders programı").click());
    assert.equal(document.querySelector('input[type="date"]').value, "2026-10-16");
    await act(async () => document.querySelector('button[aria-label="Sonraki gün"]').click());
    assert.equal(paramsOf(".ppAttendanceLink").date, "2026-10-17");
  } finally {
    await act(async () => root.unmount());
    dom.window.close();
    for (const [key, descriptor] of restore) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  }
});
