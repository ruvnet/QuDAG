import test from 'node:test';
import assert from 'node:assert/strict';
import { RuvectorIndex, textEmbedding, backend } from './index.mjs';
test('real native cosine retrieval and metadata isolation', async () => {
  assert.equal(backend.native,true); const db=new RuvectorIndex({dimensions:3});
  const metadata={type:'task'};await db.add({id:'x',vector:[2,0,0],metadata});metadata.type='tampered';
  await db.add({id:'y',vector:[0,1,0]});const result=await db.search([1,0,0],2);
  assert.deepEqual(result.map(x=>[x.id,x.score]),[['x',0],['y',1]]);assert.equal(result[0].metadata.type,'task');
  result[0].metadata.type='changed';assert.equal((await db.search([1,0,0],1))[0].metadata.type,'task');await db.close();await assert.rejects(db.search([1,0,0],1),/closed/);
});
test('validation, immutable duplicates and capacity',async()=>{
  assert.throws(()=>new RuvectorIndex({dimensions:0}));const db=new RuvectorIndex({dimensions:2,maxElements:1});
  for(const vector of [[1],[NaN,1],[Infinity,0],[0,0],['1',0]]) await assert.rejects(db.add({id:'a',vector}));
  await assert.rejects(db.search([1,0],0));await assert.rejects(db.search([1,0],2));
  const outcomes=await Promise.allSettled([db.add({id:'a',vector:[1,0]}),db.add({id:'a',vector:[1,0]})]);assert.equal(outcomes.filter(x=>x.status==='fulfilled').length,1);
  await assert.rejects(db.add({id:'a',vector:[0,1]}),/duplicate/);await assert.rejects(db.add({id:'b',vector:[0,1]}),/capacity/);assert.equal(db.stats().size,1);await db.close();
});
test('deterministic lexical embeddings and related retrieval',async()=>{
  assert.deepEqual(textEmbedding('QUANTUM relay'),textEmbedding('quantum relay'));assert.throws(()=>textEmbedding('  '));
  const db=new RuvectorIndex();assert.deepEqual(await db.search(textEmbedding('relay'),1),[]);
  await db.add({id:'relay',vector:textEmbedding('quantum relay quantum relay')});await db.add({id:'fruit',vector:textEmbedding('apple banana orange')});
  assert.equal((await db.search(textEmbedding('quantum relay'),1))[0].id,'relay');await db.close();
});
test('independent instances isolate native storage and dimensions',async()=>{
  const first=new RuvectorIndex({dimensions:2}),second=new RuvectorIndex({dimensions:3});
  await first.add({id:'same',vector:[1,0]});await second.add({id:'same',vector:[0,1,0]});
  assert.equal((await first.search([1,0],1))[0].score,0);assert.equal((await second.search([0,1,0],1))[0].score,0);await first.close();await second.close();
});
