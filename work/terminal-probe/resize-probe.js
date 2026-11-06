// Isolated experiment; prints only redraw counts, never terminal contents.
const pty = require('node-pty');
const {Terminal} = require('@xterm/headless');
const path = require('node:path');
const t = new Terminal({cols:100,rows:30,scrollback:1000,allowProposedApi:true});
const child = pty.spawn(process.env.ComSpec, ['/d','/c','agy --model gemini-3.8-flash-low --mode plan'], {name:'xterm-256color',cols:100,rows:30,cwd:path.resolve(__dirname,'../agy-mcp-test'),env:process.env});
child.onData(data=>t.write(data));
function wait(ms){return new Promise(r=>setTimeout(r,ms));}
function count(){let s=''; for(let i=0;i<t.rows;i++) s+=t.buffer.active.getLine(t.buffer.active.viewportY+i)?.translateToString(true)+'\n'; return (s.match(/Antigravity CLI/g)||[]).length;}
async function main(){await wait(4500); process.stdout.write(`initial=${count()}\n`);for(let i=0;i<5;i++){let w=i%2===0?60:100,h=i%2===0?20:30;t.resize(w,h);child.resize(w,h);await wait(200);const early=count();await wait(1800);process.stdout.write(`resize ${w}x${h} early=${early} settled=${count()}\n`);}child.write('\x03');await wait(300);child.kill();}
main().catch(e=>{console.error(e.message);child.kill();process.exitCode=1});
