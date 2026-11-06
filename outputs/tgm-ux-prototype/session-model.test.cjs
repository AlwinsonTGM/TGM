const assert = require('node:assert/strict');
const { createSessionStore } = require('./prototype.js');

const store = createSessionStore({
  'Functions practice': 'agy',
  'Objects practice': 'opencode'
});

const original = store.defaultFor('Functions practice');
original.lines.push({ text: 'AGY-only output', muted: false });
original.draft = 'unfinished AGY input';

const alternative = store.ensure('Functions practice', 'opencode');
assert.notEqual(alternative.id, original.id);
assert.equal(alternative.harness, 'opencode');
assert.deepEqual(alternative.lines, []);
assert.equal(alternative.draft, '');
alternative.lines.push({ text: 'OpenCode-only output', muted: true });
alternative.draft = 'unfinished OpenCode input';

assert.strictEqual(store.ensure('Functions practice', 'agy'), original);
assert.strictEqual(store.ensure('Functions practice', 'opencode'), alternative);
assert.equal(store.defaultFor('Functions practice').harness, 'agy');
assert.deepEqual(store.get(original.id).lines, [{ text: 'AGY-only output', muted: false }]);
assert.equal(store.get(original.id).draft, 'unfinished AGY input');
assert.deepEqual(store.get(alternative.id).lines, [{ text: 'OpenCode-only output', muted: true }]);
assert.equal(store.get(alternative.id).draft, 'unfinished OpenCode input');
assert.deepEqual(store.defaultFor('Objects practice').lines, []);
assert.throws(() => store.ensure('Unknown task', 'agy'), /Unknown sample session/);
assert.throws(() => store.ensure('Functions practice', 'unknown'), /Unknown sample session/);

console.log('PASS: harness bindings, separate histories and drafts, and reopening');
