'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { _electron } = require('playwright');
const { DatabaseSync } = require('node:sqlite');

const APP_ENTRY = path.resolve(__dirname, '../electron/main.cjs');

async function launchElectronApp(userDataDir) {
  const electronApp = await _electron.launch({
    executablePath: require('electron'),
    args: [APP_ENTRY],
    env: {
      ...process.env,
      NODE_ENV: 'test',
      TGM_TEST_USER_DATA: userDataDir,
    },
  });
  const window = await electronApp.firstWindow();
  await window.waitForLoadState('domcontentloaded');
  return { electronApp, window };
}

async function safeCloseApp(electronApp) {
  if (!electronApp) return;
  try {
    await electronApp.close();
  } catch {
    try {
      const proc = electronApp.process();
      if (proc && !proc.killed) {
        proc.kill();
      }
    } catch {
      // Ignore cleanup failures if process already exited
    }
  }
}

function safeRemoveDir(dirPath) {
  if (!dirPath) return;
  const tempRoot = fs.realpathSync(os.tmpdir());
  const target = fs.realpathSync(dirPath);
  const relative = path.relative(tempRoot, target);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative) ||
      !path.basename(target).startsWith('tgm-capture-')) {
    throw new Error('Refusing to delete a directory outside the test temporary directory');
  }
  fs.rmSync(target, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
}

test('saves a quick capture through the Electron UI and persists it across app relaunch', async () => {
  const tempUserDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tgm-capture-persist-'));
  const uniqueCaptureText = '  Synthetic capture entry 9f8a7b6c-2026-11-07-alpha\n';
  let electronApp = null;

  try {
    ({ electronApp } = await launchElectronApp(tempUserDataDir));
    const firstWindow = await electronApp.firstWindow();

    const captureInput = firstWindow.getByRole('textbox', { name: 'Quick capture' });
    const saveButton = firstWindow.getByRole('button', { name: 'Save capture' });

    await captureInput.waitFor({ state: 'visible' });
    await captureInput.fill(uniqueCaptureText);
    await saveButton.click();

    const savedItem = firstWindow.locator('.capture-history li').first();
    await savedItem.waitFor({ state: 'visible' });
    assert.equal(await savedItem.textContent(), uniqueCaptureText);

    await safeCloseApp(electronApp);
    electronApp = null;

    ({ electronApp } = await launchElectronApp(tempUserDataDir));
    const relaunchedWindow = await electronApp.firstWindow();

    const persistedItem = relaunchedWindow.locator('.capture-history li').first();
    await persistedItem.waitFor({ state: 'visible' });
    assert.equal(await persistedItem.textContent(), uniqueCaptureText);
  } finally {
    await safeCloseApp(electronApp);
    safeRemoveDir(tempUserDataDir);
  }
});

test('rejects whitespace-only quick capture submission and displays a visible validation message', async () => {
  const tempUserDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tgm-capture-validation-'));
  const whitespaceInput = '   \t  ';
  let electronApp = null;

  try {
    ({ electronApp } = await launchElectronApp(tempUserDataDir));
    const window = await electronApp.firstWindow();

    const captureInput = window.getByRole('textbox', { name: 'Quick capture' });
    const saveButton = window.getByRole('button', { name: 'Save capture' });

    await captureInput.waitFor({ state: 'visible' });
    await captureInput.fill(whitespaceInput);
    await saveButton.click();

    const validationAlert = window
      .getByRole('alert')
      .or(window.getByText(/cannot be empty|enter a capture|required|whitespace|invalid/i))
      .first();

    await validationAlert.waitFor({ state: 'visible' });
    assert.equal(await validationAlert.isVisible(), true);

    const validationText = (await validationAlert.textContent()) || '';
    assert.ok(validationText.trim().length > 0, 'Expected non-empty validation message text');

    const listItems = window.getByRole('listitem');
    assert.equal(await listItems.count(), 0, 'Expected no capture item to be saved for whitespace input');
  } finally {
    await safeCloseApp(electronApp);
    safeRemoveDir(tempUserDataDir);
  }
});

test('keeps text typed while a previous capture is saving', async () => {
  const tempUserDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tgm-capture-slow-'));
  let electronApp = null;
  try {
    ({ electronApp } = await launchElectronApp(tempUserDataDir));
    const window = await electronApp.firstWindow();
    await window.getByText('Your saved captures will appear here.').waitFor();
    await electronApp.evaluate(({ ipcMain }) => {
      const save = ipcMain._invokeHandlers.get('tgm:save-capture');
      ipcMain.removeHandler('tgm:save-capture');
      ipcMain.handle('tgm:save-capture', async (...args) => {
        await new Promise((resolve) => setTimeout(resolve, 500));
        return save(...args);
      });
    });
    const input = window.getByRole('textbox', { name: 'Quick capture' });
    await input.fill('First thought');
    await window.getByRole('button', { name: 'Save capture' }).click();
    await input.fill('Second thought in progress');
    await window.getByText('First thought', { exact: true }).waitFor();
    assert.equal(await input.inputValue(), 'Second thought in progress');
  } finally {
    await safeCloseApp(electronApp);
    safeRemoveDir(tempUserDataDir);
  }
});

test('preserves a capture when a previously opened database cannot be written', async () => {
  const tempUserDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tgm-capture-locked-'));
  let electronApp = null;
  let lock = null;
  try {
    ({ electronApp } = await launchElectronApp(tempUserDataDir));
    const window = await electronApp.firstWindow();
    await window.getByText('Your saved captures will appear here.').waitFor();
    lock = new DatabaseSync(path.join(tempUserDataDir, 'captures.sqlite'));
    lock.exec('BEGIN EXCLUSIVE');
    const input = window.getByRole('textbox', { name: 'Quick capture' });
    await input.fill('Thought awaiting an unlocked database');
    await window.getByRole('button', { name: 'Save capture' }).click();
    await window.getByText(/Could not save your capture/).waitFor();
    assert.equal(await input.inputValue(), 'Thought awaiting an unlocked database');
    lock.exec('ROLLBACK');
    lock.close();
    lock = null;
    await window.getByRole('button', { name: 'Save capture' }).click();
    await window.getByText('Thought awaiting an unlocked database', { exact: true }).waitFor();
  } finally {
    if (lock) { lock.exec('ROLLBACK'); lock.close(); }
    await safeCloseApp(electronApp);
    safeRemoveDir(tempUserDataDir);
  }
});

test('reports storage failure, preserves unsaved capture text, and permits retry', async () => {
  const tempUserDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tgm-capture-failure-'));
  const blockedDatabase = path.join(tempUserDataDir, 'captures.sqlite');
  const capture = 'Synthetic capture kept during a failed save';
  let electronApp = null;

  try {
    // A directory at the database path makes SQLite fail without touching any real data.
    fs.mkdirSync(blockedDatabase);
    ({ electronApp } = await launchElectronApp(tempUserDataDir));
    const window = await electronApp.firstWindow();
    await window.getByText(/could not load your captures/i).waitFor();
    const input = window.getByRole('textbox', { name: 'Quick capture' });
    await input.fill(capture);
    await window.getByRole('button', { name: 'Save capture' }).click();
    await window.getByText(/could not save your capture/i).waitFor();
    assert.equal(await input.inputValue(), capture);
    fs.rmdirSync(blockedDatabase);
    await window.getByRole('button', { name: 'Save capture' }).click();
    await window.getByText('Capture saved.', { exact: true }).waitFor();
    await window.getByRole('button', { name: 'Try again' }).click();
    await window.getByText(capture, { exact: true }).waitFor();
  } finally {
    await safeCloseApp(electronApp);
    safeRemoveDir(tempUserDataDir);
  }
});
