'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { makeGoals } = require('../electron/goals.cjs');
const { openStore } = require('../electron/store.cjs');

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

test('snapshot and restore return unique database paths and preserve all rows', (t) => {
  const dir = withTempDir(t);
  const sourcePath = path.join(dir, 'source.sqlite');
  createPopulatedDatabase(sourcePath);
  const expected = readAllRows(sourcePath);

  const snapRes = runCli(['snapshot', sourcePath, dir]);
  assert.equal(snapRes.status, 0, `snapshot failed: ${snapRes.stderr}`);
  const snapshotPath = snapRes.stdout.trim();
  assert.equal(path.isAbsolute(snapshotPath), true);
  assert.equal(path.dirname(path.dirname(snapshotPath)), dir);
  assert.equal(path.basename(snapshotPath), 'captures.sqlite');
  assert.deepEqual(readAllRows(snapshotPath), expected);

  const restoreRes = runCli(['restore', snapshotPath, dir]);
  assert.equal(restoreRes.status, 0, `restore failed: ${restoreRes.stderr}`);
  const restoredPath = restoreRes.stdout.trim();
  assert.notEqual(restoredPath, snapshotPath);
  assert.equal(path.dirname(path.dirname(restoredPath)), dir);
  assert.deepEqual(readAllRows(restoredPath), expected);

  const secondSnapshot = runCli(['snapshot', sourcePath, dir]);
  assert.equal(secondSnapshot.status, 0, secondSnapshot.stderr);
  assert.notEqual(secondSnapshot.stdout.trim(), snapshotPath);
  assert.deepEqual(readAllRows(secondSnapshot.stdout.trim()), expected);
});

test('snapshot and restore preserve migrated capture attachments and projects', t => {
  const dir = withTempDir(t);
  const sourcePath = path.join(dir, 'source.sqlite');
  createPopulatedDatabase(sourcePath);
  const store = openStore(sourcePath);
  const project = store.createProject('Study', null)[0];
  const capture = store.listCaptures()[0];
  store.updateCapture(capture.id, capture.text, null, project.id, capture.revision);
  const goal = store.listGoals()[0];
  store.completeStep(goal.id, goal.steps[0].id, goal.steps[0].text);
  store.close();
  const snapshot = runCli(['snapshot', sourcePath, dir]);
  assert.equal(snapshot.status, 0, snapshot.stderr);
  const restored = runCli(['restore', snapshot.stdout.trim(), dir]);
  assert.equal(restored.status, 0, restored.stderr);
  const result = openStore(restored.stdout.trim());
  try {
    assert.equal(result.listProjects()[0].name, 'Study');
    assert.equal(result.listCaptures()[0].projectName, 'Study');
    assert.equal(result.listCompletedSteps()[0].text, 'Practice generic constraints');
  } finally { result.close(); }
});

test('unrelated existing database and sidecars are preserved in the destination parent', (t) => {
  const dir = withTempDir(t);
  const sourcePath = path.join(dir, 'source.sqlite');
  createPopulatedDatabase(sourcePath);
  const sentinelBytes = Buffer.from('DO-NOT-OVERWRITE-\x00\xff', 'binary');
  const unrelatedPath = path.join(dir, 'captures.sqlite');
  for (const suffix of ['', '-wal', '-shm', '-journal']) {
    fs.writeFileSync(unrelatedPath + suffix, sentinelBytes);
  }

  for (const command of ['snapshot', 'restore']) {
    const result = runCli([command, sourcePath, dir]);
    assert.equal(result.status, 0, result.stderr);
    assert.notEqual(result.stdout.trim(), unrelatedPath);
    assert.deepEqual(readAllRows(result.stdout.trim()), readAllRows(sourcePath));
    for (const suffix of ['', '-wal', '-shm', '-journal']) {
      assert.deepEqual(fs.readFileSync(unrelatedPath + suffix), sentinelBytes);
    }
  }
});

test('corrupt or missing source fails without creating an output directory', (t) => {
  const dir = withTempDir(t);
  const corruptSourcePath = path.join(dir, 'corrupt.sqlite');
  const missingSourcePath = path.join(dir, 'missing.sqlite');
  fs.writeFileSync(corruptSourcePath, Buffer.from('not a valid sqlite database header at all'));
  const before = fs.readdirSync(dir).sort();

  for (const command of ['snapshot', 'restore']) {
    for (const source of [corruptSourcePath, missingSourcePath]) {
      const result = runCli([command, source, dir]);
      assert.notEqual(result.status, 0);
      assert.equal(result.stdout.trim(), '');
      assert.deepEqual(fs.readdirSync(dir).sort(), before);
    }
  }
});

test('backup failure removes partial output without deleting unexpected files', (t) => {
  const dir = withTempDir(t);
  const sourcePath = path.join(dir, 'source.sqlite');
  const wrapperPath = path.join(dir, 'fail-backup.cjs');
  createPopulatedDatabase(sourcePath);
  fs.writeFileSync(wrapperPath, `
    const fs = require('node:fs');
    const sqlite = require('node:sqlite');
    sqlite.backup = async (_db, destination) => {
      fs.writeFileSync(destination, 'partial');
      if (process.env.ADD_UNEXPECTED) fs.writeFileSync(destination + '-wal', 'keep me');
      throw new Error('synthetic backup failure');
    };
    require(${JSON.stringify(CLI_PATH)});
  `);

  for (const addUnexpected of [false, true]) {
    const parent = path.join(dir, addUnexpected ? 'unexpected' : 'empty');
    fs.mkdirSync(parent);
    const result = spawnSync(process.execPath, [wrapperPath, 'snapshot', sourcePath, parent], {
      encoding: 'utf8', windowsHide: true,
      env: { ...process.env, ADD_UNEXPECTED: addUnexpected ? '1' : '' },
    });
    assert.notEqual(result.status, 0);
    assert.equal(result.stdout.trim(), '');
    assert.match(result.stderr, /synthetic backup failure/);
    const contents = fs.readdirSync(parent);
    if (!addUnexpected) {
      assert.deepEqual(contents, []);
    } else {
      assert.equal(contents.length, 1);
      assert.match(result.stderr, /Failed to remove incomplete directory/);
      const outputDir = path.join(parent, contents[0]);
      assert.equal(fs.existsSync(path.join(outputDir, 'captures.sqlite')), false);
      assert.equal(fs.readFileSync(path.join(outputDir, 'captures.sqlite-wal'), 'utf8'), 'keep me');
    }
  }
});

test('invalid arguments or destination parents fail without changing existing files', (t) => {
  const dir = withTempDir(t);
  const sourcePath = path.join(dir, 'source.sqlite');
  const missingDir = path.join(dir, 'missing');
  const sentinel = path.join(dir, 'not-a-directory');
  createPopulatedDatabase(sourcePath);
  fs.writeFileSync(sentinel, 'leave me alone');
  const before = fs.readdirSync(dir).sort();

  for (const args of [
    [], ['snapshot'], ['snapshot', sourcePath], ['restore'], ['restore', sourcePath],
    ['unknown', sourcePath, dir], ['snapshot', sourcePath, missingDir],
    ['restore', sourcePath, sentinel], ['snapshot', sourcePath, 'relative'],
  ]) {
    const result = runCli(args);
    assert.notEqual(result.status, 0, `unexpected success: ${args}`);
    assert.equal(result.stdout.trim(), '');
  }
  assert.deepEqual(fs.readdirSync(dir).sort(), before);
  assert.equal(fs.readFileSync(sentinel, 'utf8'), 'leave me alone');
});
