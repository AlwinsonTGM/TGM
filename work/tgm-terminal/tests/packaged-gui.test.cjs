const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'tgm-package-gui-'));
const build = path.join(temp, 'build');
const app = path.join(build, 'resources', 'app');

try {
  const packaged = spawnSync(process.execPath, [path.join(root, 'scripts', 'package-win.cjs'), '--output', build], {
    cwd: root, encoding: 'utf8', timeout: 120000, windowsHide: true
  });
  if (packaged.stdout) process.stdout.write(packaged.stdout);
  if (packaged.stderr) process.stderr.write(packaged.stderr);
  assert.equal(packaged.status, 0, packaged.error?.message || 'Temporary package build failed.');

  const manifestPath = path.join(app, 'package.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  manifest.main = 'tests/harness-availability.test.cjs';
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  fs.mkdirSync(path.join(app, 'tests'));
  fs.copyFileSync(path.join(__dirname, 'harness-availability.test.cjs'), path.join(app, manifest.main));
  const userData = path.join(temp, 'user-data');
  fs.mkdirSync(userData);
  const env = { ...process.env, TGM_TEST_USER_DATA: userData };
  delete env.ELECTRON_RUN_AS_NODE;
  const result = spawnSync(path.join(build, 'TGM Terminal.exe'), [], {
    cwd: temp, env, encoding: 'utf8', timeout: 30000, windowsHide: true
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  assert.equal(result.status, 0, result.error?.message || 'Packaged GUI test failed.');
  assert.match(result.stdout, /PASS: harness PATH check, selection, retry, and invalid request/);
} finally {
  const resolvedTemp = fs.realpathSync(temp);
  const resolvedParent = fs.realpathSync(os.tmpdir());
  if (fs.lstatSync(temp).isSymbolicLink() || path.dirname(resolvedTemp) !== resolvedParent ||
      !path.basename(resolvedTemp).startsWith('tgm-package-gui-')) {
    throw new Error(`Refusing to remove unexpected test directory: ${temp}`);
  }
  fs.rmSync(resolvedTemp, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
}
