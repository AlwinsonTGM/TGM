// Throwaway local terminal experiment; not a production server.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const WebSocket = require('ws');
const pty = require('node-pty');
const token = crypto.randomBytes(24).toString('hex');
const assets = {
  '/': ['index.html', 'text/html'],
  '/xterm.js': ['node_modules/@xterm/xterm/lib/xterm.js', 'text/javascript'],
  '/xterm.css': ['node_modules/@xterm/xterm/css/xterm.css', 'text/css'],
  '/fit.js': ['node_modules/@xterm/addon-fit/lib/addon-fit.js', 'text/javascript'],
};
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  if (url.searchParams.get('token') !== token || !assets[url.pathname]) { res.writeHead(404).end(); return; }
  const [file, type] = assets[url.pathname];
  res.writeHead(200, {'Content-Type':type, 'Cache-Control':'no-store'});
  fs.createReadStream(path.join(__dirname,file)).pipe(res);
});
const wss = new WebSocket.Server({server, verifyClient: info => new URL(info.req.url,'http://127.0.0.1').searchParams.get('token') === token});
let connected = false;
wss.on('connection', ws => {
  if (connected) { ws.close(); return; }
  connected = true;
  const term = pty.spawn(process.env.ComSpec || 'cmd.exe', ['/d', '/c', 'agy --model gemini-3.8-flash-low --mode plan'], {
    cwd:path.resolve(__dirname,'../agy-mcp-test'), cols:100, rows:30, name:'xterm-256color', env:process.env
  });
  term.onData(data => { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({type:'data', data})); });
  term.onExit(({exitCode}) => { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({type:'exit', exitCode})); });
  ws.on('message', bytes => {
    let msg; try { msg = JSON.parse(bytes); } catch { return; }
    if (msg.type === 'input' && typeof msg.data === 'string') term.write(msg.data);
    if (msg.type === 'resize' && Number.isInteger(msg.cols) && Number.isInteger(msg.rows) && msg.cols >= 10 && msg.cols <= 300 && msg.rows >= 5 && msg.rows <= 100) term.resize(msg.cols,msg.rows);
  });
  ws.on('close', () => { try { term.kill(); } catch {} });
});
server.listen(0,'127.0.0.1', () => console.log(`http://127.0.0.1:${server.address().port}/?token=${token}`));
