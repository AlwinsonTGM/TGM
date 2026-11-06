const pty = require('node-pty');
const { Terminal } = require('@xterm/headless');
const path = require('node:path');
const term = new Terminal({cols:110, rows:35, scrollback:500, allowProposedApi:true});
const cwd=path.resolve(__dirname,'../agy-slash-test');
const child=pty.spawn(process.env.ComSpec,['/d','/c','agy --model gemini-3.8-flash-low --settings settings.json'],{name:'xterm-256color',cols:110,rows:35,cwd,env:process.env});
child.onData(data => term.write(data));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function screen(){let result=''; const b=term.buffer.active;for(let i=0;i<b.length;i++)result+=(b.getLine(i)?.translateToString(true)||'')+'\n';return result;}
async function main(){
 await sleep(5500);console.log('initial screen:\n'+screen().split('\n').filter(l=>!l.includes('@')).join('\n'));child.write('/focus');await sleep(2000);let s=screen();console.log('focus available:',/focus integration test/i.test(s));
 child.write('\r');await sleep(20000);s=screen(); console.log('marker returned:',s.includes('violet-bamboo-741'));console.log('tool mentioned:',/isolated_test|get_test_marker/.test(s));
 console.log('relevant lines:\n'+s.split('\n').filter(l=>/focus|marker|isolated_test|permission|unknown command/i.test(l)).join('\n'));
 child.write('\x03');await sleep(300);child.kill();
}
main().catch(e=>{console.error(e.message);child.kill();process.exitCode=1;});
