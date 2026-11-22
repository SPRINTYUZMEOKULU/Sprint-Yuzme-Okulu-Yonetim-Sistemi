const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");
const { JSDOM } = require("jsdom");
const ts = require("typescript");

test("the finance click handler leaves the secure payment link available for navigation", () => {
  const { window } = new JSDOM();
  const document = window.document;
  const opened = [];
  const runEffect = (effect) => effect();
  const source = fs.readFileSync("app/ogrenciler/[id]/student-finance-center.tsx", "utf8");
  const effect = source.match(/useEffect\(\(\) => \{\s*const onClick[\s\S]*?\}, \[studentId\]\);/)[0];
  const { outputText } = ts.transpileModule(effect, {
    compilerOptions: { target: ts.ScriptTarget.ES2020 },
  });
  new Function("document", "useEffect", "show", "studentId", outputText)(
    document, runEffect, (tab) => opened.push(tab), "student",
  );

  document.body.innerHTML = `
    <div class="fileCommandActions">
      <a href="/odeme-bilgileri?studentId=student&mode=secure"><b>Güvenli Ödeme</b></a>
      <button data-student-finance-action="payment">Ödeme Al</button>
      <button data-student-finance-action="history">Ödeme Geçmişi</button>
    </div>
    <a data-student-finance-action="due" href="#odeme"><em>İşlemi Aç</em></a>
    <a data-student-finance-action="debt" href="#odeme">Ek borç</a>
  `;
  const click = (selector) => document.querySelector(selector).dispatchEvent(
    new window.MouseEvent("click", { bubbles: true, cancelable: true }),
  );

  assert.equal(click("a b"), true);
  assert.deepEqual(opened, []);
  assert.equal(click("button:nth-child(2)"), false);
  assert.equal(click("button:nth-child(3)"), false);
  assert.equal(click("a em"), false);
  assert.equal(click('a[data-student-finance-action="debt"]'), false);
  assert.deepEqual(opened, ["payment", "history", "due", "debt"]);
  window.close();
});

test("student file debt includes partial package and extra balances and respects local due dates", () => {
  const source = fs.readFileSync("lib/payments/student-open-debt.ts", "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  });
  const exports = {};
  new Function("exports", outputText)(exports);
  const { summarizeStudentDebt } = exports;
  const extra = { amount: 500, paid_amount: 200, status: "partial", due_date: "2026-11-22" };
  const paid = { ...extra, status: "paid" };
  const cancelled = { ...extra, status: "cancelled" };
  const packageInstallment = { ...extra, obligation_type: "installment", title: "Paket ücreti 1" };
  const partial = { remainingPayment: 1200, paymentDueDate: "2026-11-24" };
  assert.deepEqual(summarizeStudentDebt(partial, [extra, paid, cancelled, packageInstallment], "2026-11-22"), {
    packageDebt: 1200, extraDebt: 300, totalDebt: 1500, dueDate: "2026-11-22", overdue: false,
  });
  assert.equal(summarizeStudentDebt(null, [extra], "2026-11-23").overdue, true);
  assert.equal(summarizeStudentDebt({ remainingPayment: 200, paymentDueDate: null }, [], "2026-11-22").totalDebt, 200);
  assert.equal(summarizeStudentDebt(null, [paid, cancelled], "2026-11-22").totalDebt, 0);
});

test("A direct payment link and a guardian portal payment each render a working return link", async () => {
  const source = fs.readFileSync("app/odeme-belge/[token]/page.tsx", "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  });
  const query = {
    select: () => query,
    eq: () => query,
    maybeSingle: async () => ({ data: { status: "cancelled" } }),
  };
  const imports = {
    "@supabase/supabase-js": { createClient: () => ({ from: () => query }) },
    "@/lib/payments/document-state": { publicDocumentState: () => "cancelled" },
    "./copy-iban": {},
    "./customer-document-form": {},
    "./document-details-toggle": {},
    "./style.css": {},
  };
  const exports = {};
  new Function("require", "exports", outputText)(
    name => name in imports ? imports[name] : require(name), exports,
  );
  const { renderToStaticMarkup } = require("react-dom/server");
  for (const [searchParams, href] of [
    [{}, "https://wa.me/905518968319"],
    [{ kaynak: "veli" }, "/veli-odemeler#guvenli-odeme"],
    [{ kaynak: "https://example.com" }, "https://wa.me/905518968319"],
  ]) {
    const page = await exports.default({
      params: Promise.resolve({ token: "test-token" }),
      searchParams: Promise.resolve(searchParams),
    });
    const { window } = new JSDOM(renderToStaticMarkup(page));
    const link = window.document.querySelector("nav a");
    assert.equal(link.getAttribute("href"), href);
    if (href.startsWith("https:")) assert.equal(link.getAttribute("rel"), "noreferrer");
    window.close();
  }
});
