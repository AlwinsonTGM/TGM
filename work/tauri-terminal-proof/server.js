// Disposable test only: loopback service for a synthetic shell, not production IPC.
const fs = require('node:fs');
const path = require('node:path');
const base = path.resolve(__dirname, '../terminal-probe/node_modules');
const WebSocket = require(path.join(base, 'ws'));
const pty = require(path.join(base, 'node-pty'));
const wss = new WebSocket.Server({host:'127.0.0.1',port:39872,verifyClient:info=>info.req.url==='/tauri-synthetic-proof-64f'});
wss.on('connection', ws => {
  const term = pty.spawn(process.env.ComSpec, ['/d', '/q'], {cols:80,rows:24,cwd:__dirname,env:process.env});
  term.onData(data => { if (ws.readyState === WebSocket.OPEN) ws.send(data); });
  ws.on('message', message => { const m=JSON.parse(message); if(m.type==='start') term.write('echo TAURI_PTY_ROUNDTRIP_64F\r'); if(m.type==='success') fs.writeFileSync(path.join(__dirname,'renderer-success.txt'),'Tauri renderer received shell marker via xterm.js'); });
  ws.on('close',()=>term.kill());
});
console.log('synthetic PTY server ready');
