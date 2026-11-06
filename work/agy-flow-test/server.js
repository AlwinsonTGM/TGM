const readline = require('node:readline');
const fs = require('node:fs');
const path = require('node:path');
const log = path.join(__dirname, 'mcp-events.jsonl');
const send = value => process.stdout.write(JSON.stringify(value) + '\n');
const record = value => fs.appendFileSync(log, JSON.stringify(value) + '\n');
const tools = [
  {name:'start_focus',description:'Start only the disposable FlowState test task.',inputSchema:{type:'object',properties:{},additionalProperties:false}},
  {name:'stop_focus',description:'Stop only the disposable FlowState test session, leaving its task open.',inputSchema:{type:'object',properties:{},additionalProperties:false}}
];
readline.createInterface({input:process.stdin}).on('line', async line => {
  let req; try { req = JSON.parse(line); } catch { return; }
  if (req.id === undefined) return;
  if (req.method === 'initialize') return send({jsonrpc:'2.0',id:req.id,result:{protocolVersion:req.params.protocolVersion,capabilities:{tools:{}},serverInfo:{name:'disposable-flow-test',version:'1.0.0'}}});
  if (req.method === 'tools/list') return send({jsonrpc:'2.0',id:req.id,result:{tools}});
  if (req.method !== 'tools/call' || !tools.some(t => t.name === req.params.name)) return send({jsonrpc:'2.0',id:req.id,error:{code:-32601,message:'Method not found'}});
  const name = req.params.name;
  try {
    const response = await fetch('http://127.0.0.1:42731/' + (name === 'start_focus' ? 'start' : 'stop'), {method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(name === 'start_focus' ? {title:'Synthetic AGY integration test',estimated_seconds:1500} : {}),signal:AbortSignal.timeout(10000)});
    const data = await response.json();
    record({name,status:response.status,data});
    send({jsonrpc:'2.0',id:req.id,result:{content:[{type:'text',text:JSON.stringify(data)}],isError:!response.ok || !data.ok}});
  } catch (error) {
    record({name,error:error.message});
    send({jsonrpc:'2.0',id:req.id,result:{content:[{type:'text',text:'Disposable FlowState bridge failed: '+error.message}],isError:true}});
  }
});
