'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { _electron } = require('playwright');

function temporaryDirectory(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tgm-terminal-ui-'));
  t.after(() => {
    const root = fs.realpathSync(os.tmpdir());
    const target = fs.realpathSync(dir);
    if (path.dirname(target) !== root || !path.basename(target).startsWith('tgm-terminal-ui-')) {
      throw new Error(`Refusing to remove unexpected directory: ${target}`);
    }
    fs.rmSync(target, { recursive: true, force: true, maxRetries: 5, retryDelay: 150 });
  });
  return dir;
}

function processExists(pid) {
  const output = execFileSync('tasklist.exe', ['/fi', `PID eq ${pid}`, '/fo', 'csv', '/nh'], {
    encoding: 'utf8', windowsHide: true,
  });
  return output.includes(`"${pid}"`);
}

async function waitForExit(pid) {
  const deadline = Date.now() + 10000;
  while (processExists(pid) && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 100));
  assert.equal(processExists(pid), false, `Terminal process ${pid} should be stopped`);
}

async function waitForMain(app, predicate) {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    if (await app.evaluate(predicate)) return;
    await new Promise(resolve => setTimeout(resolve, 25));
  }
  throw new Error('Timed out waiting for the expected main-process state');
}

test('Workspace terminal validates settings and runs, resizes, stops, and closes safely', { timeout: 60000 }, async t => {
  if (process.platform !== 'win32') return t.skip('The terminal foundation currently targets Windows');
  const dir = temporaryDirectory(t);
  const binaryDir = path.join(dir, 'fixture bin');
  fs.mkdirSync(binaryDir);
  fs.writeFileSync(path.join(binaryDir, 'agy.exe'), 'disposable test fixture');
  // The selected project contains same-named decoys, which must not be launched.
  fs.writeFileSync(path.join(dir, 'agy.exe'), 'project decoy');
  fs.writeFileSync(path.join(dir, 'opencode.cmd'), '@echo project decoy');
  const testEnv = { ...process.env, NODE_ENV: 'test', TGM_TEST_USER_DATA: dir };
  const pathKey = Object.keys(testEnv).find(key => key.toLowerCase() === 'path') || 'PATH';
  testEnv[pathKey] = [binaryDir, path.dirname(process.execPath), path.join(process.env.SystemRoot, 'System32')].join(path.delimiter);
  let app;
  const ptyPath = require.resolve('node-pty');
  try {
    app = await _electron.launch({
      executablePath: require('electron'),
      args: [path.resolve(__dirname, '../electron/main.cjs')],
      env: testEnv,
    });
    const page = await app.firstWindow();

    // Test-only monkeypatch: preserve the fixed production harness request, but
    // run a disposable shell so this test never launches a model or service.
    await app.evaluate(({ dialog }, { ptyPath, dir }) => {
      const pty = process.getBuiltinModule('module').createRequire(ptyPath)(ptyPath);
      const spawn = pty.spawn;
      globalThis.terminalInvocations = [];
      globalThis.stopChoice = 0;
      globalThis.draftChoice = 0;
      globalThis.stopPrompts = 0;
      globalThis.draftPrompts = 0;
      pty.spawn = (command, args, options) => {
        const child = spawn(process.env.ComSpec || 'cmd.exe', ['/d', '/q'], options);
        globalThis.terminalInvocations.push({ command, args, cwd: options.cwd, pid: child.pid });
        return child;
      };
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [dir] });
      dialog.showMessageBox = async () => { globalThis.stopPrompts++; return { response: globalThis.stopChoice }; };
      dialog.showMessageBoxSync = () => { globalThis.draftPrompts++; return globalThis.draftChoice; };
    }, { ptyPath, dir });

    await page.getByLabel('Capture a thought').fill('A Home draft that must survive');
    await page.getByRole('button', { name: 'Workspace', exact: true }).click();
    assert.equal(await page.getByRole('button', { name: 'Start terminal', exact: true }).isDisabled(), true);
    for (const settings of [
      { harness: 'not-a-harness', cwd: dir, cols: 80, rows: 24 },
      { harness: 'agy', cwd: 'relative', cols: 80, rows: 24 },
      { harness: 'agy', cwd: dir, cols: 0, rows: 24 },
      { harness: 'opencode', cwd: dir, cols: 80, rows: 24 },
    ]) {
      await assert.rejects(page.evaluate(settings => window.terminalBridge.start(settings), settings));
    }
    assert.equal((await app.evaluate(() => globalThis.terminalInvocations)).length, 0);

    await page.getByRole('button', { name: 'Choose folder', exact: true }).click();
    await page.getByText(/Not found on TGM’s PATH/).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Start terminal', exact: true }).isDisabled(), true);
    fs.writeFileSync(path.join(binaryDir, 'opencode.cmd'), '@echo fixture');
    await page.getByLabel('Harness').selectOption('agy');
    await page.getByRole('button', { name: 'Start terminal', exact: true }).click();
    await page.getByText('Running', { exact: true }).waitFor();
    const first = (await app.evaluate(() => globalThis.terminalInvocations))[0];
    assert.equal(path.resolve(first.command).toLowerCase(), path.join(binaryDir, 'agy.exe').toLowerCase());
    assert.deepEqual(first.args, []);
    assert.equal(path.resolve(first.cwd), path.resolve(dir));

    await page.getByRole('button', { name: 'Home', exact: true }).click();
    await page.getByRole('button', { name: 'Add goal', exact: true }).click();
    await page.locator('#goal-title').fill('Second task');
    await page.locator('#goal-step').fill('Next step');
    await page.getByRole('button', { name: 'Save goal', exact: true }).click();
    await page.getByRole('button', { name: 'Start Second task' }).click();
    await page.getByText(/A terminal session is running/).waitFor();
    assert.equal(processExists(first.pid), true);
    assert.equal(await page.getByText('How would you like to work?').count(), 0);
    await page.getByRole('button', { name: 'Open Workspace' }).click();
    assert.equal(await page.getByText('Running', { exact: true }).isVisible(), true);

    await page.evaluate(() => {
      window.testTerminalOutput = '';
      window.terminalBridge.onData(data => { window.testTerminalOutput += data; });
    });
    const terminalInput = page.locator('[aria-label="Interactive terminal"] .xterm-helper-textarea');
    await terminalInput.focus();
    await page.keyboard.type('node -p "[\'TGM\',\'UI\',\'MARKER\'].join(\'_\')"');
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => window.testTerminalOutput.includes('TGM_UI_MARKER'));
    await page.evaluate(() => window.terminalBridge.resize(101, 35));
    await page.keyboard.type('node -p "process.stdout.columns+\'x\'+process.stdout.rows"');
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => window.testTerminalOutput.includes('101x35'));

    await page.getByRole('button', { name: 'Stop session', exact: true }).click();
    assert.equal(await app.evaluate(() => globalThis.stopPrompts), 1);
    assert.equal(processExists(first.pid), true, 'Cancelling Stop should keep the terminal alive');
    await page.evaluate(() => window.terminalBridge.write('node -p "[\'TGM\',\'STOP\',\'CANCEL\'].join(\'_\')"\r'));
    await page.waitForFunction(() => window.testTerminalOutput.includes('TGM_STOP_CANCEL'));
    await app.evaluate(() => { globalThis.stopChoice = 1; });
    await page.getByRole('button', { name: 'Stop session', exact: true }).click();
    await waitForExit(first.pid);
    await page.getByText('Stopped', { exact: true }).waitFor();

    await page.getByRole('button', { name: 'Home', exact: true }).first().click();
    await page.getByRole('button', { name: 'Start Second task' }).click();
    await page.getByRole('button', { name: 'OpenCode', exact: true }).click();
    await page.getByRole('button', { name: 'Start terminal', exact: true }).click();
    await page.getByText('Running', { exact: true }).waitFor();
    const invocations = await app.evaluate(() => globalThis.terminalInvocations);
    const second = invocations[1];
    assert.ok(second, 'Expected the second session to start');
    assert.equal(path.isAbsolute(second.command), true);
    assert.equal(path.basename(second.command).toLowerCase(), 'cmd.exe');
    assert.equal(second.args, `/d /v:off /s /c ""${path.join(binaryDir, 'opencode.cmd')}" --standalone"`);
    assert.equal(processExists(second.pid), true);
    await page.getByRole('button', { name: 'Complete step' }).click();
    await page.locator('.workspace').getByText('Step completed. Your terminal session is still running.').waitFor();
    assert.equal(processExists(second.pid), true, 'Completing a step must not stop the terminal');

    await app.evaluate(() => { globalThis.stopChoice = 0; });
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].close());
    await waitForMain(app, () => globalThis.stopPrompts >= 3);
    assert.equal(processExists(second.pid), true, 'Cancelling the stop confirmation should keep the terminal alive');
    assert.equal(await app.evaluate(() => globalThis.draftPrompts), 0);

    await app.evaluate(() => { globalThis.stopChoice = 1; globalThis.draftChoice = 0; });
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].close());
    await waitForMain(app, () => globalThis.draftPrompts >= 1);
    assert.equal(await app.evaluate(() => globalThis.draftPrompts), 1);
    assert.equal(processExists(second.pid), true, 'Cancelling the draft confirmation should keep the terminal alive');
    await page.evaluate(() => window.terminalBridge.write('node -p "[\'TGM\',\'DRAFT\',\'CANCEL\'].join(\'_\')"\r'));
    await page.waitForFunction(() => window.testTerminalOutput.includes('TGM_DRAFT_CANCEL'));
    await page.getByRole('button', { name: 'Home', exact: true }).click();
    assert.equal(await page.getByLabel('Capture a thought').inputValue(), 'A Home draft that must survive');

    await app.evaluate(() => { globalThis.stopChoice = 1; globalThis.draftChoice = 1; });
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].close());
    await waitForExit(second.pid);
    await app.close(); app = null;
  } finally {
    if (app) {
      try { await app.evaluate(({ dialog }) => { dialog.showMessageBox = async () => ({ response: 1 }); dialog.showMessageBoxSync = () => 1; }); } catch {}
      try { await app.close(); } catch {}
    }
  }
});
