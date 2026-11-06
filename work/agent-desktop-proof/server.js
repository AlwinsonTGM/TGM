const {spawnSync} = require('node:child_process');
const readline = require('node:readline');
const fs = require('node:fs');
const path = require('node:path');
const exe = 'C:/Users/PC/AppData/Roaming/npm/node_modules/agent-desktop/bin/agent-desktop-win32-x64.exe';
const windowId = 'w-2099630';
const stateHome = path.join(__dirname, 'state');
const send = value => process.stdout.write(JSON.stringify(value) + '\n');
const log = path.join(__dirname, 'calls.log');
function desktop(args) {
  const result = spawnSync(exe, args, {encoding:'utf8', env:{...process.env, AGENT_DESKTOP_HOME:stateHome}, timeout:15000});
  if (result.error) throw result.error;
  const parsed = JSON.parse(result.stdout);
  if (!parsed.ok) throw Error(JSON.stringify(parsed.error));
  return parsed.data;
}
function tree() {
  const result = desktop(['snapshot','--window-id',windowId,'--compact']);
  if (result.window.id !== windowId || result.window.title !== 'Agent Desktop Synthetic Proof 8D4C') throw Error('Unexpected window');
  const elements=[]; function walk(node){ if (!node) return; elements.push(node); for(const child of node.children || []) walk(child); } walk(result.tree);
  return elements;
}
readline.createInterface({input:process.stdin}).on('line', line => {
  let req; try { req=JSON.parse(line); } catch { return; }
  if(req.id === undefined) return;
  if(req.method === 'initialize') return send({jsonrpc:'2.0',id:req.id,result:{protocolVersion:req.params.protocolVersion,capabilities:{tools:{}},serverInfo:{name:'synthetic-desktop-proof',version:'1'}}});
  if(req.method === 'tools/list') return send({jsonrpc:'2.0',id:req.id,result:{tools:[
    {name:'observe_synthetic_ui',description:'Observe only the synthetic proof window and its status.',inputSchema:{type:'object',properties:{}}},
    {name:'click_synthetic_button',description:'Click only Mark complete in the synthetic proof window, then report observed status.',inputSchema:{type:'object',properties:{}}}
  ]}});
  if(req.method !== 'tools/call') return send({jsonrpc:'2.0',id:req.id,error:{code:-32601,message:'Method not found'}});
  try {
    fs.appendFileSync(log, req.params.name+'\n');
    let elements=tree();
    if(req.params.name === 'click_synthetic_button') {
      const button=elements.find(node => node.role==='button' && node.name==='Mark complete');
      if(!button || !button.ref_id) throw Error('Synthetic button unavailable');
      desktop(['click',button.ref_id]);
      elements=tree();
    } else if(req.params.name !== 'observe_synthetic_ui') throw Error('Unknown tool');
    const status=elements.find(node => String(node.name||'').startsWith('Status:'))?.name || 'Status unavailable';
    return send({jsonrpc:'2.0',id:req.id,result:{content:[{type:'text',text:status}],isError:false}});
  } catch(err) { return send({jsonrpc:'2.0',id:req.id,result:{content:[{type:'text',text:err.message}],isError:true}}); }
});
