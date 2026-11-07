const fs = require('node:fs');
const path = require('node:path');

if (process.platform !== 'win32' || process.arch !== 'x64') {
  throw new Error('This development build currently supports Windows x64 only.');
}

const root = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
if (args.length && (args.length !== 2 || args[0] !== '--output' || !path.isAbsolute(args[1]))) {
  throw new Error('Usage: node scripts/package-win.cjs [--output <absolute directory>]');
}
const output = args.length ? path.resolve(args[1]) : path.join(root, 'dist', 'TGM-Terminal-win32-x64');
const runtime = path.join(root, 'node_modules', 'electron', 'dist');
if (fs.existsSync(output)) {
  throw new Error(`Build directory already exists: ${output}. Move or remove it before rebuilding.`);
}
if (!fs.existsSync(path.join(runtime, 'electron.exe'))) {
  throw new Error('Electron runtime not found. Run npm install first.');
}

fs.mkdirSync(output, { recursive: true });
fs.cpSync(runtime, output, { recursive: true });
fs.renameSync(path.join(output, 'electron.exe'), path.join(output, 'TGM Terminal.exe'));

const app = path.join(output, 'resources', 'app');
fs.mkdirSync(app, { recursive: true });
for (const file of ['index.html', 'style.css', 'main.cjs', 'preload.cjs', 'renderer.js', 'terminal.cjs', 'harness-path.cjs']) {
  fs.copyFileSync(path.join(root, file), path.join(app, file));
}
const manifest = require(path.join(root, 'package.json'));
fs.writeFileSync(path.join(app, 'package.json'), JSON.stringify({
  name: manifest.name, version: manifest.version, main: manifest.main, private: true
}, null, 2));
for (const name of ['@xterm/xterm', '@xterm/addon-fit', 'node-pty', 'node-addon-api']) {
  const destination = path.join(app, 'node_modules', name);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.cpSync(path.join(root, 'node_modules', name), destination, { recursive: true });
}
console.log(`Unpacked development build: ${output}`);
