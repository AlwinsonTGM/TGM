'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { DatabaseSync } = require('node:sqlite');
const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const { makeGoals } = require('./goals.cjs');

const MAX_CAPTURE_LENGTH = 10000;
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
let db = null;
let goalsRepo = null;

function getDatabase() {
  if (db && goalsRepo) {
    return db;
  }

  const userDataDir = app.getPath('userData');
  fs.mkdirSync(userDataDir, { recursive: true });
  const dbPath = path.join(userDataDir, 'captures.sqlite');

  const instance = new DatabaseSync(dbPath);
  let repo = null;
  try {
    instance.exec(`
      CREATE TABLE IF NOT EXISTS captures (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        text TEXT NOT NULL,
        created_at TEXT NOT NULL
      )
    `);
    repo = makeGoals(instance);
  } catch (error) {
    instance.close();
    throw error;
  }

  db = instance;
  goalsRepo = repo;
  return db;
}

function closeDatabase() {
  if (!db) {
    goalsRepo = null;
    return;
  }
  const currentDb = db;
  db = null;
  goalsRepo = null;
  try {
    currentDb.close();
  } catch {
    // Ignore close errors during shutdown
  }
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

function validateCaptureText(rawText) {
  if (typeof rawText !== 'string') {
    throw new Error('Capture text is required and must be a string.');
  }
  if (!rawText.isWellFormed()) {
    throw new Error('Capture text must be well-formed Unicode.');
  }
  if (rawText.includes('\0')) {
    throw new Error('Capture text must not contain NUL characters.');
  }
  if (rawText.trim().length === 0) {
    throw new Error('Capture text cannot be empty.');
  }
  if (rawText.length > MAX_CAPTURE_LENGTH) {
    throw new Error(`Capture text is invalid: maximum length is ${MAX_CAPTURE_LENGTH} characters.`);
  }
  return rawText;
}

function listCapturesFromDb() {
  const database = getDatabase();
  const stmt = database.prepare(
    'SELECT id, text, created_at AS createdAt FROM captures ORDER BY id DESC'
  );
  const rows = stmt.all();
  return rows.map((row) => ({
    id: Number(row.id),
    text: String(row.text),
    createdAt: String(row.createdAt),
  }));
}

function insertCaptureIntoDb(validText) {
  const database = getDatabase();
  const createdAt = new Date().toISOString();
  const stmt = database.prepare(
    'INSERT INTO captures (text, created_at) VALUES (?, ?)'
  );
  const result = stmt.run(validText, createdAt);
  return {
    id: Number(result.lastInsertRowid),
    text: validText,
    createdAt,
  };
}

function registerIpcHandlers() {
  ipcMain.handle('tgm:list-captures', (event) => {
    assertTrustedSender(event);
    return listCapturesFromDb();
  });

  ipcMain.handle('tgm:save-capture', (event, rawText) => {
    assertTrustedSender(event);
    const validText = validateCaptureText(rawText);
    return insertCaptureIntoDb(validText);
  });

  ipcMain.handle('tgm:list-goals', (event) => {
    assertTrustedSender(event);
    getDatabase();
    return goalsRepo.list();
  });

  ipcMain.handle('tgm:create-goal', (event, title, firstStep) => {
    assertTrustedSender(event);
    getDatabase();
    return goalsRepo.create(title, firstStep);
  });

  ipcMain.handle('tgm:save-goal-details', (event, goalId, title, stepId, stepText, expectedTitle, expectedStep) => {
    assertTrustedSender(event);
    getDatabase();
    return goalsRepo.saveDetails(goalId, title, stepId, stepText, expectedTitle, expectedStep);
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
    }
  });

  await win.loadFile(DIST_INDEX_PATH);
  return win;
}

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

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  closeDatabase();
});
