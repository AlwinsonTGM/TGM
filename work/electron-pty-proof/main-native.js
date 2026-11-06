const { app } = require('electron');
const fs = require('fs');
const path = require('path');
let ptyProcess;
let finished = false;
let sawMarker = false;
const timer = setTimeout(() => finish(false, 'timeout'), 15000);
function finish(ok, reason) {
  if (finished) return;
  finished = true;
  clearTimeout(timer);
  if (ptyProcess && !ok) { try { ptyProcess.kill(); } catch (_) {} }
  fs.writeFileSync(path.join(__dirname, 'native-result.json'), JSON.stringify({ ok, reason, electron: process.versions.electron, node: process.versions.node }));
  app.exit(ok ? 0 : 1);
}
app.whenReady().then(() => {
  try {
    ptyProcess = require('node-pty').spawn('cmd.exe', ['/d', '/c', 'echo ELECTRON_NATIVE_PTY_OK'], { name: 'xterm-256color', cols: 80, rows: 24, cwd: __dirname, env: process.env });
    ptyProcess.onData(data => { if (data.includes('ELECTRON_NATIVE_PTY_OK')) sawMarker = true; });
    ptyProcess.onExit(({ exitCode }) => finish(sawMarker && exitCode === 0, `synthetic shell marker seen=${sawMarker}, shell exit=${exitCode}`));
  } catch (error) { finish(false, error.stack); }
}).catch(error => finish(false, error.stack));
