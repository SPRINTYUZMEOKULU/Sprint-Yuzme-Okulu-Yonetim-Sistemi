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
  `;
  const click = (selector) => document.querySelector(selector).dispatchEvent(
    new window.MouseEvent("click", { bubbles: true, cancelable: true }),
  );

  assert.equal(click("a b"), true);
  assert.deepEqual(opened, []);
  assert.equal(click("button:nth-child(2)"), false);
  assert.equal(click("button:nth-child(3)"), false);
  assert.equal(click("a em"), false);
  assert.deepEqual(opened, ["payment", "history", "due"]);
  window.close();
});

test("settled payment alerts do not hide the pending registration alert", () => {
  const { window } = new JSDOM(`
    <header class="smartAlertHead"><strong></strong></header>
    <div class="smartAlertGrid">
      <a href="/kayit-tamamlama/student">Paket, ders programı ve ödeme bilgilerini tamamlayın.</a>
      <a href="#odeme">Henüz ödeme kaydı yok</a>
    </div>
  `);
  const source = fs.readFileSync("app/ogrenciler/[id]/general-info-summary.tsx", "utf8");
  const start = source.indexOf("function syncAlertCount()");
  const end = source.indexOf("export default function GeneralInfoSummary");
  const { outputText } = ts.transpileModule(source.slice(start, end), {
    compilerOptions: { target: ts.ScriptTarget.ES2020 },
  });
  const normalizeAlert = new Function("document", outputText + "\nreturn normalizePaymentAlert;")(window.document);
  normalizeAlert({ remaining: 0, overdue: false, statusMessage: "" });
  assert.equal(window.document.querySelector('a[href="#odeme"]').style.display, "none");
  assert.equal(window.document.querySelector('a[href^="/kayit-tamamlama"]').style.display, "");
  window.close();
});
