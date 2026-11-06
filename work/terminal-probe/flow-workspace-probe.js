const pty=require('node-pty');
const {Terminal}=require('@xterm/headless');
const path=require('node:path');
const cwd=path.resolve(__dirname,'../agy-flow-test');
const term=new Terminal({cols:120,rows:38,scrollback:500,allowProposedApi:true});
const child=pty.spawn(process.env.ComSpec,['/d','/c','agy --model gemini-3.8-flash-low --settings settings.json'],{name:'xterm-256color',cols:120,rows:38,cwd,env:process.env});
child.onData(data=>term.write(data));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function screen(){let out='';const b=term.buffer.active;for(let i=0;i<b.length;i++)out+=(b.getLine(i)?.translateToString(true)||'')+'\n';return out;}
(async()=>{try{await sleep(8000);console.log('Initial screen:\n'+screen().split('\n').filter(l=>!l.includes('@')).join('\n'));if(/trust.*(folder|workspace|directory)|do you trust/i.test(screen())){console.log('Approving trust for disposable workspace');child.write('\r');await sleep(5000);console.log('After trust:\n'+screen().split('\n').filter(l=>!l.includes('@')).join('\n'));}}finally{child.write('\x03');await sleep(400);child.kill();}})().catch(e=>{console.error(e);process.exitCode=1;});
