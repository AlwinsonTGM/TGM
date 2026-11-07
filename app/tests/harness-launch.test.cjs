'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { findOnPath, harnessCommand } = require('../electron/harness-path.cjs');
const { spawnSync } = require('node:child_process');

function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tgm-harness-launch-'));
  t.after(() => {
    const root = fs.realpathSync(os.tmpdir()).replace(/[\\/]$/, '');
    const resolved = fs.realpathSync(dir);
    if (path.dirname(resolved) !== root || !path.basename(resolved).startsWith('tgm-harness-launch-')) throw new Error('Unsafe test directory');
    fs.rmSync(resolved, { recursive: true, force: true, maxRetries: 5, retryDelay: 150 });
  });
  return dir;
}

test('harness lookup uses absolute inherited PATH entries and skips project-relative entries', t => {
  const root = fixture(t);
  const selected = path.join(root, 'selected project');
  const installed = path.join(root, 'installed tools');
  fs.mkdirSync(selected); fs.mkdirSync(installed);
  fs.writeFileSync(path.join(selected, 'agy.exe'), 'decoy');
  fs.writeFileSync(path.join(installed, 'agy.exe'), 'installed');
  assert.equal(findOnPath('agy.exe', `relative${path.delimiter}"${installed}"`), path.join(installed, 'agy.exe'));
  assert.equal(findOnPath('opencode.cmd', installed), null);
});

test('OpenCode refuses unsafe command interpolation', () => {
  for (const character of ['%', '!', '^', '&', '|', '<', '>', '(', ')', '"', '\n', '\r']) {
    assert.throws(() => harnessCommand('opencode', `C:\\Unsafe${character}Name\\opencode.cmd`), /unsupported command characters/i);
  }
});

test('OpenCode starts its PATH wrapper in a spaced folder, ignoring project decoys', { skip: process.platform !== 'win32' }, t => {
  const root = fixture(t);
  const installed = path.join(root, 'installed tools');
  const selected = path.join(root, 'selected project');
  fs.mkdirSync(installed); fs.mkdirSync(selected);
  fs.writeFileSync(path.join(installed, 'opencode.cmd'), '@echo off\r\necho TGM_TRUSTED:%*\r\nexit /b 0\r\n');
  fs.writeFileSync(path.join(selected, 'opencode.cmd'), '@echo off\r\necho TGM_DECOY\r\nexit /b 0\r\n');
  const target = findOnPath('opencode.cmd', installed);
  const { command, args } = harnessCommand('opencode', target);
  // node-pty leaves ConPTY worker/socket handles alive after an early child exit.
  // Run the real PTY in a child process and exit only after the wrapper has exited.
  const script = `
    const { TerminalSession } = require(${JSON.stringify(path.resolve(__dirname, '../electron/terminal.cjs'))});
    const session = new TerminalSession();
    let output = '';
    const timeout = setTimeout(() => { console.error('Wrapper did not exit'); process.exit(1); }, 10000);
    session.on('data', data => { output += data; });
    session.on('exit', event => {
      clearTimeout(timeout);
      process.stdout.write(JSON.stringify({ output, exitCode: event.exitCode }), () => process.exit(0));
    });
    session.start(process.argv[1], process.argv[2], process.argv[3], 80, 24);
  `;
  const result = spawnSync(process.execPath, ['-e', script, command, args, selected], {
    cwd: root, encoding: 'utf8', timeout: 15000, windowsHide: true,
  });
  assert.equal(result.status, 0, result.error?.message || result.stderr);
  const event = JSON.parse(result.stdout);
  assert.equal(event.exitCode, 0);
  assert.match(event.output, /TGM_TRUSTED:--standalone/);
  assert.doesNotMatch(event.output, /TGM_DECOY/);
});
