'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync, backup } = require('node:sqlite');

const VALID_COMMANDS = new Set(['snapshot', 'restore']);
const SIDECAR_SUFFIXES = ['', '-wal', '-shm', '-journal'];

function assertAbsolutePath(value, label) {
  if (typeof value !== 'string' || value.length === 0 || value.includes('\0')) {
    throw new Error(`Invalid ${label} path.`);
  }
  if (!path.isAbsolute(value)) {
    throw new Error(`${label} path must be absolute: ${value}`);
  }
}

function assertSourceRegularFile(sourcePath) {
  let stat;
  try {
    stat = fs.lstatSync(sourcePath);
  } catch (err) {
    if (err && err.code === 'ENOENT') {
      throw new Error(`Source file does not exist: ${sourcePath}`);
    }
    throw new Error(`Unable to stat source path "${sourcePath}": ${err.message}`);
  }
  if (!stat.isFile()) {
    throw new Error(`Source path must be a regular file: ${sourcePath}`);
  }
}

function assertDestinationParentDirectory(destDir) {
  let stat;
  try {
    stat = fs.statSync(destDir);
  } catch (err) {
    if (err && err.code === 'ENOENT') {
      throw new Error(`Destination parent directory does not exist: ${destDir}`);
    }
    throw new Error(`Unable to stat destination parent directory "${destDir}": ${err.message}`);
  }
  if (!stat.isDirectory()) {
    throw new Error(`Destination parent path is not a directory: ${destDir}`);
  }
}

function assertNoDestinationOrSidecars(destPath) {
  for (const suffix of SIDECAR_SUFFIXES) {
    const candidate = `${destPath}${suffix}`;
    try {
      fs.lstatSync(candidate);
      throw new Error(`Destination or sidecar already exists: ${candidate}`);
    } catch (err) {
      if (err && err.code === 'ENOENT') {
        continue;
      }
      throw err;
    }
  }
}

function verifyQuickCheck(db, label) {
  const rows = db.prepare('PRAGMA quick_check').all();
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error(`PRAGMA quick_check returned no rows for ${label} database.`);
  }
  for (const row of rows) {
    const values = row && typeof row === 'object' ? Object.values(row) : [];
    if (values.length !== 1 || values[0] !== 'ok') {
      throw new Error(`PRAGMA quick_check failed for ${label} database: ${JSON.stringify(row)}`);
    }
  }
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length !== 3) {
    throw new Error(
      'Usage: node recover-database.cjs <snapshot|restore> <absolute-source> <absolute-new-dest>'
    );
  }

  const [command, sourceArg, destArg] = args;
  if (!VALID_COMMANDS.has(command)) {
    throw new Error(`Unsupported command "${command}". Expected "snapshot" or "restore".`);
  }

  assertAbsolutePath(sourceArg, 'Source');
  assertAbsolutePath(destArg, 'Destination');

  const sourcePath = path.normalize(sourceArg);
  const destPath = path.normalize(destArg);

  if (sourcePath === destPath) {
    throw new Error('Source and destination paths must be distinct.');
  }

  assertSourceRegularFile(sourcePath);

  const destDir = path.dirname(destPath);
  assertDestinationParentDirectory(destDir);
  assertNoDestinationOrSidecars(destPath);

  let stageDir = null;
  let stagePath = null;
  let sourceDb = null;
  let stageDb = null;
  let published = false;
  let primaryError = null;

  try {
    stageDir = fs.mkdtempSync(path.join(destDir, `.${path.basename(destPath)}.stage-`));
    stagePath = path.join(stageDir, 'stage.sqlite');

    sourceDb = new DatabaseSync(sourcePath, { readOnly: true });
    verifyQuickCheck(sourceDb, 'source');

    await backup(sourceDb, stagePath);

    sourceDb.close();
    sourceDb = null;

    assertSourceRegularFile(stagePath);

    stageDb = new DatabaseSync(stagePath, { readOnly: true });
    verifyQuickCheck(stageDb, 'staged');

    stageDb.close();
    stageDb = null;

    assertNoDestinationOrSidecars(destPath);

    fs.linkSync(stagePath, destPath);
    published = true;
  } catch (err) {
    primaryError = err;
    throw err;
  } finally {
    const cleanupErrors = [];

    if (stageDb !== null) {
      try {
        stageDb.close();
      } catch (err) {
        cleanupErrors.push(`Failed to close staged database: ${err.message}`);
      }
    }

    if (sourceDb !== null) {
      try {
        sourceDb.close();
      } catch (err) {
        cleanupErrors.push(`Failed to close source database: ${err.message}`);
      }
    }

    if (stagePath !== null) {
      try {
        fs.unlinkSync(stagePath);
      } catch (err) {
        if (!err || err.code !== 'ENOENT' || published) {
          cleanupErrors.push(`Failed to unlink staged file "${stagePath}": ${err.message}`);
        }
      }
    }

    if (stageDir !== null) {
      try {
        fs.rmdirSync(stageDir);
      } catch (err) {
        cleanupErrors.push(`Failed to remove staging directory "${stageDir}": ${err.message}`);
      }
    }

    if (cleanupErrors.length > 0) {
      const cleanupMessage = published
        ? `Database published to "${destPath}", but staging cleanup failed: ${cleanupErrors.join('; ')}`
        : `Staging cleanup failed: ${cleanupErrors.join('; ')}`;

      if (primaryError !== null) {
        console.error(cleanupMessage);
      } else {
        throw new Error(cleanupMessage);
      }
    }
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
});
