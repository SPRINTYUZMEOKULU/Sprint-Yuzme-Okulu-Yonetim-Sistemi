const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");

function setup({ duplicate = false, insertError = null } = {}) {
  const tasks = [];
  const rows = [];
  const pushes = [];
  const code = ts.transpileModule(fs.readFileSync("app/api/auth/support-request/route.ts", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  const mod = { exports: {} };
  const admin = {
    from(table) {
      const query = {
        select() { return query; },
        eq() { return query; },
        ilike() { return query; },
        gte() { return query; },
        limit() { return query; },
        in() { return query; },
        insert(entries) { rows.push(...entries); return query; },
        async maybeSingle() {
          if (table === "profiles") {
            return { data: { id: "account-1", organization_id: "org-1", full_name: "Kursiyer" } };
          }
          return { data: duplicate ? { id: "existing" } : null };
        },
        then(resolve) {
          return Promise.resolve(table === "profiles"
            ? { data: [{ id: "manager-1" }] }
            : { data: [{ id: "notification-1", recipient_profile_id: "manager-1" }], error: insertError }
          ).then(resolve);
        },
      };
      return query;
    },
  };
  new Function("module", "exports", "require", "process", "console", code)(
    mod, mod.exports, (name) => {
      if (name === "next/server") {
        return {
          after: (fn) => tasks.push(fn),
          NextResponse: { json: (body, options) => ({ body, status: options?.status ?? 200 }) },
        };
      }
      if (name === "@supabase/supabase-js") return { createClient: () => admin };
      if (name === "@/lib/notifications/create-notification") {
        return { deliverLoginSupportPush: async (targets) => pushes.push(...targets) };
      }
      throw new Error(name);
    },
    { env: { NEXT_PUBLIC_SUPABASE_URL: "https://test.invalid", SUPABASE_SERVICE_ROLE_KEY: "test" } },
    { error() {} },
  );
  const submit = () => mod.exports.POST({ json: async () => ({
    kind: "password",
    role: "guardian",
    method: "email",
    identifier: "someone@example.invalid",
    message: "Özel destek mesajı",
  }) });
  return { submit, rows, tasks, pushes };
}

test("login support persists the request before scheduling a privacy-safe push", async () => {
  const { submit, rows, tasks, pushes } = setup();
  assert.equal((await submit()).status, 200);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].recipient_profile_id, "manager-1");
  assert.equal(rows[0].push_requested, true);
  assert.match(rows[0].message, /Özel destek mesajı/);
  assert.equal(pushes.length, 0);
  assert.equal(tasks.length, 1);
  await tasks[0]();
  assert.equal(pushes.length, 1);
  assert.equal(pushes[0].profileId, "manager-1");
  assert.equal(pushes[0].notificationId, "notification-1");
  assert.equal(pushes[0].targetPath, "/bildirimler");
  assert.doesNotMatch(JSON.stringify(pushes), /someone@|Kursiyer|Özel destek mesajı/);
});

test("duplicate or unsuccessfully saved requests do not schedule pushes", async () => {
  const duplicate = setup({ duplicate: true });
  assert.equal((await duplicate.submit()).body.duplicate, true);
  assert.equal(duplicate.rows.length, 0);
  assert.equal(duplicate.tasks.length, 0);

  const failed = setup({ insertError: { message: "Write failed" } });
  assert.equal((await failed.submit()).status, 500);
  assert.equal(failed.tasks.length, 0);
});
