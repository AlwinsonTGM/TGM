// Disposable proof only: the check and writes are not an atomic transaction.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');
const base = __dirname, vault = path.join(base, 'vault'), subject = path.join(vault, 'Study', 'Subject.md'), reviewer = path.join(vault, 'Study', 'HTTP Reviewer.md');
const pending = JSON.parse(fs.readFileSync(path.join(base, 'mcp-draft.json'), 'utf8').replace(/^\uFEFF/, ''));
if (pending.status !== 'PENDING' || !pending.markdown) throw new Error('No valid pending MCP reviewer');
fs.mkdirSync(path.dirname(subject), {recursive:true});
fs.writeFileSync(subject, '---\ntitle: Study\ncustom: preserve-me\n---\n\n# Study\n\nExisting study index.\n');
if (fs.existsSync(reviewer)) fs.unlinkSync(reviewer);
const hash = p => fs.existsSync(p) ? crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex') : null;
const logs = [];
let draft;
function createDraft(){draft={status:'pending', reviewer: pending.markdown + '\nSee [[Study/Subject|Study index]].\n', subject: fs.readFileSync(subject,'utf8') + '\n- [[Study/HTTP Reviewer|HTTP Reviewer]]\n', bases:[hash(subject),hash(reviewer)]};logs.push('preview created');}
createDraft();
const html = `<!doctype html><meta charset="utf-8"><title>Reviewer approval proof</title><h1>Reviewer approval proof</h1><p>AGY generated this reviewer from a synthetic study session. Test vault only.</p><h2>Proposed reviewer</h2><pre id="reviewer"></pre><h2>Proposed index update</h2><pre id="subject"></pre><button id="reject">Reject</button> <button id="approve">Approve and save</button> <button id="fresh">Make fresh draft</button> <button id="external">Simulate external edit</button><p role="status" id="status"></p><script>
async function update(msg=''){let s=await (await fetch('/state')).json();document.getElementById('reviewer').textContent=s.draft.reviewer;document.getElementById('subject').textContent=s.draft.subject;document.getElementById('status').textContent=msg+' '+s.logs.join(' | ')}
for (const name of ['reject','approve','fresh','external']) document.getElementById(name).onclick=async()=>{let r=await fetch('/'+name,{method:'POST'});update(await r.text())};update();</script>`;
http.createServer((req,res)=>{
 const send=(code,content,type='text/plain')=>{res.writeHead(code,{'Content-Type':type+'; charset=utf-8'});res.end(content)};
 if(req.method==='GET'&&req.url==='/')return send(200,html,'text/html');
 if(req.method==='GET'&&req.url==='/state')return send(200,JSON.stringify({draft,logs,subjectExists:fs.existsSync(subject),reviewerExists:fs.existsSync(reviewer)}),'application/json');
 if(req.method==='POST'&&req.url==='/reject'){draft.status='rejected';logs.push('rejected; no vault write');return send(200,'Rejected');}
 if(req.method==='POST'&&req.url==='/fresh'){createDraft();return send(200,'Fresh draft');}
 if(req.method==='POST'&&req.url==='/external'){fs.appendFileSync(subject,'\nExternal change for test.\n');logs.push('external edit');return send(200,'External edit made');}
 if(req.method==='POST'&&req.url==='/approve'){
  if(draft.status!=='pending')return send(400,'Draft is not pending');
  if(hash(subject)!==draft.bases[0]||hash(reviewer)!==draft.bases[1]){logs.push('blocked stale draft');return send(409,'Conflict: review a fresh draft');}
  fs.writeFileSync(reviewer,draft.reviewer);fs.writeFileSync(subject,draft.subject);draft.status='applied';logs.push('approved and saved');return send(200,'Saved');
 }
 send(404,'Not found');
}).listen(4188,'127.0.0.1',()=>console.log('Reviewer proof at http://127.0.0.1:4188'));
