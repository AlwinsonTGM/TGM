'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { _electron } = require('playwright');

const APP_ENTRY = path.resolve(__dirname, '../electron/main.cjs');
const RECOVER_CLI = path.resolve(__dirname, '../scripts/recover-database.cjs');

async function launchApp(userDataDir) {
  const electronApp = await _electron.launch({
    executablePath: require('electron'),
    args: [APP_ENTRY],
    env: {
      ...process.env,
      NODE_ENV: 'test',
      TGM_TEST_USER_DATA: userDataDir,
    },
  });
  const page = await electronApp.firstWindow();
  await page.waitForLoadState('domcontentloaded');
  return { electronApp, page };
}

async function closeApp(electronApp) {
  if (!electronApp) return;
  try {
    // Test teardown discards disposable drafts after assertions have finished.
    try { await electronApp.evaluate(({ dialog }) => { dialog.showMessageBoxSync = () => 1; }); } catch {}
    await electronApp.close();
  } catch {
    try {
      const proc = electronApp.process();
      if (proc && !proc.killed) proc.kill();
    } catch {}
  }
}

function removeTempDir(dirPath) {
  if (!dirPath || !fs.existsSync(dirPath)) return;
  const tempRoot = fs.realpathSync(os.tmpdir());
  const target = fs.realpathSync(dirPath);
  const rel = path.relative(tempRoot, target);
  if (
    !rel ||
    rel.startsWith('..') ||
    path.isAbsolute(rel) ||
    !path.basename(target).startsWith('tgm-integrated-')
  ) {
    throw new Error(`Refusing to delete unsafe directory: ${target}`);
  }
  fs.rmSync(target, { recursive: true, force: true, maxRetries: 5, retryDelay: 150 });
}

test('integrated Home flow: goals, step editing, quick capture, honest integration status, and database snapshot/restore recovery', async () => {
  const sourceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tgm-integrated-src-'));
  const backupDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tgm-integrated-bak-'));
  const restoredDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tgm-integrated-restored-'));
  let electronApp = null;

  try {
    let page;
    ({ electronApp, page } = await launchApp(sourceDir));

    // Verify honest session and integration availability on initial load
    await page.getByText('Session continuation is not connected yet.').waitFor();
    await page.getByText(/FlowState is not connected yet/).waitFor();
    await page.getByText('Session continuation, AGY, OpenCode, and Obsidian are not connected yet.').waitFor();
    await page.getByText('Your next step starts here.').waitFor();
    await page.getByText('Your saved captures will appear here.').waitFor();

    // Create goal with a first step
    const addForm = page.getByRole('form', { name: 'Add a goal', exact: true });
    await addForm.getByLabel('Goal title', { exact: true }).fill('Ship TGM Home slice');
    await addForm.getByLabel('First next step (optional)', { exact: true }).fill('Verify SQLite persistence');
    await addForm.getByRole('button', { name: 'Save goal', exact: true }).click();
    await page.getByRole('button', { name: 'Open Verify SQLite persistence', exact: true }).waitFor();

    // Create goal without a step, then add and edit its step
    await addForm.getByLabel('Goal title', { exact: true }).fill('Study distributed systems');
    await addForm.getByRole('button', { name: 'Save goal', exact: true }).click();
    const addStepBtn = page.getByRole('button', { name: 'Add a next step to Study distributed systems', exact: true });
    await addStepBtn.waitFor();
    await addStepBtn.click();

    const detailForm = page.getByRole('form', { name: 'Goal and step details', exact: true });
    await detailForm.waitFor();
    await detailForm.getByLabel('Next step', { exact: true }).fill('Read Raft paper section 5');
    await detailForm.getByRole('button', { name: 'Save changes', exact: true }).click();
    await page.getByRole('button', { name: 'Open Read Raft paper section 5', exact: true }).waitFor();

    // Save an uncategorized quick capture
    const captureInput = page.getByRole('textbox', { name: 'Quick capture' });
    await captureInput.fill('Remember to check contrast ratios on dark-green surfaces');
    await page.getByRole('button', { name: 'Save capture', exact: true }).click();
    await page.getByText('Remember to check contrast ratios on dark-green surfaces', { exact: true }).waitFor();

    // Close app, snapshot database, restore into fresh userData directory, and relaunch
    await closeApp(electronApp);
    electronApp = null;

    const sourceDbPath = path.join(sourceDir, 'captures.sqlite');
    const snapshotDbPath = path.join(backupDir, 'captures-backup.sqlite');
    const restoredDbPath = path.join(restoredDir, 'captures.sqlite');

    const snapResult = spawnSync(process.execPath, [RECOVER_CLI, 'snapshot', sourceDbPath, snapshotDbPath], {
      encoding: 'utf8',
      windowsHide: true,
    });
    assert.equal(snapResult.status, 0, `Snapshot failed: ${snapResult.stderr}`);

    const restoreResult = spawnSync(process.execPath, [RECOVER_CLI, 'restore', snapshotDbPath, restoredDbPath], {
      encoding: 'utf8',
      windowsHide: true,
    });
    assert.equal(restoreResult.status, 0, `Restore failed: ${restoreResult.stderr}`);

    ({ electronApp, page } = await launchApp(restoredDir));
    await page.getByRole('button', { name: 'Open Verify SQLite persistence', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Open Read Raft paper section 5', exact: true }).waitFor();
    await page.getByText('Remember to check contrast ratios on dark-green surfaces', { exact: true }).waitFor();
  } finally {
    await closeApp(electronApp);
    removeTempDir(sourceDir);
    removeTempDir(backupDir);
    removeTempDir(restoredDir);
  }
});

test('integrated Home keyboard focus, reduced motion, long content wrapping, and responsive desktop window sizes', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tgm-integrated-ux-'));
  let electronApp = null;

  try {
    let page;
    ({ electronApp, page } = await launchApp(dir));
    await page.getByText('Your next step starts here.').waitFor();

    // Long content without spaces wraps cleanly without horizontal overflow
    const longToken = 'https://example.com/' + 'very-long-unbroken-segment-'.repeat(8);
    const addForm = page.getByRole('form', { name: 'Add a goal', exact: true });
    await addForm.getByLabel('Goal title', { exact: true }).fill(`Review ${longToken}`);
    await addForm.getByLabel('First next step (optional)', { exact: true }).fill(`Inspect ${longToken}`);
    await addForm.getByRole('button', { name: 'Save goal', exact: true }).click();
    await page.getByRole('button', { name: `Open Inspect ${longToken}`, exact: true }).waitFor();

    // Check keyboard Tab navigation and visible focus ring
    await page.keyboard.press('Tab');
    const focusStyle = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return null;
      const cs = window.getComputedStyle(el);
      return { tag: el.tagName, outlineStyle: cs.outlineStyle, outlineWidth: cs.outlineWidth };
    });
    assert.ok(focusStyle, 'Expected an interactive element to receive keyboard focus');
    assert.equal(focusStyle.outlineStyle, 'solid');

    // Check wide (1280x800), medium (800x680), and compact (560x680) viewports for overflow
    for (const [width, height] of [[1280, 800], [800, 680], [560, 680]]) {
      await page.setViewportSize({ width, height });
      const overflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth;
      });
      assert.equal(overflow, false, `Expected no horizontal overflow at ${width}x${height}`);
    }

    // Check prefers-reduced-motion disables button transition
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const transitionDuration = await page.evaluate(() => {
      const btn = document.querySelector('button');
      return btn ? window.getComputedStyle(btn).transitionDuration : null;
    });
    assert.equal(transitionDuration, '0s');
  } finally {
    await closeApp(electronApp);
    removeTempDir(dir);
  }
});
