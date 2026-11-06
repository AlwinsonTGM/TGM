const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const build = path.join(root, 'dist', 'TGM-Terminal-win32-x64');
const executable = path.join(build, 'TGM Terminal.exe');
const script = `
  const pty = require(${JSON.stringify(path.join(build, 'resources', 'app', 'node_modules', 'node-pty'))});
  const terminal = pty.spawn(process.env.ComSpec || 'cmd.exe', ['/d', '/q'], { name: 'xterm-256color', cols: 80, rows: 24, cwd: process.cwd(), env: process.env });
  const timer = setTimeout(() => { terminal.kill(); process.exit(1); }, 10000);
  let output = '', passed = false;
  terminal.onData(data => { output += data; if (!passed && output.includes('TGM_PACKAGED_MARKER')) { passed = true; clearTimeout(timer); console.log('PASS: packaged Electron loaded node-pty and received command output'); terminal.kill(); } });
  terminal.onExit(() => process.exit(0));
  terminal.write(${JSON.stringify('node -p "[\'TGM\',\'PACKAGED\',\'MARKER\'].join(\'_\')"\r')});
`;
const result = spawnSync(executable, ['-e', script], {
  cwd: root,
  env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
  encoding: 'utf8', timeout: 15000, windowsHide: true
});
if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
assert.equal(result.status, 0, result.error?.message || 'Packaged native smoke test failed.');
assert.match(result.stdout, /PASS: packaged Electron loaded node-pty/);
