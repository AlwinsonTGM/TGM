const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
if (process.env.PROBE_DISABLE_CHROMIUM_SANDBOX === '1') app.commandLine.appendSwitch('no-sandbox');
if (process.env.PROBE_DISABLE_GPU === '1') app.disableHardwareAcceleration();

let terminalProcess;
let server;
let completed = false;
const deadline = setTimeout(() => finish(false, 'timeout waiting for rendered terminal text'), 20000);

function finish(ok, message) {
  if (completed) return;
  completed = true;
  clearTimeout(deadline);
  if (terminalProcess) {
    try { terminalProcess.kill(); } catch (_) {}
  }
  if (server) server.close();
  fs.writeFileSync(path.join(__dirname, 'result.json'), JSON.stringify({ ok, message, versions: process.versions }, null, 2));
  console.log(`${ok ? 'PASS' : 'FAIL'}: ${message}`);
  app.exit(ok ? 0 : 1);
}

app.whenReady().then(async () => {
  let pty;
  try { pty = require('node-pty'); } catch (error) { return finish(false, `node-pty load: ${error.stack}`); }
  const win = new BrowserWindow({ show: false, width: 900, height: 600, webPreferences: { contextIsolation: true, nodeIntegration: false, preload: path.join(__dirname, 'preload.js') } });
  win.webContents.on('render-process-gone', (_, details) => finish(false, `renderer exited: ${details.reason}`));
  ipcMain.on('start', () => {
    try {
      terminalProcess = pty.spawn('cmd.exe', ['/d', '/q'], { name: 'xterm-256color', cols: 80, rows: 24, cwd: __dirname, env: process.env });
      terminalProcess.onData(data => win.webContents.send('data', data));
      terminalProcess.onExit(({ exitCode }) => { if (!completed) finish(false, `shell exited unexpectedly: ${exitCode}`); });
      win.webContents.send('ready');
    } catch (error) { finish(false, `pty spawn: ${error.stack}`); }
  });
  ipcMain.on('input', (_, data) => terminalProcess.write(data));
  ipcMain.on('verified', (_, details) => finish(true, details));
  ipcMain.on('failed', (_, details) => finish(false, details));
  const files = {
    '/': ['index.html', 'text/html'],
    '/renderer.js': ['renderer.js', 'text/javascript'],
    '/node_modules/@xterm/xterm/css/xterm.css': ['node_modules/@xterm/xterm/css/xterm.css', 'text/css'],
    '/node_modules/@xterm/xterm/lib/xterm.js': ['node_modules/@xterm/xterm/lib/xterm.js', 'text/javascript']
  };
  server = http.createServer((req, res) => {
    const item = files[req.url];
    if (!item) { res.writeHead(404); return res.end(); }
    res.setHeader('Content-Type', item[1]);
    fs.createReadStream(path.join(__dirname, item[0])).pipe(res);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  await win.loadURL(`http://127.0.0.1:${server.address().port}/`);
}).catch(error => finish(false, error.stack));
