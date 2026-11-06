const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const {spawnSync} = require('node:child_process');
const base = __dirname;
const dataPath = path.join(base,'data.json');
fs.copyFileSync(path.join(base,'..','server.js'),path.join(base,'server.js'));
fs.writeFileSync(dataPath,JSON.stringify({projects:{alpha:{memory:'alpha-base:',revision:0},beta:{memory:'beta-base:',revision:0}},drafts:[{id:1,project:'alpha',text:'alpha-note',revision:0},{id:2,project:'beta',text:'beta-note',revision:0}],nextId:3},null,2));
const html = `<!doctype html><html lang="en"><meta charset="utf-8"><title>Memory approval test</title><h1>Memory approval test</h1><p>Synthetic test data</p><section id="content"></section><p id="status" role="status"></p><script>
async function render() {const data=await (await fetch('/state')).json();const content=document.getElementById('content');content.replaceChildren();
for (const [project,value] of Object.entries(data.projects)) {const p=document.createElement('p');p.textContent=project+' memory: '+value.memory;content.append(p)}
for(const draft of data.drafts){const div=document.createElement('div');const p=document.createElement('p');p.textContent='Draft '+draft.id+' ('+draft.project+'): '+draft.text;div.append(p);
for(const action of ['approve','reject']){const button=document.createElement('button');button.textContent=action+' '+draft.id;button.addEventListener('click',async()=>{const r=await fetch('/'+action+'/'+draft.id,{method:'POST'});document.getElementById('status').textContent=await r.text();await render()});div.append(button)}content.append(div)}
if(!data.drafts.length){const p=document.createElement('p');p.textContent='No pending drafts';content.append(p)}}render();</script></html>`;
http.createServer((req,res)=>{
 if(req.method==='GET' && req.url==='/'){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});return res.end(html)}
 if(req.method==='GET' && req.url==='/state'){res.writeHead(200,{'Content-Type':'application/json'});return res.end(fs.readFileSync(dataPath))}
 const match=req.method==='POST' && req.url.match(/^\/(approve|reject)\/(\d+)$/);
 if(match){const result=spawnSync(process.execPath,[path.join(base,'server.js'),match[1],match[2]],{encoding:'utf8'});res.writeHead(result.status===0?200:400,{'Content-Type':'text/plain'});return res.end(result.status===0?'Saved '+match[1]+' '+match[2]:'Action failed')}
 res.writeHead(404);res.end();
}).listen(4179,'127.0.0.1',()=>console.log('Approval test at http://127.0.0.1:4179'));
