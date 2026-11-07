const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { app } = require('electron');

if (process.env.TGM_TEST_USER_DATA) app.setPath('userData', process.env.TGM_TEST_USER_DATA);
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'tgm-harness-test-'));
const opencode = path.join(directory, 'opencode.cmd');
const agy = path.join(directory, 'agy.exe');
process.env.PATH = `"${directory}"`;

async function waitFor(window, expected) {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    const value = await window.webContents.executeJavaScript("document.getElementById('harness-availability').textContent");
    if (value.includes(expected)) return value;
    await new Promise(resolve => setTimeout(resolve, 25));
  }
  throw new Error(`Timed out waiting for: ${expected}`);
}

app.on('browser-window-created', (_, window) => {
  window.hide();
  window.webContents.once('did-finish-load', async () => {
    let failed = false;
    try {
      await waitFor(window, 'Not found');
      fs.writeFileSync(opencode, '');
      await window.webContents.executeJavaScript("document.getElementById('check-harness').click()");
      await waitFor(window, 'Found on');
      await window.webContents.executeJavaScript("document.getElementById('harness').value = 'agy'; document.getElementById('harness').dispatchEvent(new Event('change'))");
      await waitFor(window, 'Not found');
      fs.writeFileSync(agy, '');
      await window.webContents.executeJavaScript("document.getElementById('check-harness').click()");
      await waitFor(window, 'Found on');
      const invalidRejected = await window.webContents.executeJavaScript("window.terminalBridge.checkHarness('__proto__').then(() => false, () => true)");
      assert.equal(invalidRejected, true);
      console.log('PASS: harness PATH check, selection, retry, and invalid request');
    } catch (error) {
      failed = true;
      console.error(error);
    } finally {
      window.destroy();
      for (const file of [opencode, agy]) if (fs.existsSync(file)) fs.unlinkSync(file);
      fs.rmdirSync(directory);
      app.exit(failed ? 1 : 0);
    }
  });
});
require('../main.cjs');
