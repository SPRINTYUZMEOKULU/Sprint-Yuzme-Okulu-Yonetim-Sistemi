const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const ts = require("typescript");

const moduleValue = { exports: {} };
const js = ts.transpileModule(readFileSync("app/veli-paneli/lesson-balance.tsx", "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
new Function("require", "module", "exports", js)(
  name => name.endsWith(".css") ? {} : name === "next/link"
    ? { default: ({ href, children }) => React.createElement("a", { href }, children) }
    : require(name),
  moduleValue, moduleValue.exports,
);

function render(normal, makeup, ready = true, options = {}) {
  return renderToStaticMarkup(React.createElement(moduleValue.exports.default, {
    normal, makeup, ready, attendanceUrl: "/veli-devam", requestUrl: "/veli-talepleri", ...options,
  }));
}

test("Lesson balance shows two distinct counters and a total", () => {
  assert.match(render(8, 3), /<strong>11<\/strong>/);
  assert.match(render(8, 3), /<dt>Normal ders<\/dt><dd>8<\/dd>/);
  assert.match(render(8, 3), /<dt>Telafi dersi<\/dt><dd>3<\/dd>/);
});

test("Warnings escalate and two exhausted balances display as zeros", () => {
  assert.match(render(2, 0), /data-tone="warning".*Son 2 normal dersiniz kaldı/);
  assert.match(render(1, 3), /data-tone="critical".*Son 1 normal dersiniz kaldı/);
  assert.match(render(0, 3), /Normal ders hakkınız bitti. 3 telafi hakkınız var/);
  assert.match(render(0, 0), /<dd>0<\/dd>.*<dd>0<\/dd>.*Kayıt yenileme için yönetime yaz/);
});

test("Unverified balances display placeholders without a renewal warning", () => {
  assert.match(render(0, 0, false), /<dd>—<\/dd>.*<dd>—<\/dd>.*Ders hakları şu anda doğrulanamadı/);
  assert.doesNotMatch(render(0, 0, false), /Kalan ders hakkınız bitti/);
});

test("Management balance keeps the live counters and opens the staff lesson workflow", () => {
  const markup = render(0, 3, true, {
    attendanceUrl: "/ogrenciler/student#ders-hareketleri",
    attendanceLabel: "Ders hakları ve telafiyi yönet",
    showRequestLink: false,
  });
  assert.match(markup, /<strong>3<\/strong>/);
  assert.match(markup, /href="\/ogrenciler\/student#ders-hareketleri"/);
  assert.doesNotMatch(markup, /href="\/veli-talepleri"/);
});
