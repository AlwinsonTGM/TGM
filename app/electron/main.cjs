'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { app, BrowserWindow, dialog, ipcMain, clipboard } = require('electron');
const { TerminalSession } = require('./terminal.cjs');
const { findOnPath, harnessCommand } = require('./harness-path.cjs');
const { openStore } = require('./store.cjs');

const PRELOAD_PATH = path.join(__dirname, 'preload.cjs');
const DIST_INDEX_PATH = path.resolve(__dirname, '../dist/index.html');
const DIST_INDEX_URL = pathToFileURL(DIST_INDEX_PATH).href;

if (
  !app.isPackaged &&
  process.env.NODE_ENV === 'test' &&
  typeof process.env.TGM_TEST_USER_DATA === 'string' &&
  process.env.TGM_TEST_USER_DATA.trim().length > 0
) {
  const testUserDataDir = path.resolve(process.env.TGM_TEST_USER_DATA.trim());
  fs.mkdirSync(testUserDataDir, { recursive: true });
  app.setPath('userData', testUserDataDir);
}

let mainWindow = null;
let store = null;
const terminal = new TerminalSession();
const harnesses = {
  agy: { filename: 'agy.exe', label: 'AGY' },
  opencode: { filename: 'opencode.cmd', label: 'OpenCode' },
};
const validSize = (cols, rows) => Number.isInteger(cols) && cols >= 2 && cols <= 1000 && Number.isInteger(rows) && rows >= 2 && rows <= 1000;
let closePromptPending = false;
let allowNextClose = false;
let terminalCleanup = Promise.resolve();
let allowQuit = false;

async function confirmTerminalStop(win) {
  if (!terminal.child) return true;
  const { response } = await dialog.showMessageBox(win, {
    type: 'warning',
    message: 'Stop this terminal session?',
    detail: 'The running harness and its process tree will be stopped. Detached processes may continue. Unsaved work may be lost.',
    buttons: ['Keep running', 'Stop session'],
    defaultId: 0,
    cancelId: 0,
    noLink: true,
  });
  return response === 1;
}

function verifySameTerminal(originalChild) {
  if (terminal.child && terminal.child !== originalChild) {
    throw new Error('The terminal session changed. Please try again.');
  }
}

function getStore() {
  if (!store) {
    const userDataDir = app.getPath('userData');
    fs.mkdirSync(userDataDir, { recursive: true });
    store = openStore(path.join(userDataDir, 'captures.sqlite'));
  }
  return store;
}

function closeStore() {
  if (!store) return;
  const current = store;
  store = null;
  try { current.close(); } catch (error) { console.error('Failed to close database:', error); }
}

function assertTrustedSender(event) {
  if (!mainWindow || mainWindow.isDestroyed()) {
    throw new Error('Main window is not available.');
  }
  if (!event || event.sender !== mainWindow.webContents) {
    throw new Error('Unauthorized IPC sender.');
  }
  if (!event.senderFrame || event.senderFrame !== mainWindow.webContents.mainFrame) {
    throw new Error('Unauthorized IPC sender frame.');
  }
  if (!isAllowedNavigation(event.senderFrame.url)) {
    throw new Error('Unauthorized IPC sender URL.');
  }
}

function registerIpcHandlers() {
  ipcMain.handle('terminal:choose-folder', async (event) => {
    assertTrustedSender(event);
    const result = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'] });
    return result.canceled ? null : result.filePaths[0];
  });
  ipcMain.handle('terminal:check-harness', (event, id) => {
    assertTrustedSender(event);
    if (typeof id !== 'string' || !Object.hasOwn(harnesses, id)) throw new Error('Invalid harness.');
    return Boolean(findOnPath(harnesses[id].filename));
  });
  ipcMain.handle('terminal:start', (event, request) => {
    assertTrustedSender(event);
    const harness = request && typeof request.harness === 'string' && Object.hasOwn(harnesses, request.harness) ? harnesses[request.harness] : null;
    if (!harness || typeof request.cwd !== 'string' || !path.isAbsolute(request.cwd) || !validSize(request.cols, request.rows)) throw new Error('Invalid terminal settings.');
    if (!fs.statSync(request.cwd).isDirectory()) throw new Error('Choose an existing folder.');
    if (process.platform !== 'win32') throw new Error('The harness terminal currently supports Windows only.');
    const executable = findOnPath(harness.filename);
    if (!executable) throw new Error(`${harness.label} is not available on TGM’s PATH. Install it or update PATH, then restart TGM.`);
    const launch = harnessCommand(request.harness, executable);
    terminal.start(launch.command, launch.args, request.cwd, request.cols, request.rows);
  });
  ipcMain.handle('terminal:stop', async (event) => {
    assertTrustedSender(event);
    const child = terminal.child;
    if (!await confirmTerminalStop(mainWindow)) return false;
    verifySameTerminal(child);
    await terminal.stop();
    return true;
  });
  ipcMain.on('terminal:input', (event, value) => {
    try { assertTrustedSender(event); } catch { return; }
    if (typeof value === 'string' && value.length <= 1000000) {
      try { terminal.write(value); } catch (error) { console.error('Terminal input failed:', error); }
    }
  });
  ipcMain.on('terminal:resize', (event, cols, rows) => {
    try { assertTrustedSender(event); } catch { return; }
    if (validSize(cols, rows)) {
      try { terminal.resize(cols, rows); } catch (error) { console.error('Terminal resize failed:', error); }
    }
  });
  ipcMain.handle('terminal:clipboard-read', (event) => {
    assertTrustedSender(event);
    return clipboard.readText();
  });
  ipcMain.handle('terminal:clipboard-write', (event, value) => {
    assertTrustedSender(event);
    if (typeof value !== 'string' || value.length > 1000000) throw new Error('Cannot copy selection.');
    clipboard.writeText(value);
  });
  ipcMain.handle('tgm:list-captures', (event) => {
    assertTrustedSender(event);
    return getStore().listCaptures();
  });
  ipcMain.handle('tgm:save-capture', (event, text) => {
    assertTrustedSender(event);
    return getStore().saveCapture(text);
  });
  ipcMain.handle('tgm:list-goals', (event) => {
    assertTrustedSender(event);
    return getStore().listGoals();
  });
  ipcMain.handle('tgm:create-goal', (event, title, firstStep) => {
    assertTrustedSender(event);
    return getStore().createGoal(title, firstStep);
  });
  ipcMain.handle('tgm:save-goal-details', (event, goalId, title, stepId, stepText, expectedTitle, expectedStep) => {
    assertTrustedSender(event);
    return getStore().saveGoalDetails(goalId, title, stepId, stepText, expectedTitle, expectedStep);
  });
}

function isAllowedNavigation(targetUrl) {
  try {
    const parsed = new URL(targetUrl);
    parsed.hash = '';
    parsed.search = '';
    return parsed.href === DIST_INDEX_URL;
  } catch {
    return false;
  }
}

async function createMainWindow() {
  const win = new BrowserWindow({
    width: 1120,
    height: 760,
    show: true,
    webPreferences: {
      preload: PRELOAD_PATH,
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
    },
  });

  mainWindow = win;

  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  win.on('close', (event) => {
    if (allowNextClose) { allowNextClose = false; return; }
    if (!terminal.child || terminal.stopping) return;
    event.preventDefault();
    if (closePromptPending) return;
    closePromptPending = true;
    const child = terminal.child;
    void (async () => {
      try {
        if (!await confirmTerminalStop(win)) return;
        verifySameTerminal(child);
        if (win.isDestroyed()) return;
        allowNextClose = true;
        win.close();
      } catch (error) {
        dialog.showErrorBox('Could not close the terminal', error.message);
      } finally {
        closePromptPending = false;
      }
    })();
  });

  win.webContents.on('will-prevent-unload', (event) => {
    const choice = dialog.showMessageBoxSync(win, {
      type: 'warning',
      message: 'Discard unsaved changes?',
      detail: 'Your draft has not been saved.',
      buttons: ['Keep editing', 'Discard and close'],
      defaultId: 0,
      cancelId: 0,
      noLink: true,
    });
    if (choice === 1) event.preventDefault();
  });

  win.webContents.on('will-navigate', (event, navigationUrl) => {
    if (!isAllowedNavigation(navigationUrl)) {
      event.preventDefault();
    }
  });

  win.webContents.on('will-redirect', (event, navigationUrl) => {
    if (!isAllowedNavigation(navigationUrl)) {
      event.preventDefault();
    }
  });

  win.on('closed', () => {
    if (mainWindow === win) {
      mainWindow = null;
      terminalCleanup = terminal.stop().catch((error) => {
        dialog.showErrorBox('Could not confirm terminal shutdown', error.message);
      });
    }
  });

  await win.loadFile(DIST_INDEX_PATH);
  return win;
}

terminal.on('data', data => { if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('terminal:data', data); });
terminal.on('exit', event => { if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('terminal:exit', event.exitCode); });

app.whenReady().then(async () => {
  registerIpcHandlers();
  await createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow().catch((err) => {
        console.error('Failed to recreate main window:', err);
      });
    }
  });
}).catch((err) => {
  console.error('Failed to initialize application:', err);
  app.quit();
});

app.on('before-quit', (event) => {
  if (allowQuit || (!terminal.child && !terminal.stopping)) return;
  event.preventDefault();
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.close();
  } else {
    void terminalCleanup.finally(() => { allowQuit = true; app.quit(); });
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    void terminalCleanup.finally(() => { allowQuit = true; app.quit(); });
  }
});

app.on('will-quit', () => {
  closeStore();
});
