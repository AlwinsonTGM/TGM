'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { _electron } = require('playwright');
const { DatabaseSync } = require('node:sqlite');
const entry = path.resolve(__dirname, '../electron/main.cjs');

async function launch(dir) {
  const app = await _electron.launch({
    executablePath: require('electron'),
    args: [entry],
    env: { ...process.env, NODE_ENV: 'test', TGM_TEST_USER_DATA: dir },
  });
  return { app, page: await app.firstWindow() };
}
async function close(app) {
  if (!app) return;
  // Test teardown discards disposable drafts after assertions have finished.
  try { await app.evaluate(({ dialog }) => { dialog.showMessageBoxSync = () => 1; }); } catch {}
  await app.close();
}
function cleanup(dir) {
  const root = fs.realpathSync(os.tmpdir());
  const real = fs.realpathSync(dir);
  const rel = path.relative(root, real);
  if (
    !rel ||
    rel.startsWith('..') ||
    path.isAbsolute(rel) ||
    !path.basename(real).startsWith('tgm-goals-')
  ) {
    throw new Error('Unsafe temporary directory');
  }
  fs.rmSync(real, { recursive: true, force: true, maxRetries: 5, retryDelay: 150 });
}

test('goal and optional next step create a suggestion that survives restart', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tgm-goals-create-'));
  let app;
  try {
    let page;
    ({ app, page } = await launch(dir));
    await page.getByText('Your next step starts here.').waitFor();
    await page.getByLabel('Goal title', { exact: true }).fill('Learn TypeScript');
    await page.getByLabel('First next step (optional)').fill('Practice functions');
    await page.getByRole('button', { name: 'Save goal', exact: true }).click();
    await page.getByRole('button', { name: 'Open Practice functions' }).waitFor();
    assert.equal(await page.getByText('Learn TypeScript', { exact: true }).first().isVisible(), true);
    await close(app);
    app = null;
    ({ app, page } = await launch(dir));
    await page.getByRole('button', { name: 'Open Practice functions' }).waitFor();
    assert.equal(await page.getByText('Learn TypeScript', { exact: true }).first().isVisible(), true);
  } finally {
    await close(app);
    cleanup(dir);
  }
});

test('goal created without a step survives restart on its own, can have a next step added later, and updates suggestions', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tgm-goals-add-step-'));
  let app;
  try {
    let page;
    ({ app, page } = await launch(dir));
    const addForm = page.getByRole('form', { name: 'Add a goal', exact: true });
    await addForm.getByLabel('Goal title', { exact: true }).fill('Read more books');
    await addForm.getByRole('button', { name: 'Save goal', exact: true }).click();

    await page.getByRole('button', { name: 'Add a next step to Read more books', exact: true }).waitFor();
    assert.equal(await page.getByText('Your next step starts here.').isVisible(), true);
    assert.equal(await page.locator('.suggestions li').count(), 0);

    await close(app);
    app = null;
    ({ app, page } = await launch(dir));

    const addStepBtn = page.getByRole('button', { name: 'Add a next step to Read more books', exact: true });
    await addStepBtn.waitFor();
    assert.equal(await page.getByText('Your next step starts here.').isVisible(), true);
    assert.equal(await page.locator('.suggestions li').count(), 0);
    await addStepBtn.click();

    const detailForm = page.getByRole('form', { name: 'Goal and step details', exact: true });
    await detailForm.waitFor();
    assert.equal(await detailForm.getByLabel('Goal title', { exact: true }).inputValue(), 'Read more books');
    await detailForm.getByLabel('Next step', { exact: true }).fill('Pick a short novel');
    await detailForm.getByRole('button', { name: 'Save changes', exact: true }).click();

    await page.getByRole('button', { name: 'Open Pick a short novel', exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Add a next step to Read more books', exact: true }).count(), 0);
    assert.equal(await page.getByText('Read more books', { exact: true }).first().isVisible(), true);

    await close(app);
    app = null;
    ({ app, page } = await launch(dir));
    await page.getByRole('button', { name: 'Open Pick a short novel', exact: true }).waitFor();
    assert.equal(await page.getByText('Read more books', { exact: true }).first().isVisible(), true);
  } finally {
    await close(app);
    cleanup(dir);
  }
});

test('opening a suggestion without saving does not mutate record, while saving edits persists across restart', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tgm-goals-edit-'));
  let app;
  try {
    let page;
    ({ app, page } = await launch(dir));
    const addForm = page.getByRole('form', { name: 'Add a goal', exact: true });
    await addForm.getByLabel('Goal title', { exact: true }).fill('Build side project');
    await addForm.getByLabel('First next step (optional)', { exact: true }).fill('Draft requirements');
    await addForm.getByRole('button', { name: 'Save goal', exact: true }).click();

    const openBtn = page.getByRole('button', { name: 'Open Draft requirements', exact: true });
    await openBtn.waitFor();
    await openBtn.click();

    let detailForm = page.getByRole('form', { name: 'Goal and step details', exact: true });
    await detailForm.waitFor();
    assert.equal(await detailForm.getByLabel('Goal title', { exact: true }).inputValue(), 'Build side project');
    assert.equal(await detailForm.getByLabel('Next step', { exact: true }).inputValue(), 'Draft requirements');

    await detailForm.getByLabel('Goal title', { exact: true }).fill('Unsaved goal title');
    await detailForm.getByLabel('Next step', { exact: true }).fill('Unsaved step');
    page.once('dialog', (dialog) => dialog.accept());
    await detailForm.getByRole('button', { name: 'Close details', exact: true }).click();
    assert.equal(await page.getByRole('form', { name: 'Goal and step details', exact: true }).count(), 0);
    assert.equal(await page.getByText('Build side project', { exact: true }).first().isVisible(), true);

    await close(app);
    app = null;
    ({ app, page } = await launch(dir));
    const openBtnAfterView = page.getByRole('button', { name: 'Open Draft requirements', exact: true });
    await openBtnAfterView.waitFor();
    assert.equal(await page.getByText('Build side project', { exact: true }).first().isVisible(), true);

    await openBtnAfterView.click();
    detailForm = page.getByRole('form', { name: 'Goal and step details', exact: true });
    await detailForm.waitFor();
    assert.equal(await detailForm.getByLabel('Goal title', { exact: true }).inputValue(), 'Build side project');
    assert.equal(await detailForm.getByLabel('Next step', { exact: true }).inputValue(), 'Draft requirements');

    await detailForm.getByLabel('Goal title', { exact: true }).fill('Ship side project');
    await detailForm.getByLabel('Next step', { exact: true }).fill('Write release notes');
    await detailForm.getByRole('button', { name: 'Save changes', exact: true }).click();

    await page.getByRole('button', { name: 'Open Write release notes', exact: true }).waitFor();
    assert.equal(await page.getByText('Ship side project', { exact: true }).first().isVisible(), true);

    await close(app);
    app = null;
    ({ app, page } = await launch(dir));
    const editedOpenBtn = page.getByRole('button', { name: 'Open Write release notes', exact: true });
    await editedOpenBtn.waitFor();
    assert.equal(await page.getByText('Ship side project', { exact: true }).first().isVisible(), true);

    await editedOpenBtn.click();
    detailForm = page.getByRole('form', { name: 'Goal and step details', exact: true });
    await detailForm.waitFor();
    assert.equal(await detailForm.getByLabel('Goal title', { exact: true }).inputValue(), 'Ship side project');
    assert.equal(await detailForm.getByLabel('Next step', { exact: true }).inputValue(), 'Write release notes');
  } finally {
    await close(app);
    cleanup(dir);
  }
});

test('closing or switching a dirty goal asks before discarding its draft', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tgm-goals-unsaved-'));
  let app;
  try {
    let page;
    ({ app, page } = await launch(dir));
    const addForm = page.getByRole('form', { name: 'Add a goal', exact: true });
    for (const [title, step] of [['First goal', 'First step'], ['Second goal', 'Second step']]) {
      await addForm.getByLabel('Goal title', { exact: true }).fill(title);
      await addForm.getByLabel('First next step (optional)', { exact: true }).fill(step);
      await addForm.getByRole('button', { name: 'Save goal', exact: true }).click();
      await page.getByRole('button', { name: `Open ${step}`, exact: true }).waitFor();
    }
    await page.getByRole('button', { name: 'Open First step', exact: true }).click();
    let detailForm = page.getByRole('form', { name: 'Goal and step details', exact: true });
    await detailForm.getByLabel('Next step', { exact: true }).fill('My unfinished edit');

    page.once('dialog', (dialog) => dialog.dismiss());
    await detailForm.getByRole('button', { name: 'Close details', exact: true }).click();
    assert.equal(await detailForm.getByLabel('Next step', { exact: true }).inputValue(), 'My unfinished edit');

    page.once('dialog', (dialog) => dialog.dismiss());
    await page.getByRole('button', { name: 'Open Second step', exact: true }).click();
    assert.equal(await detailForm.getByLabel('Next step', { exact: true }).inputValue(), 'My unfinished edit');
    assert.equal(await detailForm.getByLabel('Goal title', { exact: true }).inputValue(), 'First goal');

    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: 'Open Second step', exact: true }).click();
    detailForm = page.getByRole('form', { name: 'Goal and step details', exact: true });
    assert.equal(await detailForm.getByLabel('Goal title', { exact: true }).inputValue(), 'Second goal');
    await page.getByRole('button', { name: 'Open First step', exact: true }).click();
    assert.equal(await detailForm.getByLabel('Next step', { exact: true }).inputValue(), 'First step');
  } finally {
    await close(app);
    cleanup(dir);
  }
});

test('closing the window with a dirty goal offers to keep editing or discard', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tgm-goals-window-close-'));
  let app;
  try {
    let page;
    ({ app, page } = await launch(dir));
    const addForm = page.getByRole('form', { name: 'Add a goal', exact: true });
    await addForm.getByLabel('Goal title', { exact: true }).fill('Window goal');
    await addForm.getByLabel('First next step (optional)', { exact: true }).fill('Window step');
    await addForm.getByRole('button', { name: 'Save goal', exact: true }).click();
    await page.getByRole('button', { name: 'Open Window step', exact: true }).click();
    const detailForm = page.getByRole('form', { name: 'Goal and step details', exact: true });
    await detailForm.getByLabel('Next step', { exact: true }).fill('Unsaved window draft');

    await app.evaluate(({ dialog }) => {
      globalThis.testCloseChoice = 0;
      globalThis.testClosePrompts = 0;
      dialog.showMessageBoxSync = () => { globalThis.testClosePrompts++; return globalThis.testCloseChoice; };
    });
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].close());
    await page.waitForFunction(() => document.querySelector('#detail-step')?.value === 'Unsaved window draft');
    assert.equal(await app.evaluate(() => globalThis.testClosePrompts), 1);
    assert.equal(await detailForm.getByLabel('Next step', { exact: true }).inputValue(), 'Unsaved window draft');

    await app.evaluate(() => { globalThis.testCloseChoice = 1; });
    const closed = page.waitForEvent('close');
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].close());
    await closed;
  } finally {
    if (app) {
      try { await app.evaluate(() => { globalThis.testCloseChoice = 1; }); } catch {}
    }
    await close(app);
    cleanup(dir);
  }
});

test('rejected validation for blank goal title or step preserves user inputs in create and detail forms', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tgm-goals-validation-'));
  let app;
  try {
    let page;
    ({ app, page } = await launch(dir));
    const addForm = page.getByRole('form', { name: 'Add a goal', exact: true });
    await addForm.getByLabel('Goal title', { exact: true }).fill('   ');
    await addForm.getByLabel('First next step (optional)', { exact: true }).fill('Sketch wireframes');
    await addForm.getByRole('button', { name: 'Save goal', exact: true }).click();

    const createValidationError = addForm.getByRole('alert').or(page.getByRole('alert')).first();
    await createValidationError.waitFor({ state: 'visible' });
    assert.equal(await createValidationError.isVisible(), true);
    assert.equal(await addForm.getByLabel('Goal title', { exact: true }).inputValue(), '   ');
    assert.equal(await addForm.getByLabel('First next step (optional)', { exact: true }).inputValue(), 'Sketch wireframes');
    assert.equal(await page.getByRole('button', { name: 'Open Sketch wireframes', exact: true }).count(), 0);

    await addForm.getByLabel('Goal title', { exact: true }).fill('Design system');
    await addForm.getByRole('button', { name: 'Save goal', exact: true }).click();

    const openBtn = page.getByRole('button', { name: 'Open Sketch wireframes', exact: true });
    await openBtn.waitFor();
    await openBtn.click();

    const detailForm = page.getByRole('form', { name: 'Goal and step details', exact: true });
    await detailForm.waitFor();
    await detailForm.getByLabel('Goal title', { exact: true }).fill('   ');
    await detailForm.getByLabel('Next step', { exact: true }).fill('Audit tokens');
    await detailForm.getByRole('button', { name: 'Save changes', exact: true }).click();

    const detailValidationError = detailForm.getByRole('alert').or(page.getByRole('alert')).first();
    await detailValidationError.waitFor({ state: 'visible' });
    assert.equal(await detailValidationError.isVisible(), true);
    assert.equal(await detailForm.getByLabel('Goal title', { exact: true }).inputValue(), '   ');
    assert.equal(await detailForm.getByLabel('Next step', { exact: true }).inputValue(), 'Audit tokens');

    await close(app);
    app = null;
    ({ app, page } = await launch(dir));
    await page.getByRole('button', { name: 'Open Sketch wireframes', exact: true }).waitFor();
    assert.equal(await page.getByText('Design system', { exact: true }).first().isVisible(), true);
  } finally {
    await close(app);
    cleanup(dir);
  }
});

test('SQLite write failure with BEGIN EXCLUSIVE preserves inputs in create and detail forms and succeeds on retry after unlock', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tgm-goals-sqlite-lock-'));
  let app;
  let lockDb;
  let locked = false;
  try {
    let page;
    ({ app, page } = await launch(dir));
    const addForm = page.getByRole('form', { name: 'Add a goal', exact: true });
    await addForm.waitFor({ state: 'visible' });
    await page.getByText(/no goals|first goal|add a goal to get started/i).first().waitFor({ state: 'visible' });

    const dbPath = path.join(dir, 'captures.sqlite');
    lockDb = new DatabaseSync(dbPath);
    lockDb.exec('BEGIN EXCLUSIVE');
    locked = true;

    await addForm.getByLabel('Goal title', { exact: true }).fill('Learn Rust');
    await addForm.getByLabel('First next step (optional)', { exact: true }).fill('Read chapter 1');
    await addForm.getByRole('button', { name: 'Save goal', exact: true }).click();

    const saveAlert = page.getByRole('alert').filter({ hasText: /Could not save your goal/ });
    await saveAlert.waitFor({ state: 'visible' });
    assert.equal(await saveAlert.isVisible(), true);
    assert.equal(await addForm.getByLabel('Goal title', { exact: true }).inputValue(), 'Learn Rust');
    assert.equal(await addForm.getByLabel('First next step (optional)', { exact: true }).inputValue(), 'Read chapter 1');
    assert.equal(await page.getByRole('button', { name: 'Open Read chapter 1', exact: true }).count(), 0);

    lockDb.exec('ROLLBACK');
    locked = false;

    await addForm.getByRole('button', { name: 'Save goal', exact: true }).click();
    const openStepBtn = page.getByRole('button', { name: 'Open Read chapter 1', exact: true });
    await openStepBtn.waitFor({ state: 'visible' });
    assert.equal(await page.getByText('Learn Rust', { exact: true }).first().isVisible(), true);

    await openStepBtn.click();
    const detailForm = page.getByRole('form', { name: 'Goal and step details', exact: true });
    await detailForm.waitFor({ state: 'visible' });
    await detailForm.getByLabel('Goal title', { exact: true }).fill('Learn Rust deeply');
    await detailForm.getByLabel('Next step', { exact: true }).fill('Ownership exercises');

    lockDb.exec('BEGIN EXCLUSIVE');
    locked = true;
    await detailForm.getByRole('button', { name: 'Save changes', exact: true }).click();

    const detailSaveAlert = page.getByRole('alert').filter({ hasText: /Could not save your changes/ });
    await detailSaveAlert.waitFor({ state: 'visible' });
    assert.equal(await detailForm.getByLabel('Goal title', { exact: true }).inputValue(), 'Learn Rust deeply');
    assert.equal(await detailForm.getByLabel('Next step', { exact: true }).inputValue(), 'Ownership exercises');

    lockDb.exec('ROLLBACK');
    locked = false;
    lockDb.close();
    lockDb = null;

    await detailForm.getByRole('button', { name: 'Save changes', exact: true }).click();
    await page.getByRole('button', { name: 'Open Ownership exercises', exact: true }).waitFor({ state: 'visible' });

    await close(app);
    app = null;
    ({ app, page } = await launch(dir));
    await page.getByRole('button', { name: 'Open Ownership exercises', exact: true }).waitFor({ state: 'visible' });
    assert.equal(await page.getByText('Learn Rust deeply', { exact: true }).first().isVisible(), true);
  } finally {
    if (lockDb) {
      try {
        if (locked) lockDb.exec('ROLLBACK');
      } catch {}
      try {
        lockDb.close();
      } catch {}
    }
    await close(app);
    cleanup(dir);
  }
});

test('goal load failure displays error without claiming empty state and recovers on retry', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tgm-goals-load-error-'));
  const blockedDatabase = path.join(dir, 'captures.sqlite');
  let app;
  try {
    fs.mkdirSync(blockedDatabase);
    let page;
    ({ app, page } = await launch(dir));
    await page.getByText('Could not load your goals. Your saved data may still be there.').waitFor();
    assert.equal(await page.getByText('Your next step starts here.').count(), 0);
    assert.equal(await page.getByRole('button', { name: 'Save goal', exact: true }).isDisabled(), true);

    fs.rmdirSync(blockedDatabase);
    await page.getByRole('button', { name: 'Retry loading goals', exact: true }).click();
    await page.getByText('Your next step starts here.').waitFor();
    assert.equal(await page.getByRole('button', { name: 'Save goal', exact: true }).isEnabled(), true);
  } finally {
    if (fs.existsSync(blockedDatabase) && fs.lstatSync(blockedDatabase).isDirectory()) {
      fs.rmdirSync(blockedDatabase);
    }
    await close(app);
    cleanup(dir);
  }
});

test('goal and step with leading/trailing spaces and Unicode/emoji survive restart with exact detail input values', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tgm-goals-unicode-spaces-'));
  const rawGoal = '  练习中文 Café 🎯  ';
  const rawStep = '  Lire résumé 🚀  ';
  let app;
  try {
    let page;
    ({ app, page } = await launch(dir));
    const addForm = page.getByRole('form', { name: 'Add a goal', exact: true });
    await addForm.getByLabel('Goal title', { exact: true }).fill(rawGoal);
    await addForm.getByLabel('First next step (optional)', { exact: true }).fill(rawStep);
    await addForm.getByRole('button', { name: 'Save goal', exact: true }).click();

    await page.getByRole('button', { name: /^Open\s+Lire résumé 🚀\s*$/ }).waitFor({ state: 'visible' });

    await close(app);
    app = null;
    ({ app, page } = await launch(dir));

    const openBtn = page.getByRole('button', { name: /^Open\s+Lire résumé 🚀\s*$/ });
    await openBtn.waitFor({ state: 'visible' });
    await openBtn.click();

    const detailForm = page.getByRole('form', { name: 'Goal and step details', exact: true });
    await detailForm.waitFor({ state: 'visible' });
    assert.equal(await detailForm.getByLabel('Goal title', { exact: true }).inputValue(), rawGoal);
    assert.equal(await detailForm.getByLabel('Next step', { exact: true }).inputValue(), rawStep);
  } finally {
    await close(app);
    cleanup(dir);
  }
});

test('editing create form inputs while a delayed save is in flight saves submitted goal and retains new drafts', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tgm-goals-inflight-draft-'));
  let app;
  try {
    let page;
    ({ app, page } = await launch(dir));
    const addForm = page.getByRole('form', { name: 'Add a goal', exact: true });
    await addForm.waitFor({ state: 'visible' });

    await app.evaluate(({ ipcMain }) => {
      const channel = 'tgm:create-goal';
      const handlers = ipcMain._invokeHandlers;
      const original = handlers && typeof handlers.get === 'function' ? handlers.get(channel) : null;
      if (!original) throw new Error(`Missing handler for ${channel}`);
      ipcMain.removeHandler(channel);
      ipcMain.handle(channel, async (event, ...args) => {
        await new Promise((resolve) => setTimeout(resolve, 500));
        return original(event, ...args);
      });
    });

    const goalInput = addForm.getByLabel('Goal title', { exact: true });
    const stepInput = addForm.getByLabel('First next step (optional)', { exact: true });

    await goalInput.fill('Submitted goal');
    await stepInput.fill('Submitted step');
    await addForm.getByRole('button', { name: 'Save goal', exact: true }).click();

    await goalInput.fill('New draft goal');
    await stepInput.fill('New draft step');

    await page.getByRole('button', { name: 'Open Submitted step', exact: true }).waitFor({ state: 'visible' });
    assert.equal(await page.getByText('Submitted goal', { exact: true }).first().isVisible(), true);
    assert.equal(await goalInput.inputValue(), 'New draft goal');
    assert.equal(await stepInput.inputValue(), 'New draft step');
  } finally {
    await close(app);
    cleanup(dir);
  }
});
