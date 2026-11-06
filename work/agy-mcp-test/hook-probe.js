const fs = require('node:fs');
const path = require('node:path');
let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => input += chunk);
process.stdin.on('end', () => {
  const data = JSON.parse(input);
  fs.writeFileSync(path.join(__dirname, 'hook-observed.json'), JSON.stringify({conversationId: data.conversationId, transcriptPath: data.transcriptPath}));
  process.stdout.write('{}');
});
