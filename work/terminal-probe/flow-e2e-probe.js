const pty = require('node-pty');
const { Terminal } = require('@xterm/headless');
const path = require('node:path');
const fs = require('node:fs');
const cwd=path.resolve(__dirname,'../agy-flow-test');
const events=path.join(cwd,'mcp-events.jsonl');
const term=new Terminal({cols:120,rows:38,scrollback:1500,allowProposedApi:true});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function screen(){let out='';const b=term.buffer.active;for(let i=0;i<b.length;i++)out+=(b.getLine(i)?.translateToString(true)||'')+'\n';return out;}
function calls(){if(!fs.existsSync(events))return [];return fs.readFileSync(events,'utf8').trim().split('\n').filter(Boolean).map(JSON.parse);}
async function until(fn,ms){const end=Date.now()+ms;while(Date.now()<end){let result=await fn();if(result)return result;await sleep(500);}throw Error('Timed out waiting for expected state');}
async function status(){const r=await fetch('http://127.0.0.1:42731/status',{signal:AbortSignal.timeout(3000)});return await r.json();}
async function main(){
  if(fs.existsSync(events))fs.unlinkSync(events);
  console.log('Initial bridge status:',JSON.stringify(await status()));
  const child=pty.spawn(process.env.ComSpec,['/d','/c','agy --model gemini-3.8-flash-low --settings settings.json'],{name:'xterm-256color',cols:120,rows:38,cwd,env:process.env});
  child.onData(data=>term.write(data));
  try{
    await sleep(6000);
    let s=screen();
    if(/trust.*(folder|workspace|directory)|do you trust/i.test(s)){
      console.log('Trust prompt observed for disposable workspace');child.write('\r');await sleep(3500);
    }
    console.log('Initial screen:\n'+screen().split('\n').filter(l=>!l.includes('@')).join('\n'));
    child.write('/focus');await sleep(2000);
    console.log('Focus skill menu:',/focus.*isolated FlowState/i.test(screen()));
    child.write('\r');
    const started=await until(()=>calls().find(c=>c.name==='start_focus'),75000);
    console.log('Start MCP result:',JSON.stringify(started));
    if(started.error||started.status!==200||!started.data?.ok)throw Error('Start action failed');
    const during=await status();console.log('Independent status while active:',JSON.stringify(during));
    // Allow the AGY turn to finish before typing a second command.
    await sleep(20000);
    child.write('/stop');await sleep(2000);
    console.log('Stop skill menu:',/stop.*isolated FlowState/i.test(screen()));
    child.write('\r');
    const stopped=await until(()=>calls().find(c=>c.name==='stop_focus'),75000);
    console.log('Stop MCP result:',JSON.stringify(stopped));
    if(stopped.error||stopped.status!==200||!stopped.data?.ok)throw Error('Stop action failed');
    const after=await status();console.log('Independent status after stop:',JSON.stringify(after));
    await sleep(2500);
    fs.writeFileSync(path.join(cwd,'terminal-output.txt'),screen());
    console.log('Relevant terminal lines:\n'+screen().split('\n').filter(l=>/focus|stop|flow_test|session|error|permission|unknown/i.test(l)).join('\n'));
  } finally{child.write('\x03');await sleep(500);child.kill();}
}
main().catch(e=>{console.error('FAILED:',e.message);process.exitCode=1;});
