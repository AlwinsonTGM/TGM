const fs = require('node:fs');
const path = require('node:path');
const base = __dirname;
fs.writeFileSync(path.join(base,'data.json'),JSON.stringify({projects:{alpha:{memory:'alpha-base:',revision:0},beta:{memory:'beta-base:',revision:0}},drafts:[],nextId:1},null,2));
for (const project of ['alpha','beta']) {
  const config = {mcpServers:{project_probe:{command:process.execPath,args:[path.join(base,'server.js'),project]}}};
  fs.writeFileSync(path.join(base,project,'.agents','mcp_config.json'),JSON.stringify(config,null,2));
}
fs.writeFileSync(path.join(base,'settings.json'),JSON.stringify({permissions:{allow:['mcp(project_probe/read_memory)','mcp(project_probe/propose_memory)']}}));
