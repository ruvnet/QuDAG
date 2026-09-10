import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { AgentBbsClient } from './client.mjs';
const fixture=fileURLToPath(new URL('./fixture.mjs',import.meta.url));
function client(mode,options={}) { return new AgentBbsClient({command:process.execPath,args:[fixture,...(mode?[mode]:[])],...options}); }
test('real subprocess handshake and upstream tools and resource shapes',async()=>{
 const c=client(); try {
  assert.equal((await c.initialize()).protocolVersion,'2024-11-05');
  const boards=await c.listBoards(); assert.equal(boards.provenance,'local-server-observation');
  assert.deepEqual(JSON.parse(boards.result.content[0].text),{name:'list_boards',arguments:{}});
  assert.deepEqual(JSON.parse((await c.readBoard('general',10)).result.content[0].text),{name:'read_board',arguments:{board:'general',limit:10}});
  assert.equal(JSON.parse((await c.searchMemory(Array(384).fill(0),2)).result.content[0].text).arguments.top_k,2);
  assert.equal((await c.readResource('agentbbs://board/general')).result.contents[0].uri,'agentbbs://board/general');
 } finally { c.close(); }
});
test('write denied before nonexistent process could spawn',()=>{
 const c=new AgentBbsClient({command:'/nonexistent'}); assert.throws(()=>c.postMessage({}),/disabled/); c.close();
});
test('explicit opt in posts exact arguments to fixture only',async()=>{
 const c=client(undefined,{allowPosts:true}); try {
 const args={board:'general',subject:'test',text:'untrusted data'};
 assert.deepEqual(JSON.parse((await c.postMessage(args)).result.content[0].text),{name:'post_message',arguments:args});
 } finally {c.close();}
});
test('reject invalid paths configuration, board, vector and unknown parameters',()=>{
 assert.throws(()=>new AgentBbsClient({command:'node'}));
 assert.throws(()=>new AgentBbsClient({command:process.execPath,shell:true}));
 const c=client(undefined,{allowPosts:true});
 for(const b of ['../a','a/b','A','', 'a?x']) assert.throws(()=>c.readBoard(b));
 assert.throws(()=>c.readBoard('general',101)); assert.throws(()=>c.listBoards({}));
 assert.throws(()=>c.searchMemory([1])); assert.throws(()=>c.searchMemory(Array(384).fill(NaN)));
 assert.throws(()=>c.searchMemory(Array(384).fill(1e99)));
 assert.throws(()=>c.readResource('https://example.com'));
 assert.throws(()=>c.postMessage({board:'general',subject:'a',text:'b',command:'x'})); c.close();
});
for(const mode of ['hang','oversize','stderr','bad','exit']) test(`bounded process failure: ${mode}`,async()=>{
 const c=client(mode,{timeoutMs:200,maxBytes:1024});
 await assert.rejects(c.listBoards(),/AgentBBS/); c.close();
});
test('queue bounded while initializing, close rejects all queued calls',async()=>{
 const c=client('hang',{timeoutMs:1000});
 const calls=Array.from({length:16},()=>c.listBoards());
 await assert.rejects(c.listBoards(),/queue limit/); c.close();
 const results=await Promise.allSettled(calls); assert.ok(results.every(r=>r.status==='rejected'));
});
