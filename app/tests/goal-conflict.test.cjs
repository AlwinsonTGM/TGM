'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const { makeGoals } = require('../electron/goals.cjs');

test('stale edits cannot overwrite a goal or a changed step', () => {
  const db = new DatabaseSync(':memory:');
  try {
    const repo = makeGoals(db);
    const original = repo.create('Original', 'Original step')[0];
    const id = original.steps[0].id;
    repo.saveDetails(original.id, 'New goal', id, 'New step', 'Original', 'Original step');
    assert.throws(() => repo.saveDetails(original.id, 'Stale goal', id, 'Stale step', 'Original', 'Original step'), /TGM_GOAL_CONFLICT/);
    assert.deepEqual(repo.list()[0], { id: original.id, title: 'New goal', steps: [{ id, text: 'New step' }] });

    db.prepare('UPDATE steps SET text = ? WHERE id = ?').run('Externally changed step', id);
    assert.throws(() => repo.saveDetails(original.id, 'Should roll back', id, 'Stale step', 'New goal', 'New step'), /TGM_GOAL_CONFLICT/);
    assert.equal(repo.list()[0].title, 'New goal');
    assert.equal(repo.list()[0].steps[0].text, 'Externally changed step');
    assert.throws(() => repo.saveDetails(original.id, 'No expected values', id, 'Attempt'), /expectedTitle/);
  } finally { db.close(); }
});

test('adding a first step detects a concurrent step', () => {
  const db = new DatabaseSync(':memory:');
  try {
    const repo = makeGoals(db);
    const goal = repo.create('Goal')[0];
    db.prepare('INSERT INTO steps (goal_id, text) VALUES (?, ?)').run(goal.id, 'Another writer');
    assert.throws(() => repo.saveDetails(goal.id, 'Edited goal', null, 'My step', 'Goal', ''), /TGM_GOAL_CONFLICT/);
    assert.equal(repo.list()[0].title, 'Goal');
    assert.equal(repo.list()[0].steps[0].text, 'Another writer');
  } finally { db.close(); }
});
