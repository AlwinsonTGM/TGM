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

test('completed steps persist, can be restored, and do not overwrite newer work', t => {
  const dbPath = temporaryDatabase(t);
  const first = openStore(dbPath);
  const second = openStore(dbPath);
  try {
    const goal = first.createGoal('Learn', 'Read chapter one')[0];
    assert.throws(() => first.completeStep(goal.id, goal.steps[0].id, 'Stale text'), /TGM_GOAL_CONFLICT/);
    const result = first.completeStep(goal.id, goal.steps[0].id, goal.steps[0].text);
    assert.deepEqual(result.goals[0].steps, []);
    assert.equal(result.completed[0].text, 'Read chapter one');
    assert.throws(() => second.completeStep(goal.id, goal.steps[0].id, goal.steps[0].text), /TGM_GOAL_CONFLICT/);
    assert.equal(second.listCompletedSteps()[0].id, goal.steps[0].id);
    second.saveGoalDetails(goal.id, goal.title, null, 'Read chapter two', goal.title, '');
    assert.throws(() => first.restoreStep(goal.id, goal.steps[0].id), /TGM_GOAL_CONFLICT/);
    assert.equal(first.listGoals()[0].steps[0].text, 'Read chapter two');
    assert.equal(first.listCompletedSteps().length, 1);
  } finally { first.close(); second.close(); }
  const reopened = openStore(dbPath);
  try { assert.equal(reopened.listCompletedSteps()[0].text, 'Read chapter one'); }
  finally { reopened.close(); }
});

test('existing version 1 databases migrate without losing active steps', t => {
  const dbPath = temporaryDatabase(t);
  const legacy = new DatabaseSync(dbPath);
  legacy.exec(`CREATE TABLE goals (id INTEGER PRIMARY KEY, title TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1);
    CREATE TABLE steps (id INTEGER PRIMARY KEY, goal_id INTEGER NOT NULL, text TEXT NOT NULL);
    CREATE TABLE captures (id INTEGER PRIMARY KEY, text TEXT NOT NULL, created_at TEXT NOT NULL, goal_id INTEGER, project_id INTEGER, revision INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE projects (id INTEGER PRIMARY KEY, name TEXT NOT NULL, folder TEXT, active INTEGER NOT NULL DEFAULT 1);
    INSERT INTO goals VALUES (1, 'Existing goal', 1); INSERT INTO steps VALUES (1, 1, 'Existing step'); PRAGMA user_version = 1;`);
  legacy.close();
  const store = openStore(dbPath);
  try {
    assert.equal(store.listGoals()[0].steps[0].text, 'Existing step');
    store.completeStep(1, 1, 'Existing step');
    assert.equal(store.listCompletedSteps()[0].text, 'Existing step');
    assert.equal(store.restoreStep(1, 1).goals[0].steps[0].text, 'Existing step');
  } finally { store.close(); }
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

test('migrates old records, preserves links, and rejects stale capture changes', t => {
  const dbPath = temporaryDatabase(t);
  const old = new DatabaseSync(dbPath);
  old.exec(`CREATE TABLE captures (id INTEGER PRIMARY KEY AUTOINCREMENT, text TEXT NOT NULL, created_at TEXT NOT NULL);
    INSERT INTO captures (text, created_at) VALUES ('Old note', '2026-01-01');`);
  old.close();
  const first = openStore(dbPath);
  const second = openStore(dbPath);
  try {
    const note = first.listCaptures()[0];
    assert.equal(note.text, 'Old note');
    assert.equal(note.goalId, null);
    assert.equal(note.projectId, null);
    const goal = first.createGoal('Learn', 'Read')[0];
    const project = first.createProject('Personal study', null)[0];
    const edited = first.updateCapture(note.id, 'Edited', goal.id, null, note.revision);
    assert.equal(edited.goalTitle, 'Learn');
    assert.throws(() => second.updateCapture(note.id, 'Stale', null, null, note.revision), /TGM_CAPTURE_CONFLICT/);
    assert.throws(() => second.deleteCapture(note.id, note.revision), /TGM_CAPTURE_CONFLICT/);
    assert.throws(() => first.updateCapture(note.id, 'Invalid', goal.id, project.id, edited.revision));
    const linked = first.updateCapture(note.id, 'Edited', null, project.id, edited.revision);
    first.updateProject(project.id, project.name, null, false);
    assert.equal(first.listCaptures()[0].targetActive, 0);
    assert.equal(first.updateCapture(note.id, 'Keep archived link', null, project.id, linked.revision).projectName, project.name);
    assert.throws(() => first.updateCapture(note.id, 'No target', null, 9999, linked.revision + 1));
  } finally { first.close(); second.close(); }
  const reopened = openStore(dbPath);
  try { assert.equal(reopened.listCaptures()[0].text, 'Keep archived link'); assert.equal(reopened.listProjects()[0].active, false); }
  finally { reopened.close(); }
});

test('refuses a newer database version without changing its data', t => {
  const dbPath = temporaryDatabase(t);
  const db = new DatabaseSync(dbPath);
  db.exec('CREATE TABLE future_data (value TEXT); INSERT INTO future_data VALUES (\'preserve\'); PRAGMA user_version = 99');
  db.close();
  assert.throws(() => openStore(dbPath), /newer version/);
  const verify = new DatabaseSync(dbPath);
  try { assert.equal(verify.prepare('SELECT value FROM future_data').get().value, 'preserve'); assert.equal(verify.prepare('PRAGMA user_version').get().user_version, 99); }
  finally { verify.close(); }
});
