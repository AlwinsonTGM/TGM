// Tests slash handling in the real CLI in an isolated synthetic project.
const pty = require('node-pty');
const { Terminal } = require('@xterm/headless');
const path = require('node:path');
const term = new Terminal({cols:110, rows:35, scrollback:500, allowProposedApi:true});
const child = pty.spawn(process.env.ComSpec, ['/d','/c','agy --model gemini-3.8-flash-low --mode plan'], {
  name:'xterm-256color', cols:110, rows:35, cwd:path.resolve(__dirname,'../agy-mcp-test'), env:process.env
});
child.onData(data => term.write(data));
const sleep = ms => new Promise(resolve => setTimeout(resolve,ms));
function screen() { let lines=[]; for(let i=0;i<term.rows;i++) lines.push(term.buffer.active.getLine(term.buffer.active.viewportY+i)?.translateToString(true) || ''); return lines.join('\n').trim(); }
async function main() {
  await sleep(5500);
  console.log('--- initial ---\n'+screen());
  child.write('/focus'); await sleep(1500); console.log('--- focus entered ---\n'+screen());
  child.write('\r'); await sleep(9000); console.log('--- focus submitted ---\n'+screen());
  child.write('/stop'); await sleep(1500); console.log('--- stop entered ---\n'+screen());
  child.write('\r'); await sleep(9000); console.log('--- stop submitted ---\n'+screen());
  child.write('\x03'); await sleep(300); child.kill();
}
main().catch(err => {console.error(err); child.kill(); process.exitCode=1;});
