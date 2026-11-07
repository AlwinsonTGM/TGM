const fs = require('node:fs');
const path = require('node:path');

// A PATH check is advisory; Windows may use other locations when starting a command.
function foundOnPath(filename, pathValue = process.env.PATH || '') {
  return pathValue.split(path.delimiter).some(entry => {
    const directory = entry.trim().replace(/^"|"$/g, '');
    if (!path.isAbsolute(directory)) return false;
    try { return fs.statSync(path.join(directory, filename)).isFile(); } catch { return false; }
  });
}

module.exports = { foundOnPath };
