'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { _electron } = require('playwright');

test('session states and resume results are reported honestly', async () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'tgm-session-fixture-'));
  const { createServer } = await import('vite');
  const server = await createServer({ configFile: false, root: path.resolve(__dirname, '..'), server: { host: '127.0.0.1', port: 0 } });
  let electronApp;
  try {
    await server.listen();
    const address = server.httpServer.address();
    electronApp = await _electron.launch({ executablePath: require('electron'), args: [path.resolve(__dirname, '../electron/main.cjs')], env: { ...process.env, NODE_ENV: 'test', TGM_TEST_USER_DATA: temp } });
    await electronApp.firstWindow();
    const pagePromise = electronApp.waitForEvent('window');
    await electronApp.evaluate(({ BrowserWindow }, url) => {
      const win = new BrowserWindow({ show: false, webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false } });
      win.loadURL(url);
    }, `http://127.0.0.1:${address.port}/tests/session-fixture.html`);
    const page = await pagePromise;
    page.setDefaultTimeout(5000);
    await page.getByText('Session continuation is not connected yet.').waitFor();
    await page.getByRole('button', { name: 'Fixture absent' }).click();
    await page.getByText('No previous session yet.').waitFor();
    await page.getByRole('button', { name: 'Fixture available' }).click();
    await page.getByText('Functions practice').waitFor();
    assert.equal(await page.getByText('OpenCode', { exact: true }).isVisible(), true);
    assert.equal(await page.getByText('TypeScript learning', { exact: true }).isVisible(), true);
    await page.getByRole('button', { name: 'Continue last session' }).click();
    await page.getByText('Opening session…').waitFor();
    assert.equal(await page.getByText('Session resumed.').count(), 0);
    assert.equal(await page.getByRole('button', { name: 'Opening session…' }).isDisabled(), true);
    assert.equal(await page.getByLabel('Resume calls').textContent(), '1');
    await page.getByRole('button', { name: 'Confirm failure' }).click();
    await page.getByText('Could not resume this session. Please try again.').waitFor();
    await page.getByRole('button', { name: 'Continue last session' }).click();
    await page.getByRole('button', { name: 'Confirm success' }).click();
    await page.getByText('Session resumed.').waitFor();
    await page.getByRole('button', { name: 'Fixture unavailable' }).click();
    await page.getByText('Session continuation is not connected yet.').waitFor();
    assert.equal(await page.getByText('Session resumed.').count(), 0);
    await page.getByRole('button', { name: 'Fixture available' }).click();
    await page.getByRole('button', { name: 'Continue last session' }).waitFor();
    await page.getByRole('button', { name: 'Continue last session' }).click();
    await page.getByRole('button', { name: 'Opening session…' }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Opening session…' }).isDisabled(), true);
    await page.getByRole('button', { name: 'Reject request' }).click();
    await page.getByText('Could not resume this session. Please try again.').waitFor();
    assert.equal(await page.getByText('Could not resume this session. Please try again.').isVisible(), true);
    await page.getByRole('button', { name: 'Continue last session' }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Continue last session' }).isEnabled(), true);
    await page.getByRole('button', { name: 'Continue last session' }).click();
    await page.getByRole('button', { name: 'Opening session…' }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Opening session…' }).isDisabled(), true);
    await page.getByRole('button', { name: 'Fixture absent' }).click();
    await page.getByText('No previous session yet.').waitFor();
    await page.getByRole('button', { name: 'Confirm success' }).click();
    await page.getByText('No previous session yet.').waitFor();
    assert.equal(await page.getByText('No previous session yet.').isVisible(), true);
    assert.equal(await page.getByText('Session resumed.').count(), 0);
  } finally {
    if (electronApp) await electronApp.close();
    await server.close();
    const realRoot = fs.realpathSync(os.tmpdir());
    const realTemp = fs.realpathSync(temp);
    const rel = path.relative(realRoot, realTemp);
    if (!rel || rel.startsWith('..') || path.isAbsolute(rel) || !path.basename(realTemp).startsWith('tgm-session-fixture-')) {
      throw new Error(`Refusing to remove unsafe temp path: ${realTemp}`);
    }
    fs.rmSync(realTemp, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  }
});
