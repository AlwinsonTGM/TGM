'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { _electron } = require('playwright');
const { openStore } = require('../electron/store.cjs');

async function launch(userData) {
  const app = await _electron.launch({
    executablePath: require('electron'),
    args: [path.resolve(__dirname, '../electron/main.cjs')],
    env: { ...process.env, NODE_ENV: 'test', TGM_TEST_USER_DATA: userData },
  });
  return { app, page: await app.firstWindow() };
}

async function close(app) {
  if (!app) return;
  // Teardown may discard only the test's disposable drafts, after assertions.
  try { await app.evaluate(({ dialog }) => { dialog.showMessageBoxSync = () => 1; }); } catch {}
  await app.close();
}

function tempDirectory(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tgm-home-ui-'));
  t.after(() => {
    const root = fs.realpathSync(os.tmpdir());
    const target = fs.realpathSync(dir);
    if (path.dirname(target) !== root || !path.basename(target).startsWith('tgm-home-ui-')) {
      throw new Error(`Refusing to remove unexpected directory: ${target}`);
    }
    fs.rmSync(target, { recursive: true, force: true, maxRetries: 5, retryDelay: 150 });
  });
  return dir;
}

test('Home persists captures and goals, and suggestion editing is explicit', async t => {
  const dir = tempDirectory(t);
  let app;
  try {
    let page;
    ({ app, page } = await launch(dir));
    await page.getByLabel('Capture a thought').fill('Remember this thought');
    await page.getByRole('button', { name: 'Capture', exact: true }).click();
    await page.getByLabel('Saved captures').getByText('Remember this thought', { exact: true }).waitFor();

    await page.getByRole('button', { name: 'Add goal', exact: true }).click();
    await page.locator('#goal-title').fill('Learn TypeScript');
    await page.locator('#goal-step').fill('Practice generics');
    await page.getByRole('button', { name: 'Save goal', exact: true }).click();
    await page.getByRole('button', { name: 'Open Learn TypeScript', exact: true }).click();
    assert.equal(await page.locator('#detail-title').inputValue(), 'Learn TypeScript');
    assert.equal(await page.locator('#detail-step').inputValue(), 'Practice generics');

    await page.locator('#detail-title').fill('Discard this edit');
    page.once('dialog', dialog => dialog.accept());
    await page.getByRole('button', { name: 'Close details', exact: true }).click();
    await close(app); app = null;

    ({ app, page } = await launch(dir));
    await page.getByLabel('Saved captures').getByText('Remember this thought', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Open Learn TypeScript', exact: true }).click();
    assert.equal(await page.locator('#detail-title').inputValue(), 'Learn TypeScript');
    assert.equal(await page.locator('#detail-step').inputValue(), 'Practice generics');
    await page.locator('#detail-title').fill('Ship a TypeScript project');
    await page.locator('#detail-step').fill('Write release notes');
    await page.getByRole('button', { name: 'Save changes', exact: true }).click();
    await page.getByText('Changes saved.', { exact: true }).waitFor();
    await close(app); app = null;

    ({ app, page } = await launch(dir));
    await page.getByRole('button', { name: 'Open Ship a TypeScript project', exact: true }).click();
    assert.equal(await page.locator('#detail-step').inputValue(), 'Write release notes');
  } finally { await close(app); }
});

test('capture save failure keeps the draft and can be retried after storage unlock', async t => {
  const dir = tempDirectory(t);
  let app, lock;
  try {
    let page;
    ({ app, page } = await launch(dir));
    await page.getByText('No next steps yet.').waitFor();
    lock = new DatabaseSync(path.join(dir, 'captures.sqlite'));
    lock.exec('BEGIN EXCLUSIVE');
    await page.getByLabel('Capture a thought').fill('A thought that must not disappear');
    await page.getByRole('button', { name: 'Capture', exact: true }).click();
    await page.getByRole('alert').filter({ hasText: 'Couldn’t save your thought' }).waitFor();
    assert.equal(await page.getByLabel('Capture a thought').inputValue(), 'A thought that must not disappear');
    await page.getByRole('button', { name: 'Add goal', exact: true }).click();
    await page.locator('#goal-title').fill('My goal draft');
    await page.locator('#goal-step').fill('My step draft');
    await page.getByRole('button', { name: 'Save goal', exact: true }).click();
    const goalError = page.getByRole('alert').filter({ hasText: 'Couldn’t save your goal' });
    await goalError.waitFor();
    assert.equal(await page.locator('#goal-title').inputValue(), 'My goal draft');
    assert.equal(await page.locator('#goal-step').inputValue(), 'My step draft');
    assert.equal(await goalError.getByRole('button', { name: 'Retry' }).count(), 0);
    lock.exec('ROLLBACK'); lock.close(); lock = null;
    await page.getByRole('button', { name: 'Capture', exact: true }).click();
    await page.getByLabel('Saved captures').getByText('A thought that must not disappear', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Save goal', exact: true }).click();
    await page.getByRole('button', { name: 'Open My goal draft', exact: true }).waitFor();
  } finally {
    if (lock) { try { lock.exec('ROLLBACK'); } catch {} lock.close(); }
    await close(app);
  }
});

test('a goal without a first step stays available without a fabricated suggestion', async t => {
  const dir = tempDirectory(t);
  let app;
  try {
    let page;
    ({ app, page } = await launch(dir));
    await page.getByRole('button', { name: 'Add goal', exact: true }).click();
    await page.locator('#goal-title').fill('Read a book');
    await page.getByRole('button', { name: 'Save goal', exact: true }).click();
    await page.getByRole('button', { name: 'Open Read a book', exact: true }).waitFor();
    assert.equal(await page.getByText('No next steps yet.').isVisible(), true);
    await page.getByRole('button', { name: 'Open Read a book', exact: true }).click();
    await page.locator('#detail-step').fill('Choose a book');
    await page.getByRole('button', { name: 'Save changes', exact: true }).click();
    await page.getByText('Choose a book', { exact: true }).waitFor();
    await close(app); app = null;
    ({ app, page } = await launch(dir));
    await page.getByText('Choose a book', { exact: true }).waitFor();
  } finally { await close(app); }
});

test('closing the window offers to keep an unsaved draft', async t => {
  const dir = tempDirectory(t);
  let app;
  try {
    let page;
    ({ app, page } = await launch(dir));
    await page.getByLabel('Capture a thought').fill('Unsaved draft');
    await app.evaluate(({ dialog }) => {
      globalThis.draftPrompts = 0;
      dialog.showMessageBoxSync = () => { globalThis.draftPrompts++; return 0; };
    });
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].close());
    await page.waitForFunction(() => document.querySelector('#capture-input')?.value === 'Unsaved draft');
    assert.equal(await app.evaluate(() => globalThis.draftPrompts), 1);
    assert.equal(await page.getByLabel('Capture a thought').inputValue(), 'Unsaved draft');
  } finally { await close(app); }
});

test('failed initial loads disable writes and retry restores existing records and drafts', async t => {
  const dir = tempDirectory(t);
  const dbPath = path.join(dir, 'captures.sqlite');
  const seed = openStore(dbPath);
  seed.saveCapture('Existing capture');
  seed.createGoal('Existing goal', 'Existing next step');
  seed.close();
  let app, lock = new DatabaseSync(dbPath);
  try {
    lock.exec('BEGIN EXCLUSIVE');
    let page;
    ({ app, page } = await launch(dir));
    const goalError = page.getByRole('alert').filter({ hasText: 'Couldn’t load your goals' });
    const captureError = page.getByRole('alert').filter({ hasText: 'Couldn’t load your captures' });
    await goalError.waitFor();
    await captureError.waitFor();
    assert.equal(await page.getByText('No next steps yet.').count(), 0);
    assert.equal(await page.getByRole('button', { name: 'Capture', exact: true }).isDisabled(), true);
    await page.getByLabel('Capture a thought').fill('New capture draft');
    await page.getByRole('button', { name: 'Add goal', exact: true }).click();
    await page.locator('#goal-title').fill('New goal draft');
    assert.equal(await page.getByRole('button', { name: 'Save goal', exact: true }).isDisabled(), true);
    lock.exec('ROLLBACK'); lock.close(); lock = null;
    await goalError.getByRole('button', { name: 'Retry', exact: true }).click();
    await captureError.getByRole('button', { name: 'Retry loading', exact: true }).click();
    await page.getByRole('button', { name: 'Open Existing goal', exact: true }).waitFor();
    await page.getByLabel('Saved captures').getByText('Existing capture', { exact: true }).waitFor();
    assert.equal(await page.getByLabel('Capture a thought').inputValue(), 'New capture draft');
    assert.equal(await page.locator('#goal-title').inputValue(), 'New goal draft');
    assert.equal(await page.getByRole('button', { name: 'Capture', exact: true }).isEnabled(), true);
    assert.equal(await page.getByRole('button', { name: 'Save goal', exact: true }).isEnabled(), true);
  } finally {
    if (lock) { try { lock.exec('ROLLBACK'); } catch {} lock.close(); }
    await close(app);
  }
});

test('typing during a save keeps the new drafts while the submitted records persist', async t => {
  const dir = tempDirectory(t);
  let app;
  try {
    let page;
    ({ app, page } = await launch(dir));
    await page.getByText('No next steps yet.').waitFor();
    await app.evaluate(({ ipcMain }) => {
      for (const channel of ['tgm:save-capture', 'tgm:create-goal']) {
        const original = ipcMain._invokeHandlers.get(channel);
        if (!original) throw new Error(`Missing handler: ${channel}`);
        ipcMain.removeHandler(channel);
        ipcMain.handle(channel, async (...args) => {
          const result = await original(...args);
          await new Promise(resolve => setTimeout(resolve, 1000));
          return result;
        });
      }
    });
    await page.getByLabel('Capture a thought').fill('Submitted capture');
    await page.getByRole('button', { name: 'Capture', exact: true }).click();
    await page.getByRole('button', { name: 'Saving…', exact: true }).waitFor();
    await page.getByLabel('Capture a thought').fill('New capture draft');
    await page.getByLabel('Saved captures').getByText('Submitted capture', { exact: true }).waitFor();
    assert.equal(await page.getByLabel('Capture a thought').inputValue(), 'New capture draft');

    await page.getByRole('button', { name: 'Add goal', exact: true }).click();
    await page.locator('#goal-title').fill('Submitted goal');
    await page.locator('#goal-step').fill('Submitted step');
    await page.getByRole('button', { name: 'Save goal', exact: true }).click();
    await page.getByRole('button', { name: 'Saving…', exact: true }).waitFor();
    await page.locator('#goal-title').fill('New goal draft');
    await page.locator('#goal-step').fill('New step draft');
    await page.getByRole('button', { name: 'Open Submitted goal', exact: true }).waitFor();
    assert.equal(await page.locator('#goal-title').inputValue(), 'New goal draft');
    assert.equal(await page.locator('#goal-step').inputValue(), 'New step draft');
  } finally { await close(app); }
});

for (const scenario of [
  { name: 'new goal title', field: '#goal-title', original: '' },
  { name: 'new goal first step', field: '#goal-step', original: '' },
  { name: 'edited goal title', field: '#detail-title', original: 'Saved goal', edit: true },
  { name: 'edited goal step', field: '#detail-step', original: 'Saved step', edit: true },
]) {
  test(`closing protects an unsaved ${scenario.name} until it is cleared`, async t => {
    const dir = tempDirectory(t);
    let app;
    try {
      let page;
      ({ app, page } = await launch(dir));
      await page.getByRole('button', { name: 'Add goal', exact: true }).click();
      if (scenario.edit) {
        await page.locator('#goal-title').fill('Saved goal');
        await page.locator('#goal-step').fill('Saved step');
        await page.getByRole('button', { name: 'Save goal', exact: true }).click();
        await page.getByRole('button', { name: 'Open Saved goal', exact: true }).click();
      }
      await page.locator(scenario.field).fill('Unsaved goal draft');
      await app.evaluate(({ dialog }) => {
        globalThis.goalDraftPrompts = 0;
        dialog.showMessageBoxSync = () => { globalThis.goalDraftPrompts++; return 0; };
      });
      await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].close());
      assert.equal(await app.evaluate(() => globalThis.goalDraftPrompts), 1);
      assert.equal(await page.locator(scenario.field).inputValue(), 'Unsaved goal draft');

      // Returning the form to its saved or empty state should allow closing.
      await page.locator(scenario.field).fill(scenario.original);
      const closed = page.waitForEvent('close', { timeout: 5000 });
      await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].close());
      await closed;
    } finally { await close(app); }
  });
}
