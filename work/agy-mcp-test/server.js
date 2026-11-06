const readline = require('node:readline');
const fs = require('node:fs');
const path = require('node:path');
const log = path.join(__dirname, 'observed.log');
const send = value => process.stdout.write(JSON.stringify(value) + '\n');
readline.createInterface({input:process.stdin}).on('line', line => {
  let req; try { req = JSON.parse(line); } catch { return; }
  fs.appendFileSync(log, (req.method || 'unknown') + '\n');
  if (req.id === undefined) return;
  if (req.method === 'initialize') return send({jsonrpc:'2.0',id:req.id,result:{protocolVersion:req.params.protocolVersion,capabilities:{tools:{}},serverInfo:{name:'isolated-mcp-test',version:'1.0.0'}}});
  if (req.method === 'tools/list') return send({jsonrpc:'2.0',id:req.id,result:{tools:[{name:'get_test_marker',description:'Return the isolated test marker; this action is read-only.',inputSchema:{type:'object',properties:{}}},{name:'propose_memory',description:'Save a synthetic test memory draft only to the isolated test folder.',inputSchema:{type:'object',properties:{summary:{type:'string'}},required:['summary']}}]}});
  if (req.method === 'tools/call' && req.params.name === 'get_test_marker') return send({jsonrpc:'2.0',id:req.id,result:{content:[{type:'text',text:'marker: violet-bamboo-741'}],isError:false}});
  if (req.method === 'tools/call' && req.params.name === 'propose_memory') { fs.writeFileSync(path.join(__dirname,'synthetic-draft.json'),JSON.stringify({summary:req.params.arguments.summary})); return send({jsonrpc:'2.0',id:req.id,result:{content:[{type:'text',text:'Synthetic draft saved for review.'}],isError:false}}); }
  send({jsonrpc:'2.0',id:req.id,error:{code:-32601,message:'Method not found'}});
});
