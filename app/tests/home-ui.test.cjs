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
    await page.getByRole('button', { name: 'Edit Learn TypeScript', exact: true }).click();
    assert.equal(await page.locator('#detail-title').inputValue(), 'Learn TypeScript');
    assert.equal(await page.locator('#detail-step').inputValue(), 'Practice generics');

    await page.locator('#detail-title').fill('Discard this edit');
    page.once('dialog', dialog => dialog.accept());
    await page.getByRole('button', { name: 'Close details', exact: true }).click();
    await close(app); app = null;

    ({ app, page } = await launch(dir));
    await page.getByLabel('Saved captures').getByText('Remember this thought', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Edit Learn TypeScript', exact: true }).click();
    assert.equal(await page.locator('#detail-title').inputValue(), 'Learn TypeScript');
    assert.equal(await page.locator('#detail-step').inputValue(), 'Practice generics');
    await page.locator('#detail-title').fill('Ship a TypeScript project');
    await page.locator('#detail-step').fill('Write release notes');
    await page.getByRole('button', { name: 'Save changes', exact: true }).click();
    await page.getByText('Changes saved.', { exact: true }).waitFor();
    await close(app); app = null;

    ({ app, page } = await launch(dir));
    await page.getByRole('button', { name: 'Edit Ship a TypeScript project', exact: true }).click();
    assert.equal(await page.locator('#detail-step').inputValue(), 'Write release notes');
  } finally { await close(app); }
});

test('a step carries its context into independent work or a selected harness', async t => {
  const dir = tempDirectory(t);
  let app;
  try {
    let page;
    ({ app, page } = await launch(dir));
    await page.getByRole('button', { name: 'Add goal', exact: true }).click();
    assert.equal(await page.locator('#goal-title').evaluate(el => el === document.activeElement), true);
    await page.locator('#goal-title').fill('Learn TypeScript');
    await page.locator('#goal-step').fill('Practice generics');
    await page.getByRole('button', { name: 'Save goal', exact: true }).click();
    await page.getByRole('button', { name: 'Start Learn TypeScript' }).click();
    await page.getByRole('button', { name: 'Work independently' }).click();
    await page.locator('#independent-heading').waitFor();
    assert.match(await page.locator('.focus-panel').innerText(), /Timing and session history are not connected/);
    await page.getByRole('button', { name: 'Start Learn TypeScript' }).click();
    await page.getByRole('button', { name: 'Antigravity CLI' }).click();
    await page.getByRole('heading', { name: 'Workspace' }).waitFor();
    assert.equal(await page.locator('#harness').inputValue(), 'agy');
    assert.match(await page.locator('.work-context').innerText(), /Practice generics/);
    assert.equal(await page.getByRole('button', { name: 'Start terminal' }).isDisabled(), true);
    await page.getByRole('button', { name: 'Home', exact: true }).first().click();
    await page.getByRole('button', { name: 'Start Learn TypeScript' }).click();
    await page.getByRole('button', { name: 'OpenCode', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('#harness')?.value === 'opencode');
  } finally { await close(app); }
});

test('completion persists, can be restored, and leaves the goal ready for a new step', async t => {
  const dir = tempDirectory(t);
  let app;
  try {
    let page;
    ({ app, page } = await launch(dir));
    await page.getByRole('button', { name: 'Add goal', exact: true }).click();
    await page.locator('#goal-title').fill('Study');
    await page.locator('#goal-step').fill('Read chapter one');
    await page.getByRole('button', { name: 'Save goal', exact: true }).click();
    await page.getByRole('button', { name: 'Start Study' }).click();
    await page.getByRole('button', { name: 'Work independently' }).click();
    await page.getByRole('button', { name: 'Complete step' }).click();
    await page.getByText('Step completed. Add another next step when you’re ready.').waitFor();
    assert.equal(await page.getByRole('button', { name: 'Start Study' }).count(), 0);
    await close(app); app = null;
    ({ app, page } = await launch(dir));
    await page.getByText('Completed steps (1)').click();
    await page.getByRole('button', { name: 'Restore Read chapter one' }).click();
    await page.getByRole('button', { name: 'Start Study' }).click();
    await page.getByRole('button', { name: 'OpenCode', exact: true }).click();
    await app.evaluate(({ ipcMain }) => { ipcMain.removeHandler('terminal:clipboard-write'); ipcMain.handle('terminal:clipboard-write', (_event, text) => { globalThis.copiedStep = text; }); });
    await page.getByRole('button', { name: 'Copy step' }).click();
    await page.getByText('Step copied. Paste it when you’re ready.').waitFor();
    assert.equal(await app.evaluate(() => globalThis.copiedStep), 'Read chapter one');
    await page.getByRole('button', { name: 'Complete step' }).click();
    await page.locator('.workspace').getByText('Step completed. Add another next step when you’re ready.').waitFor();
    await page.getByRole('button', { name: 'Home', exact: true }).first().click();
    await page.getByRole('button', { name: 'Open Study' }).click();
    await page.locator('#detail-step').fill('Read chapter two');
    await page.getByRole('button', { name: 'Save changes' }).click();
    await page.getByText('Read chapter two', { exact: true }).waitFor();
  } finally { await close(app); }
});

test('Home keeps long lists manageable and keeps goal controls beside their row', async t => {
  const dir = tempDirectory(t);
  const seed = openStore(path.join(dir, 'captures.sqlite'));
  for (let i = 1; i <= 5; i++) seed.createGoal(`Goal ${i}`, `Step ${i}`);
  for (let i = 1; i <= 4; i++) seed.createGoal(`Waiting ${i}`, '');
  for (let i = 1; i <= 7; i++) seed.saveCapture(`Thought ${i}`);
  seed.saveCapture('First line\nSecond line\nThird line\nFourth line\nFifth line');
  seed.close();
  let app;
  try {
    let page;
    ({ app, page } = await launch(dir));
    await page.getByRole('button', { name: 'Show all 5 steps' }).click();
    const fifth = page.locator('#suggested-steps > div').filter({ hasText: 'Goal 5' });
    await fifth.getByRole('button', { name: 'Start Goal 5' }).click();
    assert.equal(await fifth.getByText('How would you like to work?').isVisible(), true);
    await fifth.getByRole('button', { name: 'Cancel' }).click();
    await fifth.getByRole('button', { name: 'Edit Goal 5' }).click();
    await fifth.locator('#detail-step').fill('A draft');
    page.once('dialog', dialog => dialog.dismiss());
    await page.getByRole('button', { name: 'Show fewer steps' }).click();
    assert.equal(await fifth.locator('#detail-step').inputValue(), 'A draft');
    page.once('dialog', dialog => dialog.accept());
    await page.getByRole('button', { name: 'Show fewer steps' }).click();
    assert.equal(await page.getByRole('button', { name: 'Start Goal 5' }).count(), 0);
    assert.equal(await page.getByRole('button', { name: 'Open Waiting 4' }).count(), 0);
    await page.getByRole('button', { name: 'Show all 4 goals' }).click();
    await page.getByRole('button', { name: 'Open Waiting 4' }).waitFor();

    assert.equal(await page.getByLabel('Saved captures').locator('li').count(), 5);
    assert.equal(await page.getByText('Fifth line', { exact: false }).count(), 0);
    await page.getByRole('button', { name: /Show full thought: First line/ }).click();
    assert.equal(await page.getByText('Fifth line', { exact: false }).isVisible(), true);
    await page.getByRole('button', { name: /Show less: First line/ }).click();
    await page.getByLabel('Find a saved thought').fill('Thought 1');
    await page.getByLabel('Saved captures').getByText('Thought 1', { exact: true }).waitFor();
    assert.equal(await page.getByLabel('Saved captures').locator('li').count(), 1);
    await page.getByLabel('Find a saved thought').fill('no match');
    await page.getByText('No saved thoughts match your search.').waitFor();
    await page.getByLabel('Find a saved thought').clear();
    await page.getByRole('button', { name: 'Show all 8 thoughts' }).click();
    assert.equal(await page.getByLabel('Saved captures').locator('li').count(), 8);
    await page.getByRole('button', { name: 'Projects', exact: true }).click();
    await page.getByLabel('New project name').waitFor();
    assert.equal(await page.getByLabel('New project name').evaluate(el => el === document.activeElement), true);
  } finally { await close(app); }
});

test('a failed completion preserves the active step and can be retried', async t => {
  const dir = tempDirectory(t);
  const seed = openStore(path.join(dir, 'captures.sqlite'));
  seed.createGoal('Study', 'Read chapter one');
  seed.close();
  let app, lock;
  try {
    let page;
    ({ app, page } = await launch(dir));
    await page.getByRole('button', { name: 'Start Study' }).click();
    await page.getByRole('button', { name: 'Work independently' }).click();
    lock = new DatabaseSync(path.join(dir, 'captures.sqlite'));
    lock.exec('BEGIN EXCLUSIVE');
    await page.getByRole('button', { name: 'Complete step' }).click();
    await page.getByText('Couldn’t complete this step. It is still active; try again.').waitFor();
    assert.equal(await page.locator('#independent-heading').innerText(), 'Read chapter one');
    lock.exec('ROLLBACK'); lock.close(); lock = null;
    await page.getByRole('button', { name: 'Complete step' }).click();
    await page.getByText('Step completed. Add another next step when you’re ready.').waitFor();
  } finally { if (lock) { try { lock.exec('ROLLBACK'); } catch {} lock.close(); } await close(app); }
});

test('captures can be edited, attached to projects and goals, and deleted', async t => {
  const dir = tempDirectory(t);
  let app;
  try {
    let page;
    ({ app, page } = await launch(dir));
    await page.getByRole('button', { name: 'Add goal', exact: true }).click();
    await page.locator('#goal-title').fill('Study');
    await page.getByRole('button', { name: 'Save goal', exact: true }).click();
    await page.getByRole('button', { name: 'Manage projects' }).click();
    await page.getByLabel('New project name').fill('Personal project');
    await page.getByRole('button', { name: 'Create project' }).click();
    await page.getByText('Project created.').waitFor();
    await page.getByLabel('Capture a thought').fill('Original thought');
    await page.getByRole('button', { name: 'Capture', exact: true }).click();
    await page.getByRole('button', { name: 'Edit capture: Original thought' }).click();
    await page.getByLabel('Edit capture').fill('Revised thought');
    await page.getByLabel('Attach to').selectOption({ label: 'Personal project' });
    await page.getByRole('button', { name: 'Save capture' }).click();
    await page.getByText('Project: Personal project').waitFor();
    await page.getByRole('button', { name: 'Archive project: Personal project' }).click();
    await page.getByText('Project: Personal project (archived)').waitFor();
    await page.getByRole('button', { name: 'Restore project: Personal project' }).click();
    await page.getByRole('button', { name: 'Edit capture: Revised thought' }).click();
    await page.getByLabel('Attach to').selectOption({ label: 'Study' });
    await page.getByRole('button', { name: 'Save capture' }).click();
    await page.getByText('Goal: Study').waitFor();
    await close(app); app = null;
    ({ app, page } = await launch(dir));
    await page.getByText('Goal: Study').waitFor();
    page.once('dialog', dialog => dialog.accept());
    await page.getByRole('button', { name: 'Delete capture: Revised thought' }).click();
    await page.getByText('Capture deleted.').waitFor();
    assert.equal(await page.getByLabel('Saved captures').count(), 0);
  } finally { await close(app); }
});

test('a failed capture edit retains its draft and can be retried', async t => {
  const dir = tempDirectory(t);
  let app, lock;
  try {
    let page;
    ({ app, page } = await launch(dir));
    await page.getByLabel('Capture a thought').fill('Saved thought');
    await page.getByRole('button', { name: 'Capture', exact: true }).click();
    await page.getByRole('button', { name: 'Edit capture: Saved thought' }).click();
    await page.getByLabel('Edit capture').fill('Draft to keep');
    lock = new DatabaseSync(path.join(dir, 'captures.sqlite'));
    lock.exec('BEGIN EXCLUSIVE');
    await page.getByRole('button', { name: 'Save capture' }).click();
    await page.getByText(/Couldn’t save this capture/).waitFor();
    assert.equal(await page.getByLabel('Edit capture').inputValue(), 'Draft to keep');
    lock.exec('ROLLBACK'); lock.close(); lock = null;
    await page.getByRole('button', { name: 'Save capture' }).click();
    await page.getByRole('button', { name: 'Edit capture: Draft to keep' }).waitFor();
  } finally { if (lock) { try { lock.exec('ROLLBACK'); } catch {} lock.close(); } await close(app); }
});

test('Home and work choices reflow at 200 percent zoom', async t => {
  const dir = tempDirectory(t);
  let app;
  try {
    let page;
    ({ app, page } = await launch(dir));
    await page.getByRole('button', { name: 'Add goal', exact: true }).click();
    await page.locator('#goal-title').fill('A study goal');
    await page.locator('#goal-step').fill('A small next step');
    await page.getByRole('button', { name: 'Save goal', exact: true }).click();
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.setZoomFactor(2));
    await page.getByRole('button', { name: 'Start A study goal' }).click();
    await page.getByRole('button', { name: 'Work independently' }).waitFor();
    const overflow = await page.evaluate(() => ({ width: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
    assert.ok(overflow.scroll <= overflow.width + 1, JSON.stringify(overflow));
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
    await page.getByRole('button', { name: 'Edit My goal draft', exact: true }).waitFor();
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
    await page.getByRole('button', { name: 'Edit Existing goal', exact: true }).waitFor();
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
    await page.getByRole('button', { name: 'Edit Submitted goal', exact: true }).waitFor();
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
        await page.getByRole('button', { name: 'Edit Saved goal', exact: true }).click();
      }
      await page.locator(scenario.field).fill('Unsaved goal draft');
      await app.evaluate(({ dialog }) => {
        globalThis.goalDraftPrompts = 0;
        dialog.showMessageBoxSync = () => { globalThis.goalDraftPrompts++; return 0; };
      });
      await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].close());
      const deadline = Date.now() + 5000;
      while (await app.evaluate(() => globalThis.goalDraftPrompts) === 0 && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 25));
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
