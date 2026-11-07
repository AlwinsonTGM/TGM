'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { openStore } = require('../electron/store.cjs');

function temporaryDatabase(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tgm-home-store-'));
  t.after(() => {
    const root = fs.realpathSync(os.tmpdir());
    const resolved = fs.realpathSync(dir);
    if (path.dirname(resolved) !== root || !path.basename(resolved).startsWith('tgm-home-store-')) {
      throw new Error(`Refusing to remove unexpected directory: ${resolved}`);
    }
    fs.rmSync(resolved, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  });
  return path.join(dir, 'captures.sqlite');
}

test('captures, goals, and user-provided next steps survive a restart', t => {
  const dbPath = temporaryDatabase(t);
  const first = openStore(dbPath);
  const capture = first.saveCapture('  A thought to keep 🚀  ');
  const goal = first.createGoal('Learn TypeScript', 'Practice generics')[0];
  first.createGoal('Read a paper', '');
  first.close();

  const second = openStore(dbPath);
  try {
    assert.deepEqual(second.listCaptures(), [capture]);
    assert.deepEqual(second.listGoals(), [goal, { id: goal.id + 1, title: 'Read a paper', steps: [] }]);
  } finally { second.close(); }
});

test('invalid inputs are rejected without inserting records', t => {
  const store = openStore(temporaryDatabase(t));
  try {
    for (const value of ['', '   ', '\0', '\ud800', 'x'.repeat(10001), null]) {
      assert.throws(() => store.saveCapture(value));
    }
    assert.throws(() => store.createGoal(' ', 'step'));
    assert.throws(() => store.createGoal('goal', ' '));
    assert.deepEqual(store.listCaptures(), []);
    assert.deepEqual(store.listGoals(), []);
  } finally { store.close(); }
});

test('concurrent goal edits reject stale drafts and roll back changes', t => {
  const dbPath = temporaryDatabase(t);
  const first = openStore(dbPath);
  const second = openStore(dbPath);
  try {
    const goal = first.createGoal('Original', 'Original step')[0];
    second.saveGoalDetails(goal.id, 'Updated', goal.steps[0].id, 'Updated step', goal.title, goal.steps[0].text);
    assert.throws(() => first.saveGoalDetails(goal.id, 'Stale', goal.steps[0].id, 'Stale step', goal.title, goal.steps[0].text), /TGM_GOAL_CONFLICT/);
    assert.deepEqual(first.listGoals(), [{ id: goal.id, title: 'Updated', steps: [{ id: goal.steps[0].id, text: 'Updated step' }] }]);
    second.saveGoalDetails(goal.id, 'Updated', goal.steps[0].id, 'Changed elsewhere', 'Updated', 'Updated step');
    assert.throws(() => first.saveGoalDetails(goal.id, 'Must roll back', goal.steps[0].id, 'Old draft', 'Updated', 'Updated step'), /TGM_GOAL_CONFLICT/);
    assert.equal(first.listGoals()[0].title, 'Updated');
    assert.equal(first.listGoals()[0].steps[0].text, 'Changed elsewhere');
  } finally { first.close(); second.close(); }
});

test('storage lock surfaces a failure and allows a retry after unlock', t => {
  const dbPath = temporaryDatabase(t);
  const store = openStore(dbPath);
  const lock = new DatabaseSync(dbPath);
  try {
    lock.exec('BEGIN EXCLUSIVE');
    assert.throws(() => store.saveCapture('Keep this draft'));
    lock.exec('ROLLBACK');
    store.saveCapture('Keep this draft');
    assert.equal(store.listCaptures()[0].text, 'Keep this draft');
  } finally { lock.close(); store.close(); }
});
