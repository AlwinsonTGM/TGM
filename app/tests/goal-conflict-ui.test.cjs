'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { _electron } = require('playwright');

test('a conflicting external edit is preserved and the unsaved draft remains visible', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tgm-conflict-'));
  let app;
  try {
    app = await _electron.launch({
      executablePath: require('electron'),
      args: [path.resolve(__dirname, '../electron/main.cjs')],
      env: { ...process.env, NODE_ENV: 'test', TGM_TEST_USER_DATA: dir },
    });
    const page = await app.firstWindow();
    const form = page.getByRole('form', { name: 'Add a goal', exact: true });
    await form.getByLabel('Goal title', { exact: true }).fill('Original goal');
    await form.getByLabel('First next step (optional)', { exact: true }).fill('Original step');
    await form.getByRole('button', { name: 'Save goal', exact: true }).click();
    await page.getByRole('button', { name: 'Open Original step', exact: true }).click();
    const details = page.getByRole('form', { name: 'Goal and step details', exact: true });
    await details.getByLabel('Goal title', { exact: true }).fill('My unsaved goal');
    await details.getByLabel('Next step', { exact: true }).fill('My unsaved step');

    const external = new DatabaseSync(path.join(dir, 'captures.sqlite'));
    try { external.prepare('UPDATE steps SET text = ?').run('Other writer step'); } finally { external.close(); }
    await details.getByRole('button', { name: 'Save changes', exact: true }).click();
    await page.getByRole('alert').filter({ hasText: /changed elsewhere/i }).waitFor();
    assert.equal(await details.getByLabel('Goal title', { exact: true }).inputValue(), 'My unsaved goal');
    assert.equal(await details.getByLabel('Next step', { exact: true }).inputValue(), 'My unsaved step');
    const verify = new DatabaseSync(path.join(dir, 'captures.sqlite'), { readOnly: true });
    try {
      assert.equal(verify.prepare('SELECT title FROM goals').get().title, 'Original goal');
      assert.equal(verify.prepare('SELECT text FROM steps').get().text, 'Other writer step');
    } finally { verify.close(); }
  } finally {
    if (app) {
      // Test teardown discards the disposable draft after assertions have finished.
      try { await app.evaluate(({ dialog }) => { dialog.showMessageBoxSync = () => 1; }); } catch {}
      await app.close();
    }
    const rel = path.relative(fs.realpathSync(os.tmpdir()), fs.realpathSync(dir));
    if (!rel || rel.startsWith('..') || path.isAbsolute(rel) || !path.basename(rel).startsWith('tgm-conflict-')) throw new Error('Unsafe temporary directory');
    fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 150 });
  }
});
