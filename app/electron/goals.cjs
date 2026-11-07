'use strict';

function validateText(value, fieldName, allowEmpty = false) {
  if (typeof value !== 'string') {
    throw new TypeError(`${fieldName} must be a string`);
  }
  if (!value.isWellFormed()) {
    throw new Error(`${fieldName} must be well-formed Unicode`);
  }
  if (value.includes('\0')) {
    throw new Error(`${fieldName} must not contain NUL characters`);
  }
  if (value.length > 500) {
    throw new Error(`${fieldName} must be at most 500 characters`);
  }
  if (allowEmpty && value === '') {
    return '';
  }
  if (value.trim().length === 0) {
    throw new Error(`${fieldName} must not be blank`);
  }
  return value;
}

function validateId(value, fieldName) {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${fieldName} must be a positive integer`);
  }
  return value;
}

function makeGoals(db) {
  if (!db || typeof db.exec !== 'function' || typeof db.prepare !== 'function') {
    throw new TypeError('A valid node:sqlite database instance is required');
  }

  db.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS goals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL CHECK (length(title) <= 500 AND instr(title, char(0)) = 0 AND length(trim(title)) > 0),
      active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1))
    );
    CREATE TABLE IF NOT EXISTS steps (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      goal_id INTEGER NOT NULL,
      text TEXT NOT NULL CHECK (length(text) <= 500 AND instr(text, char(0)) = 0 AND length(trim(text)) > 0),
      FOREIGN KEY (goal_id) REFERENCES goals(id) ON DELETE CASCADE
    );
  `);

  function runInTransaction(work) {
    db.exec('BEGIN IMMEDIATE');
    try {
      const result = work();
      db.exec('COMMIT');
      return result;
    } catch (err) {
      try {
        db.exec('ROLLBACK');
      } catch (_) {
        // Preserve original error from transaction body
      }
      throw err;
    }
  }

  function list() {
    const stmt = db.prepare(`
      SELECT
        g.id AS goal_id,
        g.title AS goal_title,
        s.id AS step_id,
        s.text AS step_text
      FROM goals g
      LEFT JOIN steps s ON s.goal_id = g.id
      WHERE g.active = 1
      ORDER BY g.id ASC, s.id ASC
    `);
    const rows = stmt.all();
    const goals = [];
    const goalsById = new Map();

    for (const row of rows) {
      const goalId = Number(row.goal_id);
      let goal = goalsById.get(goalId);
      if (!goal) {
        goal = {
          id: goalId,
          title: row.goal_title,
          steps: [],
        };
        goalsById.set(goalId, goal);
        goals.push(goal);
      }
      if (row.step_id !== null && row.step_id !== undefined) {
        goal.steps.push({
          id: Number(row.step_id),
          text: row.step_text,
        });
      }
    }

    return goals;
  }

  function create(title, optionalStep = '') {
    const validTitle = validateText(title, 'title', false);
    const validStep = validateText(optionalStep, 'optionalStep', true);

    return runInTransaction(() => {
      const insertGoalStmt = db.prepare('INSERT INTO goals (title, active) VALUES (?, 1)');
      const goalResult = insertGoalStmt.run(validTitle);
      if (Number(goalResult.changes) !== 1) {
        throw new Error('Failed to insert goal');
      }
      const goalId = Number(goalResult.lastInsertRowid);

      if (validStep !== '') {
        const insertStepStmt = db.prepare('INSERT INTO steps (goal_id, text) VALUES (?, ?)');
        const stepResult = insertStepStmt.run(goalId, validStep);
        if (Number(stepResult.changes) !== 1) {
          throw new Error('Failed to insert step');
        }
      }

      return list();
    });
  }

  function saveDetails(goalId, title, stepId, stepText) {
    const validGoalId = validateId(goalId, 'goalId');
    const validTitle = validateText(title, 'title', false);

    let validStepId = null;
    let validStepText = '';

    if (stepId === null) {
      validStepText = validateText(stepText, 'stepText', true);
    } else {
      validStepId = validateId(stepId, 'stepId');
      validStepText = validateText(stepText, 'stepText', false);
    }

    return runInTransaction(() => {
      const updateGoalStmt = db.prepare('UPDATE goals SET title = ? WHERE id = ? AND active = 1');
      const goalResult = updateGoalStmt.run(validTitle, validGoalId);
      if (Number(goalResult.changes) !== 1) {
        throw new Error('Goal not found or inactive');
      }

      if (validStepId !== null) {
        const updateStepStmt = db.prepare('UPDATE steps SET text = ? WHERE id = ? AND goal_id = ?');
        const stepResult = updateStepStmt.run(validStepText, validStepId, validGoalId);
        if (Number(stepResult.changes) !== 1) {
          throw new Error('Step not found or does not belong to goal');
        }
      } else if (validStepText !== '') {
        const countStepsStmt = db.prepare('SELECT COUNT(*) AS count FROM steps WHERE goal_id = ?');
        const existing = countStepsStmt.get(validGoalId);
        if (existing && Number(existing.count) > 0) {
          throw new Error('Goal already has steps; stepId is required to update an existing step');
        }
        const insertStepStmt = db.prepare('INSERT INTO steps (goal_id, text) VALUES (?, ?)');
        const stepResult = insertStepStmt.run(validGoalId, validStepText);
        if (Number(stepResult.changes) !== 1) {
          throw new Error('Failed to insert step');
        }
      }

      return list();
    });
  }

  return {
    list,
    create,
    saveDetails,
  };
}

module.exports = {
  makeGoals,
};
