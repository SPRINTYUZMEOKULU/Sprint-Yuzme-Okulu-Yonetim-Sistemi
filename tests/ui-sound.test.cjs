const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), ts = require('typescript');
const { JSDOM } = require('jsdom');
function setup({ blocked = false, suspended = false } = {}) {
  const dom = new JSDOM('<button id="ok"><span>Save</span></button><fieldset disabled><button id="disabled">No</button></fieldset><a href="/ayarlar" id="menu">Menu</a><input id="text"><div data-ui-sound="off"><button id="mute">Mute</button></div>', { url: 'https://example.test', pretendToBeVisual: true });
  global.window = dom.window; global.document = dom.window.document; global.Element = dom.window.Element; global.Event = dom.window.Event;
  global.localStorage = blocked ? { getItem() { throw Error(); }, setItem() { throw Error(); } } : dom.window.localStorage;
  let starts = 0, contexts = 0, resume;
  dom.window.AudioContext = class {
    constructor() { contexts++; this.state = suspended ? 'suspended' : 'running'; this.currentTime = 0; this.destination = {}; }
    resume() { return new Promise(resolve => { resume = () => { this.state = 'running'; resolve(); }; }); }
    createOscillator() { return { frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {}, disconnect() {}, start() { starts++; }, stop() {} }; }
    createGain() { return { gain: { setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {}, disconnect() {} }; }
  };
  const mod = { exports: {} };
  new Function('module', 'exports', ts.transpileModule(fs.readFileSync('lib/ui-sound.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText)(mod, mod.exports);
  return { s: mod.exports, dom, starts: () => starts, contexts: () => contexts, resume: () => resume() };
}
test('mute persists on reload and creates no audio context; zero volume is silent', async () => {
  const { s, contexts, dom } = setup();
  s.setUiSoundPreferences({ enabled: false, volume: .35 });
  assert.equal(await s.playUiClick(), false); assert.equal(contexts(), 0);
  assert.equal(dom.window.localStorage.getItem('sprintos-ui-sound-v1'), 'off');
  assert.equal(s.getUiSoundPreferences().enabled, false);
  s.setUiSoundPreferences({ enabled: true, volume: 0 });
  assert.equal(await s.playUiClick(), false); assert.equal(contexts(), 0);
});
test('mute works even when browser storage is unavailable', async () => {
  const { s, contexts } = setup({ blocked: true });
  s.setUiSoundPreferences({ enabled: false, volume: .35 });
  assert.equal(await s.playUiClick(), false); assert.equal(contexts(), 0);
});
test('nested menu targets work; disabled buttons, text fields and mute controls stay silent', () => {
  const { s } = setup();
  for (const selector of ['#ok span', '#menu']) assert.equal(s.isUiSoundTarget(document.querySelector(selector)), true);
  for (const selector of ['#disabled', '#text', '#mute']) assert.equal(s.isUiSoundTarget(document.querySelector(selector)), false);
});
test('rapid clicks are bounded and muting during Safari resume prevents delayed sound', async () => {
  let env = setup();
  assert.equal(await env.s.playUiClick(), true);
  assert.equal(await env.s.playUiClick(), false); assert.equal(env.starts(), 1); assert.equal(env.contexts(), 1);
  env = setup({ suspended: true });
  const pending = env.s.playUiClick();
  env.s.setUiSoundPreferences({ enabled: false, volume: .35 }); env.resume();
  assert.equal(await pending, false); assert.equal(env.starts(), 0);
});
