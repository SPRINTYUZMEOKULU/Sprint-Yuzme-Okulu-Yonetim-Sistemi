const assert = require("node:assert/strict");
const test = require("node:test");
const ts = require("typescript");
const { readFileSync } = require("node:fs");

function load(path, imports = {}) {
  const { outputText } = ts.transpileModule(readFileSync(path, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  });
  const module = { exports: {} };
  new Function("require", "module", "exports", outputText)(
    name => name in imports ? imports[name] : require(name), module, module.exports,
  );
  return module.exports;
}

const id = "00000000-0000-0000-0000-000000000001";
const org = "00000000-0000-0000-0000-000000000002";
const guardian = "00000000-0000-0000-0000-000000000003";
const another = "00000000-0000-0000-0000-000000000004";
const invoice = load("lib/payments/guardian-invoices.ts", { "server-only": {}, "./document-admin": {} });
const reference = `${invoice.invoicePrefix(guardian, org)}${id}/${id}.pdf`;

test("Only a private PDF reference scoped to this organization and request is accepted", () => {
  assert.equal(invoice.invoiceObject(reference, org, id).recipient, guardian);
  assert.equal(invoice.invoiceObject(reference, another, id), null);
  assert.equal(invoice.invoiceObject(reference, org, another), null);
  assert.equal(invoice.invoiceObject("https://example.test/invoice.pdf", org, id), null);
});

test("PDF display and download are limited to the designated linked guardian", async () => {
  const calls = [];
  let allowed = [id];
  let profileId = guardian;
  const query = {
    select: () => query,
    eq: (key, value) => { calls.push([key, value]); return query; },
    in: (key, value) => { calls.push([key, value]); return query; },
    not: () => query,
    maybeSingle: async () => ({ data: { document_pdf_url: reference } }),
  };
  const route = load("app/veli-odemeler/belge/[id]/route.ts", {
    "@/lib/auth/profile": { requireProfile: async roles => {
      assert.deepEqual(roles, ["guardian"]);
      return { id: profileId, organization_id: org };
    } },
    "@/lib/guardian/access": { guardianStudentAccess: async () => ({ studentIds: allowed }) },
    "@/lib/payments/document-admin": { documentAdmin: () => ({ from: () => query }) },
    "@/lib/payments/guardian-invoices": { ...invoice, invoicePdfResponse: (path, download) =>
      new Response(path, { headers: { "X-Test-Download": String(download) } }) },
  });
  const open = suffix => route.GET(new Request(`https://portal.test/file${suffix}`), { params: Promise.resolve({ id }) });
  assert.equal((await open("")).headers.get("X-Test-Download"), "false");
  assert.equal((await open("?download=1")).headers.get("X-Test-Download"), "true");
  assert.deepEqual(calls.slice(0, 4), [["organization_id", org], ["id", id], ["student_id", [id]], ["status", invoice.issuedStatuses]]);
  profileId = another;
  assert.equal((await open("")).status, 404);
  allowed = [];
  profileId = guardian;
  assert.equal((await open("")).status, 404);
});
