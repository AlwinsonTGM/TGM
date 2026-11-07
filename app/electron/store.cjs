'use strict';

const { DatabaseSync } = require('node:sqlite');
const { makeGoals } = require('./goals.cjs');

function textValue(value, limit, label) {
  if (typeof value !== 'string' || !value.isWellFormed() || value.includes('\0') || !value.trim() || value.length > limit) {
    throw new Error(`${label} must be nonempty, well-formed text of at most ${limit} characters.`);
  }
  return value;
}
function idValue(value) {
  if (!Number.isSafeInteger(value) || value < 1) throw new Error('Invalid record ID.');
  return value;
}
function revisionValue(value) {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error('Invalid revision.');
  return value;
}

function openStore(dbPath) {
  const db = new DatabaseSync(dbPath);
  let goals;
  try {
    db.exec('PRAGMA foreign_keys = ON');
    const version = Number(db.prepare('PRAGMA user_version').get().user_version);
    if (version > 2) throw new Error('This database was created by a newer version of TGM.');
    db.exec('BEGIN IMMEDIATE');
    try {
      db.exec(`CREATE TABLE IF NOT EXISTS captures (id INTEGER PRIMARY KEY AUTOINCREMENT, text TEXT NOT NULL, created_at TEXT NOT NULL)`);
      goals = makeGoals(db);
      if (version === 0) {
        db.exec(`
          CREATE TABLE projects (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, folder TEXT, active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)));
          ALTER TABLE captures ADD COLUMN goal_id INTEGER REFERENCES goals(id) ON DELETE SET NULL;
          ALTER TABLE captures ADD COLUMN project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL;
          ALTER TABLE captures ADD COLUMN revision INTEGER NOT NULL DEFAULT 0;
        `);
      }
      if (version < 2) db.exec('PRAGMA user_version = 2');
      db.exec('COMMIT');
    } catch (error) { db.exec('ROLLBACK'); throw error; }
  } catch (error) { db.close(); throw error; }

  const captureQuery = `SELECT c.id, c.text, c.created_at AS createdAt, c.goal_id AS goalId, c.project_id AS projectId,
    c.revision, g.title AS goalTitle, p.name AS projectName,
    CASE WHEN c.goal_id IS NOT NULL THEN g.active WHEN c.project_id IS NOT NULL THEN p.active ELSE NULL END AS targetActive
    FROM captures c LEFT JOIN goals g ON g.id = c.goal_id LEFT JOIN projects p ON p.id = c.project_id`;
  function readCapture(id) { return db.prepare(`${captureQuery} WHERE c.id = ?`).get(id); }
  function listProjects() { return db.prepare('SELECT id, name, folder, active FROM projects ORDER BY active DESC, name COLLATE NOCASE, id').all().map(p => ({ ...p, active: Boolean(p.active) })); }
  function projectFolder(folder) {
    if (folder === null) return null;
    return textValue(folder, 32767, 'Folder');
  }
  return {
    listCaptures() { return db.prepare(`${captureQuery} ORDER BY c.id DESC`).all(); },
    saveCapture(text) {
      textValue(text, 10000, 'Capture');
      const result = db.prepare('INSERT INTO captures (text, created_at) VALUES (?, ?)').run(text, new Date().toISOString());
      return readCapture(Number(result.lastInsertRowid));
    },
    updateCapture(id, text, goalId, projectId, revision) {
      idValue(id); textValue(text, 10000, 'Capture'); revisionValue(revision);
      if (goalId !== null) idValue(goalId);
      if (projectId !== null) idValue(projectId);
      if (goalId !== null && projectId !== null) throw new Error('Choose one attachment.');
      db.exec('BEGIN IMMEDIATE');
      try {
        const current = readCapture(id);
        if (!current || current.revision !== revision) throw new Error('TGM_CAPTURE_CONFLICT: Capture changed or is no longer available.');
        if (goalId !== null && goalId !== current.goalId && !db.prepare('SELECT id FROM goals WHERE id = ? AND active = 1').get(goalId)) throw new Error('Goal is unavailable.');
        if (projectId !== null && projectId !== current.projectId && !db.prepare('SELECT id FROM projects WHERE id = ? AND active = 1').get(projectId)) throw new Error('Project is unavailable.');
        const result = db.prepare('UPDATE captures SET text = ?, goal_id = ?, project_id = ?, revision = revision + 1 WHERE id = ? AND revision = ?').run(text, goalId, projectId, id, revision);
        if (Number(result.changes) !== 1) throw new Error('TGM_CAPTURE_CONFLICT: Capture changed or is no longer available.');
        const saved = readCapture(id); db.exec('COMMIT'); return saved;
      } catch (error) { db.exec('ROLLBACK'); throw error; }
    },
    deleteCapture(id, revision) {
      idValue(id); revisionValue(revision);
      const result = db.prepare('DELETE FROM captures WHERE id = ? AND revision = ?').run(id, revision);
      if (Number(result.changes) !== 1) throw new Error('TGM_CAPTURE_CONFLICT: Capture changed or is no longer available.');
    },
    listProjects,
    createProject(name, folder) {
      textValue(name, 500, 'Project name'); projectFolder(folder);
      db.prepare('INSERT INTO projects (name, folder) VALUES (?, ?)').run(name, folder);
      return listProjects();
    },
    updateProject(id, name, folder, active) {
      idValue(id); textValue(name, 500, 'Project name'); projectFolder(folder);
      if (typeof active !== 'boolean') throw new Error('Invalid project status.');
      const result = db.prepare('UPDATE projects SET name = ?, folder = ?, active = ? WHERE id = ?').run(name, folder, Number(active), id);
      if (Number(result.changes) !== 1) throw new Error('Project is no longer available.');
      return listProjects();
    },
    listGoals: goals.list,
    createGoal: goals.create,
    saveGoalDetails: goals.saveDetails,
    listCompletedSteps: goals.completed,
    completeStep: goals.complete,
    restoreStep: goals.restore,
    close() { db.close(); },
  };
}

module.exports = { openStore };
