const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function loadModule(path, destination = 'AW-123456/test_label') {
  const scripts = [];
  const context = {
    exports: {}, process: { env: { NEXT_PUBLIC_GOOGLE_ADS_PRE_REGISTRATION_SEND_TO: destination } },
    window: {}, document: { createElement: () => ({}), head: { appendChild: script => scripts.push(script) } },
  };
  const code = ts.transpileModule(fs.readFileSync(path, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
  }).outputText;
  vm.runInNewContext(code, context);
  return { api: context.exports, context, scripts };
}
const success = { ok: true, studentId: '12345678-1234-1234-1234-123456789abc' };
const conversions = context => (context.window.dataLayer || []).filter(item => item[0] === 'event');

test('missing or malformed destinations cannot load a tag or report', () => {
  for (const destination of ['', 'G-FAKE', '7555291365', 'AW-123/<script>']) {
    const { api, scripts } = loadModule('lib/pre-registration-conversion.ts', destination);
    api.enableRegistrationMeasurement();
    assert.equal(api.reportSuccessfulRegistration(success, true), false);
    assert.equal(scripts.length, 0);
  }
});
test('declined consent, errors and bot successes produce no conversion', () => {
  const { api, context, scripts } = loadModule('lib/pre-registration-conversion.ts');
  assert.equal(api.reportSuccessfulRegistration(success, false), false);
  for (const result of [null, {}, { ok: true }, { ok: false, studentId: success.studentId }, { ok: true, studentId: 'invalid' }]) {
    assert.equal(api.reportSuccessfulRegistration(result, true), false);
  }
  assert.equal(scripts.length, 0);
  assert.equal(conversions(context).length, 0);
});
test('server-confirmed success emits once per registration without personal fields', () => {
  const { api, context, scripts } = loadModule('lib/pre-registration-conversion.ts');
  assert.equal(api.reportSuccessfulRegistration({ ...success, phone: 'PRIVATE', health_note: 'PRIVATE' }, true), true);
  assert.equal(api.reportSuccessfulRegistration(success, true), false);
  assert.equal(api.reportSuccessfulRegistration({ ...success, studentId: '22345678-1234-1234-1234-123456789abc' }, true), true);
  const events = conversions(context);
  assert.equal(events.length, 2);
  assert.equal(scripts.length, 1);
  assert.equal(events[0][2].send_to, 'AW-123456/test_label');
  assert.equal(events[0][2].transaction_id, `pre-registration-${success.studentId}`);
  assert.deepEqual(Object.keys(events[0][2]).sort(), ['send_to', 'transaction_id']);
});
test('consent defaults precede tag config and withdrawal can be reapplied', () => {
  const { api, context, scripts } = loadModule('lib/pre-registration-conversion.ts');
  api.enableRegistrationMeasurement();
  const commands = context.window.dataLayer;
  assert.equal(commands[0][0], 'consent');
  assert.equal(commands[0][1], 'default');
  assert.equal(commands[0][2].ad_storage, 'denied');
  assert.equal(commands[1][2].ad_personalization, 'denied');
  api.disableRegistrationMeasurement();
  assert.equal(commands.at(-1)[2].ad_storage, 'denied');
  api.enableRegistrationMeasurement();
  assert.equal(commands.at(-1)[2].ad_storage, 'granted');
  assert.equal(scripts.length, 1);
});
test('UTM candidates remain explicitly unverified and cannot inject fields', () => {
  const { api } = loadModule('lib/pre-registration-attribution.ts');
  assert.equal(api.sanitizeRegistrationAttribution(null), null);
  assert.equal(api.sanitizeRegistrationAttribution({}), null);
  const result = api.sanitizeRegistrationAttribution({ source: ' GOOGLE ', medium: 'CPC', campaign: 'x'.repeat(500), verified: true, gclid: 'secret' });
  assert.equal(result.channel, 'google_ads_utm');
  assert.equal(result.verification, 'visitor_declared');
  assert.equal(result.campaign.length, 120);
  assert.equal(result.gclid, undefined);
  assert.equal(result.verified, undefined);
  assert.equal(api.sanitizeRegistrationAttribution({ source: 'google', medium: 'organic' }).channel, 'other_utm');
});
