'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { _electron } = require('playwright');

const entry = path.resolve(__dirname, '../electron/main.cjs');
const preload = path.resolve(__dirname, '../electron/preload.cjs');
const pageFile = path.resolve(__dirname, '../dist/index.html');

async function launch(userData) {
  return _electron.launch({
    executablePath: require('electron'),
    args: [entry],
    env: { ...process.env, NODE_ENV: 'test', TGM_TEST_USER_DATA: userData },
  });
}

test('Home bridge persists captures and rejects other windows', async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'tgm-host-test-'));
  t.after(() => {
    const root = fs.realpathSync(os.tmpdir());
    const target = fs.realpathSync(directory);
    const relative = path.relative(root, target);
    if (!relative || relative.startsWith('..') || path.isAbsolute(relative) ||
        !path.basename(target).startsWith('tgm-host-test-')) throw new Error('Unsafe test directory');
    fs.rmSync(target, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  });

  let instance;
  try {
    instance = await launch(directory);
    const page = await instance.firstWindow();
    const saved = await page.evaluate(() => window.tgm.saveCapture('Remember this thought'));
    assert.equal(saved.text, 'Remember this thought');
    await assert.rejects(page.evaluate(() => window.tgm.saveCapture('   ')), /empty/i);

    const otherPagePromise = instance.waitForEvent('window');
    await instance.evaluate(({ BrowserWindow }, { preload, pageFile }) => {
      const win = new BrowserWindow({ show: false, webPreferences: { preload, sandbox: true, contextIsolation: true, nodeIntegration: false } });
      win.loadFile(pageFile);
    }, { preload, pageFile });
    const otherPage = await otherPagePromise;
    await otherPage.waitForLoadState('domcontentloaded');
    await assert.rejects(otherPage.evaluate(() => window.tgm.listCaptures()), /Unauthorized IPC sender/);
    await otherPage.close();
    await instance.close();
    instance = null;

    instance = await launch(directory);
    const reopened = await instance.firstWindow();
    const captures = await reopened.evaluate(() => window.tgm.listCaptures());
    assert.ok(captures.some(capture => capture.text === 'Remember this thought'));
  } finally {
    if (instance) await instance.close();
  }
});
