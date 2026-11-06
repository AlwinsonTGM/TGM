const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const out = path.join(__dirname,'renderer-diagnostics.log');
function log(x) { fs.appendFileSync(out,`${Date.now()} ${x}\n`); }
fs.writeFileSync(out,'');
app.setPath('userData',path.join(__dirname,'diag-profile'));
app.on('child-process-gone',(_e,d)=>log(`child ${JSON.stringify(d)}`));
app.on('renderer-process-crashed',(_e,contents,killed)=>log(`deprecated crash killed=${killed}`));
process.on('uncaughtException',e=>log(`exception ${e.stack}`));
app.whenReady().then(async()=>{
 const win=new BrowserWindow({show:false,webPreferences:{contextIsolation:true,nodeIntegration:false}});
 win.webContents.on('render-process-gone',(_e,d)=>log(`gone ${JSON.stringify(d)}`));
 win.webContents.on('did-fail-load',(_e,...x)=>log(`fail ${JSON.stringify(x)}`));
 win.webContents.on('did-finish-load',()=>log('finish load'));
 win.webContents.on('console-message',(_e,...x)=>log(`console ${JSON.stringify(x)}`));
 try { await win.loadURL('data:text/html,<html><body>synthetic test</body></html>'); log(`title=${await win.webContents.executeJavaScript('document.body.innerText')}`); }
 catch(e) { log(`load error ${e.stack}`); }
 setTimeout(()=>app.exit(0),1500);
});
setTimeout(()=>{log('timeout');app.exit(1)},12000);
