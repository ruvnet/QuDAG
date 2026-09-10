import readline from 'node:readline';
const mode = process.argv[2];
for await (const line of readline.createInterface({input:process.stdin})) {
 const req=JSON.parse(line); if(!req.id) continue;
 if(mode==='hang') continue;
 if(mode==='oversize') { process.stdout.write('x'.repeat(10000)); continue; }
 if(mode==='stderr') { process.stderr.write('secret'.repeat(2000)); continue; }
 if(mode==='bad') { process.stdout.write('not-json\n'); continue; }
 if(mode==='exit') process.exit(1);
 let result;
 if(req.method==='initialize') result={protocolVersion:'2024-11-05',serverInfo:{name:'agentbbs-mcp',version:'0.1.0'},capabilities:{tools:{}}};
 else if(req.method==='resources/read') result={contents:[{uri:req.params.uri,mimeType:'text/plain',text:'General\n'}]};
 else result={content:[{type:'text',text:JSON.stringify(req.params)}]};
 process.stdout.write(JSON.stringify({jsonrpc:'2.0',id:req.id,result})+'\n');
}
