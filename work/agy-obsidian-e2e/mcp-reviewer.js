// Synthetic draft server; never writes the vault.
const fs=require('node:fs');
const path=require('node:path');
const readline=require('node:readline');
const send=x=>process.stdout.write(JSON.stringify(x)+'\n');
readline.createInterface({input:process.stdin}).on('line',line=>{
 let req;
 try{
  req=JSON.parse(line);
  if(req.id===undefined)return;
  if(req.method==='initialize')return send({jsonrpc:'2.0',id:req.id,result:{protocolVersion:req.params.protocolVersion,capabilities:{tools:{}},serverInfo:{name:'synthetic-reviewer',version:'1'}}});
  if(req.method==='tools/list')return send({jsonrpc:'2.0',id:req.id,result:{tools:[{name:'propose_reviewer',description:'Submit a study-session reviewer as a PENDING draft for user review. This does not approve the draft or write the vault.',inputSchema:{type:'object',properties:{markdown:{type:'string',description:'Reviewer in Obsidian Markdown'}},required:['markdown'],additionalProperties:false}}]}});
  if(req.method==='tools/call'&&req.params.name==='propose_reviewer'){
   const args=req.params.arguments||{};
   if(Object.keys(args).length!==1||typeof args.markdown!=='string'||args.markdown.length<50||args.markdown.length>10000)throw Error('Invalid reviewer');
   fs.writeFileSync(path.join(__dirname,'mcp-draft.json'),JSON.stringify({status:'PENDING',markdown:args.markdown},null,2));
   return send({jsonrpc:'2.0',id:req.id,result:{content:[{type:'text',text:'Synthetic reviewer submitted as PENDING. The vault has not been changed; separate approval is required.'}]}});
  }
  send({jsonrpc:'2.0',id:req.id,error:{code:-32601,message:'Unsupported method'}});
 }catch(e){if(req&&req.id!==undefined)send({jsonrpc:'2.0',id:req.id,error:{code:-32602,message:e.message}})}
});
