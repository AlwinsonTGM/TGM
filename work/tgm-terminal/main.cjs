const { app, BrowserWindow, dialog, ipcMain, clipboard } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { TerminalSession } = require('./terminal.cjs');

let window;
let closing = false;
const terminal = new TerminalSession();
const harnesses = {
  agy: { command: 'agy.exe', args: [] },
  opencode: { command: process.env.ComSpec || 'cmd.exe', args: ['/d', '/c', 'opencode.cmd', '--standalone'] }
};
const validSize = (cols, rows) => Number.isInteger(cols) && cols >= 2 && cols <= 1000 && Number.isInteger(rows) && rows >= 2 && rows <= 1000;
const authorized = event => window && event.sender === window.webContents && event.senderFrame === window.webContents.mainFrame;
async function confirmStop() {
  if (!terminal.child) return true;
  const { response } = await dialog.showMessageBox(window, {
    type: 'warning',
    message: 'Stop this terminal session?',
    detail: 'The running harness and its process tree will be stopped. Detached processes may continue. Unsaved work may be lost.',
    buttons: ['Keep running', 'Stop session'],
    defaultId: 0,
    cancelId: 0,
    noLink: true
  });
  return response === 1;
}

app.whenReady().then(async () => {
  window = new BrowserWindow({ width: 1100, height: 760, minWidth: 640, minHeight: 420, title: 'TGM Terminal', backgroundColor: '#101213', webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, preload: path.join(__dirname, 'preload.cjs') } });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', event => event.preventDefault());
  window.on('close', async event => {
    if (closing) return;
    event.preventDefault();
    try {
      if (!await confirmStop()) return;
      await terminal.stop();
      closing = true;
      window.destroy();
    } catch (error) {
      dialog.showErrorBox('Could not close the terminal', error.message);
    }
  });

  ipcMain.handle('choose-folder', async event => {
    if (!authorized(event)) throw new Error('Unauthorized request.');
    const result = await dialog.showOpenDialog(window, { properties: ['openDirectory'] });
    return result.canceled ? null : result.filePaths[0];
  });
  ipcMain.handle('start-terminal', async (event, request) => {
    if (!authorized(event)) throw new Error('Unauthorized request.');
    const harness = Object.hasOwn(harnesses, request?.harness) ? harnesses[request.harness] : null;
    if (!harness || typeof request.cwd !== 'string' || !path.isAbsolute(request.cwd) || !validSize(request.cols, request.rows)) throw new Error('Invalid terminal settings.');
    if (!fs.statSync(request.cwd).isDirectory()) throw new Error('Choose an existing folder.');
    terminal.start(harness.command, harness.args, request.cwd, request.cols, request.rows);
  });
  ipcMain.handle('stop-terminal', async event => {
    if (!authorized(event)) throw new Error('Unauthorized request.');
    if (!await confirmStop()) return false;
    await terminal.stop();
    return true;
  });
  ipcMain.on('terminal-input', (event, value) => { if (authorized(event) && typeof value === 'string' && value.length <= 1000000) terminal.write(value); });
  ipcMain.on('terminal-resize', (event, cols, rows) => { if (authorized(event) && validSize(cols, rows)) terminal.resize(cols, rows); });
  ipcMain.handle('clipboard-read', event => { if (!authorized(event)) throw new Error('Unauthorized request.'); return clipboard.readText(); });
  ipcMain.handle('clipboard-write', (event, value) => {
    if (!authorized(event) || typeof value !== 'string' || value.length > 1000000) throw new Error('Cannot copy selection.');
    return clipboard.writeText(value);
  });
  terminal.on('data', data => { if (window && !window.isDestroyed()) window.webContents.send('terminal-data', data); });
  terminal.on('exit', event => { if (window && !window.isDestroyed()) window.webContents.send('terminal-exit', event.exitCode); });
  await window.loadFile(path.join(__dirname, 'index.html'));
}).catch(error => { dialog.showErrorBox('TGM Terminal failed to start', error.message); app.quit(); });

app.on('window-all-closed', () => app.quit());
