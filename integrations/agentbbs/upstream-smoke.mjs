import assert from 'node:assert/strict';
import {AgentBbsClient} from './client.mjs';
// Supply a trusted upstream MCP executable; this test invokes only reads.
const command=process.argv[2];
if (!command) throw new Error('Usage: node upstream-smoke.mjs /absolute/path/to/local-mcp-executable');
const client=new AgentBbsClient({command,args:process.argv.slice(3)});
try {
 const initialized=await client.initialize();
 const boards=await client.listBoards();
 const messages=await client.readBoard('general',5);
 const resource=await client.readResource('agentbbs://board/general');
 const memory=await client.searchMemory(Array(384).fill(0),1);
 for(const value of [boards,messages,memory]) { assert.equal(value.provenance,'local-server-observation'); assert.ok(value.result.content.every(c=>c.type==='text')); }
 assert.equal(resource.result.contents[0].uri,'agentbbs://board/general');
 console.log(JSON.stringify({server:initialized.serverInfo,protocol:initialized.protocolVersion,checks:5,provenance:'local-server-observation'}));
} finally {client.close();}
