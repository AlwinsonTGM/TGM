const fs = require('node:fs');
const path = require('node:path');
let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', part => { input += part; });
process.stdin.on('end', () => {
  const value = JSON.parse(input);
  fs.writeFileSync(path.join(__dirname, 'observed.json'), JSON.stringify({conversationId: value.conversationId, transcriptPath: value.transcriptPath}));
  process.stdout.write('{}');
});
