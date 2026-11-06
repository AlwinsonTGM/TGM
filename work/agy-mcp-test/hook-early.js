const fs = require('node:fs');
const path = require('node:path');
const result = path.join(__dirname, `hook-${process.argv[2] || 'result'}.json`);
fs.writeFileSync(result, JSON.stringify({started: true}));
let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', part => { input += part; });
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input);
    fs.writeFileSync(result, JSON.stringify({started: true, cwdMatchesWorkspace: process.cwd() === __dirname, conversationId: !!data.conversationId, transcriptPath: !!data.transcriptPath}));
  } catch { fs.writeFileSync(result, JSON.stringify({started: true, invalidInput: true})); }
  process.stdout.write('{}');
});
