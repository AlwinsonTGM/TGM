const fs = require('node:fs');
const path = require('node:path');
const readline = require('node:readline');
const base = __dirname;
const dataPath = path.join(base, 'data.json');
const bound = process.argv[2];
const load = () => JSON.parse(fs.readFileSync(dataPath, 'utf8'));
const save = data => fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
const send = message => process.stdout.write(JSON.stringify(message) + '\n');
const error = (id, message) => send({jsonrpc:'2.0', id, error:{code:-32602, message}});
if (process.argv[2] === 'approve' || process.argv[2] === 'reject') {
  const data = load();
  const draft = data.drafts.find(item => item.id === Number(process.argv[3]));
  if (!draft) throw Error('missing draft');
  const project = data.projects[draft.project];
  if (process.argv[2] === 'approve') {
    if (draft.revision !== project.revision) throw Error('stale draft');
    if (Buffer.byteLength(project.memory + draft.text) > 100) throw Error('memory cap exceeded');
    project.memory += draft.text;
    project.revision++;
  }
  data.drafts = data.drafts.filter(item => item.id !== draft.id);
  save(data);
  process.exit(0);
}
if (!['alpha', 'beta'].includes(bound)) throw Error('invalid synthetic project');
readline.createInterface({input:process.stdin}).on('line', line => {
  let req;
  try {
    req = JSON.parse(line);
    if (req.id === undefined) return;
    if (req.method === 'initialize') return send({jsonrpc:'2.0', id:req.id, result:{protocolVersion:req.params.protocolVersion, capabilities:{tools:{}}, serverInfo:{name:'synthetic-project-memory',version:'1'}}});
    if (req.method === 'tools/list') return send({jsonrpc:'2.0',id:req.id,result:{tools:[{name:'read_memory',description:'Read the synthetic memory for the current project only.',inputSchema:{type:'object',properties:{},additionalProperties:false}},{name:'propose_memory',description:'Create a pending draft for the current project only; the draft is NOT approved or saved to memory.',inputSchema:{type:'object',properties:{text:{type:'string'}},required:['text'],additionalProperties:false}}]}});
    if (req.method !== 'tools/call') return error(req.id, 'method unavailable');
    const {name, arguments: args = {}} = req.params;
    const data = load();
    const project = data.projects[bound];
    if (name === 'read_memory' && Object.keys(args).length === 0) return send({jsonrpc:'2.0',id:req.id,result:{content:[{type:'text',text:project.memory}]}});
    if (name === 'propose_memory' && Object.keys(args).length === 1 && typeof args.text === 'string') {
      if (!args.text.trim() || Buffer.byteLength(project.memory + args.text) > 100) return error(req.id, 'empty or memory cap exceeded');
      const draft = {id:data.nextId++,project:bound,text:args.text,revision:project.revision};
      data.drafts.push(draft);
      save(data);
      return send({jsonrpc:'2.0',id:req.id,result:{content:[{type:'text',text:'Pending synthetic draft ' + draft.id + '; memory unchanged pending approval.'}]}});
    }
    return error(req.id,'tool or arguments unavailable');
  } catch (e) { if (req && req.id !== undefined) error(req.id,e.message); }
});
