const {spawn} = require('node:child_process');
const readline = require('node:readline');
const assert = require('node:assert/strict');
const server = spawn(process.execPath, ['server.js'], {cwd:__dirname});
const lines = readline.createInterface({input:server.stdout});
const pending = new Map();
let id = 0;
lines.on('line', line => {const message = JSON.parse(line); if (pending.has(message.id)) pending.get(message.id)(message);});
const call = (method, params) => new Promise(resolve => {const next = ++id; pending.set(next, resolve); server.stdin.write(JSON.stringify({jsonrpc:'2.0',id:next,method,params}) + '\n');});
(async () => {
  const init = await call('initialize', {protocolVersion:'2025-03-26',capabilities:{},clientInfo:{name:'local-check',version:'1'}});
  assert.equal(init.result.serverInfo.name, 'isolated-mcp-test');
  const list = await call('tools/list', {});
  assert.equal(list.result.tools[0].name, 'get_test_marker');
  const result = await call('tools/call', {name:'get_test_marker',arguments:{}});
  assert.equal(result.result.content[0].text, 'marker: violet-bamboo-741');
  process.stdout.write('PASS: synthetic client initialized, discovered tool, and received the marker.\n');
  server.kill();
})().catch(err => {console.error(err);server.kill();process.exitCode=1;});
