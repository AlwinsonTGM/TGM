const pty=require('node-pty');const {Terminal}=require('@xterm/headless');const path=require('node:path');
const cwd=path.resolve(__dirname,'../agy-flow-test');const term=new Terminal({cols:120,rows:38,scrollback:500,allowProposedApi:true});
const child=pty.spawn(process.env.ComSpec,['/d','/c','agy --model gemini-3.8-flash-low --settings settings.json'],{name:'xterm-256color',cols:120,rows:38,cwd,env:process.env});child.onData(d=>term.write(d));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));function screen(){let s='';let b=term.buffer.active;for(let i=0;i<b.length;i++)s+=(b.getLine(i)?.translateToString(true)||'')+'\n';return s;}
(async()=>{try{await sleep(6500);child.write('/focus');await sleep(2000);console.log('Focus menu:\n'+screen());child.write('\x15');await sleep(300);child.write('/stop');await sleep(2000);console.log('Stop menu:\n'+screen());}finally{child.write('\x03');await sleep(300);child.kill();}})().catch(e=>{console.error(e);process.exitCode=1;});
