'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { _electron } = require('playwright');

for (const [name, selector] of [
  ['quick capture', '#capture-input'],
  ['new goal title', '#goal-title'],
  ['new goal first step', '#goal-step'],
]) {
  test(`closing the window protects an unsaved ${name}`, async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tgm-draft-'));
    let app;
    try {
      app = await _electron.launch({
        executablePath: require('electron'),
        args: [path.resolve(__dirname, '../electron/main.cjs')],
        env: { ...process.env, NODE_ENV: 'test', TGM_TEST_USER_DATA: dir },
      });
      const page = await app.firstWindow();
      await page.locator(selector).fill('Draft to keep');
      await app.evaluate(({ dialog }) => {
        globalThis.testDraftPrompts = 0;
        dialog.showMessageBoxSync = () => { globalThis.testDraftPrompts++; return 0; };
      });
      await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].close());
      await page.waitForFunction((id) => document.querySelector(id)?.value === 'Draft to keep', selector);
      assert.equal(await app.evaluate(() => globalThis.testDraftPrompts), 1);
      assert.equal(await page.locator(selector).inputValue(), 'Draft to keep');

      // Clearing the draft must allow closing without another confirmation.
      await page.locator(selector).fill('');
      const closed = page.waitForEvent('close', { timeout: 5000 });
      await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].close());
      await closed;
    } finally {
      if (app) {
        try { await app.evaluate(({ dialog }) => { dialog.showMessageBoxSync = () => 1; }); } catch {}
        try { await app.close(); } catch {}
      }
      const root = fs.realpathSync(os.tmpdir());
      const target = fs.realpathSync(dir);
      const relative = path.relative(root, target);
      if (!relative || relative.startsWith('..') || path.isAbsolute(relative) ||
          !path.basename(target).startsWith('tgm-draft-')) throw new Error('Unsafe temporary directory');
      fs.rmSync(target, { recursive: true, force: true, maxRetries: 5, retryDelay: 150 });
    }
  });
}
