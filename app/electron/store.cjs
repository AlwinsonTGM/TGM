'use strict';

const { DatabaseSync } = require('node:sqlite');
const { makeGoals } = require('./goals.cjs');

function openStore(dbPath) {
  const db = new DatabaseSync(dbPath);
  let goals;
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS captures (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        text TEXT NOT NULL,
        created_at TEXT NOT NULL
      )
    `);
    goals = makeGoals(db);
  } catch (error) {
    db.close();
    throw error;
  }

  return {
    listCaptures() {
      return db.prepare('SELECT id, text, created_at AS createdAt FROM captures ORDER BY id DESC')
        .all().map(row => ({ id: Number(row.id), text: String(row.text), createdAt: String(row.createdAt) }));
    },
    saveCapture(text) {
      if (typeof text !== 'string') throw new Error('Capture text is required and must be a string.');
      if (!text.isWellFormed()) throw new Error('Capture text must be well-formed Unicode.');
      if (text.includes('\0')) throw new Error('Capture text must not contain NUL characters.');
      if (text.trim().length === 0) throw new Error('Capture text cannot be empty.');
      if (text.length > 10000) throw new Error('Capture text must be at most 10000 characters.');
      const createdAt = new Date().toISOString();
      const result = db.prepare('INSERT INTO captures (text, created_at) VALUES (?, ?)').run(text, createdAt);
      return { id: Number(result.lastInsertRowid), text, createdAt };
    },
    listGoals: goals.list,
    createGoal: goals.create,
    saveGoalDetails: goals.saveDetails,
    close() { db.close(); },
  };
}

module.exports = { openStore };
