'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync, backup } = require('node:sqlite');

const VALID_COMMANDS = new Set(['snapshot', 'restore']);

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
      'Usage: node recover-database.cjs <snapshot|restore> <absolute-source> <absolute-destination-parent-directory>'
    );
  }

  const [command, sourceArg, parentArg] = args;
  if (!VALID_COMMANDS.has(command)) {
    throw new Error(`Unsupported command "${command}". Expected "snapshot" or "restore".`);
  }

  assertAbsolutePath(sourceArg, 'Source');
  assertAbsolutePath(parentArg, 'Destination parent');

  const sourcePath = path.normalize(sourceArg);
  const parentDir = path.normalize(parentArg);
  assertSourceRegularFile(sourcePath);
  assertDestinationParentDirectory(parentDir);

  let outputDir = null;
  let outputPath = null;
  let sourceDb = null;
  let outputDb = null;
  let verified = false;
  let primaryError = null;

  try {
    sourceDb = new DatabaseSync(sourcePath, { readOnly: true });
    verifyQuickCheck(sourceDb, 'source');

    // A freshly created directory avoids publishing beside unrelated SQLite sidecars.
    outputDir = fs.mkdtempSync(path.join(parentDir, `tgm-${command}-`));
    outputPath = path.join(outputDir, 'captures.sqlite');
    await backup(sourceDb, outputPath);

    sourceDb.close();
    sourceDb = null;

    assertSourceRegularFile(outputPath);
    outputDb = new DatabaseSync(outputPath, { readOnly: true });
    verifyQuickCheck(outputDb, 'output');
    outputDb.close();
    outputDb = null;
    verified = true;
  } catch (err) {
    primaryError = err;
    throw err;
  } finally {
    const cleanupErrors = [];
    if (outputDb !== null) {
      try { outputDb.close(); } catch (err) { cleanupErrors.push(`Failed to close output database: ${err.message}`); }
    }
    if (sourceDb !== null) {
      try { sourceDb.close(); } catch (err) { cleanupErrors.push(`Failed to close source database: ${err.message}`); }
    }
    if (!verified && outputPath !== null) {
      try { fs.unlinkSync(outputPath); } catch (err) {
        if (err.code !== 'ENOENT') cleanupErrors.push(`Failed to remove incomplete database "${outputPath}": ${err.message}`);
      }
    }
    if (!verified && outputDir !== null) {
      try { fs.rmdirSync(outputDir); } catch (err) {
        cleanupErrors.push(`Failed to remove incomplete directory "${outputDir}": ${err.message}`);
      }
    }
    if (cleanupErrors.length > 0) {
      const message = cleanupErrors.join('; ');
      if (primaryError !== null) console.error(message);
      else throw new Error(message);
    }
  }

  console.log(outputPath);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
});
