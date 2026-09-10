import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { FederationClient, parseResponse, validateCall, PROTOCOL } from './client.mjs';
import { fixture } from './fixture.mjs';
for (const mode of ['json', 'sse']) test(`handshake, concurrent calls and session teardown ${mode}`, async () => {
  const f = await fixture(mode); const c = new FederationClient({ fetchImpl: f.fetchImpl });
  try {
    await Promise.all([c.call('federation_identity'), c.call('claims_status')]);
    assert.equal(f.requests.filter(x => x.method === 'initialize').length, 1);
    assert.equal(f.requests[1].method, 'notifications/initialized');
    assert.equal(f.requests[2].headers['mcp-session-id'], 'fixture-session');
    assert.equal(f.requests[2].headers['mcp-protocol-version'], PROTOCOL);
    await c.close(); assert.equal(f.requests.at(-1).method, 'DELETE');
  } finally { await f.close(); }
});
test('local policy refuses writes, secrets and unbounded reads before fetch', async () => {
  let calls = 0; const c = new FederationClient({ fetchImpl: () => { calls++; throw Error('unexpected'); } });
  for (const [name, args] of [['federation_publish', {}], ['federation_identity', { adminToken: 'secret' }], ['federation_sync', { limit: 101 }], ['federation_sync', { sinceSeconds: -1 }], ['claims_status', []]]) await assert.rejects(c.call(name, args));
  assert.equal(calls, 0);
  assert.throws(() => new FederationClient({ endpoint: 'http://127.0.0.1/mcp' }));
  assert.throws(() => new FederationClient({ endpoint: 'https://x.ruv.io/mcp?evil=1' }));
  validateCall('federation_sync', { limit: 10, sinceSeconds: 60, type: 'Status' });
});
test('parser validates ids, envelopes, remote errors and content types', () => {
  for (const envelope of [{ jsonrpc: '2.0', id: 2, result: {} }, { jsonrpc: '1.0', id: 1, result: {} }, { jsonrpc: '2.0', id: 1, result: {}, error: {} }, { jsonrpc: '2.0', id: 1, error: { code: -1, message: 'secret' } }]) assert.throws(() => parseResponse(JSON.stringify(envelope), 'application/json', 1));
  assert.throws(() => parseResponse('{}', 'text/html', 1));
  const event = 'data: {"jsonrpc":"2.0","id":1,"result":{}}\n\n';
  assert.throws(() => parseResponse(event + event, 'text/event-stream', 1));
});
test('bounds, HTTP errors, negotiation and redirects', async () => {
  await assert.rejects(new FederationClient({ maxBytes: 8, fetchImpl: async () => new Response('x'.repeat(9), { headers: { 'content-type': 'application/json' } }) }).initialize(), /byte limit/);
  await assert.rejects(new FederationClient({ fetchImpl: async () => new Response('', { status: 403 }) }).initialize(), /403/);
  await assert.rejects(new FederationClient({ fetchImpl: async () => new Response(JSON.stringify({ jsonrpc: '2.0', id: 1, result: { protocolVersion: 'wrong' } }), { headers: { 'content-type': 'application/json' } }) }).initialize(), /Incompatible/);
  const c = new FederationClient({ fetchImpl: async (_url, init) => { assert.equal(init.redirect, 'error'); assert.ok(init.signal); throw Error('redirect rejected'); } });
  await assert.rejects(c.initialize(), /redirect/);
});
test('stdio bridge initializes and lists only local read tools', async () => {
  const child = spawn(process.execPath, ['bridge.mjs'], { cwd: new URL('.', import.meta.url), stdio: ['pipe', 'pipe', 'pipe'] });
  let output = ''; child.stdout.on('data', c => { output += c; });
  child.stdin.write('not json\n');
  child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 8 }) + '\n');
  child.stdin.end([
    { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: PROTOCOL } },
    { jsonrpc: '2.0', method: 'notifications/initialized' },
    { jsonrpc: '2.0', id: 2, method: 'tools/list' },
    { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'federation_publish' } },
  ].map(JSON.stringify).join('\n') + '\n');
  await new Promise(resolve => child.on('exit', resolve));
  const replies = output.trim().split('\n').map(JSON.parse);
  assert.equal(replies[0].error.code, -32700);
  assert.equal(replies[1].error.code, -32600);
  assert.equal(replies.find(r => r.id === 2).result.tools.length, 3);
  assert.match(replies.find(r => r.id === 3).error.message, /forbidden/);
});
test('real HTTP redirects are rejected and slow bodies hit the deadline', async () => {
  const { createServer } = await import('node:http');
  for (const mode of ['redirect', 'slow']) {
    const server = createServer((_req, res) => {
      if (mode === 'redirect') res.writeHead(302, { location: 'http://127.0.0.1:1/private' }).end();
      else { res.writeHead(200, { 'content-type': 'text/event-stream' }); res.write(': keepalive\n\n'); }
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const client = new FederationClient({ timeoutMs: 40, fetchImpl: (_url, init) => fetch(`http://127.0.0.1:${server.address().port}`, init) });
    try { await assert.rejects(client.initialize()); }
    finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
  }
});
test('session changes and malformed tool results are rejected', async () => {
  let n = 0;
  const c = new FederationClient({ fetchImpl: async (_url, init) => {
    const request = JSON.parse(init.body); n++;
    if (!request.id) return new Response(null, { status: 202 });
    const result = request.method === 'initialize' ? { protocolVersion: PROTOCOL, capabilities: {}, serverInfo: {} } : { content: [] };
    return new Response(JSON.stringify({ jsonrpc: '2.0', id: request.id, result }), { headers: { 'content-type': 'application/json', 'mcp-session-id': n === 1 ? 'first' : 'changed' } });
  } });
  await assert.rejects(c.call('claims_status'), /session/);
  const malformed = new FederationClient({ fetchImpl: async (_url, init) => {
    const request = JSON.parse(init.body);
    if (!request.id) return new Response(null, { status: 202 });
    const result = request.method === 'initialize' ? { protocolVersion: PROTOCOL, capabilities: {}, serverInfo: {} } : { content: 'wrong' };
    return new Response(JSON.stringify({ jsonrpc: '2.0', id: request.id, result }), { headers: { 'content-type': 'application/json' } });
  } });
  await assert.rejects(malformed.call('claims_status'), /Invalid tool result/);
});
test('SSE completes promptly without EOF and ignores later malformed events', async () => {
  const { createServer } = await import('node:http');
  const server = createServer(async (req, res) => {
    let body = ''; for await (const c of req) body += c;
    const msg = JSON.parse(body);
    if (!msg.id) { res.writeHead(202).end(); return; }
    const result = msg.method === 'initialize' ? { protocolVersion: PROTOCOL, capabilities: {}, serverInfo: {} } : { content: [] };
    res.writeHead(200, { 'content-type': 'text/event-stream' });
    const event = `data: ${JSON.stringify({ jsonrpc: '2.0', id: msg.id, result })}\r\n\r\n`;
    res.write(event.slice(0, 20)); res.write(event.slice(20) + 'data: INVALID\n\n');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const client = new FederationClient({ timeoutMs: 1000, fetchImpl: (_url, init) => fetch(`http://127.0.0.1:${server.address().port}`, init) });
  try { assert.deepEqual(await client.call('federation_identity'), { content: [] }); }
  finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
});

test('resource reads are allowlisted and correlated with the requested URI', async () => {
  const f = await fixture('sse'); const c = new FederationClient({ fetchImpl: f.fetchImpl });
  try {
    await assert.rejects(c.readResource('file:///etc/passwd'), /forbidden/);
    assert.equal(f.requests.length, 0);
    for (const uri of ['ruv://federation/registry', 'ruv://swarm/roster', 'ruv://claims/board']) {
      const result = await c.readResource(uri);
      assert.equal(result.contents[0].uri, uri);
    }
  } finally { await c.close(); await f.close(); }
});
