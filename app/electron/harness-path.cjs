'use strict';

const fs = require('node:fs');
const path = require('node:path');

function findOnPath(filename, pathValue = process.env.PATH || '') {
  for (const entry of pathValue.split(path.delimiter)) {
    const directory = entry.trim().replace(/^"|"$/g, '');
    if (!path.isAbsolute(directory)) continue;
    const candidate = path.join(directory, filename);
    try { if (fs.statSync(candidate).isFile()) return candidate; } catch { /* Try the next PATH entry. */ }
  }
  return null;
}

function harnessCommand(id, executable, env = process.env) {
  if (id === 'agy') return { command: executable, args: [] };
  if (id !== 'opencode') throw new Error('Invalid harness.');
  // cmd.exe expands some characters even in quoted paths; never interpolate them.
  if (/[\r\n"%!^&|<>()]/.test(executable)) {
    throw new Error('OpenCode’s installation path contains unsupported command characters. Install it in a folder without % ! ^ & | < > ( ) or quotes.');
  }
  const command = env.ComSpec || path.join(env.SystemRoot || 'C:\\Windows', 'System32', 'cmd.exe');
  if (!path.isAbsolute(command) || path.basename(command).toLowerCase() !== 'cmd.exe') {
    throw new Error('The Windows command interpreter path is invalid.');
  }
  // node-pty accepts a raw Windows command line; cmd /s /c needs outer quotes.
  return { command, args: `/d /v:off /s /c ""${executable}" --standalone"` };
}

module.exports = { findOnPath, harnessCommand };
