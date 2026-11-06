const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
let terminalProcess, server, completed = false;
const deadline = setTimeout(() => finish(false, 'timed out waiting for AGY response'), 120000);
function finish(ok, message) {
 if(completed) return; completed=true; clearTimeout(deadline);
 if(terminalProcess) try { terminalProcess.kill(); } catch(_) {}
 if(server) server.close();
 fs.writeFileSync(path.join(__dirname,'agy-result.json'),JSON.stringify({ok,message,electron:process.versions.electron},null,2));
 app.exit(ok ? 0 : 1);
}
app.whenReady().then(async()=>{
 const pty=require('node-pty');
 const win=new BrowserWindow({show:false,width:900,height:600,webPreferences:{contextIsolation:true,nodeIntegration:false,preload:path.join(__dirname,'preload.js')}});
 win.webContents.on('render-process-gone',(_,d)=>finish(false,`renderer ${d.reason}`));
 ipcMain.on('start',()=>{
  try {
   terminalProcess=pty.spawn(process.env.ComSpec || 'cmd.exe',['/d','/c','agy --model gemini-3.8-flash-low --mode plan'],{name:'xterm-256color',cols:100,rows:30,cwd:path.resolve(__dirname,'../agy-mcp-test'),env:process.env});
   terminalProcess.onData(data=>win.webContents.send('data',data));
   terminalProcess.onExit(({exitCode})=>{if(!completed)finish(false,`shell exited: ${exitCode}`)});
   win.webContents.send('ready');
  } catch(e){finish(false,e.stack)}
 });
 ipcMain.on('input',(_,d)=>terminalProcess.write(d));
 ipcMain.on('capture',(_,d)=>fs.writeFileSync(path.join(__dirname,'agy-screen.txt'),d));
 ipcMain.on('verified',(_,d)=>finish(true,d));
 ipcMain.on('failed',(_,d)=>finish(false,d));
 const files={'/':['index-agy.html','text/html'],'/renderer-agy.js':['renderer-agy.js','text/javascript'],'/node_modules/@xterm/xterm/css/xterm.css':['node_modules/@xterm/xterm/css/xterm.css','text/css'],'/node_modules/@xterm/xterm/lib/xterm.js':['node_modules/@xterm/xterm/lib/xterm.js','text/javascript']};
 server=http.createServer((req,res)=>{const item=files[req.url];if(!item){res.writeHead(404).end();return;}res.setHeader('Content-Type',item[1]);fs.createReadStream(path.join(__dirname,item[0])).pipe(res)});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 await win.loadURL(`http://127.0.0.1:${server.address().port}/`);
}).catch(e=>finish(false,e.stack));
