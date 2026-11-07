'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { makeGoals } = require('../electron/goals.cjs');

const CLI_PATH = path.resolve(__dirname, '../scripts/recover-database.cjs');

function runCli(args) {
  return spawnSync(process.execPath, [CLI_PATH, ...args], {
    encoding: 'utf8',
    windowsHide: true,
  });
}

function withTempDir(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'recover-db-test-'));
  t.after(() => {
    const tempRoot = fs.realpathSync(os.tmpdir());
    const target = fs.realpathSync(dir);
    const relative = path.relative(tempRoot, target);
    if (!relative || relative.startsWith('..') || path.isAbsolute(relative) || !path.basename(target).startsWith('recover-db-test-')) {
      throw new Error(`Refusing to delete unsafe path: ${target}`);
    }
    fs.rmSync(target, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  });
  return dir;
}

function createPopulatedDatabase(dbPath) {
  const db = new DatabaseSync(dbPath);
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS captures (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        text TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
    `);
    const goalsRepo = makeGoals(db);
    const insertCapture = db.prepare('INSERT INTO captures (text, created_at) VALUES (?, ?)');
    insertCapture.run('First uncategorized capture', '2026-11-07T00:00:00.000Z');
    insertCapture.run('Second quick thought', '2026-11-07T00:05:00.000Z');
    goalsRepo.create('Master TypeScript', 'Practice generic constraints');
    goalsRepo.create('Read system design papers', '');
  } finally {
    db.close();
  }
}

function readAllRows(dbPath) {
  const db = new DatabaseSync(dbPath);
  try {
    db.exec('PRAGMA foreign_keys = ON;');
    const fkErrors = db.prepare('PRAGMA foreign_key_check;').all();
    assert.deepEqual(fkErrors, []);

    const captures = db.prepare('SELECT id, text, created_at FROM captures ORDER BY id').all();
    const goals = db.prepare('SELECT id, title, active FROM goals ORDER BY id').all();
    const steps = db.prepare('SELECT id, goal_id, text FROM steps ORDER BY id').all();
    return { captures, goals, steps };
  } finally {
    db.close();
  }
}

test('snapshot and restore round-trip preserves captures, goals, and steps with foreign keys', (t) => {
  const dir = withTempDir(t);
  const sourcePath = path.join(dir, 'captures.sqlite');
  const snapshotPath = path.join(dir, 'snapshot.sqlite');
  const restoredPath = path.join(dir, 'restored.sqlite');

  createPopulatedDatabase(sourcePath);
  const expected = readAllRows(sourcePath);

  const snapRes = runCli(['snapshot', sourcePath, snapshotPath]);
  assert.equal(snapRes.status, 0, `snapshot failed: ${snapRes.stderr}`);
  assert.equal(fs.existsSync(snapshotPath), true);
  assert.deepEqual(readAllRows(snapshotPath), expected);

  const restoreRes = runCli(['restore', snapshotPath, restoredPath]);
  assert.equal(restoreRes.status, 0, `restore failed: ${restoreRes.stderr}`);
  assert.equal(fs.existsSync(restoredPath), true);
  assert.deepEqual(readAllRows(restoredPath), expected);
});

test('collision with existing destination fails and preserves sentinel file byte-for-byte', (t) => {
  const dir = withTempDir(t);
  const sourcePath = path.join(dir, 'source.sqlite');
  const existingDestPath = path.join(dir, 'existing.sqlite');
  const sentinelBytes = Buffer.from('SENTINEL-DO-NOT-OVERWRITE-\x00\xff\x42', 'binary');

  createPopulatedDatabase(sourcePath);
  fs.writeFileSync(existingDestPath, sentinelBytes);

  const snapRes = runCli(['snapshot', sourcePath, existingDestPath]);
  assert.notEqual(snapRes.status, 0);
  assert.deepEqual(fs.readFileSync(existingDestPath), sentinelBytes);

  const restoreRes = runCli(['restore', sourcePath, existingDestPath]);
  assert.notEqual(restoreRes.status, 0);
  assert.deepEqual(fs.readFileSync(existingDestPath), sentinelBytes);
});

test('corrupt source fails and leaves no destination file', (t) => {
  const dir = withTempDir(t);
  const corruptSourcePath = path.join(dir, 'corrupt.sqlite');
  const snapDestPath = path.join(dir, 'snap-out.sqlite');
  const restoreDestPath = path.join(dir, 'restore-out.sqlite');

  fs.writeFileSync(corruptSourcePath, Buffer.from('not a valid sqlite database header at all'));

  const snapRes = runCli(['snapshot', corruptSourcePath, snapDestPath]);
  assert.notEqual(snapRes.status, 0);
  assert.equal(fs.existsSync(snapDestPath), false);

  const restoreRes = runCli(['restore', corruptSourcePath, restoreDestPath]);
  assert.notEqual(restoreRes.status, 0);
  assert.equal(fs.existsSync(restoreDestPath), false);
});

test('missing source fails without creating source or destination', (t) => {
  const dir = withTempDir(t);
  const missingSourcePath = path.join(dir, 'does-not-exist.sqlite');
  const snapDestPath = path.join(dir, 'snap-out.sqlite');
  const restoreDestPath = path.join(dir, 'restore-out.sqlite');

  const snapRes = runCli(['snapshot', missingSourcePath, snapDestPath]);
  assert.notEqual(snapRes.status, 0);
  assert.equal(fs.existsSync(missingSourcePath), false);
  assert.equal(fs.existsSync(snapDestPath), false);

  const restoreRes = runCli(['restore', missingSourcePath, restoreDestPath]);
  assert.notEqual(restoreRes.status, 0);
  assert.equal(fs.existsSync(missingSourcePath), false);
  assert.equal(fs.existsSync(restoreDestPath), false);
});

test('missing or invalid arguments fail with nonzero exit code', (t) => {
  const dir = withTempDir(t);
  const somePath = path.join(dir, 'db.sqlite');

  assert.notEqual(runCli([]).status, 0);
  assert.notEqual(runCli(['snapshot']).status, 0);
  assert.notEqual(runCli(['snapshot', somePath]).status, 0);
  assert.notEqual(runCli(['restore']).status, 0);
  assert.notEqual(runCli(['restore', somePath]).status, 0);
  assert.notEqual(runCli(['unknown', somePath, path.join(dir, 'out.sqlite')]).status, 0);
});
